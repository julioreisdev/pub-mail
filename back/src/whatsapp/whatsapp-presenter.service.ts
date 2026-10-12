import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { isGroupJid, isLidJid, phoneFromJid, isIdLikeName } from './wa-jid.util';
import { vcardPreview } from './wa-preview.util';

// Formato público de conversas e mensagens (o mesmo para a API REST e para o WebSocket)
// + emissão dos eventos em tempo real do WhatsApp.
//
// IDENTIDADE DA CONVERSA (multi-número): o `chat_id` público é o uuid da linha de
// `whatsapp_chats` (único mesmo quando a mesma pessoa fala com dois números da org);
// o id do WhatsApp (jid) vai em `jid`. Mensagens também saem com `chat_id` = uuid.
//
//   wa:message  { chat_id, session_id, message }  — nova ou alterada (ack, reação, edição, mídia…)
//   wa:message_deleted { chat_id, session_id, id }
//   wa:chat     { chat }                           — preview, não lidas, flags, atendimento, etiquetas
//   wa:session  { session_id, status, … }          — estado da conexão de um número
//   wa:sync     { session_id?, phase, … }          — progresso da sincronização
// Eventos de conversa/mensagem vão para a sala do NÚMERO (só quem tem acesso a ele recebe);
// os demais, para a sala do módulo na org. Emite só quando há alguém ouvindo.
export const SESSION_COLOR_FALLBACK = '#25D366';

@Injectable()
export class WhatsAppPresenter {
  private readonly logger = new Logger(WhatsAppPresenter.name);
  private readonly chatTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: WhatsAppMediaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ---------------------------------------------------------------- números (cache curto)
  private readonly sessionCache = new Map<string, { at: number; map: Map<string, any> }>();

  invalidateSessions(orgId: string) {
    this.sessionCache.delete(orgId);
  }

  /** id da sessão → { id, label, color, phone, status, connected } (60 s). */
  async sessionMap(orgId: string): Promise<Map<string, any>> {
    const c = this.sessionCache.get(orgId);
    if (c && Date.now() - c.at < 60_000) return c.map;
    const rows = await this.prisma.whatsapp_sessions.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { created_at: 'asc' }], select: { id: true, label: true, color: true, phone: true, status: true, openwa_session_id: true, position: true } });
    const map = new Map(rows.map((r) => [r.id, this.sessionBrief(r)] as [string, any]));
    this.sessionCache.set(orgId, { at: Date.now(), map });
    return map;
  }

  sessionBrief(r: any) {
    if (!r) return null;
    const phone = r.phone ? String(r.phone).replace(/\D/g, '') : null;
    return { id: r.id, label: r.label || (phone ? `+${phone}` : 'Número'), color: r.color || SESSION_COLOR_FALLBACK, phone, position: r.position ?? 0, status: r.openwa_session_id ? r.status : 'none', connected: Boolean(r.openwa_session_id && r.status === 'ready') };
  }

  // ---------------------------------------------------------------- uuid da conversa (cache)
  private readonly chatIdCache = new Map<string, { at: number; id: string }>();

  /** uuid da linha de whatsapp_chats para (org, número, jid) — null se a conversa não existe. */
  async chatUuid(orgId: string, sessionId: string, jid: string): Promise<string | null> {
    const key = `${orgId}|${sessionId}|${jid}`;
    const c = this.chatIdCache.get(key);
    if (c && Date.now() - c.at < 10 * 60_000) return c.id;
    const row = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_session_id_chat_id: { organization_id: orgId, session_id: sessionId, chat_id: jid } }, select: { id: true } });
    if (!row) return null;
    if (this.chatIdCache.size > 50_000) this.chatIdCache.clear();
    this.chatIdCache.set(key, { at: Date.now(), id: row.id });
    return row.id;
  }

  forgetChatUuid(orgId: string, sessionId: string, jid: string) {
    this.chatIdCache.delete(`${orgId}|${sessionId}|${jid}`);
  }

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

  /** Conversas no formato público (contato + etiquetas + atendimento + número resolvidos em lote). */
  async shapeChats(orgId: string, rows: any[]) {
    if (!rows.length) return [];
    const [cmap, tmap, umap, smap] = await Promise.all([
      this.contactMap(orgId, rows.map((r) => r.chat_id)),
      this.tagMap(orgId),
      this.userNames(rows.map((r) => r.assigned_user_id).filter(Boolean)),
      this.sessionMap(orgId),
    ]);
    return rows.map((r) => this.shapeChat(r, cmap.get(r.chat_id), { tmap, umap, smap }));
  }

  shapeChat(c: any, contact?: any, ctx?: { tmap?: Map<string, any>; umap?: Map<string, string>; smap?: Map<string, any> }) {
    const meta: any = c.group_meta || {};
    const tagIds: string[] = Array.isArray(c.tags) ? c.tags : [];
    const tags = ctx?.tmap ? tagIds.map((id) => ctx.tmap!.get(id)).filter(Boolean) : tagIds.map((id) => ({ id }));
    const assigned = c.assigned_user_id ? { id: c.assigned_user_id, name: ctx?.umap?.get(c.assigned_user_id) || null } : null;
    const lastIn = c.last_inbound_at ? new Date(c.last_inbound_at).getTime() : 0;
    const lastOut = c.last_outbound_at ? new Date(c.last_outbound_at).getTime() : 0;
    const session = ctx?.smap?.get(c.session_id) || { id: c.session_id, label: 'Número', color: SESSION_COLOR_FALLBACK, phone: null, status: 'none', connected: false };
    return {
      // id público = uuid da linha; o id do WhatsApp vai em `jid`
      id: c.id,
      chat_id: c.id,
      jid: c.chat_id,
      session_id: c.session_id,
      session,
      kind: c.kind,
      name: (c.name && !isIdLikeName(c.name) ? c.name : null) || contact?.name || contact?.push_name || meta.subject || (c.kind === 'individual' ? (phoneFromJid(c.chat_id) ? `+${phoneFromJid(c.chat_id)}` : contact?.phone ? `+${contact.phone}` : isLidJid(c.chat_id) ? 'Contato sem nome' : c.chat_id) : c.chat_id),
      phone: c.kind === 'individual' ? contact?.phone || phoneFromJid(c.chat_id) || null : null,
      unread_count: c.unread_count,
      last_message_at: c.last_message_at,
      last_message_preview: c.last_message_preview && /BEGIN:VCARD/i.test(c.last_message_preview) ? vcardPreview(c.last_message_preview) : c.last_message_preview,
      last_message_direction: c.last_message_direction,
      archived: c.archived,
      pinned: c.pinned,
      muted: c.muted,
      group_meta: c.kind === 'group' ? { participants_count: meta.participants_count ?? (Array.isArray(meta.participants) ? meta.participants.length : undefined), is_admin: meta.is_admin, subject: meta.subject, description: meta.description } : null,
      photo_v: contact?.profile_pic_media_id ? String(contact.profile_pic_media_id).slice(0, 8) : meta.photo_media_id ? String(meta.photo_media_id).slice(0, 8) : null,
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

  /** Mensagens no formato público. `chat_id` = uuid da conversa (resolvido por (número, jid)). */
  async shapeMessages(orgId: string, rows: any[]) {
    if (!rows.length) return [];
    const mediaIds = rows.map((r) => r.media_id).filter(Boolean) as string[];
    const medias = mediaIds.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: mediaIds } } }) : [];
    const mmap = new Map(medias.map((m) => [m.id, m] as [string, any]));
    const keys = [...new Set(rows.map((r) => `${r.session_id}|${r.chat_id}`))];
    const uuids = new Map<string, string | null>();
    for (const k of keys) {
      const [sid, jid] = k.split('|');
      uuids.set(k, await this.chatUuid(orgId, sid, jid));
    }
    // áudios anteriores à forma de onda: calcula em segundo plano e reemite a mensagem quando ficar pronta
    const pendingWave = rows.filter((m: any) => m.media_id && ['audio', 'voice'].includes(m.type) && mmap.get(m.media_id) && mmap.get(m.media_id)!.waveform == null).map((m: any) => ({ id: m.id, media_id: m.media_id as string }));
    if (pendingWave.length) {
      this.media.ensureWaveforms(pendingWave.map((x) => x.media_id)).then((done) => {
        if (!done.length) return;
        const ok = new Set(done);
        for (const x of pendingWave) if (ok.has(x.media_id)) this.message(orgId, { id: x.id });
      }).catch(() => undefined);
    }
    return rows.map((m) => {
      const extra: any = m.extra || {};
      return {
        id: m.id,
        wa_message_id: m.wa_message_id,
        chat_id: uuids.get(`${m.session_id}|${m.chat_id}`) || null,
        jid: m.chat_id,
        session_id: m.session_id,
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
        extra: { location: extra.location, poll: extra.poll, contact: extra.contact, mentions: extra.mentions, mention_names: extra.mention_names, button: extra.button, buttons: extra.buttons, scheduled: extra.scheduled, bot: extra.bot, history: extra.history, charge: extra.charge },
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

  /** Evento da organização (etiquetas, tarefas, funil, lista de números…). */
  emit(orgId: string, event: string, payload: unknown) {
    this.realtime.toModule(orgId, 'whatsapp', event, payload);
  }

  /** Evento de UM número (conversas e mensagens): só quem tem acesso ao número recebe. */
  emitSession(orgId: string, sessionId: string, event: string, payload: unknown) {
    this.realtime.toSession(orgId, 'whatsapp', sessionId, event, payload);
  }

  /** Mensagem nova/alterada (por id da linha ou por wa_message_id dentro de um número). Nunca lança. */
  message(orgId: string, ref: { id?: string; waId?: string; sessionId?: string }) {
    if (!this.watching(orgId)) return;
    (async () => {
      const row = ref.id
        ? await this.prisma.whatsapp_messages.findFirst({ where: { id: ref.id, organization_id: orgId } })
        : ref.sessionId
          ? await this.prisma.whatsapp_messages.findUnique({ where: { organization_id_session_id_wa_message_id: { organization_id: orgId, session_id: ref.sessionId, wa_message_id: String(ref.waId) } } })
          : await this.prisma.whatsapp_messages.findFirst({ where: { organization_id: orgId, wa_message_id: String(ref.waId) } });
      if (!row) return;
      const [shaped] = await this.shapeMessages(orgId, [row]);
      this.emitSession(orgId, row.session_id, 'wa:message', { chat_id: shaped.chat_id, session_id: row.session_id, message: shaped });
    })().catch((e) => this.logger.debug(`emit message: ${e?.message || e}`));
  }

  /** Já formatada (quem acabou de montar evita reconsultar). */
  messageShaped(orgId: string, shaped: any) {
    if (!shaped?.chat_id || !shaped.session_id) return;
    this.emitSession(orgId, shaped.session_id, 'wa:message', { chat_id: shaped.chat_id, session_id: shaped.session_id, message: shaped });
  }

  messageDeleted(orgId: string, sessionId: string, chatUuid: string, id: string) {
    this.emitSession(orgId, sessionId, 'wa:message_deleted', { chat_id: chatUuid, session_id: sessionId, id });
  }

  /** Conversa mudou. Agrupa rajadas (grupos movimentados) em 1 emissão a cada 400 ms por conversa. */
  chat(orgId: string, sessionId: string, jid: string) {
    if (!jid || !sessionId || !this.watching(orgId)) return;
    const key = `${orgId}|${sessionId}|${jid}`;
    if (this.chatTimers.has(key)) return;
    const t = setTimeout(() => {
      this.chatTimers.delete(key);
      this.chatNow(orgId, sessionId, jid).catch((e) => this.logger.debug(`emit chat: ${e?.message || e}`));
    }, 400);
    this.chatTimers.set(key, t);
  }

  /** Mesmo que `chat()`, a partir da linha. */
  chatRow(c: { organization_id: string; session_id: string; chat_id: string }) {
    if (c) this.chat(c.organization_id, c.session_id, c.chat_id);
  }

  private async chatNow(orgId: string, sessionId: string, jid: string) {
    const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_session_id_chat_id: { organization_id: orgId, session_id: sessionId, chat_id: jid } } });
    if (!c) return;
    const [shaped] = await this.shapeChats(orgId, [c]);
    this.emitSession(orgId, sessionId, 'wa:chat', { chat: shaped });
  }

  /** Estado da conexão de um número mudou (QR, conectado, caiu, criado, removido…). */
  session(orgId: string, sessionId: string, payload: any) {
    const body = { session_id: sessionId, ...payload };
    this.emitSession(orgId, sessionId, 'wa:session', body);
    // a lista de números (abas) é da org: criação/remoção/renomeação chegam a todos do módulo
    if (['local.create', 'local.remove', 'local.update'].includes(String(payload?.event || ''))) this.emit(orgId, 'wa:sessions', body);
  }

  sync(orgId: string, payload: any) {
    const body = { at: new Date().toISOString(), ...payload };
    if (payload?.session_id) this.emitSession(orgId, String(payload.session_id), 'wa:sync', body);
    else this.emit(orgId, 'wa:sync', body);
  }
}
