import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cancelChargeRemote } from '../payments/gateways.util';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { WhatsAppOutboxService } from './whatsapp-outbox.service';
import { WhatsAppCustomFieldsService } from './whatsapp-custom-fields.service';
import { ChargeSettings, normalizeChargeSettings } from './wa-charge-settings.util';
import { fillCrmVars, firstName, formatBRL } from './wa-crm-vars.util';
import { BILLING_MONTHS, addDays, addMonths, applyCoupon, couponUntil, creditCents, cycleMonthsOf, daysBetween, discountActive, fmtDateBR, isDateStr, nextDueAfterPause, nextDueFromDate, prorateCents, readjustCents, toDate, toDateStr } from './wa-subscription-math.util';

// ============================================================================
// Motor de assinatura (Fase 3) — trial, pró-rata, cupom, troca de plano (crédito), cancelamento
// com política (imediato / fim do ciclo), pausa programada, reajuste, auditoria (eventos).
//
//  - Usado pelo CRM (`addSubscription` delega), pelo bot (ações crm_*) e pelas cobranças
//    (`amountFor` = preço com desconto vigente; `markPaid` ao liquidar).
//  - NÃO importa o CRM nem as cobranças (eles importam este). Cancelar cobranças PENDING da
//    assinatura é feito direto no gateway (`cancelCharge`) + `hooks.emit('charge_canceled')`.
//  - Avisos ao cliente (trial acabando, cancelamento, pausa, retomada, troca, reajuste) vão pela
//    fila `whatsapp_outbox` (ritmo por número) com os textos de `whatsapp_crm_settings.charge.texts`.
//  - Datas de vencimento são DATE em BRT (`brtDateStr`); a matemática pura está em
//    `wa-subscription-math.util.ts` ("hoje" sempre é parâmetro).
//
// 1ª cobrança: `createSubscription` devolve `first_charge` (valor/vencimento/descrição). Só quando
// `meta.auto_charge === true` (painel com "Cobrar a 1ª agora" / API com `charge_now`) ela é guardada em
// `custom.first_charge` e o hook `subscription_first_charge` faz o serviço de cobranças criar/enviar na
// hora (o runner diário é a rede de segurança). Sem isso NADA é cobrado agora: cadastrar cliente antigo
// ou importar planilha não dispara cobrança — a próxima sai pelo runner, N dias antes de `next_due_at`.
// O bot (`source:'bot'`) cria a cobrança ele mesmo.
// ============================================================================

export type SubSource = 'panel' | 'bot' | 'api' | 'import' | 'system';
/** Cobrança do fim do teste grátis quando o dia de vencimento escolhido ≠ fim do teste (`custom.trial_charge`). */
export type TrialCharge = { due_at: string; next_due_at: string; mode: 'prorate' | 'full'; days: number; amount_cents: number };
export type SubMeta = { source: SubSource; user_id?: string | null; auto_charge?: boolean };
export const SUB_EVENT_KINDS = ['created', 'trial_started', 'activated', 'paid', 'overdue', 'paused', 'resumed', 'plan_changed', 'canceled', 'reactivated', 'price_changed', 'coupon_applied', 'manual_edit', 'paid_after_cancel'] as const;
/** Chaves de `custom` que são do MOTOR (marcas internas) — o cliente da API nunca grava/apaga essas. */
export const RESERVED_CUSTOM_KEYS = ['first_charge', 'trial_charge', 'paused_from', 'status_before_pause', 'readjusted', 'notified', 'plan_credit'] as const;
/** `custom` vindo do cliente: sem chaves reservadas, no máx. 40 chaves, strings de até 500 chars (mesmo padrão dos produtos). */
export function sanitizeCustom(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).slice(0, 40);
    if (!key || (RESERVED_CUSTOM_KEYS as readonly string[]).includes(key)) continue;
    out[key] = typeof v === 'string' ? v.slice(0, 500) : v;
    if (Object.keys(out).length >= 40) break;
  }
  return out;
}
const MAINT_BATCH = 500; // lotes do `dailyMaintenance` (cursor por id — orgs com dezenas de milhares de assinaturas)
export const BILLING_LABEL: Record<string, string> = { once: 'Avulso', monthly: 'Mensal', quarterly: 'Trimestral', semiannual: 'Semestral', yearly: 'Anual' };
export const BILLING_OF_MONTHS: Record<number, string> = { 1: 'monthly', 3: 'quarterly', 6: 'semiannual', 12: 'yearly' };
const BRT = 'America/Sao_Paulo';
export const brtDateStr = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: BRT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); // YYYY-MM-DD
export const dateOnlyUTC = (s: string) => new Date(`${s}T00:00:00Z`);
const COUPON_CODE_RE = /^[A-Z0-9_-]{2,32}$/;
const normCode = (v: unknown) => String(v || '').trim().toUpperCase().replace(/\s+/g, '');
const clampInt = (v: unknown, min: number, max: number, def: number) => { const n = parseInt(String(v), 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };

/** Meio de pagamento escolhido para a assinatura (Fase 4). `null` = o padrão das cobranças. */
export const PAYMENT_METHODS = ['pix', 'boleto', 'both', 'card'];

export type ShapedSubscription = {
  id: string; customer_id: string; product_id: string | null; product_name: string; price_cents: number; price_label: string; billing: string; billing_label: string; cycle_months: number; due_day: number | null;
  status: 'active' | 'overdue' | 'paused' | 'canceled'; started_at: string | null; next_due_at: string | null; next_due_label: string; days_to_due: number | null;
  trial_ends_at: string | null; paused_until: string | null; cancel_at: string | null; cancel_reason: string | null; coupon_id: string | null; coupon_code: string | null; discount_cents: number; discount_until: string | null;
  payment_method: string | null; payment_method_id: string | null;
  amount_cents: number; amount_label: string; external_id: string | null; contract_number: string | null; custom: Record<string, unknown>; notes: string | null; source: string;
  last_paid_at: Date | null; canceled_at: Date | null; created_at: Date; updated_at: Date;
  first_charge?: { amount_cents: number; due_at: string; description: string } | null;
};

@Injectable()
export class WhatsAppSubscriptionsService {
  private readonly logger = new Logger(WhatsAppSubscriptionsService.name);
  constructor(private readonly prisma: PrismaService, private readonly hooks: WhatsAppHooks, private readonly outbox: WhatsAppOutboxService, private readonly cf: WhatsAppCustomFieldsService) {}

  // ---------------------------------------------------------------- leitura básica
  async chargeSettings(orgId: string): Promise<ChargeSettings> {
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { charge: true } });
    return normalizeChargeSettings(row?.charge);
  }
  private async row(orgId: string, subId: string) {
    const s = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id: String(subId || ''), organization_id: orgId } });
    if (!s) throw new NotFoundException('Assinatura não encontrada.');
    return s;
  }
  private async product(orgId: string, productId: string | null | undefined) {
    if (!productId) return null;
    return this.prisma.whatsapp_products.findFirst({ where: { id: String(productId), organization_id: orgId } });
  }
  private async customerOf(orgId: string, customerId: string) {
    const c = await this.prisma.whatsapp_customers.findFirst({ where: { id: customerId, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cliente não encontrado.');
    return c;
  }

  /** Meses do ciclo da assinatura (produto pode ter intervalo próprio; sem produto, pelo `billing`). */
  cycleMonths(sub: any, product?: any): number {
    return cycleMonthsOf(sub?.billing, product && product.id === sub?.product_id ? product.billing_interval_months : null) || BILLING_MONTHS[String(sub?.billing || '')] || 0;
  }

  /** Preço da próxima cobrança: `price_cents` menos o desconto vigente (cupom/crédito) para o vencimento. */
  amountFor(sub: any, product?: any, forDate?: string | Date | null): number {
    void product;
    const base = Math.max(0, Math.round(Number(sub?.price_cents) || 0));
    const ref = forDate ?? sub?.next_due_at ?? null;
    if (!discountActive(sub?.discount_cents, sub?.discount_until, ref)) return base;
    return Math.max(0, base - Math.round(Number(sub.discount_cents) || 0));
  }

  /**
   * Cobrança do fim do teste (`custom.trial_charge`) para o vencimento `dueStr`: valor proporcional (ou cheio) e
   * descrição. null quando o vencimento não é o do fim do teste.
   */
  trialChargeFor(sub: any, product: any, dueStr: string): { amount_cents: number; description: string; next_due_at: string } | null {
    const tc: any = sub?.custom && typeof sub.custom === 'object' ? (sub.custom as any).trial_charge : null;
    if (!tc || toDateStr(tc.due_at) !== dueStr) return null;
    const base = this.amountFor(sub, product, dueStr);
    if (tc.mode === 'full') return { amount_cents: base, description: sub.product_name, next_due_at: tc.next_due_at };
    const cycle = this.cycleMonths(sub, product) || 1;
    const days = daysBetween(dueStr, tc.next_due_at);
    return { amount_cents: prorateCents(base, dueStr, tc.next_due_at, cycle), description: `${sub.product_name} (proporcional, ${days} dia${days === 1 ? '' : 's'})`.slice(0, 255), next_due_at: tc.next_due_at };
  }

  /**
   * Status ao vivo: ativa com `1 + carência` dias de atraso = em atraso. Quem GRAVA `overdue` é o runner
   * (mesma régua); aqui só se reporta. `graceDays` = `grace_days` do produto (ou `grace_days_default` da org).
   */
  liveStatus(sub: any, today = brtDateStr(), graceDays = 0): ShapedSubscription['status'] {
    if (sub.status === 'active' && sub.next_due_at) {
      const late = daysBetween(toDateStr(sub.next_due_at), today);
      if (late >= 1 + Math.max(0, Math.round(Number(graceDays) || 0))) return 'overdue';
    }
    return sub.status;
  }

  /**
   * Relê `custom` na hora de gravar e mexe SÓ nas chaves pedidas (`undefined` apaga a chave) — pausa, retomada,
   * pagamento e cancelamento concorrentes não apagam as marcas um do outro. `data` = outras colunas na mesma escrita.
   */
  private async patchCustom(subId: string, patch: Record<string, unknown>, data: Record<string, unknown> = {}) {
    const s = await this.prisma.whatsapp_subscriptions.findUnique({ where: { id: subId }, select: { custom: true } });
    const custom: Record<string, unknown> = s?.custom && typeof s.custom === 'object' ? { ...(s.custom as Record<string, unknown>) } : {};
    for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete custom[k]; else custom[k] = v; }
    return this.prisma.whatsapp_subscriptions.update({ where: { id: subId }, data: { ...data, custom: custom as any } });
  }

  shape(s: any, extra?: { coupon_code?: string | null; first_charge?: ShapedSubscription['first_charge']; today?: string; grace_days?: number }): ShapedSubscription {
    const today = extra?.today || brtDateStr();
    const status = this.liveStatus(s, today, extra?.grace_days || 0);
    const next = toDateStr(s.next_due_at) || null;
    const custom = s.custom && typeof s.custom === 'object' ? (s.custom as Record<string, unknown>) : {};
    const amount = this.amountFor(s);
    return {
      id: s.id, customer_id: s.customer_id, product_id: s.product_id, product_name: s.product_name,
      price_cents: s.price_cents, price_label: formatBRL(s.price_cents), billing: s.billing, billing_label: BILLING_LABEL[s.billing] || s.billing, cycle_months: BILLING_MONTHS[s.billing] || 0,
      due_day: s.due_day, status, started_at: toDateStr(s.started_at) || null,
      next_due_at: next, next_due_label: fmtDateBR(next), days_to_due: next ? daysBetween(today, next) : null,
      trial_ends_at: toDateStr(s.trial_ends_at) || null, paused_until: toDateStr(s.paused_until) || null, cancel_at: toDateStr(s.cancel_at) || null, cancel_reason: s.cancel_reason || null,
      coupon_id: s.coupon_id || null, coupon_code: extra?.coupon_code ?? null, discount_cents: s.discount_cents || 0, discount_until: toDateStr(s.discount_until) || null,
      amount_cents: amount, amount_label: formatBRL(amount),
      external_id: s.external_id || null, contract_number: s.contract_number || null, custom, notes: s.notes, source: s.source || 'panel',
      payment_method: s.payment_method || null, payment_method_id: s.payment_method_id || null,
      last_paid_at: s.last_paid_at, canceled_at: s.canceled_at, created_at: s.created_at, updated_at: s.updated_at,
      ...(extra && 'first_charge' in extra ? { first_charge: extra.first_charge ?? null } : {}),
    };
  }

  /** Vários de uma vez (busca os códigos dos cupons e a carência de cada produto). */
  async shapeMany(orgId: string, rows: any[]): Promise<ShapedSubscription[]> {
    if (!rows.length) return [];
    const ids = [...new Set(rows.map((r) => r.coupon_id).filter(Boolean))] as string[];
    const pids = [...new Set(rows.map((r) => r.product_id).filter(Boolean))] as string[];
    const [coupons, products, cfg] = await Promise.all([
      ids.length ? this.prisma.whatsapp_coupons.findMany({ where: { organization_id: orgId, id: { in: ids } }, select: { id: true, code: true } }) : Promise.resolve([] as Array<{ id: string; code: string }>),
      pids.length ? this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId, id: { in: pids } }, select: { id: true, grace_days: true } }) : Promise.resolve([] as Array<{ id: string; grace_days: number | null }>),
      this.chargeSettings(orgId),
    ]);
    const code = new Map<string, string>(coupons.map((c) => [c.id, c.code] as [string, string]));
    const grace = new Map<string, number>(products.map((p) => [p.id, p.grace_days || 0] as [string, number]));
    const today = brtDateStr();
    return rows.map((r) => this.shape(r, { coupon_code: r.coupon_id ? code.get(r.coupon_id) || null : null, today, grace_days: r.product_id && grace.has(r.product_id) ? grace.get(r.product_id) : cfg.grace_days_default }));
  }
  /** Uma linha já lida → shaped com cupom e carência (transições usam depois de gravar). */
  private async shapeOne(orgId: string, row: any): Promise<ShapedSubscription> {
    return (await this.shapeMany(orgId, [row]))[0];
  }

  async get(orgId: string, subId: string): Promise<ShapedSubscription> {
    return this.shapeOne(orgId, await this.row(orgId, subId));
  }

  // ---------------------------------------------------------------- eventos
  async recordEvent(orgId: string, subId: string, kind: (typeof SUB_EVENT_KINDS)[number], data: Record<string, unknown> | null, meta: Partial<SubMeta> = {}) {
    const ev = await this.prisma.whatsapp_subscription_events.create({ data: { organization_id: orgId, subscription_id: subId, kind, data: data as any, user_id: meta.user_id || null, source: meta.source || 'system' } }).catch((e) => { this.logger.warn(`evento ${kind} ${subId}: ${e?.message || e}`); return null; });
    // Fase 5: TODO evento de assinatura passa por aqui → motor de acesso (entitlements) e webhooks de saída
    this.hooks.emit('subscription_event', { orgId, subscription_id: subId, kind, data: data || {}, source: meta.source || 'system', event_id: ev?.id || null });
    return ev;
  }
  /** Vários eventos de uma vez (rotina diária: milhares de "em atraso" num lote) — 1 INSERT por lote, mesmos hooks. */
  async recordEvents(orgId: string, list: Array<{ subId: string; kind: (typeof SUB_EVENT_KINDS)[number]; data: Record<string, unknown> | null }>, meta: Partial<SubMeta> = {}) {
    if (!list.length) return 0;
    const source = meta.source || 'system';
    for (let i = 0; i < list.length; i += 500) {
      const part = list.slice(i, i + 500);
      await this.prisma.whatsapp_subscription_events.createMany({ data: part.map((e) => ({ organization_id: orgId, subscription_id: e.subId, kind: e.kind, data: (e.data ?? undefined) as any, user_id: meta.user_id || null, source })) }).catch((e) => this.logger.warn(`eventos em lote: ${e?.message || e}`));
    }
    for (const e of list) this.hooks.emit('subscription_event', { orgId, subscription_id: e.subId, kind: e.kind, data: e.data || {}, source, event_id: null });
    return list.length;
  }

  async events(orgId: string, subId: string) {
    await this.row(orgId, subId);
    const rows = await this.prisma.whatsapp_subscription_events.findMany({ where: { organization_id: orgId, subscription_id: subId }, orderBy: [{ created_at: 'asc' }], take: 500 });
    return rows.map((e) => ({ id: e.id, kind: e.kind, data: e.data, user_id: e.user_id, source: e.source, created_at: e.created_at }));
  }

  // ---------------------------------------------------------------- avisos (fila)
  private subVars(customer: any, sub: ShapedSubscription, cfg?: ChargeSettings) {
    const name = String(customer?.name || '');
    const fimTexto = sub.cancel_at ? `Seu acesso continua até ${fmtDateBR(sub.cancel_at)}.` : 'O cancelamento vale a partir de agora.';
    return {
      nome: name, 'cliente.nome': name, 'cliente.primeiro_nome': firstName(name),
      'assinatura.produto': sub.product_name, 'assinatura.valor': sub.amount_label, 'assinatura.vencimento': sub.next_due_label, 'assinatura.dia_vencimento': sub.due_day ? String(sub.due_day) : '',
      'assinatura.status': sub.status === 'overdue' ? 'em atraso' : sub.status === 'paused' ? 'pausada' : sub.status === 'canceled' ? 'cancelada' : 'em dia',
      'assinatura.fim': fmtDateBR(sub.cancel_at), 'assinatura.fim_texto': fimTexto, 'assinatura.pausa_ate': fmtDateBR(sub.paused_until), 'assinatura.fim_teste': fmtDateBR(sub.trial_ends_at),
      'assinatura.reajuste': cfg ? `${String(cfg.readjust.percent).replace('.', ',')}%` : '',
    };
  }

  /** Enfileira um texto de `settings.texts[key]` para o cliente (best-effort; nunca lança). `cfg` = configurações já lidas (lotes do runner). */
  private async notify(orgId: string, customer: any, sub: ShapedSubscription, key: keyof ChargeSettings['texts'], extraVars: Record<string, string> = {}, source?: string | null, cfg?: ChargeSettings) {
    // pedido pelo bot: quem responde na conversa é o próprio bloco (canceled_text/paused_text/changed_text) — sem aviso em dobro
    if (source === 'bot') return null;
    try {
      const settings = cfg || (await this.chargeSettings(orgId));
      const text = fillCrmVars(settings.texts[key], { ...this.subVars(customer, sub, settings), ...extraVars }).trim();
      if (!text) return null;
      return await this.outbox.enqueueForCustomer(orgId, customer, `subscription_${key}`, { text, mark: { subscription: sub.id } }, { dedupe_key: `sub:${sub.id}:${key}:${brtDateStr()}` });
    } catch (e: any) { this.logger.warn(`aviso ${key} ${sub.id}: ${e?.message || e}`); return null; }
  }

  // ---------------------------------------------------------------- cupons
  private shapeCoupon(c: any, today = brtDateStr()) {
    const expired = c.expires_at ? toDateStr(c.expires_at) < today : false;
    const exhausted = c.max_uses != null && c.used >= c.max_uses;
    return {
      id: c.id, code: c.code, kind: c.kind, value: c.value, value_label: c.kind === 'percent' ? `${c.value}%` : formatBRL(c.value), duration: c.duration, months: c.months, max_uses: c.max_uses, used: c.used, remaining: c.max_uses != null ? Math.max(0, c.max_uses - c.used) : null,
      product_ids: Array.isArray(c.product_ids) ? c.product_ids : [], expires_at: toDateStr(c.expires_at) || null, active: c.active, valid: Boolean(c.active && !expired && !exhausted), expired, exhausted, created_at: c.created_at, updated_at: c.updated_at,
    };
  }
  private async couponData(orgId: string, dto: any, cur?: any) {
    const data: any = {};
    if (dto.code !== undefined || !cur) { const code = normCode(dto.code ?? cur?.code); if (!COUPON_CODE_RE.test(code)) throw new BadRequestException('Código do cupom: 2 a 32 letras, números, "-" ou "_".'); data.code = code; }
    const kind = dto.kind !== undefined ? dto.kind : cur?.kind || 'percent';
    if (!['percent', 'fixed'].includes(kind)) throw new BadRequestException('Tipo do cupom: percent ou fixed.');
    data.kind = kind;
    const value = dto.value !== undefined ? Math.round(Number(dto.value) || 0) : cur?.value ?? 0;
    if (kind === 'percent' && (value < 1 || value > 100)) throw new BadRequestException('Percentual do cupom entre 1 e 100.');
    if (kind === 'fixed' && value < 1) throw new BadRequestException('Valor fixo do cupom em centavos (≥ 1).');
    data.value = value;
    const duration = dto.duration !== undefined ? dto.duration : cur?.duration || 'once';
    if (!['once', 'months', 'forever'].includes(duration)) throw new BadRequestException('Duração do cupom: once, months ou forever.');
    data.duration = duration;
    data.months = duration === 'months' ? clampInt(dto.months ?? cur?.months, 1, 36, 1) : null;
    if (dto.max_uses !== undefined) data.max_uses = dto.max_uses === null || dto.max_uses === '' ? null : Math.max(1, Math.round(Number(dto.max_uses) || 1));
    if (dto.product_ids !== undefined) {
      const ids: string[] = Array.isArray(dto.product_ids) ? ([...new Set((dto.product_ids as unknown[]).map((x) => String(x)))] as string[]).slice(0, 100) : [];
      if (ids.length) { const n = await this.prisma.whatsapp_products.count({ where: { organization_id: orgId, id: { in: ids } } }); if (n !== ids.length) throw new BadRequestException('Produto do cupom não encontrado.'); }
      data.product_ids = ids;
    }
    if (dto.expires_at !== undefined) { if (dto.expires_at && !isDateStr(dto.expires_at)) throw new BadRequestException('Validade do cupom: YYYY-MM-DD.'); data.expires_at = dto.expires_at ? toDate(dto.expires_at) : null; }
    if (dto.active !== undefined) data.active = Boolean(dto.active);
    return data;
  }
  async listCoupons(orgId: string, q: any = {}) {
    const where: any = { organization_id: orgId };
    if (q.active === '1' || q.active === 'true') where.active = true;
    if (q.q) where.code = { contains: normCode(q.q) };
    const rows = await this.prisma.whatsapp_coupons.findMany({ where, orderBy: [{ active: 'desc' }, { created_at: 'desc' }], take: 500 });
    const today = brtDateStr();
    return rows.map((c) => this.shapeCoupon(c, today));
  }
  async createCoupon(orgId: string, dto: any) {
    const n = await this.prisma.whatsapp_coupons.count({ where: { organization_id: orgId } });
    if (n >= 500) throw new BadRequestException('Limite de 500 cupons.');
    const data = await this.couponData(orgId, dto);
    try { return this.shapeCoupon(await this.prisma.whatsapp_coupons.create({ data: { organization_id: orgId, max_uses: null, product_ids: [], ...data } })); }
    catch (e: any) { if (e?.code === 'P2002') throw new BadRequestException('Já existe um cupom com esse código.'); throw e; }
  }
  async updateCoupon(orgId: string, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_coupons.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Cupom não encontrado.');
    const data = await this.couponData(orgId, dto, cur);
    try { return this.shapeCoupon(await this.prisma.whatsapp_coupons.update({ where: { id }, data })); }
    catch (e: any) { if (e?.code === 'P2002') throw new BadRequestException('Já existe um cupom com esse código.'); throw e; }
  }
  async removeCoupon(orgId: string, id: string) {
    const cur = await this.prisma.whatsapp_coupons.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Cupom não encontrado.');
    await this.prisma.whatsapp_coupons.delete({ where: { id } });
    await this.prisma.whatsapp_subscriptions.updateMany({ where: { organization_id: orgId, coupon_id: id }, data: { coupon_id: null } }); // o desconto já aplicado fica
    return { ok: true };
  }
  /** Valida sem lançar: `{ valid, reason?, coupon?, amount_cents?, discount_cents? }` (com `product_id` calcula o preço). */
  async validateCoupon(orgId: string, code: string, productId?: string | null) {
    const c = await this.prisma.whatsapp_coupons.findFirst({ where: { organization_id: orgId, code: normCode(code) } });
    if (!c) return { valid: false, reason: 'Cupom não encontrado.' };
    const shaped = this.shapeCoupon(c);
    if (!c.active) return { valid: false, reason: 'Cupom desativado.', coupon: shaped };
    if (shaped.expired) return { valid: false, reason: 'Cupom vencido.', coupon: shaped };
    if (shaped.exhausted) return { valid: false, reason: 'Cupom esgotado.', coupon: shaped };
    const product = productId ? await this.product(orgId, productId) : null;
    if (productId && !product) return { valid: false, reason: 'Produto não encontrado.', coupon: shaped };
    if (!productId && shaped.product_ids.length) return { valid: false, reason: 'Cupom válido só para produtos específicos.', coupon: shaped }; // assinatura sem produto não pode usar cupom restrito
    if (product && shaped.product_ids.length && !shaped.product_ids.includes(product.id)) return { valid: false, reason: 'Cupom não vale para este produto.', coupon: shaped };
    const calc = product ? { price_cents: product.price_cents, ...applyCoupon(product.price_cents, c) } : null;
    return { valid: true, coupon: shaped, ...(calc || {}) };
  }
  private async resolveCoupon(orgId: string, code: string, productId?: string | null) {
    const r = await this.validateCoupon(orgId, code, productId);
    if (!r.valid || !r.coupon) throw new BadRequestException(r.reason || 'Cupom inválido.');
    return this.prisma.whatsapp_coupons.findFirst({ where: { id: r.coupon.id } });
  }

  // ---------------------------------------------------------------- criar
  /**
   * Cartão salvo da assinatura (Fase 4): só faz sentido com `payment_method === 'card'` (senão fica null) e
   * precisa ser do MESMO cliente, da org e `status:'active'` em `whatsapp_payment_methods` (senão 400).
   * `curMethod` = meio atual (edição sem mandar `payment_method`).
   */
  async resolvePaymentMethod(orgId: string, customerId: string, dto: { payment_method?: string | null; payment_method_id?: string | null }, curMethod?: string | null) {
    const method = dto.payment_method !== undefined ? (PAYMENT_METHODS.includes(String(dto.payment_method)) ? String(dto.payment_method) : null) : curMethod ?? null;
    if (method !== 'card' || !dto.payment_method_id) return { payment_method: method, payment_method_id: null as string | null };
    const pm = await this.prisma.whatsapp_payment_methods.findFirst({ where: { id: String(dto.payment_method_id).slice(0, 36), organization_id: orgId, customer_id: customerId, status: 'active' }, select: { id: true } });
    if (!pm) throw new BadRequestException('Cartão salvo não encontrado.');
    return { payment_method: method, payment_method_id: pm.id };
  }

  /**
   * Cálculo PURO (sem gravar) de uma assinatura nova: produto, cupom validado (sem consumir uso),
   * ciclo, dia de vencimento, trial, 1º vencimento e 1ª cobrança. Usado por `createSubscription` e
   * pela prévia (`preview`, mostrada na tela antes de confirmar "Cobrar a 1ª agora").
   */
  private async plan(orgId: string, dto: any, meta: Pick<SubMeta, 'source' | 'auto_charge'>) {
    const product = dto.product_id ? await this.product(orgId, dto.product_id) : null;
    if (dto.product_id && !product) throw new NotFoundException('Produto não encontrado.');
    if (product && !product.active && meta.source === 'bot') throw new BadRequestException('Este produto está desativado.');
    const today = brtDateStr();
    const start = isDateStr(dto.start_date) ? String(dto.start_date) : today;
    let billing: string = dto.billing !== undefined && BILLING_LABEL[dto.billing] ? dto.billing : product?.billing || 'monthly';
    let cycle = dto.billing !== undefined ? cycleMonthsOf(billing) : product ? cycleMonthsOf(product.billing, product.billing_interval_months) : cycleMonthsOf(billing);
    if (product && dto.billing === undefined && product.billing_interval_months) billing = BILLING_OF_MONTHS[cycle] || billing;
    if (billing === 'once') cycle = 0;
    const price = dto.price_cents !== undefined ? Math.max(0, Math.round(Number(dto.price_cents) || 0)) : product?.price_cents ?? 0;
    const name = String(dto.product_name || product?.name || '').trim().slice(0, 120);
    if (!name) throw new BadRequestException('Escolha um produto ou dê um nome à assinatura.');
    const recurring = cycle > 0;
    const startDay = toDate(start)!.getUTCDate();
    let dueDay = recurring ? (dto.due_day ? clampInt(dto.due_day, 1, 28, Math.min(28, startDay)) : Math.min(28, startDay)) : null;
    const coupon = dto.coupon ? await this.resolveCoupon(orgId, String(dto.coupon), product?.id || null) : null;
    const { amount_cents: priced, discount_cents } = applyCoupon(price, coupon);
    const trialDays = dto.trial === false || meta.source === 'import' ? 0 : Math.max(0, product?.trial_days || 0); // importação (cliente antigo) nunca ganha teste grátis
    const chargeDue = start > today ? start : today;
    // início no PASSADO (cliente antigo cadastrado agora): `started_at` fica como veio, mas o vencimento anda ciclo a
    // ciclo até hoje — nunca se cobra para trás (vale para painel, API, importação e bot)
    const rollForward = (d: string) => { let x = d; let guard = 0; while (x && x < today && cycle > 0 && guard++ < 1200) x = addMonths(x, cycle, dueDay); return x; };
    let nextDue: string | null = null, trialEnds: string | null = null, firstCharge: ShapedSubscription['first_charge'] = null;
    let trialCharge: TrialCharge | null = null;
    const events: Array<[(typeof SUB_EVENT_KINDS)[number], Record<string, unknown>]> = [];
    if (!recurring) {
      firstCharge = priced >= 100 ? { amount_cents: priced, due_at: chargeDue, description: name } : null;
    } else if (trialDays > 0) {
      trialEnds = addDays(start, trialDays);
      if (trialEnds < today) trialEnds = today; // teste que já teria acabado (início no passado): termina hoje, o 1º ciclo é cobrado pelo runner a partir de hoje
      if (!dto.due_day) dueDay = Math.min(28, toDate(trialEnds)!.getUTCDate()); // sem dia escolhido: vence no dia em que o teste acaba (máx. 28)
      const aligned = nextDueFromDate(trialEnds, dueDay!);
      if (aligned === trialEnds) nextDue = trialEnds;
      else {
        // dia escolhido ≠ fim do teste: cobra NO FIM DO TESTE (sem dias grátis a mais) — proporcional até o dia
        // escolhido (mesma regra da entrada sem teste) ou, no produto sem proporcional, cheio e o ciclo seguinte
        // começa no dia escolhido depois de 1 ciclo
        nextDue = trialEnds;
        const prorate = !product || product.prorate !== false;
        const after = prorate ? aligned : nextDueFromDate(addMonths(trialEnds, cycle), dueDay!);
        const days = daysBetween(trialEnds, aligned);
        trialCharge = { due_at: trialEnds, next_due_at: after, mode: prorate ? 'prorate' : 'full', days, amount_cents: prorate ? prorateCents(priced, trialEnds, aligned, cycle) : priced };
      }
      events.push(['trial_started', { days: trialDays, ends_at: trialEnds, first_due_at: nextDue, ...(trialCharge ? { trial_charge: trialCharge } : {}) }]);
    } else {
      const firstDue = rollForward(nextDueFromDate(start, dueDay!));
      const days = daysBetween(chargeDue, firstDue); // o período pago pela 1ª cobrança começa no dia da cobrança (hoje, ou o início se futuro)
      if (meta.source === 'import') {
        // C-M3: cliente antigo importado não tem 1ª cobrança (já paga lá fora): o próximo vencimento é o 1º dia de vencimento
        // ≥ hoje — sem isso, "vence hoje" ou produto sem proporcional pulavam um ciclo inteiro
        firstCharge = null;
        nextDue = firstDue;
      } else if (days === 0) {
        firstCharge = priced >= 100 ? { amount_cents: priced, due_at: chargeDue, description: name } : null;
        nextDue = addMonths(firstDue, cycle, dueDay);
      } else if (!product || product.prorate !== false) {
        const amt = prorateCents(priced, chargeDue, firstDue, cycle);
        firstCharge = amt >= 100 ? { amount_cents: amt, due_at: chargeDue, description: `${name} (proporcional, ${days} dia${days === 1 ? '' : 's'})`.slice(0, 255) } : null;
        nextDue = firstDue;
      } else {
        firstCharge = priced >= 100 ? { amount_cents: priced, due_at: chargeDue, description: name } : null;
        nextDue = rollForward(nextDueFromDate(addMonths(start, cycle), dueDay!));
      }
    }
    // cupom `once` vale para a 1ª cobrança que EXISTIR: a imediata só quando ela vai mesmo ser criada agora (painel/API com
    // `charge_now`, ou o bot, que cria a cobrança ele mesmo); sem cobrança agora, o desconto vale para `next_due_at`
    const willChargeNow = Boolean(firstCharge) && (meta.auto_charge === true || meta.source === 'bot');
    const discountUntil = coupon ? couponUntil(coupon, start, willChargeNow && firstCharge ? firstCharge.due_at : nextDue || start) : null;
    return { product, coupon, start, price, name, billing, dueDay, nextDue, trialEnds, trialCharge, firstCharge, discount_cents: coupon ? discount_cents : 0, discountUntil, events };
  }

  /** Prévia da assinatura (nada é gravado; cupom não é consumido). */
  async preview(orgId: string, customerId: string, dto: any) {
    await this.customerOf(orgId, customerId);
    const p = await this.plan(orgId, dto, { source: 'panel', auto_charge: dto?.charge_now === true });
    return {
      product_id: p.product?.id || null, product_name: p.name, price_cents: p.price, price_label: formatBRL(p.price), billing: p.billing, billing_label: BILLING_LABEL[p.billing] || p.billing, due_day: p.dueDay,
      start_date: p.start, next_due_at: p.nextDue, next_due_label: fmtDateBR(p.nextDue), trial_ends_at: p.trialEnds, trial_ends_label: fmtDateBR(p.trialEnds),
      coupon_code: p.coupon?.code || null, discount_cents: p.discount_cents, discount_until: p.discountUntil,
      first_charge: p.firstCharge ? { ...p.firstCharge, amount_label: formatBRL(p.firstCharge.amount_cents), due_label: fmtDateBR(p.firstCharge.due_at) } : null,
      // teste grátis com dia escolhido: o que será cobrado no fim do teste
      trial_charge: p.trialCharge ? { ...p.trialCharge, amount_label: formatBRL(p.trialCharge.amount_cents), due_label: fmtDateBR(p.trialCharge.due_at), next_due_label: fmtDateBR(p.trialCharge.next_due_at) } : null,
    };
  }

  /**
   * Cria a assinatura aplicando trial, pró-rata e cupom; devolve `first_charge` (null quando não há
   * cobrança imediata: trial, valor < R$ 1,00 ou "começa paga até o vencimento").
   *  - once: 1ª cobrança = preço cheio (com cupom), sem vencimento recorrente.
   *  - trial: `trial_ends_at` = início + dias; `next_due_at` = fim do trial (dia do vencimento, se informado); sem cobrança agora.
   *  - entrada no dia do vencimento: paga o ciclo cheio agora; próximo = +1 ciclo.
   *  - prorate (padrão): cobra ceil(preço × dias ÷ dias do ciclo) agora; `next_due_at` = 1º dia de vencimento.
   *  - sem prorate: cobra o ciclo cheio agora; `next_due_at` = dia de vencimento após 1 ciclo.
   */
  async createSubscription(orgId: string, customerId: string, dto: any, meta: SubMeta): Promise<ShapedSubscription> {
    const customer = await this.customerOf(orgId, customerId);
    const n = await this.prisma.whatsapp_subscriptions.count({ where: { customer_id: customerId, status: { not: 'canceled' } } }); // canceladas não contam no limite
    if (n >= 50) throw new BadRequestException('Limite de 50 assinaturas por cliente.');
    const { product, coupon, start, price, name, billing, dueDay, nextDue, trialEnds, trialCharge, firstCharge, discount_cents, discountUntil, events } = await this.plan(orgId, dto, meta);
    // chaves do motor nunca vêm do cliente; campos personalizados de assinatura validados (Fase 7; importação não exige os obrigatórios)
    // P7-2: criação sem ninguém para preencher os obrigatórios (importação, bot, sistema/pedido/agenda) não exige os campos obrigatórios
    const custom: Record<string, unknown> = (await this.cf.apply(orgId, 'subscription', sanitizeCustom(dto.custom), { mode: 'create', skipRequired: ['import', 'bot', 'system'].includes(String(meta?.source)) || dto?.__internal === true })) || {};
    const pm = await this.resolvePaymentMethod(orgId, customer.id, dto);
    const autoCharge = meta.auto_charge === true && meta.source !== 'bot';
    if (firstCharge && autoCharge) custom.first_charge = { ...firstCharge, auto: true };
    if (trialCharge) custom.trial_charge = { due_at: trialCharge.due_at, next_due_at: trialCharge.next_due_at, mode: trialCharge.mode };
    // reserva o uso do cupom ANTES de gravar (atômico: duas assinaturas ao mesmo tempo não passam do limite)
    if (coupon) {
      const took = await this.prisma.whatsapp_coupons.updateMany({ where: { id: coupon.id, active: true, OR: [{ max_uses: null }, { used: { lt: coupon.max_uses ?? 0 } }] }, data: { used: { increment: 1 } } });
      if (!took.count) throw new BadRequestException('Cupom esgotado.');
    }
    let row: any;
    try {
      row = await this.prisma.whatsapp_subscriptions.create({
      data: {
        organization_id: orgId, customer_id: customer.id, product_id: product?.id || null, product_name: name, price_cents: price, billing, due_day: dueDay, status: 'active',
        started_at: toDate(start), next_due_at: nextDue ? toDate(nextDue) : null, trial_ends_at: trialEnds ? toDate(trialEnds) : null,
        coupon_id: coupon?.id || null, discount_cents, discount_until: discountUntil ? toDate(discountUntil) : null,
        custom: custom as any, external_id: dto.external_id ? String(dto.external_id).trim().slice(0, 64) : null, contract_number: dto.contract_number ? String(dto.contract_number).trim().slice(0, 64) : null,
        source: (['panel', 'bot', 'api', 'import', 'system'] as string[]).includes(meta.source) ? meta.source : 'panel', notes: dto.notes ? String(dto.notes).trim().slice(0, 500) : null,
        payment_method: pm.payment_method, payment_method_id: pm.payment_method_id,
      },
      });
    } catch (e) {
      if (coupon) await this.prisma.whatsapp_coupons.update({ where: { id: coupon.id }, data: { used: { decrement: 1 } } }).catch(() => undefined); // devolve o uso
      throw e;
    }
    await this.recordEvent(orgId, row.id, 'created', { product_id: product?.id || null, product_name: name, price_cents: price, billing, due_day: dueDay, start, next_due_at: nextDue, first_charge: firstCharge }, meta);
    for (const [k, d] of events) await this.recordEvent(orgId, row.id, k, d, meta);
    if (coupon) {
      await this.recordEvent(orgId, row.id, 'coupon_applied', { coupon_id: coupon.id, code: coupon.code, kind: coupon.kind, value: coupon.value, duration: coupon.duration, discount_cents, discount_until: discountUntil }, meta);
    }
    const shaped = this.shape(row, { coupon_code: coupon?.code || null, first_charge: firstCharge });
    this.hooks.emit('subscription_created', { orgId, subscription: shaped, customer, meta });
    if (firstCharge && autoCharge) this.hooks.emit('subscription_first_charge', { orgId, subscription: shaped, customer, first_charge: firstCharge, meta });
    return shaped;
  }

  /** Cobrança imediata já criada (pelo bot ou pelas cobranças) → tira a pendência de `custom.first_charge`. */
  async clearFirstCharge(subId: string) {
    const s = await this.prisma.whatsapp_subscriptions.findUnique({ where: { id: subId }, select: { custom: true } });
    const custom: any = s?.custom && typeof s.custom === 'object' ? { ...(s.custom as any) } : null;
    if (!custom || !custom.first_charge) return;
    delete custom.first_charge;
    await this.prisma.whatsapp_subscriptions.update({ where: { id: subId }, data: { custom } }).catch(() => undefined);
  }

  // ---------------------------------------------------------------- cobranças pendentes da assinatura
  /** Cancela no gateway + marca CANCELED (emite `charge_canceled`). `dueFrom` = só as com vencimento a partir dessa data. */
  async cancelPendingCharges(orgId: string, subId: string, opts: { dueFrom?: string | null } = {}) {
    const where: any = { organization_id: orgId, subscription_id: subId, status: 'PENDING' };
    if (opts.dueFrom) where.due_at = { gte: dateOnlyUTC(opts.dueFrom) };
    const rows = await this.prisma.whatsapp_charges.findMany({ where });
    if (!rows.length) return 0;
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    let n = 0, unconfirmed = 0;
    for (const c of rows) {
      // `cancelChargeRemote` é best-effort (nunca lança): sem gateway ativo, o meio criado no provedor fica sem confirmação
      const hasRemote = Boolean(c.pix_charge_id || c.boleto_charge_id || c.card_charge_id);
      if (hasRemote && !gw?.active) unconfirmed++;
      try { await cancelChargeRemote(gw, c); } catch (e: any) { unconfirmed++; this.logger.warn(`cobrança ${c.id}: cancelamento no gateway falhou: ${e?.message || e}`); } // cada meio no gateway que o criou (Fase 4)
      const u = await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { status: 'CANCELED' } });
      if (!u.count) continue;
      n++;
      await this.outbox.cancelPending(orgId, { dedupe_prefix: `charge:${c.id}:` }).catch(() => undefined);
      this.hooks.emit('charge_canceled', { orgId, charge: { ...c, status: 'CANCELED' }, reason: 'subscription' });
    }
    if (unconfirmed) this.logger.warn(`assinatura ${subId}: ${unconfirmed} cobrança(s) cancelada(s) aqui sem confirmação do gateway`);
    return n;
  }

  // ---------------------------------------------------------------- transições
  async changePlan(orgId: string, subId: string, newProductId: string, meta: SubMeta): Promise<ShapedSubscription> {
    const sub = await this.row(orgId, subId);
    if (sub.status === 'canceled') throw new BadRequestException('Assinatura cancelada. Reative-a antes de trocar o plano.');
    if (sub.status === 'paused') throw new BadRequestException('Assinatura pausada. Retome-a antes de trocar o plano.');
    const product = await this.product(orgId, newProductId);
    if (!product) throw new NotFoundException('Produto não encontrado.');
    if (product.id === sub.product_id) throw new BadRequestException('A assinatura já é deste plano.');
    const oldProduct = await this.product(orgId, sub.product_id);
    const today = brtDateStr();
    const oldCycle = this.cycleMonths(sub, oldProduct);
    const newCycle = cycleMonthsOf(product.billing, product.billing_interval_months);
    if (!newCycle) throw new BadRequestException('Troca de plano só entre produtos recorrentes.');
    const nextDue = toDateStr(sub.next_due_at) || null;
    let credit = 0;
    if (nextDue && sub.last_paid_at && oldCycle) {
      // denominador = o ciclo INTEIRO que termina em `next_due_at` (não o pedaço desde `started_at`); o crédito tem como teto
      // o que foi PAGO de verdade por esse período (cobrança PAID com vencimento dentro dele — a 1ª pró-rata vence no dia da
      // entrada); pago com crédito / nada pago → 0
      const lastDue = addMonths(nextDue, -oldCycle, sub.due_day);
      const raw = creditCents(this.amountFor(sub, oldProduct, nextDue), lastDue, nextDue, today);
      const paid = raw
        ? await this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, subscription_id: sub.id, status: 'PAID', due_at: { gte: dateOnlyUTC(lastDue), lt: dateOnlyUTC(nextDue) } }, select: { amount_cents: true, base_amount_cents: true, paid_via: true } })
        : [];
      const paidCents = paid.filter((c) => c.paid_via !== 'credit').reduce((a, c) => a + Math.max(0, c.base_amount_cents ?? c.amount_cents), 0);
      credit = Math.min(raw, paidCents);
    }
    const billing = BILLING_OF_MONTHS[newCycle] || product.billing;
    const customer = await this.customerOf(orgId, sub.customer_id);
    // crédito maior que o preço novo: a sobra passa para o ciclo seguinte (`custom.plan_credit`, consumida em `markPaid`
    // a cada cobrança quitada por crédito) em vez de se perder
    const upd = await this.patchCustom(sub.id, { plan_credit: credit > 0 ? credit : undefined }, { product_id: product.id, product_name: product.name, price_cents: product.price_cents, billing, coupon_id: null, discount_cents: credit, discount_until: credit && nextDue ? toDate(nextDue) : null });
    await this.cancelPendingCharges(orgId, sub.id, { dueFrom: today }); // só o ciclo ainda não vencido é regerado com o valor novo; dívida antiga continua em aberto
    await this.recordEvent(orgId, sub.id, 'plan_changed', { from_product_id: sub.product_id, from_product_name: sub.product_name, from_price_cents: sub.price_cents, to_product_id: product.id, to_product_name: product.name, to_price_cents: product.price_cents, credit_cents: credit, next_due_at: nextDue }, meta);
    const shaped = await this.shapeOne(orgId, upd);
    await this.notify(orgId, customer, shaped, 'plan_changed', {}, meta.source);
    this.hooks.emit('subscription_changed', { orgId, subscription: shaped, customer, meta });
    return shaped;
  }

  async cancel(orgId: string, subId: string, opts: { policy: 'product' | 'immediate' | 'end_of_cycle'; reason?: string | null } & SubMeta): Promise<ShapedSubscription> {
    const sub = await this.row(orgId, subId);
    if (sub.status === 'canceled') throw new BadRequestException('A assinatura já está cancelada.');
    const product = await this.product(orgId, sub.product_id);
    const today = brtDateStr();
    const policy = opts.policy === 'immediate' || opts.policy === 'end_of_cycle' ? opts.policy : product?.cancel_policy === 'immediate' ? 'immediate' : 'end_of_cycle';
    const reason = opts.reason ? String(opts.reason).trim().slice(0, 255) : null;
    const nextDue = toDateStr(sub.next_due_at) || null;
    const customer = await this.customerOf(orgId, sub.customer_id);
    const meta = { source: opts.source, user_id: opts.user_id };
    let upd: any;
    // `custom.first_charge` (1ª cobrança ainda não criada) sai nos dois caminhos: quem cancela não recebe a cobrança de entrada
    // depois; `trial_charge` (cobrança do fim do teste) só no imediato — no fim de ciclo a reativação ainda pode usá-la
    if (policy === 'immediate' || !nextDue || nextDue <= today || sub.status === 'paused') {
      upd = await this.patchCustom(sub.id, { first_charge: undefined, trial_charge: undefined }, { status: 'canceled', canceled_at: new Date(), cancel_at: toDate(today), cancel_reason: reason, paused_until: null });
      await this.cancelPendingCharges(orgId, sub.id);
      await this.recordEvent(orgId, sub.id, 'canceled', { policy: 'immediate', reason, effective_at: today }, meta);
      const shaped = await this.shapeOne(orgId, upd);
      await this.notify(orgId, customer, shaped, 'canceled', {}, opts.source);
      this.hooks.emit('subscription_canceled', { orgId, subscription: shaped, customer, policy: 'immediate', reason, meta });
      return shaped;
    }
    upd = await this.patchCustom(sub.id, { first_charge: undefined }, { cancel_at: toDate(nextDue), cancel_reason: reason });
    await this.cancelPendingCharges(orgId, sub.id, { dueFrom: nextDue }); // o próximo ciclo não será cobrado
    await this.recordEvent(orgId, sub.id, 'canceled', { policy: 'end_of_cycle', scheduled: true, reason, effective_at: nextDue }, meta);
    const shaped = await this.shapeOne(orgId, upd);
    await this.notify(orgId, customer, shaped, 'cancel_scheduled', {}, opts.source);
    this.hooks.emit('subscription_canceled', { orgId, subscription: shaped, customer, policy: 'end_of_cycle', reason, scheduled: true, meta });
    return shaped;
  }

  async pause(orgId: string, subId: string, opts: { until?: string | null; days?: number | null } & SubMeta): Promise<ShapedSubscription> {
    const sub = await this.row(orgId, subId);
    if (sub.status === 'canceled') throw new BadRequestException('Assinatura cancelada não pode ser pausada.');
    if (sub.status === 'paused') throw new BadRequestException('A assinatura já está pausada.');
    const today = brtDateStr();
    const until = isDateStr(opts.until) ? String(opts.until) : addDays(today, clampInt(opts.days, 1, 365, 30));
    if (until <= today) throw new BadRequestException('A pausa precisa terminar depois de hoje.');
    if (daysBetween(today, until) > 365) throw new BadRequestException('Pausa de no máximo 365 dias.');
    // só as próprias marcas (`paused_from`, `status_before_pause`); o resto de `custom` é relido na hora de gravar
    const upd = await this.patchCustom(sub.id, { paused_from: today, status_before_pause: sub.status }, { status: 'paused', paused_until: toDate(until) });
    await this.cancelPendingCharges(orgId, sub.id, { dueFrom: today }); // cobrança do próximo ciclo já emitida não fica valendo na pausa (a retomada gera de novo)
    await this.recordEvent(orgId, sub.id, 'paused', { from: today, until, days: daysBetween(today, until) }, opts);
    const customer = await this.customerOf(orgId, sub.customer_id);
    const shaped = await this.shapeOne(orgId, upd);
    await this.notify(orgId, customer, shaped, 'paused', {}, opts.source);
    this.hooks.emit('subscription_paused', { orgId, subscription: shaped, customer, meta: opts });
    return shaped;
  }

  /**
   * Retomada: volta ao status de ANTES da pausa (`custom.status_before_pause`). Em atraso continua em atraso e com o
   * mesmo vencimento (a pausa não perdoa dívida). Ativa: o vencimento anda os dias efetivamente pausados e volta a
   * cair no dia de vencimento (`due_day`); em teste grátis, o fim do teste (= vencimento) anda os mesmos dias, sem realinhar.
   */
  async resume(orgId: string, subId: string, meta: SubMeta): Promise<ShapedSubscription> {
    const sub = await this.row(orgId, subId);
    if (sub.status !== 'paused') throw new BadRequestException('A assinatura não está pausada.');
    const today = brtDateStr();
    const custom: any = (sub.custom as any) || {};
    const from = isDateStr(custom.paused_from) ? String(custom.paused_from) : today;
    const plannedUntil = toDateStr(sub.paused_until) || today;
    const until = plannedUntil < today ? plannedUntil : today; // retomada antecipada conta só os dias pausados de fato
    const days = daysBetween(from, until);
    const before: ShapedSubscription['status'] = custom.status_before_pause === 'overdue' ? 'overdue' : 'active';
    const curNext = toDateStr(sub.next_due_at);
    const trialEnds = toDateStr(sub.trial_ends_at);
    const inTrial = Boolean(trialEnds && trialEnds > today);
    let next = curNext;
    if (before !== 'overdue' && curNext) {
      next = nextDueAfterPause(curNext, from, until);
      if (!inTrial && sub.due_day) next = nextDueFromDate(next, sub.due_day); // volta a cair no dia de vencimento
      if (next < today) next = nextDueFromDate(today, sub.due_day || toDate(next)!.getUTCDate());
    }
    const patch: Record<string, unknown> = { paused_from: undefined, status_before_pause: undefined };
    // cobrança do fim do teste (dia escolhido) acompanha o vencimento empurrado pela pausa
    if (custom.trial_charge && curNext && toDateStr(custom.trial_charge.due_at) === curNext && next && next !== curNext) {
      const shift = daysBetween(curNext, next);
      patch.trial_charge = { ...custom.trial_charge, due_at: next, next_due_at: addDays(custom.trial_charge.next_due_at, shift) };
    }
    const data: Record<string, unknown> = { status: before, paused_until: null, next_due_at: next ? toDate(next) : null };
    if (inTrial && days > 0) data.trial_ends_at = toDate(addDays(trialEnds, days)); // teste ainda em andamento anda os mesmos dias
    const upd = await this.patchCustom(sub.id, patch, data);
    await this.recordEvent(orgId, sub.id, 'resumed', { paused_from: from, paused_until: until, days, next_due_at: next || null, status: before }, meta);
    const customer = await this.customerOf(orgId, sub.customer_id);
    const shaped = await this.shapeOne(orgId, upd);
    await this.notify(orgId, customer, shaped, 'resumed');
    this.hooks.emit('subscription_resumed', { orgId, subscription: shaped, customer, meta });
    return shaped;
  }

  /** Cancelada → ativa de novo (novo vencimento pelo dia); cancelamento agendado → desfeito. */
  async reactivate(orgId: string, subId: string, meta: SubMeta): Promise<ShapedSubscription> {
    const sub = await this.row(orgId, subId);
    const today = brtDateStr();
    let upd: any;
    // `custom.first_charge` (cobrança de entrada que não chegou a ser criada) não volta junto: a assinatura reativada é cobrada pelo runner no vencimento
    if (sub.status === 'canceled') {
      const cycle = this.cycleMonths(sub, await this.product(orgId, sub.product_id));
      const next = cycle ? nextDueFromDate(today, sub.due_day || Math.min(28, toDate(today)!.getUTCDate())) : null;
      upd = await this.patchCustom(sub.id, { first_charge: undefined }, { status: 'active', canceled_at: null, cancel_at: null, cancel_reason: null, paused_until: null, next_due_at: next ? toDate(next) : null, due_day: cycle ? sub.due_day || Math.min(28, toDate(today)!.getUTCDate()) : sub.due_day });
      await this.recordEvent(orgId, sub.id, 'reactivated', { next_due_at: next }, meta);
    } else if (sub.cancel_at) {
      upd = await this.patchCustom(sub.id, { first_charge: undefined }, { cancel_at: null, cancel_reason: null });
      await this.recordEvent(orgId, sub.id, 'reactivated', { undo_scheduled_cancel: true }, meta);
    } else throw new BadRequestException('A assinatura já está ativa.');
    const shaped = await this.shapeOne(orgId, upd);
    this.hooks.emit('subscription_reactivated', { orgId, subscription: shaped, meta });
    return shaped;
  }

  /** Chamado pelas cobranças ao liquidar: avança o vencimento, volta de `overdue`, grava `paid`. */
  async markPaid(orgId: string, subId: string, charge: { id: string; amount_cents: number; due_at: Date | string; paid_via?: string | null }, meta: Partial<SubMeta> = {}) {
    const sub = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id: subId, organization_id: orgId } });
    if (!sub) return null;
    const data: any = { last_paid_at: new Date() };
    const patch: Record<string, unknown> = {}; // só as marcas desta operação; `custom` é relido na hora de gravar (patchCustom)
    if (sub.status !== 'canceled') {
      const cycle = this.cycleMonths(sub, await this.product(orgId, sub.product_id));
      const due = toDateStr(charge.due_at);
      const cur = toDateStr(sub.next_due_at);
      const custom: any = (sub.custom as any) || {};
      const isFirst = Boolean(custom.first_charge) && !sub.last_paid_at;
      patch.first_charge = undefined;
      const tc = custom.trial_charge && toDateStr(custom.trial_charge.due_at) === due ? custom.trial_charge : null;
      if (tc) patch.trial_charge = undefined;
      if (sub.status === 'overdue') data.status = 'active';
      // fim do teste com dia escolhido: o próximo vencimento é o dia escolhido (proporcional) ou dia escolhido após 1 ciclo (cheio)
      if (tc && isDateStr(tc.next_due_at)) data.next_due_at = toDate(tc.next_due_at);
      // a 1ª cobrança (pró-rata / avulsa) não avança o vencimento: ela paga o período até `next_due_at`
      else if (cycle && !isFirst && due && (!cur || due >= cur)) data.next_due_at = toDate(addMonths(due, cycle, sub.due_day));
      // crédito de troca de plano maior que o preço: cada ciclo quitado por crédito consome um preço; a sobra vale para o
      // ciclo seguinte; acabou → desconto zerado (sobra < R$ 1,00 ainda cai no caminho de crédito e some — por desenho)
      if (charge.paid_via === 'credit' && custom.plan_credit && Number(sub.discount_cents) > 0 && data.next_due_at) {
        const leftover = Math.max(0, (Number(sub.discount_cents) || 0) - Math.max(0, Number(sub.price_cents) || 0));
        if (leftover > 0) { data.discount_cents = leftover; data.discount_until = data.next_due_at; patch.plan_credit = leftover; }
        else { data.discount_cents = 0; data.discount_until = null; patch.plan_credit = undefined; }
      }
      if (!sub.last_paid_at) await this.recordEvent(orgId, sub.id, 'activated', { charge_id: charge.id }, meta);
    } else {
      // pagou depois de cancelar (PIX antigo, boleto que já estava impresso): fica registrado para a equipe decidir (estorno/reativação)
      this.logger.warn(`assinatura ${sub.id} cancelada recebeu pagamento (cobrança ${charge.id}, ${charge.amount_cents} centavos)`);
      await this.recordEvent(orgId, sub.id, 'paid_after_cancel', { charge_id: charge.id, amount_cents: charge.amount_cents, via: charge.paid_via || null }, meta);
    }
    const upd = await this.patchCustom(sub.id, patch, data);
    await this.recordEvent(orgId, sub.id, 'paid', { charge_id: charge.id, amount_cents: charge.amount_cents, via: charge.paid_via || null, next_due_at: toDateStr(upd.next_due_at) || null }, meta);
    return upd;
  }

  // ---------------------------------------------------------------- listagem
  /** ids de clientes com conversa individual naquele número (filtro `session_id`). */
  private async customerIdsOfSession(orgId: string, sessionId: string) {
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: sessionId, kind: 'individual' }, select: { chat_id: true }, take: 20000 });
    const jids = chats.map((c) => c.chat_id);
    if (!jids.length) return [] as string[];
    const phones = jids.map((j) => j.split('@')[0]).filter((d) => /^\d{8,15}$/.test(d));
    const contacts = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ wa_id: { in: jids } }, { lid: { in: jids } }, ...(phones.length ? [{ phone: { in: phones } }] : [])] }, select: { id: true }, take: 20000 });
    const ids = contacts.map((c) => c.id);
    if (!ids.length) return [] as string[];
    const [byPrimary, byLink] = await Promise.all([
      this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, contact_id: { in: ids } }, select: { id: true } }),
      this.prisma.whatsapp_customer_contacts.findMany({ where: { contact_id: { in: ids } }, select: { customer_id: true } }),
    ]);
    return [...new Set([...byPrimary.map((c) => c.id), ...byLink.map((l) => l.customer_id)])];
  }

  async list(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(5, parseInt(String(q.page_size || 25), 10) || 25));
    const empty = { items: [] as any[], total: 0, page, page_size: size, pages: 1, counts: {} as Record<string, number> };
    const where: any = { organization_id: orgId };
    if (q.status && q.status !== 'all') {
      const st = String(q.status).split(',').map((s) => s.trim()).filter((s) => ['active', 'overdue', 'paused', 'canceled'].includes(s));
      if (st.length) where.status = st.length === 1 ? st[0] : { in: st };
    }
    if (q.product_id) where.product_id = String(q.product_id);
    if (q.customer_id) where.customer_id = String(q.customer_id);
    if (q.due_from || q.due_to) where.next_due_at = { ...(isDateStr(q.due_from) ? { gte: dateOnlyUTC(String(q.due_from)) } : {}), ...(isDateStr(q.due_to) ? { lte: dateOnlyUTC(String(q.due_to)) } : {}) };
    if (q.external_id) where.external_id = String(q.external_id);
    if (q.session_id) {
      const sid = String(q.session_id);
      if (allowed !== null && !allowed.has(sid)) return empty;
      const ids = await this.customerIdsOfSession(orgId, sid);
      if (!ids.length) return empty;
      where.customer_id = where.customer_id ? (ids.includes(where.customer_id) ? where.customer_id : '__none__') : { in: ids };
    }
    if (q.q) {
      const s = String(q.q).trim();
      const custs = await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, OR: [{ name: { contains: s } }, { code: { contains: s } }] }, select: { id: true }, take: 500 });
      where.OR = [{ product_name: { contains: s } }, { external_id: { contains: s } }, { contract_number: { contains: s } }, ...(custs.length ? [{ customer_id: { in: custs.map((c) => c.id) } }] : [])];
    }
    const [total, rows, counts] = await Promise.all([
      this.prisma.whatsapp_subscriptions.count({ where }),
      this.prisma.whatsapp_subscriptions.findMany({ where, orderBy: [{ next_due_at: 'asc' }, { created_at: 'desc' }], skip: (page - 1) * size, take: size }),
      this.prisma.whatsapp_subscriptions.groupBy({ by: ['status'], where: { organization_id: orgId }, _count: { _all: true } }),
    ]);
    const custIds = [...new Set(rows.map((r) => r.customer_id))];
    const custs = custIds.length ? await this.prisma.whatsapp_customers.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, contact_id: true, code: true } }) : [];
    const contacts = custs.length ? await this.prisma.whatsapp_contacts.findMany({ where: { id: { in: custs.map((c) => c.contact_id) } }, select: { id: true, phone: true } }) : [];
    const phone = new Map(contacts.map((c) => [c.id, c.phone]));
    const byId = new Map(custs.map((c) => [c.id, { id: c.id, name: c.name, code: c.code, phone: phone.get(c.contact_id) || null }]));
    const items = (await this.shapeMany(orgId, rows)).map((s) => ({ ...s, customer: byId.get(s.customer_id) || null }));
    const cnt: Record<string, number> = { active: 0, overdue: 0, paused: 0, canceled: 0 };
    for (const g of counts) cnt[g.status] = g._count._all;
    return { items, total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)), counts: cnt };
  }

  // ---------------------------------------------------------------- manutenção diária (chamada pelo runner das cobranças)
  /** Fecha cancelamentos agendados, retoma pausas, avisa trial acabando (D-3), reajuste anual. */
  async dailyMaintenance(orgId: string, cfg: ChargeSettings, today = brtDateStr()) {
    const result = { closed: 0, resumed: 0, trial_notices: 0, readjusted: 0, errors: [] as string[] };
    const todayD = dateOnlyUTC(today);
    const meta: SubMeta = { source: 'system' };
    // tudo em LOTES por id (cursor) — orgs com dezenas de milhares de assinaturas não carregam a tabela inteira; clientes
    // lidos por lote (cache da rodada) e as configurações (`cfg`) reaproveitadas nos avisos
    const customers = new Map<string, any>();
    const loadCustomers = async (rows: any[]) => {
      const ids = [...new Set(rows.map((r) => r.customer_id))].filter((id) => !customers.has(id));
      if (!ids.length) return;
      for (const c of await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, id: { in: ids } } })) customers.set(c.id, c);
    };
    const customerOf = (id: string) => { const c = customers.get(id); if (!c) throw new NotFoundException('Cliente não encontrado.'); return c; };
    const batches = async (where: Record<string, unknown>, fn: (rows: any[]) => Promise<void>) => {
      for (let cursor = ''; ;) {
        const rows = await this.prisma.whatsapp_subscriptions.findMany({ where: { ...where, organization_id: orgId, id: { gt: cursor } }, orderBy: { id: 'asc' }, take: MAINT_BATCH });
        if (!rows.length) break;
        cursor = rows[rows.length - 1].id;
        await fn(rows);
        if (rows.length < MAINT_BATCH) break;
      }
    };
    // 1) cancelamento agendado chegou — escrita CONDICIONAL (outro processo pode ter reativado/cancelado no meio)
    await batches({ status: { not: 'canceled' }, cancel_at: { not: null, lte: todayD } }, async (rows) => {
      await loadCustomers(rows);
      for (const sub of rows) {
        try {
          const u = await this.prisma.whatsapp_subscriptions.updateMany({ where: { id: sub.id, status: { not: 'canceled' }, cancel_at: { lte: todayD } }, data: { status: 'canceled', canceled_at: new Date(), paused_until: null } });
          if (!u.count) continue;
          const upd = await this.patchCustom(sub.id, { first_charge: undefined, trial_charge: undefined });
          await this.cancelPendingCharges(orgId, sub.id);
          await this.recordEvent(orgId, sub.id, 'canceled', { policy: 'end_of_cycle', effective: true, effective_at: toDateStr(sub.cancel_at), reason: sub.cancel_reason }, meta);
          const customer = customerOf(sub.customer_id);
          const shaped = await this.shapeOne(orgId, upd);
          await this.notify(orgId, customer, shaped, 'canceled', {}, null, cfg);
          this.hooks.emit('subscription_canceled', { orgId, subscription: shaped, customer, policy: 'end_of_cycle', reason: sub.cancel_reason, meta });
          result.closed++;
        } catch (e: any) { result.errors.push(`cancelar ${sub.id}: ${e?.message || e}`); }
      }
    });
    // 2) pausa terminou (`resume` relê a linha e só retoma se ainda estiver pausada)
    await batches({ status: 'paused', paused_until: { not: null, lte: todayD } }, async (rows) => {
      for (const sub of rows) { try { await this.resume(orgId, sub.id, meta); result.resumed++; } catch (e: any) { result.errors.push(`retomar ${sub.id}: ${e?.message || e}`); } }
    });
    // 3) trial acabando nos próximos 3 dias (1 aviso por assinatura — `custom.notified.trial_ending`); cancelamento agendado não avisa
    const d3 = dateOnlyUTC(addDays(today, 3));
    await batches({ status: 'active', cancel_at: null, trial_ends_at: { gte: todayD, lte: d3 } }, async (rows) => {
      const pending = rows.filter((sub) => !((sub.custom as any) || {}).notified?.trial_ending);
      await loadCustomers(pending);
      const shaped = await this.shapeMany(orgId, pending);
      for (const [i, sub] of pending.entries()) {
        try {
          await this.notify(orgId, customerOf(sub.customer_id), shaped[i], 'trial_ending', {}, null, cfg);
          await this.patchCustom(sub.id, { notified: { ...(((sub.custom as any) || {}).notified || {}), trial_ending: today } });
          result.trial_notices++;
        } catch (e: any) { result.errors.push(`trial ${sub.id}: ${e?.message || e}`); }
      }
    });
    // 4) reajuste anual (no mês configurado, 1× por ano por assinatura) — o filtro "ainda não reajustada este ano" é feito
    // no SQL (`custom.readjusted`), com cursor por id
    const year = today.slice(0, 4), month = parseInt(today.slice(5, 7), 10);
    if (cfg.readjust.enabled && cfg.readjust.percent > 0 && month === cfg.readjust.month) {
      for (let cursor = ''; ;) {
        const ids: { id: string }[] = await this.prisma.$queryRaw`
          SELECT id FROM whatsapp_subscriptions
          WHERE organization_id = ${orgId} AND status IN ('active', 'overdue', 'paused') AND billing <> 'once' AND id > ${cursor}
            AND (custom IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(custom, '$.readjusted')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(custom, '$.readjusted')) <> ${year})
          ORDER BY id LIMIT ${MAINT_BATCH}`;
        if (!ids.length) break;
        cursor = ids[ids.length - 1].id;
        const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, id: { in: ids.map((r) => r.id) } }, orderBy: { id: 'asc' } });
        if (cfg.readjust.notify) await loadCustomers(subs);
        for (const sub of subs) {
          const started = toDateStr(sub.started_at);
          // entrou há menos de 60 dias (independe do ano-calendário): pula este ano
          if (started && daysBetween(started, today) < 60) { await this.patchCustom(sub.id, { readjusted: year }).catch(() => undefined); continue; }
          try {
            const to = readjustCents(sub.price_cents, cfg.readjust.percent);
            const upd = await this.patchCustom(sub.id, { readjusted: year }, { price_cents: to });
            await this.recordEvent(orgId, sub.id, 'price_changed', { from_cents: sub.price_cents, to_cents: to, percent: cfg.readjust.percent, reason: 'readjust' }, meta);
            if (cfg.readjust.notify) await this.notify(orgId, customerOf(sub.customer_id), await this.shapeOne(orgId, upd), 'price_changed', {}, null, cfg);
            result.readjusted++;
          } catch (e: any) { result.errors.push(`reajuste ${sub.id}: ${e?.message || e}`); }
        }
        if (ids.length < MAINT_BATCH) break;
      }
    }
    return result;
  }
}
