// Interpretador PURO do Fluxo do Bot do WhatsApp (sem banco, sem rede).
// Recebe a definição (grafo do construtor), o estado da conversa e a entrada do
// cliente e devolve { state, actions }. O runtime executa as ações de verdade
// (envia pelo WhatsApp, etiqueta, transfere, cobra PIX) e o simulador só as mostra.
//
// Definição: { nodes: [{id,type,position,data}], edges: [{id,source,sourceHandle,target}] }
// Tipos: start · message · menu · question · condition · tags · wait · pix · handoff · end

export type BotNode = { id: string; type: string; data?: any; position?: any };
export type BotEdge = { id?: string; source: string; sourceHandle?: string | null; target: string };
export type BotDefinition = { nodes: BotNode[]; edges: BotEdge[] };

export type BotStatus = 'active' | 'waiting' | 'done' | 'handoff' | 'stopped';
export type BotState = {
  node_id: string | null;
  status: BotStatus;
  waiting_for: 'menu' | 'question' | 'pix' | 'wait' | null;
  vars: Record<string, string>;
  retries: number;
  wait_until: string | null;
  last_input: string | null;
  pix: { amount_cents: number; description: string; code?: string | null; payment_id?: string | null } | null;
};

export type BotMedia = { id?: string; url?: string; kind?: string; mime?: string; filename?: string } | null;
export type BotAction =
  | { type: 'typing'; ms: number }
  | { type: 'send'; delay_ms: number; message: { kind: 'text' | 'image' | 'video' | 'audio' | 'document'; text?: string; media?: BotMedia } }
  | { type: 'tags'; add: string[]; remove: string[] }
  | { type: 'set_var'; name: string; value: string }
  | { type: 'save_contact'; field: 'name' | 'email'; value: string }
  | { type: 'handoff'; assign_user_id: string | null }
  | { type: 'close' }
  | { type: 'finish' }
  | { type: 'pix'; node_id: string; amount_cents: number; description: string; text: string; send_qr: boolean; expires_minutes: number }
  | { type: 'pix_check' }
  | { type: 'wait'; seconds: number }
  | { type: 'info'; text: string };

export type BusinessHours = {
  enabled?: boolean;
  days?: Record<string, { start: string; end: string }[]>;
  outside_text?: string;
  outside_action?: 'message_and_continue' | 'message_and_handoff' | 'message_only';
};

export type BotSettings = {
  audience?: { mode?: 'all' | 'test' | 'tags'; test_chat_ids?: string[]; tag_ids?: string[] };
  trigger?: { mode?: 'any' | 'keywords'; keywords?: string[] };
  restart_keywords?: string[];
  exclude_tag_ids?: string[];
  input_timeout_hours?: number;
  invalid_option_text?: string;
  max_retries?: number;
  typing?: boolean;
  numbering?: 'emoji' | 'number';
  business_hours?: BusinessHours;
};

export type BotContext = {
  contact: { name?: string | null; phone?: string | null; saved?: boolean };
  vars?: Record<string, string>; // {{cliente.*}} do CRM (vazio quando não é cliente)
  chatTagIds: string[];
  now: Date;
  settings: BotSettings;
};

const MAX_STEPS = 60;
// construídos por código (escapes \u escritos direto no arquivo viram caractere literal)
const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');
const KEYCAP_RE = new RegExp(`^(\\d)${String.fromCharCode(0xfe0f)}?${String.fromCharCode(0x20e3)}$`);
export const DEFAULT_INVALID = 'Não entendi 🤔 Responda com o número de uma das opções.';

// ---------------------------------------------------------------- utilitários
export function norm(v: unknown) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KEYCAPS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
function keycapToNumber(s: string) {
  const t = String(s || '').trim();
  const i = KEYCAPS.indexOf(t);
  if (i >= 0) return String(i);
  // "1️⃣" pode chegar como "1️⃣"
  const m = KEYCAP_RE.exec(t);
  return m ? m[1] : null;
}

export function formatBRL(cents: number) {
  return (Math.max(0, Number(cents) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fillVars(text: string, state: BotState, ctx: BotContext) {
  const name = String(ctx.contact?.name || '').trim();
  const first = name.split(/\s+/)[0] || '';
  const base: Record<string, string> = {
    nome: name,
    primeiro_nome: first,
    telefone: String(ctx.contact?.phone || ''),
    pix_valor: state.pix ? formatBRL(state.pix.amount_cents) : '',
    pix_codigo: state.pix?.code || '',
    ...(ctx.vars || {}),
  };
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, k: string) => {
    const key = String(k).toLowerCase();
    if (key in base) return base[key];
    return state.vars?.[key] ?? state.vars?.[k] ?? '';
  });
}

function typingMs(text: string, delaySeconds?: number) {
  if (delaySeconds && delaySeconds > 0) return Math.min(30, delaySeconds) * 1000;
  const len = String(text || '').length;
  return Math.min(4000, Math.max(700, len * 35));
}

// ---------------------------------------------------------------- horário de atendimento (BRT)
function brtParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(String(parts.weekday));
  const hh = Number(parts.hour) % 24;
  return { dow, minutes: hh * 60 + Number(parts.minute) };
}
const toMin = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export function isBusinessOpen(bh: BusinessHours | undefined, now: Date) {
  if (!bh?.enabled) return true;
  const { dow, minutes } = brtParts(now);
  const ranges = bh.days?.[String(dow)] || [];
  return ranges.some((r) => {
    const a = toMin(r.start);
    const b = toMin(r.end);
    if (a == null || b == null) return false;
    return b > a ? minutes >= a && minutes < b : minutes >= a || minutes < b; // intervalo que vira a noite
  });
}

// ---------------------------------------------------------------- grafo
function nodeById(def: BotDefinition, id: string | null | undefined) {
  return id ? def.nodes.find((n) => n.id === id) || null : null;
}
function nextOf(def: BotDefinition, nodeId: string, handle: string) {
  const e = def.edges.find((x) => x.source === nodeId && (x.sourceHandle || 'out') === handle);
  return e?.target || null;
}
export function startNode(def: BotDefinition) {
  return def.nodes.find((n) => n.type === 'start') || null;
}

export function emptyState(): BotState {
  return { node_id: null, status: 'active', waiting_for: null, vars: {}, retries: 0, wait_until: null, last_input: null, pix: null };
}

function menuText(node: BotNode, settings: BotSettings, state: BotState, ctx: BotContext) {
  const d = node.data || {};
  const numbering = d.numbering || settings.numbering || 'emoji';
  const opts: any[] = Array.isArray(d.options) ? d.options : [];
  const lines = opts.map((o, i) => {
    const n = i + 1;
    const mark = numbering === 'emoji' && n <= 10 ? KEYCAPS[n] : `*${n}.*`;
    return `${mark} ${fillVars(String(o.label || ''), state, ctx)}`;
  });
  const head = fillVars(String(d.text || ''), state, ctx).trim();
  return [head, lines.join('\n')].filter(Boolean).join('\n\n');
}

function matchOption(node: BotNode, input: string) {
  const opts: any[] = Array.isArray(node.data?.options) ? node.data.options : [];
  const raw = String(input || '').trim();
  const kc = keycapToNumber(raw);
  const n = norm(raw);
  const num = kc || (/^\d{1,2}$/.test(n) ? n : null) || (/^(opcao|opção|numero|número|n)\s*(\d{1,2})$/.exec(n)?.[2] ?? null);
  if (num) {
    const i = Number(num) - 1;
    if (i >= 0 && i < opts.length) return opts[i];
  }
  const exact = opts.find((o) => norm(o.label) === n);
  if (exact) return exact;
  return (
    opts.find((o) => (Array.isArray(o.keywords) ? o.keywords : []).some((k: string) => {
      const kk = norm(k);
      return kk && (n === kk || ` ${n} `.includes(` ${kk} `));
    })) || null
  );
}

function cpfOk(d: string) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function validateAnswer(kind: string, input: string): { ok: boolean; value: string } {
  const v = String(input || '').trim();
  const digits = v.replace(/\D/g, '');
  switch (kind) {
    case 'name':
      return { ok: /\p{L}{2,}/u.test(v) && v.length <= 80, value: v.replace(/\s+/g, ' ') };
    case 'email':
      return { ok: /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v.toLowerCase()), value: v.toLowerCase() };
    case 'phone':
      return { ok: digits.length >= 10 && digits.length <= 13, value: digits };
    case 'number':
      return { ok: /^-?\d+([.,]\d+)?$/.test(v), value: v.replace(',', '.') };
    case 'cpf':
      return { ok: cpfOk(digits), value: digits };
    case 'date': {
      const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v);
      if (!m) return { ok: false, value: v };
      const y = m[3].length === 2 ? `20${m[3]}` : m[3];
      const dt = new Date(Number(y), Number(m[2]) - 1, Number(m[1]));
      const ok = dt.getDate() === Number(m[1]) && dt.getMonth() === Number(m[2]) - 1;
      return { ok, value: `${String(m[1]).padStart(2, '0')}/${String(m[2]).padStart(2, '0')}/${y}` };
    }
    default:
      return { ok: v.length > 0, value: v };
  }
}

function evalRule(rule: any, state: BotState, ctx: BotContext) {
  const src = String(rule?.source || 'var');
  const op = String(rule?.op || 'eq');
  const val = String(rule?.value ?? '');
  if (src === 'tag') {
    const has = ctx.chatTagIds.includes(String(rule?.key || ''));
    return op === 'not_has' ? !has : has;
  }
  if (src === 'business_hours') {
    const open = isBusinessOpen(ctx.settings.business_hours, ctx.now);
    return op === 'closed' ? !open : open;
  }
  if (src === 'contact_saved') return String(Boolean(ctx.contact?.saved)) === (val || 'true');
  const cur = src === 'last_input' ? String(state.last_input || '') : String(state.vars?.[String(rule?.key || '').toLowerCase()] ?? state.vars?.[String(rule?.key || '')] ?? '');
  const a = norm(cur);
  const b = norm(val);
  switch (op) {
    case 'eq': return a === b;
    case 'neq': return a !== b;
    case 'contains': return b ? a.includes(b) : false;
    case 'not_contains': return b ? !a.includes(b) : true;
    case 'empty': return !a;
    case 'not_empty': return Boolean(a);
    case 'gt': return Number(cur.replace(',', '.')) > Number(val.replace(',', '.'));
    case 'lt': return Number(cur.replace(',', '.')) < Number(val.replace(',', '.'));
    default: return false;
  }
}

// ---------------------------------------------------------------- execução
function sendText(actions: BotAction[], text: string, ctx: BotContext, delaySeconds?: number) {
  const t = String(text || '').trim();
  if (!t) return;
  const ms = typingMs(t, delaySeconds);
  if (ctx.settings.typing !== false) actions.push({ type: 'typing', ms });
  actions.push({ type: 'send', delay_ms: ctx.settings.typing !== false ? ms : 0, message: { kind: 'text', text: t } });
}

/** Anda pelo grafo a partir de `fromId` até precisar de entrada, acabar ou esperar. */
function walk(def: BotDefinition, state: BotState, fromId: string | null, ctx: BotContext, actions: BotAction[]) {
  let id: string | null = fromId;
  let steps = 0;
  while (id && steps++ < MAX_STEPS) {
    const node = nodeById(def, id);
    if (!node) break;
    const d = node.data || {};
    state.node_id = node.id;
    switch (node.type) {
      case 'start':
        id = nextOf(def, node.id, 'out');
        continue;
      case 'message': {
        const items: any[] = Array.isArray(d.messages) ? d.messages : [];
        for (const m of items) {
          const text = fillVars(String(m.text || ''), state, ctx);
          const kind = ['image', 'video', 'audio', 'document'].includes(m.kind) && m.media ? m.kind : 'text';
          if (kind === 'text') sendText(actions, text, ctx, m.delay_seconds);
          else {
            const ms = typingMs(text, m.delay_seconds);
            if (ctx.settings.typing !== false) actions.push({ type: 'typing', ms });
            actions.push({ type: 'send', delay_ms: ctx.settings.typing !== false ? ms : 0, message: { kind, text: text || undefined, media: m.media } });
          }
        }
        id = nextOf(def, node.id, 'out');
        continue;
      }
      case 'menu':
        sendText(actions, menuText(node, ctx.settings, state, ctx), ctx);
        state.status = 'waiting';
        state.waiting_for = 'menu';
        state.retries = 0;
        actions.push({ type: 'info', text: 'Aguardando o cliente escolher uma opção' });
        return;
      case 'question':
        sendText(actions, fillVars(String(d.text || ''), state, ctx), ctx);
        state.status = 'waiting';
        state.waiting_for = 'question';
        state.retries = 0;
        actions.push({ type: 'info', text: `Aguardando a resposta do cliente${d.var ? ` (vai para {{${d.var}}})` : ''}` });
        return;
      case 'condition': {
        const rules: any[] = Array.isArray(d.rules) ? d.rules : [];
        const results = rules.map((r) => evalRule(r, state, ctx));
        const ok = rules.length ? (d.match === 'any' ? results.some(Boolean) : results.every(Boolean)) : true;
        actions.push({ type: 'info', text: `Condição “${d.title || 'Condição'}”: ${ok ? 'sim' : 'não'}` });
        id = nextOf(def, node.id, ok ? 'true' : 'false');
        continue;
      }
      case 'tags': {
        const add = (Array.isArray(d.add) ? d.add : []).map(String);
        const remove = (Array.isArray(d.remove) ? d.remove : []).map(String);
        if (add.length || remove.length) {
          actions.push({ type: 'tags', add, remove });
          const set = new Set(ctx.chatTagIds);
          add.forEach((x: string) => set.add(x));
          remove.forEach((x: string) => set.delete(x));
          ctx.chatTagIds = [...set];
        }
        id = nextOf(def, node.id, 'out');
        continue;
      }
      case 'wait': {
        const amount = Math.max(1, Number(d.amount) || 1);
        const mult = d.unit === 'hours' ? 3600 : d.unit === 'minutes' ? 60 : 1;
        const seconds = Math.min(7 * 86400, amount * mult);
        state.status = 'waiting';
        state.waiting_for = 'wait';
        state.wait_until = new Date(ctx.now.getTime() + seconds * 1000).toISOString();
        actions.push({ type: 'wait', seconds });
        return;
      }
      case 'pix': {
        const cents = Math.max(0, Math.round(Number(d.amount_cents) || 0));
        state.pix = { amount_cents: cents, description: String(d.description || 'Pagamento').slice(0, 200) };
        state.status = 'waiting';
        state.waiting_for = 'pix';
        actions.push({ type: 'pix', node_id: node.id, amount_cents: cents, description: state.pix.description, text: String(d.text || ''), send_qr: d.send_qr !== false, expires_minutes: Math.min(1440, Math.max(5, Number(d.expires_minutes) || 30)) });
        return;
      }
      case 'handoff':
        sendText(actions, fillVars(String(d.text || ''), state, ctx), ctx);
        actions.push({ type: 'handoff', assign_user_id: d.assign_user_id ? String(d.assign_user_id) : null });
        state.status = 'handoff';
        state.waiting_for = null;
        return;
      case 'end':
        sendText(actions, fillVars(String(d.text || ''), state, ctx), ctx);
        actions.push(d.close === false ? { type: 'finish' } : { type: 'close' });
        state.status = 'done';
        state.waiting_for = null;
        return;
      default:
        id = nextOf(def, node.id, 'out');
        continue;
    }
  }
  // saiu do grafo (bloco sem continuação) → fluxo concluído
  if (steps >= MAX_STEPS) actions.push({ type: 'info', text: 'Fluxo interrompido: laço detectado (muitos blocos seguidos sem esperar o cliente).' });
  state.status = 'done';
  state.waiting_for = null;
  actions.push({ type: 'finish' });
}

/** Começa o fluxo (cliente mandou a 1ª mensagem ou o atendente enviou para o bot). */
export function startFlow(def: BotDefinition, ctx: BotContext, firstInput?: string | null) {
  const state = emptyState();
  state.last_input = firstInput ?? null;
  const actions: BotAction[] = [];
  const start = startNode(def);
  if (!start) {
    actions.push({ type: 'info', text: 'O fluxo não tem bloco de início.' });
    state.status = 'done';
    return { state, actions };
  }
  const bh = ctx.settings.business_hours;
  if (bh?.enabled && !isBusinessOpen(bh, ctx.now)) {
    sendText(actions, fillVars(String(bh.outside_text || 'Estamos fora do horário de atendimento. Assim que possível retornaremos.'), state, ctx), ctx);
    if (bh.outside_action === 'message_only') {
      state.status = 'done';
      actions.push({ type: 'finish' });
      return { state, actions };
    }
    if (bh.outside_action === 'message_and_handoff') {
      actions.push({ type: 'handoff', assign_user_id: null });
      state.status = 'handoff';
      return { state, actions };
    }
  }
  walk(def, state, start.id, ctx, actions);
  return { state, actions };
}

/** Cliente respondeu enquanto o bot esperava (opção, pergunta, PIX). */
export function handleInput(def: BotDefinition, prev: BotState, input: string, ctx: BotContext) {
  const state: BotState = { ...emptyState(), ...prev, vars: { ...(prev.vars || {}) } };
  state.last_input = String(input || '');
  const actions: BotAction[] = [];
  const node = nodeById(def, state.node_id);
  if (!node || state.status !== 'waiting') {
    actions.push({ type: 'info', text: 'O bot não está esperando resposta nesta conversa.' });
    return { state, actions };
  }
  const d = node.data || {};
  const maxRetries = Math.max(1, Number(d.max_retries) || Number(ctx.settings.max_retries) || 3);

  if (state.waiting_for === 'menu') {
    const opt = matchOption(node, input);
    if (opt) {
      state.vars.opcao = String(opt.label || '');
      state.status = 'active';
      state.waiting_for = null;
      state.retries = 0;
      actions.push({ type: 'info', text: `Opção escolhida: ${opt.label}` });
      walk(def, state, nextOf(def, node.id, `opt-${opt.id}`), ctx, actions);
      return { state, actions };
    }
    state.retries += 1;
    const invalidEdge = nextOf(def, node.id, 'invalid');
    if (state.retries >= maxRetries && invalidEdge) {
      actions.push({ type: 'info', text: `Opção inválida (${state.retries}/${maxRetries}) — seguindo pelo caminho “inválida”` });
      state.status = 'active';
      state.waiting_for = null;
      state.retries = 0;
      walk(def, state, invalidEdge, ctx, actions);
      return { state, actions };
    }
    actions.push({ type: 'info', text: `Opção inválida (${state.retries}/${maxRetries})` });
    sendText(actions, fillVars(String(d.invalid_text || ctx.settings.invalid_option_text || DEFAULT_INVALID), state, ctx), ctx);
    if (state.retries >= maxRetries) sendText(actions, menuText(node, ctx.settings, state, ctx), ctx);
    return { state, actions };
  }

  if (state.waiting_for === 'question') {
    const r = validateAnswer(String(d.validate || 'any'), input);
    if (r.ok) {
      const name = String(d.var || '').trim().toLowerCase();
      if (name) {
        state.vars[name] = r.value;
        actions.push({ type: 'set_var', name, value: r.value });
      }
      if (d.save_to_contact === 'name' || d.save_to_contact === 'email') actions.push({ type: 'save_contact', field: d.save_to_contact, value: r.value });
      state.status = 'active';
      state.waiting_for = null;
      state.retries = 0;
      walk(def, state, nextOf(def, node.id, 'out'), ctx, actions);
      return { state, actions };
    }
    state.retries += 1;
    const invalidEdge = nextOf(def, node.id, 'invalid');
    if (state.retries >= maxRetries && invalidEdge) {
      state.status = 'active';
      state.waiting_for = null;
      state.retries = 0;
      walk(def, state, invalidEdge, ctx, actions);
      return { state, actions };
    }
    const fallback: Record<string, string> = {
      email: 'Esse e-mail não parece válido. Pode conferir e mandar de novo?',
      phone: 'Não reconheci esse telefone. Mande com DDD, só números.',
      cpf: 'Esse CPF não é válido. Pode conferir?',
      date: 'Mande a data no formato DD/MM/AAAA.',
      number: 'Mande só números, por favor.',
      name: 'Pode me dizer seu nome?',
    };
    sendText(actions, fillVars(String(d.invalid_text || fallback[String(d.validate)] || 'Não entendi. Pode responder de novo?'), state, ctx), ctx);
    return { state, actions };
  }

  if (state.waiting_for === 'pix') {
    const n = norm(input);
    if (/\b(paguei|pago|ja paguei|pix feito|feito|comprovante|transferi)\b/.test(n)) actions.push({ type: 'pix_check' });
    else actions.push({ type: 'info', text: 'Aguardando a confirmação do pagamento' });
    return { state, actions };
  }

  if (state.waiting_for === 'wait') {
    actions.push({ type: 'info', text: 'O bot está numa espera programada; a mensagem do cliente não muda o fluxo.' });
    return { state, actions };
  }
  return { state, actions };
}

/** Eventos: espera concluída, PIX pago, PIX expirado. */
export function handleEvent(def: BotDefinition, prev: BotState, event: 'wait_done' | 'pix_paid' | 'pix_expired', ctx: BotContext) {
  const state: BotState = { ...emptyState(), ...prev, vars: { ...(prev.vars || {}) } };
  const actions: BotAction[] = [];
  const node = nodeById(def, state.node_id);
  if (!node) {
    state.status = 'done';
    return { state, actions };
  }
  const d = node.data || {};
  if (event === 'wait_done' && state.waiting_for === 'wait') {
    state.status = 'active';
    state.waiting_for = null;
    state.wait_until = null;
    walk(def, state, nextOf(def, node.id, 'out'), ctx, actions);
  } else if (event === 'pix_paid' && state.waiting_for === 'pix') {
    sendText(actions, fillVars(String(d.paid_text || '✅ Pagamento confirmado! Obrigado.'), state, ctx), ctx);
    state.status = 'active';
    state.waiting_for = null;
    walk(def, state, nextOf(def, node.id, 'paid'), ctx, actions);
  } else if (event === 'pix_expired' && state.waiting_for === 'pix') {
    sendText(actions, fillVars(String(d.expired_text || '⌛ O PIX expirou. Se quiser, é só pedir um novo.'), state, ctx), ctx);
    state.status = 'active';
    state.waiting_for = null;
    walk(def, state, nextOf(def, node.id, 'expired'), ctx, actions);
  }
  return { state, actions };
}

// ---------------------------------------------------------------- validação da definição
const TYPES = new Set(['start', 'message', 'menu', 'question', 'condition', 'tags', 'wait', 'pix', 'handoff', 'end']);

/** Problemas que impedem ativar o fluxo (lista vazia = ok). */
export function validateDefinition(def: BotDefinition | null | undefined): string[] {
  const errs: string[] = [];
  if (!def || !Array.isArray(def.nodes) || !Array.isArray(def.edges)) return ['O fluxo está vazio.'];
  const starts = def.nodes.filter((n) => n.type === 'start');
  if (starts.length !== 1) errs.push('O fluxo precisa de exatamente um bloco de início.');
  const ids = new Set(def.nodes.map((n) => n.id));
  for (const n of def.nodes) {
    if (!TYPES.has(n.type)) errs.push(`Bloco de tipo desconhecido: ${n.type}.`);
    const d = n.data || {};
    const title = d.title || n.type;
    if (n.type === 'menu' && !(Array.isArray(d.options) && d.options.length)) errs.push(`“${title}”: adicione pelo menos uma opção.`);
    if (n.type === 'question' && !String(d.text || '').trim()) errs.push(`“${title}”: escreva a pergunta.`);
    if (n.type === 'pix' && !(Number(d.amount_cents) > 0)) errs.push(`“${title}”: informe o valor da cobrança.`);
    if (n.type === 'message' && !(Array.isArray(d.messages) && d.messages.some((m: any) => String(m.text || '').trim() || m.media))) errs.push(`“${title}”: a mensagem está vazia.`);
  }
  for (const e of def.edges) if (!ids.has(e.source) || !ids.has(e.target)) errs.push('Há uma ligação apontando para um bloco que não existe.');
  const start = starts[0];
  if (start && !def.edges.some((e) => e.source === start.id)) errs.push('Ligue o bloco de início ao primeiro passo do fluxo.');
  return [...new Set(errs)];
}
