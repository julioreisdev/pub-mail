import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { ChatKey, WhatsAppAttendanceService } from './whatsapp-attendance.service';

// ============================================================================
// Tarefas da equipe (fase 3 do CRM): título, prazo, responsável, conversa/cliente.
// Lembrete: quando o prazo chega, o runner (1×/min) manda `wa:task_due` pelo WebSocket
// (o painel mostra um aviso para o responsável). Nada é enviado ao WhatsApp.
//
// Multi-número: a tarefa guarda a conversa como (session_id, jid); a API recebe/devolve o
// uuid da conversa (`chat.chat_id`) + `chat.session`. Tarefas sem conversa aparecem para todos.
// ============================================================================

const BRT = 'America/Sao_Paulo';

@Injectable()
export class WhatsAppTasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppTasksService.name);
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly prisma: PrismaService, private readonly presenter: WhatsAppPresenter, private readonly attendance: WhatsAppAttendanceService) {}

  onModuleInit() { this.timer = setInterval(() => this.remindDue().catch((e) => this.logger.warn(`lembretes: ${e?.message || e}`)), 60_000); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  // ---------------------------------------------------------------- shape
  private async names(ids: (string | null | undefined)[]) {
    const uniq = [...new Set(ids.filter(Boolean) as string[])];
    if (!uniq.length) return new Map<string, string>();
    const users = await this.prisma.users.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true, email: true } });
    return new Map(users.map((u) => [u.id, u.name || u.email]));
  }

  private static chatKey(sessionId: string | null | undefined, jid: string) {
    return `${sessionId || ''}|${jid}`;
  }

  /** Conversas das tarefas (por número + jid) no formato público: { chat_id (uuid), jid, session_id, session, name, phone, kind }. */
  private async chatInfo(orgId: string, rows: any[]) {
    const pairs = new Map<string, { session_id: string | null; chat_id: string }>();
    for (const r of rows) if (r.chat_id) pairs.set(WhatsAppTasksService.chatKey(r.session_id, r.chat_id), { session_id: r.session_id || null, chat_id: r.chat_id });
    if (!pairs.size) return new Map<string, any>();
    const or = [...pairs.values()].map((p) => (p.session_id ? { session_id: p.session_id, chat_id: p.chat_id } : { chat_id: p.chat_id }));
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, OR: or } });
    const shaped = await this.presenter.shapeChats(orgId, chats);
    const map = new Map<string, any>();
    for (const c of shaped as any[]) {
      const info = { chat_id: c.chat_id, jid: c.jid, session_id: c.session_id, session: c.session, name: c.name, phone: c.phone, kind: c.kind };
      map.set(WhatsAppTasksService.chatKey(c.session_id, c.jid), info);
      if (!map.has(WhatsAppTasksService.chatKey(null, c.jid))) map.set(WhatsAppTasksService.chatKey(null, c.jid), info); // tarefa antiga sem número
    }
    return map;
  }

  private shape(t: any, names: Map<string, string>, chats: Map<string, any>) {
    const now = Date.now();
    const due = t.due_at ? new Date(t.due_at).getTime() : null;
    const chat = t.chat_id ? chats.get(WhatsAppTasksService.chatKey(t.session_id, t.chat_id)) || chats.get(WhatsAppTasksService.chatKey(null, t.chat_id)) || { chat_id: null, jid: t.chat_id, session_id: t.session_id || null, session: null, name: null, phone: null, kind: null } : null;
    return {
      id: t.id, title: t.title, description: t.description || '', due_at: t.due_at, done_at: t.done_at, done: Boolean(t.done_at),
      overdue: Boolean(!t.done_at && due && due < now),
      due_today: Boolean(!t.done_at && due && new Intl.DateTimeFormat('en-CA', { timeZone: BRT }).format(new Date(due)) === new Intl.DateTimeFormat('en-CA', { timeZone: BRT }).format(new Date())),
      assigned_user: t.assigned_user_id ? { id: t.assigned_user_id, name: names.get(t.assigned_user_id) || null } : null,
      created_by: t.created_by ? { id: t.created_by, name: names.get(t.created_by) || null } : null,
      done_by: t.done_by ? { id: t.done_by, name: names.get(t.done_by) || null } : null,
      session_id: t.session_id || null,
      chat,
      customer_id: t.customer_id || null,
      created_at: t.created_at, updated_at: t.updated_at,
    };
  }

  private async shapeMany(orgId: string, rows: any[]) {
    const [names, chats] = await Promise.all([this.names(rows.flatMap((r) => [r.assigned_user_id, r.created_by, r.done_by])), this.chatInfo(orgId, rows)]);
    return rows.map((r) => this.shape(r, names, chats));
  }

  async shapeOne(orgId: string, row: any) { return (await this.shapeMany(orgId, [row]))[0]; }

  /** Linha da conversa pelo uuid (404 se não for da org). */
  private chatRow(orgId: string, chatUuid: string) {
    return this.attendance.chatRow(orgId, chatUuid);
  }

  /** Tarefas sem conversa aparecem para todos; com conversa, só as dos números permitidos. */
  private allowedClause(allowed: Set<string> | null) {
    if (allowed === null) return null;
    return { OR: [{ session_id: null }, { session_id: { in: [...allowed] } }] };
  }

  // ---------------------------------------------------------------- consultas
  /** scope: mine|all · status: open|done|overdue|today|all · chat_id (uuid) · session_id · customer_id */
  async list(orgId: string, userId: string | null, q: any = {}, allowed: Set<string> | null = null) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(10, parseInt(String(q.page_size || 50), 10) || 50));
    const empty = { items: [] as any[], total: 0, page, pages: 1 };
    const where: any = { organization_id: orgId };
    const and: any[] = [];
    const scope = String(q.scope || 'all');
    if (scope === 'mine' && userId) and.push({ OR: [{ assigned_user_id: userId }, { assigned_user_id: null, created_by: userId }] });
    else if (scope === 'unassigned') where.assigned_user_id = null;
    else if (scope && scope !== 'all' && scope !== 'mine') where.assigned_user_id = scope;
    const status = String(q.status || 'open');
    const now = new Date();
    if (status === 'open') where.done_at = null;
    else if (status === 'done') where.done_at = { not: null };
    else if (status === 'overdue') { where.done_at = null; where.due_at = { lt: now }; }
    else if (status === 'today') {
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: BRT }).format(now);
      where.done_at = null; where.due_at = { gte: new Date(`${d}T00:00:00-03:00`), lte: new Date(`${d}T23:59:59.999-03:00`) };
    }
    if (q.chat_id) {
      const chat = await this.prisma.whatsapp_chats.findFirst({ where: { id: String(q.chat_id), organization_id: orgId }, select: { session_id: true, chat_id: true } });
      if (!chat || (allowed !== null && !allowed.has(chat.session_id))) return empty;
      where.chat_id = chat.chat_id;
      and.push({ OR: [{ session_id: chat.session_id }, { session_id: null }] }); // tarefa antiga sem número
    } else if (q.session_id) {
      const sid = String(q.session_id);
      if (allowed !== null && !allowed.has(sid)) return empty;
      where.session_id = sid;
    } else {
      const ac = this.allowedClause(allowed);
      if (ac) and.push(ac);
    }
    if (q.customer_id) where.customer_id = String(q.customer_id);
    if (q.q) where.title = { contains: String(q.q).trim() };
    if (and.length) where.AND = and;
    const orderBy: any[] = status === 'done' ? [{ done_at: 'desc' }] : [{ due_at: 'asc' }, { created_at: 'desc' }];
    const [total, rows] = await Promise.all([this.prisma.whatsapp_tasks.count({ where }), this.prisma.whatsapp_tasks.findMany({ where, orderBy, skip: (page - 1) * size, take: size })]);
    return { items: await this.shapeMany(orgId, rows), total, page, pages: Math.max(1, Math.ceil(total / size)) };
  }

  async counts(orgId: string, userId: string | null, allowed: Set<string> | null = null, sessionId: string | null = null) {
    const now = new Date();
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: BRT }).format(now);
    const today = { gte: new Date(`${d}T00:00:00-03:00`), lte: new Date(`${d}T23:59:59.999-03:00`) };
    const mine = userId ? { OR: [{ assigned_user_id: userId }, { assigned_user_id: null, created_by: userId }] } : {};
    const ac = this.allowedClause(allowed);
    const base: any = { organization_id: orgId, done_at: null, ...(ac ? { AND: [ac] } : {}), ...(sessionId ? { session_id: String(sessionId) } : {}) };
    const [open, overdue, todayN, mineOpen, mineOverdue, mineToday] = await Promise.all([
      this.prisma.whatsapp_tasks.count({ where: base }),
      this.prisma.whatsapp_tasks.count({ where: { ...base, due_at: { lt: now } } }),
      this.prisma.whatsapp_tasks.count({ where: { ...base, due_at: today } }),
      this.prisma.whatsapp_tasks.count({ where: { ...base, ...mine } }),
      this.prisma.whatsapp_tasks.count({ where: { ...base, ...mine, due_at: { lt: now } } }),
      this.prisma.whatsapp_tasks.count({ where: { ...base, ...mine, due_at: today } }),
    ]);
    return { open, overdue, today: todayN, mine: { open: mineOpen, overdue: mineOverdue, today: mineToday } };
  }

  // ---------------------------------------------------------------- escrita
  private parseDue(v: any): Date | null | undefined {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Prazo inválido.');
    return d;
  }

  private async assertUser(orgId: string, id: string | null | undefined) {
    if (!id) return null;
    const u = await this.prisma.users.findFirst({ where: { id: String(id), organization_id: orgId, active: true }, select: { id: true } });
    if (!u) throw new BadRequestException('Responsável inválido.');
    return u.id;
  }

  /** `dto.chat_id` = uuid da conversa (convertido para número + jid). */
  async create(orgId: string, userId: string | null, dto: any, opts: { silentEvent?: boolean; source?: string } = {}) {
    const title = String(dto?.title || '').trim();
    if (!title) throw new BadRequestException('Dê um título à tarefa.');
    const assigned = await this.assertUser(orgId, dto?.assigned_user_id);
    const chat = dto?.chat_id ? await this.chatRow(orgId, String(dto.chat_id)) : null;
    const row = await this.prisma.whatsapp_tasks.create({
      data: { organization_id: orgId, title: title.slice(0, 160), description: dto?.description ? String(dto.description).slice(0, 4000) : null, due_at: this.parseDue(dto?.due_at) ?? null, assigned_user_id: assigned, session_id: chat?.session_id ?? null, chat_id: chat?.chat_id ?? null, customer_id: dto?.customer_id ? String(dto.customer_id) : null, created_by: userId },
    });
    const shaped = await this.shapeOne(orgId, row);
    if (chat && !opts.silentEvent) await this.attendance.event(orgId, { session_id: chat.session_id, chat_id: chat.chat_id }, 'task_created', userId, { task_id: row.id, title: row.title, due_at: row.due_at, source: opts.source || 'manual' });
    this.presenter.emit(orgId, 'wa:task', { action: 'created', task: shaped });
    return shaped;
  }

  async update(orgId: string, userId: string | null, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_tasks.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Tarefa não encontrada.');
    const data: any = {};
    if (dto?.title !== undefined) { const t = String(dto.title || '').trim(); if (!t) throw new BadRequestException('Dê um título à tarefa.'); data.title = t.slice(0, 160); }
    if (dto?.description !== undefined) data.description = dto.description ? String(dto.description).slice(0, 4000) : null;
    const due = this.parseDue(dto?.due_at);
    if (due !== undefined) { data.due_at = due; if (!cur.done_at) data.reminded_at = null; }
    if (dto?.assigned_user_id !== undefined) data.assigned_user_id = await this.assertUser(orgId, dto.assigned_user_id);
    if (dto?.chat_id !== undefined) {
      if (dto.chat_id) { const chat = await this.chatRow(orgId, String(dto.chat_id)); data.session_id = chat.session_id; data.chat_id = chat.chat_id; }
      else { data.session_id = null; data.chat_id = null; }
    }
    if (dto?.customer_id !== undefined) data.customer_id = dto.customer_id ? String(dto.customer_id) : null;
    const row = await this.prisma.whatsapp_tasks.update({ where: { id }, data });
    const shaped = await this.shapeOne(orgId, row);
    this.presenter.emit(orgId, 'wa:task', { action: 'updated', task: shaped, by: userId });
    return shaped;
  }

  /** Número da tarefa (para o controller conferir o acesso); null = tarefa sem conversa. */
  async sessionOf(orgId: string, id: string) {
    const cur = await this.prisma.whatsapp_tasks.findFirst({ where: { id, organization_id: orgId }, select: { session_id: true } });
    if (!cur) throw new NotFoundException('Tarefa não encontrada.');
    return cur.session_id;
  }

  async setDone(orgId: string, userId: string | null, id: string, done: boolean) {
    const cur = await this.prisma.whatsapp_tasks.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Tarefa não encontrada.');
    const row = await this.prisma.whatsapp_tasks.update({ where: { id }, data: done ? { done_at: new Date(), done_by: userId } : { done_at: null, done_by: null, reminded_at: null } });
    if (cur.chat_id && cur.session_id && done) {
      const key: ChatKey = { session_id: cur.session_id, chat_id: cur.chat_id };
      await this.attendance.event(orgId, key, 'task_done', userId, { task_id: row.id, title: row.title });
    }
    const shaped = await this.shapeOne(orgId, row);
    this.presenter.emit(orgId, 'wa:task', { action: done ? 'done' : 'reopened', task: shaped, by: userId });
    return shaped;
  }

  async remove(orgId: string, id: string) {
    const cur = await this.prisma.whatsapp_tasks.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Tarefa não encontrada.');
    await this.prisma.whatsapp_tasks.delete({ where: { id } });
    this.presenter.emit(orgId, 'wa:task', { action: 'deleted', task: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------- lembretes
  /** Tarefas cujo prazo chegou (até 1 h atrás, para não avisar coisa velha após deploy) e ainda sem aviso. */
  async remindDue() {
    const now = new Date();
    const rows = await this.prisma.whatsapp_tasks.findMany({ where: { done_at: null, reminded_at: null, due_at: { lte: now, gte: new Date(now.getTime() - 3600_000) } }, take: 200 });
    if (!rows.length) return 0;
    const byOrg = new Map<string, any[]>();
    for (const r of rows) byOrg.set(r.organization_id, [...(byOrg.get(r.organization_id) || []), r]);
    for (const [orgId, list] of byOrg) {
      const shaped = await this.shapeMany(orgId, list);
      for (const t of shaped) this.presenter.emit(orgId, 'wa:task_due', { task: t });
    }
    await this.prisma.whatsapp_tasks.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { reminded_at: now } });
    return rows.length;
  }
}
