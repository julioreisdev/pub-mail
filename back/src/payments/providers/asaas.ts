// Asaas — PIX, boleto e cartão (Fase 4 do plano de assinaturas). Sem Nest/Prisma: quem chama guarda os ids.
//
// Comportamento conferido no sandbox (13/10/2026):
//  - Toda cobrança exige um CLIENTE no Asaas com CPF/CNPJ ("Para criar esta cobrança é necessário preencher o
//    CPF ou CNPJ do cliente"). O cliente é achado/criado por `externalReference` (id do cliente no Pub Mail).
//  - Cartão: cobrança `CREDIT_CARD` SEM dados do cartão → o cliente paga na página segura do Asaas (`invoiceUrl`);
//    aprovado, o pagamento traz `creditCard.{creditCardToken, creditCardBrand, creditCardNumber}` (final). As
//    próximas cobranças usam `creditCardToken` e aprovam/recusam na hora. O número do cartão nunca passa por nós.
//  - Recusa do emissor = HTTP 400 `invalid_action` "Transação não autorizada…".
//  - Webhook: `authToken` ≥ 32 caracteres e sem números em sequência; chega no cabeçalho `asaas-access-token`.
//  - Sandbox: chave `$aact_hmlg_…` → api-sandbox.asaas.com; produção `$aact_prod_…` → api.asaas.com.
import { BoletoResult, CancelResult, CardInfo, CardResult, ListedPayment, NormStatus, PaymentDetails, PixResult, ProviderPayer, StatusResult, TestResult } from './types';
import { randomBytes } from 'crypto';
import { TIMEOUT } from './http';

export const isAsaasSandbox = (token: string) => /^\$?aact_hmlg_/.test(String(token || ''));
export const asaasBase = (token: string) => (isAsaasSandbox(token) ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3');

/** Eventos que o webhook do Pub Mail assina. */
export const ASAAS_WEBHOOK_EVENTS = ['PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_RECEIVED_IN_CASH_UNDONE'];

async function call(token: string, method: string, path: string, body?: any): Promise<{ status: number; json: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(asaasBase(token) + path, {
      method,
      headers: { 'Content-Type': 'application/json', access_token: token, 'User-Agent': 'PubMail' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

const errText = (json: any, status: number) => {
  const e = Array.isArray(json?.errors) ? json.errors.map((x: any) => x?.description).filter(Boolean).join(' · ') : '';
  return e || json?.message || `HTTP ${status}`;
};
const ok2xx = (s: number) => s >= 200 && s < 300;
const reais = (cents: number) => Number((Math.max(0, Math.round(cents)) / 100).toFixed(2));
const digits = (v: any) => String(v || '').replace(/\D/g, '');
const dateStr = (d?: Date | string | null) => (d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : new Date().toISOString().slice(0, 10));

/** Status do Asaas → normalizado. OVERDUE ainda pode ser pago (fica PENDING); removida/estornada não. */
export function normAsaasStatus(raw: string, deleted?: boolean): NormStatus {
  if (deleted) return 'EXPIRED';
  const s = String(raw || '').toUpperCase();
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED'].includes(s)) return 'PAID';
  if (['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS', 'AUTHORIZED', 'DUNNING_REQUESTED'].includes(s)) return 'PENDING';
  if (['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'].includes(s)) return 'FAILED';
  return 'FAILED';
}

const cardOf = (p: any): CardInfo | null => {
  const c = p?.creditCard;
  if (!c?.creditCardToken) return null;
  const last4 = digits(c.creditCardNumber).slice(-4) || null;
  return { token: String(c.creditCardToken), brand: c.creditCardBrand ? String(c.creditCardBrand) : null, last4 };
};

// ---------------------------------------------------------------- cliente
/** Acha (externalReference) ou cria o cliente no Asaas. Exige CPF/CNPJ (regra do Asaas). */
export async function asaasEnsureCustomer(token: string, payer: ProviderPayer): Promise<{ ok: boolean; customerId?: string; error?: string }> {
  try {
    if (payer.customerId) return { ok: true, customerId: payer.customerId };
    const doc = digits(payer.doc);
    if (doc.length !== 11 && doc.length !== 14) return { ok: false, error: 'O Asaas exige o CPF/CNPJ do cliente. Cadastre o documento no cliente antes de cobrar.' };
    const ref = String(payer.ref || '').slice(0, 100);
    if (ref) {
      const f = await call(token, 'GET', `/customers?externalReference=${encodeURIComponent(ref)}&limit=1`);
      const found = f.json?.data?.[0];
      if (ok2xx(f.status) && found?.id && !found.deleted) {
        // documento mudou no Pub Mail → atualiza lá (o Asaas usa o do cadastro)
        if (digits(found.cpfCnpj) !== doc) await call(token, 'POST', `/customers/${found.id}`, { cpfCnpj: doc, name: payer.name }).catch(() => undefined);
        return { ok: true, customerId: String(found.id) };
      }
    }
    const body: any = { name: String(payer.name || 'Cliente').slice(0, 100), cpfCnpj: doc, externalReference: ref || undefined, notificationDisabled: true };
    if (payer.email) body.email = String(payer.email).slice(0, 100);
    // celular NÃO vai: o Asaas recusa o cadastro inteiro quando acha o número inválido ("O celular informado é
    // inválido") e não precisa dele — as notificações do Asaas ficam desligadas (quem avisa é o Pub Mail).
    const r = await call(token, 'POST', '/customers', body);
    if (ok2xx(r.status) && r.json?.id) return { ok: true, customerId: String(r.json.id) };
    return { ok: false, error: errText(r.json, r.status) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ---------------------------------------------------------------- PIX / boleto
export async function asaasCreatePix(token: string, amountCents: number, description: string, opts: any = {}): Promise<PixResult & { customerId?: string; invoiceUrl?: string }> {
  try {
    const c = await asaasEnsureCustomer(token, opts.payer || {});
    if (!c.ok) return { ok: false, error: c.error };
    const r = await call(token, 'POST', '/payments', { customer: c.customerId, billingType: 'PIX', value: reais(amountCents), dueDate: dateStr(opts.dueAt), description: String(description || '').slice(0, 500), externalReference: opts.externalReference || undefined });
    if (!ok2xx(r.status) || !r.json?.id) return { ok: false, error: errText(r.json, r.status), customerId: c.customerId };
    const id = String(r.json.id);
    const q = await call(token, 'GET', `/payments/${id}/pixQrCode`);
    if (!ok2xx(q.status) || !q.json?.payload) {
      await call(token, 'DELETE', `/payments/${id}`).catch(() => undefined);
      return { ok: false, error: `PIX sem QR (${errText(q.json, q.status)}). Cadastre uma chave Pix na conta do Asaas.`, customerId: c.customerId };
    }
    return { ok: true, chargeId: id, pixCode: String(q.json.payload), qrBase64: q.json.encodedImage ? String(q.json.encodedImage) : undefined, customerId: c.customerId, invoiceUrl: r.json.invoiceUrl };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function asaasCreateBoleto(token: string, amountCents: number, description: string, opts: any = {}): Promise<BoletoResult & { customerId?: string; invoiceUrl?: string }> {
  try {
    const c = await asaasEnsureCustomer(token, opts.payer || {});
    if (!c.ok) return { ok: false, error: c.error };
    const r = await call(token, 'POST', '/payments', { customer: c.customerId, billingType: 'BOLETO', value: reais(amountCents), dueDate: dateStr(opts.dueAt), description: String(description || '').slice(0, 500), externalReference: opts.externalReference || undefined });
    if (!ok2xx(r.status) || !r.json?.id) return { ok: false, error: errText(r.json, r.status), customerId: c.customerId };
    const id = String(r.json.id);
    const l = await call(token, 'GET', `/payments/${id}/identificationField`);
    return { ok: true, chargeId: id, url: r.json.bankSlipUrl || r.json.invoiceUrl, barcode: l.json?.barCode || undefined, digitable: l.json?.identificationField || undefined, customerId: c.customerId, invoiceUrl: r.json.invoiceUrl };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ---------------------------------------------------------------- cartão
/**
 * Cobrança no cartão. Com `cardToken` cobra na hora (aprovado → PAID + card; recusado → declined). Sem token,
 * cria a cobrança para o cliente pagar na página segura do Asaas (`invoiceUrl`); `installments` > 1 = parcelado.
 */
export async function asaasCreateCard(token: string, amountCents: number, description: string, opts: { payer: ProviderPayer; dueAt?: Date | string | null; cardToken?: string | null; installments?: number | null; remoteIp?: string | null; externalReference?: string | null }): Promise<CardResult> {
  try {
    const c = await asaasEnsureCustomer(token, opts.payer);
    if (!c.ok) return { ok: false, error: c.error };
    const n = Math.max(1, Math.min(21, Math.round(Number(opts.installments) || 1)));
    const body: any = { customer: c.customerId, billingType: 'CREDIT_CARD', dueDate: dateStr(opts.dueAt), description: String(description || '').slice(0, 500), externalReference: opts.externalReference || undefined };
    if (n > 1) { body.installmentCount = n; body.totalValue = reais(amountCents); } else body.value = reais(amountCents);
    if (opts.cardToken) { body.creditCardToken = opts.cardToken; body.remoteIp = opts.remoteIp || '127.0.0.1'; }
    const r = await call(token, 'POST', '/payments', body);
    if (!ok2xx(r.status) || !r.json?.id) {
      const msg = errText(r.json, r.status);
      const blob = `${msg} ${JSON.stringify(r.json?.errors || '')}`;
      // recusa do emissor (conta para as 3 tentativas); outros 400 (cliente removido, cartão vencido no cadastro…) = erro
      const declined = Boolean(opts.cardToken) && r.status === 400 && /não autorizad|recusad|negad|saldo|insuficiente|limite|bloquead|expirad|vencid|inválid[oa]s? .*cart|cart[ãa]o .*inválid/i.test(blob);
      return { ok: false, declined, error: msg, customerId: c.customerId, unknown: r.status === 0 || r.status >= 500 };
    }
    const status = normAsaasStatus(r.json.status, r.json.deleted);
    return { ok: true, chargeId: String(r.json.id), status, invoiceUrl: r.json.invoiceUrl, card: status === 'PAID' ? cardOf(r.json) : null, customerId: c.customerId };
  } catch (e: any) {
    // rede/timeout: NÃO se sabe se o Asaas cobrou → quem chama procura pela referência antes de tentar de novo
    return { ok: false, error: String(e?.message || e), unknown: true };
  }
}

/** Cobranças de uma referência nossa (id da cobrança do Pub Mail) numa forma de pagamento — recuperação após timeout/queda. */
export async function asaasFindByReference(token: string, ref: string, billingType?: 'PIX' | 'BOLETO' | 'CREDIT_CARD'): Promise<{ ok: boolean; items: Array<{ id: string; status: NormStatus; raw: string; invoiceUrl?: string; card: CardInfo | null }>; error?: string }> {
  try {
    const r = await call(token, 'GET', `/payments?externalReference=${encodeURIComponent(String(ref).slice(0, 100))}${billingType ? `&billingType=${billingType}` : ''}&limit=20`);
    if (!ok2xx(r.status)) return { ok: false, items: [], error: errText(r.json, r.status) };
    const items = (r.json?.data || []).filter((p: any) => !p.deleted).map((p: any) => ({ id: String(p.id), status: normAsaasStatus(p.status, p.deleted), raw: String(p.status || ''), invoiceUrl: p.invoiceUrl, card: cardOf(p) }));
    return { ok: true, items };
  } catch (e: any) {
    return { ok: false, items: [], error: String(e?.message || e) };
  }
}

/** Só para TESTE no sandbox: paga uma cobrança de cartão como se o cliente digitasse na página do Asaas. */
export async function asaasSandboxPayWithCard(token: string, chargeId: string, card: any, holder: any) {
  if (!isAsaasSandbox(token)) return { ok: false, error: 'só no sandbox' };
  const r = await call(token, 'POST', `/payments/${chargeId}/payWithCreditCard`, { creditCard: card, creditCardHolderInfo: holder });
  return { ok: ok2xx(r.status), status: r.json?.status, card: cardOf(r.json), error: ok2xx(r.status) ? undefined : errText(r.json, r.status) };
}

// ---------------------------------------------------------------- consulta / cancelamento / teste
export async function asaasDetails(token: string, chargeId: string): Promise<PaymentDetails> {
  if (!chargeId) return { ok: false, error: 'chargeId vazio' };
  try {
    const r = await call(token, 'GET', `/payments/${encodeURIComponent(chargeId)}`);
    if (r.status === 404) return { ok: false, error: 'Cobrança não encontrada nesta conta do Asaas (chave trocada?)' };
    if (!ok2xx(r.status)) return { ok: false, error: errText(r.json, r.status) };
    return { ok: true, status: normAsaasStatus(r.json.status, r.json.deleted), raw: String(r.json.status || ''), card: cardOf(r.json), paidAt: r.json.paymentDate || r.json.confirmedDate || null, value_cents: Math.round(Number(r.json.value || 0) * 100) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
export async function asaasStatus(token: string, chargeId: string): Promise<StatusResult> {
  const d = await asaasDetails(token, chargeId);
  return d.ok ? { ok: true, status: d.status } : { ok: false, error: d.error };
}
export async function asaasCancel(token: string, chargeId: string): Promise<CancelResult> {
  try {
    // cobrança parcelada (cartão N×): remover só a 1ª parcela deixava as outras abertas no Asaas → remove o parcelamento inteiro
    const g = await call(token, 'GET', `/payments/${encodeURIComponent(chargeId)}`);
    if (ok2xx(g.status) && g.json?.installment && !g.json?.deleted && normAsaasStatus(g.json.status) !== 'PAID') {
      const d = await call(token, 'DELETE', `/installments/${encodeURIComponent(String(g.json.installment))}`);
      if (ok2xx(d.status) || d.status === 404) return { ok: true };
    }
    const r = await call(token, 'DELETE', `/payments/${encodeURIComponent(chargeId)}`);
    if (ok2xx(r.status) || r.status === 404) return { ok: true };
    return { ok: false, error: errText(r.json, r.status) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
export async function asaasTest(token: string): Promise<TestResult> {
  try {
    const r = await call(token, 'GET', '/myAccount');
    if (!ok2xx(r.status)) return { ok: false, detail: r.status === 401 ? 'Chave do Asaas recusada (401).' : errText(r.json, r.status) };
    const k = await call(token, 'GET', '/pix/addressKeys?limit=1');
    const pix = ok2xx(k.status) && (k.json?.totalCount ?? k.json?.data?.length ?? 0) > 0;
    return { ok: true, detail: `${isAsaasSandbox(token) ? 'Sandbox (teste)' : 'Produção'} · conta válida${pix ? '' : ' · ATENÇÃO: nenhuma chave Pix cadastrada (o PIX não funciona até cadastrar)'}` };
  } catch (e: any) {
    return { ok: false, detail: String(e?.message || e) };
  }
}

/** Cobranças CRIADAS no período (conciliação: compara o status de cada uma com o nosso). Até 500. Por data de
 *  criação e não de pagamento: cartão "confirmado" ainda não tem `paymentDate` (o dinheiro cai depois). */
export async function asaasList(token: string, from: string, to: string): Promise<{ ok: boolean; items: ListedPayment[]; truncated?: boolean; error?: string }> {
  try {
    const items: ListedPayment[] = [];
    let truncated = false;
    for (let offset = 0; ; offset += 100) {
      if (offset >= 2000) { truncated = true; break; }
      const r = await call(token, 'GET', `/payments?dateCreated%5Bge%5D=${from}&dateCreated%5Ble%5D=${to}&limit=100&offset=${offset}`);
      if (!ok2xx(r.status)) return { ok: false, items, error: errText(r.json, r.status) };
      for (const p of r.json?.data || []) items.push({ id: String(p.id), status: normAsaasStatus(p.status, p.deleted), raw: String(p.status || ''), value_cents: Math.round(Number(p.value || 0) * 100), paid_at: p.paymentDate || p.confirmedDate || null, external_reference: p.externalReference || null, billing_type: String(p.billingType || ''), installment: p.installment ? String(p.installment) : null, installment_number: p.installmentNumber ? Number(p.installmentNumber) : null });
      if (!r.json?.hasMore) break;
    }
    return { ok: true, items, truncated };
  } catch (e: any) {
    return { ok: false, items: [], error: String(e?.message || e) };
  }
}

// ---------------------------------------------------------------- webhook
/** Token aleatório aceito pelo Asaas (≥ 32 caracteres, só letras → nunca "números em sequência"). */
export function asaasWebhookToken() {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = randomBytes(40);
  return Array.from(bytes).map((b) => abc[b % abc.length]).join('');
}

/** Cadastra (ou atualiza) o webhook da conta do Asaas apontando para o Pub Mail. */
export async function asaasRegisterWebhook(token: string, url: string, authToken: string, email: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const list = await call(token, 'GET', '/webhooks?limit=100');
    const existing = (list.json?.data || []).find((w: any) => String(w.url || '') === url);
    const body = { name: 'Pub Mail', url, email, enabled: true, interrupted: false, authToken, sendType: 'SEQUENTIALLY', apiVersion: 3, events: ASAAS_WEBHOOK_EVENTS };
    const r = existing?.id ? await call(token, 'PUT', `/webhooks/${existing.id}`, body) : await call(token, 'POST', '/webhooks', body);
    if (ok2xx(r.status) && (r.json?.id || existing?.id)) return { ok: true, id: String(r.json?.id || existing.id) };
    return { ok: false, error: errText(r.json, r.status) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Remove o webhook desta URL na conta do Asaas (org apagada / Asaas removido) — best-effort. */
export async function asaasDeleteWebhook(token: string, url: string): Promise<boolean> {
  try {
    const list = await call(token, 'GET', '/webhooks?limit=100');
    const existing = (list.json?.data || []).filter((w: any) => String(w.url || '') === url);
    for (const w of existing) await call(token, 'DELETE', `/webhooks/${w.id}`).catch(() => undefined);
    return existing.length > 0;
  } catch {
    return false;
  }
}

/** id da cobrança no corpo do webhook do Asaas (`payment.id`). */
export const asaasWebhookChargeId = (body: any): string | null => (body?.payment?.id ? String(body.payment.id) : null);
