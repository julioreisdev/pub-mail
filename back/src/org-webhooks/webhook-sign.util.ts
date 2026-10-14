// Assinatura e helpers PUROS dos webhooks de saída (Fase 5, contrato §8.5) — sem Nest/Prisma, testável em Node.
//
// O cliente confere assim (exemplo em Node):
//   const ts = req.headers['x-pubmail-timestamp'];
//   const esperado = 'sha256=' + crypto.createHmac('sha256', SEGREDO).update(`${ts}.${corpoCru}`).digest('hex');
//   ok = crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(req.headers['x-pubmail-signature']))
//        && Math.abs(Date.now() / 1000 - Number(ts)) < 300;   // recusa reenvio velho
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const WEBHOOK_EVENTS = [
  'customer.created', 'customer.updated',
  // LGPD: dados do cliente apagados (só ids; nenhum dado pessoal) — revisão de 14/10/2026
  'customer.erased',
  'subscription.created', 'subscription.activated', 'subscription.paid', 'subscription.overdue', 'subscription.paused', 'subscription.resumed',
  'subscription.cancel_scheduled', 'subscription.canceled', 'subscription.reactivated', 'subscription.plan_changed',
  'charge.created', 'charge.paid', 'charge.expired', 'charge.canceled',
  'entitlement.activated', 'entitlement.suspended', 'entitlement.revoked', 'entitlement.failed',
  // Fase 6 (agenda)
  'appointment.booked', 'appointment.paid', 'appointment.confirmed', 'appointment.canceled', 'appointment.rescheduled', 'appointment.no_show', 'appointment.expired', 'appointment.done',
  // Fase 6B (chamados)
  'ticket.created', 'ticket.updated', 'ticket.commented', 'ticket.sla_breached',
  // Fase 7 (pedidos)
  'order.created', 'order.updated', 'order.paid',
  'message.received',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
/** Eventos fora do `*` (precisam ser marcados explicitamente). */
export const EXPLICIT_ONLY_EVENTS: string[] = ['message.received'];

const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** `n` caracteres base62 sem viés (rejeição de bytes ≥ 248). */
export function base62(n: number): string {
  let out = '';
  while (out.length < n) {
    for (const b of randomBytes(n * 2)) {
      if (b >= 248) continue;
      out += B62[b % 62];
      if (out.length === n) break;
    }
  }
  return out;
}

export const newWebhookSecret = () => `whsec_${base62(32)}`;
export const maskSecret = (s: string | null | undefined) => (s ? `whsec_••••${String(s).slice(-4)}` : '');

/** Assinatura hex de `"<timestamp>.<corpo>"` com o segredo. */
export function sign(secret: string, ts: number | string, body: string): string {
  return createHmac('sha256', String(secret)).update(`${ts}.${body}`).digest('hex');
}
/** Valor do cabeçalho `X-PubMail-Signature`. */
export const signatureHeader = (secret: string, ts: number | string, body: string) => `sha256=${sign(secret, ts, body)}`;
/** Conferência (lado do cliente / testes). `toleranceSec` = idade máxima do timestamp. */
export function verify(secret: string, ts: number | string, body: string, header: string, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || Math.abs(nowSec - Number(ts)) > toleranceSec) return false;
  const a = Buffer.from(signatureHeader(secret, ts, body));
  const b = Buffer.from(String(header));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Lista de eventos válida (desconhecidos saem; `*` sozinho vale por todos; vazio = `['*']`). */
export function normalizeEvents(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map((x) => String(x || '').trim()) : [];
  const ok = [...new Set(list.filter((e) => e === '*' || (WEBHOOK_EVENTS as readonly string[]).includes(e)))];
  if (!ok.length) return ['*'];
  return ok.includes('*') ? ['*', ...ok.filter((e) => EXPLICIT_ONLY_EVENTS.includes(e))] : ok;
}

/** O webhook quer este evento? (`*` = todos menos os explícitos; `ping` sempre). */
export function wantsEvent(events: unknown, event: string): boolean {
  if (event === 'ping') return true;
  const list = Array.isArray(events) ? events.map(String) : ['*'];
  if (list.includes(event)) return true;
  return list.includes('*') && !EXPLICIT_ONLY_EVENTS.includes(event);
}

/** Espera antes da tentativa N+1 (N = tentativas já feitas, 1..5); a 6ª falha = `failed`. */
export const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000];
export const MAX_DELIVERY_ATTEMPTS = 6;
export const backoffFor = (attempts: number) => (attempts >= MAX_DELIVERY_ATTEMPTS ? null : RETRY_BACKOFF_MS[Math.max(0, Math.min(RETRY_BACKOFF_MS.length - 1, attempts - 1))]);
