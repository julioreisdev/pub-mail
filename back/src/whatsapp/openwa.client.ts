import { Injectable, Logger } from '@nestjs/common';

// Cliente HTTP tipado do OpenWA 0.23.7 (gateway WhatsApp em Docker, só loopback).
// Contrato verificado no código do OpenWA (scratchpad/openwa_contract.md):
//  - rotas sob /api, auth por X-API-Key, respostas NÃO embrulhadas;
//  - erros no formato Nest {statusCode, message, error} (+ code/retryAfterSeconds no 429 de pacing);
//  - message.timestamp em SEGUNDOS; ids de sessão são UUID.
// Env: OPENWA_URL (default http://127.0.0.1:2785/api), OPENWA_API_KEY.

export class OpenWaError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly retryAfterSeconds?: number) {
    super(message);
  }
}

export type OpenWaSession = {
  id: string; name: string; status: string; phone?: string | null; pushName?: string | null;
  connectedAt?: string | null; lastActive?: string | null; lastError?: string | null; engineLoaded?: boolean;
};
export type OpenWaSendResult = { messageId: string; timestamp: number };
export type OpenWaMediaBody = { base64?: string; url?: string; mimetype?: string; filename?: string; caption?: string; quotedMessageId?: string; mentions?: string[]; ptt?: boolean };

const DEFAULT_TIMEOUT = 30_000;
const enc = encodeURIComponent;

@Injectable()
export class OpenWaClient {
  private readonly logger = new Logger(OpenWaClient.name);
  readonly baseUrl = String(process.env.OPENWA_URL || 'http://127.0.0.1:2785/api').replace(/\/+$/, '');
  private readonly key = String(process.env.OPENWA_API_KEY || '');

  get configured() { return Boolean(this.key); }

  async request<T = any>(method: string, path: string, body?: any, opts: { timeoutMs?: number; binary?: boolean } = {}): Promise<T> {
    if (!this.key) throw new OpenWaError(503, 'OPENWA_NOT_CONFIGURED', 'Gateway WhatsApp não configurado (OPENWA_API_KEY).');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || DEFAULT_TIMEOUT);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'X-API-Key': this.key, 'Content-Type': 'application/json', Accept: opts.binary ? '*/*' : 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (opts.binary) {
        if (!res.ok) throw new OpenWaError(res.status, `HTTP_${res.status}`, `Download falhou (${res.status})`);
        const buf = Buffer.from(await res.arrayBuffer());
        return { buffer: buf, mime: res.headers.get('content-type') || 'application/octet-stream' } as any;
      }
      const text = await res.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      if (!res.ok) {
        const rawMsg = json?.message ?? json?.error ?? json?.raw ?? res.statusText ?? 'erro';
        const msg = String(Array.isArray(rawMsg) ? rawMsg.join('; ') : rawMsg).slice(0, 300);
        const code = String(json?.code || `HTTP_${res.status}`);
        const retry = Number(json?.retryAfterSeconds || res.headers.get('retry-after') || 0) || undefined;
        if (res.status >= 500) this.logger.warn(`OpenWA ${method} ${path} → ${res.status} ${msg}`);
        throw new OpenWaError(res.status, code, msg, retry);
      }
      return json as T;
    } catch (e: any) {
      if (e instanceof OpenWaError) throw e;
      if (e?.name === 'AbortError') throw new OpenWaError(504, 'OPENWA_TIMEOUT', 'Gateway WhatsApp demorou para responder.');
      throw new OpenWaError(503, 'OPENWA_UNREACHABLE', `Gateway WhatsApp indisponível: ${String(e?.message || e).slice(0, 120)}`);
    } finally {
      clearTimeout(t);
    }
  }

  private s(id: string) { return `/sessions/${enc(id)}`; }

  // ---- sessões
  listSessions() { return this.request<OpenWaSession[]>('GET', '/sessions'); }
  createSession(name: string, config?: Record<string, unknown>) { return this.request<OpenWaSession>('POST', '/sessions', { name, ...(config ? { config } : {}) }); }
  getSession(id: string) { return this.request<OpenWaSession>('GET', this.s(id)); }
  startSession(id: string) { return this.request<any>('POST', `${this.s(id)}/start`, {}, { timeoutMs: 60_000 }); }
  stopSession(id: string) { return this.request<any>('POST', `${this.s(id)}/stop`, {}, { timeoutMs: 60_000 }); }
  logoutSession(id: string) { return this.request<any>('POST', `${this.s(id)}/logout`, {}, { timeoutMs: 60_000 }); }
  deleteSession(id: string) { return this.request<any>('DELETE', this.s(id), undefined, { timeoutMs: 60_000 }); }
  getQr(id: string) { return this.request<{ qrCode?: string; status?: string }>('GET', `${this.s(id)}/qr`); }
  requestPairingCode(id: string, phoneNumber: string) { return this.request<{ code?: string; pairingCode?: string }>('POST', `${this.s(id)}/pairing-code`, { phoneNumber }, { timeoutMs: 60_000 }); }

  // ---- webhooks
  createWebhook(sid: string, dto: { url: string; events: string[]; secret: string }) { return this.request<any>('POST', `${this.s(sid)}/webhooks`, dto); }
  listWebhooks(sid: string) { return this.request<any[]>('GET', `${this.s(sid)}/webhooks`); }

  // ---- perfil (não existe GET; dados do próprio número vêm de getSession)
  setProfileName(sid: string, name: string) { return this.request('PUT', `${this.s(sid)}/profile/name`, { name }); }
  setProfileStatus(sid: string, status: string) { return this.request('PUT', `${this.s(sid)}/profile/status`, { status }); }
  setProfilePicture(sid: string, base64: string, mimetype: string) { return this.request('PUT', `${this.s(sid)}/profile/picture`, { base64, mimetype }, { timeoutMs: 60_000 }); }
  deleteProfilePicture(sid: string) { return this.request('DELETE', `${this.s(sid)}/profile/picture`); }

  // ---- chats
  listChats(sid: string, limit = 1000, offset = 0) { return this.request<any[]>('GET', `${this.s(sid)}/chats?limit=${limit}&offset=${offset}`, undefined, { timeoutMs: 60_000 }); }
  typing(sid: string, chatId: string, state: 'typing' | 'recording' | 'paused') { return this.request('POST', `${this.s(sid)}/chats/typing`, { chatId, state }); }
  markRead(sid: string, chatId: string) { return this.request('POST', `${this.s(sid)}/chats/read`, { chatId }); }
  archiveChat(sid: string, chatId: string, archive: boolean) { return this.request('POST', `${this.s(sid)}/chats/archive`, { chatId, archive }); }
  pinChat(sid: string, chatId: string, pin: boolean) { return this.request('POST', `${this.s(sid)}/chats/pin`, { chatId, pin }); }
  muteChat(sid: string, chatId: string, muteUntil: number | null) { return this.request('POST', `${this.s(sid)}/chats/mute`, { chatId, muteUntil }); }

  // ---- mensagens
  history(sid: string, chatId: string, limit = 50, includeMedia = false) { return this.request<any[]>('GET', `${this.s(sid)}/messages/${enc(chatId)}/history?limit=${limit}&includeMedia=${includeMedia}`, undefined, { timeoutMs: 60_000 }); }
  downloadMedia(sid: string, chatId: string, messageId: string) { return this.request<{ buffer: Buffer; mime: string }>('GET', `${this.s(sid)}/messages/${enc(chatId)}/${enc(messageId)}/media`, undefined, { timeoutMs: 120_000, binary: true }); }
  reactions(sid: string, chatId: string, messageId: string) { return this.request<any[]>('GET', `${this.s(sid)}/messages/${enc(chatId)}/${enc(messageId)}/reactions`); }
  sendText(sid: string, chatId: string, text: string, extra: { mentions?: string[]; quotedMessageId?: string } = {}) { return this.request<OpenWaSendResult>('POST', `${this.s(sid)}/messages/send-text`, { chatId, text, ...extra }, { timeoutMs: 45_000 }); }
  sendMedia(sid: string, kind: 'image' | 'video' | 'audio' | 'document' | 'sticker', chatId: string, body: OpenWaMediaBody) { return this.request<OpenWaSendResult>('POST', `${this.s(sid)}/messages/send-${kind}`, { chatId, ...body }, { timeoutMs: 120_000 }); }
  sendLocation(sid: string, chatId: string, latitude: number, longitude: number, description?: string) { return this.request<OpenWaSendResult>('POST', `${this.s(sid)}/messages/send-location`, { chatId, latitude, longitude, ...(description ? { description } : {}) }, { timeoutMs: 45_000 }); }
  sendPoll(sid: string, chatId: string, name: string, options: string[], allowMultipleAnswers = false) { return this.request<OpenWaSendResult>('POST', `${this.s(sid)}/messages/send-poll`, { chatId, name, options, allowMultipleAnswers }, { timeoutMs: 45_000 }); }
  sendContact(sid: string, chatId: string, contactName: string, contactNumber: string) { return this.request<OpenWaSendResult>('POST', `${this.s(sid)}/messages/send-contact`, { chatId, contactName, contactNumber }, { timeoutMs: 45_000 }); }
  reply(sid: string, chatId: string, quotedMessageId: string, text: string, mentions?: string[]) { return this.request<OpenWaSendResult>('POST', `${this.s(sid)}/messages/reply`, { chatId, quotedMessageId, text, ...(mentions?.length ? { mentions } : {}) }, { timeoutMs: 45_000 }); }
  forward(sid: string, fromChatId: string, toChatId: string, messageId: string) { return this.request<OpenWaSendResult>('POST', `${this.s(sid)}/messages/forward`, { fromChatId, toChatId, messageId }, { timeoutMs: 45_000 }); }
  react(sid: string, chatId: string, messageId: string, emoji: string) { return this.request('POST', `${this.s(sid)}/messages/react`, { chatId, messageId, emoji }); }
  edit(sid: string, chatId: string, messageId: string, body: string) { return this.request<OpenWaSendResult>('POST', `${this.s(sid)}/messages/edit`, { chatId, messageId, body }); }
  deleteMessage(sid: string, chatId: string, messageId: string, forEveryone: boolean) { return this.request('POST', `${this.s(sid)}/messages/delete`, { chatId, messageId, forEveryone }); }

  // ---- contatos
  listContacts(sid: string, limit = 1000, offset = 0) { return this.request<any[]>('GET', `${this.s(sid)}/contacts?limit=${limit}&offset=${offset}`, undefined, { timeoutMs: 120_000 }); }
  checkNumber(sid: string, number: string) { return this.request<{ number: string; exists: boolean; whatsappId: string | null }>('GET', `${this.s(sid)}/contacts/check/${enc(number)}`); }
  contactPhone(sid: string, contactId: string) { return this.request<{ contactId: string; phone: string | null }>('GET', `${this.s(sid)}/contacts/${enc(contactId)}/phone`); }
  profilePicture(sid: string, contactId: string) { return this.request<{ url: string | null }>('GET', `${this.s(sid)}/contacts/${enc(contactId)}/profile-picture`); }
  profilePictures(sid: string, ids: string[]) { return this.request<{ pictures: Record<string, string | null> }>('GET', `${this.s(sid)}/contacts/profile-pictures?ids=${enc(ids.join(','))}`); }
  blockContact(sid: string, contactId: string, block: boolean) { return this.request(block ? 'POST' : 'DELETE', `${this.s(sid)}/contacts/${enc(contactId)}/block`); }

  // ---- grupos
  listGroups(sid: string, limit = 1000) { return this.request<any[]>('GET', `${this.s(sid)}/groups?limit=${limit}`, undefined, { timeoutMs: 60_000 }); }
  groupInfo(sid: string, groupId: string) { return this.request<any>('GET', `${this.s(sid)}/groups/${enc(groupId)}`); }
  groupInviteCode(sid: string, groupId: string) { return this.request<{ inviteCode: string; inviteLink: string }>('GET', `${this.s(sid)}/groups/${enc(groupId)}/invite-code`); }
  groupPicture(sid: string, groupId: string) { return this.request<any>('GET', `${this.s(sid)}/groups/${enc(groupId)}/picture`, undefined, { timeoutMs: 60_000, binary: true }); }
  leaveGroup(sid: string, groupId: string) { return this.request('POST', `${this.s(sid)}/groups/${enc(groupId)}/leave`, {}); }

  // ---- status (stories)
  statusText(sid: string, text: string, backgroundColor?: string, font?: number) { return this.request<{ statusId: string; timestamp: string; expiresAt: string }>('POST', `${this.s(sid)}/status/send-text`, { text, ...(backgroundColor ? { backgroundColor } : {}), ...(font != null ? { font } : {}) }, { timeoutMs: 60_000 }); }
  statusMedia(sid: string, kind: 'image' | 'video' | 'voice', media: { base64: string; mimetype: string }, caption?: string, backgroundColor?: string) {
    const body: any = kind === 'image' ? { image: media } : kind === 'video' ? { video: media } : { audio: media };
    if (caption && kind !== 'voice') body.caption = caption;
    if (backgroundColor && kind === 'voice') body.backgroundColor = backgroundColor;
    return this.request<{ statusId: string; timestamp: string; expiresAt: string }>('POST', `${this.s(sid)}/status/send-${kind}`, body, { timeoutMs: 120_000 });
  }
  deleteStatus(sid: string, statusId: string) { return this.request('DELETE', `${this.s(sid)}/status/${enc(statusId)}`); }

  health() { return this.request<any>('GET', '/health'); }
}
