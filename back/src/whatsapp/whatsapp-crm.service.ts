import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { digitsOf, isGroupJid, jidFromPhone, phoneFromJid } from './wa-jid.util';
import { BILLINGS, CUSTOMER_STATUSES, SUBSCRIPTION_STATUSES } from './dto/whatsapp-crm.dto';

// ============================================================================
// CRM do WhatsApp — produtos/serviços, clientes (um contato "promovido") e
// assinaturas (produto + valor + vencimento). Genérico: serve para qualquer
// negócio (produto físico, serviço, plano, mensalidade).
//
//   cliente 1 ─── 1 contato (whatsapp_contacts)   → conversas = uma por NÚMERO (multi-número)
//   cliente 1 ─── N assinaturas ─── 0..1 produto
//
// Variáveis para mensagens (respostas rápidas, agendamentos, broadcasts, bot):
//   {{cliente.nome}} {{cliente.primeiro_nome}} {{cliente.produto}} {{cliente.produtos}}
//   {{cliente.valor}} {{cliente.vencimento}} {{cliente.dia_vencimento}} {{cliente.status}}
//   (+ {{nome}} {{telefone}} que já existiam) — ver `varsForChat`.
//
// Multi-número: o cliente é DA ORG. `byChat` recebe o uuid da conversa (API); quem já tem
// (número, jid) — bot, broadcasts, agendamentos, cobranças — usa `byContactJid`/`varsForChat(jid)`.
// ============================================================================

const UUID_RE = /^[0-9a-f-]{36}$/i;

export const BILLING_LABEL: Record<string, string> = { once: 'Avulso', monthly: 'Mensal', quarterly: 'Trimestral', yearly: 'Anual' };
const BILLING_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };
const DAY = 86_400_000;

export const formatBRL = (cents: number) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDateBR = (d?: Date | string | null) => {
  if (!d) return '';
  const x = typeof d === 'string' ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d;
  if (Number.isNaN(x.getTime())) return '';
  return x.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};
// "YYYY-MM-DD" → Date (meia-noite UTC) — colunas DATE não têm fuso
const parseDate = (v: unknown): Date | null => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const todayUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const cleanDoc = (v: unknown) => digitsOf(v).slice(0, 14) || null;
export const isValidDoc = (doc: string) => {
  const d = digitsOf(doc);
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = (n: number) => { const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }
  return false;
};

/** Próximo vencimento: o primeiro dia `dueDay` (1–28) a partir de hoje (inclusive). */
export function nextDueFrom(from: Date, dueDay: number): Date {
  const y = from.getUTCFullYear(), m = from.getUTCMonth();
  const thisMonth = new Date(Date.UTC(y, m, dueDay));
  return thisMonth >= from ? thisMonth : new Date(Date.UTC(y, m + 1, dueDay));
}
/** Vencimento seguinte depois de pagar (mantém o dia; avança 1/3/12 meses). */
export function advanceDue(due: Date, billing: string, dueDay?: number | null): Date | null {
  const months = BILLING_MONTHS[billing];
  if (!months) return null;
  const d = dueDay || due.getUTCDate();
  return new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + months, Math.min(28, d)));
}

const normCustomFields = (raw: unknown) => {
  if (!Array.isArray(raw)) return [] as any[];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const f of raw.slice(0, 20)) {
    const key = String(f?.key || f?.label || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    const label = String(f?.label || '').trim().slice(0, 60);
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    const type = ['text', 'number', 'date', 'select'].includes(f?.type) ? f.type : 'text';
    const options = type === 'select' && Array.isArray(f?.options) ? [...new Set(f.options.map((o: any) => String(o || '').trim().slice(0, 60)).filter(Boolean))].slice(0, 30) : undefined;
    out.push({ key, label, type, ...(options ? { options } : {}) });
  }
  return out;
};

@Injectable()
export class WhatsAppCrmService {
  private readonly logger = new Logger(WhatsAppCrmService.name);
  constructor(private readonly prisma: PrismaService, private readonly contacts: WhatsAppContactsService, private readonly presenter: WhatsAppPresenter) {}

  // ---------------------------------------------------------------- configurações
  async settings(orgId: string) {
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId } });
    return { custom_fields: normCustomFields(row?.custom_fields) };
  }
  async updateSettings(orgId: string, dto: { custom_fields?: unknown }) {
    const data: any = {};
    if (dto.custom_fields !== undefined) data.custom_fields = normCustomFields(dto.custom_fields);
    await this.prisma.whatsapp_crm_settings.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId, ...data }, update: data });
    return this.settings(orgId);
  }

  // ---------------------------------------------------------------- produtos
  private shapeProduct(p: any, counts?: Map<string, number>) {
    return { id: p.id, name: p.name, description: p.description, price_cents: p.price_cents, price_label: formatBRL(p.price_cents), billing: p.billing, billing_label: BILLING_LABEL[p.billing] || p.billing, active: p.active, position: p.position, subscribers: counts?.get(p.id) ?? 0, created_at: p.created_at, updated_at: p.updated_at };
  }

  async listProducts(orgId: string, q: any = {}) {
    const where: any = { organization_id: orgId };
    if (q.active === '1' || q.active === 'true') where.active = true;
    const rows = await this.prisma.whatsapp_products.findMany({ where, orderBy: [{ active: 'desc' }, { position: 'asc' }, { name: 'asc' }] });
    const grp = await this.prisma.whatsapp_subscriptions.groupBy({ by: ['product_id'], where: { organization_id: orgId, status: { in: ['active', 'overdue', 'paused'] }, product_id: { not: null } }, _count: { _all: true } });
    const counts = new Map(grp.map((g) => [String(g.product_id), g._count._all]));
    return rows.map((p) => this.shapeProduct(p, counts));
  }

  private productData(dto: any) {
    const name = String(dto.name || '').trim().slice(0, 120);
    if (!name) throw new BadRequestException('Dê um nome ao produto.');
    const billing = BILLINGS.includes(dto.billing) ? dto.billing : 'once';
    return { name, description: String(dto.description || '').trim().slice(0, 500) || null, price_cents: Math.max(0, Math.round(Number(dto.price_cents) || 0)), billing, active: dto.active !== false };
  }

  async createProduct(orgId: string, dto: any) {
    const n = await this.prisma.whatsapp_products.count({ where: { organization_id: orgId } });
    if (n >= 500) throw new BadRequestException('Limite de 500 produtos.');
    const p = await this.prisma.whatsapp_products.create({ data: { organization_id: orgId, ...this.productData(dto), position: n } });
    return this.shapeProduct(p);
  }

  async updateProduct(orgId: string, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_products.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Produto não encontrado.');
    const data: any = {};
    if (dto.name !== undefined || dto.description !== undefined || dto.price_cents !== undefined || dto.billing !== undefined || dto.active !== undefined) {
      Object.assign(data, this.productData({ ...cur, ...dto, name: dto.name ?? cur.name, price_cents: dto.price_cents ?? cur.price_cents, billing: dto.billing ?? cur.billing, active: dto.active ?? cur.active, description: dto.description ?? cur.description }));
    }
    if (dto.position !== undefined) data.position = Math.max(0, Number(dto.position) || 0);
    const p = await this.prisma.whatsapp_products.update({ where: { id }, data });
    // o nome do produto é copiado nas assinaturas (fica mesmo se o produto sumir); renomear atualiza as ativas
    if (dto.name && dto.name !== cur.name) await this.prisma.whatsapp_subscriptions.updateMany({ where: { organization_id: orgId, product_id: id, status: { in: ['active', 'overdue', 'paused'] } }, data: { product_name: p.name } });
    return this.shapeProduct(p);
  }

  async removeProduct(orgId: string, id: string) {
    const cur = await this.prisma.whatsapp_products.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Produto não encontrado.');
    const inUse = await this.prisma.whatsapp_subscriptions.count({ where: { product_id: id, status: { in: ['active', 'overdue', 'paused'] } } });
    if (inUse) throw new BadRequestException(`Há ${inUse} assinatura${inUse === 1 ? '' : 's'} em andamento com este produto. Desative-o em vez de excluir.`);
    await this.prisma.whatsapp_products.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------- clientes
  private subStatus(s: any, today: Date) {
    // atrasada = ativa com vencimento no passado (o runner da fase 2 também grava `overdue`)
    if (s.status === 'active' && s.next_due_at && new Date(s.next_due_at) < today) return 'overdue';
    return s.status;
  }
  private shapeSub(s: any, today = todayUTC()) {
    const status = this.subStatus(s, today);
    const due = s.next_due_at ? new Date(s.next_due_at) : null;
    const days = due ? Math.round((due.getTime() - today.getTime()) / DAY) : null;
    return {
      id: s.id, customer_id: s.customer_id, product_id: s.product_id, product_name: s.product_name,
      price_cents: s.price_cents, price_label: formatBRL(s.price_cents), billing: s.billing, billing_label: BILLING_LABEL[s.billing] || s.billing,
      due_day: s.due_day, status, started_at: s.started_at ? dateOnly(new Date(s.started_at)) : null,
      next_due_at: due ? dateOnly(due) : null, next_due_label: fmtDateBR(due), days_to_due: days,
      last_paid_at: s.last_paid_at, canceled_at: s.canceled_at, notes: s.notes, created_at: s.created_at,
    };
  }
  private shapeCustomer(c: any, contact: any, subs: any[], fields: any[] = [], chats: Array<{ chat_id: string; session_id: string; jid: string; session: any }> = []) {
    const today = todayUTC();
    const shapedSubs = subs.map((s) => this.shapeSub(s, today));
    const live = shapedSubs.filter((s) => s.status === 'active' || s.status === 'overdue');
    const overdue = shapedSubs.some((s) => s.status === 'overdue');
    const next = live.filter((s) => s.next_due_at).sort((a, b) => String(a.next_due_at).localeCompare(String(b.next_due_at)))[0] || null;
    const monthly = live.reduce((acc, s) => acc + (s.billing === 'monthly' ? s.price_cents : s.billing === 'quarterly' ? s.price_cents / 3 : s.billing === 'yearly' ? s.price_cents / 12 : 0), 0);
    const custom = c.custom && typeof c.custom === 'object' ? c.custom : {};
    return {
      id: c.id, contact_id: c.contact_id, name: c.name, doc: c.doc, email: c.email, address: c.address || null, notes: c.notes, custom,
      custom_list: fields.map((f) => ({ ...f, value: custom[f.key] ?? '' })),
      status: c.status, since: c.since ? dateOnly(new Date(c.since)) : null, created_at: c.created_at, updated_at: c.updated_at,
      phone: contact?.phone || null, phone_label: contact?.phone ? `+${contact.phone}` : '', push_name: contact?.push_name || null,
      // conversas da pessoa (uma por número, a mais recente primeiro); `chat_id` = uuid da primeira (compat)
      jid: contact?.wa_id || null,
      chats,
      chat_id: chats[0]?.chat_id || null,
      contact_tags: Array.isArray(contact?.tags) ? contact.tags : [],
      subscriptions: shapedSubs,
      billing_status: c.status !== 'active' ? 'inactive' : overdue ? 'overdue' : live.length ? 'ok' : 'none',
      next_due_at: next?.next_due_at || null, next_due_label: next?.next_due_label || '', days_to_due: next?.days_to_due ?? null,
      monthly_cents: Math.round(monthly), monthly_label: formatBRL(Math.round(monthly)),
      products: live.map((s) => s.product_name),
    };
  }

  /** jids pelos quais a pessoa pode aparecer numa conversa (telefone, @lid, wa_id). */
  private contactJids(contact: any): string[] {
    if (!contact) return [];
    return [...new Set([contact.wa_id, contact.lid, contact.phone ? jidFromPhone(contact.phone) : null].filter(Boolean))] as string[];
  }

  /** Conversas (uma por número) de cada contato, no formato público, mais recentes primeiro. */
  private async chatsOfContacts(orgId: string, contacts: any[]) {
    const out = new Map<string, Array<{ chat_id: string; session_id: string; jid: string; session: any; last_message_at: Date | null }>>();
    const all = [...new Set(contacts.flatMap((c) => this.contactJids(c)))];
    if (!all.length) return out;
    const [rows, smap] = await Promise.all([
      this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, kind: 'individual', chat_id: { in: all } }, select: { id: true, session_id: true, chat_id: true, last_message_at: true }, orderBy: { last_message_at: 'desc' } }),
      this.presenter.sessionMap(orgId),
    ]);
    const byJid = new Map<string, typeof rows>();
    for (const r of rows) byJid.set(r.chat_id, [...(byJid.get(r.chat_id) || []), r]);
    for (const c of contacts) {
      const seen = new Set<string>();
      const list: Array<{ chat_id: string; session_id: string; jid: string; session: any; last_message_at: Date | null }> = [];
      for (const jid of this.contactJids(c)) for (const r of byJid.get(jid) || []) if (!seen.has(r.id)) { seen.add(r.id); list.push({ chat_id: r.id, session_id: r.session_id, jid: r.chat_id, session: smap.get(r.session_id) || null, last_message_at: r.last_message_at }); }
      list.sort((a, b) => (b.last_message_at?.getTime() || 0) - (a.last_message_at?.getTime() || 0));
      out.set(c.id, list);
    }
    return out;
  }

  private async hydrate(orgId: string, rows: any[]) {
    if (!rows.length) return [];
    const [contacts, subs, cfg] = await Promise.all([
      this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, id: { in: rows.map((r) => r.contact_id) } } }),
      this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, customer_id: { in: rows.map((r) => r.id) } }, orderBy: [{ status: 'asc' }, { created_at: 'asc' }] }),
      this.settings(orgId),
    ]);
    const byContact = new Map(contacts.map((c) => [c.id, c]));
    const chats = await this.chatsOfContacts(orgId, contacts);
    const byCustomer = new Map<string, any[]>();
    for (const s of subs) byCustomer.set(s.customer_id, [...(byCustomer.get(s.customer_id) || []), s]);
    return rows.map((r) => this.shapeCustomer(r, byContact.get(r.contact_id), byCustomer.get(r.id) || [], cfg.custom_fields, (chats.get(r.contact_id) || []).map(({ last_message_at: _l, ...x }) => x)));
  }

  async listCustomers(orgId: string, q: any = {}) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(5, parseInt(String(q.page_size || 25), 10) || 25));
    const where: any = { organization_id: orgId };
    if (q.status === 'active' || q.status === 'inactive') where.status = q.status;
    if (q.q) {
      const s = String(q.q).trim(), d = digitsOf(s);
      const byPhone = d.length >= 4 ? await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, phone: { contains: d } }, select: { id: true }, take: 500 }) : [];
      where.OR = [{ name: { contains: s } }, { email: { contains: s } }, ...(d ? [{ doc: { contains: d } }] : []), ...(byPhone.length ? [{ contact_id: { in: byPhone.map((c) => c.id) } }] : [])];
    }
    if (q.session_id) {
      // só clientes cujo contato tem conversa individual naquele NÚMERO (casa por wa_id, lid ou telefone@c.us)
      const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: String(q.session_id), kind: 'individual' }, select: { chat_id: true }, take: 20000 });
      const jids = chats.map((c) => c.chat_id);
      const phones = jids.map((j) => j.split('@')[0]).filter((d) => /^\d{8,15}$/.test(d));
      const contacts = jids.length
        ? await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ wa_id: { in: jids } }, { lid: { in: jids } }, ...(phones.length ? [{ phone: { in: phones } }] : [])] }, select: { id: true }, take: 20000 })
        : [];
      const ids = contacts.map((c) => c.id);
      where.contact_id = ids.length ? { in: ids } : { in: ['__none__'] };
    }
    if (q.product_id) {
      const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, product_id: String(q.product_id), status: { in: ['active', 'overdue', 'paused'] } }, select: { customer_id: true } });
      where.id = { in: [...new Set(subs.map((s) => s.customer_id))] };
    }
    if (q.billing === 'overdue') {
      const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, OR: [{ status: 'overdue' }, { status: 'active', next_due_at: { lt: todayUTC() } }] }, select: { customer_id: true } });
      where.id = { in: [...new Set(subs.map((s) => s.customer_id))].filter((id) => !where.id || where.id.in.includes(id)) };
    }
    const [total, rows, counts, overdueSubs, mrr] = await Promise.all([
      this.prisma.whatsapp_customers.count({ where }),
      this.prisma.whatsapp_customers.findMany({ where, orderBy: [{ status: 'asc' }, { name: 'asc' }], skip: (page - 1) * size, take: size }),
      this.prisma.whatsapp_customers.groupBy({ by: ['status'], where: { organization_id: orgId }, _count: { _all: true } }),
      this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, OR: [{ status: 'overdue' }, { status: 'active', next_due_at: { lt: todayUTC() } }] }, select: { customer_id: true } }),
      this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, status: { in: ['active', 'overdue'] }, billing: { in: ['monthly', 'quarterly', 'yearly'] } }, select: { price_cents: true, billing: true } }),
    ]);
    const monthly = mrr.reduce((a, s) => a + s.price_cents / (BILLING_MONTHS[s.billing] || 1), 0);
    return {
      items: await this.hydrate(orgId, rows), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)),
      counts: { total: counts.reduce((a, c) => a + c._count._all, 0), active: counts.find((c) => c.status === 'active')?._count._all || 0, inactive: counts.find((c) => c.status === 'inactive')?._count._all || 0, overdue: new Set(overdueSubs.map((s) => s.customer_id)).size, monthly_cents: Math.round(monthly), monthly_label: formatBRL(Math.round(monthly)) },
    };
  }

  async getCustomer(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_customers.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    return (await this.hydrate(orgId, [c]))[0];
  }

  /** Cliente da conversa pelo uuid (API). null se o contato ainda não foi promovido. Inclui o contato e a conversa. */
  async byChat(orgId: string, chatUuid: string) {
    const row = await this.prisma.whatsapp_chats.findFirst({ where: { id: String(chatUuid || ''), organization_id: orgId }, select: { id: true, session_id: true, chat_id: true } });
    if (!row) return { customer: null, contact: null, chat: null };
    const r = await this.byContactJid(orgId, row.session_id, row.chat_id);
    return { ...r, chat: { chat_id: row.id, session_id: row.session_id, jid: row.chat_id } };
  }

  /** Cliente de (número, jid) — para quem já tem o jid (bot, broadcasts, agendamentos, cobranças). `session` = id da sessão ou null. */
  async byContactJid(orgId: string, session: string | null | undefined, jid: string) {
    if (!jid || isGroupJid(jid)) return { customer: null, contact: null };
    const canonical = await this.contacts.canonicalChatId(orgId, session || null, jid).catch(() => jid);
    const ids = [...new Set([canonical, jid])];
    let contact = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, OR: [{ wa_id: { in: ids } }, { lid: { in: ids } }] }, orderBy: { saved: 'desc' } });
    if (!contact) {
      const phone = phoneFromJid(canonical) || phoneFromJid(jid);
      if (phone) contact = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, phone } });
    }
    if (!contact) return { customer: null, contact: null };
    const c = await this.prisma.whatsapp_customers.findFirst({ where: { organization_id: orgId, contact_id: contact.id } });
    return { customer: c ? (await this.hydrate(orgId, [c]))[0] : null, contact: { id: contact.id, name: contact.name || contact.push_name || null, phone: contact.phone, wa_id: contact.wa_id } };
  }

  private async customerData(dto: any, cur?: any) {
    const data: any = {};
    if (dto.name !== undefined) { const n = String(dto.name || '').trim().slice(0, 255); if (!n) throw new BadRequestException('Informe o nome do cliente.'); data.name = n; }
    if (dto.doc !== undefined) {
      const d = cleanDoc(dto.doc);
      if (d && !isValidDoc(d)) throw new BadRequestException('CPF/CNPJ inválido.');
      data.doc = d;
    }
    if (dto.email !== undefined) {
      const e = String(dto.email || '').trim().toLowerCase().slice(0, 255);
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new BadRequestException('E-mail inválido.');
      data.email = e || null;
    }
    if (dto.address !== undefined) {
      const a = dto.address && typeof dto.address === 'object' ? dto.address : {};
      const pick = (k: string, max: number) => String((a as any)[k] || '').trim().slice(0, max) || undefined;
      const addr: any = { zip: digitsOf((a as any).zip).slice(0, 8) || undefined, street: pick('street', 120), number: pick('number', 20), complement: pick('complement', 60), district: pick('district', 80), city: pick('city', 80), state: pick('state', 2)?.toUpperCase() };
      data.address = Object.values(addr).some(Boolean) ? addr : null;
    }
    if (dto.notes !== undefined) data.notes = String(dto.notes || '').trim().slice(0, 20000) || null;
    if (dto.custom !== undefined) {
      const c = dto.custom && typeof dto.custom === 'object' ? dto.custom : {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(c).slice(0, 40)) { const key = String(k).slice(0, 40); const val = String(v ?? '').trim().slice(0, 500); if (key && val) out[key] = val; }
      data.custom = out;
    }
    if (dto.status !== undefined) data.status = CUSTOMER_STATUSES.includes(dto.status) ? dto.status : 'active';
    if (dto.since !== undefined) data.since = parseDate(dto.since);
    if (cur === undefined && !data.name) throw new BadRequestException('Informe o nome do cliente.');
    return data;
  }

  async createCustomer(orgId: string, userId: string | null, dto: any) {
    let contact: any = null;
    if (dto.contact_id) {
      contact = await this.prisma.whatsapp_contacts.findFirst({ where: { id: String(dto.contact_id), organization_id: orgId } });
      if (!contact) throw new NotFoundException('Contato não encontrado.');
    } else if (dto.phone) {
      const shaped = await this.contacts.createManual(orgId, { phone: dto.phone, name: dto.name });
      contact = await this.prisma.whatsapp_contacts.findUnique({ where: { id: shaped.id } });
    } else throw new BadRequestException('Informe o contato ou o telefone.');
    const exists = await this.prisma.whatsapp_customers.findFirst({ where: { organization_id: orgId, contact_id: contact.id } });
    if (exists) throw new BadRequestException('Este contato já é cliente.');
    const data = await this.customerData({ ...dto, name: dto.name || contact.name || contact.push_name || (contact.phone ? `+${contact.phone}` : 'Cliente') });
    if (!contact.saved) await this.prisma.whatsapp_contacts.update({ where: { id: contact.id }, data: { saved: true } }).catch(() => undefined);
    const c = await this.prisma.whatsapp_customers.create({ data: { organization_id: orgId, contact_id: contact.id, created_by: userId, since: todayUTC(), ...data } });
    return (await this.hydrate(orgId, [c]))[0];
  }

  // ---------------------------------------------------------------- CSV
  /** Colunas: phone,name,doc,email,zip,street,number,district,city,state,notes,product,price,due_day (só phone+name obrigatórias). */
  async importCsv(orgId: string, userId: string | null, buf: Buffer) {
    const text = buf.toString('utf8').replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new BadRequestException('Arquivo vazio ou sem linhas de dados.');
    const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const split = (line: string) => {
      const out: string[] = []; let cur = ''; let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === sep && !q) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map((x) => x.trim());
    };
    const header = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z_]/g, ''));
    const col = (row: string[], ...names: string[]) => { for (const n of names) { const i = header.indexOf(n); if (i >= 0 && row[i] !== undefined) return row[i]; } return ''; };
    if (!header.some((h) => ['phone', 'telefone'].includes(h))) throw new BadRequestException('O cabeçalho precisa ter a coluna "phone" (telefone).');
    const products = await this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId } });
    const byName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p]));
    let imported = 0, updated = 0, skipped = 0, subscriptions = 0;
    const errors: string[] = [];
    for (const [i, line] of lines.slice(1, 2001).entries()) {
      const row = split(line);
      const phone = digitsOf(col(row, 'phone', 'telefone'));
      const name = col(row, 'name', 'nome');
      if (phone.length < 10 || phone.length > 15) { skipped++; if (errors.length < 20) errors.push(`linha ${i + 2}: telefone inválido`); continue; }
      try {
        const dto: any = { phone, name: name || undefined, doc: col(row, 'doc', 'cpf', 'cnpj', 'documento') || undefined, email: col(row, 'email', 'e_mail') || undefined, notes: col(row, 'notes', 'observacoes', 'obs') || undefined };
        const addr = { zip: col(row, 'zip', 'cep'), street: col(row, 'street', 'rua', 'logradouro'), number: col(row, 'number', 'numero'), district: col(row, 'district', 'bairro'), city: col(row, 'city', 'cidade'), state: col(row, 'state', 'uf', 'estado') };
        if (Object.values(addr).some(Boolean)) dto.address = addr;
        const shaped = await this.contacts.createManual(orgId, { phone, name: name || undefined });
        const existing = await this.prisma.whatsapp_customers.findFirst({ where: { organization_id: orgId, contact_id: shaped.id } });
        let customer: any;
        if (existing) { customer = await this.updateCustomer(orgId, existing.id, dto); updated++; }
        else { customer = await this.createCustomer(orgId, userId, { ...dto, contact_id: shaped.id }); imported++; }
        const prodName = col(row, 'product', 'produto').trim();
        if (prodName) {
          let prod = byName.get(prodName.toLowerCase());
          const priceCents = Math.round(parseFloat(String(col(row, 'price', 'valor', 'preco')).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) * 100);
          if (!prod && Number.isFinite(priceCents) && priceCents > 0) { prod = await this.prisma.whatsapp_products.create({ data: { organization_id: orgId, name: prodName.slice(0, 120), price_cents: priceCents, billing: 'monthly', position: products.length + byName.size } }); byName.set(prodName.toLowerCase(), prod); }
          if (prod) {
            const has = (customer.subscriptions || []).some((x: any) => x.product_id === prod!.id && x.status !== 'canceled');
            if (!has) { const dueDay = parseInt(col(row, 'due_day', 'dia_vencimento', 'vencimento'), 10); await this.addSubscription(orgId, customer.id, { product_id: prod.id, ...(Number.isFinite(priceCents) && priceCents > 0 ? { price_cents: priceCents } : {}), ...(Number.isFinite(dueDay) ? { due_day: Math.min(28, Math.max(1, dueDay)) } : {}) }); subscriptions++; }
          } else if (errors.length < 20) errors.push(`linha ${i + 2}: produto "${prodName}" não existe (informe price para criar)`);
        }
      } catch (e: any) {
        skipped++;
        if (errors.length < 20) errors.push(`linha ${i + 2}: ${e?.message || 'erro'}`);
      }
    }
    return { imported, updated, skipped, subscriptions, errors };
  }

  async exportCsv(orgId: string) {
    const rows = await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId }, orderBy: { name: 'asc' }, take: 20000 });
    const items = await this.hydrate(orgId, rows);
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['phone,name,doc,email,zip,street,number,district,city,state,notes,status,products,monthly,next_due,since'];
    for (const c of items as any[]) {
      const a = c.address || {};
      lines.push([esc(c.phone || ''), esc(c.name), esc(c.doc || ''), esc(c.email || ''), esc(a.zip || ''), esc(a.street || ''), esc(a.number || ''), esc(a.district || ''), esc(a.city || ''), esc(a.state || ''), esc(c.notes || ''), esc(c.status), esc((c.products || []).join('|')), esc(((c.monthly_cents || 0) / 100).toFixed(2).replace('.', ',')), esc(c.next_due_at || ''), esc(c.since || '')].join(','));
    }
    return '﻿' + lines.join('\n');
  }

  async updateCustomer(orgId: string, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_customers.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Cliente não encontrado.');
    const data = await this.customerData(dto, cur);
    const c = await this.prisma.whatsapp_customers.update({ where: { id }, data });
    if (data.name && data.name !== cur.name) await this.prisma.whatsapp_contacts.update({ where: { id: cur.contact_id }, data: { name: data.name } }).catch(() => undefined);
    return (await this.hydrate(orgId, [c]))[0];
  }

  async removeCustomer(orgId: string, id: string) {
    const cur = await this.prisma.whatsapp_customers.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Cliente não encontrado.');
    await this.prisma.whatsapp_customers.delete({ where: { id } }); // assinaturas em cascata (FK)
    return { ok: true };
  }

  // ---------------------------------------------------------------- assinaturas
  private async subData(orgId: string, dto: any, cur?: any) {
    const data: any = {};
    if (dto.product_id !== undefined) {
      if (dto.product_id) {
        const p = await this.prisma.whatsapp_products.findFirst({ where: { id: String(dto.product_id), organization_id: orgId } });
        if (!p) throw new NotFoundException('Produto não encontrado.');
        data.product_id = p.id;
        data.product_name = p.name;
        if (dto.price_cents === undefined && !cur) data.price_cents = p.price_cents;
        if (dto.billing === undefined && !cur) data.billing = p.billing;
      } else data.product_id = null;
    }
    if (dto.product_name !== undefined) { const n = String(dto.product_name || '').trim().slice(0, 120); if (n) data.product_name = n; }
    if (dto.price_cents !== undefined) data.price_cents = Math.max(0, Math.round(Number(dto.price_cents) || 0));
    if (dto.billing !== undefined) data.billing = BILLINGS.includes(dto.billing) ? dto.billing : 'monthly';
    if (dto.due_day !== undefined) data.due_day = dto.due_day === null ? null : Math.min(28, Math.max(1, parseInt(String(dto.due_day), 10) || 1));
    if (dto.status !== undefined) {
      data.status = SUBSCRIPTION_STATUSES.includes(dto.status) ? dto.status : 'active';
      data.canceled_at = data.status === 'canceled' ? new Date() : null;
    }
    if (dto.started_at !== undefined) data.started_at = parseDate(dto.started_at);
    if (dto.next_due_at !== undefined) data.next_due_at = parseDate(dto.next_due_at);
    if (dto.notes !== undefined) data.notes = String(dto.notes || '').trim().slice(0, 500) || null;
    const merged = { ...(cur || {}), ...data };
    if (!merged.product_name) throw new BadRequestException('Escolha um produto ou dê um nome à assinatura.');
    const recurring = Boolean(BILLING_MONTHS[merged.billing]);
    if (recurring) {
      if (!merged.due_day) throw new BadRequestException('Informe o dia do vencimento (1 a 28).');
      // vencimento derivado do dia quando não foi informado/mudou de dia
      if (!merged.next_due_at || (dto.due_day !== undefined && (!cur || cur.due_day !== merged.due_day) && dto.next_due_at === undefined)) data.next_due_at = nextDueFrom(todayUTC(), merged.due_day);
    } else if (dto.billing !== undefined) { data.due_day = null; data.next_due_at = data.next_due_at ?? null; }
    if (!cur && data.started_at === undefined) data.started_at = todayUTC();
    return data;
  }

  async addSubscription(orgId: string, customerId: string, dto: any) {
    await this.getCustomer(orgId, customerId);
    const n = await this.prisma.whatsapp_subscriptions.count({ where: { customer_id: customerId } });
    if (n >= 50) throw new BadRequestException('Limite de 50 assinaturas por cliente.');
    const data = await this.subData(orgId, { billing: 'monthly', ...dto });
    await this.prisma.whatsapp_subscriptions.create({ data: { organization_id: orgId, customer_id: customerId, status: 'active', ...data } });
    return this.getCustomer(orgId, customerId);
  }

  async updateSubscription(orgId: string, customerId: string, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id, customer_id: customerId, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Assinatura não encontrada.');
    const data = await this.subData(orgId, dto, cur);
    await this.prisma.whatsapp_subscriptions.update({ where: { id }, data });
    return this.getCustomer(orgId, customerId);
  }

  async removeSubscription(orgId: string, customerId: string, id: string) {
    const cur = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id, customer_id: customerId, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Assinatura não encontrada.');
    await this.prisma.whatsapp_subscriptions.delete({ where: { id } });
    return this.getCustomer(orgId, customerId);
  }

  // ---------------------------------------------------------------- variáveis para mensagens
  /**
   * Variáveis `{{cliente.*}}` da conversa (vazias quando o contato não é cliente). Barato: 2–3 consultas.
   * `ref` = jid (quem já tem o jid: bot, broadcasts, agendamentos — `sessionId` opcional ajuda a resolver @lid)
   * OU uuid da conversa (rotas da API).
   */
  async varsForChat(orgId: string, ref: string, sessionId?: string | null): Promise<Record<string, string>> {
    const empty = { 'cliente.nome': '', 'cliente.primeiro_nome': '', 'cliente.produto': '', 'cliente.produtos': '', 'cliente.valor': '', 'cliente.vencimento': '', 'cliente.dia_vencimento': '', 'cliente.status': '', 'cliente.email': '', 'cliente.documento': '' };
    try {
      const { customer } = UUID_RE.test(String(ref || '')) && !String(ref).includes('@') ? await this.byChat(orgId, ref) : await this.byContactJid(orgId, sessionId || null, ref);
      if (!customer) return empty;
      const live = customer.subscriptions.filter((s: any) => s.status === 'active' || s.status === 'overdue');
      const next = live.filter((s: any) => s.next_due_at).sort((a: any, b: any) => String(a.next_due_at).localeCompare(String(b.next_due_at)))[0] || live[0] || null;
      const vars: Record<string, string> = {
        'cliente.nome': customer.name, 'cliente.primeiro_nome': customer.name.split(/\s+/)[0] || '',
        'cliente.produto': next?.product_name || '', 'cliente.produtos': live.map((s: any) => s.product_name).join(', '),
        'cliente.valor': next ? next.price_label : '', 'cliente.vencimento': next?.next_due_label || '', 'cliente.dia_vencimento': next?.due_day ? String(next.due_day) : '',
        'cliente.status': customer.billing_status === 'overdue' ? 'em atraso' : customer.billing_status === 'ok' ? 'em dia' : customer.status === 'inactive' ? 'inativo' : 'sem assinatura',
        'cliente.email': customer.email || '', 'cliente.documento': customer.doc || '',
      };
      for (const f of customer.custom_list || []) vars[`cliente.${f.key}`] = String(f.value ?? '');
      return vars;
    } catch (e: any) {
      this.logger.debug(`vars ${ref}: ${e?.message || e}`);
      return empty;
    }
  }
}

/** Substitui `{{chave}}` (inclusive `{{cliente.x}}`) — chaves desconhecidas viram vazio só se estiverem no mapa; o resto fica. */
export function fillCrmVars(text: string, vars: Record<string, string>) {
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k: string) => {
    const key = String(k).toLowerCase();
    return key in vars ? vars[key] : m;
  });
}
