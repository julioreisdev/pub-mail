import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenWaClient } from './openwa.client';
import { WhatsAppMediaService, kindOfMime } from './whatsapp-media.service';
import { WhatsAppContactsService, hasDeviceSuffix, isGroupJid, normJid, phoneFromJid } from './whatsapp-contacts.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { previewOf, vcardPreview } from './wa-preview.util';

// Pipeline de ENTRADA: transforma eventos message.* / group.* do OpenWA nas nossas
// tabelas (whatsapp_messages / whatsapp_chats / whatsapp_contacts / whatsapp_media).
// Idempotente por (org, wa_message_id). Mídia inline (base64) vai pra pasta protegida;
// mídia "omitted" (grande) é baixada do gateway em background.

const ACK_BY_STATUS: Record<string, number> = { failed: -1, pending: 0, sent: 1, delivered: 2, read: 3, played: 4 };
export { previewOf, vcardPreview };

@Injectable()
export class WhatsAppInboundService {
  private readonly logger = new Logger(WhatsAppInboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly media: WhatsAppMediaService,
    private readonly contacts: WhatsAppContactsService,
    private readonly presenter: WhatsAppPresenter,
    private readonly attendance: WhatsAppAttendanceService,
    private readonly hooks: WhatsAppHooks,
  ) {}

  private normType(t: string) {
    const v = String(t || 'unknown').toLowerCase();
    return ['text', 'image', 'video', 'audio', 'voice', 'document', 'sticker', 'location', 'contact', 'poll', 'call', 'revoked', 'order', 'product', 'masked', 'unknown'].includes(v) ? v : 'unknown';
  }

  // Não lidas calculadas pelo Pub Mail (o contador do gateway Baileys não serve: marca 1 em
  // quase toda conversa e nunca zera). Conta as mensagens RECEBIDAS ao vivo (não as do
  // histórico) depois do último ponto de leitura: a última resposta humana nossa (painel ou
  // celular; bot/broadcast/agendamento não contam) ou a última recebida com confirmação
  // "lida" (ack ≥ 3 — chega quando o celular lê, e o painel marca ao abrir a conversa).
  private readonly unreadTimers = new Map<string, NodeJS.Timeout>();
  scheduleUnread(orgId: string, chatId: string, delayMs = 600) {
    const key = `${orgId}|${chatId}`;
    const t = this.unreadTimers.get(key);
    if (t) clearTimeout(t);
    this.unreadTimers.set(
      key,
      setTimeout(() => {
        this.unreadTimers.delete(key);
        this.recomputeUnread(orgId, chatId).catch((e) => this.logger.debug(`unread ${chatId}: ${e?.message || e}`));
      }, delayMs),
    );
  }

  async recomputeUnread(orgId: string, chatId: string, emit = true) {
    const r: any[] = await this.prisma.$queryRaw`
      SELECT COUNT(*) AS n FROM whatsapp_messages m
      WHERE m.organization_id = ${orgId} AND m.chat_id = ${chatId} AND m.direction = 'IN' AND m.revoked = 0
        AND JSON_EXTRACT(IFNULL(m.extra, JSON_OBJECT()), '$.history') IS NULL
        AND m.timestamp > GREATEST(
          IFNULL((SELECT MAX(o.timestamp) FROM whatsapp_messages o
                  WHERE o.organization_id = ${orgId} AND o.chat_id = ${chatId} AND o.direction = 'OUT'
                    AND JSON_EXTRACT(IFNULL(o.extra, JSON_OBJECT()), '$.bot') IS NULL
                    AND JSON_EXTRACT(IFNULL(o.extra, JSON_OBJECT()), '$.broadcast') IS NULL
                    AND JSON_EXTRACT(IFNULL(o.extra, JSON_OBJECT()), '$.scheduled') IS NULL), '1970-01-01'),
          IFNULL((SELECT MAX(x.timestamp) FROM whatsapp_messages x
                  WHERE x.organization_id = ${orgId} AND x.chat_id = ${chatId} AND x.direction = 'IN' AND x.ack >= 3), '1970-01-01'))`;
    const n = Number(r?.[0]?.n || 0);
    const u = await this.prisma.whatsapp_chats.updateMany({ where: { organization_id: orgId, chat_id: chatId, NOT: { unread_count: n } }, data: { unread_count: n } });
    if (u.count && emit) this.presenter.chat(orgId, chatId);
    return n;
  }

  // Atualiza/cria o chat com a última mensagem.
  async bumpChat(orgId: string, chatId: string, m: { type: string; body?: string | null; direction: 'IN' | 'OUT'; at: Date; name?: string | null; kind?: string; incUnread?: boolean }) {
    const kind = m.kind || (isGroupJid(chatId) ? 'group' : /@newsletter$/.test(chatId) ? 'channel' : /@broadcast$/.test(chatId) ? 'broadcast' : 'individual');
    const preview = previewOf(m.type, m.body);
    const existing = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    const newer = !existing?.last_message_at || existing.last_message_at.getTime() <= m.at.getTime();
    const data: any = {};
    if (newer) { data.last_message_at = m.at; data.last_message_preview = preview; data.last_message_direction = m.direction; }
    // últimas de cada lado (filtro "sem resposta há X h" e indicador de cliente esperando)
    if (m.direction === 'IN' && (!existing?.last_inbound_at || existing.last_inbound_at.getTime() < m.at.getTime())) data.last_inbound_at = m.at;
    if (m.direction === 'OUT' && (!existing?.last_outbound_at || existing.last_outbound_at.getTime() < m.at.getTime())) data.last_outbound_at = m.at;
    if (m.name && !existing?.name) data.name = String(m.name).slice(0, 255);
    if (m.incUnread && m.direction === 'IN') data.unread_count = { increment: 1 };
    if (m.direction === 'OUT' && existing?.unread_count) this.scheduleUnread(orgId, chatId, 3500);
    if (existing) {
      if (Object.keys(data).length) {
        await this.prisma.whatsapp_chats.update({ where: { id: existing.id }, data });
        this.presenter.chat(orgId, chatId);
      }
      return existing;
    }
    this.presenter.chat(orgId, chatId);
    try {
      return await this.prisma.whatsapp_chats.create({
        data: { organization_id: orgId, chat_id: chatId, kind, name: m.name ? String(m.name).slice(0, 255) : null, last_message_at: m.at, last_message_preview: preview, last_message_direction: m.direction, unread_count: m.incUnread && m.direction === 'IN' ? 1 : 0, ...(m.direction === 'IN' ? { last_inbound_at: m.at } : { last_outbound_at: m.at }) },
      });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
      // criado por outro evento no meio tempo → aplica como update
      return this.prisma.whatsapp_chats.update({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } }, data: { ...data, ...(m.incUnread && m.direction === 'IN' ? { unread_count: { increment: 1 } } : {}) } });
    }
  }

  // message.received / message.sent
  async onMessage(row: any, data: any, fromWebhookSent = false, opts: { silent?: boolean; history?: boolean } = {}): Promise<boolean> {
    const orgId = row.organization_id as string;
    const waId = String(data?.id || '');
    if (!waId) return false;
    const fromMe = Boolean(data?.fromMe) || fromWebhookSent;
    const rawChat = String(data?.chatId || (fromMe ? data?.to : data?.from) || '');
    if (!rawChat || rawChat === 'status@broadcast' || data?.kind === 'status') return false; // status dos contatos não entram no chat
    const type = this.normType(data?.type);
    // Mensagens de sistema do próprio aparelho (`…:30@lid`, tipo unknown, sem corpo/mídia) = ruído.
    if (hasDeviceSuffix(rawChat) && (type === 'unknown' || type === 'masked') && !data?.body && !data?.media) return false;
    if (type === 'unknown' && !data?.body && !data?.media && !data?.location) return false; // protocolo (sync, chave, etc.)
    const chatId = normJid(rawChat);
    // aprende o jid/lid do PRÓPRIO número (pra marcar reações "minhas" e ignorar chat consigo mesmo)
    if (fromMe && data?.from) await this.learnSelf(row, normJid(String(data.from)));
    const at = data?.timestamp ? new Date(Number(data.timestamp) * 1000) : new Date();
    const direction: 'IN' | 'OUT' = fromMe ? 'OUT' : 'IN';
    const senderJid = normJid(String(data?.author || (fromMe ? data?.to : data?.from) || ''));
    const senderName = data?.contact?.name || data?.contact?.pushName || null;

    // já existe? (ex.: nós enviamos e o gateway ecoa message.sent) → só completa
    const existing = await this.prisma.whatsapp_messages.findUnique({ where: { organization_id_wa_message_id: { organization_id: orgId, wa_message_id: waId } } });
    if (existing) {
      const patch: any = {};
      // nosso envio gravado por telefone e o eco veio pelo @lid → adota o @lid (canônico) e unifica
      if (existing.chat_id !== chatId && /@lid$/.test(chatId) && /@c\.us$/.test(existing.chat_id)) {
        await this.contacts.touch(orgId, chatId, { phone: phoneFromJid(existing.chat_id), at });
        patch.chat_id = chatId;
      }
      if (!existing.body && data?.body) patch.body = String(data.body);
      if (!existing.media_id && data?.media && !existing.media_omitted) {
        const mid = await this.saveInlineMedia(orgId, data, type);
        if (mid) patch.media_id = mid;
      }
      if (Object.keys(patch).length) {
        await this.prisma.whatsapp_messages.update({ where: { id: existing.id }, data: patch });
        this.presenter.message(orgId, { id: existing.id });
      }
      return false;
    }

    let mediaId: string | null = null;
    let mediaOmitted = false;
    if (data?.media) {
      if (data.media.data) mediaId = await this.saveInlineMedia(orgId, data, type);
      else mediaOmitted = true;
    } else if (['image', 'video', 'audio', 'voice', 'document', 'sticker'].includes(type)) {
      mediaOmitted = true; // histórico sem mídia inline → baixa sob demanda ao abrir a conversa
    }
    const extra: any = {};
    if (data?.location) extra.location = data.location;
    if (data?.mentionedIds?.length) extra.mentions = data.mentionedIds;
    if (data?.contact && type === 'contact') extra.contact = data.contact;
    if (data?.button) extra.button = data.button;
    if (data?.buttons) extra.buttons = data.buttons;
    if (data?.senderPhone) extra.senderPhone = data.senderPhone;
    if (data?.isLidSender) extra.lidSender = true;
    if (opts.history) extra.history = true;
    // o que se sabe da mídia mesmo sem o arquivo (tipo, nome, tamanho) — a tela mostra e explica
    if (data?.media && !mediaId) {
      extra.media_info = {
        mimetype: data.media.mimetype || null,
        filename: data.media.filename || null,
        size: Number(data.media.sizeBytes || data.media.size || 0) || null,
        ...(opts.history ? { history: true, reason: 'history' } : {}),
      };
    } else if (mediaOmitted && opts.history) {
      extra.media_info = { history: true, reason: 'history' };
    }

    let created: any;
    try {
      created = await this.prisma.whatsapp_messages.create({
        data: {
          organization_id: orgId,
          chat_id: chatId,
          wa_message_id: waId,
          direction,
          type,
          body: data?.body ? String(data.body) : null,
          media_id: mediaId,
          media_omitted: mediaOmitted,
          from_jid: senderJid.slice(0, 64) || null,
          sender_name: senderName ? String(senderName).slice(0, 255) : null,
          quoted_wa_id: data?.quotedMessage?.id ? String(data.quotedMessage.id).slice(0, 191) : null,
          quoted_preview: data?.quotedMessage?.body ? String(data.quotedMessage.body).slice(0, 255) : null,
          ack: fromMe ? 1 : 0,
          extra: Object.keys(extra).length ? extra : undefined,
          timestamp: at,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') return false; // corrida com o eco
      throw e;
    }

    const chatName = isGroupJid(chatId) ? null : direction === 'IN' ? senderName : null;
    await this.bumpChat(orgId, chatId, { type, body: data?.body, direction, at, name: chatName, incUnread: direction === 'IN' && !opts.silent });
    if (!isGroupJid(chatId) || senderJid) {
      const contactJid = isGroupJid(chatId) ? senderJid : chatId;
      if (contactJid && !fromMe) await this.contacts.touch(orgId, contactJid, { pushName: data?.contact?.pushName, name: data?.contact?.name, phone: data?.senderPhone || phoneFromJid(contactJid), at });
    }
    if (!opts.silent) this.presenter.message(orgId, { id: created.id });
    // mensagem do cliente numa conversa individual → o bot decide se responde
    if (!fromMe && !opts.silent && !opts.history && /@(c\.us|lid|s\.whatsapp\.net)$/.test(chatId)) {
      this.hooks.emitInbound({ orgId, session: row, chatId: await this.contacts.canonicalChatId(orgId, chatId).catch(() => chatId), message: created });
    }
    // mensagem nossa que NÃO saiu do Pub Mail (nem painel, nem bot/agendamento/broadcast) = respondida pelo celular
    // O eco pode chegar ANTES de o envio do Pub Mail gravar a linha (painel, bot, agendamento,
    // broadcast marcam a linha logo em seguida). Por isso a decisão espera 3 s e confere a marca.
    if (fromMe && !opts.silent && !opts.history && !isGroupJid(chatId)) {
      const rowId = created.id;
      setTimeout(() => {
        this.prisma.whatsapp_messages
          .findUnique({ where: { id: rowId } })
          .then(async (m) => {
            const x: any = m?.extra || {};
            const ours = Boolean(m?.sent_by_user_id || x.bot || x.scheduled || x.broadcast || x.status_reply || x.system || x.charge);
            if (m && !ours) await this.attendance.onPhoneSend(orgId, m.chat_id);
          })
          .catch(() => undefined);
      }, 3000);
    }
    // mídia grande (acima do limite inline do webhook): baixa em background
    if (mediaOmitted && row.openwa_session_id && !opts.silent) {
      this.fetchOmittedMedia(row, orgId, chatId, waId, type).catch((e) => this.logger.warn(`mídia ${waId}: ${e?.message || e}`));
    }
    return true;
  }

  private async learnSelf(row: any, jid: string) {
    if (!jid || row?.settings?.own_lid === jid || hasDeviceSuffix(jid)) return;
    const settings = { ...((row.settings as any) || {}), own_lid: jid };
    row.settings = settings;
    await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { settings } }).catch(() => undefined);
    if (row.phone && /@lid$/.test(jid)) await this.contacts.touch(row.organization_id, jid, { phone: row.phone, name: 'Você' });
  }

  private async saveInlineMedia(orgId: string, data: any, type: string) {
    try {
      const m = await this.media.storeBase64(orgId, data.media.data, data.media.mimetype || 'application/octet-stream', data.media.filename || null, type === 'voice' ? 'voice' : kindOfMime(data.media.mimetype));
      return m.id;
    } catch (e: any) {
      this.logger.warn(`salvar mídia inline falhou: ${e?.message || e}`);
      return null;
    }
  }

  private async fetchOmittedMedia(row: any, orgId: string, chatId: string, waId: string, type: string) {
    const msg = await this.prisma.whatsapp_messages.findUnique({ where: { organization_id_wa_message_id: { organization_id: orgId, wa_message_id: waId } } });
    if (!msg) return;
    const info: any = ((msg.extra as any) || {}).media_info || {};
    try {
      const r = await this.openwa.downloadMedia(row.openwa_session_id, chatId, waId);
      if (!r?.buffer?.length) throw new Error('vazio');
      const mime = info.mimetype && /octet-stream/.test(r.mime) ? info.mimetype : r.mime;
      const m = await this.media.store(orgId, r.buffer, mime, info.filename || null, type === 'voice' ? 'voice' : kindOfMime(mime));
      await this.prisma.whatsapp_messages.update({ where: { id: msg.id }, data: { media_id: m.id, media_omitted: false, extra: { ...((msg.extra as any) || {}), media_info: { ...info, checked_at: new Date().toISOString() } } } });
    } catch (e: any) {
      await this.prisma.whatsapp_messages.update({ where: { id: msg.id }, data: { extra: { ...((msg.extra as any) || {}), media_info: { ...info, reason: 'unavailable', checked_at: new Date().toISOString() } } } }).catch(() => undefined);
      throw e;
    } finally {
      this.presenter.message(orgId, { id: msg.id });
    }
  }

  async onAck(orgId: string, data: any) {
    const waId = String(data?.messageId || data?.id || '');
    if (!waId) return;
    const ack = data?.status ? (ACK_BY_STATUS[String(data.status)] ?? Number(data?.ack ?? 0)) : Number(data?.ack ?? 0);
    // ack nunca regride (read não volta pra delivered)
    const msg = await this.prisma.whatsapp_messages.findUnique({ where: { organization_id_wa_message_id: { organization_id: orgId, wa_message_id: waId } } });
    if (!msg) return;
    if (ack === -1) { await this.prisma.whatsapp_messages.update({ where: { id: msg.id }, data: { ack: -1, error: 'Falha na entrega' } }); this.presenter.message(orgId, { id: msg.id }); return; }
    if (ack > msg.ack) {
      await this.prisma.whatsapp_messages.update({ where: { id: msg.id }, data: { ack } });
      this.presenter.message(orgId, { id: msg.id });
      if (msg.direction === 'IN' && ack >= 3) this.scheduleUnread(orgId, msg.chat_id); // lida no celular (ou pelo painel)
    }
  }

  async onRevoked(orgId: string, data: any) {
    const target = String(data?.revokedId || data?.id || '');
    if (!target) return;
    const r = await this.prisma.whatsapp_messages.updateMany({ where: { organization_id: orgId, wa_message_id: target }, data: { revoked: true } });
    if (r.count) this.presenter.message(orgId, { waId: target });
    if (r.count && data?.chatId) {
      await this.prisma.whatsapp_chats.updateMany({ where: { organization_id: orgId, chat_id: String(data.chatId) }, data: { last_message_preview: previewOf('revoked') } });
      this.presenter.chat(orgId, String(data.chatId));
    }
  }

  async onReaction(orgId: string, data: any, selfJid?: string | null) {
    const waId = String(data?.messageId || '');
    if (!waId) return;
    const msg = await this.prisma.whatsapp_messages.findUnique({ where: { organization_id_wa_message_id: { organization_id: orgId, wa_message_id: waId } } });
    if (!msg) return;
    const sender = String(data?.senderId || '');
    const emoji = String(data?.reaction || '');
    let list: any[] = Array.isArray(msg.reactions) ? [...(msg.reactions as any[])] : [];
    if (data?.reactions && typeof data.reactions === 'object' && !Array.isArray(data.reactions)) {
      list = Object.entries(data.reactions).filter(([, e]) => e).map(([from, e]) => ({ from, emoji: String(e), from_me: Boolean(selfJid && from === selfJid) }));
    } else {
      list = list.filter((r) => r.from !== sender);
      if (emoji) list.push({ from: sender, emoji, from_me: Boolean(selfJid && sender === selfJid) });
    }
    await this.prisma.whatsapp_messages.update({ where: { id: msg.id }, data: { reactions: list } });
    this.presenter.message(orgId, { id: msg.id });
  }

  async onEdited(orgId: string, data: any) {
    const waId = String(data?.messageId || '');
    if (!waId) return;
    const r = await this.prisma.whatsapp_messages.updateMany({ where: { organization_id: orgId, wa_message_id: waId }, data: { body: String(data?.body ?? ''), edited: true } });
    if (r.count) this.presenter.message(orgId, { waId });
  }

  async onGroupEvent(orgId: string, event: string, data: any) {
    const gid = String(data?.groupId || '');
    if (!gid) return;
    const chat = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: gid } } });
    const meta: any = { ...((chat?.group_meta as any) || {}) };
    if (event === 'group.update' && data?.changes) {
      if (data.changes.subject) meta.subject = String(data.changes.subject).slice(0, 255);
      if (data.changes.description !== undefined) meta.description = String(data.changes.description || '').slice(0, 2000);
    }
    meta.last_event = { event, at: new Date().toISOString(), participants: (data?.participantIds || []).slice(0, 20) };
    await this.prisma.whatsapp_chats.upsert({
      where: { organization_id_chat_id: { organization_id: orgId, chat_id: gid } },
      create: { organization_id: orgId, chat_id: gid, kind: 'group', name: meta.subject || null, group_meta: meta },
      update: { group_meta: meta, ...(meta.subject ? { name: meta.subject } : {}) },
    });
    this.presenter.chat(orgId, gid);
  }
}
