// Mercado Pago — PIX e boleto (bolbradesco). Movido sem mudança de lógica de pix-providers.ts (Fase 4).
import { BoletoPayer, BoletoResult, CancelResult, PixResult, StatusResult, TestResult } from './types';
import { httpJson, isoWithOffset, stripBase64 } from './http';

// ------------------------------- Mercado Pago -------------------------------
const MP = 'https://api.mercadopago.com';

export async function mpCreate(token: string, amountCents: number, description: string, opts: any): Promise<PixResult> {
  try {
    // A-22: o QR do MP valia ~24h enquanto localmente expirava em 30 min — quem
    // pagava "atrasado" nunca recebia. Agora o gateway expira junto
    // (`date_of_expiration`) e avisa no nosso webhook (`notification_url`).
    const expiresInMin = Number(opts?.expiresInMin) > 0 ? Number(opts.expiresInMin) : 30;
    const body: Record<string, any> = {
      transaction_amount: Number((amountCents / 100).toFixed(2)),
      description: description.slice(0, 250),
      payment_method_id: 'pix',
      payer: { email: opts?.email || `lead_${opts?.payerRef || opts?.tgUserId || 'x'}@pubmail.bot`, first_name: opts?.name || 'Lead' },
      date_of_expiration: isoWithOffset(new Date(Date.now() + expiresInMin * 60_000)),
      ...(opts?.webhookUrl ? { notification_url: String(opts.webhookUrl) } : {}),
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

// Boleto (bolbradesco): exige CPF/CNPJ, e-mail e endereço do pagador; vencimento ≥ 3 dias.
export async function mpCreateBoleto(token: string, amountCents: number, description: string, payer: BoletoPayer, opts: any): Promise<BoletoResult> {
  try {
    const doc = String(payer.doc || '').replace(/\D/g, '');
    const parts = String(payer.name || 'Cliente').trim().split(/\s+/);
    const first = parts.shift() || 'Cliente';
    const last = parts.join(' ') || first;
    const due: Date = opts?.dueAt instanceof Date ? opts.dueAt : new Date(Date.now() + 3 * 86_400_000);
    const body: Record<string, any> = {
      transaction_amount: Number((amountCents / 100).toFixed(2)),
      description: description.slice(0, 250),
      payment_method_id: 'bolbradesco',
      payer: {
        email: payer.email,
        first_name: first,
        last_name: last,
        identification: { type: doc.length > 11 ? 'CNPJ' : 'CPF', number: doc },
        address: { zip_code: String(payer.address.zip || '').replace(/\D/g, ''), street_name: payer.address.street, street_number: payer.address.number, neighborhood: payer.address.district, city: payer.address.city, federal_unit: payer.address.state },
      },
      date_of_expiration: isoWithOffset(due),
      ...(opts?.webhookUrl ? { notification_url: String(opts.webhookUrl) } : {}),
    };
    const { status, json } = await httpJson(`${MP}/v1/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `${opts?.idempotency || Date.now()}-${Math.random().toString(36).slice(2)}` },
      body: JSON.stringify(body),
    });
    if (status >= 200 && status < 300 && json?.id) {
      const td = json?.transaction_details || {};
      return { ok: true, chargeId: String(json.id), url: td.external_resource_url || undefined, barcode: json?.barcode?.content || undefined, digitable: td.digitable_line || json?.point_of_interaction?.transaction_data?.digitable_line || undefined };
    }
    const cause = Array.isArray(json?.cause) && json.cause[0]?.description ? ` (${json.cause[0].description})` : '';
    return { ok: false, error: `${json?.message || json?.error || `HTTP ${status}`}${cause}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function mpStatus(token: string, chargeId: string): Promise<StatusResult> {
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

// Cancela a cobrança no gateway (só funciona enquanto pendente). Best-effort.
export async function mpCancel(token: string, chargeId: string): Promise<CancelResult> {
  try {
    const { status, json } = await httpJson(`${MP}/v1/payments/${chargeId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (status >= 200 && status < 300) return { ok: true };
    return { ok: false, error: json?.message || `HTTP ${status}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function mpTest(token: string): Promise<TestResult> {
  try {
    const { status, json } = await httpJson(`${MP}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (status >= 200 && status < 300) return { ok: true, detail: json?.nickname ? `Conta ${json.nickname}` : 'Credencial válida' };
    return { ok: false, detail: json?.message || `HTTP ${status}` };
  } catch (e: any) {
    return { ok: false, detail: String(e?.message || e) };
  }
}

