// Registro em memória dos clientes que ESTÃO sendo apagados (LGPD, revisão de 14/10/2026 — A-6). PURO (sem Nest/
// Prisma): o serviço de privacidade marca antes de começar e desmarca no fim; a ponte de webhooks e o motor de direito
// de acesso consultam. Enquanto marcado (e por HOLD_MS depois do fim, para os eventos atrasados), nenhum webhook com
// dados desse cliente sai do Pub Mail — no fim sai só o `customer.erased`.
// Processo único (o back roda em 1 processo); se cair no meio, o apagamento é refeito (o `erased_at` só é gravado no fim).

const HOLD_MS = 10 * 60_000;
const MAX = 5_000;
const until = new Map<string, number>(); // `${org}:${customer}` → até quando (Infinity = em andamento)

const key = (orgId: string, customerId: string) => `${orgId}:${customerId}`;

export function markErasing(orgId: string, customerId: string) {
  if (!orgId || !customerId) return;
  until.set(key(orgId, customerId), Number.POSITIVE_INFINITY);
}

/** Fim do apagamento (sucesso ou erro): segura os eventos atrasados por mais `holdMs`. */
export function finishErasing(orgId: string, customerId: string, holdMs = HOLD_MS) {
  if (!orgId || !customerId) return;
  const now = Date.now();
  until.set(key(orgId, customerId), now + Math.max(0, holdMs));
  if (until.size > MAX) for (const [k, t] of until) if (t <= now) until.delete(k);
}

export function isErasing(orgId: string | null | undefined, customerId: string | null | undefined): boolean {
  if (!orgId || !customerId) return false;
  const t = until.get(key(orgId, customerId));
  if (t === undefined) return false;
  if (t > Date.now()) return true;
  until.delete(key(orgId, customerId));
  return false;
}

/** Algum dos clientes está sendo apagado? */
export function anyErasing(orgId: string | null | undefined, customerIds: Array<string | null | undefined>): boolean {
  return customerIds.some((c) => isErasing(orgId, c));
}
