import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppMediaService, kindOfMime } from './whatsapp-media.service';
import { WhatsAppInboundService, previewOf } from './whatsapp-inbound.service';
import { WhatsAppContactsService, digitsOf, isGroupJid, isLidJid, jidFromPhone, phoneFromJid } from './whatsapp-contacts.service';
import { WhatsAppFiltersService } from './whatsapp-filters.service';

// Chat: leitura das nossas tabelas (rápido, paginado, polling por `since`) e escrita
// no gateway (cada envio cria a linha OUT com ack 0 na hora; o eco `message.sent` e os
// `message.ack` completam). Erros do gateway viram 400/503 com mensagem clara.

const CHAT_ID_RE = /^[^\s@]+@[^\s@]+$/;

@Injectable()
export class WhatsAppChatService {
  private readonly logger = new Logger(WhatsAppChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly sessions: WhatsAppSessionsService,
    private readonly media: WhatsAppMediaService,
    private readonly inbound: WhatsAppInboundService,
    private readonly contacts: WhatsAppContactsService,
    private readonly filters: WhatsAppFiltersService,
  ) {}

  private translate(e: any): never {
    if (e instanceof OpenWaError) {
      if (e.status === 429) throw new BadRequestException(e.retryAfterSeconds ? `Limite de envio atingido. Tente em ${e.retryAfterSeconds}s.` : 'Limite de envio atingido.');
      if (e.status === 404) throw new NotFoundException('Chat ou mensagem não encontrados no WhatsApp.');
      if (e.status >= 500 || e.status === 503 || e.status === 504) throw new ServiceUnavailableException(e.message);
      throw new BadRequestException(e.message);
    }
    throw e;
  }

  private async ready(orgId: string) {
    const row = await this.sessions.row(orgId);
    if (!row?.openwa_session_id) throw new BadRequestException('Conecte o WhatsApp primeiro.');
    if (row.status !== 'ready') throw new BadRequestException('O WhatsApp não está conectado no momento.');
    return row;
  }

  private assertChatId(chatId: string) {
    if (!CHAT_ID_RE.test(String(chatId || ''))) throw new BadRequestException('chat_id inválido.');
    return chatId;
  }

  // ---------------------------------------------------------------- shapes
  private async contactMap(orgId: string, chatIds: string[]) {
    const ids = chatIds.filter((c) => !isGroupJid(c));
    if (!ids.length) return new Map<string, any>();
    const rows = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, wa_id: { in: ids } } });
    return new Map(rows.map((r) => [r.wa_id, r] as [string, any]));
  }

  private shapeChat(c: any, contact?: any) {
    const meta: any = c.group_meta || {};
    return {
      id: c.id,
      chat_id: c.chat_id,
      kind: c.kind,
      name: c.name || contact?.name || contact?.push_name || meta.subject || (c.kind === 'individual' ? (phoneFromJid(c.chat_id) ? `+${phoneFromJid(c.chat_id)}` : contact?.phone ? `+${contact.phone}` : isLidJid(c.chat_id) ? 'Contato sem nome' : c.chat_id) : c.chat_id),
      phone: c.kind === 'individual' ? contact?.phone || phoneFromJid(c.chat_id) || null : null,
      unread_count: c.unread_count,
      last_message_at: c.last_message_at,
      last_message_preview: c.last_message_preview,
      last_message_direction: c.last_message_direction,
      archived: c.archived,
      pinned: c.pinned,
      muted: c.muted,
      group_meta: c.kind === 'group' ? { participants_count: meta.participants_count ?? (Array.isArray(meta.participants) ? meta.participants.length : undefined), is_admin: meta.is_admin, subject: meta.subject, description: meta.description } : null,
      contact: contact ? { id: contact.id, saved: contact.saved, tags: Array.isArray(contact.tags) ? contact.tags : [] } : null,
      updated_at: c.updated_at,
    };
  }

  private readonly mediaFetching = new Set<string>();

  private async shapeMessages(orgId: string, rows: any[]) {
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
        from_jid: m.from_jid,
        sender_name: m.sender_name,
        quoted: m.quoted_wa_id ? { wa_message_id: m.quoted_wa_id, preview: m.quoted_preview } : null,
        forwarded: m.forwarded,
        ack: m.ack,
        reactions: Array.isArray(m.reactions) ? m.reactions : [],
        edited: m.edited,
        revoked: m.revoked,
        extra: { location: extra.location, poll: extra.poll, contact: extra.contact, mentions: extra.mentions, button: extra.button, buttons: extra.buttons },
        error: m.error,
        sent_by_user_id: m.sent_by_user_id,
        timestamp: m.timestamp,
        updated_at: m.updated_at,
      };
    });
  }

  // ---------------------------------------------------------------- leitura
  async listChats(orgId: string, q: any = {}) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(10, parseInt(String(q.page_size || 50), 10) || 50));
    const where: any = { organization_id: orgId, archived: q.archived === '1' || q.archived === 'true' };
    if (q.kind && q.kind !== 'all') where.kind = String(q.kind);
    if (q.unread === '1') where.unread_count = { gt: 0 };
    if (q.filter) { where.chat_id = { in: await this.filters.idsOf(orgId, String(q.filter)) }; delete where.archived; }
    if (q.q) {
      const s = String(q.q).trim();
      const d = digitsOf(s);
      const contactIds = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ name: { contains: s } }, { push_name: { contains: s } }, ...(d ? [{ phone: { contains: d } }] : [])] }, select: { wa_id: true }, take: 200 });
      where.OR = [{ name: { contains: s } }, { chat_id: { in: contactIds.map((c) => c.wa_id) } }, ...(d ? [{ chat_id: { startsWith: d } }] : [])];
    }
    const [total, rows] = await Promise.all([
      this.prisma.whatsapp_chats.count({ where }),
      this.prisma.whatsapp_chats.findMany({ where, orderBy: [{ pinned: 'desc' }, { last_message_at: 'desc' }], skip: (page - 1) * size, take: size }),
    ]);
    const cmap = await this.contactMap(orgId, rows.map((r) => r.chat_id));
    return { items: rows.map((r) => this.shapeChat(r, cmap.get(r.chat_id))), total, page, pages: Math.max(1, Math.ceil(total / size)), server_time: new Date().toISOString() };
  }

  async getChat(orgId: string, chatId: string) {
    const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!c) throw new NotFoundException('Conversa não encontrada.');
    const cmap = await this.contactMap(orgId, [chatId]);
    const shaped: any = this.shapeChat(c, cmap.get(chatId));
    if (c.kind === 'group') {
      // metadados ao vivo (participantes) — best-effort, cache de 5 min no group_meta
      const meta: any = c.group_meta || {};
      const stale = !meta.fetched_at || Date.now() - new Date(meta.fetched_at).getTime() > 5 * 60_000;
      const row = await this.sessions.row(orgId);
      if (stale && row?.openwa_session_id && row.status === 'ready') {
        try {
          const g = await this.openwa.groupInfo(row.openwa_session_id, chatId);
          const me = row.phone ? `${row.phone}@c.us` : '';
          const participants = (g?.participants || []).map((p: any) => ({ id: p.id, phone: p.number || phoneFromJid(p.id), name: p.name || null, is_admin: Boolean(p.isAdmin || p.isSuperAdmin) }));
          const newMeta = { ...meta, subject: g?.name || meta.subject, description: g?.description ?? meta.description, owner: g?.owner, participants, participants_count: participants.length, is_admin: participants.some((p: any) => p.id === me && p.is_admin), fetched_at: new Date().toISOString() };
          await this.prisma.whatsapp_chats.update({ where: { id: c.id }, data: { group_meta: newMeta, ...(g?.name ? { name: String(g.name).slice(0, 255) } : {}) } });
          shaped.name = g?.name || shaped.name;
          shaped.group_meta = { subject: newMeta.subject, description: newMeta.description, participants, participants_count: participants.length, is_admin: newMeta.is_admin, owner: newMeta.owner };
        } catch (e: any) {
          this.logger.debug(`groupInfo ${chatId}: ${e?.message || e}`);
          shaped.group_meta = { ...(shaped.group_meta || {}), participants: meta.participants || [] };
        }
      } else shaped.group_meta = { ...(shaped.group_meta || {}), participants: meta.participants || [], owner: meta.owner };
    }
    return shaped;
  }

  async messages(orgId: string, chatId: string, q: any = {}) {
    const limit = Math.min(200, Math.max(1, parseInt(String(q.limit || 50), 10) || 50));
    const where: any = { organization_id: orgId, chat_id: chatId };
    let rows: any[];
    if (q.since) {
      const since = new Date(String(q.since));
      if (Number.isNaN(since.getTime())) throw new BadRequestException('since inválido');
      rows = await this.prisma.whatsapp_messages.findMany({ where: { ...where, OR: [{ timestamp: { gt: since } }, { updated_at: { gt: since } }] }, orderBy: { timestamp: 'asc' }, take: 300 });
    } else {
      if (q.before) {
        const before = new Date(String(q.before));
        if (Number.isNaN(before.getTime())) throw new BadRequestException('before inválido');
        where.timestamp = { lt: before };
      }
      rows = (await this.prisma.whatsapp_messages.findMany({ where, orderBy: { timestamp: 'desc' }, take: limit })).reverse();
    }
    // mídia do histórico (marcada como omitida) → baixa em background, até 5 por chamada
    const pending = rows.filter((r) => r.media_omitted && !r.media_id && !this.mediaFetching.has(r.id)).slice(-5);
    if (pending.length) {
      const row = await this.sessions.row(orgId);
      if (row?.openwa_session_id && row.status === 'ready') {
        for (const m of pending) {
          this.mediaFetching.add(m.id);
          this.openwa.downloadMedia(row.openwa_session_id, m.chat_id, m.wa_message_id)
            .then(async (r) => {
              if (!r?.buffer?.length) return;
              const stored = await this.media.store(orgId, r.buffer, r.mime, null, m.type === 'voice' ? 'voice' : kindOfMime(r.mime));
              await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { media_id: stored.id, media_omitted: false } });
            })
            .catch(() => this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { media_omitted: true } }).catch(() => undefined))
            .finally(() => this.mediaFetching.delete(m.id));
        }
      }
    }
    return { items: await this.shapeMessages(orgId, rows), server_time: new Date().toISOString() };
  }

  // Cria/retorna o chat de um telefone (pra começar conversa a partir de Contatos).
  async openByPhone(orgId: string, phone: string) {
    const d = digitsOf(phone);
    if (d.length < 10 || d.length > 15) throw new BadRequestException('Telefone inválido.');
    let chatId = jidFromPhone(d);
    // WhatsApp com IDs de privacidade: a conversa pode existir como <lid>@lid — reaproveita
    const byPhone = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, phone: d }, orderBy: { saved: 'desc' } });
    if (byPhone?.lid) {
      const lidChat = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: byPhone.lid } } });
      if (lidChat) return this.shapeChat(lidChat, byPhone);
    }
    if (byPhone?.lid) chatId = byPhone.lid; // canônico
    const existing = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    const contact = byPhone || (await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: orgId, wa_id: chatId } } }));
    if (existing) return this.shapeChat(existing, contact);
    const c = await this.prisma.whatsapp_chats.create({ data: { organization_id: orgId, chat_id: chatId, kind: 'individual', name: contact?.name || contact?.push_name || null } });
    return this.shapeChat(c, contact);
  }

  // ---------------------------------------------------------------- ações de chat
  async markRead(orgId: string, chatId: string) {
    await this.prisma.whatsapp_chats.updateMany({ where: { organization_id: orgId, chat_id: chatId }, data: { unread_count: 0 } });
    const row = await this.sessions.row(orgId);
    if (row?.openwa_session_id && row.status === 'ready') this.openwa.markRead(row.openwa_session_id, chatId).catch(() => undefined);
    return { ok: true };
  }

  async typing(orgId: string, chatId: string, typing: boolean) {
    const row = await this.sessions.row(orgId);
    if (row?.openwa_session_id && row.status === 'ready') await this.openwa.typing(row.openwa_session_id, chatId, typing ? 'typing' : 'paused').catch(() => undefined);
    return { ok: true };
  }

  async setFlag(orgId: string, chatId: string, flag: 'archived' | 'pinned' | 'muted', value: boolean) {
    const row = await this.sessions.row(orgId);
    if (row?.openwa_session_id && row.status === 'ready') {
      try {
        if (flag === 'archived') await this.openwa.archiveChat(row.openwa_session_id, chatId, value);
        if (flag === 'pinned') await this.openwa.pinChat(row.openwa_session_id, chatId, value);
        if (flag === 'muted') await this.openwa.muteChat(row.openwa_session_id, chatId, value ? Date.now() + 8 * 3600_000 : null);
      } catch (e) { this.translate(e); }
    }
    await this.prisma.whatsapp_chats.updateMany({ where: { organization_id: orgId, chat_id: chatId }, data: { [flag]: value } });
    return { ok: true };
  }

  // ---------------------------------------------------------------- envio
  private async recordOut(orgId: string, rawChatId: string, r: { messageId: string; timestamp?: number }, m: { type: string; body?: string | null; media_id?: string | null; quoted?: string | null; quoted_preview?: string | null; forwarded?: boolean; extra?: any; userId?: string | null }) {
    const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
    const waId = String(r?.messageId || `local_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    // o eco do gateway chega pelo @lid da pessoa → gravamos sempre no chat canônico
    const chatId = await this.contacts.canonicalChatId(orgId, rawChatId);
    let row: any;
    try {
      row = await this.prisma.whatsapp_messages.create({
        data: { organization_id: orgId, chat_id: chatId, wa_message_id: waId, direction: 'OUT', type: m.type, body: m.body ?? null, media_id: m.media_id ?? null, from_jid: null, quoted_wa_id: m.quoted ?? null, quoted_preview: m.quoted_preview ?? null, forwarded: Boolean(m.forwarded), ack: 1, extra: m.extra ?? undefined, sent_by_user_id: m.userId ?? null, timestamp: at },
      });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
      // o eco message.sent chegou antes: completa a linha
      row = await this.prisma.whatsapp_messages.update({ where: { organization_id_wa_message_id: { organization_id: orgId, wa_message_id: waId } }, data: { media_id: m.media_id ?? undefined, sent_by_user_id: m.userId ?? undefined, quoted_wa_id: m.quoted ?? undefined, quoted_preview: m.quoted_preview ?? undefined, forwarded: m.forwarded || undefined } });
    }
    await this.inbound.bumpChat(orgId, chatId, { type: m.type, body: m.body, direction: 'OUT', at });
    return (await this.shapeMessages(orgId, [row]))[0];
  }

  private async quotedPreview(orgId: string, quotedWaId?: string | null) {
    if (!quotedWaId) return null;
    const q = await this.prisma.whatsapp_messages.findUnique({ where: { organization_id_wa_message_id: { organization_id: orgId, wa_message_id: quotedWaId } } });
    return q ? previewOf(q.type, q.body) : null;
  }

  async sendText(orgId: string, userId: string, dto: { chat_id: string; text: string; quoted_wa_id?: string; mentions?: string[] }) {
    const row = await this.ready(orgId);
    const chatId = this.assertChatId(dto.chat_id);
    const text = String(dto.text || '').trim();
    if (!text) throw new BadRequestException('Mensagem vazia.');
    let r: any;
    try {
      r = dto.quoted_wa_id
        ? await this.openwa.reply(row.openwa_session_id!, chatId, dto.quoted_wa_id, text, dto.mentions)
        : await this.openwa.sendText(row.openwa_session_id!, chatId, text, { mentions: dto.mentions?.length ? dto.mentions : undefined });
    } catch (e) { this.translate(e); }
    return this.recordOut(orgId, chatId, r, { type: 'text', body: text, quoted: dto.quoted_wa_id || null, quoted_preview: await this.quotedPreview(orgId, dto.quoted_wa_id), extra: dto.mentions?.length ? { mentions: dto.mentions } : undefined, userId });
  }

  async sendMedia(orgId: string, userId: string, dto: { chat_id: string; caption?: string; as_voice?: boolean; as_document?: boolean; quoted_wa_id?: string }, file: { buffer: Buffer; mimetype: string; originalname?: string; size: number }) {
    const row = await this.ready(orgId);
    const chatId = this.assertChatId(dto.chat_id);
    if (!file?.buffer?.length) throw new BadRequestException('Arquivo vazio.');
    if (file.size > 64 * 1024 * 1024) throw new BadRequestException('Arquivo até 64 MB.');
    const mime = String(file.mimetype || 'application/octet-stream');
    const filename = file.originalname ? Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255) : undefined;
    let kind: 'image' | 'video' | 'audio' | 'document' | 'sticker' = 'document';
    if (!dto.as_document) {
      if (mime.startsWith('image/') && !mime.includes('gif')) kind = 'image';
      else if (mime.startsWith('video/')) kind = 'video';
      else if (mime.startsWith('audio/')) kind = 'audio';
    }
    const ptt = kind === 'audio' && Boolean(dto.as_voice);
    const caption = String(dto.caption || '').trim().slice(0, 1024) || undefined;
    const stored = await this.media.store(orgId, file.buffer, mime, filename || null, ptt ? 'voice' : kindOfMime(mime));
    let r: any;
    try {
      r = await this.openwa.sendMedia(row.openwa_session_id!, kind, chatId, { base64: file.buffer.toString('base64'), mimetype: mime, filename, caption, ...(ptt ? { ptt: true } : {}), ...(dto.quoted_wa_id ? { quotedMessageId: dto.quoted_wa_id } : {}) });
    } catch (e) { this.translate(e); }
    const type = kind === 'audio' ? (ptt ? 'voice' : 'audio') : kind;
    return this.recordOut(orgId, chatId, r, { type, body: caption || null, media_id: stored.id, quoted: dto.quoted_wa_id || null, quoted_preview: await this.quotedPreview(orgId, dto.quoted_wa_id), userId });
  }

  async sendLocation(orgId: string, userId: string, dto: { chat_id: string; latitude: number; longitude: number; description?: string }) {
    const row = await this.ready(orgId);
    const chatId = this.assertChatId(dto.chat_id);
    let r: any;
    try { r = await this.openwa.sendLocation(row.openwa_session_id!, chatId, Number(dto.latitude), Number(dto.longitude), dto.description); } catch (e) { this.translate(e); }
    return this.recordOut(orgId, chatId, r, { type: 'location', body: dto.description || null, extra: { location: { latitude: dto.latitude, longitude: dto.longitude, description: dto.description || null } }, userId });
  }

  async sendPoll(orgId: string, userId: string, dto: { chat_id: string; name: string; options: string[]; multiple?: boolean }) {
    const row = await this.ready(orgId);
    const chatId = this.assertChatId(dto.chat_id);
    const options = (dto.options || []).map((o) => String(o || '').trim().slice(0, 100)).filter(Boolean);
    if (options.length < 2) throw new BadRequestException('A enquete precisa de pelo menos 2 opções.');
    let r: any;
    try { r = await this.openwa.sendPoll(row.openwa_session_id!, chatId, String(dto.name).trim(), options, Boolean(dto.multiple)); } catch (e) { this.translate(e); }
    return this.recordOut(orgId, chatId, r, { type: 'poll', body: String(dto.name).trim(), extra: { poll: { name: dto.name, options: options.map((o) => ({ name: o, votes: 0 })), multiple: Boolean(dto.multiple) } }, userId });
  }

  private async ownMessage(orgId: string, id: string) {
    const m = await this.prisma.whatsapp_messages.findFirst({ where: { id, organization_id: orgId } });
    if (!m) throw new NotFoundException('Mensagem não encontrada.');
    return m;
  }

  async react(orgId: string, id: string, emoji: string) {
    const row = await this.ready(orgId);
    const m = await this.ownMessage(orgId, id);
    try { await this.openwa.react(row.openwa_session_id!, m.chat_id, m.wa_message_id, String(emoji || '')); } catch (e) { this.translate(e); }
    const me = row.phone ? `${row.phone}@c.us` : 'me';
    let list: any[] = (Array.isArray(m.reactions) ? m.reactions : []).filter((r: any) => !r.from_me);
    if (emoji) list.push({ from: me, emoji: String(emoji), from_me: true });
    const upd = await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { reactions: list } });
    return (await this.shapeMessages(orgId, [upd]))[0];
  }

  async forward(orgId: string, userId: string, id: string, to: string[]) {
    const row = await this.ready(orgId);
    const m = await this.ownMessage(orgId, id);
    const targets = (to || []).map(String).filter((t) => CHAT_ID_RE.test(t)).slice(0, 20);
    if (!targets.length) throw new BadRequestException('Escolha ao menos um destino.');
    const out: any[] = [];
    for (const t of targets) {
      try {
        const r = await this.openwa.forward(row.openwa_session_id!, m.chat_id, t, m.wa_message_id);
        out.push(await this.recordOut(orgId, t, r, { type: m.type, body: m.body, media_id: m.media_id, forwarded: true, extra: m.extra as any, userId }));
      } catch (e: any) {
        out.push({ chat_id: t, error: e instanceof OpenWaError ? e.message : String(e?.message || e) });
      }
    }
    return { results: out };
  }

  async edit(orgId: string, id: string, text: string) {
    const row = await this.ready(orgId);
    const m = await this.ownMessage(orgId, id);
    if (m.direction !== 'OUT' || m.type !== 'text') throw new BadRequestException('Só mensagens de texto enviadas por você podem ser editadas.');
    try { await this.openwa.edit(row.openwa_session_id!, m.chat_id, m.wa_message_id, String(text).trim()); } catch (e) { this.translate(e); }
    const upd = await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { body: String(text).trim(), edited: true } });
    return (await this.shapeMessages(orgId, [upd]))[0];
  }

  async delete(orgId: string, id: string, everyone: boolean) {
    const row = await this.ready(orgId);
    const m = await this.ownMessage(orgId, id);
    if (everyone && m.direction !== 'OUT') throw new BadRequestException('Só é possível apagar para todos as mensagens enviadas por você.');
    try { await this.openwa.deleteMessage(row.openwa_session_id!, m.chat_id, m.wa_message_id, everyone); } catch (e) { this.translate(e); }
    if (everyone) {
      const upd = await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { revoked: true } });
      return (await this.shapeMessages(orgId, [upd]))[0];
    }
    await this.prisma.whatsapp_messages.delete({ where: { id: m.id } });
    return { id: m.id, deleted: true };
  }

  // Importa as últimas N mensagens das conversas mais recentes (sem mídia inline; a mídia
  // é marcada como "omitida" e baixada sob demanda). Idempotente por wa_message_id.
  async importHistory(orgId: string, chatsLimit = 40, perChat = 30) {
    const row = await this.ready(orgId);
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, archived: false }, orderBy: { last_message_at: 'desc' }, take: chatsLimit });
    let imported = 0;
    for (const c of chats) {
      let hist: any[] = [];
      try { hist = await this.openwa.history(row.openwa_session_id!, c.chat_id, perChat, false); } catch (e: any) { this.logger.debug(`history ${c.chat_id}: ${e?.message || e}`); continue; }
      for (const m of Array.isArray(hist) ? hist : []) {
        try {
          const created = await this.inbound.onMessage({ ...row, organization_id: orgId }, { ...m, chatId: c.chat_id, media: m?.media ? { ...m.media, data: undefined, omitted: true } : undefined }, Boolean(m?.fromMe), { silent: true });
          if (created) imported++;
        } catch (e: any) { this.logger.debug(`import msg: ${e?.message || e}`); }
      }
    }
    return { chats: chats.length, imported };
  }

  // Grupos conhecidos (pra pickers de broadcast).
  async groups(orgId: string) {
    const rows = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, kind: 'group' }, orderBy: { name: 'asc' } });
    return rows.map((c) => ({ chat_id: c.chat_id, name: c.name || (c.group_meta as any)?.subject || c.chat_id, participants_count: (c.group_meta as any)?.participants_count ?? null }));
  }

  // Sincroniza a lista de chats/grupos com o gateway (chamado 1× ao conectar e sob demanda).
  async syncChats(orgId: string) {
    const row = await this.ready(orgId);
    let list: any[] = [];
    try { list = await this.openwa.listChats(row.openwa_session_id!, 1000, 0); } catch (e) { this.translate(e); }
    let n = 0;
    for (const c of Array.isArray(list) ? list : []) {
      const chatId = String(c?.id || '');
      if (!chatId || chatId === 'status@broadcast') continue;
      const kind = c?.kind && c.kind !== 'unknown' ? String(c.kind) : c?.isGroup ? 'group' : 'individual';
      const at = c?.timestamp ? new Date(Number(c.timestamp) * 1000) : null;
      const existing = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
      await this.prisma.whatsapp_chats.upsert({
        where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } },
        create: { organization_id: orgId, chat_id: chatId, kind, name: c?.name ? String(c.name).slice(0, 255) : null, unread_count: Number(c?.unreadCount || 0), last_message_at: at, last_message_preview: c?.lastMessage ? String(c.lastMessage).slice(0, 255) : null, archived: Boolean(c?.archived), pinned: Boolean(c?.pinned), muted: Boolean(c?.muted), synced_at: new Date() },
        update: { kind, ...(c?.name ? { name: String(c.name).slice(0, 255) } : {}), archived: Boolean(c?.archived), pinned: Boolean(c?.pinned), muted: Boolean(c?.muted), synced_at: new Date(), ...(!existing?.last_message_at && at ? { last_message_at: at, last_message_preview: c?.lastMessage ? String(c.lastMessage).slice(0, 255) : null } : {}) },
      });
      if (kind === 'individual' && c?.name) await this.contacts.touch(orgId, chatId, { name: String(c.name), at: at || undefined }).catch(() => undefined);
      n++;
    }
    return { synced: n };
  }
}
