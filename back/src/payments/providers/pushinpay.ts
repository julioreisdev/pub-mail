// PushinPay — só PIX. Movido sem mudança de lógica de pix-providers.ts (Fase 4).
import { PixResult, StatusResult, TestResult } from './types';
import { httpJson, stripBase64 } from './http';

// --------------------------------- PushinPay --------------------------------
const PP = 'https://api.pushinpay.com.br';

export async function ppCreate(token: string, amountCents: number, description: string, opts: any): Promise<PixResult> {
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

export async function ppStatus(token: string, chargeId: string): Promise<StatusResult> {
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

export async function ppTest(token: string): Promise<TestResult> {
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

