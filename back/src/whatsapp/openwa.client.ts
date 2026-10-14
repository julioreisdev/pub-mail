import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Cliente HTTP tipado do OpenWA 0.23.7 (gateway WhatsApp em Docker, só loopback).
// Contrato verificado no código do OpenWA:
//  - rotas sob /api, auth por X-API-Key, respostas NÃO embrulhadas;
//  - erros no formato Nest {statusCode, message, error} (+ code/retryAfterSeconds no 429 de pacing);
//  - message.timestamp em SEGUNDOS; ids de sessão são UUID.
//
// DOIS gateways (um motor por container — o OpenWA não mistura):
//  - 'wwjs'    → OPENWA_URL / OPENWA_API_KEY                 (whatsapp-web.js, :2785)
//  - 'baileys' → OPENWA_BAILEYS_URL / OPENWA_BAILEYS_API_KEY (Baileys, :2786)
// Toda chamada `/sessions/<id>/…` vai para o gateway do motor daquela sessão
// (whatsapp_sessions.engine, com cache). Sessão nova usa WHATSAPP_DEFAULT_ENGINE.

export type WaEngine = 'wwjs' | 'baileys';
export const WA_ENGINES: WaEngine[] = ['wwjs', 'baileys'];

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
export type OpenWaParticipantResult = { id: string; success: boolean; status?: number | string; message?: string };
export type OpenWaParticipantsResult = { success: boolean; message?: string; results: OpenWaParticipantResult[] };
export type OpenWaMediaBody ={ base64?: string; url?: string; mimetype?: string; filename?: string; caption?: string; quotedMessageId?: string; mentions?: string[]; ptt?: boolean };

const DEFAULT_TIMEOUT = 30_000;
const enc = encodeURIComponent;

type Gateway = { url: string; key: string };

@Injectable()
export class OpenWaClient {
  private readonly logger = new Logger(OpenWaClient.name);
  private readonly gateways: Record<WaEngine, Gateway> = {
    wwjs: { url: String(process.env.OPENWA_URL || 'http://127.0.0.1:2785/api').replace(/\/+$/, ''), key: String(process.env.OPENWA_API_KEY || '') },
    baileys: { url: String(process.env.OPENWA_BAILEYS_URL || 'http://127.0.0.1:2786/api').replace(/\/+$/, ''), key: String(process.env.OPENWA_BAILEYS_API_KEY || '') },
  };
  // id da sessão no gateway → motor (evita 1 consulta por chamada)
  private readonly engineBySession = new Map<string, WaEngine>();

  constructor(private readonly prisma: PrismaService) {}

  /** Motor para sessões NOVAS: WHATSAPP_DEFAULT_ENGINE, se o gateway dele estiver configurado. */
  get defaultEngine(): WaEngine {
    const want = String(process.env.WHATSAPP_DEFAULT_ENGINE || 'wwjs').toLowerCase() as WaEngine;
    if (WA_ENGINES.includes(want) && this.gateways[want].key) return want;
    return this.gateways.wwjs.key ? 'wwjs' : 'baileys';
  }

  isEngineAvailable(engine: WaEngine) { return Boolean(this.gateways[engine]?.key); }
  get configured() { return WA_ENGINES.some((e) => Boolean(this.gateways[e].key)); }

  /** Registra o motor de uma sessão (chamado ao criar/carregar a sessão). */
  remember(sessionId: string | null | undefined, engine: string | null | undefined) {
    if (sessionId && engine && WA_ENGINES.includes(engine as WaEngine)) this.engineBySession.set(sessionId, engine as WaEngine);
  }

  private async engineFor(path: string, explicit?: WaEngine): Promise<WaEngine> {
    if (explicit) return explicit;
    const m = /^\/sessions\/([^/?]+)/.exec(path);
    if (!m) return this.defaultEngine;
    const sid = decodeURIComponent(m[1]);
    const cached = this.engineBySession.get(sid);
    if (cached) return cached;
    const row = await this.prisma.whatsapp_sessions.findFirst({ where: { openwa_session_id: sid }, select: { engine: true } }).catch(() => null);
    const eng = (row?.engine && WA_ENGINES.includes(row.engine as WaEngine) ? row.engine : 'wwjs') as WaEngine;
    this.engineBySession.set(sid, eng);
    return eng;
  }

  async request<T = any>(method: string, path: string, body?: any, opts: { timeoutMs?: number; binary?: boolean; engine?: WaEngine } = {}): Promise<T> {
    const engine = await this.engineFor(path, opts.engine);
    const gw = this.gateways[engine];
    if (!gw.key) throw new OpenWaError(503, 'OPENWA_NOT_CONFIGURED', `Gateway WhatsApp (${engine}) não configurado.`);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || DEFAULT_TIMEOUT);
    try {
      const res = await fetch(`${gw.url}${path}`, {
        method,
        headers: { 'X-API-Key': gw.key, 'Content-Type': 'application/json', Accept: opts.binary ? '*/*' : 'application/json' },
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
        if (res.status >= 500) this.logger.warn(`OpenWA[${engine}] ${method} ${path} → ${res.status} ${msg}`);
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
  listSessions(engine: WaEngine) { return this.request<OpenWaSession[]>('GET', '/sessions', undefined, { engine }); }
  async createSession(name: string, engine: WaEngine, config?: Record<string, unknown>) {
    const sess = await this.request<OpenWaSession>('POST', '/sessions', { name, ...(config ? { config } : {}) }, { engine });
    this.remember(String(sess?.id || ''), engine);
    return sess;
  }
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
  /** Histórico ao vivo do WhatsApp — só whatsapp-web.js (o Baileys responde 501). */
  history(sid: string, chatId: string, limit = 50, includeMedia = false) { return this.request<any[]>('GET', `${this.s(sid)}/messages/${enc(chatId)}/history?limit=${limit}&includeMedia=${includeMedia}`, undefined, { timeoutMs: 60_000 }); }
  /** Mensagens guardadas no gateway (os dois motores; no Baileys inclui a sincronização inicial, sem mídia). */
  storedMessages(sid: string, chatId: string, limit = 50, offset = 0) { return this.request<{ messages?: any[]; total?: number } | any[]>('GET', `${this.s(sid)}/messages?chatId=${enc(chatId)}&limit=${limit}&offset=${offset}&inlineMedia=false`, undefined, { timeoutMs: 60_000 }); }
  downloadMedia(sid: string, chatId: string, messageId: string) { return this.request<{ buffer: Buffer; mime: string }>('GET', `${this.s(sid)}/messages/${enc(chatId)}/${enc(messageId)}/media`, undefined, { timeoutMs: 120_000, binary: true }); }
  reactions(sid: string, chatId: string, messageId: string) { return this.request<any[]>('GET', `${this.s(sid)}/messages/${enc(chatId)}/${enc(messageId)}/reactions`); }
  // linkPreview: true → o gateway monta a prévia (título/miniatura) que o DESTINATÁRIO vê, como o app faz; se a página falhar, o texto sai sem prévia
  sendText(sid: string, chatId: string, text: string, extra: { mentions?: string[]; quotedMessageId?: string; linkPreview?: boolean } = {}) { return this.request<OpenWaSendResult>('POST', `${this.s(sid)}/messages/send-text`, { chatId, text, ...extra }, { timeoutMs: 45_000 }); }
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
  // participantes (Fase 5 — direito de acesso a grupo VIP). Resposta: {success, message, results:[{id, success, status?, message?}]};
  // recusa PARCIAL não falha o lote (olhar `results`); recusa TOTAL = erro HTTP (403/404/409/503). `success:false` no corpo = falha.
  addGroupParticipants(sid: string, groupId: string, jids: string[]) { return this.groupParticipants('POST', sid, groupId, '', jids); }
  removeGroupParticipants(sid: string, groupId: string, jids: string[]) { return this.groupParticipants('DELETE', sid, groupId, '', jids); }
  promoteGroupParticipants(sid: string, groupId: string, jids: string[]) { return this.groupParticipants('POST', sid, groupId, '/promote', jids); }
  demoteGroupParticipants(sid: string, groupId: string, jids: string[]) { return this.groupParticipants('POST', sid, groupId, '/demote', jids); }
  private async groupParticipants(method: string, sid: string, groupId: string, suffix: string, jids: string[]): Promise<OpenWaParticipantsResult> {
    const r = await this.request<OpenWaParticipantsResult>(method, `${this.s(sid)}/groups/${enc(groupId)}/participants${suffix}`, { participants: jids }, { timeoutMs: 45_000 });
    const results = Array.isArray(r?.results) ? r.results : [];
    if (r && r.success === false && !results.length) throw new OpenWaError(400, 'GROUP_PARTICIPANTS_FAILED', String(r.message || 'O gateway recusou a alteração no grupo.').slice(0, 300));
    return { success: r?.success !== false, message: r?.message, results };
  }
  async createGroup(sid: string, name: string, participants: string[]) {
    const r = await this.request<any>('POST', `${this.s(sid)}/groups`, { name, participants }, { timeoutMs: 60_000 });
    if (r && r.success === false) throw new OpenWaError(400, 'GROUP_CREATE_FAILED', String(r.message || 'O gateway não criou o grupo.').slice(0, 300));
    return r;
  }

  // ---- status (stories)
  statusText(sid: string, text: string, backgroundColor?: string, font?: number) { return this.request<{ statusId: string; timestamp: string; expiresAt: string }>('POST', `${this.s(sid)}/status/send-text`, { text, ...(backgroundColor ? { backgroundColor } : {}), ...(font != null ? { font } : {}) }, { timeoutMs: 60_000 }); }
  statusMedia(sid: string, kind: 'image' | 'video' | 'voice', media: { base64: string; mimetype: string }, caption?: string, backgroundColor?: string) {
    const body: any = kind === 'image' ? { image: media } : kind === 'video' ? { video: media } : { audio: media };
    if (caption && kind !== 'voice') body.caption = caption;
    if (backgroundColor && kind === 'voice') body.backgroundColor = backgroundColor;
    return this.request<{ statusId: string; timestamp: string; expiresAt: string }>('POST', `${this.s(sid)}/status/send-${kind}`, body, { timeoutMs: 120_000 });
  }
  deleteStatus(sid: string, statusId: string) { return this.request('DELETE', `${this.s(sid)}/status/${enc(statusId)}`); }
  /** Status (stories) dos contatos guardados pelo gateway nas últimas 24 h. */
  contactStatuses(sid: string) { return this.request<{ statuses: any[] }>('GET', `${this.s(sid)}/status`, undefined, { timeoutMs: 60_000 }); }
  statusMediaFile(sid: string, statusId: string) { return this.request<{ buffer: Buffer; mime: string }>('GET', `${this.s(sid)}/status/${enc(statusId)}/media`, undefined, { timeoutMs: 120_000, binary: true }); }

  health(engine: WaEngine) { return this.request<any>('GET', '/health', undefined, { engine }); }
}
