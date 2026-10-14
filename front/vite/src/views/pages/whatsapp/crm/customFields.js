import { useCallback, useEffect, useState } from 'react';

import { get } from 'api/api';

// ============================================================================
// Campos personalizados por entidade (Fase 7, contrato §11.1) — definições em
// GET /whatsapp/crm-settings → `custom_fields` = mapa {customer, product, subscription,
// charge, ticket, appointment, order}. Cache no módulo (uma busca para a página toda);
// quem salva chama `setCrmSettingsCache(resposta)` e todos os hooks recebem na hora.
// ============================================================================

export const CF_ENTITIES = [
  { key: 'customer', label: 'Clientes', hint: 'Cadastro de cada cliente (contrato, placa, plano de internet…).', bot: true },
  { key: 'product', label: 'Produtos', hint: 'Catálogo de produtos, planos e serviços.' },
  { key: 'subscription', label: 'Assinaturas', hint: 'Cada assinatura de um cliente (nº do contrato, endereço da instalação…).' },
  { key: 'charge', label: 'Cobranças', hint: 'Cobranças criadas pelo painel (centro de custo, referência…).' },
  { key: 'ticket', label: 'Chamados', hint: 'Chamados de suporte (equipamento, nº de série…).', bot: true },
  { key: 'appointment', label: 'Agendamentos', hint: 'Agendamentos da agenda (convênio, observação clínica…).' },
  { key: 'order', label: 'Pedidos', hint: 'Pedidos da loja (troco para, ponto de referência…).', bot: true }
];
export const CF_ENTITY_KEYS = CF_ENTITIES.map((e) => e.key);
/** Entidades em que o bot PEDE o campo (Cadastrar cliente · Abrir chamado · Fazer pedido). */
export const CF_BOT_ENTITIES = CF_ENTITIES.filter((e) => e.bot).map((e) => e.key);

export const CF_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Lista de opções' },
  { value: 'bool', label: 'Sim / Não' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'cpf', label: 'CPF / CNPJ' }
];
export const cfTypeLabel = (t) => CF_TYPES.find((x) => x.value === t)?.label || 'Texto';

/** Chaves que o sistema guarda no `custom` (não podem virar campo) — espelho do back. */
export const CF_RESERVED = [
  'first_charge',
  'trial_charge',
  'paused_from',
  'status_before_pause',
  'readjusted',
  'notified',
  'plan_credit',
  'usage_cycle',
  'due_cents',
  'waitlist_id',
  'refund_requested',
  'fields',
  'no_shows'
];
export const CF_MAX_PER_ENTITY = 30;

/** "Nº do contrato" → "n_do_contrato" (mesma regra do back). */
export const cfKey = (raw) =>
  String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

const emptyMap = () => Object.fromEntries(CF_ENTITY_KEYS.map((k) => [k, []]));

/** Aceita o formato novo (mapa) e o antigo (array = clientes). Nunca lança. */
export function normalizeCfMap(raw) {
  const src = Array.isArray(raw) ? { customer: raw } : raw && typeof raw === 'object' ? raw : {};
  const out = emptyMap();
  for (const k of CF_ENTITY_KEYS) out[k] = Array.isArray(src[k]) ? src[k].filter((d) => d && d.key) : [];
  return out;
}

// ---------------------------------------------------------------- cache do módulo
let cache = null; // {custom_fields, identity, ...}
let inflight = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(cache));

export function setCrmSettingsCache(r) {
  if (!r) return;
  cache = { ...r, custom_fields: normalizeCfMap(r.custom_fields ?? r.customer_fields) };
  notify();
}

/** GET /whatsapp/crm-settings (uma requisição por vez; `force` ignora o cache). */
export function loadCrmSettings(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = get('/whatsapp/crm-settings')
    .then((r) => {
      setCrmSettingsCache(r || {});
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Configuração inteira do CRM (campos + identificação) com o mesmo cache. */
export function useCrmSettings() {
  const [state, setState] = useState(cache);
  const [loading, setLoading] = useState(!cache);
  useEffect(() => {
    let alive = true;
    const fn = (c) => alive && setState(c);
    listeners.add(fn);
    loadCrmSettings()
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);
  const reload = useCallback(() => loadCrmSettings(true).catch(() => undefined), []);
  return { settings: state, loading, reload };
}

/** Definições de UMA entidade (`customer`, `product`, …). `defs` é estável enquanto o cache não muda. */
export function useCustomFieldDefs(entity) {
  const { settings, loading, reload } = useCrmSettings();
  const defs = settings?.custom_fields?.[entity] || EMPTY;
  return { defs, loading, reload };
}
const EMPTY = [];

// ---------------------------------------------------------------- valores
/** Valor legível (data DD/MM/AAAA, Sim/Não, telefone e CPF formatados). */
export function formatCustomValue(def, v) {
  if (v === undefined || v === null || v === '') return '';
  if (!def) return typeof v === 'object' ? JSON.stringify(v) : String(v);
  switch (def.type) {
    case 'bool':
      return v === true || v === 'true' ? 'Sim' : v === false || v === 'false' ? 'Não' : String(v);
    case 'date': {
      const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
    }
    case 'number': {
      const n = Number(v);
      return Number.isFinite(n) ? n.toLocaleString('pt-BR') : String(v);
    }
    case 'phone':
      return maskPhone(v);
    case 'cpf':
      return maskDoc(v);
    default:
      return String(v);
  }
}

const digits = (v) => String(v ?? '').replace(/\D/g, '');

/** Máscara leve de telefone: (11) 99999-9999 · +55 (11) 99999-9999. */
export function maskPhone(v) {
  const d = digits(v).slice(0, 13);
  if (!d) return '';
  if (d.length > 11) {
    const cc = d.slice(0, d.length - 11);
    const rest = d.slice(-11);
    return `+${cc} (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`;
  }
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) enquanto digita. */
export function maskDoc(v) {
  const d = digits(v).slice(0, 14);
  if (d.length <= 11)
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** CEP 00000-000 enquanto digita. */
export function maskCep(v) {
  const d = digits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const isEmptyValue = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());

/** Valores do formulário a partir do `custom` do registro (só as chaves definidas; datas em YYYY-MM-DD). */
export function customFormValues(defs, custom) {
  const c = custom && typeof custom === 'object' ? custom : {};
  const out = {};
  for (const d of defs) {
    const v = c[d.key];
    if (v === undefined || v === null) continue;
    if (d.type === 'date') {
      const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
      out[d.key] = m ? `${m[1]}-${m[2]}-${m[3]}` : String(v);
    } else if (d.type === 'bool') out[d.key] = v === true || v === 'true';
    else out[d.key] = v;
  }
  return out;
}

/**
 * O que mandar no `custom` do POST/PUT: SÓ as chaves definidas (as internas do sistema ficam como estão no
 * servidor). Vazio = null (apaga na edição; na criação o back confere os obrigatórios).
 * `onlyTouched` (edição de bloco): manda só o que mudou em relação a `initial`.
 */
export function customPayload(defs, values, { initial, onlyTouched = false } = {}) {
  const out = {};
  for (const d of defs) {
    let v = values?.[d.key];
    if (d.type === 'phone' || d.type === 'cpf') v = isEmptyValue(v) ? null : digits(v);
    else if (d.type === 'bool') v = v === true ? true : v === false ? false : null;
    else if (typeof v === 'string') v = v.trim() || null;
    else if (v === undefined) v = null;
    if (onlyTouched) {
      const before = initial?.[d.key];
      const norm = (x) => (x === undefined || x === '' ? null : x);
      if (JSON.stringify(norm(before)) === JSON.stringify(norm(v))) continue;
    }
    out[d.key] = v;
  }
  return out;
}

/** Conferência local antes de enviar (obrigatórios + formatos simples). `{key: mensagem}` ou null. */
export function validateCustomLocal(defs, values, { mode = 'create' } = {}) {
  const errs = {};
  for (const d of defs) {
    const v = values?.[d.key];
    const empty = d.type === 'bool' ? v !== true && v !== false : isEmptyValue(v);
    if (empty) {
      if (d.required && (mode === 'create' || (values && Object.prototype.hasOwnProperty.call(values, d.key)))) errs[d.key] = 'Obrigatório';
      continue;
    }
    if (d.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())) errs[d.key] = 'E-mail inválido';
    if (d.type === 'phone' && (digits(v).length < 10 || digits(v).length > 13)) errs[d.key] = 'Telefone com DDD (10 a 13 dígitos)';
    if (d.type === 'cpf' && ![11, 14].includes(digits(v).length)) errs[d.key] = 'CPF (11) ou CNPJ (14 dígitos)';
    if (d.type === 'number' && !Number.isFinite(Number(String(v).replace(',', '.')))) errs[d.key] = 'Número inválido';
  }
  return Object.keys(errs).length ? errs : null;
}

/** Erro 400 `{code:'CUSTOM_REQUIRED'|'CUSTOM_INVALID', fields:[{key,label,error}]}` → `{key: mensagem}` ou null. */
export function customErrorsFrom(e) {
  const data = e?.response?.data;
  const code = data?.code || data?.message?.code;
  const fields = data?.fields || data?.message?.fields;
  if (!['CUSTOM_REQUIRED', 'CUSTOM_INVALID'].includes(code) || !Array.isArray(fields)) return null;
  const out = {};
  for (const f of fields) {
    if (!f?.key) continue;
    const msg = code === 'CUSTOM_REQUIRED' ? 'Obrigatório' : String(f.error || 'Valor inválido');
    out[f.key] = msg.charAt(0).toUpperCase() + msg.slice(1);
  }
  return Object.keys(out).length ? out : null;
}

/** Texto curto para o toast a partir do mapa de erros. */
export function customErrorsText(defs, errs) {
  if (!errs) return '';
  const label = (k) => defs.find((d) => d.key === k)?.label || k;
  const keys = Object.keys(errs);
  const req = keys.filter((k) => errs[k] === 'Obrigatório');
  if (req.length === keys.length) return `Preencha: ${req.map(label).join(', ')}.`;
  return `Confira: ${keys.map((k) => `${label(k)} (${errs[k].toLowerCase()})`).join(', ')}.`;
}

/** Resumo de uma linha: "Contrato: 123 · Instalação: 10/10/2026" (só os preenchidos). */
export function customSummary(defs, custom) {
  return (defs || [])
    .map((d) => [d.label, formatCustomValue(d, custom?.[d.key])])
    .filter(([, v]) => v)
    .map(([l, v]) => `${l}: ${v}`)
    .join(' · ');
}
