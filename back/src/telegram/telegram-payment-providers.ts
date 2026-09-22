// Abstração de gateway de pagamento PIX. Provedores plugáveis (o usuário escolhe).
// Cada provedor implementa: criar cobrança PIX, consultar status, testar credencial,
// e extrair o id da cobrança de um webhook. Status normalizado: PENDING|PAID|EXPIRED|FAILED.

export type NormStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';

export type PixResult = {
  ok: boolean;
  chargeId?: string;
  pixCode?: string; // copia e cola
  qrBase64?: string; // imagem do QR (base64 puro, sem prefixo data:)
  error?: string;
};
export type StatusResult = { ok: boolean; status?: NormStatus; error?: string };
export type TestResult = { ok: boolean; detail?: string };

const TIMEOUT = 15000;

async function httpJson(url: string, opts: any): Promise<{ status: number; json: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function stripBase64(s: any): string | undefined {
  if (!s) return undefined;
  const str = String(s);
  const i = str.indexOf('base64,');
  return i >= 0 ? str.slice(i + 7) : str;
}

// ------------------------------- Mercado Pago -------------------------------
const MP = 'https://api.mercadopago.com';

async function mpCreate(token: string, amountCents: number, description: string, opts: any): Promise<PixResult> {
  try {
    const body = {
      transaction_amount: Number((amountCents / 100).toFixed(2)),
      description: description.slice(0, 250),
      payment_method_id: 'pix',
      payer: { email: opts?.email || `lead_${opts?.tgUserId || 'x'}@pubmail.bot`, first_name: opts?.name || 'Lead' },
    };
    const { status, json } = await httpJson(`${MP}/v1/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${opts?.idempotency || Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      body: JSON.stringify(body),
    });
    if (status >= 200 && status < 300 && json?.id) {
      const td = json?.point_of_interaction?.transaction_data || {};
      return { ok: true, chargeId: String(json.id), pixCode: td.qr_code, qrBase64: stripBase64(td.qr_code_base64) };
    }
    return { ok: false, error: json?.message || json?.error || `HTTP ${status}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function mpStatus(token: string, chargeId: string): Promise<StatusResult> {
  try {
    const { status, json } = await httpJson(`${MP}/v1/payments/${chargeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (status < 200 || status >= 300) return { ok: false, error: json?.message || `HTTP ${status}` };
    const s = String(json?.status || '').toLowerCase();
    if (s === 'approved') return { ok: true, status: 'PAID' };
    if (s === 'pending' || s === 'in_process' || s === 'authorized') return { ok: true, status: 'PENDING' };
    if (s === 'cancelled' || s === 'expired') return { ok: true, status: 'EXPIRED' };
    return { ok: true, status: 'FAILED' };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function mpTest(token: string): Promise<TestResult> {
  try {
    const { status, json } = await httpJson(`${MP}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (status >= 200 && status < 300) return { ok: true, detail: json?.nickname ? `Conta ${json.nickname}` : 'Credencial válida' };
    return { ok: false, detail: json?.message || `HTTP ${status}` };
  } catch (e: any) {
    return { ok: false, detail: String(e?.message || e) };
  }
}

// --------------------------------- PushinPay --------------------------------
const PP = 'https://api.pushinpay.com.br';

async function ppCreate(token: string, amountCents: number, description: string, opts: any): Promise<PixResult> {
  try {
    const { status, json } = await httpJson(`${PP}/api/pix/cashIn`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ value: amountCents, ...(opts?.webhookUrl ? { webhook_url: opts.webhookUrl } : {}) }),
    });
    if (status >= 200 && status < 300 && json?.id) {
      return { ok: true, chargeId: String(json.id), pixCode: json.qr_code, qrBase64: stripBase64(json.qr_code_base64) };
    }
    return { ok: false, error: json?.message || JSON.stringify(json?.errors || json) || `HTTP ${status}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ppStatus(token: string, chargeId: string): Promise<StatusResult> {
  try {
    const { status, json } = await httpJson(`${PP}/api/transactions/${chargeId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (status < 200 || status >= 300) return { ok: false, error: json?.message || `HTTP ${status}` };
    const s = String(json?.status || '').toLowerCase();
    if (s === 'paid' || s === 'approved') return { ok: true, status: 'PAID' };
    if (s === 'created' || s === 'pending') return { ok: true, status: 'PENDING' };
    if (s === 'expired') return { ok: true, status: 'EXPIRED' };
    return { ok: true, status: 'FAILED' };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ppTest(token: string): Promise<TestResult> {
  // PushinPay não tem endpoint "me"; batemos numa transação inexistente:
  // 401 => token inválido; 404/422 => token aceito.
  try {
    const { status } = await httpJson(`${PP}/api/transactions/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (status === 401 || status === 403) return { ok: false, detail: 'Token recusado (401/403).' };
    return { ok: true, detail: 'Token aceito.' };
  } catch (e: any) {
    return { ok: false, detail: String(e?.message || e) };
  }
}

// --------------------------------- Fachada ----------------------------------
// Remove espaços/quebras de linha/controle — um token colado com lixo estouraria
// o header Authorization ("Cannot convert argument to a ByteString").
const cleanToken = (t: any) => String(t || '').split('').filter((c) => c.charCodeAt(0) > 32 && c.charCodeAt(0) !== 127).join('');

export function createPixCharge(provider: string, token: string, amountCents: number, description: string, opts: any = {}): Promise<PixResult> {
  const tk = cleanToken(token);
  if (provider === 'pushinpay') return ppCreate(tk, amountCents, description, opts);
  return mpCreate(tk, amountCents, description, opts);
}

export function getChargeStatus(provider: string, token: string, chargeId: string): Promise<StatusResult> {
  const tk = cleanToken(token);
  if (provider === 'pushinpay') return ppStatus(tk, chargeId);
  return mpStatus(tk, chargeId);
}

export function testProvider(provider: string, token: string): Promise<TestResult> {
  const tk = cleanToken(token);
  if (!tk) return Promise.resolve({ ok: false, detail: 'Token vazio.' });
  if (provider === 'pushinpay') return ppTest(tk);
  return mpTest(tk);
}

// Extrai o id da cobrança de um webhook (o status é reconfirmado via getChargeStatus).
export function extractWebhookChargeId(provider: string, query: any, body: any): string | null {
  if (provider === 'pushinpay') {
    return body?.id ? String(body.id) : null;
  }
  // Mercado Pago: id vem em data.id (body) ou em query (id / data.id / resource)
  const fromBody = body?.data?.id || body?.resource;
  const fromQuery = query?.['data.id'] || query?.id;
  const v = fromBody || fromQuery;
  if (!v) return null;
  const s = String(v);
  // resource pode ser uma URL terminando no id
  const m = s.match(/(\d+)\s*$/);
  return m ? m[1] : s;
}

export const KNOWN_PROVIDERS = ['mercadopago', 'pushinpay'];
