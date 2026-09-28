import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';

// Status (stories): publicar agora ou agendar (cron a cada minuto; horário vindo do front em ISO).
// status: pending | posting | posted | failed | canceled
const FONTS = [0, 1, 2, 6, 7, 8, 9, 10]; // valores aceitos pelo OpenWA; o front mostra 0..5 → mapeamos

@Injectable()
export class WhatsAppStatusService {
  private readonly logger = new Logger(WhatsAppStatusService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly sessions: WhatsAppSessionsService,
    private readonly media: WhatsAppMediaService,
    private readonly access: AccessService,
  ) {}

  private async shape(orgId: string, s: any) {
    const m = s.media_id ? await this.prisma.whatsapp_media.findUnique({ where: { id: s.media_id } }) : null;
    return { id: s.id, type: s.type, body: s.body, bg_color: s.bg_color, font: s.font, media: this.media.toPublic(m), schedule_at: s.schedule_at, status: s.status, error: s.error, posted_at: s.posted_at, wa_status_id: s.wa_status_id, created_at: s.created_at };
  }

  async list(orgId: string, q: any = {}) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(String(q.page_size || 20), 10) || 20));
    const where: any = { organization_id: orgId };
    if (q.status && q.status !== 'all') where.status = String(q.status);
    const [total, rows] = await Promise.all([
      this.prisma.whatsapp_statuses.count({ where }),
      this.prisma.whatsapp_statuses.findMany({ where, orderBy: [{ status: 'asc' }, { schedule_at: 'desc' }, { created_at: 'desc' }], skip: (page - 1) * size, take: size }),
    ]);
    const items: any[] = [];
    for (const r of rows) items.push(await this.shape(orgId, r));
    return { items, total, page, pages: Math.max(1, Math.ceil(total / size)) };
  }

  private validate(dto: any) {
    const type = String(dto.type || 'text');
    if (!['text', 'image', 'video', 'voice'].includes(type)) throw new BadRequestException('Tipo inválido.');
    if (type === 'text' && !String(dto.body || '').trim()) throw new BadRequestException('Escreva o texto do status.');
    if (type !== 'text' && !dto.media_id) throw new BadRequestException('Envie a mídia do status.');
    if (dto.bg_color && !/^#[0-9a-fA-F]{6}$/.test(String(dto.bg_color))) throw new BadRequestException('Cor inválida (use #RRGGBB).');
    let schedule: Date | null = null;
    if (dto.schedule_at) {
      schedule = new Date(String(dto.schedule_at));
      if (Number.isNaN(schedule.getTime())) throw new BadRequestException('Data de agendamento inválida.');
      if (schedule.getTime() < Date.now() - 60_000) throw new BadRequestException('A data de agendamento já passou.');
    }
    return { type, schedule };
  }

  async create(orgId: string, userId: string, dto: any) {
    const { type, schedule } = this.validate(dto);
    if (dto.media_id) await this.media.get(orgId, String(dto.media_id));
    const row = await this.prisma.whatsapp_statuses.create({
      data: { organization_id: orgId, type, body: dto.body ? String(dto.body).slice(0, 700) : null, bg_color: dto.bg_color || null, font: dto.font != null ? Number(dto.font) : null, media_id: dto.media_id || null, schedule_at: schedule, status: 'pending', created_by: userId },
    });
    if (!schedule) await this.post(row.id);
    return this.shape(orgId, (await this.prisma.whatsapp_statuses.findUnique({ where: { id: row.id } }))!);
  }

  async patch(orgId: string, id: string, dto: any) {
    const s = await this.prisma.whatsapp_statuses.findFirst({ where: { id, organization_id: orgId } });
    if (!s) throw new NotFoundException('Status não encontrado.');
    if (s.status !== 'pending') throw new BadRequestException('Só status agendados (pendentes) podem ser editados.');
    const data: any = {};
    if (dto.schedule_at !== undefined) {
      if (dto.schedule_at === null) data.schedule_at = null;
      else { const d = new Date(String(dto.schedule_at)); if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida.'); data.schedule_at = d; }
    }
    if (dto.body !== undefined) data.body = String(dto.body || '').slice(0, 700) || null;
    if (dto.bg_color !== undefined) data.bg_color = dto.bg_color || null;
    if (dto.font !== undefined) data.font = dto.font == null ? null : Number(dto.font);
    const upd = await this.prisma.whatsapp_statuses.update({ where: { id }, data });
    if (data.schedule_at === null) await this.post(id);
    return this.shape(orgId, (await this.prisma.whatsapp_statuses.findUnique({ where: { id } })) || upd);
  }

  async remove(orgId: string, id: string) {
    const s = await this.prisma.whatsapp_statuses.findFirst({ where: { id, organization_id: orgId } });
    if (!s) throw new NotFoundException('Status não encontrado.');
    if (s.status === 'pending') { await this.prisma.whatsapp_statuses.update({ where: { id }, data: { status: 'canceled' } }); return { ok: true, canceled: true }; }
    if (s.status === 'posted' && s.wa_status_id) {
      const row = await this.sessions.row(orgId);
      if (row?.openwa_session_id && row.status === 'ready') await this.openwa.deleteStatus(row.openwa_session_id, s.wa_status_id).catch(() => undefined);
    }
    await this.prisma.whatsapp_statuses.delete({ where: { id } });
    return { ok: true };
  }

  // Publica um status (agora ou pelo cron). Claim atômico pending→posting.
  async post(id: string) {
    const claimed = await this.prisma.whatsapp_statuses.updateMany({ where: { id, status: 'pending' }, data: { status: 'posting' } });
    if (!claimed.count) return;
    const s = (await this.prisma.whatsapp_statuses.findUnique({ where: { id } }))!;
    const fail = async (msg: string) => this.prisma.whatsapp_statuses.update({ where: { id }, data: { status: 'failed', error: msg.slice(0, 255) } });
    const row = await this.sessions.row(s.organization_id);
    if (!row?.openwa_session_id || row.status !== 'ready') { await fail('WhatsApp não conectado'); return; }
    try {
      let r: any;
      if (s.type === 'text') {
        const font = s.font != null ? FONTS[Math.min(FONTS.length - 1, Math.max(0, Number(s.font)))] : undefined;
        r = await this.openwa.statusText(row.openwa_session_id, String(s.body || ''), s.bg_color || undefined, font);
      } else {
        const m = await this.media.readBase64(s.organization_id, s.media_id!);
        r = await this.openwa.statusMedia(row.openwa_session_id, s.type as any, { base64: m.base64, mimetype: m.mime }, s.body || undefined, s.bg_color || undefined);
      }
      await this.prisma.whatsapp_statuses.update({ where: { id }, data: { status: 'posted', posted_at: new Date(), wa_status_id: r?.statusId ? String(r.statusId).slice(0, 191) : null, error: null } });
    } catch (e: any) {
      const msg = e instanceof OpenWaError ? e.message : String(e?.message || e);
      this.logger.warn(`status ${id} falhou: ${msg}`);
      await fail(msg);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.whatsapp_statuses.findMany({ where: { status: 'pending', schedule_at: { not: null, lte: new Date() } }, orderBy: { schedule_at: 'asc' }, take: 50 });
      for (const s of due) {
        if (!(await this.access.isOrgActive(s.organization_id))) continue; // vencido = tudo para
        await this.post(s.id).catch((e) => this.logger.warn(`post ${s.id}: ${e?.message || e}`));
      }
    } finally {
      this.running = false;
    }
  }
}
