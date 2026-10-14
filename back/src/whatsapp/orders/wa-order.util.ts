// ============================================================================
// Pedidos (Fase 7 — contrato `docs/whatsapp-assinaturas-contrato.md` §11.3). PURO (sem Nest/Prisma, sem imports):
// configuração, totais, transições de status e textos. Testes: docs/tools/wa_order_util_test.mjs.
// ============================================================================

export const ORDER_STATUSES = ['new', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'canceled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const OPEN_ORDER = ['new', 'confirmed', 'preparing', 'out_for_delivery'] as const;
export const PAYMENT_METHODS = ['pix', 'on_delivery', 'link', 'none'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_STATUSES = ['pending', 'paid', 'not_required'] as const;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Recebido', confirmed: 'Confirmado', preparing: 'Em preparo', out_for_delivery: 'Saiu para entrega', delivered: 'Entregue', canceled: 'Cancelado',
};
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { pix: 'PIX', on_delivery: 'Na entrega', link: 'Link de pagamento', none: 'Sem pagamento' };
/** Rótulo do meio de pagamento: "na entrega" com retirada no local vira "Na retirada". */
export const paymentMethodLabel = (pm: string, delivery?: any) =>
  pm === 'on_delivery' && (delivery === 'pickup' || delivery?.mode === 'pickup') ? 'Na retirada' : (PAYMENT_METHOD_LABEL as any)[pm] || pm;
export const PAYMENT_STATUS_LABEL: Record<string, string> = { pending: 'Aguardando pagamento', paid: 'Pago', not_required: 'Paga na entrega' };

/** Próximos status permitidos (cancelar vale até antes de entregar). */
export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'preparing', 'canceled'],
  confirmed: ['preparing', 'out_for_delivery', 'delivered', 'canceled'],
  preparing: ['out_for_delivery', 'delivered', 'canceled'],
  out_for_delivery: ['delivered', 'canceled'],
  delivered: [],
  canceled: [],
};
export const canMove = (from: string, to: string) => (ORDER_FLOW as any)[from]?.includes(to) === true;

export type OrderTexts = { created: string; confirmed: string; paid: string; preparing: string; out_for_delivery: string; delivered: string; canceled: string };
export type OrderSettings = {
  enabled: boolean;
  delivery: { enabled: boolean; fee_cents: number; free_from_cents: number };
  pickup: { enabled: boolean; address: string };
  min_order_cents: number;
  payment_methods: PaymentMethod[];
  max_items: number;
  /** validade do PIX do pedido em minutos (5–1440; padrão 60) — passado ao criar a cobrança (`__expires_minutes`) */
  pix_minutes: number;
  notify_customer: { confirmed: boolean; preparing: boolean; out_for_delivery: boolean; delivered: boolean; canceled: boolean };
  texts: OrderTexts;
};

export const DEFAULT_ORDER_TEXTS: OrderTexts = {
  created: 'Recebemos seu pedido *#{{pedido.numero}}* ✅\n\n{{pedido.itens}}\n\n*Total: {{pedido.total}}*\n{{pedido.entrega}}\n💳 {{pedido.pagamento}}',
  confirmed: 'Pedido *#{{pedido.numero}}* confirmado 👍 Já vamos começar.',
  paid: 'Pagamento do pedido *#{{pedido.numero}}* confirmado ✅',
  preparing: 'Seu pedido *#{{pedido.numero}}* está sendo preparado 👨‍🍳',
  out_for_delivery: 'Seu pedido *#{{pedido.numero}}* saiu para entrega 🛵',
  delivered: 'Pedido *#{{pedido.numero}}* entregue. Obrigado pela preferência! 💚',
  canceled: 'O pedido *#{{pedido.numero}}* foi cancelado.{{pedido.motivo}}',
};

const int = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);

/** Nunca lança. */
export function normalizeOrderSettings(raw: any): OrderSettings {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = r.delivery && typeof r.delivery === 'object' ? r.delivery : {};
  const p = r.pickup && typeof r.pickup === 'object' ? r.pickup : {};
  const n = r.notify_customer && typeof r.notify_customer === 'object' ? r.notify_customer : {};
  const t = r.texts && typeof r.texts === 'object' ? r.texts : {};
  const methods = (Array.isArray(r.payment_methods) ? r.payment_methods : ['pix', 'on_delivery']).filter((m: any) => ['pix', 'on_delivery'].includes(m)); // 'link' fica reservado (sem geração de link ainda)
  const delivery = { enabled: bool(d.enabled, true), fee_cents: int(d.fee_cents, 0, 10_000_000, 0), free_from_cents: int(d.free_from_cents, 0, 100_000_000, 0) };
  const pickup = { enabled: bool(p.enabled, true), address: str(p.address, 255) };
  if (!delivery.enabled && !pickup.enabled) pickup.enabled = true; // sempre ao menos um jeito de receber
  return {
    enabled: bool(r.enabled, true),
    delivery, pickup,
    min_order_cents: int(r.min_order_cents, 0, 100_000_000, 0),
    payment_methods: (methods.length ? [...new Set(methods)] : ['pix']) as PaymentMethod[],
    max_items: int(r.max_items, 1, 100, 30),
    pix_minutes: int(r.pix_minutes, 5, 1440, 60),
    notify_customer: { confirmed: bool(n.confirmed, true), preparing: bool(n.preparing, true), out_for_delivery: bool(n.out_for_delivery, true), delivered: bool(n.delivered, true), canceled: bool(n.canceled, true) },
    texts: Object.fromEntries(Object.keys(DEFAULT_ORDER_TEXTS).map((k) => [k, str(t[k], 1500) || (DEFAULT_ORDER_TEXTS as any)[k]])) as OrderTexts,
  };
}

export type CatalogProduct = { id: string; name: string; price_cents: number; active: boolean; kind?: string | null; billing?: string | null };
export type OrderItemInput = { product_id: string; qty: number; notes?: string | null };
export type OrderItem = { product_id: string; name: string; qty: number; unit_cents: number; total_cents: number; notes?: string };

/**
 * Monta os itens com o preço DO BANCO (nunca do cliente), juntando linhas repetidas do mesmo produto.
 * Lança Error com mensagem amigável quando algo não vale (produto inexistente/inativo/recorrente, quantidade).
 */
export function buildItems(input: OrderItemInput[], products: CatalogProduct[], maxItems: number): OrderItem[] {
  if (!Array.isArray(input) || !input.length) throw new Error('O pedido está vazio.');
  const pm = new Map(products.map((p) => [p.id, p]));
  const merged = new Map<string, OrderItem>();
  for (const it of input) {
    const p = pm.get(String(it?.product_id || ''));
    if (!p || !p.active) throw new Error('Um dos produtos não está mais disponível.');
    if ((p.billing && p.billing !== 'once') || p.kind === 'plan' || p.kind === 'service') throw new Error(`"${p.name}" não é vendido como item de pedido.`);
    const qty = Math.round(Number(it?.qty));
    if (!(qty >= 1 && qty <= 999)) throw new Error(`Quantidade inválida para "${p.name}".`);
    const notes = str(it?.notes, 200);
    const key = `${p.id}|${notes}`;
    const cur = merged.get(key);
    if (cur) { cur.qty += qty; cur.total_cents = cur.qty * cur.unit_cents; }
    else merged.set(key, { product_id: p.id, name: p.name, qty, unit_cents: p.price_cents, total_cents: qty * p.price_cents, ...(notes ? { notes } : {}) });
  }
  const items = [...merged.values()];
  if (items.length > maxItems) throw new Error(`No máximo ${maxItems} itens diferentes por pedido.`);
  return items;
}

export function computeTotals(items: OrderItem[], s: OrderSettings, mode: 'delivery' | 'pickup', discount_cents = 0) {
  const subtotal = items.reduce((acc, i) => acc + i.total_cents, 0);
  const fee = mode === 'delivery' && s.delivery.enabled ? (s.delivery.free_from_cents > 0 && subtotal >= s.delivery.free_from_cents ? 0 : s.delivery.fee_cents) : 0;
  const discount = Math.max(0, Math.min(Math.round(discount_cents) || 0, subtotal + fee));
  return { subtotal_cents: subtotal, delivery_fee_cents: fee, discount_cents: discount, total_cents: subtotal + fee - discount };
}

const brl = (c: number) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const itemsText = (items: OrderItem[]) => items.map((i) => `${i.qty}× ${i.name} — ${brl(i.total_cents)}${i.notes ? ` (${i.notes})` : ''}`).join('\n');

/**
 * Endereço de ENTREGA do pedido normalizado (mesmo formato do endereço de unidade/cliente, com tetos por campo):
 * texto solto vira `{street}`; objeto guarda só as chaves conhecidas. `null` quando não sobra nada.
 */
export function normDeliveryAddress(raw: unknown): Record<string, string> | null {
  if (typeof raw === 'string') { const t = raw.trim().slice(0, 255); return t ? { street: t } : null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const a: any = raw;
  const out: Record<string, string> = {};
  const put = (k: string, v: string) => { if (v) out[k] = v; };
  put('label', str(a.label, 40));
  put('street', str(a.street, 120));
  put('number', str(String(a.number ?? ''), 20));
  put('complement', str(a.complement, 60));
  put('district', str(a.district, 80));
  put('city', str(a.city, 80));
  put('state', str(a.state, 2).toUpperCase());
  put('zip', String(a.zip ?? '').replace(/\D/g, '').slice(0, 8));
  put('notes', str(a.notes, 200));
  return Object.keys(out).some((k) => k !== 'label' && k !== 'notes') ? out : null;
}

export function addressLine(a: any): string {
  if (!a || typeof a !== 'object') return typeof a === 'string' ? a : '';
  return [[a.street, a.number].filter(Boolean).join(', '), a.complement, a.district, [a.city, a.state].filter(Boolean).join('/'), a.zip ? `CEP ${a.zip}` : ''].filter(Boolean).join(' · ');
}

export function deliveryText(delivery: any, s?: OrderSettings): string {
  if (!delivery || delivery.mode !== 'delivery') return `🏪 Retirada no local${s?.pickup?.address ? `: ${s.pickup.address}` : ''}`;
  const line = addressLine(delivery.address);
  return `🛵 Entrega${line ? `: ${line}` : ''}`;
}
