// =============================================================================
// WhatsApp — Fluxo do Bot: modelo PURO (sem React).
// Formato salvo (reactflow JSON):
//   definition = { nodes:[{id,type,position:{x,y},data}], edges:[{id,source,sourceHandle,target,targetHandle?}] }
// Tipos: start | message | menu | question | condition | tags | wait | pix | handoff | end
//        + blocos de CRM (assinaturas, Fase 2 — contrato em docs/whatsapp-assinaturas-contrato.md §1):
//        crm_identify | crm_register | crm_subscribe | crm_info | crm_invoice | crm_cancel | crm_pause | crm_change_plan | crm_update
//        + blocos de agenda (Fase 6 — contrato §9.4): book_service | my_appointments | waitlist_join
//        + blocos de chamados (Fase 6B — contrato §10.5): open_ticket | my_tickets
//        + blocos de pedidos (Fase 7 — contrato §11.3): order_cart | my_orders
// Saídas (sourceHandle): out | opt-<optionId> | invalid | true | false | paid | expired | found | not_found | done | cancel |
//        subscribed | declined | no_customer | failed | sent | nothing_open | canceled | kept | no_subscription | paused | changed
// =============================================================================

export const uid = (p = 'n') => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export const CRM_TYPES = [
  'crm_identify',
  'crm_register',
  'crm_subscribe',
  'crm_info',
  'crm_invoice',
  'crm_cancel',
  'crm_pause',
  'crm_change_plan',
  'crm_update'
];
export const BOOK_TYPES = ['book_service', 'my_appointments', 'waitlist_join'];
export const TICKET_TYPES = ['open_ticket', 'my_tickets'];
export const ORDER_TYPES = ['order_cart', 'my_orders'];
export const NODE_TYPES = [
  'start',
  'message',
  'menu',
  'question',
  'condition',
  'tags',
  'wait',
  'pix',
  'handoff',
  'end',
  ...CRM_TYPES,
  ...BOOK_TYPES,
  ...TICKET_TYPES,
  ...ORDER_TYPES
];
export const isCrmType = (t) => CRM_TYPES.includes(t);
export const isBookType = (t) => BOOK_TYPES.includes(t);
export const isTicketType = (t) => TICKET_TYPES.includes(t);
export const isOrderType = (t) => ORDER_TYPES.includes(t);

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
// variáveis do CRM (preenchidas pelo motor a partir do cliente identificado / assinatura / cobrança / produto em foco)
export const CRM_CUSTOMER_VARS = [
  { key: 'cliente.nome', label: 'Nome do cliente' },
  { key: 'cliente.primeiro_nome', label: 'Primeiro nome do cliente' },
  { key: 'cliente.documento', label: 'Documento (mascarado)' },
  { key: 'cliente.codigo', label: 'Código do cliente' },
  { key: 'cliente.email', label: 'E-mail do cliente' },
  { key: 'cliente.status', label: 'Situação (em dia / em atraso…)' },
  { key: 'cliente.produto', label: 'Plano atual' },
  { key: 'cliente.produtos', label: 'Todos os planos' },
  { key: 'cliente.valor', label: 'Valor do plano' },
  { key: 'cliente.vencimento', label: 'Próximo vencimento' },
  { key: 'cliente.dia_vencimento', label: 'Dia do vencimento' }
];
export const CRM_SUBSCRIPTION_VARS = [
  { key: 'assinatura.produto', label: 'Produto da assinatura' },
  { key: 'assinatura.valor', label: 'Valor da assinatura' },
  { key: 'assinatura.vencimento', label: 'Vencimento da assinatura' },
  { key: 'assinatura.status', label: 'Status da assinatura' },
  { key: 'assinatura.fim', label: 'Data de fim (cancelamento)' },
  { key: 'assinatura.fim_texto', label: '"Seu acesso continua até…"' },
  { key: 'assinatura.pausa_ate', label: 'Pausada até' },
  { key: 'assinaturas.lista', label: 'Lista de assinaturas' }
];
export const CRM_CHARGE_VARS = [
  { key: 'cobranca.valor', label: 'Valor da cobrança' },
  { key: 'cobranca.vencimento', label: 'Vencimento da cobrança' },
  { key: 'cobranca.descricao', label: 'Descrição da cobrança' },
  { key: 'cobranca.dias_atraso', label: 'Dias em atraso' },
  { key: 'cobranca.pix', label: 'Código PIX da cobrança' },
  { key: 'cobranca.boleto_link', label: 'Link do boleto' },
  { key: 'cobrancas.lista', label: 'Lista de cobranças em aberto' }
];
export const CRM_PRODUCT_VARS = [
  { key: 'produto.nome', label: 'Nome do produto' },
  { key: 'produto.valor', label: 'Valor do produto' },
  { key: 'produto.periodo', label: '" por mês" / " por ano"' }
];
export const CRM_VARS = [...CRM_CUSTOMER_VARS, ...CRM_SUBSCRIPTION_VARS, ...CRM_CHARGE_VARS, ...CRM_PRODUCT_VARS];
// variáveis da agenda (Fase 6): horário escolhido no bloco "Agendar" › agendamento em foco › próximo do contato
export const BOOK_VARS = [
  { key: 'agendamento.servico', label: 'Serviço agendado' },
  { key: 'agendamento.profissional', label: 'Profissional / recurso' },
  { key: 'agendamento.data', label: 'Data ("qua 15/10")' },
  { key: 'agendamento.hora', label: 'Hora ("14:30")' },
  { key: 'agendamento.valor', label: 'Valor do serviço' },
  { key: 'agendamento.duracao', label: 'Duração' },
  { key: 'agendamento.endereco', label: 'Endereço' },
  { key: 'agendamento.pagamento', label: '"pagamento no local" / "por PIX"…' },
  { key: 'agendamento.situacao', label: 'Situação do agendamento' },
  { key: 'agendamento.prazo_cancelamento', label: 'Prazo para cancelar sem custo' },
  { key: 'agendamento.link_pagamento', label: 'Link de pagamento' },
  { key: 'agendamento.data_anterior', label: 'Data anterior (remarcação)' },
  { key: 'agendamento.hora_anterior', label: 'Hora anterior (remarcação)' },
  { key: 'agendamentos.lista', label: 'Lista dos próximos agendamentos' },
  { key: 'servico', label: 'Serviço escolhido (variável)' }
];
// variáveis dos chamados (Fase 6B): chamado criado / escolhido no bloco › o mais recente em andamento do contato
export const TICKET_VARS = [
  { key: 'chamado.protocolo', label: 'Protocolo' },
  { key: 'chamado.categoria', label: 'Categoria' },
  { key: 'chamado.status', label: 'Situação ("Aberto", "Aguardando você"…)' },
  { key: 'chamado.prazo', label: 'Prazo ("15/10 às 14:30")' },
  { key: 'chamado.prazo_relativo', label: 'Prazo ("em 2 h")' },
  { key: 'chamado.assunto', label: 'Assunto' },
  { key: 'chamado.prioridade', label: 'Prioridade' },
  { key: 'chamado.ultima_atualizacao', label: 'Última atualização da equipe' },
  { key: 'chamado.anexos', label: 'Quantos arquivos o cliente mandou' },
  { key: 'chamados.lista', label: 'Lista dos chamados em andamento' },
  { key: 'chamado.campos', label: 'Campos do chamado visíveis ao cliente' }
];
// variáveis dos pedidos (Fase 7): pedido criado/escolhido no bloco › carrinho em montagem › o mais recente em andamento
export const ORDER_VARS = [
  { key: 'pedido.numero', label: 'Número do pedido' },
  { key: 'pedido.itens', label: 'Itens do pedido (um por linha)' },
  { key: 'pedido.subtotal', label: 'Subtotal' },
  { key: 'pedido.taxa', label: 'Taxa de entrega ("grátis")' },
  { key: 'pedido.total', label: 'Total' },
  { key: 'pedido.status', label: 'Situação ("Em preparo"…)' },
  { key: 'pedido.entrega', label: 'Entrega ou retirada (com endereço)' },
  { key: 'pedido.endereco', label: 'Endereço de entrega' },
  { key: 'pedido.pagamento', label: 'Forma de pagamento' },
  { key: 'pedido.pagamento_status', label: 'Situação do pagamento' },
  { key: 'pedido.data', label: 'Data do pedido' },
  { key: 'pedido.categoria', label: 'Categoria escolhida' },
  { key: 'pedido.minimo', label: 'Pedido mínimo' },
  { key: 'pedido.max_itens', label: 'Máximo de produtos diferentes' },
  { key: 'pedido.campos', label: 'Campos do pedido (resumo)' },
  { key: 'carrinho.itens', label: 'Itens do carrinho' },
  { key: 'carrinho.subtotal', label: 'Subtotal do carrinho' },
  { key: 'carrinho.qtd', label: 'Quantidade de unidades no carrinho' },
  { key: 'item.nome', label: 'Produto escolhido' },
  { key: 'item.valor', label: 'Preço do produto escolhido' },
  { key: 'item.descricao', label: 'Descrição do produto escolhido' },
  { key: 'item.qtd', label: 'Quantidade escolhida' },
  { key: 'pedidos.lista', label: 'Lista dos pedidos em andamento' },
  { key: 'pedido_numero', label: 'Número do pedido (variável)' }
];
// variáveis que o motor preenche sem o usuário criar (prefixos aceitos + nomes avulsos)
const CRM_VAR_PREFIXES = [
  'cliente.',
  'assinatura.',
  'assinaturas.',
  'cobranca.',
  'cobrancas.',
  'produto.',
  'agendamento.',
  'agendamentos.',
  'chamado.',
  'chamados.',
  'pedido.',
  'pedidos.',
  'carrinho.',
  'item.'
];
const ENGINE_VARS = new Set([
  'resumo',
  'max_dias',
  'opcao',
  'produto',
  'produto_id',
  'comando_reiniciar',
  'servico',
  'servico_id',
  'profissional_id',
  'protocolo',
  'pedido_numero'
]);
const CUSTOMER_VAR_KEYS = new Set([...CRM_CUSTOMER_VARS.map((v) => v.key), 'cliente.campos', 'cliente.unidade', 'cliente.codigo_externo']);
const hasCustomKey = (list, k) => (list || []).some((f) => String(f?.key || '').toLowerCase() === String(k || '').toLowerCase());
/**
 * A variável é preenchida pelo motor? `cliente.<x>` precisa ser um campo fixo OU um campo personalizado da
 * organização (`customFields` = lista de Configurações → Clientes; null = ainda não carregada → aceita).
 * Devolve true (conhecida), false (desconhecida) ou 'custom-missing' (cliente.<x> que não é campo da org — renderiza vazio).
 */
export const isKnownCrmVar = (k, customFields = null, customFieldMap = null) => {
  const key = String(k || '');
  if (ENGINE_VARS.has(key)) return true;
  if (key.startsWith('cliente.')) {
    if (CUSTOMER_VAR_KEYS.has(key)) return true;
    if (!customFields) return true;
    // {{cliente.custom.x}} (Fase 7) e o antigo {{cliente.x}}
    const ck = key.startsWith('cliente.custom.') ? key.slice(15) : key.slice(8);
    return hasCustomKey(customFields, ck) ? true : 'custom-missing';
  }
  // {{chamado.custom.x}} / {{pedido.custom.x}}: campo personalizado da entidade (mapa carregado → confere)
  const m = /^(chamado|pedido|assinatura|produto)\.custom\.(.+)$/.exec(key);
  if (m && customFieldMap) {
    const entity = { chamado: 'ticket', pedido: 'order', assinatura: 'subscription', produto: 'product' }[m[1]];
    return hasCustomKey(customFieldMap[entity], m[2]) ? true : 'custom-missing';
  }
  return CRM_VAR_PREFIXES.some((p) => key.startsWith(p));
};
// nomes que uma Pergunta NÃO pode usar para salvar a resposta (o motor grava/lê neles)
const RESERVED_VARS = new Set(
  [...BASE_VARS, ...PIX_VARS]
    .map((v) => v.key)
    .concat([
      'produto_id',
      'produto',
      'opcao',
      'cliente',
      'servico',
      'servico_id',
      'profissional_id',
      'agendamento',
      'chamado',
      'protocolo',
      'pedido',
      'pedido_numero',
      'carrinho',
      'item'
    ])
);

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
// menu de produtos: produto escolhido sem saída ligada (e sem "Não entendeu") → o motor avisa e repete o menu
export const DEFAULT_UNAVAILABLE_TEXT = 'Essa opção não está disponível no momento 😕 Escolha outra:';

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
  { id: 'cnpj', label: 'CNPJ', hint: '14 dígitos válidos.', invalid: 'Esse CNPJ não parece válido. Pode conferir?' },
  {
    id: 'doc',
    label: 'CPF ou CNPJ',
    hint: 'Aceita os dois, com dígito verificador válido.',
    invalid: 'Esse CPF/CNPJ não parece válido. Pode conferir e mandar de novo, só números?'
  },
  { id: 'cep', label: 'CEP', hint: '8 números.', invalid: 'Mande o CEP com 8 números, por favor (ex.: 01310100).' },
  { id: 'uf', label: 'Estado (UF)', hint: 'Sigla com 2 letras.', invalid: 'Mande a sigla do estado com 2 letras (ex.: SP).' },
  { id: 'code', label: 'Código', hint: 'Até 32 caracteres.', invalid: 'Não reconheci esse código. Pode conferir?' },
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

/** Igual ao `norm` do motor: sem acento, minúsculas, só letras/números/espaço/# (compara nomes de categoria). */
export const normText = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const CONDITION_SOURCES = [
  { id: 'var', label: 'Variável (resposta salva)' },
  { id: 'last_input', label: 'Última mensagem do cliente' },
  { id: 'tag', label: 'Etiqueta do contato' },
  { id: 'business_hours', label: 'Horário de atendimento' },
  { id: 'contact_saved', label: 'Contato salvo na agenda' },
  { id: 'customer', label: 'Cliente (cadastro / assinatura)' },
  { id: 'appointment', label: 'Agendamento (agenda)' },
  { id: 'ticket', label: 'Chamado (protocolo)' },
  { id: 'order', label: 'Pedido' }
];

const TEXT_OPS = ['eq', 'neq', 'contains', 'not_contains', 'empty', 'not_empty', 'gt', 'lt'];
const CUSTOM_OPS = ['eq', 'neq', 'contains', 'not_contains', 'empty', 'not_empty'];
// chaves da regra "Cliente" (fonte customer) — ops por chave, valor fixo ou livre
export const CUSTOMER_KEYS = [
  { id: 'status', label: 'Situação do cliente', ops: ['is', 'is_not'], values: 'status' },
  { id: 'product', label: 'Tem o plano', ops: ['is', 'is_not'], values: 'product' },
  { id: 'days_overdue', label: 'Dias em atraso', ops: ['gt', 'lt'], values: 'number' },
  { id: 'verified', label: 'Documento verificado', ops: ['is'], values: 'bool' },
  { id: 'has_open_charge', label: 'Tem cobrança em aberto', ops: ['is'], values: 'bool' },
  { id: 'has_subscription', label: 'Tem assinatura ativa', ops: ['is'], values: 'bool' },
  { id: 'no_shows', label: 'Faltas (não compareceu)', ops: ['gt', 'lt'], values: 'number' },
  { id: 'custom', label: 'Campo personalizado', ops: CUSTOM_OPS, values: 'text' }
];
// chaves da regra "Agendamento" (fonte appointment): próximos agendamentos do contato/cliente
export const APPOINTMENT_KEYS = [
  { id: 'next_in_hours', label: 'Próximo agendamento acontece em', ops: ['lte', 'gt'], values: 'number' },
  { id: 'has_upcoming', label: 'Tem agendamento marcado', ops: ['is'], values: 'bool' },
  { id: 'has_pending', label: 'Tem agendamento aguardando pagamento', ops: ['is'], values: 'bool' }
];
export const appointmentKeyMeta = (key) => APPOINTMENT_KEYS.find((k) => k.id === key) || APPOINTMENT_KEYS[1];
// chaves da regra "Chamado" (fonte ticket): chamados em andamento do contato/cliente (Fase 6B)
export const TICKET_KEYS = [
  { id: 'has_open', label: 'Tem chamado em andamento', ops: ['is'], values: 'bool' },
  { id: 'pending_customer', label: 'Tem chamado aguardando resposta do cliente', ops: ['is'], values: 'bool' }
];
export const ticketKeyMeta = (key) => TICKET_KEYS.find((k) => k.id === key) || TICKET_KEYS[0];
// chaves da regra "Pedido" (fonte order): pedidos em andamento do contato/cliente (Fase 7)
export const ORDER_KEYS = [
  { id: 'has_open_order', label: 'Tem pedido em andamento', ops: ['is'], values: 'bool' },
  { id: 'awaiting_payment', label: 'Pedido aguardando PIX', ops: ['is'], values: 'bool' }
];
export const orderKeyMeta = (key) => ORDER_KEYS.find((k) => k.id === key) || ORDER_KEYS[0];
export const CUSTOMER_STATUS_OPTIONS = [
  { id: 'ok', label: 'Em dia' },
  { id: 'overdue', label: 'Em atraso' },
  { id: 'none', label: 'Sem assinatura (ou sem cadastro)' },
  { id: 'inactive', label: 'Inativo' },
  { id: 'paused', label: 'Pausada' }
];
export const customerKeyOf = (key) => (String(key || '').startsWith('custom.') ? 'custom' : String(key || 'status'));
export const customerKeyMeta = (key) => CUSTOMER_KEYS.find((k) => k.id === customerKeyOf(key)) || CUSTOMER_KEYS[0];
export const customerOps = (key) => customerKeyMeta(key).ops;
export const SOURCE_OPS = {
  var: TEXT_OPS,
  last_input: TEXT_OPS,
  tag: ['has', 'not_has'],
  business_hours: ['open', 'closed'],
  contact_saved: ['eq'],
  customer: ['is', 'is_not', 'gt', 'lt', ...CUSTOM_OPS],
  appointment: ['is', 'lte', 'gt'],
  ticket: ['is'],
  order: ['is']
};
export const OP_LABEL = {
  is: 'é',
  is_not: 'não é',
  eq: 'é igual a',
  neq: 'é diferente de',
  contains: 'contém',
  not_contains: 'não contém',
  empty: 'está vazia',
  not_empty: 'está preenchida',
  gt: 'é maior que',
  lt: 'é menor que',
  lte: 'em até',
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
  if (source === 'customer') return { ...base, key: 'status', op: 'is', value: 'ok' };
  if (source === 'appointment') return { ...base, key: 'has_upcoming', op: 'is', value: 'true' };
  if (source === 'ticket') return { ...base, key: 'has_open', op: 'is', value: 'true' };
  if (source === 'order') return { ...base, key: 'has_open_order', op: 'is', value: 'true' };
  return base;
};

// ---------------------------------------------------------------------------
// Blocos de CRM — textos padrão (iguais aos do motor; vazio no bloco = o motor usa estes)
// ---------------------------------------------------------------------------
export const CRM_TEXTS = {
  no_customer: 'Não encontrei o seu cadastro por aqui 🤔 Fale com um atendente para continuar.',
  no_subscription: 'Você não tem uma assinatura ativa no momento.',
  failed: 'Ops, não consegui concluir agora 😕 Tente de novo mais tarde ou fale com um atendente.',
  identify: { choose_text: 'Encontrei mais de um cadastro neste número. Qual deles?' },
  register: { confirm_text: 'Confira seus dados:\n{{resumo}}\n\n1️⃣ Confirmar\n2️⃣ Corrigir / cancelar', done_text: 'Cadastro concluído ✅' },
  update: { confirm_text: 'Confira os novos dados:\n{{resumo}}\n\n1️⃣ Confirmar\n2️⃣ Cancelar', done_text: 'Dados atualizados ✅' },
  subscribe: {
    choose_text: 'Qual plano você quer?',
    ask_method_text: 'Como prefere pagar?\n1️⃣ PIX\n2️⃣ Boleto',
    confirm_text: 'Você escolheu *{{produto.nome}}* por *{{produto.valor}}*{{produto.periodo}}.\n\n1️⃣ Confirmar\n2️⃣ Agora não',
    declined_text: 'Tudo bem! Se mudar de ideia, é só me chamar 🙂',
    subscribed_text: 'Assinatura ativada ✅ Bem-vindo(a) ao *{{produto.nome}}*!',
    paid_text: 'Pagamento confirmado ✅ Sua assinatura do *{{produto.nome}}* está ativa. Obrigado!',
    expired_text: 'A cobrança venceu sem pagamento ⌛ Se ainda quiser assinar, é só me chamar que eu gero outra.',
    already_text: 'Você já tem uma assinatura de *{{produto.nome}}* 🙂 Para mudar algo nela, é só me chamar.',
    waiting_text:
      'Ainda estou aguardando o pagamento ⏳ Assim que ele cair eu te aviso. Para voltar ao início, digite *{{comando_reiniciar}}*.'
  },
  info: {
    status:
      'Olá, {{cliente.primeiro_nome}}! 👋\n\n*Situação:* {{cliente.status}}\n*Plano:* {{cliente.produto}}\n*Valor:* {{cliente.valor}}\n*Próximo vencimento:* {{cliente.vencimento}}',
    next_charge:
      '📅 *Próxima cobrança*\n\n*Plano:* {{assinatura.produto}}\n*Valor:* {{assinatura.valor}}\n*Vencimento:* {{assinatura.vencimento}}\n\n*Em aberto:*\n{{cobrancas.lista}}',
    subscriptions: '📋 *Suas assinaturas*\n\n{{assinaturas.lista}}',
    data: '👤 *Seus dados*\n\n*Nome:* {{cliente.nome}}\n*Documento:* {{cliente.documento}}\n*E-mail:* {{cliente.email}}\n*Código:* {{cliente.codigo}}{{cliente.campos}}'
  },
  invoice: {
    choose_text: 'Qual cobrança você quer receber?',
    sent_text: 'Enviei a 2ª via acima 👆',
    nothing_open_text: 'Você não tem cobrança em aberto 🙂'
  },
  cancel: {
    choose_text: 'Qual assinatura você quer cancelar?',
    reason_text: 'Pode me dizer o motivo?',
    confirm_text: 'Confirma o cancelamento de *{{assinatura.produto}}*?\n\n1️⃣ Sim, cancelar\n2️⃣ Não, manter',
    canceled_text: 'Cancelado. {{assinatura.fim_texto}}',
    kept_text: 'Que bom que você fica! 💚 Sua assinatura continua como está.'
  },
  pause: {
    choose_text: 'Qual assinatura você quer pausar?',
    ask_text: 'Por quantos dias quer pausar? (até {{max_dias}})',
    paused_text: 'Pausado até {{assinatura.pausa_ate}} ⏸️',
    canceled_text: 'Tudo bem, sua assinatura continua como está 🙂'
  },
  change_plan: {
    choose_sub_text: 'Qual assinatura você quer trocar?',
    choose_text: 'Para qual plano você quer mudar?',
    confirm_text: 'Trocar para *{{produto.nome}}* por *{{produto.valor}}*{{produto.periodo}}?\n\n1️⃣ Confirmar\n2️⃣ Manter o atual',
    changed_text: 'Plano trocado para *{{produto.nome}}* ✅',
    kept_text: 'Tudo bem, seu plano continua o mesmo 🙂'
  }
};

// ---------------------------------------------------------------------------
// Blocos de agenda (Fase 6) — textos padrão (iguais aos do motor; vazio no bloco = o motor usa estes)
// ---------------------------------------------------------------------------
export const BOOK_TEXTS = {
  book_service: {
    choose_service: 'Qual serviço você quer agendar?',
    choose_resource: 'Com quem você prefere?',
    any_resource: 'Tanto faz (primeiro horário livre)',
    choose_day: 'Para qual dia? 📅 Responda com o número:',
    more_days: 'Ver mais dias ➡️',
    first_days: 'Voltar aos primeiros dias ⬅️',
    choose_time: 'Horários livres em *{{agendamento.data}}* 🕒 Responda com o número:',
    more_times: 'Mais horários ⏩',
    first_times: 'Primeiros horários ⏪',
    other_day: 'Outro dia 📅',
    confirm:
      'Confira o agendamento:\n\n*{{agendamento.servico}}*\n👤 {{agendamento.profissional}}\n📅 {{agendamento.data}} às {{agendamento.hora}}\n💰 {{agendamento.valor}} — {{agendamento.pagamento}}\n\n1️⃣ Confirmar\n2️⃣ Escolher outro horário\n3️⃣ Desistir',
    booked:
      'Agendado ✅ *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}} com {{agendamento.profissional}}. Até lá!',
    pending_payment:
      'Reservei o seu horário ⏳ Para confirmar, pague *{{cobranca.valor}}* pelo PIX abaixo — o horário fica guardado por pouco tempo.',
    paid: 'Pagamento confirmado ✅ Seu horário está garantido: *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}}.',
    expired: 'O prazo para pagar terminou e o horário foi liberado ⌛ Se ainda quiser, é só me chamar para agendar de novo.',
    waiting:
      'Ainda estou aguardando o pagamento ⏳ Assim que ele cair eu confirmo o seu horário. Para voltar ao início, digite *{{comando_reiniciar}}*.',
    no_slots: 'Não encontrei horários livres para *{{agendamento.servico}}* nos próximos dias 😕',
    no_services: 'No momento não há serviços disponíveis para agendar 😕',
    day_full: 'Os horários desse dia acabaram de esgotar 😕 Veja os dias que ainda têm vaga:',
    conflict: 'Ops, esse horário acabou de ser reservado por outra pessoa 😕 Veja os que ainda estão livres:',
    busy: 'Você já tem um agendamento nesse horário 🙂 Escolha outro:',
    cancel: 'Tudo bem, não agendei nada. Quando quiser, é só me chamar 🙂',
    failed: 'Ops, não consegui concluir agora 😕 Tente de novo mais tarde ou fale com um atendente.'
  },
  my_appointments: {
    list: 'Seus próximos agendamentos 📅 Qual deles?',
    none: 'Você não tem agendamentos marcados 🙂',
    details:
      '*{{agendamento.servico}}*\n📅 {{agendamento.data}} às {{agendamento.hora}}\n👤 {{agendamento.profissional}}\n📌 {{agendamento.situacao}}',
    choose_action:
      '*{{agendamento.servico}}*\n📅 {{agendamento.data}} às {{agendamento.hora}}\n👤 {{agendamento.profissional}}\n📌 {{agendamento.situacao}}\n\nO que você quer fazer?',
    opt_confirm: 'Confirmar presença ✅',
    opt_pay: 'Ver o PIX para pagar 💳',
    opt_reschedule: 'Remarcar 🔁',
    opt_cancel: 'Cancelar ❌',
    opt_back: 'Nada, obrigado',
    pay_text: 'Para confirmar o horário, pague pelo PIX abaixo 👇',
    confirmed: 'Presença confirmada ✅ Até {{agendamento.data}} às {{agendamento.hora}}!',
    cancel_free:
      'Você pode cancelar sem custo 🙂\n\nConfirma o cancelamento de *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}}?\n\n1️⃣ Sim, cancelar\n2️⃣ Não, manter',
    cancel_late:
      'Atenção: o prazo para cancelar sem custo terminou ({{agendamento.prazo_cancelamento}}) e o valor pago pode não ser devolvido.\n\nConfirma o cancelamento de *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}}?\n\n1️⃣ Sim, cancelar\n2️⃣ Não, manter',
    canceled: 'Agendamento cancelado ✅',
    kept: 'Combinado, seu agendamento continua como está 🙂',
    confirm:
      'Remarcar *{{agendamento.servico}}* de {{agendamento.data_anterior}} às {{agendamento.hora_anterior}} para *{{agendamento.data}} às {{agendamento.hora}}*?\n\n1️⃣ Confirmar\n2️⃣ Escolher outro horário\n3️⃣ Desistir',
    rescheduled: 'Remarcado ✅ Agora é *{{agendamento.data}} às {{agendamento.hora}}* com {{agendamento.profissional}}.',
    no_slots: 'Não encontrei outro horário livre nos próximos dias 😕 Seu agendamento continua como está.'
  },
  waitlist_join: {
    choose_service: 'Para qual serviço você quer entrar na lista de espera?',
    choose_period: 'Qual período fica melhor para você?',
    done: 'Pronto! Coloquei você na lista de espera de *{{agendamento.servico}}* 📝 Se abrir um horário, eu te aviso por aqui.',
    cancel: 'Tudo bem 🙂 Quando quiser, é só me chamar.'
  }
};
// ---------------------------------------------------------------------------
// Blocos de chamados (Fase 6B) — textos padrão (iguais aos do motor; vazio no bloco = o motor usa estes)
// ---------------------------------------------------------------------------
export const TICKET_TEXTS = {
  open_ticket: {
    choose_category: 'Sobre o que é o seu chamado? Responda com o número (ou *0* para cancelar):',
    ask_subject: 'Em poucas palavras, qual é o assunto? (ou digite *pular*)',
    ask_description: 'Descreva o que aconteceu, com o máximo de detalhes que puder 📝',
    short_description: 'Preciso de um pouco mais de detalhe 🙂 Escreva a descrição em texto (pelo menos 5 caracteres).',
    ask_photo:
      'Se quiser, mande até 3 fotos ou documentos que ajudem a entender 📎\nQuando terminar, digite *pronto*. Para pular, digite *0*.',
    photo_received: 'Recebi ✅ ({{chamado.anexos}} de 3). Pode mandar mais ou digitar *pronto*.',
    photo_invalid: 'Por aqui eu aceito foto ou documento 📎 Mande o arquivo, digite *pronto* para enviar ou *0* para pular.',
    media_failed: 'Não consegui receber esse arquivo 😕 Tente mandar de novo ou digite *0* para pular.',
    created:
      'Chamado aberto ✅\n\n📄 Protocolo: *{{chamado.protocolo}}*\n📂 {{chamado.categoria}}\n⏱️ Prazo para retorno: {{chamado.prazo}}\n\nGuarde este número para acompanhar.',
    failed: 'Ops, não consegui abrir o chamado agora 😕 Tente de novo mais tarde ou fale com um atendente.',
    cancel: 'Tudo bem, não abri nenhum chamado. Quando precisar, é só me chamar 🙂'
  },
  my_tickets: {
    list: 'Seus chamados 📄 Qual deles você quer ver?',
    none: 'Você não tem chamados em andamento 🙂',
    details:
      '📄 Protocolo *{{chamado.protocolo}}*\n📂 {{chamado.categoria}}\n📌 Situação: *{{chamado.status}}*\n⏱️ Prazo: {{chamado.prazo}}\n💬 Última atualização: {{chamado.ultima_atualizacao}}{{chamado.campos}}',
    ask_protocol: 'Ou digite o número do protocolo.',
    not_found: 'Não encontrei esse protocolo entre os seus chamados 🤔 Confira o número e tente de novo.',
    opt_add_info: 'Enviar mais informações',
    opt_back: 'Voltar',
    ask_info: 'Pode mandar a informação (texto, foto ou documento) que eu junto ao protocolo *{{chamado.protocolo}}* 📝',
    info_added: 'Pronto ✅ Juntei sua mensagem ao protocolo *{{chamado.protocolo}}*. A equipe vai ver por lá.',
    closed: 'Este chamado já foi encerrado 🔒 Se precisar de algo novo, é só abrir outro chamado.',
    media_failed: 'Não consegui receber esse arquivo 😕 Tente mandar de novo.',
    failed: 'Ops, não consegui consultar seus chamados agora 😕 Tente de novo mais tarde ou fale com um atendente.'
  }
};
export const ticketDefault = (type, key) => TICKET_TEXTS[type]?.[key] ?? '';
export const TICKET_PRIORITY_OPTIONS = [
  { id: 'default', label: 'A da categoria' },
  { id: 'low', label: 'Baixa' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'Alta' },
  { id: 'urgent', label: 'Urgente' }
];
export const TICKET_SHOW_MODES = [
  { id: 'active', label: 'Só os em andamento', hint: 'Abertos e aguardando resposta do cliente.' },
  { id: 'all', label: 'Todos (inclusive resolvidos/encerrados)', hint: 'Os 5 mais recentes.' }
];
const TICKET_KEY_RE = /^[a-z0-9_-]{1,40}$/;

// ---------------------------------------------------------------------------
// Blocos de pedidos (Fase 7) — textos padrão (iguais aos do motor; vazio no bloco = o motor usa estes)
// ---------------------------------------------------------------------------
export const ORDER_TEXTS = {
  order_cart: {
    choose_category: 'O que você quer pedir? 🛍️ Escolha uma categoria:',
    choose_product: '*{{pedido.categoria}}* — escolha um produto:',
    ask_qty: 'Quantas unidades de *{{item.nome}}* ({{item.valor}} cada)? Responda de 1 a 99.',
    invalid_qty: 'Responda só com a quantidade, de 1 a 99 (ou *0* para voltar).',
    added: 'Adicionei {{item.qtd}}× *{{item.nome}}* ao carrinho ✅',
    cart: '🛒 *Seu carrinho*\n\n{{carrinho.itens}}\n\n*Subtotal:* {{carrinho.subtotal}}',
    cart_empty: 'Seu carrinho está vazio 🙂 Escolha um produto:',
    cart_cleared: 'Pronto, esvaziei o carrinho 🗑️',
    max_items: 'Seu carrinho já tem {{pedido.max_itens}} produtos diferentes (o máximo por pedido). Finalize ou esvazie o carrinho.',
    pix_min: 'O pagamento por PIX é a partir de R$ 1,00 — adicione mais alguma coisa ao carrinho 🙂',
    min_order: 'O pedido mínimo é *{{pedido.minimo}}* e o seu carrinho está em {{carrinho.subtotal}}. Adicione mais alguma coisa 🙂',
    ask_delivery: 'Como você quer receber o pedido?',
    choose_address: 'Para onde entregamos? 📍',
    ask_address: 'Digite o endereço completo da entrega (rua, número, bairro e complemento) 📍',
    invalid_address: 'Preciso do endereço completo (rua, número e bairro) para entregar 🙂',
    confirm_address: 'Entregar em: *{{pedido.endereco}}*\n\n1️⃣ Confirmar\n2️⃣ Digitar de novo',
    ask_notes: 'Quer deixar alguma observação no pedido? (ex.: sem cebola, troco para R$ 50) — ou responda *pular*.',
    ask_payment: 'Como você prefere pagar?',
    summary:
      '📋 *Resumo do pedido*\n\n{{pedido.itens}}\n\nSubtotal: {{pedido.subtotal}}\nEntrega: {{pedido.taxa}}\n*Total: {{pedido.total}}*\n\n{{pedido.entrega}}\n💳 {{pedido.pagamento}}{{pedido.campos}}',
    created_pix:
      'Pedido *#{{pedido.numero}}* recebido ✅ Total: *{{pedido.total}}*.\nPara confirmar, pague pelo PIX 👇 Assim que o pagamento cair eu te aviso.',
    created_on_delivery:
      'Pedido *#{{pedido.numero}}* recebido ✅\n\n{{pedido.itens}}\n\n*Total: {{pedido.total}}*\n{{pedido.entrega}}\n💳 {{pedido.pagamento}}\n\nVou te avisando por aqui 😉',
    paid: 'Pagamento do pedido *#{{pedido.numero}}* confirmado ✅ Já vamos preparar!',
    expired: 'O PIX do pedido *#{{pedido.numero}}* não foi pago a tempo ⌛ Se ainda quiser, é só fazer o pedido de novo.',
    waiting:
      'Ainda estou aguardando o pagamento do pedido *#{{pedido.numero}}* ⏳ Assim que ele cair eu te aviso. Para voltar ao início, digite *{{comando_reiniciar}}*.',
    empty_catalog: 'No momento não há produtos disponíveis para pedido 😕',
    disabled: 'No momento não estamos recebendo pedidos por aqui 😕',
    failed: 'Ops, não consegui concluir o pedido agora 😕 Tente de novo mais tarde ou fale com um atendente.',
    cancel: 'Tudo bem, cancelei o pedido. Quando quiser, é só me chamar 🙂',
    opt_more: 'Adicionar mais itens',
    opt_finish: 'Finalizar pedido',
    opt_clear: 'Esvaziar carrinho',
    opt_next_page: '➡️ Mais produtos',
    opt_prev_page: '⬅️ Página anterior',
    opt_categories: '⬅️ Voltar às categorias',
    opt_cart: '🛒 Ver carrinho',
    opt_delivery: '🛵 Entrega',
    opt_pickup: '🏪 Retirar no local',
    opt_other_address: '✏️ Digitar outro endereço',
    opt_pix: 'PIX',
    opt_on_delivery: 'Pagar na entrega',
    opt_on_pickup: 'Pagar na retirada',
    opt_confirm: 'Confirmar pedido',
    opt_edit: 'Alterar itens',
    opt_cancel: 'Cancelar'
  },
  my_orders: {
    list: 'Seus pedidos 🧾 Qual deles você quer ver?',
    none: 'Você ainda não tem pedidos por aqui 🙂',
    details:
      '🧾 Pedido *#{{pedido.numero}}* — {{pedido.data}}\n\n{{pedido.itens}}\n\n*Total: {{pedido.total}}*\n📌 Situação: *{{pedido.status}}*\n💳 {{pedido.pagamento}} — {{pedido.pagamento_status}}\n{{pedido.entrega}}{{pedido.campos}}',
    failed: 'Ops, não consegui consultar seus pedidos agora 😕 Tente de novo mais tarde ou fale com um atendente.'
  }
};
export const orderDefault = (type, key) => ORDER_TEXTS[type]?.[key] ?? '';
export const ORDER_PAYMENT_OPTIONS = [
  { id: 'ask', label: 'Perguntar ao cliente', hint: 'Oferece as formas ativas (PIX e/ou na entrega).' },
  { id: 'pix', label: 'Só PIX', hint: 'O pedido só é confirmado depois do pagamento.' },
  { id: 'on_delivery', label: 'Só na entrega / retirada', hint: 'O pedido sai sem cobrança — o cliente paga ao receber.' }
];
export const ORDER_SHOW_MODES = [
  { id: 'open', label: 'Só os em andamento', hint: 'Recebidos, confirmados, em preparo e saindo para entrega.' },
  { id: 'all', label: 'Todos (inclusive entregues/cancelados)', hint: 'Os 5 mais recentes.' }
];
/** Campos personalizados que o motor PERGUNTA (ask_in_bot OU obrigatório) — mesma regra do `askFieldsOf` do motor. */
export const askedCustomFields = (map, entity, exclude = []) =>
  (Array.isArray(map?.[entity]) ? map[entity] : []).filter(
    (f) => f && f.key && f.label && (f.ask_in_bot === true || f.required === true) && !exclude.includes(String(f.key).toLowerCase())
  );
/** Campos personalizados que o cliente vê nas consultas (`visible_to_customer`). */
export const visibleCustomFields = (map, entity) =>
  (Array.isArray(map?.[entity]) ? map[entity] : []).filter((f) => f && f.key && f.label && f.visible_to_customer === true);

/** Texto padrão de um bloco de agenda (chaves comuns caem no padrão do "Agendar"). */
export const bookDefault = (type, key) => BOOK_TEXTS[type]?.[key] ?? BOOK_TEXTS.book_service[key] ?? '';
export const BOOK_RESOURCE_MODES = [
  { id: 'auto', label: 'Automático (primeiro horário livre)', hint: 'O cliente escolhe só o dia e a hora.' },
  { id: 'ask', label: 'Perguntar com quem', hint: 'Lista os profissionais/recursos do serviço + "Tanto faz".' }
];
export const WAITLIST_PRODUCT_MODES = [
  { id: 'current', label: 'O serviço escolhido no "Agendar" anterior', hint: 'Sem serviço escolhido antes, o bot pergunta.' },
  { id: 'ask', label: 'Perguntar ao cliente' }
];
export const WAITLIST_PERIOD_MODES = [
  { id: 'ask', label: 'Perguntar (manhã / tarde / noite / qualquer)' },
  { id: 'any', label: 'Qualquer horário' },
  { id: 'morning', label: 'Só de manhã' },
  { id: 'afternoon', label: 'Só à tarde' },
  { id: 'evening', label: 'Só à noite' }
];

export const IDENTIFY_MODES = [
  {
    id: 'org',
    label: 'Como está configurado na organização',
    hint: 'Sem exigência de documento = identifica pelo número; com exigência = pede o CPF/CNPJ.'
  },
  { id: 'phone', label: 'Pelo número do WhatsApp', hint: 'Usa o cadastro vinculado ao número, sem perguntar nada.' },
  { id: 'ask_doc', label: 'Perguntar o CPF/CNPJ', hint: 'O bot pede o documento e procura o cadastro.' },
  { id: 'ask_code', label: 'Perguntar o código do cliente', hint: 'Matrícula, contrato… (rótulo definido em Configurações → Clientes).' }
];
export const SUBSCRIBE_METHODS = [
  { id: 'pix', label: 'PIX' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'ask', label: 'Perguntar ao cliente' }
];
export const INFO_WHATS = [
  { id: 'status', label: 'Situação (plano, valor, vencimento)' },
  { id: 'next_charge', label: 'Próxima cobrança' },
  { id: 'subscriptions', label: 'Lista de assinaturas' },
  { id: 'data', label: 'Dados cadastrais' },
  { id: 'custom', label: 'Texto personalizado' }
];
export const INVOICE_WHICH = [
  { id: 'open', label: 'A pendente mais antiga' },
  { id: 'last', label: 'A pendente mais recente' },
  { id: 'choose', label: 'O cliente escolhe (lista numerada)' }
];
export const INVOICE_METHODS = [
  { id: 'same', label: 'Mesmo meio da cobrança original' },
  { id: 'pix', label: 'PIX' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'both', label: 'PIX e boleto' }
];
export const CANCEL_POLICIES = [
  { id: 'product', label: 'Como está no produto' },
  { id: 'immediate', label: 'Imediato' },
  { id: 'end_of_cycle', label: 'No fim do ciclo pago' }
];
export const SUBSCRIPTION_PICK = [
  { id: 'single', label: 'A única assinatura (pergunta qual se houver mais de uma)' },
  { id: 'choose', label: 'Sempre listar para o cliente escolher' }
];

// campos do cadastro (crm_register / crm_update); `custom.<key>` vem de Configurações → Clientes → Campos personalizados
export const REGISTER_FIELDS = [
  { key: 'name', label: 'Nome', question: 'Qual é o seu nome completo?', validate: 'name' },
  { key: 'doc', label: 'CPF/CNPJ', question: 'Qual é o seu CPF ou CNPJ? (só números)', validate: 'doc' },
  { key: 'email', label: 'E-mail', question: 'Qual é o seu e-mail?', validate: 'email' },
  { key: 'code', label: 'Código do cliente', question: 'Qual é o seu código de cliente?', validate: 'code' },
  { key: 'address.zip', label: 'CEP', question: 'Qual é o seu CEP? (só números)', validate: 'cep' },
  { key: 'address.street', label: 'Rua', question: 'Qual é a rua ou avenida?', validate: 'any' },
  { key: 'address.number', label: 'Número', question: 'Qual é o número? (e complemento, se tiver)', validate: 'any' },
  { key: 'address.district', label: 'Bairro', question: 'Qual é o bairro?', validate: 'any' },
  { key: 'address.city', label: 'Cidade', question: 'Qual é a cidade?', validate: 'any' },
  { key: 'address.state', label: 'Estado', question: 'Qual é o estado? (sigla, ex.: SP)', validate: 'uf' },
  { key: 'notes', label: 'Observações', question: 'Quer deixar alguma observação?', validate: 'any' }
];
export const registerFieldMeta = (key, customFields = []) => {
  const k = String(key || '');
  if (k.startsWith('custom.')) {
    const cf = (customFields || []).find((f) => f.key === k.slice(7));
    return {
      key: k,
      label: cf?.label || k.slice(7),
      question: '',
      validate: cf?.type === 'number' ? 'number' : cf?.type === 'date' ? 'date' : 'any',
      custom: true,
      missing: !cf
    };
  }
  return REGISTER_FIELDS.find((f) => f.key === k) || { key: k, label: k, question: '', validate: 'any' };
};
export const newField = (key, customFields) => {
  const m = registerFieldMeta(key, customFields);
  return { id: uid('f'), key, label: m.custom ? m.label : '', question: '', required: true, validate: m.validate };
};
const FIELD_VALIDATES = new Set(VALIDATE_OPTIONS.map((v) => v.id));
const normFields = (raw) =>
  (Array.isArray(raw) ? raw : [])
    .filter((f) => f && typeof f === 'object' && String(f.key || '').trim())
    .map((f) => ({
      id: f.id ? String(f.id) : uid('f'),
      key: String(f.key).trim().slice(0, 60),
      label: str(f.label).slice(0, 60),
      question: str(f.question).slice(0, 500),
      required: f.required !== false,
      validate: FIELD_VALIDATES.has(f.validate) ? f.validate : ''
    }));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => UUID_RE.test(String(v || ''));

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
    case 'crm_identify':
      return {
        title: 'Identificar cliente',
        mode: 'org',
        ask_text: '',
        not_found_text: '',
        invalid_text: '',
        retries: 3,
        choose_text: CRM_TEXTS.identify.choose_text,
        found_text: ''
      };
    case 'crm_register':
      return {
        title: 'Cadastrar cliente',
        intro_text: 'Vamos fazer o seu cadastro — leva menos de um minuto 🙂',
        fields: [newField('name'), newField('doc'), newField('email')],
        confirm: true,
        confirm_text: CRM_TEXTS.register.confirm_text,
        done_text: CRM_TEXTS.register.done_text,
        link_role: 'owner',
        failed_text: ''
      };
    case 'crm_subscribe':
      return {
        title: 'Assinar plano',
        product_id: 'choose',
        product_ids: [],
        choose_text: CRM_TEXTS.subscribe.choose_text,
        method: 'pix',
        ask_method_text: CRM_TEXTS.subscribe.ask_method_text,
        charge_now: true,
        confirm: true,
        confirm_text: CRM_TEXTS.subscribe.confirm_text,
        declined_text: CRM_TEXTS.subscribe.declined_text,
        subscribed_text: CRM_TEXTS.subscribe.subscribed_text,
        paid_text: CRM_TEXTS.subscribe.paid_text,
        expired_text: CRM_TEXTS.subscribe.expired_text,
        waiting_text: CRM_TEXTS.subscribe.waiting_text,
        already_text: CRM_TEXTS.subscribe.already_text,
        no_customer_text: '',
        failed_text: ''
      };
    case 'crm_info':
      return { title: 'Informar situação', what: 'status', template: '', no_customer_text: '' };
    case 'crm_invoice':
      return {
        title: '2ª via da cobrança',
        which: 'open',
        method: 'same',
        choose_text: CRM_TEXTS.invoice.choose_text,
        sent_text: CRM_TEXTS.invoice.sent_text,
        nothing_open_text: CRM_TEXTS.invoice.nothing_open_text,
        no_customer_text: '',
        failed_text: ''
      };
    case 'crm_cancel':
      return {
        title: 'Cancelar assinatura',
        subscription: 'single',
        choose_text: CRM_TEXTS.cancel.choose_text,
        ask_reason: true,
        reason_text: CRM_TEXTS.cancel.reason_text,
        reasons: [],
        retention_text: '',
        confirm_text: CRM_TEXTS.cancel.confirm_text,
        policy: 'product',
        canceled_text: CRM_TEXTS.cancel.canceled_text,
        kept_text: CRM_TEXTS.cancel.kept_text,
        no_subscription_text: '',
        no_customer_text: '',
        failed_text: ''
      };
    case 'crm_pause':
      return {
        title: 'Pausar assinatura',
        max_days: 30,
        ask_until: true,
        ask_text: CRM_TEXTS.pause.ask_text,
        days: 30,
        choose_text: CRM_TEXTS.pause.choose_text,
        paused_text: CRM_TEXTS.pause.paused_text,
        canceled_text: CRM_TEXTS.pause.canceled_text,
        no_subscription_text: '',
        no_customer_text: '',
        failed_text: ''
      };
    case 'crm_change_plan':
      return {
        title: 'Trocar de plano',
        product_ids: [],
        choose_sub_text: CRM_TEXTS.change_plan.choose_sub_text,
        choose_text: CRM_TEXTS.change_plan.choose_text,
        confirm: true,
        confirm_text: CRM_TEXTS.change_plan.confirm_text,
        changed_text: CRM_TEXTS.change_plan.changed_text,
        kept_text: CRM_TEXTS.change_plan.kept_text,
        no_subscription_text: '',
        no_customer_text: '',
        failed_text: ''
      };
    case 'crm_update':
      return {
        title: 'Atualizar dados',
        fields: [newField('email')],
        confirm: true,
        confirm_text: CRM_TEXTS.update.confirm_text,
        done_text: CRM_TEXTS.update.done_text,
        no_customer_text: '',
        failed_text: ''
      };
    case 'book_service':
      return {
        title: 'Agendar',
        services: [],
        resource: 'auto',
        days_ahead: 14,
        confirm: true,
        texts: { ...BOOK_TEXTS.book_service, failed: '' }
      };
    case 'my_appointments':
      return {
        title: 'Meus agendamentos',
        allow_confirm: true,
        allow_reschedule: true,
        allow_cancel: true,
        days_ahead: 14,
        texts: { ...BOOK_TEXTS.my_appointments }
      };
    case 'waitlist_join':
      return { title: 'Lista de espera', product_id: 'current', period: 'ask', days_ahead: 14, texts: { ...BOOK_TEXTS.waitlist_join } };
    case 'open_ticket':
      return {
        title: 'Abrir chamado',
        category: 'ask',
        ask_subject: false,
        ask_photo: true,
        priority: 'default',
        texts: { ...TICKET_TEXTS.open_ticket, failed: '' }
      };
    case 'my_tickets':
      return { title: 'Meus chamados', show: 'active', allow_add_info: true, texts: { ...TICKET_TEXTS.my_tickets, failed: '' } };
    case 'order_cart':
      return {
        title: 'Fazer pedido',
        categories: 'all',
        allow_delivery: true,
        allow_pickup: true,
        payment: 'ask',
        ask_notes: false,
        texts: { ...ORDER_TEXTS.order_cart, failed: '' }
      };
    case 'my_orders':
      return { title: 'Meus pedidos', show: 'open', texts: { ...ORDER_TEXTS.my_orders, failed: '' } };
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
    if (d.source !== 'products') delete d.source;
    else d.product_ids = strList(d.product_ids);
  } else if (type === 'question') {
    d.text = str(d.text);
    d.var = sanitizeVarName(d.var);
    if (!VALIDATE_OPTIONS.some((v) => v.id === d.validate)) d.validate = 'any';
    if (d.save_to_contact !== 'name' && d.save_to_contact !== 'email') d.save_to_contact = null;
  } else if (type === 'condition') {
    d.match = d.match === 'any' ? 'any' : 'all';
    d.rules = (Array.isArray(d.rules) ? d.rules : []).map((r) => {
      const source = CONDITION_SOURCES.some((s) => s.id === r?.source) ? r.source : 'last_input';
      const ops =
        source === 'customer'
          ? customerOps(r?.key)
          : source === 'appointment'
            ? appointmentKeyMeta(r?.key).ops
            : source === 'ticket'
              ? ticketKeyMeta(r?.key).ops
              : source === 'order'
                ? orderKeyMeta(r?.key).ops
                : SOURCE_OPS[source];
      const base = { ...r, id: r?.id ? String(r.id) : uid('r'), source, op: ops.includes(r?.op) ? r.op : ops[0] };
      if (source === 'customer') base.key = r?.key ? String(r.key) : 'status';
      if (source === 'appointment') base.key = appointmentKeyMeta(r?.key).id;
      if (source === 'ticket') {
        base.key = ticketKeyMeta(r?.key).id;
        base.value = r?.value === 'false' ? 'false' : 'true';
      }
      if (source === 'order') {
        base.key = orderKeyMeta(r?.key).id;
        base.value = r?.value === 'false' ? 'false' : 'true';
      }
      return base;
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
  } else if (isCrmType(type)) {
    // textos: string (vazio = padrão do motor); demais campos com defaults do contrato
    Object.keys(def).forEach((k) => {
      if (typeof def[k] === 'string' && typeof d[k] !== 'string') d[k] = k in d ? str(d[k]) : def[k];
    });
    if (type === 'crm_identify') {
      if (!IDENTIFY_MODES.some((m) => m.id === d.mode)) d.mode = 'org';
      d.retries = clampInt(d.retries, 1, 10, 3);
    } else if (type === 'crm_register' || type === 'crm_update') {
      d.fields = normFields(d.fields);
      d.confirm = d.confirm !== false;
      if (type === 'crm_register') d.link_role = str(d.link_role) || 'owner';
    } else if (type === 'crm_subscribe') {
      const pid = str(d.product_id);
      d.product_id = pid === 'choose' || pid === 'from_var' || isUuid(pid) ? pid : 'choose';
      d.product_ids = strList(d.product_ids);
      if (!SUBSCRIBE_METHODS.some((m) => m.id === d.method)) d.method = 'pix';
      d.charge_now = d.charge_now !== false;
      d.confirm = d.confirm !== false;
    } else if (type === 'crm_info') {
      if (!INFO_WHATS.some((w) => w.id === d.what)) d.what = 'status';
    } else if (type === 'crm_invoice') {
      if (!INVOICE_WHICH.some((w) => w.id === d.which)) d.which = 'open';
      if (!INVOICE_METHODS.some((m) => m.id === d.method)) d.method = 'same';
    } else if (type === 'crm_cancel') {
      d.subscription = d.subscription === 'choose' ? 'choose' : 'single';
      d.ask_reason = d.ask_reason !== false;
      d.reasons = strList(d.reasons).map((r) => r.slice(0, 80));
      if (!CANCEL_POLICIES.some((p) => p.id === d.policy)) d.policy = 'product';
    } else if (type === 'crm_pause') {
      d.max_days = clampInt(d.max_days, 1, 365, 30);
      d.ask_until = d.ask_until !== false;
      d.days = clampInt(d.days, 1, 365, d.max_days);
    } else if (type === 'crm_change_plan') {
      d.product_ids = strList(d.product_ids);
      d.confirm = d.confirm !== false;
    }
  } else if (isBookType(type)) {
    // textos ficam em `texts` (vazio = padrão do motor)
    const t = d.texts && typeof d.texts === 'object' ? d.texts : {};
    d.texts = Object.fromEntries(Object.keys({ ...def.texts, ...t }).map((k) => [k, str(k in t ? t[k] : def.texts[k])]));
    d.days_ahead = clampInt(d.days_ahead, 1, 60, 14);
    if (type === 'book_service') {
      d.services = d.services === 'all' ? [] : strList(d.services);
      const r = str(d.resource);
      d.resource = r === 'ask' || r === 'auto' || isUuid(r) ? r : 'auto';
      d.confirm = d.confirm !== false;
    } else if (type === 'my_appointments') {
      d.allow_confirm = d.allow_confirm !== false;
      d.allow_reschedule = d.allow_reschedule !== false;
      d.allow_cancel = d.allow_cancel !== false;
    } else if (type === 'waitlist_join') {
      const p = str(d.product_id);
      d.product_id = p === 'current' || p === 'ask' || isUuid(p) ? p : 'current';
      if (!WAITLIST_PERIOD_MODES.some((m) => m.id === d.period)) d.period = 'ask';
    }
  } else if (isTicketType(type)) {
    // textos ficam em `texts` (vazio = padrão do motor)
    const t = d.texts && typeof d.texts === 'object' ? d.texts : {};
    d.texts = Object.fromEntries(Object.keys({ ...def.texts, ...t }).map((k) => [k, str(k in t ? t[k] : def.texts[k])]));
    if (type === 'open_ticket') {
      const c = str(d.category).trim();
      d.category = c === 'ask' || TICKET_KEY_RE.test(c) ? c : 'ask';
      d.ask_subject = d.ask_subject === true;
      d.ask_photo = d.ask_photo !== false;
      if (!TICKET_PRIORITY_OPTIONS.some((o) => o.id === d.priority)) d.priority = 'default';
    } else {
      d.show = d.show === 'all' ? 'all' : 'active';
      d.allow_add_info = d.allow_add_info !== false;
    }
  } else if (isOrderType(type)) {
    // textos ficam em `texts` (vazio = padrão do motor)
    const t = d.texts && typeof d.texts === 'object' ? d.texts : {};
    d.texts = Object.fromEntries(Object.keys({ ...def.texts, ...t }).map((k) => [k, str(k in t ? t[k] : def.texts[k])]));
    if (type === 'order_cart') {
      // categorias: 'all' ou lista de NOMES do catálogo (como o motor compara: sem acento/maiúsculas)
      if (d.categories !== 'all') {
        const list = strList(d.categories).map((c) => c.slice(0, 80));
        d.categories = list.length ? [...new Set(list)] : Array.isArray(d.categories) ? [] : 'all';
      }
      d.allow_delivery = d.allow_delivery !== false;
      d.allow_pickup = d.allow_pickup !== false;
      if (!ORDER_PAYMENT_OPTIONS.some((o) => o.id === d.payment)) d.payment = 'ask';
      d.ask_notes = d.ask_notes === true;
    } else {
      d.show = d.show === 'all' ? 'all' : 'open';
    }
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
  if (type === 'crm_register' || type === 'crm_update') d.fields = (d.fields || []).map((f) => ({ ...f, id: uid('f') }));
  if ((isBookType(type) || isTicketType(type) || isOrderType(type)) && d.texts) d.texts = { ...d.texts };
  if (type === 'order_cart' && Array.isArray(d.categories)) d.categories = [...d.categories];
  return d;
}

// ---------------------------------------------------------------------------
// Saídas de cada bloco (handles de origem)
// ---------------------------------------------------------------------------
// rótulo "Nome · R$ X/mês" dos produtos (igual ao motor; `once` = avulso, sem período)
const PERIOD_SHORT = { monthly: '/mês', quarterly: '/trimestre', semiannual: '/semestre', yearly: '/ano', once: '' };
export const productLabel = (p) => `${p?.name || 'Produto'} · ${p?.price_label || fmtBRL(p?.price_cents)}${PERIOD_SHORT[p?.billing] || ''}`;
export const PERIOD_LONG = { monthly: ' por mês', quarterly: ' por trimestre', semiannual: ' por semestre', yearly: ' por ano', once: '' };
/** Produtos que um bloco/menu lista: ativos, filtrados por `product_ids` (vazio = todos). */
export const productsFor = (products, ids, excludeId) => {
  const wanted = strList(ids);
  // serviços da agenda (kind 'service') nunca entram em menu de produtos/assinatura
  return (products || []).filter(
    (p) =>
      p && p.active !== false && p.kind !== 'service' && (!wanted.length || wanted.includes(p.id)) && (!excludeId || p.id !== excludeId)
  );
};

const PORT = {
  out: { label: 'Depois', tone: 'neutral' },
  found: { label: 'Cliente encontrado', tone: 'good' },
  not_found: { label: 'Não encontrado', tone: 'neutral' },
  invalid: { label: 'Documento inválido', tone: 'bad' },
  done: { label: 'Cadastro concluído', tone: 'good' },
  cancel: { label: 'Cliente desistiu', tone: 'bad' },
  failed: { label: 'Deu erro', tone: 'bad' },
  paid: { label: 'Pagou', tone: 'good' },
  subscribed: { label: 'Assinou (sem cobrança)', tone: 'good' },
  expired: { label: 'Cobrança venceu', tone: 'bad' },
  declined: { label: 'Não quis', tone: 'bad' },
  no_customer: { label: 'Sem cadastro', tone: 'bad' },
  sent: { label: '2ª via enviada', tone: 'good' },
  nothing_open: { label: 'Nada em aberto', tone: 'neutral' },
  canceled: { label: 'Cancelou', tone: 'neutral' },
  kept: { label: 'Manteve', tone: 'good' },
  no_subscription: { label: 'Sem assinatura', tone: 'bad' },
  paused: { label: 'Pausou', tone: 'good' },
  changed: { label: 'Trocou', tone: 'good' },
  // agenda
  booked: { label: 'Agendou', tone: 'good' },
  pending_payment: { label: 'Aguardando pagamento (segue sem esperar)', tone: 'neutral' },
  no_slots: { label: 'Sem horário livre', tone: 'bad' },
  none: { label: 'Sem agendamento', tone: 'neutral' },
  // chamados
  created: { label: 'Chamado aberto', tone: 'good' },
  no_tickets: { label: 'Sem chamados', tone: 'neutral' },
  // pedidos
  order_out: { label: 'Pedido feito (pagar na entrega)', tone: 'good' },
  order_paid: { label: 'Pago', tone: 'good' },
  order_expired: { label: 'PIX expirou', tone: 'bad' },
  order_canceled: { label: 'Desistiu', tone: 'neutral' },
  no_orders: { label: 'Sem pedidos', tone: 'neutral' }
};
const ports = (...ids) => ids.map((id) => ({ id, ...PORT[id] }));
export const CRM_PORTS = {
  crm_identify: ['found', 'not_found', 'invalid'],
  crm_register: ['done', 'cancel', 'failed'],
  crm_subscribe: ['paid', 'subscribed', 'expired', 'declined', 'no_customer', 'failed'],
  crm_info: ['out', 'no_customer'],
  crm_invoice: ['sent', 'nothing_open', 'no_customer', 'failed'],
  crm_cancel: ['canceled', 'kept', 'no_subscription', 'no_customer', 'failed'],
  crm_pause: ['paused', 'no_subscription', 'no_customer', 'failed'],
  crm_change_plan: ['changed', 'kept', 'no_subscription', 'no_customer', 'failed'],
  crm_update: ['out', 'cancel', 'no_customer', 'failed']
};
export const BOOK_PORTS = {
  book_service: ['booked', 'pending_payment', 'expired', 'no_slots', 'cancel', 'failed'],
  my_appointments: ['out', 'none', 'failed'],
  waitlist_join: ['out', 'failed']
};
// chamados (Fase 6B): o id da saída é o do motor (open_ticket: out = chamado aberto; my_tickets: none = sem chamados)
export const TICKET_PORTS = {
  open_ticket: ['out', 'cancel', 'failed'],
  my_tickets: ['out', 'none', 'failed']
};
// pedidos (Fase 7): ids do motor (order_cart: out = pedido feito sem PIX, paid/expired = PIX; my_orders: none = sem pedidos)
export const ORDER_PORTS = {
  order_cart: ['out', 'paid', 'expired', 'canceled', 'failed'],
  my_orders: ['out', 'none', 'failed']
};

export function outputsOf(type, data, settings, products) {
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
      const opts =
        data?.source === 'products'
          ? productsFor(products, data?.product_ids).map((p) => ({ id: p.id, label: productLabel(p) }))
          : data?.options || [];
      return [
        ...opts.map((o, i) => ({
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
    case 'crm_identify': {
      const tries = data?.retries || 3;
      return [
        ...ports('found', 'not_found'),
        { id: 'invalid', label: `Documento inválido (após ${tries} ${tries === 1 ? 'tentativa' : 'tentativas'})`, tone: 'bad' }
      ];
    }
    case 'crm_subscribe':
      return ports(
        ...(data?.charge_now === false ? ['subscribed', 'paid', 'expired'] : ['paid', 'subscribed', 'expired']),
        'declined',
        'no_customer',
        'failed'
      );
    case 'book_service':
      return [
        ...ports('booked', 'pending_payment'),
        { id: 'expired', label: 'Não pagou no prazo', tone: 'bad' },
        ...ports('no_slots'),
        { id: 'cancel', label: 'Desistiu', tone: 'bad' },
        ...ports('failed')
      ];
    case 'my_appointments':
      return [{ id: 'out', label: 'Depois', tone: 'neutral' }, ...ports('none', 'failed')];
    case 'waitlist_join':
      return [{ id: 'out', label: 'Entrou na lista', tone: 'good' }, ...ports('failed')];
    case 'open_ticket':
      return [{ id: 'out', ...PORT.created }, { id: 'cancel', label: 'Desistiu', tone: 'bad' }, ...ports('failed')];
    case 'my_tickets':
      return [{ id: 'out', label: 'Depois', tone: 'neutral' }, { id: 'none', ...PORT.no_tickets }, ...ports('failed')];
    case 'order_cart':
      return [
        { id: 'out', ...PORT.order_out },
        { id: 'paid', ...PORT.order_paid },
        { id: 'expired', ...PORT.order_expired },
        { id: 'canceled', ...PORT.order_canceled },
        ...ports('failed')
      ];
    case 'my_orders':
      return [{ id: 'out', label: 'Depois', tone: 'neutral' }, { id: 'none', ...PORT.no_orders }, ...ports('failed')];
    default:
      return CRM_PORTS[type] ? ports(...CRM_PORTS[type]) : [];
  }
}

const BAD_HANDLES = new Set(['invalid', 'false', 'expired', 'cancel', 'declined', 'no_customer', 'no_subscription', 'failed', 'no_slots']);
const GOOD_HANDLES = new Set(['true', 'paid', 'found', 'done', 'subscribed', 'sent', 'paused', 'changed', 'kept', 'booked']);
export const toneOfHandle = (h) => {
  if (BAD_HANDLES.has(h)) return 'bad';
  if (GOOD_HANDLES.has(h)) return 'good';
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
      return [data?.text, data?.invalid_text, data?.unavailable_text];
    case 'question':
      return [data?.text, data?.invalid_text];
    case 'pix':
      return [data?.text, data?.paid_text, data?.expired_text, data?.description];
    case 'handoff':
    case 'end':
      return [data?.text];
    case 'crm_identify':
      return [data?.ask_text, data?.not_found_text, data?.invalid_text, data?.choose_text, data?.found_text];
    case 'crm_register':
    case 'crm_update':
      return [
        data?.intro_text,
        data?.confirm_text,
        data?.done_text,
        data?.failed_text,
        data?.no_customer_text,
        ...(data?.fields || []).map((f) => f.question)
      ];
    case 'crm_subscribe':
      return [
        data?.choose_text,
        data?.ask_method_text,
        data?.confirm_text,
        data?.declined_text,
        data?.subscribed_text,
        data?.paid_text,
        data?.expired_text,
        data?.waiting_text,
        data?.already_text,
        data?.no_customer_text,
        data?.failed_text
      ];
    case 'crm_info':
      return [data?.template, data?.no_customer_text];
    case 'crm_invoice':
      return [data?.choose_text, data?.sent_text, data?.nothing_open_text, data?.no_customer_text, data?.failed_text];
    case 'crm_cancel':
      return [
        data?.choose_text,
        data?.reason_text,
        data?.retention_text,
        data?.confirm_text,
        data?.canceled_text,
        data?.kept_text,
        data?.no_subscription_text,
        data?.no_customer_text,
        data?.failed_text
      ];
    case 'crm_pause':
      return [
        data?.choose_text,
        data?.ask_text,
        data?.paused_text,
        data?.canceled_text,
        data?.no_subscription_text,
        data?.no_customer_text,
        data?.failed_text
      ];
    case 'crm_change_plan':
      return [
        data?.choose_sub_text,
        data?.choose_text,
        data?.confirm_text,
        data?.changed_text,
        data?.kept_text,
        data?.no_subscription_text,
        data?.no_customer_text,
        data?.failed_text
      ];
    case 'book_service':
    case 'my_appointments':
    case 'waitlist_join':
    case 'open_ticket':
    case 'my_tickets':
    case 'order_cart':
    case 'my_orders':
      return Object.values(data?.texts || {});
    default:
      return [];
  }
}

const isBlank = (v) => !String(v || '').trim();

// ---------------------------------------------------------------------------
// Validação (avisos no nó + lista geral). level: 'error' | 'warning'
// ---------------------------------------------------------------------------
export function validateFlow(nodes, edges, ctx = {}) {
  const { settings, tags, attendants, gateway, products, crmSettings, bookServices, ticketCategories, catalogCategories } = ctx;
  // pedidos (Fase 7): nomes das categorias do catálogo real (GET /whatsapp/orders/catalog); null = carregando (não valida)
  const catalogCats = Array.isArray(catalogCategories) ? catalogCategories.map((c) => String(c || '').trim()).filter(Boolean) : null;
  const catKey = (v) => normText(v);
  const catalogKeys = catalogCats ? new Set(catalogCats.map(catKey)) : null;
  // campos personalizados por entidade (GET /whatsapp/crm-settings → custom_fields como mapa); null = carregando
  const cfMap =
    ctx.customFieldMap && typeof ctx.customFieldMap === 'object'
      ? ctx.customFieldMap
      : crmSettings?.custom_field_map && typeof crmSettings.custom_field_map === 'object'
        ? crmSettings.custom_field_map
        : null;
  const askedNote = (nodeId, entity, exclude = []) => {
    if (!cfMap) return;
    const list = askedCustomFields(cfMap, entity, exclude);
    if (list.length) add(nodeId, 'info', `O bot vai perguntar também: ${list.map((f) => f.label).join(', ')}.`);
  };
  // categorias de chamado (GET /whatsapp/tickets/settings → categories); null = ainda carregando (não valida)
  const ticketCats = Array.isArray(ticketCategories) ? ticketCategories : null;
  const activeCats = ticketCats ? ticketCats.filter((c) => c && c.active !== false) : null;
  const svcIds = bookServices ? new Set(bookServices.map((x) => x.id)) : null;
  const prodIds = products ? new Set(products.filter((p) => p.active !== false && p.kind !== 'service').map((p) => p.id)) : null;
  const customFields = crmSettings?.custom_fields || null;
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
  let identityNoted = false;
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
    unknown.forEach((k) => {
      const kn = isKnownCrmVar(k, customFields, cfMap);
      if (kn === true) return;
      if (kn === 'custom-missing') {
        add(
          n.id,
          'warning',
          `{{${k}}} não é um dado do cadastro nem um campo personalizado da organização (Clientes → Campos personalizados) — vai aparecer vazio.`
        );
        return;
      }
      add(n.id, 'warning', `A variável {{${k}}} não existe. Crie uma Pergunta que salve em "${k}" ou corrija o nome.`);
    });

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
        if (d.source === 'products') {
          const list = productsFor(products || [], d.product_ids);
          if (products && !list.length)
            add(n.id, 'warning', 'Nenhum produto ativo para listar — cadastre em WhatsApp → Produtos ou revise o filtro.');
          if (prodIds && (d.product_ids || []).some((id) => !prodIds.has(id)))
            add(n.id, 'warning', 'Um dos produtos escolhidos não existe mais (ou está inativo).');
          // produto sem ligação: o bot cai em "Não entendeu"/"Depois" ou avisa e repete o menu — nunca termina em silêncio
          list.forEach((p) => {
            if (!connected(n.id, `opt-${p.id}`))
              add(n.id, 'warning', `O produto "${p.name}" não está ligado a nenhum bloco — quem o escolher cai em "Não entendeu".`);
          });
          if (!connected(n.id, 'invalid'))
            add(n.id, 'warning', 'Ligue a saída "Não entendeu" — também é por onde o bot segue se não houver produto ativo.');
          break;
        }
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
          if (r.source === 'customer') {
            const ck = customerKeyOf(r.key);
            if (ck === 'custom' && String(r.key || '').length <= 7) add(n.id, 'error', `${label}: escolha o campo personalizado.`);
            if (ck === 'product' && isBlank(r.value)) add(n.id, 'error', `${label}: escolha o produto.`);
            else if (ck === 'product' && prodIds && !prodIds.has(r.value))
              add(n.id, 'warning', `${label}: o produto escolhido não existe mais.`);
            if (
              (ck === 'status' || ck === 'days_overdue' || ck === 'no_shows' || (ck === 'custom' && opNeedsValue(r.op))) &&
              isBlank(r.value)
            )
              add(n.id, 'error', `${label}: preencha o valor a comparar.`);
          }
          if (r.source === 'appointment' && r.key === 'next_in_hours' && isBlank(r.value))
            add(n.id, 'error', `${label}: informe em quantas horas.`);
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
      case 'crm_identify':
        if (d.mode === 'org' && crmSettings && !crmSettings.identity?.require_doc)
          add(n.id, 'info', 'A organização não exige documento: este bloco vai identificar o cliente pelo número do WhatsApp.');
        if (d.mode === 'ask_code' && crmSettings && !crmSettings.identity?.use_code)
          add(n.id, 'warning', 'A organização não usa código de cliente (Configurações → Clientes) — o bot vai perguntar mesmo assim.');
        if (!connected(n.id, 'found'))
          add(n.id, 'warning', 'A saída "Cliente encontrado" não está ligada — o bot para depois de identificar.');
        if (!connected(n.id, 'not_found'))
          add(n.id, 'warning', 'A saída "Não encontrado" não está ligada — ligue a um cadastro ou a uma mensagem.');
        break;
      case 'crm_register':
      case 'crm_update': {
        const fields = d.fields || [];
        if (!fields.length) add(n.id, 'error', 'Adicione pelo menos um campo para perguntar.');
        const seen = new Set();
        fields.forEach((f, i) => {
          const label = `Campo ${i + 1}`;
          if (isBlank(f.key)) add(n.id, 'error', `${label}: escolha o que perguntar.`);
          else if (seen.has(f.key)) add(n.id, 'warning', `${label}: o campo "${f.key}" aparece mais de uma vez.`);
          seen.add(f.key);
          const meta = registerFieldMeta(f.key, customFields || []);
          if (meta.custom && isBlank(f.label) && (!customFields || meta.missing))
            add(
              n.id,
              meta.missing && customFields ? 'warning' : 'error',
              `${label}: o campo personalizado "${f.key.slice(7)}" ${meta.missing && customFields ? 'não existe mais em Configurações → Clientes' : 'precisa de um rótulo'}.`
            );
        });
        if (n.type === 'crm_register' && !connected(n.id, 'done'))
          add(n.id, 'warning', 'A saída "Cadastro concluído" não está ligada — o bot para depois do cadastro.');
        if (n.type === 'crm_register')
          askedNote(
            n.id,
            'customer',
            fields
              .map((f) => String(f?.key || ''))
              .filter((k) => k.startsWith('custom.'))
              .map((k) => k.slice(7).toLowerCase())
          );
        if (n.type === 'crm_update' && !connected(n.id, 'out'))
          add(n.id, 'warning', 'A saída "Depois" não está ligada — o bot para depois de atualizar.');
        break;
      }
      case 'crm_subscribe': {
        const pid = d.product_id || 'choose';
        if (pid !== 'choose' && pid !== 'from_var' && prodIds && !prodIds.has(pid))
          add(n.id, 'error', 'O produto escolhido não existe mais (ou está inativo). Escolha outro.');
        if (pid === 'choose' && products && !productsFor(products, d.product_ids).length)
          add(n.id, 'warning', 'Nenhum produto ativo para o cliente escolher — cadastre em WhatsApp → Produtos.');
        if (pid === 'choose' && prodIds && (d.product_ids || []).some((id) => !prodIds.has(id)))
          add(n.id, 'warning', 'Um dos produtos do filtro não existe mais (ou está inativo).');
        if (pid === 'from_var' && !(nodes || []).some((x) => x.type === 'menu' && x.data?.source === 'products'))
          add(n.id, 'warning', 'Produto "escolhido num menu antes" sem nenhum menu de produtos no fluxo — o bloco vai falhar.');
        if (d.charge_now !== false && (d.method === 'pix' || d.method === 'ask') && gateway && gateway.ready === false)
          add(n.id, 'warning', 'O gateway PIX não está configurado (Configurações → Pagamentos).');
        if (d.charge_now !== false && !connected(n.id, 'paid'))
          add(n.id, 'warning', 'A saída "Pagou" não está ligada — o que acontece depois do pagamento?');
        if (d.charge_now === false && !connected(n.id, 'subscribed'))
          add(n.id, 'warning', 'A saída "Assinou (sem cobrança)" não está ligada.');
        break;
      }
      case 'crm_info':
        if (d.what === 'custom' && isBlank(d.template))
          add(n.id, 'error', 'Escreva o texto personalizado (use as variáveis {{cliente.*}}, {{assinatura.*}}…).');
        if (!connected(n.id, 'out')) add(n.id, 'warning', 'A saída "Depois" não está ligada — o bot para depois de informar.');
        break;
      case 'crm_invoice':
        if (!connected(n.id, 'sent')) add(n.id, 'warning', 'A saída "2ª via enviada" não está ligada — o bot para depois de enviar.');
        break;
      case 'crm_cancel':
        if (!connected(n.id, 'canceled') && !connected(n.id, 'kept'))
          add(n.id, 'warning', 'Ligue as saídas "Cancelou" e "Manteve" ao próximo passo.');
        break;
      case 'crm_pause':
        if (!(Number(d.max_days) >= 1)) add(n.id, 'error', 'O máximo de dias precisa ser pelo menos 1.');
        if (!connected(n.id, 'paused')) add(n.id, 'warning', 'A saída "Pausou" não está ligada — o bot para depois de pausar.');
        break;
      case 'crm_change_plan':
        if (prodIds && (d.product_ids || []).some((id) => !prodIds.has(id)))
          add(n.id, 'warning', 'Um dos produtos do filtro não existe mais (ou está inativo).');
        if (products && productsFor(products, d.product_ids).length < 2)
          add(n.id, 'warning', 'Com menos de 2 produtos ativos não há para onde trocar.');
        if (!connected(n.id, 'changed')) add(n.id, 'warning', 'A saída "Trocou" não está ligada — o bot para depois da troca.');
        break;
      case 'book_service': {
        const ids = d.services || [];
        if (bookServices && !bookServices.length)
          add(
            n.id,
            'warning',
            'Nenhum serviço para agendar — cadastre em WhatsApp → Produtos (tipo Serviço) e os profissionais em Recursos.'
          );
        if (svcIds && ids.some((id) => !svcIds.has(id)))
          add(n.id, 'warning', 'Um dos serviços escolhidos não existe mais (ou está inativo).');
        if (svcIds && ids.length && !ids.some((id) => svcIds.has(id)))
          add(n.id, 'error', 'Nenhum dos serviços escolhidos está disponível — o bloco sempre cairia em "Sem horário livre".');
        const chosen = bookServices ? bookServices.filter((x) => !ids.length || ids.includes(x.id)) : [];
        if (chosen.some((x) => ['on_booking', 'deposit'].includes(x.booking?.payment)) && gateway && gateway.ready === false)
          add(n.id, 'warning', 'Há serviço que cobra na reserva, mas o gateway PIX não está configurado (Configurações → Pagamentos).');
        if (!connected(n.id, 'booked')) add(n.id, 'warning', 'A saída "Agendou" não está ligada — o bot para depois de agendar.');
        if (!connected(n.id, 'no_slots'))
          add(n.id, 'info', 'Sem horário livre o bot avisa e encerra — você pode ligar essa saída a uma "Lista de espera".');
        break;
      }
      case 'my_appointments':
        if (!connected(n.id, 'out'))
          add(n.id, 'warning', 'A saída "Depois" não está ligada — o bot encerra depois de confirmar/remarcar/cancelar.');
        if (d.allow_confirm === false && d.allow_reschedule === false && d.allow_cancel === false)
          add(n.id, 'info', 'Nenhuma ação liberada: o bloco só mostra os agendamentos.');
        break;
      case 'open_ticket': {
        const c = String(d.category || 'ask');
        if (c === 'ask') {
          if (activeCats && !activeCats.length)
            add(n.id, 'error', 'Nenhuma categoria de chamado ativa — ative uma em WhatsApp → Chamados → Configurações.');
        } else if (!TICKET_KEY_RE.test(c)) add(n.id, 'error', 'Escolha uma categoria válida.');
        else if (ticketCats) {
          const cat = ticketCats.find((x) => x.key === c);
          if (!cat) add(n.id, 'error', 'A categoria escolhida não existe mais — escolha outra ou "Perguntar ao cliente".');
          else if (cat.active === false)
            add(n.id, 'error', `A categoria “${cat.label}” está desativada — o bloco sempre cairia em "Deu erro".`);
        }
        if (!connected(n.id, 'out'))
          add(n.id, 'warning', 'A saída "Chamado aberto" não está ligada — o bot encerra depois de mostrar o protocolo.');
        askedNote(n.id, 'ticket');
        break;
      }
      case 'order_cart': {
        const cats = d.categories ?? 'all';
        if (cats !== 'all') {
          if (!Array.isArray(cats) || !cats.length) add(n.id, 'error', 'Escolha as categorias do catálogo (ou “Todas”).');
          else if (catalogKeys && catalogKeys.size) {
            const gone = cats.filter((c) => !catalogKeys.has(catKey(c)));
            if (gone.length === cats.length)
              add(
                n.id,
                'error',
                `Nenhuma das categorias escolhidas existe no catálogo (${gone.join(', ')}) — o bloco sempre cairia em "Deu erro".`
              );
            else if (gone.length) add(n.id, 'error', `Categoria que não existe mais no catálogo: ${gone.join(', ')}. Tire-a da lista.`);
          }
        }
        if (catalogCats && !catalogCats.length)
          add(n.id, 'warning', 'Nenhum produto avulso ativo no catálogo — cadastre em WhatsApp → Produtos (tipo Produto, com categoria).');
        if (d.allow_delivery === false && d.allow_pickup === false) add(n.id, 'error', 'Permita entrega, retirada ou as duas.');
        if (!['ask', 'pix', 'on_delivery'].includes(String(d.payment ?? 'ask'))) add(n.id, 'error', 'Forma de pagamento inválida.');
        if (d.payment === 'pix' && gateway && gateway.ready === false)
          add(n.id, 'warning', 'O pedido só aceita PIX, mas o gateway PIX não está configurado (Configurações → Pagamentos).');
        if (d.payment !== 'on_delivery' && !connected(n.id, 'paid'))
          add(n.id, 'info', 'A saída "Pago" não está ligada — o bot avisa que o pagamento caiu e encerra.');
        if (d.payment !== 'pix' && !connected(n.id, 'out'))
          add(n.id, 'info', 'A saída "Pedido feito (pagar na entrega)" não está ligada — o bot mostra o pedido e encerra.');
        askedNote(n.id, 'order');
        break;
      }
      case 'my_orders':
        if (d.show != null && d.show !== 'open' && d.show !== 'all') add(n.id, 'error', 'Escolha quais pedidos mostrar.');
        if (!connected(n.id, 'none'))
          add(n.id, 'info', 'Sem pedidos o bot avisa e encerra — você pode ligar "Sem pedidos" a um bloco "Fazer pedido".');
        break;
      case 'my_tickets':
        if (!connected(n.id, 'out')) add(n.id, 'info', 'A saída "Depois" não está ligada — o bot encerra depois de mostrar o chamado.');
        if (!connected(n.id, 'none'))
          add(n.id, 'info', 'Sem chamados o bot avisa e encerra — você pode ligar "Sem chamados" a um bloco "Abrir chamado".');
        break;
      case 'waitlist_join':
        if (d.product_id === 'current' && !(nodes || []).some((x) => x.type === 'book_service'))
          add(n.id, 'info', 'Sem um bloco "Agendar" antes, o bot vai perguntar o serviço.');
        if (svcIds && isUuid(d.product_id) && !svcIds.has(d.product_id))
          add(n.id, 'error', 'O serviço escolhido não existe mais (ou está inativo).');
        break;
      default:
        break;
    }
    if (
      !identityNoted &&
      isCrmType(n.type) &&
      n.type !== 'crm_identify' &&
      n.type !== 'crm_register' &&
      !(nodes || []).some((x) => x.type === 'crm_identify') &&
      crmSettings?.identity?.require_doc
    ) {
      identityNoted = true;
      add(
        n.id,
        'info',
        'A organização exige documento, mas o fluxo não tem o bloco "Identificar cliente" — os blocos de cliente usarão o cadastro do número.'
      );
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
