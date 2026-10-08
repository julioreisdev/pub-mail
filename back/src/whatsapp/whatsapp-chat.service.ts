import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService, sessionLabel } from './whatsapp-sessions.service';
import { WhatsAppMediaService, kindOfMime } from './whatsapp-media.service';
import { WhatsAppInboundService, previewOf } from './whatsapp-inbound.service';
import { WhatsAppContactsService, digitsOf, isGroupJid, jidFromPhone, phoneFromJid } from './whatsapp-contacts.service';
import { isIdLikeName } from './wa-jid.util';
import { WhatsAppFiltersService } from './whatsapp-filters.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppCrmService, fillCrmVars } from './whatsapp-crm.service';

// Chat: leitura das nossas tabelas (rápido, paginado, polling por `since`) e escrita
// no gateway (cada envio cria a linha OUT com ack 1 na hora; o eco `message.sent` e os
// `message.ack` completam). Erros do gateway viram 400/503 com mensagem clara.
//
// Multi-número: a API identifica a conversa pelo uuid da linha (`chat_id` público);
// internamente cada conversa é (org, número, jid) e todo envio sai pelo NÚMERO da conversa.

const CHAT_ID_RE = /^[^\s@]+@[^\s@]+$/;
export type SessionWhere = { session_id?: any } | null; // null = usuário sem nenhum número → vazio

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
    private readonly presenter: WhatsAppPresenter,
    private readonly attendance: WhatsAppAttendanceService,
    private readonly crm: WhatsAppCrmService,
  ) {}

  private translate(e: any): never {
    if (e instanceof OpenWaError) {
      if (e.status === 404) throw new NotFoundException('Sessão não encontrada no gateway.');
      if (e.status === 429) throw new BadRequestException(e.retryAfterSeconds ? `Limite de envio atingido. Tente em ${e.retryAfterSeconds}s.` : 'Limite de envio atingido.');
      if (e.status >= 500 || e.status === 503 || e.status === 504) throw new ServiceUnavailableException(e.message);
      throw new BadRequestException(e.message);
    }
    throw e;
  }

  // ---------------------------------------------------------------- identidade
  /** Linha da conversa pelo uuid público (404 se não for da org). */
  async chatRow(orgId: string, chatUuid: string) {
    const c = await this.prisma.whatsapp_chats.findFirst({ where: { id: String(chatUuid || ''), organization_id: orgId } });
    if (!c) throw new NotFoundException('Conversa não encontrada.');
    return c;
  }

  /** Número (session_id) de uma mensagem da org — para o controller conferir o acesso. */
  async messageSession(orgId: string, msgId: string) {
    const m = await this.prisma.whatsapp_messages.findFirst({ where: { id: String(msgId || ''), organization_id: orgId }, select: { session_id: true } });
    if (!m) throw new NotFoundException('Mensagem não encontrada.');
    return m.session_id;
  }

  /** Conversa (linha) + número pronto para enviar. */
  private async target(orgId: string, chatUuid: string) {
    const chat = await this.chatRow(orgId, chatUuid);
    const row = await this.sessions.requireReady(orgId, chat.session_id);
    return { chat, row };
  }

  private shapeMessages(orgId: string, rows: any[]) { return this.presenter.shapeMessages(orgId, rows); }

  private readonly mediaFetching = new Set<string>();
  // mídia que o gateway não entregou: não tenta de novo a cada abertura da conversa
  private static readonly MEDIA_RETRY_MS = 6 * 3600_000;

  /** Baixa do gateway a mídia de uma mensagem marcada como omitida. Resolve true se guardou. */
  async fetchMedia(orgId: string, m: any, row?: any): Promise<boolean> {
    if (this.mediaFetching.has(m.id)) return false;
    const sess = row || (await this.sessions.rowById(orgId, m.session_id));
    if (!sess?.openwa_session_id || sess.status !== 'ready') return false;
    this.mediaFetching.add(m.id);
    try {
      const r = await this.openwa.downloadMedia(sess.openwa_session_id, m.chat_id, m.wa_message_id);
      if (!r?.buffer?.length) throw new Error('vazio');
      const info: any = ((m.extra as any) || {}).media_info || {};
      const stored = await this.media.store(orgId, r.buffer, info.mimetype && /octet-stream/.test(r.mime) ? info.mimetype : r.mime, info.filename || null, m.type === 'voice' ? 'voice' : kindOfMime(r.mime));
      const extra = { ...((m.extra as any) || {}), media_info: { ...info, reason: undefined, checked_at: new Date().toISOString() } };
      await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { media_id: stored.id, media_omitted: false, extra } });
      this.presenter.message(orgId, { id: m.id });
      return true;
    } catch (e: any) {
      const info: any = ((m.extra as any) || {}).media_info || {};
      const reason = e instanceof OpenWaError && e.status === 404 ? (info.history ? 'history' : 'unavailable') : e?.message === 'vazio' ? 'unavailable' : 'error';
      const extra = { ...((m.extra as any) || {}), media_info: { ...info, reason, checked_at: new Date().toISOString() } };
      await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { media_omitted: true, extra } }).catch(() => undefined);
      this.presenter.message(orgId, { id: m.id });
      return false;
    } finally {
      this.mediaFetching.delete(m.id);
    }
  }

  /** "Tentar de novo" numa mídia indisponível (ignora a espera de 6 h). */
  async retryMedia(orgId: string, id: string) {
    const m = await this.prisma.whatsapp_messages.findFirst({ where: { id, organization_id: orgId } });
    if (!m) throw new NotFoundException('Mensagem não encontrada.');
    if (m.media_id) return (await this.shapeMessages(orgId, [m]))[0];
    const ok = await this.fetchMedia(orgId, m);
    const fresh = await this.prisma.whatsapp_messages.findUnique({ where: { id: m.id } });
    const [shaped] = await this.shapeMessages(orgId, [fresh]);
    return { ...shaped, retried: true, ok };
  }

  // ---------------------------------------------------------------- leitura
  // Filtros (todos combináveis):
  //   session_id=<número> (ou nenhum = todos os números permitidos)
  //   kind=all|dm|group · archived=1 · unread=1 · filter=<id do filtro personalizado>
  //   tags=<id,id> + tags_mode=any|all · service=none|bot|waiting|human|closed|open (bot+fila+humano)
  //   assigned=me|none|<userId> · no_reply_hours=N (cliente esperando resposta há N h)
  //   from=<ISO> · to=<ISO> (última mensagem) · q=<busca>
  private async chatWhere(orgId: string, userId: string | null, q: any = {}, sess: SessionWhere) {
    const where: any = { organization_id: orgId, archived: q.archived === '1' || q.archived === 'true', ...(sess || {}) };
    const and: any[] = [];
    const kind = String(q.kind || 'all');
    if (kind === 'dm' || kind === 'individual') where.kind = 'individual';
    else if (kind === 'group') where.kind = 'group';
    if (q.unread === '1' || q.unread === 'true') where.unread_count = { gt: 0 };
    if (q.filter) { where.id = { in: await this.filters.idsOf(orgId, String(q.filter)) }; delete where.archived; }
    if (q.tags) {
      const ids = String(q.tags).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20);
      if (ids.length) {
        const conds = ids.map((id) => ({ tags: { array_contains: id } }));
        if (q.tags_mode === 'all') and.push(...conds);
        else and.push({ OR: conds });
      }
    }
    if (q.service) {
      const sv = String(q.service);
      if (sv === 'open') where.service_status = { in: ['bot', 'waiting', 'human'] };
      else if (['none', 'bot', 'waiting', 'human', 'closed'].includes(sv)) where.service_status = sv;
    }
    if (q.assigned) {
      const a = String(q.assigned);
      if (a === 'me') where.assigned_user_id = userId || '__none__';
      else if (a === 'none') where.assigned_user_id = null;
      else where.assigned_user_id = a;
    }
    if (q.stage) { const st = String(q.stage); where.stage_id = st === 'none' ? null : st === 'any' ? { not: null } : st; }
    const nr = parseFloat(String(q.no_reply_hours || ''));
    if (Number.isFinite(nr) && nr > 0) {
      where.kind = 'individual';
      where.last_message_direction = 'IN';
      and.push({ last_inbound_at: { lt: new Date(Date.now() - nr * 3600_000) } });
    }
    const from = q.from ? new Date(String(q.from)) : null;
    const to = q.to ? new Date(String(q.to)) : null;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      where.last_message_at = { ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}), ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}) };
    }
    if (q.q) {
      const s = String(q.q).trim();
      const d = digitsOf(s);
      const contactIds = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ name: { contains: s } }, { push_name: { contains: s } }, ...(d ? [{ phone: { contains: d } }] : [])] }, select: { wa_id: true, lid: true, phone: true }, take: 200 });
      // a conversa pode estar pelo @lid (whatsapp-web.js) OU pelo telefone (Baileys): casa pelos três
      const jids = [...new Set(contactIds.flatMap((c) => [c.wa_id, c.lid, c.phone ? `${c.phone}@c.us` : null].filter(Boolean) as string[]))];
      and.push({ OR: [{ name: { contains: s } }, { chat_id: { in: jids } }, ...(d ? [{ chat_id: { startsWith: d } }] : [])] });
    }
    if (and.length) where.AND = and;
    return where;
  }

  async listChats(orgId: string, q: any = {}, userId: string | null = null, sess: SessionWhere = {}) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(10, parseInt(String(q.page_size || 50), 10) || 50));
    if (sess === null) return { items: [], total: 0, page, pages: 1, server_time: new Date().toISOString() };
    const where = await this.chatWhere(orgId, userId, q, sess);
    const [total, rows] = await Promise.all([
      this.prisma.whatsapp_chats.count({ where }),
      this.prisma.whatsapp_chats.findMany({ where, orderBy: [{ pinned: 'desc' }, { last_message_at: 'desc' }], skip: (page - 1) * size, take: size }),
    ]);
    const items = await this.presenter.shapeChats(orgId, rows);
    // busca por nome: contatos da agenda que ainda NÃO têm conversa no painel (o atendente inicia na hora)
    let contacts: any[] = [];
    if (q.q && page === 1) {
      const s = String(q.q).trim();
      const d = digitsOf(s);
      if (s.length >= 2) {
        const found = await this.prisma.whatsapp_contacts.findMany({
          where: { organization_id: orgId, is_blocked: false, phone: { not: null }, OR: [{ name: { contains: s } }, { push_name: { contains: s } }, ...(d.length >= 4 ? [{ phone: { contains: d } }] : [])] },
          select: { id: true, name: true, push_name: true, phone: true, wa_id: true, lid: true, is_my_contact: true, saved: true },
          orderBy: [{ is_my_contact: 'desc' }, { name: 'asc' }],
          take: 40,
        });
        if (found.length) {
          const jids = [...new Set(found.flatMap((c) => [c.wa_id, c.lid, `${c.phone}@c.us`].filter(Boolean) as string[]))];
          const withChat = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, chat_id: { in: jids }, kind: 'individual', ...(sess || {}) }, select: { chat_id: true } });
          const has = new Set(withChat.map((c) => c.chat_id));
          contacts = found
            .filter((c) => ![c.wa_id, c.lid, `${c.phone}@c.us`].some((j) => j && has.has(j)))
            .slice(0, 8)
            .map((c) => ({ id: c.id, name: c.name || c.push_name || null, phone: c.phone, agenda: c.is_my_contact, saved: c.saved }));
        }
      }
    }
    return { items, contacts, total, page, pages: Math.max(1, Math.ceil(total / size)), server_time: new Date().toISOString() };
  }

  /** Contagens para os chips de filtro (por número ou todos os permitidos). */
  async counts(orgId: string, userId: string | null, sess: SessionWhere = {}) {
    const zero = { all: 0, unread: 0, dms: 0, groups: 0, archived: 0, bot: 0, waiting: 0, human: 0, mine: 0, waiting_reply: 0, by_session: {} as Record<string, number> };
    if (sess === null) return zero;
    const base = { organization_id: orgId, archived: false, ...sess };
    const [all, unread, dms, groups, archived, bot, waiting, human, mine, noReply, perSession] = await Promise.all([
      this.prisma.whatsapp_chats.count({ where: base }),
      this.prisma.whatsapp_chats.count({ where: { ...base, unread_count: { gt: 0 } } }),
      this.prisma.whatsapp_chats.count({ where: { ...base, kind: 'individual' } }),
      this.prisma.whatsapp_chats.count({ where: { ...base, kind: 'group' } }),
      this.prisma.whatsapp_chats.count({ where: { organization_id: orgId, archived: true, ...sess } }),
      this.prisma.whatsapp_chats.count({ where: { ...base, service_status: 'bot' } }),
      this.prisma.whatsapp_chats.count({ where: { ...base, service_status: 'waiting' } }),
      this.prisma.whatsapp_chats.count({ where: { ...base, service_status: 'human' } }),
      userId ? this.prisma.whatsapp_chats.count({ where: { ...base, assigned_user_id: userId, service_status: { in: ['human', 'waiting'] } } }) : Promise.resolve(0),
      this.prisma.whatsapp_chats.count({ where: { ...base, kind: 'individual', last_message_direction: 'IN', last_inbound_at: { not: null } } }),
      // conversas com não lidas por número (mesma régua do chip "Não lidos", não a soma das mensagens)
      this.prisma.whatsapp_chats.groupBy({ by: ['session_id'], where: { ...base, unread_count: { gt: 0 } }, _count: { _all: true } }),
    ]);
    const by_session: Record<string, number> = {};
    for (const p of perSession) by_session[p.session_id] = Number(p._count._all || 0);
    return { all, unread, dms, groups, archived, bot, waiting, human, mine, waiting_reply: noReply, by_session };
  }

  async getChat(orgId: string, chatUuid: string) {
    const c = await this.chatRow(orgId, chatUuid);
    const [shaped] = (await this.presenter.shapeChats(orgId, [c])) as any[];
    if (c.kind === 'group') {
      // metadados ao vivo (participantes) — best-effort, cache de 5 min no group_meta
      const meta: any = c.group_meta || {};
      const stale = !meta.fetched_at || Date.now() - new Date(meta.fetched_at).getTime() > 5 * 60_000;
      const row = await this.sessions.rowById(orgId, c.session_id);
      if (stale && row?.openwa_session_id && row.status === 'ready') {
        try {
          const g = await this.openwa.groupInfo(row.openwa_session_id, c.chat_id);
          const me = row.phone ? `${row.phone}@c.us` : '';
          const participants = (g?.participants || []).map((p: any) => ({ id: p.id, phone: p.number || phoneFromJid(p.id), name: p.name || null, is_admin: Boolean(p.isAdmin || p.isSuperAdmin) }));
          const newMeta = { ...meta, subject: g?.name || meta.subject, description: g?.description ?? meta.description, owner: g?.owner, participants, participants_count: participants.length, is_admin: participants.some((p: any) => p.id === me && p.is_admin), fetched_at: new Date().toISOString() };
          await this.prisma.whatsapp_chats.update({ where: { id: c.id }, data: { group_meta: newMeta, ...(g?.name ? { name: String(g.name).slice(0, 255) } : {}) } });
          shaped.name = g?.name || shaped.name;
          shaped.group_meta = { subject: newMeta.subject, description: newMeta.description, participants, participants_count: participants.length, is_admin: newMeta.is_admin, owner: newMeta.owner };
        } catch (e: any) {
          this.logger.debug(`groupInfo ${c.chat_id}: ${e?.message || e}`);
          shaped.group_meta = { ...(shaped.group_meta || {}), participants: meta.participants || [] };
        }
      } else shaped.group_meta = { ...(shaped.group_meta || {}), participants: meta.participants || [], owner: meta.owner };
      // o gateway só manda o telefone → nome/contato vêm dos contatos da org e de quem já falou no grupo
      shaped.group_meta.participants = await this.contacts.enrichParticipants(orgId, row, c.chat_id, shaped.group_meta.participants || []);
    }
    return shaped;
  }

  async messages(orgId: string, chatUuid: string, q: any = {}) {
    const chat = await this.chatRow(orgId, chatUuid);
    const limit = Math.min(200, Math.max(1, parseInt(String(q.limit || 50), 10) || 50));
    const where: any = { organization_id: orgId, session_id: chat.session_id, chat_id: chat.chat_id };
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
    // mídia omitida → baixa em background (até 5 por chamada), sem insistir na que já falhou há pouco
    const now = Date.now();
    const pending = rows
      .filter((r) => r.media_omitted && !r.media_id && !this.mediaFetching.has(r.id))
      .filter((r) => {
        const checked = ((r.extra as any) || {}).media_info?.checked_at;
        return !checked || now - new Date(checked).getTime() > WhatsAppChatService.MEDIA_RETRY_MS;
      })
      .slice(-5);
    if (pending.length) {
      const row = await this.sessions.rowById(orgId, chat.session_id);
      if (row?.openwa_session_id && row.status === 'ready') for (const m of pending) void this.fetchMedia(orgId, m, row);
    }
    // menções `@id` em grupo → nome (grava em extra.mention_names; só as que ainda não têm)
    if (isGroupJid(chat.chat_id)) await this.contacts.fillMentions(orgId, rows).catch(() => {});
    return { items: await this.shapeMessages(orgId, rows), server_time: new Date().toISOString() };
  }

  /**
   * Abre (ou cria) a conversa individual de um telefone POR UM NÚMERO. Conversa nova: confere no
   * gateway se o número tem WhatsApp (e adota o jid que ele devolve — o 9º dígito do Brasil pode
   * mudar o número) e, com `name`, salva o contato na organização.
   */
  async openByPhone(orgId: string, sessionId: string, phone: string, name?: string) {
    const row = await this.sessions.requireRow(orgId, sessionId);
    let d = digitsOf(phone);
    if (d.length < 10 || d.length > 15) throw new BadRequestException('Telefone inválido. Use DDI + DDD + número (ex.: 55 11 99999-9999).');
    const cleanName = String(name || '').trim().slice(0, 255);
    const key = (jid: string) => ({ organization_id_session_id_chat_id: { organization_id: orgId, session_id: row.id, chat_id: jid } });
    let chatId = await this.contacts.canonicalChatId(orgId, row, jidFromPhone(d));
    let existing = await this.prisma.whatsapp_chats.findUnique({ where: key(chatId) });
    if (!existing) {
      if (row.openwa_session_id && row.status === 'ready') {
        let r: any = null;
        try {
          r = await this.openwa.checkNumber(row.openwa_session_id, d);
        } catch (e: any) {
          this.logger.debug(`checkNumber ${d}: ${e?.message || e}`); // gateway instável → segue sem conferir
        }
        if (r && r.exists === false) throw new BadRequestException('Esse número não tem WhatsApp.');
        const gw = digitsOf(String(r?.whatsappId || '').split('@')[0]);
        if (gw.length >= 10 && gw.length <= 15 && gw !== d) {
          d = gw;
          chatId = await this.contacts.canonicalChatId(orgId, row, jidFromPhone(d));
          existing = await this.prisma.whatsapp_chats.findUnique({ where: key(chatId) });
        }
      }
    }
    let contact = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, OR: [{ phone: d }, { wa_id: chatId }] }, orderBy: { saved: 'desc' } });
    // nome informado só preenche quem ainda não tem nome salvo (nunca renomeia um contato da agenda)
    if (cleanName && !contact?.name) {
      await this.contacts.createManual(orgId, { phone: d, name: cleanName }).catch(() => undefined);
      contact = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, OR: [{ phone: d }, { wa_id: chatId }] }, orderBy: { saved: 'desc' } });
    }
    if (existing) {
      if (cleanName && (!existing.name || existing.name === 'Contato sem nome')) existing = await this.prisma.whatsapp_chats.update({ where: { id: existing.id }, data: { name: contact?.name || cleanName } });
      return (await this.presenter.shapeChats(orgId, [existing]))[0];
    }
    const c = await this.prisma.whatsapp_chats.create({ data: { organization_id: orgId, session_id: row.id, chat_id: chatId, kind: 'individual', name: cleanName || contact?.name || contact?.push_name || null } });
    this.presenter.chat(orgId, row.id, chatId);
    return (await this.presenter.shapeChats(orgId, [c]))[0];
  }

  // ---------------------------------------------------------------- ações de chat
  async markRead(orgId: string, chatUuid: string) {
    const chat = await this.chatRow(orgId, chatUuid);
    // o que chegou até agora conta como lido (ponto de leitura do cálculo de não lidas)
    await this.prisma.whatsapp_messages.updateMany({ where: { organization_id: orgId, session_id: chat.session_id, chat_id: chat.chat_id, direction: 'IN', ack: { lt: 3 } }, data: { ack: 3 } });
    await this.prisma.whatsapp_chats.update({ where: { id: chat.id }, data: { unread_count: 0 } });
    this.presenter.chat(orgId, chat.session_id, chat.chat_id);
    const row = await this.sessions.rowById(orgId, chat.session_id);
    if (row?.openwa_session_id && row.status === 'ready') this.openwa.markRead(row.openwa_session_id, chat.chat_id).catch(() => undefined);
    return { ok: true };
  }

  async typing(orgId: string, chatUuid: string, typing: boolean) {
    const chat = await this.chatRow(orgId, chatUuid);
    const row = await this.sessions.rowById(orgId, chat.session_id);
    if (row?.openwa_session_id && row.status === 'ready') await this.openwa.typing(row.openwa_session_id, chat.chat_id, typing ? 'typing' : 'paused').catch(() => undefined);
    return { ok: true };
  }

  // Arquivar/fixar/silenciar. O que o usuário decide aqui vale até o celular mudar essa
  // marcação: guardamos em flag_overrides o valor pedido e o que o gateway tinha (gw), e a
  // sincronização não desfaz enquanto o gateway continuar no valor antigo. Isso cobre o
  // gateway que responde `{success:false}` (ex.: conversa antiga pelo telefone, sem mensagens)
  // e o atraso entre a ação e a lista do gateway refletir.
  async setFlag(orgId: string, chatUuid: string, flag: 'archived' | 'pinned' | 'muted', value: boolean) {
    const chat = await this.chatRow(orgId, chatUuid);
    const row = await this.sessions.rowById(orgId, chat.session_id);
    let synced = false;
    if (row?.openwa_session_id && row.status === 'ready') {
      let r: any;
      try {
        if (flag === 'archived') r = await this.openwa.archiveChat(row.openwa_session_id, chat.chat_id, value);
        if (flag === 'pinned') r = await this.openwa.pinChat(row.openwa_session_id, chat.chat_id, value);
        if (flag === 'muted') r = await this.openwa.muteChat(row.openwa_session_id, chat.chat_id, value ? Date.now() + 8 * 3600_000 : null);
      } catch (e) { this.translate(e); }
      synced = r?.success !== false;
    }
    const ov: Record<string, { value: boolean; gw: boolean }> = { ...((chat.flag_overrides as any) || {}) };
    const gw = ov[flag] ? Boolean(ov[flag].gw) : Boolean((chat as any)[flag]);
    if (gw === value) delete ov[flag];
    else ov[flag] = { value, gw };
    await this.prisma.whatsapp_chats.update({ where: { id: chat.id }, data: { [flag]: value, flag_overrides: ov } });
    this.presenter.chat(orgId, chat.session_id, chat.chat_id);
    return { ok: true, synced };
  }

  // ---------------------------------------------------------------- envio
  /** Grava a linha OUT de um envio feito pelo número `row` para o jid `rawChatId`. */
  async recordOut(row: any, rawChatId: string, r: { messageId: string; timestamp?: number }, m: { type: string; body?: string | null; media_id?: string | null; quoted?: string | null; quoted_preview?: string | null; forwarded?: boolean; extra?: any; userId?: string | null }) {
    const orgId = row.organization_id as string;
    const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
    const waId = String(r?.messageId || `local_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    // o eco do gateway chega pelo @lid da pessoa → gravamos sempre no chat canônico do número
    const chatId = await this.contacts.canonicalChatId(orgId, row, rawChatId);
    let msg: any;
    try {
      msg = await this.prisma.whatsapp_messages.create({
        data: { organization_id: orgId, session_id: row.id, chat_id: chatId, wa_message_id: waId, direction: 'OUT', type: m.type, body: m.body ?? null, media_id: m.media_id ?? null, from_jid: null, quoted_wa_id: m.quoted ?? null, quoted_preview: m.quoted_preview ?? null, forwarded: Boolean(m.forwarded), ack: 1, extra: m.extra ?? undefined, sent_by_user_id: m.userId ?? null, timestamp: at },
      });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
      // o eco message.sent chegou antes: completa a linha
      msg = await this.prisma.whatsapp_messages.update({ where: { organization_id_session_id_wa_message_id: { organization_id: orgId, session_id: row.id, wa_message_id: waId } }, data: { media_id: m.media_id ?? undefined, sent_by_user_id: m.userId ?? undefined, quoted_wa_id: m.quoted ?? undefined, quoted_preview: m.quoted_preview ?? undefined, forwarded: m.forwarded || undefined } });
    }
    await this.inbound.bumpChat(orgId, row.id, chatId, { type: m.type, body: m.body, direction: 'OUT', at });
    if (m.userId) await this.attendance.onPanelSend(orgId, { session_id: row.id, chat_id: chatId }, m.userId).catch(() => undefined);
    const shaped = (await this.shapeMessages(orgId, [msg]))[0];
    this.presenter.messageShaped(orgId, shaped);
    return shaped;
  }

  private async quotedPreview(orgId: string, sessionId: string, quotedWaId?: string | null) {
    if (!quotedWaId) return null;
    const q = await this.prisma.whatsapp_messages.findUnique({ where: { organization_id_session_id_wa_message_id: { organization_id: orgId, session_id: sessionId, wa_message_id: quotedWaId } } });
    return q ? previewOf(q.type, q.body) : null;
  }

  async sendText(orgId: string, userId: string, dto: { chat_id: string; text: string; quoted_wa_id?: string; mentions?: string[] }) {
    const { chat, row } = await this.target(orgId, dto.chat_id);
    let raw = String(dto.text || '').trim();
    if (!raw) throw new BadRequestException('Mensagem vazia.');
    if (raw.includes('{{')) raw = await this.fillVars(orgId, chat, raw); // resposta rápida com {{nome}}/{{cliente.*}}
    const text = await this.attendance.sign(orgId, userId, raw);
    let r: any;
    try {
      r = dto.quoted_wa_id
        ? await this.openwa.reply(row.openwa_session_id!, chat.chat_id, dto.quoted_wa_id, text, dto.mentions)
        : await this.openwa.sendText(row.openwa_session_id!, chat.chat_id, text, { mentions: dto.mentions?.length ? dto.mentions : undefined, ...(/https?:\/\/\S/i.test(text) ? { linkPreview: true } : {}) });
    } catch (e) { this.translate(e); }
    return this.recordOut(row, chat.chat_id, r, { type: 'text', body: text, quoted: dto.quoted_wa_id || null, quoted_preview: await this.quotedPreview(orgId, row.id, dto.quoted_wa_id), extra: dto.mentions?.length ? { mentions: dto.mentions } : undefined, userId });
  }

  /** {{nome}} {{telefone}} {{cliente.*}} na mensagem digitada/resposta rápida. */
  async fillVars(orgId: string, chat: { chat_id: string; id?: string; session_id?: string }, text: string) {
    const contact = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, OR: [{ wa_id: chat.chat_id }, { lid: chat.chat_id }] } }).catch(() => null);
    const name = contact?.name || contact?.push_name || '';
    const vars: Record<string, string> = { nome: name, name, primeiro_nome: name.split(/\s+/)[0] || '', telefone: contact?.phone || phoneFromJid(chat.chat_id), phone: contact?.phone || phoneFromJid(chat.chat_id) };
    if (/\{\{\s*cliente\./i.test(text)) Object.assign(vars, await this.crm.varsForChat(orgId, chat.id || chat.chat_id, chat.session_id || null).catch(() => ({})));
    return fillCrmVars(text, vars);
  }

  async sendMedia(orgId: string, userId: string, dto: { chat_id: string; caption?: string; as_voice?: boolean; as_document?: boolean; quoted_wa_id?: string }, file: { buffer: Buffer; mimetype: string; originalname?: string; size: number }) {
    const { chat, row } = await this.target(orgId, dto.chat_id);
    if (!file?.buffer?.length) throw new BadRequestException('Arquivo vazio.');
    if (file.size > 64 * 1024 * 1024) throw new BadRequestException('Arquivo até 64 MB.');
    let mime = String(file.mimetype || 'application/octet-stream');
    let filename = file.originalname ? Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 255) : undefined;
    let buffer = file.buffer;
    let kind: 'image' | 'video' | 'audio' | 'document' | 'sticker' = 'document';
    if (!dto.as_document) {
      if (mime.startsWith('image/') && !mime.includes('gif')) kind = 'image';
      else if (mime.startsWith('video/')) kind = 'video';
      else if (mime.startsWith('audio/')) kind = 'audio';
    }
    const ptt = kind === 'audio' && Boolean(dto.as_voice);
    if (kind === 'audio') {
      // gravação do navegador vem em WebM: o WhatsApp só entrega voz em OGG/Opus
      const n = await this.media.normalizeAudio(buffer, mime, ptt, filename);
      buffer = n.buffer;
      mime = n.mime;
      filename = n.filename || filename;
    }
    const rawCaption = String(dto.caption || '').trim().slice(0, 1000);
    const caption = (rawCaption ? await this.attendance.sign(orgId, userId, rawCaption) : '') || undefined;
    const stored = await this.media.store(orgId, buffer, mime, filename || null, ptt ? 'voice' : kindOfMime(mime));
    let r: any;
    try {
      r = await this.openwa.sendMedia(row.openwa_session_id!, kind, chat.chat_id, { base64: buffer.toString('base64'), mimetype: mime, filename, caption, ...(ptt ? { ptt: true } : {}), ...(dto.quoted_wa_id ? { quotedMessageId: dto.quoted_wa_id } : {}) });
    } catch (e) { this.translate(e); }
    const type = kind === 'audio' ? (ptt ? 'voice' : 'audio') : kind;
    return this.recordOut(row, chat.chat_id, r, { type, body: caption || null, media_id: stored.id, quoted: dto.quoted_wa_id || null, quoted_preview: await this.quotedPreview(orgId, row.id, dto.quoted_wa_id), userId });
  }

  /** Envia uma mídia que já está guardada no Pub Mail (resposta rápida, reenvio). */
  async sendStoredMedia(orgId: string, userId: string, dto: { chat_id: string; media_id: string; caption?: string; as_voice?: boolean; as_document?: boolean; quoted_wa_id?: string }) {
    const m = await this.prisma.whatsapp_media.findFirst({ where: { id: dto.media_id, organization_id: orgId } });
    if (!m) throw new NotFoundException('Mídia não encontrada.');
    const f = await this.media.readBase64(orgId, m.id);
    const buffer = Buffer.from(f.base64, 'base64');
    return this.sendMedia(orgId, userId, { ...dto, as_voice: dto.as_voice ?? m.kind === 'voice' }, { buffer, mimetype: f.mime, originalname: f.filename ? Buffer.from(f.filename, 'utf8').toString('latin1') : undefined, size: buffer.length });
  }

  async sendLocation(orgId: string, userId: string, dto: { chat_id: string; latitude: number; longitude: number; description?: string }) {
    const { chat, row } = await this.target(orgId, dto.chat_id);
    let r: any;
    try { r = await this.openwa.sendLocation(row.openwa_session_id!, chat.chat_id, Number(dto.latitude), Number(dto.longitude), dto.description); } catch (e) { this.translate(e); }
    return this.recordOut(row, chat.chat_id, r, { type: 'location', body: dto.description || null, extra: { location: { latitude: dto.latitude, longitude: dto.longitude, description: dto.description || null } }, userId });
  }

  async sendPoll(orgId: string, userId: string, dto: { chat_id: string; name: string; options: string[]; multiple?: boolean }) {
    const { chat, row } = await this.target(orgId, dto.chat_id);
    const options = (dto.options || []).map((o) => String(o || '').trim().slice(0, 100)).filter(Boolean);
    if (options.length < 2) throw new BadRequestException('A enquete precisa de pelo menos 2 opções.');
    let r: any;
    try { r = await this.openwa.sendPoll(row.openwa_session_id!, chat.chat_id, String(dto.name).trim(), options, Boolean(dto.multiple)); } catch (e) { this.translate(e); }
    return this.recordOut(row, chat.chat_id, r, { type: 'poll', body: String(dto.name).trim(), extra: { poll: { name: dto.name, options: options.map((o) => ({ name: o, votes: 0 })), multiple: Boolean(dto.multiple) } }, userId });
  }

  private async ownMessage(orgId: string, id: string) {
    const m = await this.prisma.whatsapp_messages.findFirst({ where: { id, organization_id: orgId } });
    if (!m) throw new NotFoundException('Mensagem não encontrada.');
    const row = await this.sessions.requireReady(orgId, m.session_id);
    return { m, row };
  }

  async react(orgId: string, id: string, emoji: string) {
    const { m, row } = await this.ownMessage(orgId, id);
    try { await this.openwa.react(row.openwa_session_id!, m.chat_id, m.wa_message_id, String(emoji || '')); } catch (e) { this.translate(e); }
    const me = row.phone ? `${row.phone}@c.us` : 'me';
    let list: any[] = (Array.isArray(m.reactions) ? m.reactions : []).filter((r: any) => !r.from_me);
    if (emoji) list.push({ from: me, emoji: String(emoji), from_me: true });
    const upd = await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { reactions: list } });
    const shaped = (await this.shapeMessages(orgId, [upd]))[0];
    this.presenter.messageShaped(orgId, shaped);
    return shaped;
  }

  /** Encaminha para conversas (uuids) — pode ser de outro número: aí o envio sai pelo número do destino. */
  async forward(orgId: string, userId: string, id: string, to: string[], allowed: Set<string> | null = null) {
    const { m, row } = await this.ownMessage(orgId, id);
    const targets = [...new Set((to || []).map(String).filter(Boolean))].slice(0, 20);
    if (!targets.length) throw new BadRequestException('Escolha ao menos um destino.');
    const out: any[] = [];
    for (const t of targets) {
      try {
        const chat = await this.chatRow(orgId, t);
        if (allowed && !allowed.has(chat.session_id)) throw new NotFoundException('Conversa não encontrada.');
        if (chat.session_id === row.id) {
          const r = await this.openwa.forward(row.openwa_session_id!, m.chat_id, chat.chat_id, m.wa_message_id);
          out.push(await this.recordOut(row, chat.chat_id, r, { type: m.type, body: m.body, media_id: m.media_id, forwarded: true, extra: m.extra as any, userId }));
        } else {
          // outro número: reenvia o conteúdo (texto/mídia) por ele
          const dest = await this.sessions.requireReady(orgId, chat.session_id);
          let r: any;
          if (m.media_id) {
            const f = await this.media.readBase64(orgId, m.media_id);
            const kind = f.kind === 'voice' || f.kind === 'audio' ? 'audio' : f.kind === 'image' ? 'image' : f.kind === 'video' ? 'video' : 'document';
            r = await this.openwa.sendMedia(dest.openwa_session_id!, kind as any, chat.chat_id, { base64: f.base64, mimetype: f.mime, filename: f.filename || undefined, caption: m.body || undefined, ...(f.kind === 'voice' ? { ptt: true } : {}) });
          } else {
            if (!m.body) throw new BadRequestException('Essa mensagem não pode ser encaminhada para outro número.');
            r = await this.openwa.sendText(dest.openwa_session_id!, chat.chat_id, m.body);
          }
          out.push(await this.recordOut(dest, chat.chat_id, r, { type: m.type, body: m.body, media_id: m.media_id, forwarded: true, extra: m.extra as any, userId }));
        }
      } catch (e: any) {
        out.push({ chat_id: t, error: e instanceof OpenWaError ? e.message : String(e?.message || e) });
      }
    }
    return { results: out };
  }

  async edit(orgId: string, id: string, text: string) {
    const { m, row } = await this.ownMessage(orgId, id);
    if (m.direction !== 'OUT' || m.type !== 'text') throw new BadRequestException('Só mensagens de texto enviadas por você podem ser editadas.');
    try { await this.openwa.edit(row.openwa_session_id!, m.chat_id, m.wa_message_id, String(text).trim()); } catch (e) { this.translate(e); }
    const upd = await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { body: String(text).trim(), edited: true } });
    const shaped = (await this.shapeMessages(orgId, [upd]))[0];
    this.presenter.messageShaped(orgId, shaped);
    return shaped;
  }

  async delete(orgId: string, id: string, everyone: boolean) {
    const { m, row } = await this.ownMessage(orgId, id);
    if (everyone && m.direction !== 'OUT') throw new BadRequestException('Só é possível apagar para todos as mensagens enviadas por você.');
    try { await this.openwa.deleteMessage(row.openwa_session_id!, m.chat_id, m.wa_message_id, everyone); } catch (e) { this.translate(e); }
    if (everyone) {
      const upd = await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { revoked: true } });
      const shaped = (await this.shapeMessages(orgId, [upd]))[0];
      this.presenter.messageShaped(orgId, shaped);
      return shaped;
    }
    const chatUuid = await this.presenter.chatUuid(orgId, m.session_id, m.chat_id);
    await this.prisma.whatsapp_messages.delete({ where: { id: m.id } });
    if (chatUuid) this.presenter.messageDeleted(orgId, m.session_id, chatUuid, m.id);
    return { id: m.id, deleted: true };
  }

  // Importa as últimas N mensagens das conversas mais recentes DE UM NÚMERO. Idempotente por wa_message_id.
  //  - whatsapp-web.js: histórico ao vivo do WhatsApp (GET …/messages/:chat/history);
  //  - Baileys: o que o gateway guardou na sincronização inicial (GET …/messages?chatId=).
  // Mídia de histórico vem sem arquivo nos dois motores → fica marcada como "anterior à conexão".
  async importHistory(orgId: string, session: any, chatsLimit = 40, perChat = 30) {
    const row = typeof session === 'string' ? await this.sessions.requireReady(orgId, session) : session;
    if (!row?.openwa_session_id || row.status !== 'ready') throw new BadRequestException('Conecte o WhatsApp primeiro.');
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: row.id, archived: false, kind: { in: ['individual', 'group'] } }, orderBy: { last_message_at: 'desc' }, take: chatsLimit });
    let imported = 0;
    const baileys = row.engine === 'baileys';
    for (const c of chats) {
      let hist: any[] = [];
      try {
        if (baileys) {
          const r: any = await this.openwa.storedMessages(row.openwa_session_id!, c.chat_id, perChat, 0);
          hist = (Array.isArray(r) ? r : r?.messages || []).map((m: any) => WhatsAppChatService.fromStored(m));
        } else {
          hist = await this.openwa.history(row.openwa_session_id!, c.chat_id, perChat, false);
        }
      } catch (e: any) { this.logger.debug(`history ${c.chat_id}: ${e?.message || e}`); continue; }
      for (const m of Array.isArray(hist) ? hist : []) {
        try {
          const created = await this.inbound.onMessage(row, { ...m, chatId: m?.chatId || c.chat_id, media: m?.media ? { ...m.media, data: undefined, omitted: true } : undefined }, Boolean(m?.fromMe), { silent: true, history: true });
          if (created) imported++;
        } catch (e: any) { this.logger.debug(`import msg: ${e?.message || e}`); }
      }
      if (imported) this.presenter.chat(orgId, row.id, c.chat_id);
    }
    // Baileys: as não lidas do gateway não valem; depois de importar o histórico, recalcula pelo que temos
    if (row.engine === 'baileys') {
      const marked = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: row.id, unread_count: { gt: 0 } }, select: { chat_id: true } });
      for (const c of marked) await this.inbound.recomputeUnread(orgId, row.id, c.chat_id).catch(() => undefined);
    }
    return { chats: chats.length, imported, engine: row.engine, session_id: row.id };
  }

  /** Linha do store do OpenWA (GET /sessions/:id/messages) → formato do evento message.* */
  static fromStored(m: any) {
    const md: any = m?.metadata || {};
    let ts = Number(m?.timestamp || 0);
    if (ts > 1e12) ts = Math.floor(ts / 1000);
    return {
      ...md,
      id: m?.waMessageId || m?.id,
      chatId: m?.chatId,
      from: m?.from,
      to: m?.to,
      fromMe: m?.direction === 'outgoing',
      body: m?.body ?? md.body ?? null,
      type: m?.type,
      timestamp: ts || undefined,
      author: m?.author ?? md.author,
      media: md.media ? { ...md.media, data: undefined, omitted: true } : undefined,
      contact: md.contact || (m?.chatName && !String(m?.chatId || '').endsWith('@g.us') ? { name: m.chatName } : undefined),
    };
  }

  // Grupos conhecidos (pra pickers de broadcast/agendamento), com o número de cada um.
  async groups(orgId: string, sess: SessionWhere = {}) {
    if (sess === null) return [];
    const rows = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, kind: 'group', ...sess }, orderBy: { name: 'asc' } });
    const smap = await this.presenter.sessionMap(orgId);
    return rows.map((c) => ({ chat_id: c.id, jid: c.chat_id, session_id: c.session_id, session: smap.get(c.session_id) || null, name: c.name || (c.group_meta as any)?.subject || c.chat_id, participants_count: (c.group_meta as any)?.participants_count ?? null }));
  }

  // Sincroniza a lista de chats/grupos de UM número com o gateway (1× ao conectar e sob demanda).
  async syncChats(orgId: string, session: any) {
    const row = typeof session === 'string' ? await this.sessions.requireReady(orgId, session) : session;
    if (!row?.openwa_session_id || row.status !== 'ready') throw new BadRequestException('Conecte o WhatsApp primeiro.');
    let list: any[] = [];
    try { list = await this.openwa.listChats(row.openwa_session_id!, 1000, 0); } catch (e) { this.translate(e); }
    let n = 0;
    const key = (jid: string) => ({ organization_id_session_id_chat_id: { organization_id: orgId, session_id: row.id, chat_id: jid } });
    for (const c of Array.isArray(list) ? list : []) {
      const chatId = String(c?.id || '');
      if (!chatId || chatId === 'status@broadcast') continue;
      const kind = c?.kind && c.kind !== 'unknown' ? String(c.kind) : c?.isGroup ? 'group' : 'individual';
      const at = c?.timestamp ? new Date(Number(c.timestamp) * 1000) : null;
      const existing = await this.prisma.whatsapp_chats.findUnique({ where: key(chatId) });
      // o gateway devolve o próprio id (lid/telefone) como "nome" quando não conhece a pessoa — isso não é nome
      const gwName = c?.name && !isIdLikeName(c.name) ? String(c.name).slice(0, 255) : null;
      await this.prisma.whatsapp_chats.upsert({
        where: key(chatId),
        create: { organization_id: orgId, session_id: row.id, chat_id: chatId, kind, name: gwName, unread_count: row.engine === 'baileys' ? 0 : Number(c?.unreadCount || 0), last_message_at: at, last_message_preview: c?.lastMessage ? String(c.lastMessage).slice(0, 255) : null, archived: Boolean(c?.archived), pinned: Boolean(c?.pinned), muted: Boolean(c?.muted), synced_at: new Date() },
        update: { kind, ...(gwName ? { name: gwName } : {}), archived: Boolean(c?.archived), pinned: Boolean(c?.pinned), muted: Boolean(c?.muted), synced_at: new Date(), ...(!existing?.last_message_at && at ? { last_message_at: at, last_message_preview: c?.lastMessage ? String(c.lastMessage).slice(0, 255) : null } : {}) },
      });
      if (kind === 'individual' && gwName) await this.contacts.touch(orgId, row, chatId, { name: gwName, at: at || undefined }).catch(() => undefined);
      n++;
    }
    return { synced: n, session_id: row.id, label: sessionLabel(row) };
  }
}
