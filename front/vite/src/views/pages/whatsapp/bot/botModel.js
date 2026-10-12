// =============================================================================
// WhatsApp — Fluxo do Bot: modelo PURO (sem React).
// Formato salvo (reactflow JSON):
//   definition = { nodes:[{id,type,position:{x,y},data}], edges:[{id,source,sourceHandle,target,targetHandle?}] }
// Tipos: start | message | menu | question | condition | tags | wait | pix | handoff | end
// Saídas (sourceHandle): out | opt-<optionId> | invalid | true | false | paid | expired
// =============================================================================

export const uid = (p = 'n') => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export const NODE_TYPES = ['start', 'message', 'menu', 'question', 'condition', 'tags', 'wait', 'pix', 'handoff', 'end'];

// variáveis sempre disponíveis nos textos
export const BASE_VARS = [
  { key: 'nome', label: 'Nome' },
  { key: 'primeiro_nome', label: 'Primeiro nome' },
  { key: 'telefone', label: 'Telefone' }
];
export const PIX_VARS = [
  { key: 'pix_valor', label: 'Valor do PIX' },
  { key: 'pix_codigo', label: 'Código PIX' }
];
const RESERVED_VARS = new Set([...BASE_VARS, ...PIX_VARS].map((v) => v.key));

export const MSG_KINDS = ['text', 'image', 'video', 'audio', 'document'];

// ---------------------------------------------------------------------------
// Configurações (aba Configurações)
// ---------------------------------------------------------------------------
export const DAY_ORDER = ['1', '2', '3', '4', '5', '6', '0']; // seg → dom
export const DAY_LABEL = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado'
};
export const DAY_SHORT = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

const weekdays = (start, end) => ({
  0: [],
  1: [{ start, end }],
  2: [{ start, end }],
  3: [{ start, end }],
  4: [{ start, end }],
  5: [{ start, end }],
  6: []
});

export const DEFAULT_INVALID_TEXT = 'Não entendi 🤔 Responda com o número de uma das opções.';

export const DEFAULT_SETTINGS = {
  audience: { mode: 'test', test_chat_ids: [], tag_ids: [] },
  trigger: { mode: 'any', keywords: [] },
  restart_keywords: ['menu', '#inicio'],
  exclude_tag_ids: [],
  input_timeout_hours: 24,
  invalid_option_text: DEFAULT_INVALID_TEXT,
  max_retries: 3,
  typing: true,
  numbering: 'emoji',
  business_hours: {
    enabled: false,
    days: weekdays('08:00', '18:00'),
    outside_text:
      'Olá! 👋 Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Deixe sua mensagem que respondemos assim que possível.',
    outside_action: 'message_only'
  }
};

export const BH_PRESETS = [
  { id: 'comercial', label: 'Seg–Sex · 8h às 18h', days: weekdays('08:00', '18:00') },
  {
    id: 'sabado',
    label: 'Seg–Sex 8h–18h + Sáb 8h–12h',
    days: { ...weekdays('08:00', '18:00'), 6: [{ start: '08:00', end: '12:00' }] }
  },
  {
    id: 'almoco',
    label: 'Seg–Sex com pausa p/ almoço',
    days: {
      0: [],
      1: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '18:00' }
      ],
      2: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '18:00' }
      ],
      3: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '18:00' }
      ],
      4: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '18:00' }
      ],
      5: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '18:00' }
      ],
      6: []
    }
  },
  {
    id: '24h',
    label: 'Todos os dias · 24h',
    days: Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((k) => [k, [{ start: '00:00', end: '23:59' }]]))
  }
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isTime = (v) => TIME_RE.test(String(v || ''));

export const clampInt = (v, min, max, fb) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fb;
  return Math.min(max, Math.max(min, n));
};

export const strList = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x ?? '').trim()).filter(Boolean))] : []);

export const cleanKeyword = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 60);

export function normalizeSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_SETTINGS;
  const aud = r.audience && typeof r.audience === 'object' ? r.audience : {};
  const trig = r.trigger && typeof r.trigger === 'object' ? r.trigger : {};
  const bh = r.business_hours && typeof r.business_hours === 'object' ? r.business_hours : {};
  const hasDays = bh.days && typeof bh.days === 'object';
  const days = {};
  ['0', '1', '2', '3', '4', '5', '6'].forEach((k) => {
    const src = hasDays ? (Array.isArray(bh.days[k]) ? bh.days[k] : []) : d.business_hours.days[k];
    days[k] = src.filter((iv) => iv && isTime(iv.start) && isTime(iv.end)).map((iv) => ({ start: iv.start, end: iv.end }));
  });
  return {
    audience: {
      mode: ['all', 'test', 'tags'].includes(aud.mode) ? aud.mode : d.audience.mode,
      test_chat_ids: strList(aud.test_chat_ids),
      tag_ids: strList(aud.tag_ids)
    },
    trigger: {
      mode: trig.mode === 'keywords' ? 'keywords' : 'any',
      keywords: strList(trig.keywords).map(cleanKeyword).filter(Boolean)
    },
    restart_keywords: Array.isArray(r.restart_keywords) ? strList(r.restart_keywords).map(cleanKeyword) : [...d.restart_keywords],
    exclude_tag_ids: strList(r.exclude_tag_ids),
    input_timeout_hours: clampInt(r.input_timeout_hours, 1, 720, d.input_timeout_hours),
    invalid_option_text: typeof r.invalid_option_text === 'string' ? r.invalid_option_text : d.invalid_option_text,
    max_retries: clampInt(r.max_retries, 1, 10, d.max_retries),
    typing: typeof r.typing === 'boolean' ? r.typing : d.typing,
    numbering: r.numbering === 'number' ? 'number' : 'emoji',
    business_hours: {
      enabled: Boolean(bh.enabled),
      days,
      outside_text: typeof bh.outside_text === 'string' ? bh.outside_text : d.business_hours.outside_text,
      outside_action: ['message_and_continue', 'message_and_handoff', 'message_only'].includes(bh.outside_action)
        ? bh.outside_action
        : d.business_hours.outside_action
    }
  };
}

// ---------------------------------------------------------------------------
// Opções numeradas
// ---------------------------------------------------------------------------
const KEYCAP = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
export const MAX_MENU_OPTIONS = 10;

export const optionPrefix = (i, numbering) => {
  const n = i + 1;
  if (numbering === 'number') return `${n}.`;
  if (n === 10) return '🔟';
  return String(n)
    .split('')
    .map((c) => KEYCAP[Number(c)])
    .join('');
};

export const menuNumbering = (data, settings) => data?.numbering || settings?.numbering || 'emoji';

export function renderMenuText(data, settings) {
  const numbering = menuNumbering(data, settings);
  const opts = (data?.options || []).map((o, i) => `${optionPrefix(i, numbering)} ${o.label || `Opção ${i + 1}`}`);
  const head = String(data?.text || '').trim();
  return [head, opts.join('\n')].filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Pergunta / Condição
// ---------------------------------------------------------------------------
export const VALIDATE_OPTIONS = [
  { id: 'any', label: 'Qualquer resposta', hint: 'Aceita qualquer texto que o cliente mandar.', invalid: '' },
  { id: 'name', label: 'Nome', hint: 'Pelo menos duas letras.', invalid: 'Não entendi seu nome 🤔 Pode escrever de novo?' },
  {
    id: 'email',
    label: 'E-mail',
    hint: 'No formato nome@dominio.com.',
    invalid: 'Esse e-mail não parece válido 🤔 Pode conferir e mandar de novo?'
  },
  {
    id: 'phone',
    label: 'Telefone',
    hint: 'Com DDD (10 ou 11 dígitos).',
    invalid: 'Não reconheci o telefone. Mande com DDD, por exemplo: 11 99999-0000.'
  },
  { id: 'number', label: 'Número', hint: 'Só números (aceita vírgula).', invalid: 'Responda só com números, por favor.' },
  { id: 'cpf', label: 'CPF', hint: '11 dígitos válidos.', invalid: 'Esse CPF não parece válido. Pode conferir?' },
  { id: 'date', label: 'Data', hint: 'No formato dd/mm/aaaa.', invalid: 'Mande a data no formato dd/mm/aaaa, por favor.' }
];
export const validateMeta = (id) => VALIDATE_OPTIONS.find((v) => v.id === id) || VALIDATE_OPTIONS[0];

export const SAVE_TO_CONTACT = [
  { id: '', label: 'Não salvar no contato' },
  { id: 'name', label: 'Salvar como nome do contato' },
  { id: 'email', label: 'Salvar como e-mail do contato' }
];

// marcas de acento (U+0300–U+036F) — montado via fromCharCode (sem escape nu no fonte)
const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

export const sanitizeVarName = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_{2,}/g, '_')
    .slice(0, 32);

export const isReservedVar = (v) => RESERVED_VARS.has(v);

export const CONDITION_SOURCES = [
  { id: 'var', label: 'Variável (resposta salva)' },
  { id: 'last_input', label: 'Última mensagem do cliente' },
  { id: 'tag', label: 'Etiqueta do contato' },
  { id: 'business_hours', label: 'Horário de atendimento' },
  { id: 'contact_saved', label: 'Contato salvo na agenda' }
];

const TEXT_OPS = ['eq', 'neq', 'contains', 'not_contains', 'empty', 'not_empty', 'gt', 'lt'];
export const SOURCE_OPS = {
  var: TEXT_OPS,
  last_input: TEXT_OPS,
  tag: ['has', 'not_has'],
  business_hours: ['open', 'closed'],
  contact_saved: ['eq']
};
export const OP_LABEL = {
  eq: 'é igual a',
  neq: 'é diferente de',
  contains: 'contém',
  not_contains: 'não contém',
  empty: 'está vazia',
  not_empty: 'está preenchida',
  gt: 'é maior que',
  lt: 'é menor que',
  has: 'tem a etiqueta',
  not_has: 'não tem a etiqueta',
  open: 'dentro do horário',
  closed: 'fora do horário'
};
export const opNeedsValue = (op) => !['empty', 'not_empty', 'open', 'closed', 'has', 'not_has'].includes(op);

export const newRule = (source = 'last_input') => {
  const base = { id: uid('r'), source, op: SOURCE_OPS[source][0] };
  if (source === 'var') return { ...base, key: '', value: '' };
  if (source === 'last_input') return { ...base, op: 'contains', value: '' };
  if (source === 'tag') return { ...base, key: '' };
  if (source === 'contact_saved') return { ...base, value: 'true' };
  return base;
};

// ---------------------------------------------------------------------------
// Dados de cada tipo de bloco
// ---------------------------------------------------------------------------
export const newMessage = (kind = 'text') => ({ id: uid('m'), kind, text: '', media: null, delay_seconds: 1 });
export const newOption = (label = '') => ({ id: uid('o'), label, keywords: [] });

export const DEFAULT_PIX_TEXT =
  'Perfeito! Para concluir, faça o PIX de *{{pix_valor}}* 👇\n\nCopie o código abaixo e cole no app do seu banco:';
export const DEFAULT_PAID_TEXT = 'Pagamento confirmado! ✅ Muito obrigado, {{primeiro_nome}}.';
export const DEFAULT_EXPIRED_TEXT = 'O PIX expirou ⌛ Se ainda quiser, é só mandar uma mensagem que eu gero outro.';

export const WAIT_UNITS = [
  { id: 'seconds', label: 'segundos', one: 'segundo', max: 3600 },
  { id: 'minutes', label: 'minutos', one: 'minuto', max: 1440 },
  { id: 'hours', label: 'horas', one: 'hora', max: 168 }
];
export const waitLabel = (amount, unit) => {
  const u = WAIT_UNITS.find((x) => x.id === unit) || WAIT_UNITS[1];
  const n = Number(amount) || 0;
  return `${n} ${n === 1 ? u.one : u.label}`;
};

export const fmtBRL = (cents) =>
  ((Number(cents) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

export const fmtMinutes = (m) => {
  const n = Number(m) || 0;
  if (n >= 1440 && n % 1440 === 0) return `${n / 1440} ${n === 1440 ? 'dia' : 'dias'}`;
  if (n >= 60 && n % 60 === 0) return `${n / 60} h`;
  if (n >= 60) return `${Math.floor(n / 60)} h ${n % 60} min`;
  return `${n} min`;
};

const uniqueVar = (base, nodes) => {
  const used = new Set((nodes || []).filter((n) => n.type === 'question').map((n) => n.data?.var));
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
};

export function createNodeData(type, { settings, nodes } = {}) {
  switch (type) {
    case 'message':
      return { title: 'Mensagem', messages: [newMessage('text')] };
    case 'menu':
      return {
        title: 'Menu',
        text: 'Como posso te ajudar? Responda com o número da opção:',
        options: [newOption('Opção 1'), newOption('Opção 2')],
        numbering: settings?.numbering || 'emoji'
      };
    case 'question':
      return {
        title: 'Pergunta',
        text: 'Qual é o seu e-mail?',
        var: uniqueVar('email', nodes),
        validate: 'email',
        save_to_contact: null
      };
    case 'condition':
      return { title: 'Condição', match: 'all', rules: [newRule('last_input')] };
    case 'tags':
      return { title: 'Etiquetas', add: [], remove: [] };
    case 'wait':
      return { title: 'Espera', amount: 5, unit: 'minutes' };
    case 'pix':
      return {
        title: 'Cobrança PIX',
        amount_cents: 0,
        description: '',
        text: DEFAULT_PIX_TEXT,
        send_qr: true,
        expires_minutes: 30,
        paid_text: DEFAULT_PAID_TEXT,
        expired_text: DEFAULT_EXPIRED_TEXT
      };
    case 'handoff':
      return {
        title: 'Atendente',
        text: 'Certo! Já vou te passar para um de nossos atendentes. Só um instante 🙂',
        assign_user_id: null
      };
    case 'end':
      return { title: 'Encerrar', text: 'Obrigado pelo contato! Quando precisar, é só chamar. 👋', close: true };
    default:
      return {};
  }
}

const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));

// completa campos faltando sem mexer no que existe (dados antigos/parciais)
export function normalizeNodeData(type, raw) {
  const d = raw && typeof raw === 'object' ? { ...raw } : {};
  if (type === 'start') return {};
  const def = createNodeData(type);
  if (typeof d.title !== 'string') d.title = def.title;
  if (type === 'message') {
    const list = Array.isArray(d.messages) && d.messages.length ? d.messages : [newMessage('text')];
    d.messages = list.map((m) => ({
      id: m?.id ? String(m.id) : uid('m'),
      kind: MSG_KINDS.includes(m?.kind) ? m.kind : 'text',
      text: str(m?.text),
      media: m?.media && typeof m.media === 'object' ? m.media : null,
      delay_seconds: clampInt(m?.delay_seconds, 0, 30, 0)
    }));
  } else if (type === 'menu') {
    d.text = str(d.text);
    d.options = (Array.isArray(d.options) ? d.options : []).map((o) => ({
      id: o?.id ? String(o.id) : uid('o'),
      label: str(o?.label),
      keywords: strList(o?.keywords)
    }));
    if (d.numbering !== 'number' && d.numbering !== 'emoji') delete d.numbering;
  } else if (type === 'question') {
    d.text = str(d.text);
    d.var = sanitizeVarName(d.var);
    if (!VALIDATE_OPTIONS.some((v) => v.id === d.validate)) d.validate = 'any';
    if (d.save_to_contact !== 'name' && d.save_to_contact !== 'email') d.save_to_contact = null;
  } else if (type === 'condition') {
    d.match = d.match === 'any' ? 'any' : 'all';
    d.rules = (Array.isArray(d.rules) ? d.rules : []).map((r) => {
      const source = CONDITION_SOURCES.some((s) => s.id === r?.source) ? r.source : 'last_input';
      const ops = SOURCE_OPS[source];
      return { ...r, id: r?.id ? String(r.id) : uid('r'), source, op: ops.includes(r?.op) ? r.op : ops[0] };
    });
  } else if (type === 'tags') {
    d.add = strList(d.add);
    d.remove = strList(d.remove);
  } else if (type === 'wait') {
    d.amount = clampInt(d.amount, 0, 100000, 5);
    if (!WAIT_UNITS.some((u) => u.id === d.unit)) d.unit = 'minutes';
  } else if (type === 'pix') {
    d.amount_cents = clampInt(d.amount_cents, 0, 999999999, 0);
    d.description = str(d.description);
    d.text = typeof d.text === 'string' ? d.text : def.text;
    d.send_qr = d.send_qr !== false;
    d.expires_minutes = clampInt(d.expires_minutes, 5, 1440, 30);
    d.paid_text = typeof d.paid_text === 'string' ? d.paid_text : def.paid_text;
    d.expired_text = typeof d.expired_text === 'string' ? d.expired_text : def.expired_text;
  } else if (type === 'handoff') {
    d.text = str(d.text);
    d.assign_user_id = d.assign_user_id ? String(d.assign_user_id) : null;
  } else if (type === 'end') {
    d.text = str(d.text);
    d.close = d.close !== false;
  }
  return d;
}

// clona com ids novos (evita colisão de handles)
export function cloneNodeData(type, data) {
  const d = JSON.parse(JSON.stringify(data || {}));
  d.title = `${d.title || 'Bloco'} (cópia)`;
  if (type === 'message') d.messages = (d.messages || []).map((m) => ({ ...m, id: uid('m') }));
  if (type === 'menu') d.options = (d.options || []).map((o) => ({ ...o, id: uid('o') }));
  if (type === 'condition') d.rules = (d.rules || []).map((r) => ({ ...r, id: uid('r') }));
  return d;
}

// ---------------------------------------------------------------------------
// Saídas de cada bloco (handles de origem)
// ---------------------------------------------------------------------------
export function outputsOf(type, data, settings) {
  switch (type) {
    case 'start':
      return [{ id: 'out', label: '' }];
    case 'message':
    case 'tags':
    case 'wait':
      return [{ id: 'out', label: 'Depois', tone: 'neutral' }];
    case 'menu': {
      const numbering = menuNumbering(data, settings);
      const tries = data?.max_retries || settings?.max_retries || 3;
      return [
        ...(data?.options || []).map((o, i) => ({
          id: `opt-${o.id}`,
          label: `${optionPrefix(i, numbering)} ${o.label || `Opção ${i + 1}`}`,
          tone: 'neutral'
        })),
        { id: 'invalid', label: `Não entendeu (após ${tries} ${tries === 1 ? 'tentativa' : 'tentativas'})`, tone: 'bad' }
      ];
    }
    case 'question':
      return [
        { id: 'out', label: 'Respondeu certo', tone: 'good' },
        { id: 'invalid', label: 'Resposta inválida', tone: 'bad' }
      ];
    case 'condition':
      return [
        { id: 'true', label: 'Sim', tone: 'good' },
        { id: 'false', label: 'Não', tone: 'bad' }
      ];
    case 'pix':
      return [
        { id: 'paid', label: 'Pago', tone: 'good' },
        { id: 'expired', label: 'Expirou sem pagar', tone: 'bad' }
      ];
    default:
      return [];
  }
}

export const toneOfHandle = (h) => {
  if (h === 'invalid' || h === 'false' || h === 'expired') return 'bad';
  if (h === 'true' || h === 'paid') return 'good';
  return 'neutral';
};

// ---------------------------------------------------------------------------
// Fluxo padrão (nunca salvo): início → boas-vindas → menu (2) → atendente / encerrar
// ---------------------------------------------------------------------------
export function buildDefaultFlow(settings) {
  const welcome = uid('message');
  const menu = uid('menu');
  const handoff = uid('handoff');
  const end = uid('end');
  const o1 = newOption('Falar com um atendente');
  o1.keywords = ['atendente', 'humano', 'pessoa'];
  const o2 = newOption('Só estava dando uma olhada');
  o2.keywords = ['nada', 'sair', 'tchau'];
  const nodes = [
    { id: 'start', type: 'start', position: { x: 0, y: 176 }, data: {}, deletable: false },
    {
      id: welcome,
      type: 'message',
      position: { x: 272, y: 128 },
      data: {
        title: 'Boas-vindas',
        messages: [
          { ...newMessage('text'), text: 'Olá, {{primeiro_nome}}! 👋 Seja bem-vindo(a).', delay_seconds: 1 },
          { ...newMessage('text'), text: 'Eu sou o assistente virtual e vou te ajudar por aqui.', delay_seconds: 2 }
        ]
      }
    },
    {
      id: menu,
      type: 'menu',
      position: { x: 640, y: 96 },
      data: {
        title: 'Menu principal',
        text: 'Como posso te ajudar hoje?',
        options: [o1, o2],
        numbering: settings?.numbering || 'emoji'
      }
    },
    {
      id: handoff,
      type: 'handoff',
      position: { x: 1024, y: 0 },
      data: createNodeData('handoff')
    },
    {
      id: end,
      type: 'end',
      position: { x: 1024, y: 304 },
      data: { title: 'Encerrar', text: 'Tudo bem! Quando precisar, é só mandar uma mensagem. Até mais! 👋', close: true }
    }
  ];
  const edges = [
    { id: uid('e'), source: 'start', sourceHandle: 'out', target: welcome, targetHandle: 'in' },
    { id: uid('e'), source: welcome, sourceHandle: 'out', target: menu, targetHandle: 'in' },
    { id: uid('e'), source: menu, sourceHandle: `opt-${o1.id}`, target: handoff, targetHandle: 'in' },
    { id: uid('e'), source: menu, sourceHandle: `opt-${o2.id}`, target: end, targetHandle: 'in' },
    { id: uid('e'), source: menu, sourceHandle: 'invalid', target: handoff, targetHandle: 'in' }
  ];
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Serialização
// ---------------------------------------------------------------------------
const stripUndefined = (obj) => JSON.parse(JSON.stringify(obj ?? {}));

export function cleanDefinition(nodes, edges) {
  const byId = new Map((nodes || []).map((n) => [n.id, n]));
  return {
    nodes: (nodes || []).map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: Math.round(Number(n.position?.x) || 0), y: Math.round(Number(n.position?.y) || 0) },
      data: n.type === 'start' ? {} : stripUndefined(n.data)
    })),
    edges: (edges || [])
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle || 'out',
        target: e.target,
        ...(e.targetHandle ? { targetHandle: e.targetHandle } : {})
      }))
  };
}

export function hydrateDefinition(def) {
  const raw = Array.isArray(def?.nodes) ? def.nodes : [];
  let nodes = raw
    .filter((n) => n && n.id && NODE_TYPES.includes(n.type))
    .map((n) => ({
      id: String(n.id),
      type: n.type,
      position: { x: Number(n.position?.x) || 0, y: Number(n.position?.y) || 0 },
      data: normalizeNodeData(n.type, n.data),
      deletable: n.type !== 'start'
    }));
  const starts = nodes.filter((n) => n.type === 'start');
  if (starts.length > 1) nodes = nodes.filter((n) => n.type !== 'start' || n.id === starts[0].id);
  if (!starts.length) {
    const minX = nodes.length ? Math.min(...nodes.map((n) => n.position.x)) : 0;
    const minY = nodes.length ? Math.min(...nodes.map((n) => n.position.y)) : 0;
    nodes = [{ id: 'start', type: 'start', position: { x: minX - 300, y: minY }, data: {}, deletable: false }, ...nodes];
  }
  const ids = new Set(nodes.map((n) => n.id));
  const seen = new Set();
  const edges = (Array.isArray(def?.edges) ? def.edges : [])
    .filter((e) => e && ids.has(String(e.source)) && ids.has(String(e.target)))
    .map((e) => ({
      id: e.id ? String(e.id) : uid('e'),
      source: String(e.source),
      sourceHandle: e.sourceHandle || 'out',
      target: String(e.target),
      targetHandle: e.targetHandle || 'in'
    }))
    // uma conexão por saída
    .filter((e) => {
      const k = `${e.source}::${e.sourceHandle}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return { nodes, edges };
}

export const payloadSig = (nodes, edges, settings, name) => {
  try {
    return JSON.stringify({ d: cleanDefinition(nodes, edges), s: settings, n: name || '' });
  } catch {
    return String(Math.random());
  }
};

// ---------------------------------------------------------------------------
// Variáveis
// ---------------------------------------------------------------------------
const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;
export const extractVars = (text) => {
  const out = [];
  String(text || '').replace(VAR_RE, (_, k) => {
    out.push(k);
    return '';
  });
  return out;
};

export const questionVars = (nodes) =>
  [
    ...new Set(
      (nodes || [])
        .filter((n) => n.type === 'question' && n.data?.var)
        .map((n) => n.data.var)
        .filter(Boolean)
    )
  ].sort();

export function nodeTexts(type, data) {
  switch (type) {
    case 'message':
      return (data?.messages || []).map((m) => m.text);
    case 'menu':
      return [data?.text, data?.invalid_text];
    case 'question':
      return [data?.text, data?.invalid_text];
    case 'pix':
      return [data?.text, data?.paid_text, data?.expired_text, data?.description];
    case 'handoff':
    case 'end':
      return [data?.text];
    default:
      return [];
  }
}

const isBlank = (v) => !String(v || '').trim();

// ---------------------------------------------------------------------------
// Validação (avisos no nó + lista geral). level: 'error' | 'warning'
// ---------------------------------------------------------------------------
export function validateFlow(nodes, edges, ctx = {}) {
  const { settings, tags, attendants, gateway } = ctx;
  const issues = [];
  const add = (nodeId, level, text) => issues.push({ id: `${nodeId || 'cfg'}-${issues.length}`, nodeId, level, text });

  const out = new Map(); // nodeId -> Set(sourceHandle)
  const incoming = new Map();
  (edges || []).forEach((e) => {
    if (!out.has(e.source)) out.set(e.source, new Set());
    out.get(e.source).add(e.sourceHandle || 'out');
    incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
  });
  const connected = (id, h) => Boolean(out.get(id)?.has(h));

  // alcançáveis a partir do início
  const reach = new Set();
  const start = (nodes || []).find((n) => n.type === 'start');
  if (start) {
    const stack = [start.id];
    while (stack.length) {
      const id = stack.pop();
      if (reach.has(id)) continue;
      reach.add(id);
      (edges || []).forEach((e) => {
        if (e.source === id && !reach.has(e.target)) stack.push(e.target);
      });
    }
  }

  const tagIds = tags ? new Set(tags.map((t) => t.id)) : null;
  const attIds = attendants ? new Set(attendants.map((a) => a.id)) : null;
  const known = new Set([...BASE_VARS.map((v) => v.key), ...PIX_VARS.map((v) => v.key), ...questionVars(nodes)]);

  (nodes || []).forEach((n) => {
    const d = n.data || {};
    if (n.type === 'start') {
      if (!connected(n.id, 'out')) add(n.id, 'error', 'O início não está ligado a nenhum bloco — o bot não teria o que responder.');
      return;
    }
    if (!reach.has(n.id)) add(n.id, 'warning', 'Nenhum caminho do fluxo chega até este bloco.');

    // variáveis desconhecidas
    const unknown = new Set();
    nodeTexts(n.type, d).forEach((t) =>
      extractVars(t).forEach((k) => {
        if (!known.has(k)) unknown.add(k);
      })
    );
    unknown.forEach((k) =>
      add(n.id, 'warning', `A variável {{${k}}} não existe. Crie uma Pergunta que salve em "${k}" ou corrija o nome.`)
    );

    switch (n.type) {
      case 'message': {
        const msgs = d.messages || [];
        if (!msgs.length) add(n.id, 'error', 'Adicione pelo menos uma mensagem.');
        msgs.forEach((m, i) => {
          const label = msgs.length > 1 ? `Mensagem ${i + 1}` : 'A mensagem';
          if (m.kind === 'text' && isBlank(m.text)) add(n.id, 'error', `${label} está vazia.`);
          if (m.kind !== 'text' && !m.media?.url && !m.media?.id) add(n.id, 'error', `${label} está sem arquivo.`);
        });
        break;
      }
      case 'menu': {
        const opts = d.options || [];
        if (isBlank(d.text)) add(n.id, 'warning', 'Escreva o texto que aparece acima das opções.');
        if (opts.length < 1) add(n.id, 'error', 'Adicione pelo menos uma opção.');
        const seenKw = new Map();
        opts.forEach((o, i) => {
          if (isBlank(o.label)) add(n.id, 'error', `A opção ${i + 1} está sem texto.`);
          else if (!connected(n.id, `opt-${o.id}`)) add(n.id, 'warning', `A opção "${o.label}" não está ligada a nenhum bloco.`);
          (o.keywords || []).forEach((k) => {
            if (seenKw.has(k) && seenKw.get(k) !== o.id) add(n.id, 'warning', `A palavra-chave "${k}" aparece em mais de uma opção.`);
            seenKw.set(k, o.id);
          });
        });
        break;
      }
      case 'question':
        if (isBlank(d.text)) add(n.id, 'error', 'Escreva a pergunta.');
        if (!d.var) add(n.id, 'error', 'Dê um nome para a variável onde a resposta será salva.');
        else if (isReservedVar(d.var)) add(n.id, 'error', `"${d.var}" é uma variável do sistema. Use outro nome.`);
        if (!connected(n.id, 'out')) add(n.id, 'warning', 'A saída "Respondeu certo" não está ligada — o bot para depois da resposta.');
        break;
      case 'condition': {
        const rules = d.rules || [];
        if (!rules.length) add(n.id, 'error', 'Adicione pelo menos uma regra.');
        rules.forEach((r, i) => {
          const label = `Regra ${i + 1}`;
          if (r.source === 'var' && isBlank(r.key)) add(n.id, 'error', `${label}: escolha a variável.`);
          if (r.source === 'tag') {
            if (!r.key) add(n.id, 'error', `${label}: escolha a etiqueta.`);
            else if (tagIds && !tagIds.has(r.key)) add(n.id, 'warning', `${label}: a etiqueta escolhida não existe mais.`);
          }
          if ((r.source === 'var' || r.source === 'last_input') && opNeedsValue(r.op) && isBlank(r.value))
            add(n.id, 'error', `${label}: preencha o valor a comparar.`);
          if (r.source === 'business_hours' && settings && !settings.business_hours?.enabled)
            add(n.id, 'warning', `${label}: o horário de atendimento está desligado nas Configurações.`);
        });
        if (!connected(n.id, 'true') && !connected(n.id, 'false')) add(n.id, 'warning', 'Ligue pelo menos uma das saídas (Sim / Não).');
        break;
      }
      case 'tags': {
        const all = [...(d.add || []), ...(d.remove || [])];
        if (!all.length) add(n.id, 'warning', 'Escolha etiquetas para adicionar ou remover.');
        if (tagIds && all.some((id) => !tagIds.has(id))) add(n.id, 'warning', 'Uma das etiquetas escolhidas não existe mais.');
        break;
      }
      case 'wait': {
        const u = WAIT_UNITS.find((x) => x.id === d.unit) || WAIT_UNITS[1];
        if (!(Number(d.amount) > 0)) add(n.id, 'error', 'Defina quanto tempo esperar.');
        else if (Number(d.amount) > u.max) add(n.id, 'error', `O máximo é ${u.max} ${u.label}.`);
        if (!connected(n.id, 'out')) add(n.id, 'warning', 'Nada acontece depois da espera — ligue a saída a um bloco.');
        break;
      }
      case 'pix':
        if (!(Number(d.amount_cents) > 0)) add(n.id, 'error', 'Defina o valor da cobrança.');
        if (isBlank(d.description)) add(n.id, 'warning', 'Dê um nome ao produto/serviço (aparece na cobrança).');
        if (gateway && gateway.ready === false) add(n.id, 'warning', 'O gateway PIX não está configurado (Configurações → Pagamentos).');
        if (!connected(n.id, 'paid')) add(n.id, 'warning', 'A saída "Pago" não está ligada — o que acontece depois do pagamento?');
        break;
      case 'handoff':
        if (d.assign_user_id && attIds && !attIds.has(d.assign_user_id))
          add(n.id, 'warning', 'O atendente escolhido não existe mais — a conversa irá para a fila.');
        break;
      default:
        break;
    }
  });

  // configurações
  if (settings) {
    if (settings.audience?.mode === 'test' && !settings.audience.test_chat_ids?.length)
      add(null, 'warning', 'Modo teste sem contatos de teste: o bot não vai responder ninguém.');
    if (settings.audience?.mode === 'tags' && !settings.audience.tag_ids?.length)
      add(null, 'warning', 'Público "só com etiquetas" sem etiquetas escolhidas: o bot não vai responder ninguém.');
    if (settings.trigger?.mode === 'keywords' && !settings.trigger.keywords?.length)
      add(null, 'error', 'O início "só com palavras-chave" está sem palavras-chave.');
    if (settings.business_hours?.enabled) {
      const open = Object.values(settings.business_hours.days || {}).some((l) => (l || []).length);
      if (!open) add(null, 'warning', 'O horário de atendimento está ligado, mas nenhum dia tem horário definido.');
      const bad = Object.values(settings.business_hours.days || {}).some((l) => (l || []).some((iv) => iv.start >= iv.end));
      if (bad) add(null, 'error', 'Há um intervalo de horário em que o início é depois do fim.');
    }
  }
  return issues;
}

// id do bloco atual no estado do simulador (formato do servidor pode variar)
export const simNodeOf = (state) => {
  if (!state || typeof state !== 'object') return null;
  return state.node_id || state.current_node_id || state.nodeId || state.node || null;
};
