import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppHooks, InboundEvent, ServiceClosedEvent } from './whatsapp-hooks.service';
import { WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppSystemSender } from './whatsapp-system-send.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { isGroupJid } from './wa-jid.util';

// ============================================================================
// Satisfação (fase 4 do CRM): ao ENCERRAR um atendimento humano pelo painel, o sistema
// pergunta "De 1 a 5…" (configurável em Configurações → Atendimento). A próxima
// mensagem do cliente que começar com 1–5 vira a nota (o resto vira comentário);
// a pergunta vale por `rating.hours` horas. A resposta é consumida (o bot não a vê).
// ============================================================================

type Pending = { ratingId: string; until: number };

@Injectable()
export class WhatsAppRatingsService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppRatingsService.name);
  private readonly pending = new Map<string, Pending>(); // `${org}:${chat}`
  constructor(private readonly prisma: PrismaService, private readonly hooks: WhatsAppHooks, private readonly attendance: WhatsAppAttendanceService, private readonly sender: WhatsAppSystemSender, private readonly presenter: WhatsAppPresenter) {}

  async onModuleInit() {
    this.hooks.onServiceClosed((e) => this.ask(e));
    this.hooks.onInboundFilter((e) => this.capture(e));
    // perguntas ainda abertas (deploy/restart no meio)
    const rows = await this.prisma.whatsapp_ratings.findMany({ where: { answered_at: null, asked_at: { gte: new Date(Date.now() - 72 * 3600_000) } }, orderBy: { asked_at: 'desc' } }).catch(() => []);
    for (const r of rows) {
      const key = `${r.organization_id}:${r.chat_id}`;
      if (!this.pending.has(key)) this.pending.set(key, { ratingId: r.id, until: new Date(r.asked_at).getTime() + 72 * 3600_000 });
    }
  }

  // ---------------------------------------------------------------- pergunta
  private async ask(e: ServiceClosedEvent) {
    if (isGroupJid(e.chatId)) return;
    const s = await this.attendance.settings(e.orgId);
    if (!s.rating?.enabled) return;
    // não repete a pesquisa para a mesma conversa em menos de 24 h
    const recent = await this.prisma.whatsapp_ratings.findFirst({ where: { organization_id: e.orgId, chat_id: e.chatId, asked_at: { gte: new Date(Date.now() - 24 * 3600_000) } } });
    if (recent) return;
    const sent = await this.sender.text(e.orgId, e.chatId, s.rating.question, { rating: true });
    if (!sent) return;
    const row = await this.prisma.whatsapp_ratings.create({ data: { organization_id: e.orgId, chat_id: e.chatId, user_id: e.assignedUserId || e.userId || null } });
    this.pending.set(`${e.orgId}:${e.chatId}`, { ratingId: row.id, until: Date.now() + Math.max(1, s.rating.hours) * 3600_000 });
    await this.attendance.event(e.orgId, e.chatId, 'rating_asked', null, { rating_id: row.id });
  }

  // ---------------------------------------------------------------- resposta
  /** Filtro síncrono: devolve true quando a mensagem é a nota (consumida). */
  private capture(e: InboundEvent): boolean {
    const key = `${e.orgId}:${e.chatId}`;
    const p = this.pending.get(key);
    if (!p) return false;
    if (p.until < Date.now()) { this.pending.delete(key); return false; }
    const body = String(e.message?.body || '').trim();
    const m = /^\s*(?:nota\s*)?([1-5])(?:\s*(?:\/|de)\s*5)?\b[\s\S]{0,400}$/i.exec(body);
    if (!m) return false;
    this.pending.delete(key);
    const score = Number(m[1]);
    const comment = body.replace(/^\s*(?:nota\s*)?[1-5](?:\s*(?:\/|de)\s*5)?\s*[-–—:,.]?\s*/i, '').trim().slice(0, 1000) || null;
    void this.save(e.orgId, e.chatId, p.ratingId, score, comment);
    return true;
  }

  private async save(orgId: string, chatId: string, ratingId: string, score: number, comment: string | null) {
    try {
      const row = await this.prisma.whatsapp_ratings.update({ where: { id: ratingId }, data: { score, comment, answered_at: new Date() } });
      await this.attendance.event(orgId, chatId, 'rated', null, { score, comment, rating_id: row.id, user_id: row.user_id });
      const s = await this.attendance.settings(orgId);
      if (s.rating?.thanks) await this.sender.text(orgId, chatId, s.rating.thanks, { rating_thanks: true });
      this.presenter.emit(orgId, 'wa:rating', { chat_id: chatId, score, comment, user_id: row.user_id });
      this.presenter.chat(orgId, chatId);
    } catch (e: any) {
      this.logger.warn(`salvar avaliação: ${e?.message || e}`);
    }
  }

  // ---------------------------------------------------------------- consultas
  async list(orgId: string, q: any = {}) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(10, parseInt(String(q.page_size || 50), 10) || 50));
    const where: any = { organization_id: orgId, answered_at: { not: null } };
    if (q.user_id) where.user_id = String(q.user_id);
    if (q.chat_id) where.chat_id = String(q.chat_id);
    if (q.score) where.score = parseInt(String(q.score), 10) || undefined;
    if (q.from || q.to) where.answered_at = { ...where.answered_at, ...(q.from ? { gte: new Date(String(q.from)) } : {}), ...(q.to ? { lte: new Date(String(q.to)) } : {}) };
    const [total, rows] = await Promise.all([this.prisma.whatsapp_ratings.count({ where }), this.prisma.whatsapp_ratings.findMany({ where, orderBy: { answered_at: 'desc' }, skip: (page - 1) * size, take: size })]);
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])];
    const users = userIds.length ? await this.prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
    const names = new Map(users.map((u) => [u.id, u.name || u.email]));
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, chat_id: { in: [...new Set(rows.map((r) => r.chat_id))] } } });
    const shaped = await this.presenter.shapeChats(orgId, chats);
    const cmap = new Map(shaped.map((c: any) => [c.chat_id, { chat_id: c.chat_id, name: c.name, phone: c.phone }]));
    return { items: rows.map((r) => ({ id: r.id, chat: cmap.get(r.chat_id) || { chat_id: r.chat_id, name: null }, user: r.user_id ? { id: r.user_id, name: names.get(r.user_id) || null } : null, score: r.score, comment: r.comment, asked_at: r.asked_at, answered_at: r.answered_at })), total, page, pages: Math.max(1, Math.ceil(total / size)) };
  }
}
