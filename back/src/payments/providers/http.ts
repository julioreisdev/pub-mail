// Utilidades HTTP dos gateways (sem Nest).
// ISO 8601 com offset explícito (o Mercado Pago exige offset, ex.:
// "2026-09-26T12:00:00.000-03:00"; aqui geramos em UTC "+00:00").
export function isoWithOffset(d: Date): string {
  return d.toISOString().replace('Z', '+00:00');
}

export const TIMEOUT = 15000;

export async function httpJson(url: string, opts: any): Promise<{ status: number; json: any }> {
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

export function stripBase64(s: any): string | undefined {
  if (!s) return undefined;
  const str = String(s);
  const i = str.indexOf('base64,');
  return i >= 0 ? str.slice(i + 7) : str;
}

// Remove espaços/quebras de linha/controle — um token colado com lixo estouraria
// o header Authorization ("Cannot convert argument to a ByteString").
export const cleanToken = (t: any) => String(t || '').split('').filter((c) => c.charCodeAt(0) > 32 && c.charCodeAt(0) !== 127).join('');
