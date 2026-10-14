// Fluxo do Bot do WhatsApp — peças PURAS do runtime dos blocos de CRM (Fase 2 das assinaturas,
// contrato em docs/whatsapp-assinaturas-contrato.md §1.4, §1.7 e §6). Sem banco e sem Nest:
//  - `flowUsesCrm`: o fluxo precisa do contexto de CRM? (fluxo antigo não paga as consultas)
//  - `fieldsToCustomerDto`: respostas do cadastro (name, doc, address.*, custom.*) → DTO do CRM
//  - `toBotCharge`: cobrança do serviço de cobranças → `BotState['charge']`
//  - simulador: `fixtureCtx` (cliente fictício), `simulateCrmAction` (resolve a ação EM MEMÓRIA),
//    `settleFixtureCharge` (Pagou/Expirou no simulador) e `describeCrmAction` (texto "Faria …").
import {
  BotAction,
  BotCharge,
  BotContext,
  BotCustomer,
  BotDefinition,
  BotEventPayload,
  BotIdentity,
  BotOpenCharge,
  BotProduct,
  BotState,
  BotSubscription,
  currentCustomer,
  formatBRL,
} from './wa-bot.engine';
import { maskDoc } from '../wa-doc.util';
import { BILLING_MONTHS, addMonths } from '../wa-subscription-math.util';

/** Ações de CRM que o runtime executa e respondem com `crm_result`. */
export const CRM_RESULT_ACTIONS = new Set([
  'crm_lookup',
  'crm_create_customer',
  'crm_subscribe',
  'crm_send_charge',
  'crm_cancel_subscription',
  'crm_pause_subscription',
  'crm_change_plan',
  'crm_update_customer',
]);
/** Todas as ações de CRM (inclui `charge_check`, que não muda o estado). */
export const CRM_ACTIONS = new Set([...CRM_RESULT_ACTIONS, 'charge_check']);
/** Limite de ações de CRM encadeadas numa mesma rodada (proteção contra laço). */
export const MAX_CRM_DEPTH = 8;

const CRM_VAR_RE = /\{\{\s*(cliente|assinatura|assinaturas|cobranca|cobrancas|produto)\./i;

/**
 * O fluxo usa dados do CRM? Blocos `crm_*`, regra de condição com `source:'customer'`, menu de
 * produtos ou texto com `{{cliente.*}}`/`{{assinatura.*}}`/`{{cobranca.*}}`/`{{produto.*}}`.
 * (O motor sobrescreve `{{cliente.*}}` com o cliente do contexto — por isso o texto também conta.)
 */
export function flowUsesCrm(def: BotDefinition | null | undefined): boolean {
  const nodes = Array.isArray(def?.nodes) ? def!.nodes : [];
  for (const n of nodes) {
    const t = String(n?.type || '');
    if (t.startsWith('crm_')) return true;
    const d: any = n?.data || {};
    if (t === 'menu' && d.source === 'products') return true;
    if (t === 'condition' && Array.isArray(d.rules) && d.rules.some((r: any) => r?.source === 'customer')) return true;
  }
  try {
    return CRM_VAR_RE.test(JSON.stringify(nodes));
  } catch {
    return false;
  }
}

const ADDRESS_KEYS = ['zip', 'street', 'number', 'complement', 'district', 'city', 'state'];

const NOTES_MAX = 20_000;
/** Carimbo "DD/MM/AAAA HH:MM" em Brasília para as observações escritas pelo bot. */
function botStamp(now: Date) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).replace(',', '');
  } catch {
    return now.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/**
 * Respostas do bloco de cadastro/atualização → DTO do `WhatsAppCrmService` (create/update).
 * Campo vazio (cliente respondeu "pular") não sobrescreve nada. `address`/`custom` são mesclados
 * com o que o cliente já tem (o CRM grava esses objetos inteiros). `notes` NUNCA substitui as
 * observações da equipe: o texto do cliente é ACRESCENTADO numa linha com carimbo "[bot DD/MM/AAAA HH:MM]".
 */
export function fieldsToCustomerDto(fields: Record<string, string> | null | undefined, cur?: { address?: any; custom?: any; notes?: string | null } | null, opts: { now?: Date } = {}) {
  const dto: Record<string, any> = {};
  const address: Record<string, string> = { ...((cur?.address && typeof cur.address === 'object' ? cur.address : {}) as any) };
  const custom: Record<string, string> = { ...((cur?.custom && typeof cur.custom === 'object' ? cur.custom : {}) as any) };
  let hasAddr = false;
  let hasCustom = false;
  for (const [rawKey, rawVal] of Object.entries(fields || {})) {
    const key = String(rawKey || '').trim();
    const val = String(rawVal ?? '').trim();
    if (!key || !val) continue;
    if (key === 'notes') {
      const prev = String(cur?.notes || '').trim();
      const line = `[bot ${botStamp(opts.now || new Date())}] ${val.slice(0, 1000)}`;
      dto.notes = `${prev ? `${prev}\n` : ''}${line}`.slice(-NOTES_MAX);
    } else if (['name', 'doc', 'email', 'code'].includes(key)) dto[key] = val;
    else if (key.startsWith('address.')) {
      const sub = key.slice(8);
      if (ADDRESS_KEYS.includes(sub)) {
        address[sub] = val;
        hasAddr = true;
      }
    } else if (key.startsWith('custom.')) {
      const ck = key.slice(7).toLowerCase().slice(0, 40);
      if (ck) {
        custom[ck] = val.slice(0, 500);
        hasCustom = true;
      }
    }
  }
  if (hasAddr) dto.address = address;
  if (hasCustom) dto.custom = custom;
  return dto;
}

/** Cobrança (formato do `WhatsAppChargesService`) → `BotState['charge']`. */
export function toBotCharge(c: any): BotCharge {
  return {
    id: String(c?.id || ''),
    amount_cents: Number(c?.amount_cents) || 0,
    description: String(c?.description || ''),
    due_at: c?.due_at ? String(c.due_at instanceof Date ? c.due_at.toISOString() : c.due_at).slice(0, 10) : null,
    pix_code: c?.pix?.code ?? c?.pix_code ?? null,
    boleto_url: c?.boleto?.url ?? c?.boleto_url ?? null,
  };
}

// ================================================================== simulador
export type CrmFixture = {
  customer?: BotCustomer | null;
  customers?: BotCustomer[];
  products?: BotProduct[];
  identity?: Partial<BotIdentity>;
  lookup?: Record<string, BotCustomer>;
  cancel_reasons?: string[];
};

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const rid = () => Math.random().toString(36).slice(2, 10);
const addDays = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const dmy = (ymd: string | null | undefined) => (ymd ? ymd.slice(0, 10).split('-').reverse().join('/') : '');
const isObj = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function normCustomer(c: any): BotCustomer | null {
  if (!isObj(c) || !c.id) return null;
  const name = String(c.name || '');
  return {
    id: String(c.id),
    name,
    first_name: String(c.first_name || name.trim().split(/\s+/)[0] || ''),
    doc_masked: String(c.doc_masked || ''),
    code: String(c.code || ''),
    email: String(c.email || ''),
    status: ['ok', 'overdue', 'none', 'inactive', 'paused'].includes(c.status) ? c.status : 'none',
    verified: Boolean(c.verified),
    custom: isObj(c.custom) ? Object.fromEntries(Object.entries(c.custom).map(([k, v]) => [String(k).toLowerCase(), String(v ?? '')])) : {},
    subscriptions: Array.isArray(c.subscriptions) ? c.subscriptions.filter((s: any) => isObj(s) && s.id) : [],
    open_charges: Array.isArray(c.open_charges) ? c.open_charges.filter((o: any) => isObj(o) && o.id) : [],
  };
}

/** Status do cliente fictício depois de uma mudança (mesma regra do `botCustomer`). */
function recomputeStatus(c: BotCustomer) {
  if (c.status === 'inactive') return;
  const live = (c.subscriptions || []).filter((s) => s.status === 'active' || s.status === 'overdue');
  c.status = live.some((s) => s.status === 'overdue') || (c.open_charges || []).some((o) => (o.days_overdue || 0) > 0)
    ? 'overdue'
    : live.length
      ? 'ok'
      : (c.subscriptions || []).some((s) => s.status === 'paused')
        ? 'paused'
        : 'none';
}

/**
 * Contexto de CRM do simulador a partir do cliente fictício. O cliente "atual" da simulação viaja no
 * estado (`state.__fixture_customer`) e tem prioridade sobre o da fixture (cadastro/assinatura feitos
 * na simulação continuam valendo na próxima mensagem).
 */
export function fixtureCtx(fx: CrmFixture, state: BotState | null, defaults: { identity: BotIdentity; cancel_reasons: string[] }) {
  const stored = normCustomer((state as any)?.__fixture_customer);
  const customers: BotCustomer[] = (Array.isArray(fx.customers) ? fx.customers : []).map(normCustomer).filter(Boolean) as BotCustomer[];
  const base = normCustomer(fx.customer);
  if (base && !customers.some((c) => c.id === base.id)) customers.unshift(base);
  if (stored) {
    const i = customers.findIndex((c) => c.id === stored.id);
    if (i >= 0) customers[i] = stored;
    else customers.push(stored);
  }
  const wanted = state?.customer_id || null;
  const customer = (wanted && customers.find((c) => c.id === wanted)) || stored || base || customers[0] || null;
  const products: BotProduct[] = (Array.isArray(fx.products) ? fx.products : [])
    .filter((p: any) => isObj(p) && p.id)
    .map((p: any) => ({
      id: String(p.id),
      name: String(p.name || 'Produto'),
      description: p.description ?? null,
      price_cents: Number(p.price_cents) || 0,
      price_label: String(p.price_label || formatBRL(Number(p.price_cents) || 0)),
      billing: String(p.billing || 'monthly'),
      billing_label: String(p.billing_label || ''),
      trial_days: Number(p.trial_days) || 0,
      cancel_policy: p.cancel_policy === 'immediate' ? 'immediate' : 'end_of_cycle',
      active: p.active !== false,
    }));
  const identity: BotIdentity = { ...defaults.identity, ...(isObj(fx.identity) ? (fx.identity as any) : {}) };
  identity.require_doc = Boolean(identity.require_doc);
  identity.use_code = Boolean(identity.use_code);
  const reasons = Array.isArray(fx.cancel_reasons) ? fx.cancel_reasons.map((r) => String(r || '').trim()).filter(Boolean).slice(0, 20) : defaults.cancel_reasons;
  return { customer, customers, products, identity, cancel_reasons: reasons };
}

function applyFields(c: BotCustomer, fields: Record<string, string>) {
  for (const [k, raw] of Object.entries(fields || {})) {
    const v = String(raw ?? '').trim();
    if (!v) continue;
    if (k === 'name') {
      c.name = v;
      c.first_name = v.split(/\s+/)[0] || '';
    } else if (k === 'doc') c.doc_masked = maskDoc(v) || v;
    else if (k === 'email') c.email = v.toLowerCase();
    else if (k === 'code') c.code = v;
    else if (k.startsWith('custom.')) c.custom[k.slice(7).toLowerCase()] = v;
  }
}

/**
 * Resolve uma ação de CRM EM MEMÓRIA (simulador com `crm_fixture`). Devolve o `crm_result` e as
 * pseudo-ações extras (`{type:'charge', charge}` quando uma cobrança "foi criada" ou reenviada).
 * `payload: null` = não há `crm_result` (ex.: `charge_check`).
 */
export function simulateCrmAction(a: BotAction, state: BotState, ctx: BotContext, fx: CrmFixture, today: string): { payload: BotEventPayload | null; extra: any[] } {
  const extra: any[] = [];
  const cur = currentCustomer(state, ctx);
  const own = () => (cur ? (clone(cur) as BotCustomer) : null);
  switch (a.type) {
    case 'crm_lookup': {
      const map = isObj(fx.lookup) ? fx.lookup : {};
      const raw = String(a.value || '').trim();
      const digits = raw.replace(/\D/g, '');
      const key = Object.keys(map).find((k) => k === raw || (a.by === 'doc' && digits && k.replace(/\D/g, '') === digits) || (a.by === 'code' && k.toLowerCase() === raw.toLowerCase()));
      const hit = key ? normCustomer(map[key]) : null;
      if (!hit) return { payload: { ok: true, customers: [] }, extra };
      // mesma regra do runtime: só o documento conferido vale como verificação; código/matrícula é só leitura
      if (a.by === 'doc') hit.verified = true;
      return { payload: { ok: true, customers: [hit] }, extra };
    }
    case 'crm_create_customer': {
      // mesma regra do runtime: cliente do número com documento DIFERENTE do digitado = outra pessoa (cliente novo);
      // senão completa/atualiza o atual sem tocar em documento/código já preenchidos
      const typed = String(a.fields?.doc || '').trim();
      const existing = own();
      const samePerson = existing && (!typed || !existing.doc_masked || maskDoc(typed) === existing.doc_masked);
      const c: BotCustomer = (samePerson && existing) || { id: `sim-cust-${rid()}`, name: '', first_name: '', doc_masked: '', code: '', email: '', status: 'none', verified: true, custom: {}, subscriptions: [], open_charges: [] };
      const fields = { ...a.fields };
      if (c.doc_masked) delete fields.doc;
      if (c.code) delete fields.code;
      applyFields(c, fields);
      if (!c.name) c.name = String(ctx.contact?.name || 'Cliente');
      if (!c.first_name) c.first_name = c.name.split(/\s+/)[0] || '';
      if (existing && !samePerson) extra.push({ type: 'info', text: 'Documento diferente do cadastro do número → cliente NOVO neste número (o antigo fica como está).' });
      return { payload: { ok: true, customer: c }, extra };
    }
    case 'crm_update_customer': {
      const c = own();
      if (!c) return { payload: { ok: false, error: 'Nenhum cliente identificado nesta conversa.' }, extra };
      if (!c.verified) return { payload: { ok: false, error: 'Cliente só consultado (código).', user_text: 'Para alterar a assinatura ou os dados, confirme o seu CPF/CNPJ (o código sozinho só permite consultar).' }, extra };
      const typedDoc = String(a.fields?.doc || '').trim();
      if (typedDoc && c.doc_masked && maskDoc(typedDoc) !== c.doc_masked) return { payload: { ok: false, error: 'doc imutável', user_text: 'O CPF/CNPJ do cadastro não pode ser alterado por aqui. Fale com um atendente 🙂' }, extra };
      const typedCode = String(a.fields?.code || '').trim();
      if (typedCode && c.code && typedCode !== c.code) return { payload: { ok: false, error: 'código imutável', user_text: 'O código do cliente não pode ser alterado por aqui. Fale com um atendente 🙂' }, extra };
      applyFields(c, a.fields);
      return { payload: { ok: true, customer: c }, extra };
    }
    case 'crm_subscribe': {
      const c = own();
      if (!c) return { payload: { ok: false, error: 'Nenhum cliente identificado nesta conversa.' }, extra };
      const p = (ctx.products || []).find((x) => x.id === a.product_id);
      if (!p) return { payload: { ok: false, error: 'Produto não encontrado.' }, extra };
      const once = p.billing === 'once';
      const trial = !once && (p.trial_days || 0) > 0;
      // próximo vencimento segue o período do produto (mesma conta de meses do serviço de assinaturas), não "+30 dias"
      const next = once ? null : trial ? addDays(today, p.trial_days) : addMonths(today, BILLING_MONTHS[String(p.billing)] || 1) || addDays(today, 30);
      const sub: BotSubscription = {
        id: `sim-sub-${rid()}`,
        product_id: p.id,
        product_name: p.name,
        price_cents: p.price_cents,
        price_label: p.price_label || formatBRL(p.price_cents),
        billing: p.billing,
        status: 'active',
        next_due_at: next,
        next_due_label: dmy(next),
        days_overdue: 0,
        due_day: next ? Math.min(28, Number(next.slice(8, 10))) : null,
        cancel_at: null,
        paused_until: null,
      };
      c.subscriptions = [...(c.subscriptions || []), sub];
      let charge: BotCharge | null = null;
      if (a.charge_now && !trial && p.price_cents >= 100) {
        const id = `sim-${rid()}${rid()}`;
        charge = {
          id,
          amount_cents: p.price_cents,
          description: p.name,
          due_at: today,
          pix_code: a.method === 'boleto' ? null : `PIX-SIMULADO-${id.slice(4, 12).toUpperCase()}`,
          boleto_url: a.method === 'boleto' ? `https://boleto.simulado.local/${id}` : null,
        };
        const open: BotOpenCharge = { id, amount_cents: p.price_cents, amount_label: formatBRL(p.price_cents), description: p.name, due_at: today, due_label: dmy(today), days_overdue: 0, kind: a.method, pix_code: charge.pix_code ?? null, boleto_url: charge.boleto_url ?? null, status: 'PENDING' };
        c.open_charges = [...(c.open_charges || []), open];
        extra.push({ type: 'charge', charge });
      }
      recomputeStatus(c);
      return { payload: { ok: true, customer: c, subscription: sub, ...(charge ? { charge } : {}) }, extra };
    }
    case 'crm_send_charge': {
      const o = (cur?.open_charges || []).find((x) => x.id === a.charge_id);
      if (!o) return { payload: { ok: false, error: 'Cobrança não encontrada.' }, extra };
      const kind = a.method === 'same' ? o.kind : a.method;
      const charge: BotCharge = {
        id: o.id,
        amount_cents: o.amount_cents,
        description: o.description,
        due_at: o.due_at,
        pix_code: kind === 'boleto' ? null : o.pix_code || `PIX-SIMULADO-${String(o.id).slice(0, 8).toUpperCase()}`,
        boleto_url: kind === 'pix' ? null : o.boleto_url || (kind === 'boleto' || kind === 'both' ? `https://boleto.simulado.local/${o.id}` : null),
      };
      extra.push({ type: 'charge', charge, resend: true });
      return { payload: { ok: true, charge }, extra };
    }
    case 'crm_cancel_subscription': {
      const c = own();
      const s = c?.subscriptions.find((x) => x.id === a.subscription_id);
      if (!c || !s) return { payload: { ok: false, error: 'Assinatura não encontrada.' }, extra };
      const product = (ctx.products || []).find((p) => p.id === s.product_id);
      const policy = a.policy === 'product' ? product?.cancel_policy || 'end_of_cycle' : a.policy;
      if (policy === 'immediate' || !s.next_due_at || s.next_due_at <= today || s.status === 'paused') {
        s.status = 'canceled';
        s.cancel_at = today;
        s.paused_until = null;
      } else s.cancel_at = s.next_due_at;
      recomputeStatus(c);
      return { payload: { ok: true, customer: c, subscription: s }, extra };
    }
    case 'crm_pause_subscription': {
      const c = own();
      const s = c?.subscriptions.find((x) => x.id === a.subscription_id);
      if (!c || !s) return { payload: { ok: false, error: 'Assinatura não encontrada.' }, extra };
      if (s.status === 'paused' || s.status === 'canceled') return { payload: { ok: false, error: 'Essa assinatura não pode ser pausada.' }, extra };
      s.status = 'paused';
      s.paused_until = addDays(today, Math.max(1, Math.min(365, Number(a.days) || 30)));
      recomputeStatus(c);
      return { payload: { ok: true, customer: c, subscription: s }, extra };
    }
    case 'crm_change_plan': {
      const c = own();
      const s = c?.subscriptions.find((x) => x.id === a.subscription_id);
      const p = (ctx.products || []).find((x) => x.id === a.product_id);
      if (!c || !s) return { payload: { ok: false, error: 'Assinatura não encontrada.' }, extra };
      if (!p) return { payload: { ok: false, error: 'Produto não encontrado.' }, extra };
      s.product_id = p.id;
      s.product_name = p.name;
      s.price_cents = p.price_cents;
      s.price_label = p.price_label || formatBRL(p.price_cents);
      s.billing = p.billing;
      return { payload: { ok: true, customer: c, subscription: s, product: p }, extra };
    }
    case 'charge_check':
      return { payload: null, extra: [{ type: 'info', text: 'O cliente disse que pagou — o bot confere no gateway. No simulador, use “Pagou” ou “Expirou”.' }] };
    default:
      return { payload: null, extra };
  }
}

/** Pagou/Expirou no simulador: tira a cobrança das abertas (paga) e devolve o cliente atualizado. */
export function settleFixtureCharge(c: BotCustomer | null, chargeId: string | null | undefined, paid: boolean): BotCustomer | null {
  if (!c) return null;
  const out = clone(c) as BotCustomer;
  if (paid && chargeId) {
    out.open_charges = (out.open_charges || []).filter((o) => o.id !== chargeId);
    if (!out.open_charges.some((o) => (o.days_overdue || 0) > 0)) for (const s of out.subscriptions || []) if (s.status === 'overdue') { s.status = 'active'; s.days_overdue = 0; }
  }
  recomputeStatus(out);
  return out;
}

const POLICY_LABEL: Record<string, string> = { product: 'política do produto', immediate: 'imediato', end_of_cycle: 'no fim do ciclo' };
const FIELD_LABEL: Record<string, string> = { name: 'nome', doc: 'CPF/CNPJ', email: 'e-mail', code: 'código', notes: 'observações' };

function fieldsSummary(fields: Record<string, string>) {
  const parts = Object.entries(fields || {})
    .filter(([, v]) => String(v ?? '').trim())
    .map(([k, v]) => `${FIELD_LABEL[k] || k.replace(/^address\./, 'endereço.').replace(/^custom\./, '')}: ${k === 'doc' ? maskDoc(String(v)) || '***' : String(v).slice(0, 60)}`);
  return parts.length ? parts.join(', ') : 'nenhum campo preenchido';
}

/** Texto "o que o runtime faria" (simulador sem cliente fictício). */
export function describeCrmAction(a: BotAction, ctx: BotContext): string {
  const pname = (id: string) => (ctx.products || []).find((p) => p.id === id)?.name || 'produto';
  switch (a.type) {
    case 'crm_lookup':
      return `Procuraria o cliente pelo ${a.by === 'code' ? 'código' : 'CPF/CNPJ'} ${a.by === 'doc' ? maskDoc(a.value) || a.value : a.value}.`;
    case 'crm_create_customer':
      return `Cadastraria o cliente com ${fieldsSummary(a.fields)}.`;
    case 'crm_update_customer':
      return `Atualizaria o cadastro: ${fieldsSummary(a.fields)}.`;
    case 'crm_subscribe':
      return `Criaria a assinatura de “${pname(a.product_id)}”${a.charge_now ? ` e enviaria a 1ª cobrança por ${a.method === 'boleto' ? 'boleto' : 'PIX'}` : ' sem cobrar agora'}.`;
    case 'crm_send_charge':
      return `Reenviaria a 2ª via da cobrança (${a.method === 'same' ? 'mesmo meio' : a.method}) com juros/multa do dia.`;
    case 'charge_check':
      return 'Conferiria o pagamento no gateway.';
    case 'crm_cancel_subscription':
      return `Cancelaria a assinatura (${POLICY_LABEL[a.policy] || a.policy})${a.reason ? ` — motivo: ${a.reason}` : ''}.`;
    case 'crm_pause_subscription':
      return `Pausaria a assinatura por ${a.days} ${a.days === 1 ? 'dia' : 'dias'}.`;
    case 'crm_change_plan':
      return `Trocaria o plano para “${pname(a.product_id)}”.`;
    default:
      return `Ação ${a.type}.`;
  }
}
