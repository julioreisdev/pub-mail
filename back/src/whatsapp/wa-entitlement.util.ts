import { randomBytes } from 'crypto';

// ============================================================================
// Direito de acesso (Fase 5) — regras do produto e estado desejado. PURO: sem Nest, sem banco
// (o CRM usa ao salvar o produto; o motor `WhatsAppEntitlementsService` usa para decidir).
//
//   whatsapp_products.entitlement = { rules: Rule[] }   (legado: array de regras ou uma regra solta)
//   Rule = { id (8 [a-z0-9]), kind: group_member|tag|digital_file|external, label?, session_id? (número ADMIN do grupo),
//            ref (jid do grupo / id da etiqueta / media_id / chave livre), on_overdue: keep|suspend (suspend),
//            suspend_after_days 0..60 (3), on_cancel: revoke|keep (revoke), invite_fallback (true), file_name? (só digital_file) }
//
// Estado desejado (`desiredFor`) por assinatura: active (inclui trial) → active; overdue → suspended depois de
// `suspend_after_days` dias de atraso (BRT) se `on_overdue='suspend'`; paused → suspended; canceled → revoked
// (ou `null` = mantém o atual, com `on_cancel='keep'`).
// ============================================================================

export const ENTITLEMENT_KINDS = ['group_member', 'tag', 'digital_file', 'external'] as const;
export type EntitlementKind = (typeof ENTITLEMENT_KINDS)[number];
export type EntitlementDesired = 'active' | 'suspended' | 'revoked';
export const ENTITLEMENT_STATUSES = ['pending', 'active', 'suspended', 'revoked', 'failed'] as const;
export const MAX_ENTITLEMENT_RULES = 10;

export type EntitlementRule = {
  id: string; kind: EntitlementKind; label: string | null; session_id: string | null; ref: string;
  on_overdue: 'keep' | 'suspend'; suspend_after_days: number; on_cancel: 'revoke' | 'keep'; invite_fallback: boolean;
  file_name?: string | null; // só digital_file: nome do arquivo para o editor mostrar de volta
};

/** Erro de validação de regra (o CRM converte em 400 com a mensagem). */
export class EntitlementRuleError extends Error {}

export const KIND_LABEL: Record<EntitlementKind, string> = { group_member: 'Grupo do WhatsApp', tag: 'Etiqueta', digital_file: 'Arquivo digital', external: 'Sistema externo' };

const RULE_ID_RE = /^[a-z0-9]{8}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GROUP_RE = /^[0-9]{5,40}(-[0-9]{5,20})?@g\.us$/;
const EXTERNAL_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const MEDIA_RE = /^[A-Za-z0-9-]{8,64}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Id novo de regra: 8 caracteres [a-z0-9]. */
export function newRuleId(): string {
  const b = randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

export const digitsOnly = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** Mesmo telefone? Tolera o 9º dígito dos celulares do Brasil (55 + DDD + 9 + 8 dígitos). */
export function samePhone(a: unknown, b: unknown): boolean {
  const key = (v: unknown) => { const d = digitsOnly(v); return d.startsWith('55') && d.length === 13 && d[4] === '9' ? d.slice(0, 4) + d.slice(5) : d; };
  const x = key(a), y = key(b);
  return Boolean(x && y && x.length >= 8 && x === y);
}

/** jid de telefone do contato (`<telefone>@c.us`) — '' quando o contato não tem telefone conhecido. */
export function phoneJidOf(contact: { phone?: string | null; wa_id?: string | null } | null | undefined): string {
  const d = digitsOnly(contact?.phone);
  if (d.length >= 8) return `${d}@c.us`;
  const w = String(contact?.wa_id || '');
  if (/@(c\.us|s\.whatsapp\.net)$/.test(w)) { const wd = digitsOnly(w.split('@')[0].split(':')[0]); if (wd.length >= 8) return `${wd}@c.us`; }
  return '';
}

/** Valida o `ref` de uma regra conforme o tipo; devolve a mensagem de erro (ou null quando ok). */
export function refError(kind: EntitlementKind, ref: string): string | null {
  if (!ref) return 'informe o alvo da regra';
  if (kind === 'group_member') return GROUP_RE.test(ref) ? null : 'o grupo precisa ser um id do WhatsApp terminado em @g.us';
  if (kind === 'tag') return UUID_RE.test(ref) ? null : 'escolha uma etiqueta';
  if (kind === 'digital_file') return MEDIA_RE.test(ref) ? null : 'envie o arquivo';
  return EXTERNAL_RE.test(ref) ? null : 'a chave externa aceita só letras, números e _ . : - (até 64)';
}

const clampInt = (v: unknown, min: number, max: number, def: number) => { const n = parseInt(String(v), 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };

/** Lista crua das regras a partir do JSON salvo (aceita `{rules}`, array ou uma regra solta). */
function rawList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o: any = raw;
    if (Array.isArray(o.rules)) return o.rules;
    if (o.kind) return [o];
  }
  return [];
}

/**
 * Normaliza as regras do produto. `strict` (ao salvar o produto) lança `EntitlementRuleError` com a mensagem
 * da 1ª regra inválida; sem `strict` (motor) regras inválidas são descartadas em silêncio.
 * Ids faltando/repetidos ganham um novo; regras repetidas (mesmo tipo + alvo + número) ficam uma só.
 */
export function normalizeRules(raw: unknown, opts: { strict?: boolean } = {}): { rules: EntitlementRule[] } {
  const list = rawList(raw);
  if (opts.strict && list.length > MAX_ENTITLEMENT_RULES) throw new EntitlementRuleError(`No máximo ${MAX_ENTITLEMENT_RULES} regras de acesso por produto.`);
  const out: EntitlementRule[] = [];
  const ids = new Set<string>();
  const seen = new Set<string>();
  for (const [i, r] of list.slice(0, opts.strict ? list.length : 50).entries()) {
    const fail = (msg: string) => { if (opts.strict) throw new EntitlementRuleError(`Regra de acesso ${i + 1}: ${msg}.`); };
    if (!r || typeof r !== 'object') { fail('formato inválido'); continue; }
    const kind = String(r.kind || '') as EntitlementKind;
    if (!(ENTITLEMENT_KINDS as readonly string[]).includes(kind)) { fail('tipo desconhecido'); continue; }
    const ref = String(r.ref ?? '').trim().slice(0, 255);
    const err = refError(kind, ref);
    if (err) { fail(err); continue; }
    const sessionId = r.session_id ? String(r.session_id).trim() : '';
    if (kind === 'group_member' && !UUID_RE.test(sessionId)) { fail('escolha o número que é administrador do grupo'); continue; }
    if (sessionId && !UUID_RE.test(sessionId)) { fail('número inválido'); continue; }
    const dupKey = `${kind}|${ref}|${kind === 'group_member' ? sessionId : ''}`;
    if (seen.has(dupKey)) continue; // repetida: fica a 1ª
    seen.add(dupKey);
    let id = String(r.id || '').toLowerCase();
    if (!RULE_ID_RE.test(id) || ids.has(id)) { do id = newRuleId(); while (ids.has(id)); }
    ids.add(id);
    const label = String(r.label ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) || null;
    out.push({
      id, kind, label, session_id: sessionId || null, ref,
      on_overdue: r.on_overdue === 'keep' ? 'keep' : 'suspend',
      suspend_after_days: clampInt(r.suspend_after_days, 0, 60, 3),
      on_cancel: r.on_cancel === 'keep' ? 'keep' : 'revoke',
      invite_fallback: kind === 'group_member' ? r.invite_fallback !== false : false,
      ...(kind === 'digital_file' ? { file_name: String(r.file_name ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 255) || null } : {}),
    });
    if (out.length >= MAX_ENTITLEMENT_RULES) break;
  }
  return { rules: out };
}

const dateStr = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
/** Dias de `from` até `to` (datas YYYY-MM-DD). */
export const daysFromTo = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Estado desejado de uma regra para uma assinatura. `today` = YYYY-MM-DD em BRT.
 * `null` = manter o atual (cancelada com `on_cancel='keep'`; status desconhecido).
 */
export function desiredFor(rule: Pick<EntitlementRule, 'on_overdue' | 'suspend_after_days' | 'on_cancel'>, sub: { status?: string | null; next_due_at?: Date | string | null }, today: string): EntitlementDesired | null {
  const st = String(sub?.status || '');
  if (st === 'active') return 'active'; // inclui o teste grátis
  if (st === 'overdue') {
    if (rule.on_overdue !== 'suspend') return 'active';
    const due = dateStr(sub.next_due_at);
    const late = due ? Math.max(0, daysFromTo(due, today)) : 0;
    return late >= Math.max(0, Number(rule.suspend_after_days) || 0) ? 'suspended' : 'active';
  }
  if (st === 'paused') return 'suspended';
  if (st === 'canceled') return rule.on_cancel === 'keep' ? null : 'revoked';
  return null;
}
