// Formatos PÚBLICOS (API v1 e webhooks de saída, Fase 5) — o shape do painel sem os campos internos
// (fila, bot, mídia interna, marcas do motor). Funções sem estado: recebem o Prisma/presenter de quem chama.
import { maskDoc } from '../whatsapp/wa-doc.util';
import { RESERVED_CUSTOM_KEYS } from '../whatsapp/whatsapp-subscriptions.service';
import { CF_RESERVED } from '../whatsapp/wa-custom-fields.util';

// Marcas internas que o sistema guarda no `custom` (assinatura, cliente, agendamento, cobrança…) — nunca saem.
const RESERVED = new Set<string>([...(RESERVED_CUSTOM_KEYS as readonly string[]), ...(CF_RESERVED as readonly string[])]);
export const stripReserved = (custom: unknown): Record<string, unknown> =>
  Object.fromEntries(Object.entries(custom && typeof custom === 'object' && !Array.isArray(custom) ? (custom as Record<string, unknown>) : {}).filter(([k]) => !RESERVED.has(k) && !k.startsWith('_')));

/** Assinatura (shape do motor) sem as marcas internas em `custom`. */
export function publicSubscription(s: any) {
  if (!s) return s;
  const { custom, ...rest } = s;
  return { ...rest, custom: stripReserved(custom) };
}

/** Cobrança (shape do painel) sem QR interno, origem do bot e histórico de lembretes da fila. */
export function publicCharge(c: any) {
  if (!c) return c;
  const { bot_flow_id: _b1, bot_node_id: _b2, reminders: _r, pix, ...rest } = c;
  const out: any = { ...rest, pix: pix ? { code: pix.code ?? null, expires_at: pix.expires_at ?? null } : null };
  if ('custom' in rest) out.custom = stripReserved(rest.custom);
  return out;
}

/** Cliente do painel (hidratado) → mesmo shape, sem a lista de campos da tela e com as assinaturas sem marcas internas. */
export function publicCustomer(c: any) {
  if (!c) return c;
  const { custom_list: _cl, subscription: _s, ...rest } = c;
  const out: any = { ...rest, subscriptions: Array.isArray(rest.subscriptions) ? rest.subscriptions.map(publicSubscription) : [] };
  if ('custom' in rest) out.custom = stripReserved(rest.custom);
  if (Array.isArray(rest.appointments)) out.appointments = rest.appointments.map(publicAppointment);
  return out;
}

/** Agendamento sem as marcas internas em `custom` (usage_cycle, due_cents, waitlist_id, refund_requested…) nem lembretes. */
export function publicAppointment(a: any) {
  if (!a || typeof a !== 'object') return a;
  const { reminders: _r, created_by: _c, ...rest } = a;
  return 'custom' in rest ? { ...rest, custom: stripReserved(rest.custom) } : rest;
}

/** Cliente básico (payload de webhook). null se não existe. */
export async function basicCustomer(prisma: any, orgId: string, customerId: string | null | undefined) {
  if (!customerId) return null;
  const c = await prisma.whatsapp_customers.findFirst({ where: { id: String(customerId), organization_id: orgId } });
  if (!c) return null;
  const contact = await prisma.whatsapp_contacts.findUnique({ where: { id: c.contact_id }, select: { phone: true } }).catch(() => null);
  return {
    id: c.id, name: c.name, phone: contact?.phone || null, email: c.email || null, doc_masked: maskDoc(c.doc), code: c.code || null, kind: c.kind || 'person', status: c.status,
    custom: stripReserved(c.custom), created_at: c.created_at, updated_at: c.updated_at,
  };
}

/** Linhas de `whatsapp_entitlements` no formato do contrato §8.3. */
export async function shapeEntitlements(prisma: any, sessionMap: (orgId: string) => Promise<Map<string, any>>, orgId: string, rows: any[]) {
  if (!rows.length) return [];
  const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
  const subIds = [...new Set(rows.map((r) => r.subscription_id).filter(Boolean))] as string[];
  const [custs, subs, smap] = await Promise.all([
    custIds.length ? prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, id: { in: custIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    subIds.length ? prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, id: { in: subIds } }, select: { id: true, product_name: true } }) : Promise.resolve([]),
    sessionMap(orgId).catch(() => new Map<string, any>()),
  ]);
  const cname = new Map<string, string>(custs.map((c: any) => [c.id, c.name]));
  const pname = new Map<string, string>(subs.map((s: any) => [s.id, s.product_name]));
  return rows.map((r) => {
    const s = r.session_id ? smap.get(r.session_id) : null;
    const phone = /@(c\.us|s\.whatsapp\.net)$/.test(String(r.target || '')) ? String(r.target).split('@')[0] : null;
    return {
      id: r.id, customer_id: r.customer_id, customer_name: cname.get(r.customer_id) || null, subscription_id: r.subscription_id || null, product_id: r.product_id || null, product_name: (r.subscription_id && pname.get(r.subscription_id)) || null,
      rule_id: r.rule_id, kind: r.kind, label: r.label || null, ref: r.ref, session: s ? { id: s.id, label: s.label ?? null, color: s.color ?? null } : null,
      target_phone: phone, desired: r.desired, status: r.status, attempts: r.attempts, error: r.error || null, next_try_at: r.next_try_at || null,
      activated_at: r.activated_at || null, suspended_at: r.suspended_at || null, revoked_at: r.revoked_at || null, updated_at: r.updated_at,
    };
  });
}
