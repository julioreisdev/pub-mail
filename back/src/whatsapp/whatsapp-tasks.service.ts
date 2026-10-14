import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';
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

// Quadro estilo Trello (14/10/2026): colunas da conta (`whatsapp_task_lists`), posição fracionária do cartão
// (`position`, DOUBLE: entre dois vizinhos = média; sem folga = renumera a coluna), etiquetas da conta
// (`whatsapp_task_labels`, ids em `label_ids`), checklist e cor de capa. A coluna marcada `is_done` = concluídas:
// soltar nela conclui; tirar dela reabre; o checkbox "Concluir" move para ela (e "Reabrir" volta para a 1ª aberta).
const STEP = 1024;
const DONE_TAKE = 60; // cartões por coluna de concluídas no quadro (as mais recentes no topo)
const OPEN_TAKE = 3000;
const MAX_LISTS = 30;
const MAX_LABELS = 30;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_LISTS = [
  { name: 'A fazer', color: '#64748b', is_done: false },
  { name: 'Fazendo', color: '#377ef0', is_done: false },
  { name: 'Concluído', color: '#22c55e', is_done: true },
];
const DEFAULT_LABELS = [
  { name: 'Urgente', color: '#f87168' },
  { name: 'Importante', color: '#fea362' },
  { name: 'Aguardando cliente', color: '#f5cd47' },
  { name: 'Financeiro', color: '#4bce97' },
  { name: 'Suporte', color: '#579dff' },
  { name: 'Venda', color: '#9f8fef' },
];

@Injectable()
export class WhatsAppTasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppTasksService.name);
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly prisma: PrismaService, private readonly presenter: WhatsAppPresenter, private readonly attendance: WhatsAppAttendanceService, private readonly hooks: WhatsAppHooks) {}

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
      list_id: t.list_id || null,
      position: Number(t.position || 0),
      label_ids: Array.isArray(t.label_ids) ? t.label_ids : [],
      checklist: Array.isArray(t.checklist) ? t.checklist : [],
      cover: t.cover || null,
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
  /** Filtro comum da lista e do quadro (responsável, conversa/número, cliente, busca). null = nada a mostrar. */
  private async baseWhere(orgId: string, userId: string | null, q: any, allowed: Set<string> | null): Promise<any | null> {
    const where: any = { organization_id: orgId };
    const and: any[] = [];
    const scope = String(q.scope || 'all');
    if (scope === 'mine' && userId) and.push({ OR: [{ assigned_user_id: userId }, { assigned_user_id: null, created_by: userId }] });
    else if (scope === 'unassigned') where.assigned_user_id = null;
    else if (scope && scope !== 'all' && scope !== 'mine') where.assigned_user_id = scope;
    if (q.chat_id) {
      const chat = await this.prisma.whatsapp_chats.findFirst({ where: { id: String(q.chat_id), organization_id: orgId }, select: { session_id: true, chat_id: true } });
      if (!chat || (allowed !== null && !allowed.has(chat.session_id))) return null;
      where.chat_id = chat.chat_id;
      and.push({ OR: [{ session_id: chat.session_id }, { session_id: null }] });
    } else if (q.session_id) {
      const sid = String(q.session_id);
      if (allowed !== null && !allowed.has(sid)) return null;
      where.session_id = sid;
    } else {
      const ac = this.allowedClause(allowed);
      if (ac) and.push(ac);
    }
    if (q.customer_id) where.customer_id = String(q.customer_id);
    if (q.q) and.push({ OR: [{ title: { contains: String(q.q).trim() } }, { description: { contains: String(q.q).trim() } }] });
    if (and.length) where.AND = and;
    return where;
  }

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
    await this.ensureBoard(orgId);
    const lists = await this.listRows(orgId);
    const list = dto?.list_id ? lists.find((l) => l.id === String(dto.list_id)) : lists.find((l) => !l.is_done) || lists[0];
    if (dto?.list_id && !list) throw new BadRequestException('Coluna não encontrada.');
    const isDone = Boolean(list?.is_done);
    const row = await this.prisma.whatsapp_tasks.create({
      data: {
        organization_id: orgId, title: title.slice(0, 160), description: dto?.description ? String(dto.description).slice(0, 4000) : null, due_at: this.parseDue(dto?.due_at) ?? null, assigned_user_id: assigned, session_id: chat?.session_id ?? null, chat_id: chat?.chat_id ?? null, customer_id: dto?.customer_id ? String(dto.customer_id) : null, created_by: userId,
        list_id: list?.id ?? null,
        position: list ? await this.edgePosition(orgId, list.id, isDone ? 'top' : 'bottom') : 0,
        label_ids: dto?.label_ids !== undefined ? await this.cleanLabels(orgId, dto.label_ids) : undefined,
        checklist: dto?.checklist !== undefined ? this.cleanChecklist(dto.checklist) : undefined,
        cover: dto?.cover !== undefined ? this.cleanColor(dto.cover) : undefined,
        ...(isDone ? { done_at: new Date(), done_by: userId } : {}),
      },
    });
    const shaped = await this.shapeOne(orgId, row);
    if (chat && !opts.silentEvent) await this.attendance.event(orgId, { session_id: chat.session_id, chat_id: chat.chat_id }, 'task_created', userId, { task_id: row.id, title: row.title, due_at: row.due_at, source: opts.source || 'manual' });
    this.presenter.emit(orgId, 'wa:task', { action: 'created', task: shaped });
    if (shaped?.assigned_user?.id && shaped.assigned_user.id !== userId) this.hooks.emit('task_assigned', { orgId, task: shaped, by: userId });
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
    if (dto?.label_ids !== undefined) data.label_ids = await this.cleanLabels(orgId, dto.label_ids);
    if (dto?.checklist !== undefined) data.checklist = this.cleanChecklist(dto.checklist);
    if (dto?.cover !== undefined) data.cover = this.cleanColor(dto.cover);
    if (dto?.list_id && dto.list_id !== cur.list_id) {
      if (Object.keys(data).length) await this.prisma.whatsapp_tasks.update({ where: { id }, data });
      return this.move(orgId, userId, id, { list_id: String(dto.list_id) });
    }
    const row = await this.prisma.whatsapp_tasks.update({ where: { id }, data });
    const shaped = await this.shapeOne(orgId, row);
    this.presenter.emit(orgId, 'wa:task', { action: 'updated', task: shaped, by: userId });
    if (data.assigned_user_id && data.assigned_user_id !== cur.assigned_user_id && data.assigned_user_id !== userId) this.hooks.emit('task_assigned', { orgId, task: shaped, by: userId });
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
    await this.ensureBoard(orgId);
    const lists = await this.listRows(orgId);
    const curList = lists.find((l) => l.id === cur.list_id);
    const target = done ? (curList?.is_done ? null : lists.find((l) => l.is_done)) : curList?.is_done ? lists.find((l) => !l.is_done) : null;
    const move = target ? { list_id: target.id, position: await this.edgePosition(orgId, target.id, done ? 'top' : 'bottom') } : {};
    const row = await this.prisma.whatsapp_tasks.update({ where: { id }, data: { ...(done ? { done_at: new Date(), done_by: userId } : { done_at: null, done_by: null, reminded_at: null }), ...move } });
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

  // ---------------------------------------------------------------- quadro (Trello)
  private readonly boardReady = new Map<string, Promise<void>>();

  /** Cria as colunas/etiquetas padrão na 1ª leitura e põe as tarefas antigas (sem coluna) na coluna certa. Uma vez por org por processo. */
  async ensureBoard(orgId: string) {
    let p = this.boardReady.get(orgId);
    if (!p) {
      p = this.initBoard(orgId).catch((e) => { this.boardReady.delete(orgId); throw e; });
      this.boardReady.set(orgId, p);
    }
    return p;
  }

  private async initBoard(orgId: string) {
    if (!(await this.prisma.whatsapp_task_lists.count({ where: { organization_id: orgId } })))
      await this.prisma.whatsapp_task_lists.createMany({ data: DEFAULT_LISTS.map((l, i) => ({ organization_id: orgId, ...l, position: i })) });
    if (!(await this.prisma.whatsapp_task_labels.count({ where: { organization_id: orgId } })))
      await this.prisma.whatsapp_task_labels.createMany({ data: DEFAULT_LABELS.map((l, i) => ({ organization_id: orgId, ...l, position: i })) });
    const lists = await this.listRows(orgId);
    const open = lists.find((l) => !l.is_done) || lists[0];
    const doneList = lists.find((l) => l.is_done) || open;
    if (!open) return;
    // abertas por ordem de criação; concluídas com a mais recente no topo
    await this.prisma.$executeRaw`UPDATE whatsapp_tasks SET list_id = ${open.id}, position = UNIX_TIMESTAMP(created_at) WHERE organization_id = ${orgId} AND list_id IS NULL AND done_at IS NULL`;
    await this.prisma.$executeRaw`UPDATE whatsapp_tasks SET list_id = ${doneList.id}, position = -UNIX_TIMESTAMP(done_at) WHERE organization_id = ${orgId} AND list_id IS NULL AND done_at IS NOT NULL`;
  }

  /** Esquece o estado do quadro da org (ex.: organização apagada). */
  forgetBoard(orgId: string) { this.boardReady.delete(orgId); }

  private listRows(orgId: string) {
    return this.prisma.whatsapp_task_lists.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { created_at: 'asc' }] });
  }

  private shapeList(l: any) { return { id: l.id, name: l.name, color: l.color || null, position: l.position, is_done: Boolean(l.is_done) }; }
  private shapeLabel(l: any) { return { id: l.id, name: l.name || '', color: l.color, position: l.position }; }

  /** Posição para entrar no topo ou no fim de uma coluna. */
  private async edgePosition(orgId: string, listId: string, at: 'top' | 'bottom') {
    const a = await this.prisma.whatsapp_tasks.aggregate({ where: { organization_id: orgId, list_id: listId }, _max: { position: true }, _min: { position: true } });
    return at === 'top' ? (a._min.position ?? STEP) - STEP : (a._max.position ?? 0) + STEP;
  }

  private async cleanLabels(orgId: string, ids: any): Promise<string[]> {
    if (!Array.isArray(ids)) return [];
    const uniq = [...new Set(ids.map((x) => String(x)))].slice(0, 20);
    if (!uniq.length) return [];
    const ok = await this.prisma.whatsapp_task_labels.findMany({ where: { organization_id: orgId, id: { in: uniq } }, select: { id: true } });
    const set = new Set(ok.map((x) => x.id));
    return uniq.filter((x) => set.has(x));
  }

  private cleanChecklist(v: any) {
    if (!Array.isArray(v)) return [];
    return v.slice(0, 100).map((it: any) => ({ id: String(it?.id || '').replace(/[^\w-]/g, '').slice(0, 40) || randomUUID().slice(0, 8), text: String(it?.text || '').trim().slice(0, 300), done: Boolean(it?.done) })).filter((it) => it.text);
  }

  private cleanColor(v: any): string | null {
    if (v === null || v === undefined || v === '') return null;
    const c = String(v).trim();
    if (!COLOR_RE.test(c)) throw new BadRequestException('Cor inválida (use #RRGGBB).');
    return c.toLowerCase();
  }

  /** Quadro: colunas com os cartões (filtros iguais aos da lista + etiqueta e prazo), etiquetas da conta. */
  async board(orgId: string, userId: string | null, q: any = {}, allowed: Set<string> | null = null) {
    await this.ensureBoard(orgId);
    const [lists, labels] = await Promise.all([this.listRows(orgId), this.prisma.whatsapp_task_labels.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { created_at: 'asc' }] })]);
    const base = await this.baseWhere(orgId, userId, q, allowed);
    const out = { lists: lists.map((l) => ({ ...this.shapeList(l), total: 0, tasks: [] as any[] })), labels: labels.map((l) => this.shapeLabel(l)), truncated: false };
    if (!base) return out;
    if (q.label_id) base.AND = [...(base.AND || []), { label_ids: { array_contains: String(q.label_id) } }];
    const now = new Date();
    const due = String(q.due || '');
    if (due === 'none') base.due_at = null;
    else if (due === 'overdue') { base.due_at = { lt: now }; base.done_at = null; }
    else if (due === 'today' || due === 'week') {
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: BRT }).format(now);
      const end = new Date(`${d}T23:59:59.999-03:00`);
      if (due === 'week') end.setDate(end.getDate() + 6);
      base.due_at = { gte: new Date(`${d}T00:00:00-03:00`), lte: end };
    }
    const openIds = lists.filter((l) => !l.is_done).map((l) => l.id);
    const doneIds = lists.filter((l) => l.is_done).map((l) => l.id);
    const order: any[] = [{ position: 'asc' }, { created_at: 'asc' }];
    const [openRows, doneParts, totals] = await Promise.all([
      openIds.length ? this.prisma.whatsapp_tasks.findMany({ where: { ...base, list_id: { in: openIds } }, orderBy: order, take: OPEN_TAKE + 1 }) : Promise.resolve([] as any[]),
      Promise.all(doneIds.map((lid) => this.prisma.whatsapp_tasks.findMany({ where: { ...base, list_id: lid }, orderBy: order, take: DONE_TAKE }))),
      this.prisma.whatsapp_tasks.groupBy({ by: ['list_id'], where: base, _count: { _all: true } }),
    ]);
    if (openRows.length > OPEN_TAKE) { out.truncated = true; openRows.length = OPEN_TAKE; }
    const shaped = await this.shapeMany(orgId, [...openRows, ...doneParts.flat()]);
    const byList = new Map(out.lists.map((l) => [l.id, l]));
    for (const t of shaped) byList.get(t.list_id)?.tasks.push(t);
    for (const g of totals as any[]) { const l = byList.get(g.list_id); if (l) l.total = g._count._all; }
    return out;
  }

  /** Move o cartão para a coluna `list_id`, na posição `index` (sem index = fim). Coluna de concluídas conclui; sair dela reabre. */
  async move(orgId: string, userId: string | null, id: string, dto: { list_id: string; index?: number }) {
    const cur = await this.prisma.whatsapp_tasks.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Tarefa não encontrada.');
    await this.ensureBoard(orgId);
    const lists = await this.listRows(orgId);
    const list = lists.find((l) => l.id === String(dto?.list_id || ''));
    if (!list) throw new BadRequestException('Coluna não encontrada.');
    const from = lists.find((l) => l.id === cur.list_id);
    const rows = await this.prisma.whatsapp_tasks.findMany({ where: { organization_id: orgId, list_id: list.id, NOT: { id } }, orderBy: [{ position: 'asc' }, { created_at: 'asc' }], select: { id: true, position: true } });
    const idx = dto?.index === undefined || dto?.index === null ? rows.length : Math.min(Math.max(0, Math.floor(Number(dto.index) || 0)), rows.length);
    const prev = idx > 0 ? rows[idx - 1].position : null;
    const next = idx < rows.length ? rows[idx].position : null;
    let pos = prev !== null && next !== null ? (prev + next) / 2 : prev !== null ? prev + STEP : next !== null ? next - STEP : 0;
    if (prev !== null && next !== null && !(next - prev > 1e-6)) {
      // sem folga entre os vizinhos: renumera a coluna deixando o lugar do cartão
      for (let i = 0; i < rows.length; i++) {
        const p = (i < idx ? i + 1 : i + 2) * STEP;
        if (rows[i].position !== p) await this.prisma.whatsapp_tasks.update({ where: { id: rows[i].id }, data: { position: p } });
      }
      pos = (idx + 1) * STEP;
    }
    const data: any = { list_id: list.id, position: pos };
    const becameDone = list.is_done && !cur.done_at;
    if (becameDone) { data.done_at = new Date(); data.done_by = userId; }
    else if (!list.is_done && cur.done_at && (from?.is_done || !from)) { data.done_at = null; data.done_by = null; data.reminded_at = null; }
    const row = await this.prisma.whatsapp_tasks.update({ where: { id }, data });
    if (becameDone && cur.chat_id && cur.session_id) await this.attendance.event(orgId, { session_id: cur.session_id, chat_id: cur.chat_id }, 'task_done', userId, { task_id: row.id, title: row.title });
    const shaped = await this.shapeOne(orgId, row);
    this.presenter.emit(orgId, 'wa:task', { action: 'moved', task: shaped, by: userId });
    return shaped;
  }

  // colunas
  async lists(orgId: string) { await this.ensureBoard(orgId); return (await this.listRows(orgId)).map((l) => this.shapeList(l)); }

  async createList(orgId: string, dto: any, userId: string | null = null) {
    await this.ensureBoard(orgId);
    const name = String(dto?.name || '').trim();
    if (!name) throw new BadRequestException('Dê um nome à coluna.');
    const lists = await this.listRows(orgId);
    if (lists.length >= MAX_LISTS) throw new BadRequestException(`No máximo ${MAX_LISTS} colunas.`);
    const row = await this.prisma.whatsapp_task_lists.create({ data: { organization_id: orgId, name: name.slice(0, 60), color: this.cleanColor(dto?.color), is_done: Boolean(dto?.is_done), position: (lists[lists.length - 1]?.position ?? -1) + 1 } });
    this.presenter.emit(orgId, 'wa:task', { action: 'board', by: userId });
    return this.shapeList(row);
  }

  async updateList(orgId: string, id: string, dto: any, userId: string | null = null) {
    const cur = await this.prisma.whatsapp_task_lists.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Coluna não encontrada.');
    const data: any = {};
    if (dto?.name !== undefined) { const n = String(dto.name || '').trim(); if (!n) throw new BadRequestException('Dê um nome à coluna.'); data.name = n.slice(0, 60); }
    if (dto?.color !== undefined) data.color = this.cleanColor(dto.color);
    if (dto?.is_done !== undefined && Boolean(dto.is_done) !== cur.is_done) {
      data.is_done = Boolean(dto.is_done);
      if (data.is_done) await this.prisma.whatsapp_tasks.updateMany({ where: { organization_id: orgId, list_id: id, done_at: null }, data: { done_at: new Date(), done_by: userId } });
      else await this.prisma.whatsapp_tasks.updateMany({ where: { organization_id: orgId, list_id: id, done_at: { not: null } }, data: { done_at: null, done_by: null, reminded_at: null } });
    }
    const row = Object.keys(data).length ? await this.prisma.whatsapp_task_lists.update({ where: { id }, data }) : cur;
    this.presenter.emit(orgId, 'wa:task', { action: 'board', by: userId });
    return this.shapeList(row);
  }

  async reorderLists(orgId: string, ids: string[], userId: string | null = null) {
    const lists = await this.listRows(orgId);
    const known = new Set(lists.map((l) => l.id));
    const order = [...(ids || []).map(String).filter((x) => known.has(x)), ...lists.map((l) => l.id).filter((x) => !(ids || []).includes(x))];
    for (let i = 0; i < order.length; i++) await this.prisma.whatsapp_task_lists.updateMany({ where: { id: order[i], organization_id: orgId }, data: { position: i } });
    this.presenter.emit(orgId, 'wa:task', { action: 'board', by: userId });
    return (await this.listRows(orgId)).map((l) => this.shapeList(l));
  }

  /** Apaga a coluna. Com cartões: `move_to` (outra coluna, vão para o fim dela) ou `delete_tasks: true`. Sempre sobra 1 coluna. */
  async deleteList(orgId: string, id: string, dto: { move_to?: string; delete_tasks?: boolean } = {}, userId: string | null = null) {
    const lists = await this.listRows(orgId);
    const cur = lists.find((l) => l.id === id);
    if (!cur) throw new NotFoundException('Coluna não encontrada.');
    if (lists.length <= 1) throw new BadRequestException('O quadro precisa de pelo menos uma coluna.');
    const n = await this.prisma.whatsapp_tasks.count({ where: { organization_id: orgId, list_id: id } });
    if (n && dto?.move_to) {
      const target = lists.find((l) => l.id === String(dto.move_to) && l.id !== id);
      if (!target) throw new BadRequestException('Coluna de destino inválida.');
      const base = await this.edgePosition(orgId, target.id, 'bottom');
      const minSrc = (await this.prisma.whatsapp_tasks.aggregate({ where: { organization_id: orgId, list_id: id }, _min: { position: true } }))._min.position ?? 0;
      const shift = base - minSrc;
      await this.prisma.$executeRaw`UPDATE whatsapp_tasks SET list_id = ${target.id}, position = position + ${shift} WHERE organization_id = ${orgId} AND list_id = ${id}`;
      if (target.is_done) await this.prisma.whatsapp_tasks.updateMany({ where: { organization_id: orgId, list_id: target.id, done_at: null }, data: { done_at: new Date(), done_by: userId } });
      else if (cur.is_done) await this.prisma.whatsapp_tasks.updateMany({ where: { organization_id: orgId, list_id: target.id, done_at: { not: null } }, data: { done_at: null, done_by: null, reminded_at: null } });
    } else if (n && dto?.delete_tasks) {
      await this.prisma.whatsapp_tasks.deleteMany({ where: { organization_id: orgId, list_id: id } });
    } else if (n) {
      throw new BadRequestException(`A coluna tem ${n} cartão(ões). Escolha para onde movê-los ou apague-os junto.`);
    }
    await this.prisma.whatsapp_task_lists.delete({ where: { id } });
    this.presenter.emit(orgId, 'wa:task', { action: 'board', by: userId });
    return { ok: true, moved: dto?.move_to ? n : 0, deleted: dto?.move_to ? 0 : n };
  }

  /** Apaga todos os cartões de uma coluna (ex.: limpar as concluídas). */
  async clearList(orgId: string, id: string, userId: string | null = null) {
    const cur = await this.prisma.whatsapp_task_lists.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Coluna não encontrada.');
    const r = await this.prisma.whatsapp_tasks.deleteMany({ where: { organization_id: orgId, list_id: id } });
    this.presenter.emit(orgId, 'wa:task', { action: 'board', by: userId });
    return { ok: true, deleted: r.count };
  }

  // etiquetas
  async labels(orgId: string) {
    await this.ensureBoard(orgId);
    return (await this.prisma.whatsapp_task_labels.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { created_at: 'asc' }] })).map((l) => this.shapeLabel(l));
  }

  async createLabel(orgId: string, dto: any, userId: string | null = null) {
    await this.ensureBoard(orgId);
    const n = await this.prisma.whatsapp_task_labels.count({ where: { organization_id: orgId } });
    if (n >= MAX_LABELS) throw new BadRequestException(`No máximo ${MAX_LABELS} etiquetas.`);
    const color = this.cleanColor(dto?.color);
    if (!color) throw new BadRequestException('Escolha uma cor.');
    const row = await this.prisma.whatsapp_task_labels.create({ data: { organization_id: orgId, name: String(dto?.name || '').trim().slice(0, 40), color, position: n } });
    this.presenter.emit(orgId, 'wa:task', { action: 'board', by: userId });
    return this.shapeLabel(row);
  }

  async updateLabel(orgId: string, id: string, dto: any, userId: string | null = null) {
    const cur = await this.prisma.whatsapp_task_labels.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Etiqueta não encontrada.');
    const data: any = {};
    if (dto?.name !== undefined) data.name = String(dto.name || '').trim().slice(0, 40);
    if (dto?.color !== undefined) { const c = this.cleanColor(dto.color); if (!c) throw new BadRequestException('Escolha uma cor.'); data.color = c; }
    const row = await this.prisma.whatsapp_task_labels.update({ where: { id }, data });
    this.presenter.emit(orgId, 'wa:task', { action: 'board', by: userId });
    return this.shapeLabel(row);
  }

  async deleteLabel(orgId: string, id: string, userId: string | null = null) {
    const cur = await this.prisma.whatsapp_task_labels.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Etiqueta não encontrada.');
    const tasks = await this.prisma.whatsapp_tasks.findMany({ where: { organization_id: orgId, label_ids: { array_contains: id } }, select: { id: true, label_ids: true } });
    for (const t of tasks) await this.prisma.whatsapp_tasks.update({ where: { id: t.id }, data: { label_ids: (Array.isArray(t.label_ids) ? (t.label_ids as string[]) : []).filter((x) => x !== id) } });
    await this.prisma.whatsapp_task_labels.delete({ where: { id } });
    this.presenter.emit(orgId, 'wa:task', { action: 'board', by: userId });
    return { ok: true, removed_from: tasks.length };
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
      this.hooks.emit('task_due', { orgId, tasks: shaped });
    }
    await this.prisma.whatsapp_tasks.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { reminded_at: now } });
    return rows.length;
  }
}
