import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppHooks, InboundEvent, ServiceClosedEvent } from './whatsapp-hooks.service';
import { ChatKey, WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppSystemSender } from './whatsapp-system-send.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { isGroupJid } from './wa-jid.util';

// ============================================================================
// Satisfação (fase 4 do CRM): ao ENCERRAR um atendimento humano pelo painel, o sistema
// pergunta "De 1 a 5…" (configurável em Configurações → Atendimento). A próxima
// mensagem do cliente que começar com 1–5 vira a nota (o resto vira comentário);
// a pergunta vale por `rating.hours` horas. A resposta é consumida (o bot não a vê).
//
// Multi-número: a pendência é por (org, número, jid) — a mesma pessoa pode ter atendimentos
// em dois números; a pergunta e o agradecimento saem pelo número da conversa.
// ============================================================================

type Pending = { ratingId: string; until: number };

@Injectable()
export class WhatsAppRatingsService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppRatingsService.name);
  private readonly pending = new Map<string, Pending>(); // `${org}:${sessionId}:${jid}`
  constructor(private readonly prisma: PrismaService, private readonly hooks: WhatsAppHooks, private readonly attendance: WhatsAppAttendanceService, private readonly sender: WhatsAppSystemSender, private readonly presenter: WhatsAppPresenter) {}

  private static key(orgId: string, sessionId: string | null | undefined, jid: string) {
    return `${orgId}:${sessionId || ''}:${jid}`;
  }

  async onModuleInit() {
    this.hooks.onServiceClosed((e) => this.ask(e));
    this.hooks.onInboundFilter((e) => this.capture(e));
    // perguntas ainda abertas (deploy/restart no meio)
    const rows = await this.prisma.whatsapp_ratings.findMany({ where: { answered_at: null, asked_at: { gte: new Date(Date.now() - 72 * 3600_000) } }, orderBy: { asked_at: 'desc' } }).catch(() => []);
    for (const r of rows) {
      if (!r.session_id) continue; // pergunta antiga sem número: não dá para casar a resposta
      const key = WhatsAppRatingsService.key(r.organization_id, r.session_id, r.chat_id);
      if (!this.pending.has(key)) this.pending.set(key, { ratingId: r.id, until: new Date(r.asked_at).getTime() + 72 * 3600_000 });
    }
  }

  // ---------------------------------------------------------------- pergunta
  private async ask(e: ServiceClosedEvent) {
    if (isGroupJid(e.chatId) || !e.sessionId) return;
    const s = await this.attendance.settings(e.orgId);
    if (!s.rating?.enabled) return;
    const k: ChatKey = { session_id: e.sessionId, chat_id: e.chatId };
    // não repete a pesquisa para a mesma conversa em menos de 24 h
    const recent = await this.prisma.whatsapp_ratings.findFirst({ where: { organization_id: e.orgId, session_id: e.sessionId, chat_id: e.chatId, asked_at: { gte: new Date(Date.now() - 24 * 3600_000) } } });
    if (recent) return;
    const sent = await this.sender.text(e.orgId, e.sessionId, e.chatId, s.rating.question, { rating: true });
    if (!sent) return;
    const row = await this.prisma.whatsapp_ratings.create({ data: { organization_id: e.orgId, session_id: e.sessionId, chat_id: e.chatId, user_id: e.assignedUserId || e.userId || null } });
    this.pending.set(WhatsAppRatingsService.key(e.orgId, e.sessionId, e.chatId), { ratingId: row.id, until: Date.now() + Math.max(1, s.rating.hours) * 3600_000 });
    await this.attendance.event(e.orgId, k, 'rating_asked', null, { rating_id: row.id });
  }

  // ---------------------------------------------------------------- resposta
  /** Filtro síncrono: devolve true quando a mensagem é a nota (consumida). */
  private capture(e: InboundEvent): boolean {
    const key = WhatsAppRatingsService.key(e.orgId, e.sessionId, e.chatId);
    const p = this.pending.get(key);
    if (!p) return false;
    if (p.until < Date.now()) { this.pending.delete(key); return false; }
    const body = String(e.message?.body || '').trim();
    const m = /^\s*(?:nota\s*)?([1-5])(?:\s*(?:\/|de)\s*5)?\b[\s\S]{0,400}$/i.exec(body);
    if (!m) return false;
    this.pending.delete(key);
    const score = Number(m[1]);
    const comment = body.replace(/^\s*(?:nota\s*)?[1-5](?:\s*(?:\/|de)\s*5)?\s*[-–—:,.]?\s*/i, '').trim().slice(0, 1000) || null;
    void this.save(e.orgId, { session_id: e.sessionId, chat_id: e.chatId }, p.ratingId, score, comment);
    return true;
  }

  private async save(orgId: string, k: ChatKey, ratingId: string, score: number, comment: string | null) {
    try {
      const row = await this.prisma.whatsapp_ratings.update({ where: { id: ratingId }, data: { score, comment, answered_at: new Date() } });
      await this.attendance.event(orgId, k, 'rated', null, { score, comment, rating_id: row.id, user_id: row.user_id });
      const s = await this.attendance.settings(orgId);
      if (s.rating?.thanks) await this.sender.text(orgId, k.session_id, k.chat_id, s.rating.thanks, { rating_thanks: true });
      const chatUuid = await this.presenter.chatUuid(orgId, k.session_id, k.chat_id);
      this.presenter.emit(orgId, 'wa:rating', { chat_id: chatUuid, session_id: k.session_id, jid: k.chat_id, score, comment, user_id: row.user_id });
      this.presenter.chat(orgId, k.session_id, k.chat_id);
    } catch (e: any) {
      this.logger.warn(`salvar avaliação: ${e?.message || e}`);
    }
  }

  // ---------------------------------------------------------------- consultas
  /** `q.chat_id` = uuid da conversa · `q.session_id` = número · `allowed` = números do usuário (null = todos). */
  async list(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(10, parseInt(String(q.page_size || 50), 10) || 50));
    const empty = { items: [] as any[], total: 0, page, pages: 1 };
    const where: any = { organization_id: orgId, answered_at: { not: null } };
    if (q.user_id) where.user_id = String(q.user_id);
    if (q.chat_id) {
      const chat = await this.prisma.whatsapp_chats.findFirst({ where: { id: String(q.chat_id), organization_id: orgId }, select: { session_id: true, chat_id: true } });
      if (!chat || (allowed !== null && !allowed.has(chat.session_id))) return empty;
      where.session_id = chat.session_id;
      where.chat_id = chat.chat_id;
    } else if (q.session_id) {
      const sid = String(q.session_id);
      if (allowed !== null && !allowed.has(sid)) return empty;
      where.session_id = sid;
    } else if (allowed !== null) {
      if (!allowed.size) return empty;
      where.session_id = { in: [...allowed] };
    }
    if (q.score) where.score = parseInt(String(q.score), 10) || undefined;
    if (q.from || q.to) where.answered_at = { ...where.answered_at, ...(q.from ? { gte: new Date(String(q.from)) } : {}), ...(q.to ? { lte: new Date(String(q.to)) } : {}) };
    const [total, rows] = await Promise.all([this.prisma.whatsapp_ratings.count({ where }), this.prisma.whatsapp_ratings.findMany({ where, orderBy: { answered_at: 'desc' }, skip: (page - 1) * size, take: size })]);
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])];
    const users = userIds.length ? await this.prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
    const names = new Map(users.map((u) => [u.id, u.name || u.email]));
    // conversas (uma por número + jid) no formato público
    const pairs = new Map<string, any>();
    for (const r of rows) pairs.set(`${r.session_id || ''}|${r.chat_id}`, r.session_id ? { session_id: r.session_id, chat_id: r.chat_id } : { chat_id: r.chat_id });
    const chats = pairs.size ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, OR: [...pairs.values()] } }) : [];
    const shaped = await this.presenter.shapeChats(orgId, chats);
    const cmap = new Map<string, any>();
    for (const c of shaped as any[]) {
      const info = { chat_id: c.chat_id, jid: c.jid, session_id: c.session_id, session: c.session, name: c.name, phone: c.phone };
      cmap.set(`${c.session_id}|${c.jid}`, info);
      if (!cmap.has(`|${c.jid}`)) cmap.set(`|${c.jid}`, info);
    }
    return {
      items: rows.map((r) => ({
        id: r.id,
        chat: cmap.get(`${r.session_id || ''}|${r.chat_id}`) || cmap.get(`|${r.chat_id}`) || { chat_id: null, jid: r.chat_id, session_id: r.session_id || null, session: null, name: null, phone: null },
        session_id: r.session_id || null,
        user: r.user_id ? { id: r.user_id, name: names.get(r.user_id) || null } : null,
        score: r.score, comment: r.comment, asked_at: r.asked_at, answered_at: r.answered_at,
      })),
      total, page, pages: Math.max(1, Math.ceil(total / size)),
    };
  }
}
