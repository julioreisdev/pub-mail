import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';

// Status (stories) PUBLICADOS pelos números da organização.
// Multi-número: ao criar, o usuário escolhe 1..N números → UMA linha por número, todas com o mesmo
// `batch_id`. Cada linha publica pelo seu próprio número (`session_id`). Publicar agora ou agendar
// (cron a cada minuto; horário vindo do front em ISO). status: pending | posting | posted | failed | canceled
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
    private readonly presenter: WhatsAppPresenter,
  ) {}

  // ---------------------------------------------------------------- formato
  private async shape(orgId: string, s: any, ctx: { smap?: Map<string, any>; mmap?: Map<string, any> } = {}) {
    const smap = ctx.smap || (await this.presenter.sessionMap(orgId));
    let m: any = null;
    if (s.media_id) m = ctx.mmap ? ctx.mmap.get(s.media_id) || null : await this.prisma.whatsapp_media.findUnique({ where: { id: s.media_id } });
    return {
      id: s.id,
      session_id: s.session_id,
      session: smap.get(s.session_id) || null,
      batch_id: s.batch_id || null,
      type: s.type,
      body: s.body,
      bg_color: s.bg_color,
      font: s.font,
      media: this.media.toPublic(m),
      schedule_at: s.schedule_at,
      status: s.status,
      error: s.error,
      posted_at: s.posted_at,
      wa_status_id: s.wa_status_id,
      created_at: s.created_at,
    };
  }

  private async shapeMany(orgId: string, rows: any[]) {
    if (!rows.length) return [] as any[];
    const smap = await this.presenter.sessionMap(orgId);
    const mediaIds = [...new Set(rows.map((r) => r.media_id).filter(Boolean))] as string[];
    const medias = mediaIds.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: mediaIds } } }) : [];
    const mmap = new Map(medias.map((m) => [m.id, m] as [string, any]));
    const out: any[] = [];
    for (const r of rows) out.push(await this.shape(orgId, r, { smap, mmap }));
    return out;
  }

  private async one(orgId: string, id: string) {
    return this.shapeMany(orgId, [(await this.prisma.whatsapp_statuses.findUnique({ where: { id } }))!]).then((a) => a[0]);
  }

  // ---------------------------------------------------------------- acesso
  /** Status de número que o usuário não vê = inexistente (404). */
  private async own(orgId: string, id: string, allowed: Set<string> | null) {
    const s = await this.prisma.whatsapp_statuses.findFirst({ where: { id, organization_id: orgId } });
    if (!s || (allowed !== null && !allowed.has(s.session_id))) throw new NotFoundException('Status não encontrado.');
    return s;
  }

  // ---------------------------------------------------------------- listagem
  async list(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(String(q.page_size || 20), 10) || 20));
    const empty = { items: [] as any[], total: 0, page, pages: 1 };
    const where: any = { organization_id: orgId };
    const sessionId = q.session_id ? String(q.session_id) : '';
    if (sessionId) {
      if (allowed !== null && !allowed.has(sessionId)) return empty;
      where.session_id = sessionId;
    } else if (allowed !== null) {
      if (!allowed.size) return empty;
      where.session_id = { in: [...allowed] };
    }
    if (q.status && q.status !== 'all') where.status = String(q.status);
    if (q.batch_id) where.batch_id = String(q.batch_id);
    const [total, rows] = await Promise.all([
      this.prisma.whatsapp_statuses.count({ where }),
      this.prisma.whatsapp_statuses.findMany({ where, orderBy: [{ status: 'asc' }, { schedule_at: 'desc' }, { created_at: 'desc' }], skip: (page - 1) * size, take: size }),
    ]);
    return { items: await this.shapeMany(orgId, rows), total, page, pages: Math.max(1, Math.ceil(total / size)) };
  }

  // ---------------------------------------------------------------- criação
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

  /** Números escolhidos: todos da org e permitidos ao usuário (número alheio/inexistente → 404). */
  private async resolveSessions(orgId: string, ids: unknown, allowed: Set<string> | null) {
    const uniq = [...new Set((Array.isArray(ids) ? ids : []).map((v) => String(v || '').trim()).filter(Boolean))];
    if (!uniq.length) throw new BadRequestException('Escolha pelo menos um número para publicar o status.');
    const rows: any[] = [];
    for (const id of uniq) {
      const row = allowed !== null && !allowed.has(id) ? null : await this.sessions.rowById(orgId, id);
      if (!row) throw new NotFoundException('Número não encontrado.');
      rows.push(row);
    }
    return rows;
  }

  /** Cria uma linha por número (mesmo `batch_id`); sem agendamento publica cada uma na hora. */
  async create(orgId: string, userId: string, dto: any, allowed: Set<string> | null = null) {
    const { type, schedule } = this.validate(dto);
    const rows = await this.resolveSessions(orgId, dto.session_ids, allowed);
    if (dto.media_id) await this.media.get(orgId, String(dto.media_id));
    const batchId = randomUUID();
    const base = {
      organization_id: orgId,
      batch_id: batchId,
      type,
      body: dto.body ? String(dto.body).slice(0, 700) : null,
      bg_color: dto.bg_color || null,
      font: dto.font != null ? Number(dto.font) : null,
      media_id: dto.media_id || null,
      schedule_at: schedule,
      status: 'pending',
      created_by: userId,
    };
    const ids: string[] = [];
    for (const row of rows) {
      const created = await this.prisma.whatsapp_statuses.create({ data: { ...base, session_id: row.id } });
      ids.push(created.id);
    }
    // números diferentes = sessões diferentes no gateway → publica em paralelo
    if (!schedule) await Promise.allSettled(ids.map((id) => this.post(id)));
    const fresh = await this.prisma.whatsapp_statuses.findMany({ where: { id: { in: ids } } });
    const order = new Map(ids.map((id, i) => [id, i] as [string, number]));
    fresh.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { batch_id: batchId, items: await this.shapeMany(orgId, fresh) };
  }

  // ---------------------------------------------------------------- edição / remoção
  async patch(orgId: string, id: string, dto: any, allowed: Set<string> | null = null) {
    const s = await this.own(orgId, id, allowed);
    if (s.status !== 'pending') throw new BadRequestException('Só status agendados (pendentes) podem ser editados.');
    const data: any = {};
    if (dto.schedule_at !== undefined) {
      if (dto.schedule_at === null) data.schedule_at = null;
      else { const d = new Date(String(dto.schedule_at)); if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida.'); data.schedule_at = d; }
    }
    if (dto.body !== undefined) data.body = String(dto.body || '').slice(0, 700) || null;
    if (dto.bg_color !== undefined) {
      if (dto.bg_color && !/^#[0-9a-fA-F]{6}$/.test(String(dto.bg_color))) throw new BadRequestException('Cor inválida (use #RRGGBB).');
      data.bg_color = dto.bg_color || null;
    }
    if (dto.font !== undefined) data.font = dto.font == null ? null : Number(dto.font);
    if (Object.keys(data).length) await this.prisma.whatsapp_statuses.update({ where: { id: s.id }, data });
    if (data.schedule_at === null) await this.post(s.id);
    return this.one(orgId, s.id);
  }

  async remove(orgId: string, id: string, allowed: Set<string> | null = null) {
    const s = await this.own(orgId, id, allowed);
    if (s.status === 'pending') {
      await this.prisma.whatsapp_statuses.update({ where: { id: s.id }, data: { status: 'canceled' } });
      return { ok: true, canceled: true };
    }
    if (s.status === 'posted' && s.wa_status_id) {
      // apaga no WhatsApp pelo número que publicou
      const row = await this.sessions.rowById(orgId, s.session_id);
      if (row?.openwa_session_id && row.status === 'ready') await this.openwa.deleteStatus(row.openwa_session_id, s.wa_status_id).catch(() => undefined);
    }
    await this.prisma.whatsapp_statuses.delete({ where: { id: s.id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------- publicação
  /** Publica um status (agora ou pelo cron) pelo número da linha. Claim atômico pending→posting. */
  async post(id: string) {
    const claimed = await this.prisma.whatsapp_statuses.updateMany({ where: { id, status: 'pending' }, data: { status: 'posting' } });
    if (!claimed.count) return;
    const s = (await this.prisma.whatsapp_statuses.findUnique({ where: { id } }))!;
    const fail = async (msg: string) => this.prisma.whatsapp_statuses.update({ where: { id }, data: { status: 'failed', error: msg.slice(0, 255) } });
    const row = await this.sessions.rowById(s.organization_id, s.session_id);
    if (!row) { await fail('Número removido'); return; }
    if (!row.openwa_session_id || row.status !== 'ready') { await fail('WhatsApp não conectado'); return; }
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
      this.logger.warn(`status ${id} (número ${s.session_id}) falhou: ${msg}`);
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
