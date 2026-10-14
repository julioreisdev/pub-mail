// ============================================================================
// Campos personalizados por entidade (Fase 7 — contrato `docs/whatsapp-assinaturas-contrato.md` §11.1).
// PURO (sem Nest/Prisma). Definições em `whatsapp_crm_settings.custom_fields` (mapa por entidade; o array antigo
// = clientes). Valores no JSON `custom` de cada registro, no nível de cima. Testes: docs/tools/wa_custom_fields_test.mjs.
// ============================================================================
// Sem imports: o teste roda o .ts direto no Node (type stripping). CPF/CNPJ = mesma regra de `wa-doc.util.ts`.
const digitsOnly = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const cpfOk = (d: string) => {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
};
const cnpjOk = (d: string) => {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n: number) => { const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
};
const isValidDoc = (doc: unknown) => { const d = digitsOnly(doc); return d.length === 11 ? cpfOk(d) : d.length === 14 ? cnpjOk(d) : false; };

export const CF_ENTITIES = ['customer', 'product', 'subscription', 'charge', 'ticket', 'appointment', 'order'] as const;
export type CfEntity = (typeof CF_ENTITIES)[number];
export const CF_TYPES = ['text', 'number', 'date', 'select', 'bool', 'phone', 'email', 'cpf'] as const;
export type CfType = (typeof CF_TYPES)[number];
export type CfDef = {
  key: string; label: string; type: CfType; required: boolean; options?: string[];
  visible_to_customer: boolean; ask_in_bot: boolean; help?: string;
};
export type CfMap = Record<CfEntity, CfDef[]>;

export const CF_ENTITY_LABEL: Record<CfEntity, string> = {
  customer: 'Clientes', product: 'Produtos', subscription: 'Assinaturas', charge: 'Cobranças', ticket: 'Chamados', appointment: 'Agendamentos', order: 'Pedidos',
};

/** Chaves que o próprio sistema guarda no `custom` (não podem virar campo). */
export const CF_RESERVED = [
  'first_charge', 'trial_charge', 'paused_from', 'status_before_pause', 'readjusted', 'notified', 'plan_credit',
  'usage_cycle', 'due_cents', 'waitlist_id', 'refund_requested', 'fields', 'no_shows',
] as const;

const MAX_DEFS = 30;
const MAX_KEYS = 40;

export function cfKey(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function normDefs(raw: unknown): CfDef[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CfDef[] = [];
  for (const f of raw.slice(0, MAX_DEFS)) {
    if (!f || typeof f !== 'object') continue;
    const label = s((f as any).label, 60);
    const key = cfKey((f as any).key || label);
    if (!label || !key || seen.has(key) || (CF_RESERVED as readonly string[]).includes(key)) continue;
    seen.add(key);
    const type: CfType = (CF_TYPES as readonly string[]).includes((f as any).type) ? (f as any).type : 'text';
    const options = type === 'select' && Array.isArray((f as any).options) ? [...new Set(((f as any).options as unknown[]).map((o) => s(o, 60)).filter(Boolean))].slice(0, 40) : undefined;
    if (type === 'select' && !options?.length) continue; // lista sem opções não serve
    const help = s((f as any).help, 160);
    out.push({
      key, label, type, required: (f as any).required === true,
      ...(options ? { options } : {}),
      visible_to_customer: (f as any).visible_to_customer === true,
      ask_in_bot: (f as any).ask_in_bot === true,
      ...(help ? { help } : {}),
    });
  }
  return out;
}

/** Nunca lança. Array antigo (só clientes) → `{customer: [...]}`. */
export function normalizeCustomFieldMap(raw: unknown): CfMap {
  const src: any = Array.isArray(raw) ? { customer: raw } : raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(CF_ENTITIES.map((e) => [e, normDefs(src[e])])) as CfMap;
}

export type CfError = { key: string; label: string; error: string };
export class CustomFieldsError extends Error {
  readonly code: 'CUSTOM_REQUIRED' | 'CUSTOM_INVALID';
  readonly fields: CfError[];
  constructor(code: 'CUSTOM_REQUIRED' | 'CUSTOM_INVALID', fields: CfError[]) {
    super(code === 'CUSTOM_REQUIRED' ? `Preencha: ${fields.map((f) => f.label).join(', ')}.` : `Campo inválido: ${fields.map((f) => `${f.label} (${f.error})`).join(', ')}.`);
    this.code = code;
    this.fields = fields;
  }
}

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
const BOOL_TRUE = ['true', '1', 'sim', 's', 'yes', 'y', 'on'];
const BOOL_FALSE = ['false', '0', 'nao', 'não', 'n', 'no', 'off'];

/** Converte um valor para o tipo do campo. Devolve `{ok, value}` ou `{ok:false, error}`. Vazio = `{ok:true, value:null}`. */
export function coerceCustomValue(def: CfDef, raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (isEmpty(raw)) return { ok: true, value: null };
  switch (def.type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: 'número inválido' };
    }
    case 'date': {
      const t = String(raw).trim();
      let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
      let iso = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
      if (!iso) { m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
      if (!iso) return { ok: false, error: 'data inválida (use AAAA-MM-DD ou DD/MM/AAAA)' };
      const d = new Date(`${iso}T12:00:00Z`);
      return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === iso ? { ok: true, value: iso } : { ok: false, error: 'data inválida' };
    }
    case 'bool': {
      if (typeof raw === 'boolean') return { ok: true, value: raw };
      const t = String(raw).trim().toLowerCase();
      if (BOOL_TRUE.includes(t)) return { ok: true, value: true };
      if (BOOL_FALSE.includes(t)) return { ok: true, value: false };
      return { ok: false, error: 'use sim ou não' };
    }
    case 'select': {
      const t = String(raw).trim();
      const hit = (def.options || []).find((o) => o.toLowerCase() === t.toLowerCase());
      return hit ? { ok: true, value: hit } : { ok: false, error: 'opção fora da lista' };
    }
    case 'phone': {
      const d = digitsOnly(raw);
      return d.length >= 10 && d.length <= 13 ? { ok: true, value: d } : { ok: false, error: 'telefone inválido' };
    }
    case 'email': {
      const t = String(raw).trim().toLowerCase();
      return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(t) && !t.includes('..') ? { ok: true, value: t.slice(0, 160) } : { ok: false, error: 'e-mail inválido' };
    }
    case 'cpf': {
      const d = digitsOnly(raw);
      return isValidDoc(d) ? { ok: true, value: d } : { ok: false, error: 'CPF/CNPJ inválido' };
    }
    default:
      return { ok: true, value: String(raw).trim().slice(0, 500) };
  }
}

/** Teto de um valor SEM definição (dados de integração): texto até 500 caracteres; número/booleano como vieram;
 *  objeto/lista só se o JSON couber em ~2 KB (senão é descartado — `undefined`). */
export const FREE_VALUE_MAX_BYTES = 2048;
export function capFreeValue(v: unknown): unknown {
  if (typeof v === 'string') return v.slice(0, 500);
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean' || v === null) return v;
  if (typeof v === 'object') {
    try { const j = JSON.stringify(v); return j !== undefined && j.length <= FREE_VALUE_MAX_BYTES ? JSON.parse(j) : undefined; } catch { return undefined; }
  }
  return undefined; // função, símbolo, bigint…
}

/**
 * Valida e mescla os valores dos campos.
 *  - `create`: obrigatório faltando → CustomFieldsError('CUSTOM_REQUIRED').
 *  - `update`: só confere o que veio; apagar (vazio) um obrigatório → CUSTOM_REQUIRED.
 * Chaves sem definição continuam (dados de integrações), sem as reservadas, até 40 chaves no total, cada valor
 * com teto (`capFreeValue`: texto 500, objeto/lista até ~2 KB de JSON — maior é descartado).
 * `current` = custom atual do registro (mantém as chaves internas reservadas dele).
 */
export function validateCustomValues(defs: CfDef[], input: unknown, opts: { mode: 'create' | 'update'; current?: unknown; skipRequired?: boolean } = { mode: 'create' }): Record<string, unknown> {
  const cur: Record<string, unknown> = opts.current && typeof opts.current === 'object' && !Array.isArray(opts.current) ? { ...(opts.current as any) } : {};
  const inp: Record<string, unknown> = input && typeof input === 'object' && !Array.isArray(input) ? (input as any) : {};
  const out: Record<string, unknown> = { ...cur };
  const invalid: CfError[] = [];
  const missing: CfError[] = [];
  const byKey = new Map(defs.map((d) => [d.key, d] as [string, CfDef]));
  for (const [rk, rv] of Object.entries(inp)) {
    const k = String(rk).slice(0, 40);
    if ((CF_RESERVED as readonly string[]).includes(k)) continue; // ninguém de fora mexe nas internas
    const def = byKey.get(k);
    if (!def) {
      const v = isEmpty(rv) ? undefined : capFreeValue(rv);
      if (v === undefined) delete out[k];
      else out[k] = v;
      continue;
    }
    const c = coerceCustomValue(def, rv);
    if (!c.ok) { invalid.push({ key: def.key, label: def.label, error: c.error }); continue; }
    if (c.value === null) delete out[k];
    else out[k] = c.value;
  }
  if (invalid.length) throw new CustomFieldsError('CUSTOM_INVALID', invalid);
  if (!opts.skipRequired) {
    for (const d of defs) {
      if (!d.required) continue;
      const touched = Object.prototype.hasOwnProperty.call(inp, d.key);
      if (opts.mode === 'create' || touched) if (isEmpty(out[d.key])) missing.push({ key: d.key, label: d.label, error: 'obrigatório' });
    }
  }
  if (missing.length) throw new CustomFieldsError('CUSTOM_REQUIRED', missing);
  // teto de chaves: as definidas primeiro, depois as livres
  const keys = Object.keys(out);
  if (keys.length > MAX_KEYS) {
    const reserved = keys.filter((k) => (CF_RESERVED as readonly string[]).includes(k));
    const defined = keys.filter((k) => byKey.has(k));
    const free = keys.filter((k) => !byKey.has(k) && !reserved.includes(k));
    const keep = new Set([...reserved, ...defined, ...free].slice(0, MAX_KEYS + reserved.length));
    for (const k of keys) if (!keep.has(k)) delete out[k];
  }
  return out;
}

/** Valor legível ("Sim/Não", data DD/MM/AAAA) para textos e variáveis. */
export function displayCustomValue(def: CfDef | undefined, v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (!def) return typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (def.type === 'bool') return v === true ? 'Sim' : v === false ? 'Não' : String(v);
  if (def.type === 'date') { const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v); }
  if (def.type === 'number') return Number(v).toLocaleString('pt-BR');
  return String(v);
}

/** Lista de exibição (definidos em ordem + valor), para painéis e para o bot. */
export function customList(defs: CfDef[], custom: unknown, opts: { onlyVisible?: boolean } = {}) {
  const c: any = custom && typeof custom === 'object' ? custom : {};
  return defs.filter((d) => !opts.onlyVisible || d.visible_to_customer).map((d) => ({ ...d, value: c[d.key] ?? '', display: displayCustomValue(d, c[d.key]) }));
}

/** Variáveis `{{<prefixo>.custom.<key>}}` (e, para clientes, o antigo `{{cliente.<key>}}`). */
export function customVars(prefix: string, defs: CfDef[], custom: unknown, legacy = false): Record<string, string> {
  const c: any = custom && typeof custom === 'object' ? custom : {};
  const out: Record<string, string> = {};
  for (const d of defs) {
    const v = displayCustomValue(d, c[d.key]);
    out[`${prefix}.custom.${d.key}`] = v;
    if (legacy) out[`${prefix}.${d.key}`] = v;
  }
  return out;
}
