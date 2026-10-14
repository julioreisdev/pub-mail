// ============================================================================
// Matemática do motor de assinatura (Fase 3) — funções PURAS, sem Nest, sem banco e sem relógio.
// Datas sempre como `YYYY-MM-DD` (ou Date à meia-noite UTC, que é como a coluna DATE chega do
// Prisma). "Hoje" é SEMPRE parâmetro (quem chama passa a data em BRT) — nada de Date.now() aqui.
// Testável em Node puro pelo `dist`: docs/tools/wa_subscription_math_test.mjs.
// ============================================================================

export type DateLike = string | Date | null | undefined;

const DAY = 86_400_000;

/** Date (meia-noite UTC) ou null. Aceita `YYYY-MM-DD`, ISO ou Date. */
export function toDate(v: DateLike): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
/** `YYYY-MM-DD` ou '' */
export function toDateStr(v: DateLike): string {
  const d = toDate(v);
  return d ? d.toISOString().slice(0, 10) : '';
}
/** `YYYY-MM-DD` REAL: "2026-02-30" é recusado (o Date do JS aceitaria e viraria 2 de março). */
export const isDateStr = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && toDateStr(toDate(String(v))) === String(v);

export function addDays(v: DateLike, days: number): string {
  const d = toDate(v);
  if (!d) return '';
  return new Date(d.getTime() + Math.round(days) * DAY).toISOString().slice(0, 10);
}
/** Dias inteiros de `a` até `b` (b − a); negativo quando b < a. */
export function daysBetween(a: DateLike, b: DateLike): number {
  const x = toDate(a), y = toDate(b);
  if (!x || !y) return 0;
  return Math.round((y.getTime() - x.getTime()) / DAY);
}
export const daysInMonth = (year: number, month1to12: number) => new Date(Date.UTC(year, month1to12, 0)).getUTCDate();

/**
 * Soma meses mantendo o dia (`dueDay` quando informado; 1..28 nunca estoura; sem dueDay o dia é
 * limitado ao último dia do mês destino).
 */
export function addMonths(v: DateLike, months: number, dueDay?: number | null): string {
  const d = toDate(v);
  if (!d) return '';
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + Math.round(months);
  const target = new Date(Date.UTC(y, m, 1));
  const want = dueDay && dueDay >= 1 ? Math.min(28, dueDay) : d.getUTCDate();
  const day = Math.min(want, daysInMonth(target.getUTCFullYear(), target.getUTCMonth() + 1));
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day)).toISOString().slice(0, 10);
}

/** Primeiro dia `dueDay` (1–28) a partir de `from` (inclusive). */
export function nextDueFromDate(from: DateLike, dueDay: number): string {
  const d = toDate(from);
  if (!d) return '';
  const day = Math.min(28, Math.max(1, Math.round(dueDay) || 1));
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const thisMonth = new Date(Date.UTC(y, m, day));
  return (thisMonth >= d ? thisMonth : new Date(Date.UTC(y, m + 1, day))).toISOString().slice(0, 10);
}

/** Meses por ciclo: `billing_interval_months` do produto (1/3/6/12) ou o enum `billing`. 0 = avulso. */
export const BILLING_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };
export function cycleMonthsOf(billing: string | null | undefined, intervalMonths?: number | null): number {
  if (intervalMonths && [1, 3, 6, 12].includes(Number(intervalMonths))) return Number(intervalMonths);
  return BILLING_MONTHS[String(billing || '')] || 0;
}
export const billingOfMonths = (months: number) => (months === 12 ? 'yearly' : months === 6 ? 'semiannual' : months === 3 ? 'quarterly' : months >= 1 ? 'monthly' : 'once');

/**
 * Pró-rata de entrada: preço × dias de `startDate` até `firstDueDate` ÷ dias do ciclo que termina em
 * `firstDueDate` (arredondado para CIMA em centavos). Entrada no dia 20 com vencimento dia 5 = 15 dias
 * (setembro) ou 16 dias (outubro, mês de 31). Dias ≤ 0 → 0; dias ≥ ciclo → preço cheio.
 */
export function prorateCents(priceCents: number, startDate: DateLike, firstDueDate: DateLike, cycleMonths: number): number {
  const price = Math.max(0, Math.round(Number(priceCents) || 0));
  const months = Math.max(1, Math.round(cycleMonths) || 1);
  const days = daysBetween(startDate, firstDueDate);
  if (days <= 0 || !price) return 0;
  const cycleStart = addMonths(firstDueDate, -months, toDate(firstDueDate)?.getUTCDate());
  const cycleDays = Math.max(1, daysBetween(cycleStart, firstDueDate));
  if (days >= cycleDays) return price;
  return Math.ceil((price * days) / cycleDays);
}

/** Multa fixa + juros pro rata die (ao mês ÷ 30), cada parcela arredondada para cima em centavos. */
export function penaltyBreakdown(amountCents: number, dueDate: DateLike, today: DateLike, lateFeePct: number, interestMonthPct: number) {
  const amount = Math.max(0, Math.round(Number(amountCents) || 0));
  const daysLate = Math.max(0, daysBetween(dueDate, today));
  const fee = daysLate > 0 && lateFeePct > 0 ? Math.ceil((amount * Number(lateFeePct)) / 100) : 0;
  const interest = daysLate > 0 && interestMonthPct > 0 ? Math.ceil((amount * Number(interestMonthPct) * daysLate) / 100 / 30) : 0;
  return { amount_cents: amount + fee + interest, base_cents: amount, fee_cents: fee, interest_cents: interest, days_late: daysLate };
}
/** Total de encargos (multa + juros) em centavos. */
export function penaltyCents(amountCents: number, dueDate: DateLike, today: DateLike, lateFeePct: number, interestMonthPct: number): number {
  const p = penaltyBreakdown(amountCents, dueDate, today, lateFeePct, interestMonthPct);
  return p.fee_cents + p.interest_cents;
}

/**
 * Crédito do período pago e não usado (troca de plano): preço × dias restantes até `nextDue` ÷ dias do
 * período [lastDue, nextDue), arredondado para BAIXO (nunca credita a mais). Fora do período → 0 ou preço.
 */
export function creditCents(priceCents: number, lastDue: DateLike, nextDue: DateLike, today: DateLike): number {
  const price = Math.max(0, Math.round(Number(priceCents) || 0));
  const total = daysBetween(lastDue, nextDue);
  const left = daysBetween(today, nextDue);
  if (!price || total <= 0 || left <= 0) return 0;
  if (left >= total) return price;
  return Math.floor((price * left) / total);
}

export type CouponLike = { kind: string; value: number; duration?: string; months?: number | null };
/** Aplica o cupom ao preço: percent (0–100 %) ou fixed (centavos), nunca abaixo de zero. */
export function applyCoupon(priceCents: number, coupon: CouponLike | null | undefined): { amount_cents: number; discount_cents: number } {
  const price = Math.max(0, Math.round(Number(priceCents) || 0));
  if (!coupon) return { amount_cents: price, discount_cents: 0 };
  const value = Math.max(0, Math.round(Number(coupon.value) || 0));
  const discount = coupon.kind === 'percent' ? Math.min(price, Math.round((price * Math.min(100, value)) / 100)) : Math.min(price, value);
  return { amount_cents: price - discount, discount_cents: discount };
}
/** Até quando o desconto vale: once → a 1ª cobrança (`firstChargeDue`); months → início + N meses; forever → null. */
export function couponUntil(coupon: CouponLike | null | undefined, startDate: DateLike, firstChargeDue: DateLike): string | null {
  if (!coupon) return null;
  if (coupon.duration === 'forever') return null;
  if (coupon.duration === 'months') return addMonths(startDate, Math.max(1, Math.round(Number(coupon.months) || 1))) || null;
  return toDateStr(firstChargeDue) || toDateStr(startDate) || null;
}
/** Desconto vigente para uma cobrança com vencimento `forDate`? */
export function discountActive(discountCents: number, discountUntil: DateLike, forDate: DateLike): boolean {
  if (!(Number(discountCents) > 0)) return false;
  const until = toDateStr(discountUntil);
  if (!until) return true;
  const d = toDateStr(forDate);
  return !d || d <= until;
}

/** Retomada de pausa: o vencimento é empurrado pelos dias efetivamente pausados. */
export function nextDueAfterPause(nextDue: DateLike, pausedFrom: DateLike, pausedUntil: DateLike): string {
  const days = Math.max(0, daysBetween(pausedFrom, pausedUntil));
  return addDays(nextDue, days);
}

/** Reajuste: preço × (1 + pct/100), arredondado para cima em centavos. */
export function readjustCents(priceCents: number, pct: number): number {
  const price = Math.max(0, Math.round(Number(priceCents) || 0));
  return Math.max(0, Math.ceil(price * (1 + (Number(pct) || 0) / 100)));
}

export const fmtDateBR = (v: DateLike) => { const s = toDateStr(v); return s ? s.split('-').reverse().join('/') : ''; };
