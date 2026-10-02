import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { isGroupJid, isLidJid, phoneFromJid } from './wa-jid.util';
import { vcardPreview } from './wa-preview.util';

// Formato público de conversas e mensagens (o mesmo para a API REST e para o WebSocket)
// + emissão dos eventos em tempo real do WhatsApp:
//   wa:message  { chat_id, message }        — nova ou alterada (ack, reação, edição, mídia…)
//   wa:message_deleted { chat_id, id }
//   wa:chat     { chat }                    — preview, não lidas, flags, atendimento, etiquetas
//   wa:session  { status, … }               — estado da conexão
//   wa:sync     { phase, … }                — progresso da sincronização
// Emite só quando há alguém do módulo conectado (evita consultas à toa).
@Injectable()
export class WhatsAppPresenter {
  private readonly logger = new Logger(WhatsAppPresenter.name);
  private readonly chatTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: WhatsAppMediaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ---------------------------------------------------------------- shapes
  async contactMap(orgId: string, chatIds: string[]) {
    const ids = chatIds.filter((c) => !isGroupJid(c));
    if (!ids.length) return new Map<string, any>();
    const rows = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, wa_id: { in: ids } } });
    return new Map(rows.map((r) => [r.wa_id, r] as [string, any]));
  }

  // ---------------------------------------------------------------- etiquetas / atendentes (cache curto)
  private readonly tagCache = new Map<string, { at: number; map: Map<string, { id: string; name: string; color: string }> }>();
  private readonly userCache = new Map<string, { at: number; name: string }>();

  invalidateTags(orgId: string) {
    this.tagCache.delete(orgId);
  }

  async tagMap(orgId: string) {
    const c = this.tagCache.get(orgId);
    if (c && Date.now() - c.at < 60_000) return c.map;
    const rows = await this.prisma.whatsapp_tags.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
    const map = new Map(rows.map((t) => [t.id, { id: t.id, name: t.name, color: t.color }] as [string, any]));
    this.tagCache.set(orgId, { at: Date.now(), map });
    return map;
  }

  async userNames(ids: string[]) {
    const out = new Map<string, string>();
    const missing: string[] = [];
    for (const id of [...new Set(ids.filter(Boolean))]) {
      const c = this.userCache.get(id);
      if (c && Date.now() - c.at < 5 * 60_000) out.set(id, c.name);
      else missing.push(id);
    }
    if (missing.length) {
      const users = await this.prisma.users.findMany({ where: { id: { in: missing } }, select: { id: true, name: true, email: true } }).catch(() => []);
      for (const u of users) {
        const name = String(u.name || u.email?.split('@')[0] || '').trim();
        this.userCache.set(u.id, { at: Date.now(), name });
        out.set(u.id, name);
      }
    }
    return out;
  }

  mediaPublic(m: any) {
    return m ? this.media.toPublic(m) : null;
  }

  /** Conversas no formato público (contato + etiquetas + atendimento resolvidos em lote). */
  async shapeChats(orgId: string, rows: any[]) {
    if (!rows.length) return [];
    const [cmap, tmap, umap] = await Promise.all([
      this.contactMap(orgId, rows.map((r) => r.chat_id)),
      this.tagMap(orgId),
      this.userNames(rows.map((r) => r.assigned_user_id).filter(Boolean)),
    ]);
    return rows.map((r) => this.shapeChat(r, cmap.get(r.chat_id), { tmap, umap }));
  }

  shapeChat(c: any, contact?: any, ctx?: { tmap?: Map<string, any>; umap?: Map<string, string> }) {
    const meta: any = c.group_meta || {};
    const tagIds: string[] = Array.isArray(c.tags) ? c.tags : [];
    const tags = ctx?.tmap ? tagIds.map((id) => ctx.tmap!.get(id)).filter(Boolean) : tagIds.map((id) => ({ id }));
    const assigned = c.assigned_user_id ? { id: c.assigned_user_id, name: ctx?.umap?.get(c.assigned_user_id) || null } : null;
    const lastIn = c.last_inbound_at ? new Date(c.last_inbound_at).getTime() : 0;
    const lastOut = c.last_outbound_at ? new Date(c.last_outbound_at).getTime() : 0;
    return {
      id: c.id,
      chat_id: c.chat_id,
      kind: c.kind,
      name: c.name || contact?.name || contact?.push_name || meta.subject || (c.kind === 'individual' ? (phoneFromJid(c.chat_id) ? `+${phoneFromJid(c.chat_id)}` : contact?.phone ? `+${contact.phone}` : isLidJid(c.chat_id) ? 'Contato sem nome' : c.chat_id) : c.chat_id),
      phone: c.kind === 'individual' ? contact?.phone || phoneFromJid(c.chat_id) || null : null,
      unread_count: c.unread_count,
      last_message_at: c.last_message_at,
      last_message_preview: c.last_message_preview && /BEGIN:VCARD/i.test(c.last_message_preview) ? vcardPreview(c.last_message_preview) : c.last_message_preview,
      last_message_direction: c.last_message_direction,
      archived: c.archived,
      pinned: c.pinned,
      muted: c.muted,
      group_meta: c.kind === 'group' ? { participants_count: meta.participants_count ?? (Array.isArray(meta.participants) ? meta.participants.length : undefined), is_admin: meta.is_admin, subject: meta.subject, description: meta.description } : null,
      contact: contact ? { id: contact.id, saved: contact.saved, tags: Array.isArray(contact.tags) ? contact.tags : [], opted_out: Boolean(contact.opted_out_at) } : null,
      tags,
      service: {
        status: c.service_status || 'none',
        assigned_user: assigned,
        started_at: c.service_started_at || null,
        last_human_at: c.service_last_human_at || null,
        closed_at: c.service_closed_at || null,
      },
      last_inbound_at: c.last_inbound_at || null,
      last_outbound_at: c.last_outbound_at || null,
      stage_id: c.stage_id || null,
      deal_cents: c.deal_cents ?? null,
      stage_moved_at: c.stage_moved_at || null,
      // cliente mandou a última mensagem e ninguém respondeu ainda
      waiting_reply: c.kind === 'individual' && lastIn > 0 && lastIn > lastOut,
      updated_at: c.updated_at,
    };
  }

  async shapeMessages(orgId: string, rows: any[]) {
    const mediaIds = rows.map((r) => r.media_id).filter(Boolean) as string[];
    const medias = mediaIds.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: mediaIds } } }) : [];
    const mmap = new Map(medias.map((m) => [m.id, m] as [string, any]));
    return rows.map((m) => {
      const extra: any = m.extra || {};
      return {
        id: m.id,
        wa_message_id: m.wa_message_id,
        chat_id: m.chat_id,
        direction: m.direction,
        type: m.type,
        body: m.body,
        media: m.media_id ? this.media.toPublic(mmap.get(m.media_id)) : null,
        media_omitted: m.media_omitted || (Boolean(m.media_id) && !mmap.get(m.media_id)),
        media_info: extra.media_info || null, // { mimetype, filename, size, reason? } quando a mídia não veio
        from_jid: m.from_jid,
        sender_name: m.sender_name,
        quoted: m.quoted_wa_id ? { wa_message_id: m.quoted_wa_id, preview: m.quoted_preview } : null,
        forwarded: m.forwarded,
        ack: m.ack,
        reactions: Array.isArray(m.reactions) ? m.reactions : [],
        edited: m.edited,
        revoked: m.revoked,
        extra: { location: extra.location, poll: extra.poll, contact: extra.contact, mentions: extra.mentions, button: extra.button, buttons: extra.buttons, scheduled: extra.scheduled, bot: extra.bot, history: extra.history, charge: extra.charge },
        error: m.error,
        sent_by_user_id: m.sent_by_user_id,
        timestamp: m.timestamp,
        updated_at: m.updated_at,
      };
    });
  }

  // ---------------------------------------------------------------- tempo real
  watching(orgId: string) {
    return this.realtime.watchers(orgId, 'whatsapp') > 0;
  }

  emit(orgId: string, event: string, payload: unknown) {
    this.realtime.toModule(orgId, 'whatsapp', event, payload);
  }

  /** Mensagem nova/alterada (por id da linha ou por wa_message_id). Nunca lança. */
  message(orgId: string, ref: { id?: string; waId?: string }) {
    if (!this.watching(orgId)) return;
    (async () => {
      const row = ref.id
        ? await this.prisma.whatsapp_messages.findFirst({ where: { id: ref.id, organization_id: orgId } })
        : await this.prisma.whatsapp_messages.findUnique({ where: { organization_id_wa_message_id: { organization_id: orgId, wa_message_id: String(ref.waId) } } });
      if (!row) return;
      const [shaped] = await this.shapeMessages(orgId, [row]);
      this.emit(orgId, 'wa:message', { chat_id: row.chat_id, message: shaped });
    })().catch((e) => this.logger.debug(`emit message: ${e?.message || e}`));
  }

  /** Já formatada (quem acabou de montar evita reconsultar). */
  messageShaped(orgId: string, shaped: any) {
    if (!shaped?.chat_id) return;
    this.emit(orgId, 'wa:message', { chat_id: shaped.chat_id, message: shaped });
  }

  messageDeleted(orgId: string, chatId: string, id: string) {
    this.emit(orgId, 'wa:message_deleted', { chat_id: chatId, id });
  }

  /** Conversa mudou. Agrupa rajadas (grupos movimentados) em 1 emissão a cada 400 ms por conversa. */
  chat(orgId: string, chatId: string) {
    if (!chatId || !this.watching(orgId)) return;
    const key = `${orgId}|${chatId}`;
    if (this.chatTimers.has(key)) return;
    const t = setTimeout(() => {
      this.chatTimers.delete(key);
      this.chatNow(orgId, chatId).catch((e) => this.logger.debug(`emit chat: ${e?.message || e}`));
    }, 400);
    this.chatTimers.set(key, t);
  }

  private async chatNow(orgId: string, chatId: string) {
    const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!c) return;
    const [shaped] = await this.shapeChats(orgId, [c]);
    this.emit(orgId, 'wa:chat', { chat: shaped });
  }

  session(orgId: string, payload: any) {
    this.emit(orgId, 'wa:session', payload);
  }

  sync(orgId: string, payload: any) {
    this.emit(orgId, 'wa:sync', { at: new Date().toISOString(), ...payload });
  }
}
