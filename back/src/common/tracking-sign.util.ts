import * as crypto from 'crypto';

// ============================================================================
// Assinatura das URLs de rastreio de e-mail (pixel de abertura + clique no CTA).
//
// Antes as URLs eram "abertas": qualquer um trocava o :email e inflava métricas,
// manipulava A/B e até disparava gatilhos SEND_TEMPLATE pra qualquer lead
// (auditoria A-10). Agora cada URL leva `s` = HMAC-SHA256 (truncado a 32 hex)
// sobre `${sentId}|${email}` com a chave JWT_ACCESS_SECRET (mesma env do back;
// o micro de e-mail recebe a chave junto com o payload e assina do lado dele).
//
// Esquema (o micro monta; o back valida):
//   pixel : GET /webhooks/email/schedule-sent/open-pixel/:projectId/:sentId/:email?s=<sig>
//   clique: GET /webhooks/email/cta-click/:projectId/:sentId/:email/:s?redirectUrl=<url>
//           (o `s` vai no PATH porque o template concatena `?redirectUrl=` depois
//           de {{base_webhook_cta_click}} — uma query no base quebraria o link)
//
// Compatibilidade: e-mails já enviados NÃO têm `s`. Esses continuam aceitos
// SOMENTE se o sent row foi criado antes de TRACKING_SIGNATURE_CUTOFF
// (env override; default 2026-09-26T23:59:59Z). Depois disso, sem `s` = rejeita.
// ============================================================================

export const TRACKING_SIGNATURE_CUTOFF_DEFAULT = '2026-09-26T23:59:59Z';
const SIG_LEN = 32;

export function trackingSecret(): string {
  return String(process.env.JWT_ACCESS_SECRET || '');
}

// Data-limite pra aceitar URL sem assinatura (links legados).
export function trackingSignatureCutoff(): Date {
  const raw = String(process.env.TRACKING_SIGNATURE_CUTOFF || '').trim();
  const d = raw ? new Date(raw) : new Date(TRACKING_SIGNATURE_CUTOFF_DEFAULT);
  return Number.isNaN(d.getTime())
    ? new Date(TRACKING_SIGNATURE_CUTOFF_DEFAULT)
    : d;
}

// Normaliza o e-mail do mesmo jeito nos dois lados (micro e back).
export function trackingEmailKey(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

// HMAC-SHA256(`${sentId}|${email}`) em hex, truncado a 32 chars (128 bits).
export function signTracking(sentId: string, email: string, secret = trackingSecret()): string {
  if (!secret) return '';
  return crypto
    .createHmac('sha256', secret)
    .update(`${String(sentId)}|${trackingEmailKey(email)}`)
    .digest('hex')
    .slice(0, SIG_LEN);
}

// Compara em tempo constante.
export function verifyTracking(
  sentId: string,
  email: string,
  sig: string | undefined | null,
  secret = trackingSecret(),
): boolean {
  const given = String(sig ?? '').trim().toLowerCase();
  if (!given || given.length !== SIG_LEN || !secret) return false;
  const expected = signTracking(sentId, email, secret);
  if (!expected || expected.length !== given.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Só http/https, com host. Devolve a URL normalizada ou null.
export function safeRedirectUrl(raw: string | undefined | null): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.host) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// Extrai os destinos de CTA rastreado presentes no HTML do disparo, i.e. tudo
// que vier depois de `{{base_webhook_cta_click}}?redirectUrl=`. Devolve as
// versões crua e decodificada (o template pode ter sido salvo encodado ou não).
export function extractCtaTargets(html: string | null | undefined): string[] {
  const src = String(html ?? '');
  if (!src) return [];
  const re = /\{\{\s*base_webhook_cta_click\s*\}\}\?redirectUrl=([^'"\s<>]+)/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const raw = m[1].replace(/&amp;/g, '&');
    out.add(raw);
    try {
      out.add(decodeURIComponent(raw));
    } catch {
      /* fica só a crua */
    }
  }
  return [...out];
}

// O redirect pedido bate com algum CTA do HTML enviado? Aceita igualdade exata
// (após normalizar) ou o pedido ser o destino TRUNCADO exatamente num `&`
// (URL não-encodada no template: o parser de query corta no primeiro `&`).
export function redirectAllowedByHtml(redirectUrl: string, html: string | null | undefined): boolean {
  const targets = extractCtaTargets(html);
  if (targets.length === 0) return false;
  const norm = (u: string) => {
    const s = safeRedirectUrl(u);
    return s ? s.toLowerCase() : String(u ?? '').trim().toLowerCase();
  };
  const want = norm(redirectUrl);
  if (!want) return false;
  for (const t of targets) {
    const cand = norm(t);
    if (!cand) continue;
    if (cand === want) return true;
    // truncado no `&`: o destino real = o que chegou + "&resto"
    if (cand.startsWith(want) && cand.charAt(want.length) === '&') return true;
  }
  return false;
}
