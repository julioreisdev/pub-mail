// Fluxo do Bot do WhatsApp — peças PURAS do runtime dos blocos de PEDIDOS e dos CAMPOS PERSONALIZADOS (Fase 7,
// contrato em docs/whatsapp-assinaturas-contrato.md §11.1 e §11.3). Sem banco e sem Nest (mesmo desenho do
// wa-bot-ticket.runtime.ts):
//  - `ORDER_ACTIONS`: ações que o runtime executa no WhatsAppOrdersService e respondem com `crm_result`
//  - `flowUsesOrders`: o fluxo precisa dos pedidos em andamento no contexto (condição / {{pedido.*}} fora dos blocos)?
//  - `flowUsesCustomFields`: o fluxo pergunta/mostra campos personalizados (o contexto leva as definições)?
//  - formatos do serviço → motor: `toBotOrder`, `toBotCatalog`, `toBotOrderSettings`, `toBotAddresses`, `cfMapForBot`,
//    `visibleFields`
//  - simulador: `simulateOrderAction` (pedido EM MEMÓRIA, nada é gravado), `fixtureOrders`, `cleanOrderFixture`,
//    `settleFixtureOrder`, `describeOrderAction`.
import { BotAction, BotAddress, BotCatalogCategory, BotCustomField, BotCustomFieldMap, BotDefinition, BotEventPayload, BotOrder, BotOrderSettings, BotState, cfDisplay, formatBRL } from './wa-bot.engine';
import { computeTotals, deliveryText, itemsText, normalizeOrderSettings, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, paymentMethodLabel } from '../orders/wa-order.util';

/** Ações de pedido que o runtime executa e respondem com `crm_result`. */
export const ORDER_ACTIONS = new Set(['order_catalog', 'order_create', 'order_list']);
/** Só leitura (o simulador com dados reais da org consulta de verdade; criar é sempre simulado). */
export const ORDER_READ_ACTIONS = new Set(['order_catalog', 'order_list']);

const ORDER_TYPES = new Set(['order_cart', 'my_orders']);
const ORDER_VAR_RE = /\{\{\s*pedidos?\./i;
const CF_TYPES = new Set(['crm_register', 'crm_info', 'open_ticket', 'my_tickets', 'order_cart', 'my_orders']);
const CF_VAR_RE = /\{\{\s*(cliente|chamado|pedido)\.(custom\.|campos)/i;

/**
 * O fluxo usa os pedidos do contato FORA dos blocos de pedido? Condição `source:'order'` ou texto com
 * `{{pedido.*}}`/`{{pedidos.lista}}` em blocos comuns. (Os blocos de pedido buscam o que precisam pelas ações.)
 */
export function flowUsesOrders(def: BotDefinition | null | undefined): boolean {
  const nodes = Array.isArray(def?.nodes) ? def!.nodes : [];
  const others: any[] = [];
  for (const n of nodes) {
    const t = String(n?.type || '');
    const d: any = n?.data || {};
    if (t === 'condition' && Array.isArray(d.rules) && d.rules.some((r: any) => r?.source === 'order')) return true;
    if (!ORDER_TYPES.has(t)) others.push(d);
  }
  try {
    return ORDER_VAR_RE.test(JSON.stringify(others));
  } catch {
    return false;
  }
}

/** O fluxo pergunta (cadastro/chamado/pedido) ou mostra (consultas, `{{cliente.custom.*}}`, `{{…campos}}`) campos personalizados? */
export function flowUsesCustomFields(def: BotDefinition | null | undefined): boolean {
  const nodes = Array.isArray(def?.nodes) ? def!.nodes : [];
  if (nodes.some((n) => CF_TYPES.has(String(n?.type || '')))) return true;
  try {
    return CF_VAR_RE.test(JSON.stringify(nodes));
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ formatos do serviço → motor
const str = (v: any) => (v == null ? '' : String(v));
const iso = (v: any) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

/** Definições do serviço (`normalizeCustomFieldMap`) → só as entidades que o bot usa. */
export function cfMapForBot(map: any): BotCustomFieldMap {
  const pick = (list: any): BotCustomField[] =>
    (Array.isArray(list) ? list : [])
      .filter((f: any) => f && f.key && f.label)
      .slice(0, 30)
      .map((f: any) => ({
        key: String(f.key).toLowerCase(),
        label: String(f.label),
        type: String(f.type || 'text'),
        required: f.required === true,
        ...(Array.isArray(f.options) ? { options: f.options.map(String).slice(0, 40) } : {}),
        visible_to_customer: f.visible_to_customer === true,
        ask_in_bot: f.ask_in_bot === true,
        ...(f.help ? { help: String(f.help).slice(0, 160) } : {}),
      }));
  const src = Array.isArray(map) ? { customer: map } : map && typeof map === 'object' ? map : {};
  return { customer: pick(src.customer), ticket: pick(src.ticket), order: pick(src.order) };
}

/** Campos VISÍVEIS ao cliente e preenchidos → `[{key, label, display}]` (o motor só mostra). */
export function visibleFields(defs: BotCustomField[] | null | undefined, custom: any): { key: string; label: string; display: string }[] {
  const c = custom && typeof custom === 'object' ? custom : {};
  return (defs || [])
    .filter((f) => f && f.visible_to_customer === true)
    .map((f) => ({ key: f.key, label: f.label, display: cfDisplay(f, c[f.key]) }))
    .filter((x) => x.display);
}

/** Pedido no formato do `WhatsAppOrdersService` (shape) → `BotOrder`. */
export function toBotOrder(o: any, defs: BotCustomField[] = []): BotOrder {
  const st = str(o?.status);
  return {
    id: str(o?.id),
    number: o?.number ?? '',
    status: st,
    status_label: str(o?.status_label || (ORDER_STATUS_LABEL as any)[st] || st),
    payment_method: str(o?.payment_method),
    payment_method_label: str(o?.payment_method_label || paymentMethodLabel(str(o?.payment_method), o?.delivery)),
    payment_status: str(o?.payment_status),
    payment_status_label: str(o?.payment_status_label || PAYMENT_STATUS_LABEL[str(o?.payment_status)] || o?.payment_status),
    items_text: str(o?.items_text ?? itemsText(Array.isArray(o?.items) ? o.items : [])),
    subtotal_cents: Number(o?.subtotal_cents) || 0,
    delivery_fee_cents: Number(o?.delivery_fee_cents) || 0,
    total_cents: Number(o?.total_cents) || 0,
    total_label: str(o?.total_label || formatBRL(Number(o?.total_cents) || 0)),
    delivery_text: str(o?.delivery_text ?? deliveryText(o?.delivery)),
    created_at: iso(o?.created_at),
    charge: o?.charge?.id ? { id: str(o.charge.id), status: str(o.charge.status), pix_code: o.charge.pix_code ?? null } : null,
    custom: o?.custom && typeof o.custom === 'object' ? o.custom : {},
    fields: visibleFields(defs, o?.custom),
  };
}

/** Catálogo do serviço (`catalog()`) → categorias do motor. */
export function toBotCatalog(c: any): { categories: BotCatalogCategory[] } {
  const cats = Array.isArray(c?.categories) ? c.categories : [];
  return {
    categories: cats
      .map((x: any) => ({
        name: str(x?.name),
        products: (Array.isArray(x?.products) ? x.products : [])
          .filter((p: any) => p?.id && p?.name)
          .map((p: any) => ({ id: str(p.id), name: str(p.name), description: p.description ? str(p.description) : null, price_cents: Number(p.price_cents) || 0, price_label: str(p.price_label || formatBRL(Number(p.price_cents) || 0)) })),
      }))
      .filter((x: any) => x.name && x.products.length),
  };
}

/** Configuração de pedidos (`settings()`) → o que o motor precisa (sem os textos da loja). */
export function toBotOrderSettings(raw: any): BotOrderSettings {
  const s = normalizeOrderSettings(raw);
  return {
    enabled: s.enabled,
    delivery: { enabled: s.delivery.enabled, fee_cents: s.delivery.fee_cents, free_from_cents: s.delivery.free_from_cents },
    pickup: { enabled: s.pickup.enabled, address: s.pickup.address },
    min_order_cents: s.min_order_cents,
    payment_methods: [...s.payment_methods],
    max_items: s.max_items,
  };
}

/** Endereços do cadastro do cliente (`whatsapp_customers.addresses`) → oferecidos na entrega (nunca o de cobrança). */
export function toBotAddresses(list: any): BotAddress[] {
  return (Array.isArray(list) ? list : [])
    .filter((a: any) => a && a.id && String(a.kind || 'other') !== 'billing' && (a.street || a.district || a.city))
    .sort((a: any, b: any) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)))
    .slice(0, 8)
    .map((a: any) => ({
      id: str(a.id),
      kind: str(a.kind || 'other'),
      label: a.label ? str(a.label) : null,
      ...(a.street ? { street: str(a.street) } : {}),
      ...(a.number ? { number: str(a.number) } : {}),
      ...(a.complement ? { complement: str(a.complement) } : {}),
      ...(a.district ? { district: str(a.district) } : {}),
      ...(a.city ? { city: str(a.city) } : {}),
      ...(a.state ? { state: str(a.state) } : {}),
      ...(a.zip ? { zip: str(a.zip) } : {}),
      ...(a.is_default ? { is_default: true } : {}),
    }));
}

// ================================================================== simulador (sem banco)
export type OrderFixture = {
  catalog?: any; // catálogo real (GET /whatsapp/orders/catalog) ou de exemplo
  order_settings?: any; // configuração real (GET /whatsapp/orders/settings) ou de exemplo
  orders?: any[]; // pedidos fictícios do contato (formato BotOrder)
  addresses?: any[]; // endereços salvos do cliente fictício
  fail_create?: boolean; // simula falha ao criar o pedido (testa a porta "Deu erro")
};

export const SAMPLE_CATALOG = {
  categories: [
    { name: 'Lanches', products: [{ id: 'sim-p1', name: 'X-Burguer', price_cents: 2500 }, { id: 'sim-p2', name: 'X-Salada', price_cents: 2800 }] },
    { name: 'Bebidas', products: [{ id: 'sim-p3', name: 'Refrigerante lata', price_cents: 600 }] },
  ],
};
export const SAMPLE_ORDER_SETTINGS = { enabled: true, delivery: { enabled: true, fee_cents: 500, free_from_cents: 0 }, pickup: { enabled: true, address: 'Rua Exemplo, 100' }, min_order_cents: 0, payment_methods: ['pix', 'on_delivery'], max_items: 30 };

/** Fixture do simulador (`crm_fixture.catalog/order_settings/orders/addresses`), copiada e limitada; nunca lança. */
export function cleanOrderFixture(raw: any): OrderFixture {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return {
    catalog: raw.catalog && typeof raw.catalog === 'object' ? raw.catalog : undefined,
    order_settings: raw.order_settings && typeof raw.order_settings === 'object' ? raw.order_settings : undefined,
    orders: Array.isArray(raw.orders) ? raw.orders.slice(0, 10) : undefined,
    addresses: Array.isArray(raw.addresses) ? raw.addresses.slice(0, 10) : undefined,
    fail_create: Boolean(raw.fail_create || raw.order_fail_create),
  };
}

/** Pedidos fictícios do contato: os criados na simulação (`state.__fixture_orders`, mais recentes primeiro) + os da fixture. */
export function fixtureOrders(state: BotState | null, fx: OrderFixture, defs: BotCustomField[] = []): BotOrder[] {
  const made: BotOrder[] = Array.isArray((state as any)?.__fixture_orders) ? (state as any).__fixture_orders : [];
  const base = (Array.isArray(fx.orders) ? fx.orders : [])
    .map((o) => toBotOrder(o, defs))
    .filter((o) => o.id && !made.some((m) => m.id === o.id));
  return [...[...made].reverse(), ...base];
}
function saveOrder(state: BotState, o: BotOrder) {
  const made: BotOrder[] = Array.isArray((state as any).__fixture_orders) ? [...(state as any).__fixture_orders] : [];
  const i = made.findIndex((x) => x.id === o.id);
  if (i >= 0) made[i] = o;
  else made.push(o);
  (state as any).__fixture_orders = made.slice(-10);
}

/** Pagou/Expirou no simulador: o pedido fictício da cobrança vira pago (e confirmado) — volta no payload. */
export function settleFixtureOrder(state: BotState | null, chargeId: string | null, paid: boolean): BotOrder | null {
  if (!state || !chargeId) return null;
  const made: BotOrder[] = Array.isArray((state as any).__fixture_orders) ? (state as any).__fixture_orders : [];
  const o = made.find((x) => x.charge?.id === chargeId) || (state.order?.order?.charge?.id === chargeId ? state.order.order : null);
  if (!o) return null;
  const next: BotOrder = paid
    ? { ...o, status: o.status === 'new' ? 'confirmed' : o.status, status_label: o.status === 'new' ? 'Confirmado' : o.status_label, payment_status: 'paid', payment_status_label: 'Pago', charge: o.charge ? { ...o.charge, status: 'PAID' } : o.charge }
    : { ...o, charge: o.charge ? { ...o.charge, status: 'EXPIRED' } : o.charge };
  saveOrder(state, next);
  return next;
}

const rid = () => Math.random().toString(36).slice(2, 10);

/**
 * Resolve uma ação de pedido EM MEMÓRIA (simulador). Devolve o `crm_result` e notas extras (inclusive a pseudo-ação
 * `{type:'charge', charge}` do PIX fictício). Pedidos "criados" ficam em `state.__fixture_orders`. Nada é gravado.
 * Preços: os do catálogo que o motor guardou no estado (o mesmo que o cliente viu).
 */
export function simulateOrderAction(a: BotAction, state: BotState, fx: OrderFixture, defs: BotCustomField[] = [], now: Date = new Date()): { payload: BotEventPayload | null; extra: any[] } {
  const extra: any[] = [];
  switch (a.type) {
    case 'order_catalog': {
      const catalog = toBotCatalog(fx.catalog && Array.isArray(fx.catalog.categories) && fx.catalog.categories.length ? fx.catalog : SAMPLE_CATALOG);
      return { payload: { ok: true, catalog, order_settings: toBotOrderSettings(fx.order_settings || SAMPLE_ORDER_SETTINGS), addresses: toBotAddresses(fx.addresses || []) }, extra };
    }
    case 'order_create': {
      if (fx.fail_create) return { payload: { ok: false, error: 'Simulação: falha ao criar o pedido.' }, extra };
      const products = new Map<string, any>();
      for (const c of state.order?.categories || []) for (const p of c.products || []) products.set(p.id, p);
      const items = (a.items || []).map((i) => {
        const p = products.get(i.product_id);
        const unit = Number(p?.price_cents) || 0;
        return { product_id: i.product_id, name: String(p?.name || 'Produto'), qty: i.qty, unit_cents: unit, total_cents: unit * i.qty };
      });
      if (!items.length || items.some((i) => !products.has(i.product_id))) return { payload: { ok: false, error: 'Item fora do catálogo', user_text: 'Um dos produtos não está mais disponível.' }, extra };
      const s = normalizeOrderSettings(state.order?.settings || fx.order_settings || SAMPLE_ORDER_SETTINGS);
      const mode = a.delivery?.mode === 'delivery' ? 'delivery' : 'pickup';
      const totals = computeTotals(items as any, s, mode);
      if (s.min_order_cents && totals.subtotal_cents < s.min_order_cents) return { payload: { ok: false, error: 'pedido mínimo', user_text: `O pedido mínimo é ${formatBRL(s.min_order_cents)}.` }, extra };
      const number = 1000 + fixtureOrders(state, fx).length + 1;
      const pm = totals.total_cents > 0 ? a.payment_method : 'none';
      const delivery = { mode, ...(mode === 'delivery' && a.delivery.address ? { address: a.delivery.address } : {}) };
      const custom = a.custom && typeof a.custom === 'object' ? { ...a.custom } : {};
      const o: BotOrder = toBotOrder(
        {
          id: `sim-ord-${rid()}`,
          number,
          status: 'new',
          payment_method: pm,
          payment_status: totals.total_cents <= 0 || pm === 'on_delivery' || pm === 'none' ? 'not_required' : 'pending',
          items,
          ...totals,
          delivery,
          delivery_text: deliveryText(delivery, s),
          created_at: now.toISOString(),
          custom,
        },
        defs,
      );
      let charge: any = null;
      if (pm === 'pix') {
        charge = { id: `sim-ch-${rid()}`, amount_cents: totals.total_cents, description: `Pedido #${number}`, due_at: now.toISOString().slice(0, 10), pix_code: `PIX-SIMULADO-${rid().toUpperCase()}`, sent: true };
        o.charge = { id: charge.id, status: 'PENDING', pix_code: charge.pix_code };
        extra.push({ type: 'charge', charge });
      }
      saveOrder(state, o);
      extra.push({ type: 'info', text: `Simulação: pedido fictício #${number} (${formatBRL(totals.total_cents)}) — nada foi gravado.` });
      return { payload: { ok: true, order: o, ...(charge ? { charge } : {}) }, extra };
    }
    case 'order_list': {
      const open = new Set(['new', 'confirmed', 'preparing', 'out_for_delivery']);
      const list = fixtureOrders(state, fx, defs).filter((o) => a.show === 'all' || open.has(o.status)).slice(0, Math.max(1, Math.min(10, Number(a.limit) || 5)));
      return { payload: { ok: true, orders: list }, extra };
    }
    default:
      return { payload: null, extra };
  }
}

/** Texto "o que o runtime faria" (log/simulador). */
export function describeOrderAction(a: BotAction): string {
  switch (a.type) {
    case 'order_catalog':
      return 'Buscando o catálogo e as configurações de pedidos…';
    case 'order_create':
      return `Criando o pedido (${(a.items || []).length} produto(s), ${a.delivery?.mode === 'delivery' ? 'entrega' : 'retirada'}, ${a.payment_method === 'pix' ? 'PIX' : a.payment_method === 'on_delivery' ? 'pagar na entrega' : 'sem pagamento'})…`;
    case 'order_list':
      return a.show === 'all' ? 'Buscando os pedidos do contato…' : 'Buscando os pedidos em andamento do contato…';
    default:
      return `Ação ${a.type}.`;
  }
}

/** Erro de campo personalizado do serviço (400 `{code:'CUSTOM_REQUIRED'|'CUSTOM_INVALID', fields}`) → texto para o cliente. */
export function customFieldsUserText(resp: any): string | null {
  const code = String(resp?.code || '');
  if (code !== 'CUSTOM_REQUIRED' && code !== 'CUSTOM_INVALID') return null;
  const labels = (Array.isArray(resp?.fields) ? resp.fields : []).map((f: any) => str(f?.label)).filter(Boolean).slice(0, 5);
  const list = labels.length ? `: ${labels.join(', ')}` : '';
  return code === 'CUSTOM_REQUIRED'
    ? `Não consegui concluir porque falta uma informação obrigatória${list} 😕 Fale com um atendente, por favor.`
    : `Não consegui concluir porque uma informação está em formato inválido${list} 😕 Fale com um atendente, por favor.`;
}
