import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppContactsService, isGroupJid, phoneFromJid } from './whatsapp-contacts.service';
import { fillVars } from './whatsapp-broadcasts.service';

// Agendamento PONTUAL: N mensagens para N contatos/grupos em data/hora (BRT vindo do front em ISO).
// Alternativa ao broadcast para casos únicos. Depois de enviado sai da lista de pendentes
// (fica no histórico). Não obedece ao aquecimento (é ação humana pontual), mas conta.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CHAT_ID_RE = /^[^\s@]+@[^\s@]+$/;

@Injectable()
export class WhatsAppSchedulesService {
  private readonly logger = new Logger(WhatsAppSchedulesService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly sessions: WhatsAppSessionsService,
    private readonly media: WhatsAppMediaService,
    private readonly inbound: WhatsAppInboundService,
    private readonly contacts: WhatsAppContactsService,
    private readonly access: AccessService,
  ) {}

  private normTargets(raw: unknown) {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((x) => String(x || '').trim()).filter((x) => CHAT_ID_RE.test(x)))].slice(0, 200);
  }
  private normMessages(raw: unknown) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 10).map((m: any) => ({ id: String(m?.id || Math.random().toString(36).slice(2)), text: String(m?.text || '').slice(0, 4096), media_id: m?.media?.id ? String(m.media.id) : m?.media_id ? String(m.media_id) : null, delay_seconds: Math.min(30, Math.max(0, Number(m?.delay_seconds || 0))) })).filter((m: any) => m.text || m.media_id);
  }

  private async names(orgId: string, chatIds: string[]) {
    const [chats, contacts] = await Promise.all([
      chatIds.length ? this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, chat_id: { in: chatIds } }, select: { chat_id: true, name: true, kind: true } }) : [],
      chatIds.length ? this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, wa_id: { in: chatIds } }, select: { wa_id: true, name: true, push_name: true, phone: true } }) : [],
    ]);
    const cm = new Map(chats.map((c) => [c.chat_id, c] as [string, any]));
    const km = new Map(contacts.map((c) => [c.wa_id, c] as [string, any]));
    return chatIds.map((id) => ({ chat_id: id, kind: isGroupJid(id) ? 'group' : 'individual', name: cm.get(id)?.name || km.get(id)?.name || km.get(id)?.push_name || (km.get(id)?.phone ? `+${km.get(id).phone}` : phoneFromJid(id) ? `+${phoneFromJid(id)}` : 'Contato'), contact: km.get(id) || null }));
  }

  private async shape(orgId: string, s: any) {
    const msgs = this.normMessages(s.messages);
    const ids = msgs.map((m) => m.media_id).filter(Boolean) as string[];
    const medias = ids.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: ids } } }) : [];
    const mmap = new Map(medias.map((m) => [m.id, m] as [string, any]));
    const targets = await this.names(orgId, this.normTargets(s.targets));
    return {
      id: s.id,
      targets: targets.map((t) => ({ chat_id: t.chat_id, name: t.name, kind: t.kind })),
      messages: msgs.map((m) => ({ id: m.id, text: m.text, media: m.media_id ? this.media.toPublic(mmap.get(m.media_id)) : null, delay_seconds: m.delay_seconds })),
      schedule_at: s.schedule_at,
      status: s.status,
      results: Array.isArray(s.results) ? s.results : [],
      error: s.error,
      sent_at: s.sent_at,
      created_at: s.created_at,
    };
  }

  async list(orgId: string, q: any = {}) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(String(q.page_size || 20), 10) || 20));
    const history = q.status === 'history';
    const where: any = { organization_id: orgId, status: history ? { in: ['sent', 'failed', 'canceled'] } : { in: ['pending', 'sending'] } };
    if (history && q.only && ['sent', 'failed', 'canceled'].includes(String(q.only))) where.status = String(q.only);
    const [total, rows] = await Promise.all([
      this.prisma.whatsapp_schedules.count({ where }),
      this.prisma.whatsapp_schedules.findMany({ where, orderBy: history ? [{ sent_at: 'desc' }, { schedule_at: 'desc' }] : [{ schedule_at: 'asc' }], skip: (page - 1) * size, take: size }),
    ]);
    const items: any[] = [];
    for (const r of rows) items.push(await this.shape(orgId, r));
    return { items, total, page, pages: Math.max(1, Math.ceil(total / size)) };
  }

  private validate(dto: any, partial = false) {
    const out: any = {};
    if (!partial || dto.targets !== undefined) {
      out.targets = this.normTargets(dto.targets);
      if (!out.targets.length) throw new BadRequestException('Escolha ao menos um contato ou grupo.');
    }
    if (!partial || dto.messages !== undefined) {
      out.messages = this.normMessages(dto.messages);
      if (!out.messages.length) throw new BadRequestException('Escreva ao menos uma mensagem.');
    }
    if (!partial || dto.schedule_at !== undefined) {
      const d = new Date(String(dto.schedule_at || ''));
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Data/hora inválida.');
      if (d.getTime() < Date.now() - 60_000) throw new BadRequestException('A data/hora já passou.');
      out.schedule_at = d;
    }
    return out;
  }

  async create(orgId: string, userId: string, dto: any) {
    const v = this.validate(dto);
    // chats canônicos (telefone → lid quando conhecido)
    v.targets = [...new Set(await Promise.all(v.targets.map((t: string) => this.contacts.canonicalChatId(orgId, t))))];
    const row = await this.prisma.whatsapp_schedules.create({ data: { organization_id: orgId, ...v, status: 'pending', created_by: userId } });
    return this.shape(orgId, row);
  }

  private async pending(orgId: string, id: string) {
    const s = await this.prisma.whatsapp_schedules.findFirst({ where: { id, organization_id: orgId } });
    if (!s) throw new NotFoundException('Agendamento não encontrado.');
    return s;
  }

  async patch(orgId: string, id: string, dto: any) {
    const s = await this.pending(orgId, id);
    if (s.status !== 'pending') throw new BadRequestException('Só agendamentos pendentes podem ser editados.');
    const v = this.validate(dto, true);
    if (v.targets) v.targets = [...new Set(await Promise.all(v.targets.map((t: string) => this.contacts.canonicalChatId(orgId, t))))];
    return this.shape(orgId, await this.prisma.whatsapp_schedules.update({ where: { id }, data: v }));
  }

  async remove(orgId: string, id: string) {
    const s = await this.pending(orgId, id);
    if (s.status === 'pending') { await this.prisma.whatsapp_schedules.update({ where: { id }, data: { status: 'canceled' } }); return { ok: true, canceled: true }; }
    if (s.status === 'sending') throw new BadRequestException('Envio em andamento.');
    await this.prisma.whatsapp_schedules.delete({ where: { id } });
    return { ok: true };
  }

  async sendNow(orgId: string, id: string) {
    const s = await this.pending(orgId, id);
    if (s.status !== 'pending') throw new BadRequestException('Este agendamento já foi processado.');
    await this.process(id);
    return this.shape(orgId, (await this.prisma.whatsapp_schedules.findUnique({ where: { id } }))!);
  }

  // Claim atômico pending→sending; envia para cada destino; grava resultado por destino.
  async process(id: string) {
    const claimed = await this.prisma.whatsapp_schedules.updateMany({ where: { id, status: 'pending' }, data: { status: 'sending' } });
    if (!claimed.count) return;
    const s = (await this.prisma.whatsapp_schedules.findUnique({ where: { id } }))!;
    const orgId = s.organization_id;
    const row = await this.sessions.row(orgId);
    const targets = await this.names(orgId, this.normTargets(s.targets));
    const msgs = this.normMessages(s.messages);
    if (!row?.openwa_session_id || row.status !== 'ready') {
      await this.prisma.whatsapp_schedules.update({ where: { id }, data: { status: 'failed', error: 'WhatsApp não conectado no horário', results: targets.map((t) => ({ chat_id: t.chat_id, name: t.name, status: 'failed', error: 'WhatsApp não conectado' })) } });
      return;
    }
    const results: any[] = [];
    for (const t of targets) {
      const vars = { nome: t.contact?.name || t.contact?.push_name || '', name: t.contact?.name || t.contact?.push_name || '', telefone: t.contact?.phone || phoneFromJid(t.chat_id), phone: t.contact?.phone || phoneFromJid(t.chat_id) };
      try {
        for (const m of msgs) {
          if (m.delay_seconds) { await this.openwa.typing(row.openwa_session_id, t.chat_id, 'typing').catch(() => undefined); await sleep(m.delay_seconds * 1000); }
          const text = fillVars(m.text, vars);
          let r: any;
          let type = 'text';
          if (m.media_id) {
            const media = await this.media.readBase64(orgId, m.media_id);
            const kind = media.kind === 'voice' || media.kind === 'audio' ? 'audio' : media.kind === 'image' ? 'image' : media.kind === 'video' ? 'video' : 'document';
            r = await this.openwa.sendMedia(row.openwa_session_id, kind as any, t.chat_id, { base64: media.base64, mimetype: media.mime, filename: media.filename || undefined, caption: text || undefined, ...(media.kind === 'voice' ? { ptt: true } : {}) });
            type = media.kind === 'voice' ? 'voice' : kind;
          } else {
            r = await this.openwa.sendText(row.openwa_session_id, t.chat_id, text);
          }
          const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
          await this.prisma.whatsapp_messages.create({ data: { organization_id: orgId, chat_id: t.chat_id, wa_message_id: String(r?.messageId || `sch_${Date.now()}_${Math.random().toString(36).slice(2)}`), direction: 'OUT', type, body: text || null, media_id: m.media_id, ack: 1, timestamp: at, extra: { scheduled: true, schedule_id: id } } }).catch(() => undefined);
          await this.inbound.bumpChat(orgId, t.chat_id, { type, body: text, direction: 'OUT', at });
        }
        results.push({ chat_id: t.chat_id, name: t.name, status: 'sent', sent_at: new Date().toISOString() });
      } catch (e: any) {
        results.push({ chat_id: t.chat_id, name: t.name, status: 'failed', error: (e instanceof OpenWaError ? e.message : String(e?.message || e)).slice(0, 255) });
      }
      await sleep(1500 + Math.random() * 1500); // ritmo humano entre destinos
    }
    const failed = results.filter((r) => r.status === 'failed').length;
    await this.prisma.whatsapp_schedules.update({ where: { id }, data: { status: failed === results.length ? 'failed' : 'sent', results, sent_at: new Date(), error: failed ? `${failed} de ${results.length} falharam` : null } });
    this.logger.log(`agendamento ${id} enviado: ${results.length - failed}/${results.length}`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.whatsapp_schedules.findMany({ where: { status: 'pending', schedule_at: { lte: new Date() } }, orderBy: { schedule_at: 'asc' }, take: 20 });
      for (const s of due) {
        if (!(await this.access.isOrgActive(s.organization_id))) continue;
        await this.process(s.id).catch((e) => this.logger.warn(`schedule ${s.id}: ${e?.message || e}`));
      }
    } finally {
      this.running = false;
    }
  }
}
