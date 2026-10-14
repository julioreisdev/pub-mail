import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppPresenter } from '../whatsapp-presenter.service';
import { WhatsAppHooks } from '../whatsapp-hooks.service';
import { WhatsAppOutboxService } from '../whatsapp-outbox.service';
import { WhatsAppIdentityService } from '../whatsapp-identity.service';
import { WhatsAppSessionsService } from '../whatsapp-sessions.service';
import { WhatsAppChargesService } from '../whatsapp-charges.service';
import { WhatsAppCrmService } from '../whatsapp-crm.service';
import { WhatsAppCustomFieldsService } from '../whatsapp-custom-fields.service';
import { formatBRL, firstName } from '../wa-crm-vars.util';
import { isGroupJid, jidFromPhone } from '../wa-jid.util';
import { NotificationsService } from '../../notifications/notifications.service';
import { fillScheduleText } from '../scheduling/wa-schedule.util';
import { customVars } from '../wa-custom-fields.util';
import {
  OPEN_ORDER, ORDER_STATUSES, ORDER_STATUS_LABEL, OrderSettings, OrderStatus, PAYMENT_STATUS_LABEL, paymentMethodLabel,
  addressLine, buildItems, canMove, computeTotals, deliveryText, itemsText, normDeliveryAddress, normalizeOrderSettings,
} from './wa-order.util';

// ============================================================================
// Pedidos (Fase 7 — contrato `docs/whatsapp-assinaturas-contrato.md` §11.3).
//  - Número sem furo: contador `order` em `whatsapp_counters`, na MESMA transação da criação (igual aos chamados).
//  - Preço SEMPRE do produto no banco (avulso, ativo); itens guardam nome e preço do momento.
//  - PIX: cobrança pelo serviço de cobranças (cliente criado pelo contato quando não existe). Pago (hook
//    `charge_paid`) → `payment_status='paid'` e, se ainda "recebido", vira "confirmado". Cancelar cancela a cobrança.
//  - Textos ao cliente pela FILA (dedupe `order:<id>:<tipo>`). Pedido feito pelo bot não recebe o `created`
//    daqui (o bot mostra o resumo dele).
// ============================================================================

const UUID_RE = /^[0-9a-f-]{36}$/i;
const TX_OPTS = { timeout: 15_000, maxWait: 15_000 };
const isDeadlock = (e: any) => e?.code === 'P2034' || /deadlock|lock wait timeout|1213|1205/i.test(String(e?.message || e?.meta?.message || ''));
export type OrderSource = 'bot' | 'panel' | 'api';
export type OrderBy = { by: 'staff' | 'customer' | 'system' | 'bot' | 'api'; user_id?: string | null };
export type CreateOrderInput = {
  items: Array<{ product_id: string; qty: number; notes?: string | null }>;
  customer_id?: string | null; contact_id?: string | null; session_id?: string | null; chat_id?: string | null; unit_id?: string | null;
  delivery?: { mode?: 'delivery' | 'pickup'; address?: unknown; address_id?: string | null; notes?: string | null } | null;
  payment_method?: string | null; discount_cents?: number | null; notes?: string | null; custom?: Record<string, unknown> | null;
  source: OrderSource; user_id?: string | null; notify?: boolean; bot?: { flow_id: string; node_id?: string | null } | null;
  /** Números que quem cria pode usar (null = todos; bot/API = null). O número resolvido pelo cliente precisa estar aqui. */
  allowed?: Set<string> | null;
};

@Injectable()
export class WhatsAppOrdersService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppOrdersService.name);
  private readonly settingsCache = new Map<string, { at: number; s: OrderSettings }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: WhatsAppPresenter,
    private readonly hooks: WhatsAppHooks,
    private readonly outbox: WhatsAppOutboxService,
    private readonly identity: WhatsAppIdentityService,
    private readonly sessions: WhatsAppSessionsService,
    private readonly charges: WhatsAppChargesService,
    private readonly crm: WhatsAppCrmService,
    private readonly cf: WhatsAppCustomFieldsService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.hooks.on('charge_paid', (e) => this.onChargePaid(e));
    this.hooks.on('charge_expired', (e) => this.onChargeGone(e, 'expired'));
    this.hooks.on('charge_canceled', (e) => this.onChargeGone(e, 'canceled'));
  }

  /** PIX do pedido venceu/foi cancelado sem pagamento → pedido ainda "recebido" é cancelado (não fica aberto para sempre). */
  private async onChargeGone(e: any, why: 'expired' | 'canceled') {
    const c = e?.charge;
    if (!c?.id) return;
    const orgId = e.orgId || c.organization_id;
    const o = await this.prisma.whatsapp_orders.findFirst({ where: { organization_id: orgId, charge_id: c.id } }).catch(() => null);
    if (!o || o.payment_status !== 'pending' || o.status !== 'new') return;
    const reason = why === 'expired' ? 'Pagamento não confirmado no prazo' : 'Cobrança cancelada';
    // pedido do bot: o bot avisa pela porta "expirou"; os outros recebem o texto de cancelado
    await this.setStatus(orgId, o.id, { status: 'canceled', reason, notify: o.source !== 'bot' }, { by: 'system' }).catch((err: any) => this.logger.warn(`pedido #${o.number}: cancelar após cobrança ${why}: ${err?.message || err}`));
  }

  // ================================================================ configurações
  async settings(orgId: string): Promise<OrderSettings> {
    const c = this.settingsCache.get(orgId);
    if (c && Date.now() - c.at < 60_000) return c.s;
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { orders: true } }).catch(() => null);
    const s = normalizeOrderSettings(row?.orders);
    this.settingsCache.set(orgId, { at: Date.now(), s });
    return s;
  }

  async updateSettings(orgId: string, dto: any) {
    this.settingsCache.delete(orgId);
    const cur = await this.settings(orgId);
    const c: any = Object.fromEntries(Object.entries(dto || {}).filter(([, v]) => v !== undefined));
    const sub = (k: string) => ({ ...(cur as any)[k], ...(c[k] && typeof c[k] === 'object' ? c[k] : {}) });
    const next = normalizeOrderSettings({ ...cur, ...c, delivery: sub('delivery'), pickup: sub('pickup'), notify_customer: sub('notify_customer'), texts: sub('texts') });
    await this.prisma.whatsapp_crm_settings.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId, orders: next as any }, update: { orders: next as any } });
    this.settingsCache.delete(orgId);
    return this.settings(orgId);
  }

  // ================================================================ catálogo
  /** Produtos avulsos ativos, agrupados pela categoria (ordem do cadastro). */
  async catalog(orgId: string) {
    const rows = await this.prisma.whatsapp_products.findMany({
      where: { organization_id: orgId, active: true, billing: 'once', kind: { notIn: ['service', 'plan'] } },
      orderBy: [{ position: 'asc' }, { name: 'asc' }], take: 500,
    });
    const cats = new Map<string, any[]>();
    for (const p of rows) {
      const cat = (p.category || '').trim() || 'Produtos';
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push({ id: p.id, name: p.name, description: p.description || null, price_cents: p.price_cents, price_label: formatBRL(p.price_cents), category: cat });
    }
    return { categories: [...cats.entries()].map(([name, products]) => ({ name, products })), total: rows.length };
  }

  // ================================================================ quem / onde
  /**
   * Conversa para falar com o contato respeitando os números do usuário: a do `chatKeyForContact` quando o número é
   * permitido; senão uma conversa do contato num número permitido; senão um número permitido CONECTADO com o
   * telefone. Nenhum permitido → 403 (o pedido não pode sair por um número que o usuário não usa).
   */
  private async keyForContactAllowed(orgId: string, contactId: string, allowed: Set<string> | null) {
    const key = await this.outbox.chatKeyForContact(orgId, contactId).catch(() => null);
    if (allowed === null || (key && allowed.has(key.session_id))) return key;
    const contact = await this.prisma.whatsapp_contacts.findFirst({ where: { id: contactId, organization_id: orgId }, select: { wa_id: true, lid: true, phone: true } });
    const jids = [...new Set([contact?.wa_id, contact?.lid, contact?.phone ? jidFromPhone(contact.phone) : null].filter(Boolean))] as string[];
    if (allowed.size && jids.length) {
      const chat = await this.prisma.whatsapp_chats.findFirst({ where: { organization_id: orgId, kind: 'individual', chat_id: { in: jids }, session_id: { in: [...allowed] } }, orderBy: { last_message_at: 'desc' }, select: { session_id: true, chat_id: true } });
      if (chat) return { session_id: chat.session_id, chat_id: chat.chat_id };
      const allow: Set<string> = allowed;
      const ready = (await this.sessions.readyRows(orgId)).find((r: any) => allow.has(r.id));
      if (ready && contact?.phone) return { session_id: ready.id, chat_id: jidFromPhone(contact.phone) };
    }
    if (!key) return null;
    throw new ForbiddenException('Este cliente só conversa por um número que você não pode usar.');
  }

  private async who(orgId: string, input: { customer_id?: string | null; contact_id?: string | null; session_id?: string | null; chat_id?: string | null; allowed?: Set<string> | null }) {
    let customer: any = null, contactId: string | null = null, key: { session_id: string; chat_id: string } | null = null;
    if (input.customer_id) {
      customer = await this.prisma.whatsapp_customers.findFirst({ where: { id: String(input.customer_id), organization_id: orgId } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');
      contactId = customer.contact_id;
    }
    if (input.contact_id) {
      const c = await this.prisma.whatsapp_contacts.findFirst({ where: { id: String(input.contact_id), organization_id: orgId }, select: { id: true } });
      if (!c) throw new NotFoundException('Contato não encontrado.');
      contactId = c.id;
    }
    if (input.chat_id) {
      const ref = String(input.chat_id);
      if (UUID_RE.test(ref) && !ref.includes('@')) {
        const chat = await this.prisma.whatsapp_chats.findFirst({ where: { id: ref, organization_id: orgId } });
        if (!chat) throw new NotFoundException('Conversa não encontrada.');
        key = { session_id: chat.session_id, chat_id: chat.chat_id };
      } else {
        if (!input.session_id) throw new BadRequestException('Informe o número (session_id) junto com o jid da conversa.');
        const s = await this.sessions.rowById(orgId, String(input.session_id));
        if (!s) throw new NotFoundException('Número não encontrado.');
        key = { session_id: s.id, chat_id: ref };
      }
      if (isGroupJid(key.chat_id)) throw new BadRequestException('Pedido é só para conversas individuais.');
      if (!contactId) contactId = (await this.identity.contactOfJid(orgId, key.session_id, key.chat_id))?.id || null;
    }
    if (!customer && contactId) customer = (await this.identity.customersOfContact(orgId, contactId))[0]?.customer || null;
    if (!key && contactId) key = await this.keyForContactAllowed(orgId, contactId, input.allowed ?? null);
    // P7-14: o número final (vindo do jid+session_id, da conversa ou do cliente) precisa ser um que o usuário usa
    if (key && input.allowed && input.allowed !== null && !input.allowed.has(key.session_id)) throw new ForbiddenException('Você não pode usar este número.');
    return { customer, contactId, key };
  }

  private async keyFor(orgId: string, o: { session_id?: string | null; chat_id?: string | null; contact_id?: string | null; customer_id?: string | null }) {
    if (o.session_id && o.chat_id && !isGroupJid(o.chat_id)) {
      const s = await this.sessions.rowById(orgId, o.session_id);
      if (s) return { session_id: s.id, chat_id: o.chat_id };
    }
    let contactId = o.contact_id || null;
    if (!contactId && o.customer_id) contactId = (await this.prisma.whatsapp_customers.findUnique({ where: { id: o.customer_id }, select: { contact_id: true } }))?.contact_id || null;
    return contactId ? this.outbox.chatKeyForContact(orgId, contactId) : null;
  }

  // ================================================================ formato
  private async shapeMany(orgId: string, rows: any[]) {
    if (!rows.length) return [] as any[];
    const ids = (k: string) => [...new Set(rows.map((r) => r[k]).filter(Boolean))] as string[];
    const [custs, units, charges, smap, s] = await Promise.all([
      ids('customer_id').length ? this.prisma.whatsapp_customers.findMany({ where: { id: { in: ids('customer_id') } }, select: { id: true, name: true, contact_id: true, code: true } }) : Promise.resolve([] as any[]),
      ids('unit_id').length ? this.prisma.whatsapp_units.findMany({ where: { id: { in: ids('unit_id') } }, select: { id: true, name: true } }) : Promise.resolve([] as any[]),
      ids('charge_id').length ? this.prisma.whatsapp_charges.findMany({ where: { id: { in: ids('charge_id') } }, select: { id: true, status: true, pix_code: true, pay_link_token: true, kind: true } }) : Promise.resolve([] as any[]),
      this.presenter.sessionMap(orgId),
      this.settings(orgId),
    ]);
    const contactIds = [...new Set([...ids('contact_id'), ...custs.map((c: any) => c.contact_id)].filter(Boolean))] as string[];
    const contacts = contactIds.length ? await this.prisma.whatsapp_contacts.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true, push_name: true, phone: true } }) : [];
    const pairs = rows.filter((r) => r.session_id && r.chat_id).map((r) => ({ session_id: r.session_id, chat_id: r.chat_id }));
    const chats = pairs.length ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, OR: pairs }, select: { id: true, session_id: true, chat_id: true } }) : [];
    const cm = new Map(custs.map((c: any) => [c.id, c] as [string, any]));
    const um = new Map(units.map((u: any) => [u.id, u.name] as [string, string]));
    const chg = new Map(charges.map((c: any) => [c.id, c] as [string, any]));
    const ctm = new Map(contacts.map((c) => [c.id, c] as [string, any]));
    const chm = new Map(chats.map((c) => [`${c.session_id}|${c.chat_id}`, c.id] as [string, string]));
    return rows.map((o) => {
      const cust = o.customer_id ? cm.get(o.customer_id) : null;
      const contact = (o.contact_id && ctm.get(o.contact_id)) || (cust ? ctm.get(cust.contact_id) : null) || null;
      const ch = o.charge_id ? chg.get(o.charge_id) : null;
      const items = Array.isArray(o.items) ? o.items : [];
      const st = o.status as OrderStatus;
      return {
        id: o.id, number: o.number, code: `#${o.number}`, status: st, status_label: ORDER_STATUS_LABEL[st] || st,
        next_statuses: OPEN_ORDER.includes(st as any) ? (['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'canceled'] as OrderStatus[]).filter((x) => canMove(st, x)) : [],
        payment_method: o.payment_method, payment_method_label: paymentMethodLabel(o.payment_method, o.delivery),
        payment_status: o.payment_status, payment_status_label: o.payment_status === 'not_required' && (o.delivery as any)?.mode === 'pickup' ? 'Paga na retirada' : PAYMENT_STATUS_LABEL[o.payment_status] || o.payment_status,
        items, items_count: items.reduce((a: number, i: any) => a + (Number(i.qty) || 0), 0), items_text: itemsText(items),
        subtotal_cents: o.subtotal_cents, delivery_fee_cents: o.delivery_fee_cents, discount_cents: o.discount_cents, total_cents: o.total_cents, total_label: formatBRL(o.total_cents),
        delivery: o.delivery && typeof o.delivery === 'object' ? o.delivery : { mode: 'pickup' }, delivery_text: deliveryText(o.delivery, s),
        charge: ch ? { id: ch.id, status: ch.status, kind: ch.kind, pix_code: ch.pix_code || null } : null,
        customer: cust ? { id: cust.id, name: cust.name, code: cust.code || null, phone: contact?.phone || null } : null,
        contact: contact ? { id: contact.id, name: contact.name || contact.push_name || null, phone: contact.phone || null } : null,
        contact_id: o.contact_id || null, unit_id: o.unit_id || null, unit: o.unit_id ? { id: o.unit_id, name: um.get(o.unit_id) || null } : null,
        session_id: o.session_id || null, session: (o.session_id && smap.get(o.session_id)) || null,
        chat_id: (o.session_id && o.chat_id && chm.get(`${o.session_id}|${o.chat_id}`)) || null, jid: o.chat_id || null,
        notes: o.notes || null, source: o.source, custom: o.custom && typeof o.custom === 'object' ? o.custom : {},
        history: Array.isArray(o.history) ? o.history : [],
        confirmed_at: o.confirmed_at, paid_at: o.paid_at, delivered_at: o.delivered_at, canceled_at: o.canceled_at, cancel_reason: o.cancel_reason || null,
        created_by: o.created_by || null, created_at: o.created_at, updated_at: o.updated_at,
      };
    });
  }

  private async shapeOne(orgId: string, o: any) { return (await this.shapeMany(orgId, [o]))[0]; }

  private async row(orgId: string, id: string) {
    const o = await this.prisma.whatsapp_orders.findFirst({ where: { id: String(id || ''), organization_id: orgId } });
    if (!o) throw new NotFoundException('Pedido não encontrado.');
    return o;
  }

  async get(orgId: string, id: string) { return this.shapeOne(orgId, await this.row(orgId, id)); }
  async sessionOf(orgId: string, id: string) { return (await this.row(orgId, id)).session_id || null; }

  async belongsTo(orgId: string, id: string, who: { contact_id?: string | null; customer_ids?: string[] | null }) {
    const o = await this.prisma.whatsapp_orders.findFirst({ where: { id: String(id || ''), organization_id: orgId }, select: { contact_id: true, customer_id: true } });
    if (!o) return false;
    return Boolean((who.contact_id && o.contact_id === who.contact_id) || (o.customer_id && (who.customer_ids || []).includes(o.customer_id)));
  }

  // ================================================================ eventos / textos
  private emitOrder(orgId: string, action: string, order: any, extra: Record<string, unknown> = {}) {
    if (order?.session_id) this.presenter.emitSession(orgId, order.session_id, 'wa:order', { action, order, ...extra });
    else this.presenter.emit(orgId, 'wa:order', { action, order, ...extra });
    this.hooks.emit(`order_${action}`, { orgId, order, ...extra });
  }

  async varsFor(orgId: string, o: any, extra: Record<string, string> = {}) {
    const shaped = o.items_text !== undefined ? o : await this.shapeOne(orgId, o);
    const name = shaped.customer?.name || shaped.contact?.name || '';
    const defs = await this.cf.defs(orgId, 'order');
    return {
      'cliente.nome': name, 'cliente.primeiro_nome': firstName(name),
      'pedido.numero': String(shaped.number), 'pedido.itens': shaped.items_text, 'pedido.total': shaped.total_label,
      'pedido.status': shaped.status_label, 'pedido.entrega': shaped.delivery_text, 'pedido.pagamento': `${shaped.payment_method_label}${shaped.payment_status === 'paid' ? ' (pago)' : ''}`,
      'pedido.motivo': '',
      ...customVars('pedido', defs, shaped.custom),
      ...extra,
    } as Record<string, string>;
  }

  private async notifyCustomer(orgId: string, o: any, textKey: keyof OrderSettings['texts'], tipo: string, extra: Record<string, string> = {}) {
    try {
      const s = await this.settings(orgId);
      const text = fillScheduleText(s.texts[textKey], await this.varsFor(orgId, o, extra));
      if (!text) return null;
      const key = await this.keyFor(orgId, o);
      if (!key) return null;
      return await this.outbox.enqueue(orgId, { ...key, kind: `order_${tipo}`.slice(0, 32), payload: { text, mark: { order: o.id } }, dedupe_key: `order:${o.id}:${tipo}` });
    } catch (e: any) { this.logger.warn(`pedido ${o?.id}: aviso ${tipo}: ${e?.message || e}`); return null; }
  }

  // ================================================================ criação
  private async nextNumber(tx: any, orgId: string): Promise<number> {
    await tx.$executeRaw`INSERT INTO whatsapp_counters (organization_id, name, value) VALUES (${orgId}, ${'order'}, LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE value = LAST_INSERT_ID(value + 1)`;
    const r: { n: bigint | number }[] = await tx.$queryRaw`SELECT LAST_INSERT_ID() AS n`;
    const n = Number(r?.[0]?.n);
    if (!(n > 0)) throw new Error('contador de pedidos não devolveu número');
    return n;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
      try { return await fn(); } catch (e: any) {
        if (i < 3 && isDeadlock(e)) { await new Promise((r) => setTimeout(r, 60 + Math.random() * 240)); continue; }
        throw e;
      }
    }
  }

  async create(orgId: string, input: CreateOrderInput) {
    const s = await this.settings(orgId);
    if (!s.enabled) throw new BadRequestException('Pedidos estão desligados nas configurações.');
    const products = await this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId, id: { in: (input.items || []).map((i) => String(i?.product_id || '')).slice(0, 100) } }, select: { id: true, name: true, price_cents: true, active: true, kind: true, billing: true } });
    let items;
    try { items = buildItems(input.items || [], products, s.max_items); } catch (e: any) { throw new BadRequestException(e?.message || 'Itens inválidos.'); }
    const w = await this.who(orgId, input);
    let customer = w.customer;
    // entrega / retirada
    const mode: 'delivery' | 'pickup' = input.delivery?.mode === 'delivery' ? 'delivery' : 'pickup';
    if (mode === 'delivery' && !s.delivery.enabled) throw new BadRequestException('Entrega não está disponível.');
    if (mode === 'pickup' && !s.pickup.enabled) throw new BadRequestException('Retirada não está disponível.');
    let address: any = null;
    if (mode === 'delivery') {
      if (input.delivery?.address_id && customer) address = normDeliveryAddress((Array.isArray(customer.addresses) ? customer.addresses : []).find((a: any) => a.id === input.delivery!.address_id) || null);
      if (!address && input.delivery?.address) address = normDeliveryAddress(input.delivery.address);
      if (!address || !addressLine(address)) throw new BadRequestException('Informe o endereço de entrega.');
    }
    const totals = computeTotals(items, s, mode, input.source === 'bot' ? 0 : Number(input.discount_cents) || 0);
    if (s.min_order_cents && totals.subtotal_cents < s.min_order_cents) throw new BadRequestException(`O pedido mínimo é ${formatBRL(s.min_order_cents)}.`);
    // pagamento
    const pm = String(input.payment_method || (totals.total_cents > 0 ? s.payment_methods[0] : 'none'));
    if (totals.total_cents > 0 && !s.payment_methods.includes(pm as any) && !(input.source !== 'bot' && pm === 'none')) throw new BadRequestException('Forma de pagamento não aceita.');
    if (pm === 'pix' && totals.total_cents < 100) throw new BadRequestException('PIX a partir de R$ 1,00.');
    const custom = (await this.cf.apply(orgId, 'order', input.custom ?? {}, { mode: 'create' })) || {};
    // PIX precisa de cliente cadastrado (a cobrança é dele): cria pelo contato, como a agenda
    if (pm === 'pix' && !customer) {
      if (!w.contactId) throw new BadRequestException('Contato não encontrado para gerar a cobrança.');
      customer = await this.crm.createCustomer(orgId, input.user_id || null, { contact_id: w.contactId, source: input.source === 'bot' ? 'bot' : input.source === 'api' ? 'api' : 'panel' }).catch(async (e) => {
        const again = (await this.identity.customersOfContact(orgId, w.contactId!))[0]?.customer;
        if (again) return again;
        throw e;
      });
    }
    let unitId: string | null = null;
    if (input.unit_id) {
      const u = await this.prisma.whatsapp_units.findFirst({ where: { id: String(input.unit_id), organization_id: orgId }, select: { id: true } });
      if (!u) throw new NotFoundException('Unidade não encontrada.');
      unitId = u.id;
    } else if (customer?.unit_id) unitId = customer.unit_id;
    const by: OrderBy = { by: input.source === 'bot' ? 'bot' : input.source === 'api' ? 'api' : 'staff', user_id: input.user_id || null };
    const now = new Date();
    const created = await this.withRetry(() => this.prisma.$transaction(async (tx: any) => {
      const number = await this.nextNumber(tx, orgId);
      return tx.whatsapp_orders.create({
        data: {
          organization_id: orgId, number, session_id: w.key?.session_id || null, chat_id: w.key?.chat_id || null, contact_id: w.contactId || null, customer_id: customer?.id || null, unit_id: unitId,
          items: items as any, ...totals, status: 'new', payment_method: totals.total_cents > 0 ? pm : 'none',
          payment_status: totals.total_cents <= 0 ? 'not_required' : pm === 'on_delivery' || pm === 'none' ? 'not_required' : 'pending',
          delivery: { mode, ...(address ? { address } : {}), ...(input.delivery?.notes ? { notes: String(input.delivery.notes).slice(0, 255) } : {}) } as any,
          notes: input.notes ? String(input.notes).slice(0, 2000) : null, source: input.source, custom: custom as any,
          history: [{ at: now.toISOString(), status: 'new', by: by.by, user_id: by.user_id || null }] as any, created_by: input.user_id || null,
        },
      });
    }, TX_OPTS));
    // cobrança (fora da transação: fala com o gateway). Sem cobrança = pedido cancelado (não fica "aguardando" para sempre).
    let charge: any = null;
    if (created.payment_method === 'pix') {
      try {
        charge = await this.charges.create(orgId, input.user_id || null, {
          customer_id: customer.id, amount_cents: created.total_cents, description: `Pedido #${created.number}`.slice(0, 255), kind: 'pix', __internal: true,
          // cobrança DO PEDIDO: fora da régua/inadimplência e com PIX de validade curta (contrato da revisão 14/10/2026)
          __purpose: 'order', __expires_minutes: s.pix_minutes,
          due_at: new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10),
          ...(w.key ? { session_id: w.key.session_id, chat_id: w.key.chat_id } : {}), send: input.source !== 'bot' && input.notify !== false, ...(input.bot?.flow_id ? { bot: input.bot } : {}),
        }, input.source === 'bot' ? 'bot' : 'manual');
        await this.prisma.whatsapp_orders.update({ where: { id: created.id }, data: { charge_id: charge.id } });
      } catch (e: any) {
        await this.prisma.whatsapp_orders.update({ where: { id: created.id }, data: { status: 'canceled', canceled_at: new Date(), cancel_reason: 'Falha ao gerar a cobrança' } }).catch(() => undefined);
        this.logger.warn(`pedido #${created.number}: cobrança falhou: ${e?.message || e}`);
        throw new BadRequestException(`Não foi possível gerar a cobrança do pedido. ${e?.response?.message || e?.message || ''}`.trim());
      }
    }
    const shaped = await this.get(orgId, created.id);
    this.logger.log(`pedido #${shaped.number} (${input.source}) ${shaped.total_label} · ${shaped.payment_method}`);
    this.emitOrder(orgId, 'created', shaped, { by: by.by, user_id: by.user_id || null });
    if (input.source !== 'bot' && input.notify !== false) await this.notifyCustomer(orgId, shaped, 'created', 'created');
    return { order: shaped, charge };
  }

  // ================================================================ andamento
  async setStatus(orgId: string, id: string, input: { status: string; reason?: string | null; notify?: boolean }, by: OrderBy) {
    const o = await this.row(orgId, id);
    const to = String(input.status) as OrderStatus;
    if (!(ORDER_STATUSES as readonly string[]).includes(to)) throw new BadRequestException('Status inválido.');
    if (to === o.status) return this.get(orgId, id);
    if (!canMove(o.status, to)) throw new BadRequestException(`Não dá para passar de "${ORDER_STATUS_LABEL[o.status as OrderStatus]}" para "${ORDER_STATUS_LABEL[to]}".`);
    const now = new Date();
    const data: any = { status: to, history: [...(Array.isArray(o.history) ? (o.history as any[]) : []), { at: now.toISOString(), status: to, by: by.by, user_id: by.user_id || null, ...(input.reason ? { note: String(input.reason).slice(0, 255) } : {}) }].slice(-50) };
    if (to === 'confirmed' && !o.confirmed_at) data.confirmed_at = now;
    if (to === 'delivered') { data.delivered_at = now; if (o.payment_method === 'on_delivery' && o.payment_status !== 'paid') { data.payment_status = 'paid'; data.paid_at = now; } }
    if (to === 'canceled') { data.canceled_at = now; data.cancel_reason = input.reason ? String(input.reason).slice(0, 255) : null; }
    const u = await this.prisma.whatsapp_orders.updateMany({ where: { id: o.id, status: o.status }, data });
    if (!u.count) throw new BadRequestException('O pedido mudou enquanto você editava. Atualize a tela.');
    if (to === 'canceled' && o.charge_id && o.payment_status !== 'paid') await this.charges.cancel(orgId, o.charge_id).catch((e: any) => this.logger.warn(`pedido #${o.number}: cancelar cobrança: ${e?.message || e}`));
    const shaped = await this.get(orgId, id);
    this.emitOrder(orgId, 'updated', shaped, { by: by.by, user_id: by.user_id || null, from: o.status });
    const s = await this.settings(orgId);
    if (input.notify !== false && (s.notify_customer as any)[to]) await this.notifyCustomer(orgId, shaped, to as any, to, to === 'canceled' && input.reason ? { 'pedido.motivo': ` Motivo: ${String(input.reason).slice(0, 200)}` } : {});
    return shaped;
  }

  /**
   * Marca pago à mão (dinheiro, maquininha, PIX direto…). Com cobrança EM ABERTO, ela é LIQUIDADA como baixa manual
   * (`paid_via:'manual'` pelo serviço de cobranças) — a receita aparece no Financeiro e os outros meios são cancelados
   * no gateway. Sem cobrança (ou cobrança já encerrada), o pedido conta como "Pedido pago na entrega" no Financeiro.
   */
  async markPaid(orgId: string, id: string, by: OrderBy) {
    const o = await this.row(orgId, id);
    if (o.status === 'canceled') throw new BadRequestException('Pedido cancelado.');
    if (o.payment_status === 'paid') return this.get(orgId, id);
    const now = new Date();
    // o pedido primeiro (condicional): o hook `charge_paid` da liquidação abaixo vê "pago" e não repete aviso/evento
    const u = await this.prisma.whatsapp_orders.updateMany({ where: { id: o.id, payment_status: { not: 'paid' }, status: { not: 'canceled' } }, data: { payment_status: 'paid', paid_at: now, history: [...(Array.isArray(o.history) ? (o.history as any[]) : []), { at: now.toISOString(), status: o.status, by: by.by, user_id: by.user_id || null, note: 'pago (marcado à mão)' }].slice(-50) as any } });
    if (!u.count) return this.get(orgId, id); // outra ação chegou antes (pago pelo PIX ou cancelado) — nada a emitir
    if (o.charge_id) {
      const c = await this.prisma.whatsapp_charges.findFirst({ where: { id: o.charge_id, organization_id: orgId }, select: { status: true } });
      if (c?.status === 'PENDING') {
        await this.charges.markPaid(orgId, by.user_id as string, o.charge_id).catch(async (e: any) => {
          // sem a baixa, o PIX não pode continuar aberto (o cliente pagaria duas vezes): cancela; o pedido conta como pago fora da cobrança
          this.logger.warn(`pedido #${o.number}: baixa manual da cobrança: ${e?.response?.message || e?.message || e}`);
          await this.charges.cancel(orgId, o.charge_id!).catch(() => undefined);
        });
      }
    }
    const shaped = await this.get(orgId, id);
    this.emitOrder(orgId, 'paid', shaped, { by: by.by, user_id: by.user_id || null, manual: true });
    return shaped;
  }

  async update(orgId: string, id: string, dto: { notes?: string | null; custom?: Record<string, unknown> | null; unit_id?: string | null }, by: OrderBy) {
    const o = await this.row(orgId, id);
    const data: any = {};
    if (dto.notes !== undefined) data.notes = dto.notes ? String(dto.notes).slice(0, 2000) : null;
    if (dto.custom !== undefined) data.custom = await this.cf.apply(orgId, 'order', dto.custom || {}, { mode: 'update', current: o.custom });
    if (dto.unit_id !== undefined) {
      if (dto.unit_id) { const u = await this.prisma.whatsapp_units.findFirst({ where: { id: String(dto.unit_id), organization_id: orgId }, select: { id: true } }); if (!u) throw new NotFoundException('Unidade não encontrada.'); data.unit_id = u.id; } else data.unit_id = null;
    }
    if (!Object.keys(data).length) return this.get(orgId, id);
    await this.prisma.whatsapp_orders.update({ where: { id: o.id }, data });
    const shaped = await this.get(orgId, id);
    this.emitOrder(orgId, 'updated', shaped, { by: by.by, user_id: by.user_id || null });
    return shaped;
  }

  private async onChargePaid(e: any) {
    const c = e?.charge;
    if (!c?.id) return;
    const orgId = e.orgId || c.organization_id;
    const o = await this.prisma.whatsapp_orders.findFirst({ where: { organization_id: orgId, charge_id: c.id } });
    if (!o || o.payment_status === 'paid') return;
    const now = new Date();
    if (o.status === 'canceled') return this.onPaidAfterCancel(orgId, o, now);
    const toConfirmed = o.status === 'new';
    const u = await this.prisma.whatsapp_orders.updateMany({
      where: { id: o.id, payment_status: { not: 'paid' } },
      data: { payment_status: 'paid', paid_at: now, ...(toConfirmed ? { status: 'confirmed', confirmed_at: o.confirmed_at || now } : {}), history: [...(Array.isArray(o.history) ? (o.history as any[]) : []), { at: now.toISOString(), status: toConfirmed ? 'confirmed' : o.status, by: 'system', note: 'pagamento confirmado' }].slice(-50) as any },
    });
    if (!u.count) return;
    const shaped = await this.get(orgId, o.id);
    this.emitOrder(orgId, 'paid', shaped, { by: 'system' });
    // pedido do bot: o bot avisa (porta "pago"); o resto recebe o texto "pago"
    if (o.source !== 'bot') await this.notifyCustomer(orgId, shaped, 'paid', 'paid');
  }

  /**
   * P7-4: o PIX foi pago DEPOIS do pedido cancelado (o cliente pagou o QR antigo, ou o cancelamento no gateway não
   * pegou). Registra o pagamento (o dinheiro entrou), NÃO reabre o pedido nem manda "pago" ao cliente e avisa a equipe
   * para estornar ou reabrir. Sem evento `order_paid` (a notificação "Pedido pago" enganaria); vai como `updated`.
   */
  private async onPaidAfterCancel(orgId: string, o: any, now: Date) {
    const note = 'PIX pago depois do cancelamento — estornar ou reabrir';
    const u = await this.prisma.whatsapp_orders.updateMany({
      where: { id: o.id, payment_status: { not: 'paid' } },
      data: { payment_status: 'paid', paid_at: now, history: [...(Array.isArray(o.history) ? (o.history as any[]) : []), { at: now.toISOString(), status: o.status, by: 'system', note }].slice(-50) as any },
    });
    if (!u.count) return;
    const shaped = await this.get(orgId, o.id);
    this.logger.warn(`pedido #${o.number}: ${note}`);
    this.emitOrder(orgId, 'updated', shaped, { by: 'system', paid_after_cancel: true });
    await this.notifications.notify(orgId, {
      kind: 'order_paid', important: true,
      title: `Pedido ${shaped.code} pago após o cancelamento`,
      body: `O cliente pagou ${shaped.total_label} por um pedido já cancelado. Estorne o valor ou reabra o pedido.`,
      url: `/whatsapp/orders?order=${encodeURIComponent(o.id)}`, tag: `order:${o.id}:paid_after_cancel`,
      sessionId: o.session_id || null, data: { order_id: o.id }, to: null,
    }).catch((e: any) => this.logger.warn(`pedido #${o.number}: aviso à equipe: ${e?.message || e}`));
  }

  // ================================================================ listas
  private scope(allowed: Set<string> | null) {
    return allowed === null ? null : { OR: [{ session_id: null }, ...(allowed.size ? [{ session_id: { in: [...allowed] } }] : [])] };
  }

  async list(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(10, parseInt(String(q.page_size || 50), 10) || 50));
    const where: any = { organization_id: orgId };
    const and: any[] = [];
    if (q.status) { const st = String(q.status) === 'open' ? [...OPEN_ORDER] : String(q.status).split(',').filter((x) => (ORDER_STATUSES as readonly string[]).includes(x)); if (st.length) where.status = { in: st }; }
    if (q.payment_status) where.payment_status = String(q.payment_status);
    if (q.unit_id) where.unit_id = String(q.unit_id);
    if (q.customer_id) where.customer_id = String(q.customer_id);
    if (q.contact_id) where.contact_id = String(q.contact_id);
    if (q.source) where.source = String(q.source);
    const date = (v: unknown, label: string) => { const d = new Date(String(v)); if (Number.isNaN(+d)) throw new BadRequestException(`Data inválida em "${label}".`); return d; };
    if (q.from) where.created_at = { ...(where.created_at || {}), gte: date(q.from, 'from') };
    if (q.to) where.created_at = { ...(where.created_at || {}), lt: date(q.to, 'to') };
    if (q.session_id) {
      if (allowed !== null && !allowed.has(String(q.session_id))) return { items: [], total: 0, page, page_size: size, pages: 1 };
      where.session_id = String(q.session_id);
    } else { const sc = this.scope(allowed); if (sc) and.push(sc); }
    const term = String(q.q || '').trim().replace(/^#/, '').slice(0, 80);
    if (term) {
      const digits = term.replace(/\D/g, '');
      const [custs, conts] = await Promise.all([
        this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, name: { contains: term } }, select: { id: true }, take: 200 }),
        this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ name: { contains: term } }, { push_name: { contains: term } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] }, select: { id: true }, take: 200 }),
      ]);
      and.push({ OR: [...(/^\d{1,9}$/.test(term) ? [{ number: Number(term) }] : []), ...(custs.length ? [{ customer_id: { in: custs.map((c) => c.id) } }] : []), ...(conts.length ? [{ contact_id: { in: conts.map((c) => c.id) } }] : []), { id: '__none__' }] });
    }
    if (and.length) where.AND = and;
    const [total, rows] = await Promise.all([this.prisma.whatsapp_orders.count({ where }), this.prisma.whatsapp_orders.findMany({ where, orderBy: { created_at: q.order === 'oldest' ? 'asc' : 'desc' }, skip: (page - 1) * size, take: size })]);
    return { items: await this.shapeMany(orgId, rows), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)) };
  }

  /** Quadro: colunas por status (abertos todos; entregues/cancelados só dos últimos 2 dias, até 50). */
  async board(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const base: any = { organization_id: orgId, ...(q.unit_id ? { unit_id: String(q.unit_id) } : {}), ...(q.session_id ? { session_id: String(q.session_id) } : {}) };
    const sc = this.scope(allowed);
    if (sc) base.AND = [sc];
    if (q.session_id && allowed !== null && !allowed.has(String(q.session_id))) return { columns: [] };
    const since = new Date(Date.now() - 2 * 86_400_000);
    const [open, closed] = await Promise.all([
      this.prisma.whatsapp_orders.findMany({ where: { ...base, status: { in: [...OPEN_ORDER] } }, orderBy: { created_at: 'asc' }, take: 500 }),
      this.prisma.whatsapp_orders.findMany({ where: { ...base, status: { in: ['delivered', 'canceled'] }, updated_at: { gte: since } }, orderBy: { updated_at: 'desc' }, take: 100 }),
    ]);
    const shaped = await this.shapeMany(orgId, [...open, ...closed]);
    return { columns: ORDER_STATUSES.map((st) => ({ status: st, label: ORDER_STATUS_LABEL[st], items: shaped.filter((o) => o.status === st) })) };
  }

  async counts(orgId: string, allowed: Set<string> | null = null, q: any = {}) {
    const sc = this.scope(allowed);
    if (q.session_id && allowed !== null && !allowed.has(String(q.session_id))) q = { ...q, session_id: '__none__' };
    const base: any = { organization_id: orgId, ...(sc ? { AND: [sc] } : {}), ...(q.unit_id ? { unit_id: String(q.unit_id) } : {}), ...(q.session_id ? { session_id: String(q.session_id) } : {}) };
    const startToday = new Date(new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10) + 'T03:00:00Z');
    const [byStatus, today, todaySum, unpaid] = await Promise.all([
      this.prisma.whatsapp_orders.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
      this.prisma.whatsapp_orders.count({ where: { ...base, created_at: { gte: startToday } } }),
      this.prisma.whatsapp_orders.aggregate({ where: { ...base, created_at: { gte: startToday }, status: { not: 'canceled' } }, _sum: { total_cents: true } }),
      this.prisma.whatsapp_orders.count({ where: { ...base, status: { in: [...OPEN_ORDER] }, payment_status: 'pending' } }),
    ]);
    const by: Record<string, number> = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
    for (const g of byStatus) by[g.status] = g._count._all;
    return { ...by, open: OPEN_ORDER.reduce((a, s) => a + (by[s] || 0), 0), today, today_cents: todaySum._sum.total_cents || 0, today_label: formatBRL(todaySum._sum.total_cents || 0), unpaid };
  }

  /** Bot: últimos pedidos do contato/cliente. */
  async ofContact(orgId: string, who: { contact_id?: string | null; customer_ids?: string[] | null }, opts: { limit?: number; open_only?: boolean } = {}) {
    const or: any[] = [];
    if (who.contact_id) or.push({ contact_id: who.contact_id });
    if (who.customer_ids?.length) or.push({ customer_id: { in: who.customer_ids } });
    if (!or.length) return [];
    const rows = await this.prisma.whatsapp_orders.findMany({ where: { organization_id: orgId, OR: or, ...(opts.open_only ? { status: { in: [...OPEN_ORDER] } } : {}) }, orderBy: { created_at: 'desc' }, take: Math.min(20, Math.max(1, opts.limit || 5)) });
    return this.shapeMany(orgId, rows);
  }

  async byChat(orgId: string, chatUuid: string, allowed: Set<string> | null = null) {
    const chat = await this.prisma.whatsapp_chats.findFirst({ where: { id: String(chatUuid), organization_id: orgId } });
    if (!chat) throw new NotFoundException('Conversa não encontrada.');
    const contact = await this.identity.contactOfJid(orgId, chat.session_id, chat.chat_id);
    const customers = contact ? (await this.identity.customersOfContact(orgId, contact.id)).map((x: any) => x.customer?.id).filter(Boolean) : [];
    const or: any[] = [{ session_id: chat.session_id, chat_id: chat.chat_id }];
    if (contact) or.push({ contact_id: contact.id });
    if (customers.length) or.push({ customer_id: { in: customers } });
    const sc = this.scope(allowed);
    const rows = await this.prisma.whatsapp_orders.findMany({ where: { organization_id: orgId, OR: or, ...(sc ? { AND: [sc] } : {}) }, orderBy: { created_at: 'desc' }, take: 30 });
    return { items: await this.shapeMany(orgId, rows) };
  }
}
