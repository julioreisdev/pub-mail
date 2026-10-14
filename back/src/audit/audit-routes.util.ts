// ============================================================================
// Auditoria da organização (Fase 8, contrato §12.4) — mapa de rotas PURO (sem Nest/Prisma; testável em Node:
// `node docs/tools/audit_routes_test.mjs`).
//
// `auditRouteFor(method, path)` → { entity, entityId, verb, action, customerId, actor } ou null (não audita).
// Só ESCRITAS (POST/PUT/PATCH/DELETE) sob /whatsapp/*, /api/v1/whatsapp/*, /payments/settings*,
// /system-settings*, /organizations*, /users*, /org/* — menos as rotas ruidosas (envio no chat, lido/digitando,
// simulador do bot, upload de mídia, ações de linha da fila…). `summaryFor` monta o texto em português.
// ============================================================================

export type AuditActor = 'user' | 'api';
export type AuditRoute = {
  entity: string;
  entityId: string | null;
  verb: string; // create | update | delete | verbo da rota (cancel, pause, change-plan…)
  action: string; // `<entidade>.<verbo>` (máx. 64)
  customerId: string | null; // cliente dono do registro, quando a rota diz (customers/:id/…)
  actor: AuditActor;
};

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ---------------------------------------------------------------- entidades (artigo + rótulo da tela)
type EntityMeta = { the: string; label: string };
export const ENTITY_META: Record<string, EntityMeta> = {
  customers: { the: 'o cliente', label: 'Clientes' },
  products: { the: 'o produto', label: 'Produtos' },
  subscriptions: { the: 'a assinatura', label: 'Assinaturas' },
  charges: { the: 'a cobrança', label: 'Cobranças' },
  coupons: { the: 'o cupom', label: 'Cupons' },
  units: { the: 'a unidade', label: 'Unidades' },
  orders: { the: 'o pedido', label: 'Pedidos' },
  tickets: { the: 'o chamado', label: 'Chamados' },
  appointments: { the: 'o agendamento', label: 'Agendamentos' },
  resources: { the: 'o recurso da agenda', label: 'Recursos da agenda' },
  blocks: { the: 'o bloqueio da agenda', label: 'Bloqueios da agenda' },
  waitlist: { the: 'a lista de espera', label: 'Lista de espera' },
  'bot.flows': { the: 'o fluxo do bot', label: 'Fluxos do bot' },
  sessions: { the: 'o número', label: 'Números' },
  'crm-settings': { the: 'as configurações do CRM', label: 'Configurações do CRM' },
  'service-settings': { the: 'as configurações de atendimento', label: 'Configurações de atendimento' },
  'charges.settings': { the: 'as configurações de cobrança', label: 'Configurações de cobrança' },
  'scheduling.settings': { the: 'as configurações da agenda', label: 'Configurações da agenda' },
  'tickets.settings': { the: 'as configurações de chamados', label: 'Configurações de chamados' },
  'orders.settings': { the: 'as configurações de pedidos', label: 'Configurações de pedidos' },
  'payments.settings': { the: 'o gateway de pagamento', label: 'Gateway de pagamento' },
  'system-settings': { the: 'as integrações', label: 'Integrações' },
  templates: { the: 'o modelo de ramo', label: 'Modelos de ramo' },
  tags: { the: 'a etiqueta', label: 'Etiquetas' },
  'quick-replies': { the: 'a resposta rápida', label: 'Respostas rápidas' },
  broadcasts: { the: 'o broadcast', label: 'Broadcasts' },
  schedules: { the: 'o agendamento de mensagem', label: 'Agendamentos de mensagem' },
  statuses: { the: 'o status', label: 'Status' },
  'chat-filters': { the: 'o filtro de conversas', label: 'Filtros de conversa' },
  contacts: { the: 'o contato', label: 'Contatos' },
  tasks: { the: 'a tarefa', label: 'Tarefas' },
  notes: { the: 'a nota', label: 'Notas' },
  pipeline: { the: 'o funil', label: 'Funil' },
  'pipeline.stages': { the: 'a etapa do funil', label: 'Etapas do funil' },
  'pipeline.automation': { the: 'a automação do funil', label: 'Automação do funil' },
  chats: { the: 'a conversa', label: 'Conversas' },
  outbox: { the: 'a fila de envios', label: 'Fila de envios' },
  imports: { the: 'a importação', label: 'Importações' },
  entitlements: { the: 'o direito de acesso', label: 'Direitos de acesso' },
  groups: { the: 'o grupo', label: 'Grupos' },
  'payment-methods': { the: 'o cartão salvo', label: 'Cartões salvos' },
  'custom-fields': { the: 'os campos personalizados', label: 'Campos personalizados' },
  finance: { the: 'o financeiro', label: 'Financeiro' },
  organizations: { the: 'a organização', label: 'Organização' },
  users: { the: 'o usuário', label: 'Usuários' },
  'api-keys': { the: 'a chave de API', label: 'Chaves de API' },
  webhooks: { the: 'o webhook', label: 'Webhooks' },
};

export function entityLabel(entity: string | null | undefined): string {
  if (!entity) return '—';
  return ENTITY_META[entity]?.label || entity;
}

// ---------------------------------------------------------------- rotas ruidosas (nunca auditadas)
// Testadas contra o caminho RELATIVO à base do WhatsApp (sem "/whatsapp/" ou "/api/v1/whatsapp/").
const WA_SKIP: RegExp[] = [
  /^messages(\/|$)/, // envio/edição/reação no chat e POST /api/v1/whatsapp/messages
  /^chats\/[^/]+\/(read|typing|archive|pin|mute|service|bot)$/,
  /^chats\/(open|sync)$/,
  /^photo\/refresh$/,
  /^bot\/simulate$/,
  /^media$/, // upload de mídia
  /^contacts\/sync$/,
  /^contact-statuses(\/|$)/,
  /^customers\/[^/]+\/subscriptions\/preview$/,
  /^customers\/[^/]+\/(erase|export)$/, // LGPD: o serviço de privacidade grava a auditoria ele mesmo
  /^coupons\/validate$/,
  /^broadcasts\/audience-estimate$/,
  /^charges\/[^/]+\/check$/,
  /^sessions\/[^/]+\/(test|bootstrap|pairing-code)$/,
  /^outbox\/(?!sessions\/|rate$|retry-failed$|cancel-pending$)[^/]+\/(retry|cancel)$/, // linha a linha da fila
  /^link-preview(\/|$)/,
  /^audit(\/|$)/,
];

// ---------------------------------------------------------------- regras explícitas (ordem importa)
// `p` = padrão de segmentos (":x" = qualquer valor); `e` = entidade; `id`/`cust` = índice do segmento;
// `v` = verbo fixo (string) ou por método ({POST:'…'}); sem `v` = create/update/delete pelo método.
type Rule = { p: string; e: string; id?: number; cust?: number; v?: string | Partial<Record<string, string>> };
const RULES: Rule[] = [
  { p: 'customers/import', e: 'customers', v: 'import' },
  { p: 'customers/:x/contacts/:x', e: 'customers', id: 1, cust: 1, v: { PATCH: 'contacts.update', PUT: 'contacts.update', DELETE: 'contacts.delete' } },
  { p: 'customers/:x/contacts', e: 'customers', id: 1, cust: 1, v: 'contacts.create' },
  { p: 'customers/:x/subscriptions/:x', e: 'subscriptions', id: 3, cust: 1 },
  { p: 'customers/:x/subscriptions', e: 'subscriptions', cust: 1, v: 'create' },
  { p: 'customers/:x/payment-methods/:x', e: 'payment-methods', id: 3, cust: 1, v: 'delete' },
  { p: 'charges/settings', e: 'charges.settings', v: 'update' },
  { p: 'charges/run-daily', e: 'charges', v: 'run-daily' },
  { p: 'charges/:x/payment-methods/:x', e: 'payment-methods', id: 3, v: 'delete' },
  { p: 'bot/flows/:x/active', e: 'bot.flows', id: 2, v: 'active' },
  { p: 'bot/flows/:x/sessions', e: 'bot.flows', id: 2, v: 'sessions' },
  { p: 'bot/flows/:x', e: 'bot.flows', id: 2 },
  { p: 'bot/flows', e: 'bot.flows', v: 'create' },
  { p: 'pipeline/stages/reorder', e: 'pipeline.stages', v: 'reorder' },
  { p: 'pipeline/stages/:x', e: 'pipeline.stages', id: 2 },
  { p: 'pipeline/stages', e: 'pipeline.stages', v: 'create' },
  { p: 'pipeline/automation', e: 'pipeline.automation', v: 'update' },
  { p: 'pipeline/move', e: 'pipeline', v: 'move' },
  { p: 'pipeline/deal', e: 'pipeline', v: 'deal' },
  { p: 'scheduling/settings', e: 'scheduling.settings', v: 'update' },
  { p: 'scheduling/resources/reorder', e: 'resources', v: 'reorder' },
  { p: 'scheduling/resources/:x/blocks/:x', e: 'resources', id: 2, v: 'blocks.delete' },
  { p: 'scheduling/resources/:x/blocks', e: 'resources', id: 2, v: 'blocks.create' },
  { p: 'scheduling/resources/:x/ics-link/rotate', e: 'resources', id: 2, v: 'ics.rotate' },
  { p: 'scheduling/resources/:x', e: 'resources', id: 2 },
  { p: 'scheduling/resources', e: 'resources', v: 'create' },
  { p: 'scheduling/blocks/:x', e: 'blocks', id: 2 },
  { p: 'scheduling/blocks', e: 'blocks', v: 'create' },
  { p: 'scheduling/appointments/:x/:x', e: 'appointments', id: 2 }, // verbo = último segmento (genérico abaixo)
  { p: 'scheduling/appointments/:x', e: 'appointments', id: 2 },
  { p: 'scheduling/appointments', e: 'appointments', v: 'create' },
  { p: 'scheduling/waitlist/:x/offer', e: 'waitlist', id: 2, v: 'offer' },
  { p: 'scheduling/waitlist/:x', e: 'waitlist', id: 2 },
  { p: 'scheduling/waitlist', e: 'waitlist', v: 'create' },
  { p: 'tickets/settings', e: 'tickets.settings', v: 'update' },
  { p: 'orders/settings', e: 'orders.settings', v: 'update' },
  { p: 'chats/:x/notes/:x', e: 'notes', id: 3 },
  { p: 'chats/:x/notes', e: 'notes', v: 'create' },
  { p: 'chats/:x/tags', e: 'chats', id: 1, v: 'tags' },
  { p: 'outbox/sessions/:x/:x', e: 'outbox', id: 2 }, // pause | resume | rate (por número)
  { p: 'outbox/rate', e: 'outbox', v: 'rate' },
  { p: 'outbox/retry-failed', e: 'outbox', v: 'retry-failed' },
  { p: 'outbox/cancel-pending', e: 'outbox', v: 'cancel-pending' },
  { p: 'sessions/reorder', e: 'sessions', v: 'reorder' },
  { p: 'sessions/purge', e: 'sessions', v: 'purge' },
  { p: 'sessions/:x/profile/picture', e: 'sessions', id: 1, v: { PUT: 'profile.picture', DELETE: 'profile.picture.delete' } },
  { p: 'templates/:x/apply', e: 'templates', id: 1, v: 'apply' },
  { p: 'entitlements/sync', e: 'entitlements', v: 'sync' },
  { p: 'broadcasts/:x/runs/:x/:x', e: 'broadcasts', id: 1 }, // runs.pause | runs.resume
  { p: 'crm-settings', e: 'crm-settings', v: 'update' },
  { p: 'service-settings', e: 'service-settings', v: 'update' },
];

// palavras que, no 2º segmento, são AÇÃO da coleção (não id)
const COLLECTION_WORDS = new Set(['reorder', 'sync', 'bulk', 'import', 'settings', 'rate', 'validate', 'run-daily', 'retry-failed', 'cancel-pending', 'purge', 'export']);
const ID_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24,40}|\d+)$/i;

const methodVerb = (m: string) => (m === 'POST' ? 'create' : m === 'DELETE' ? 'delete' : 'update');
/** Verbo de uma ação no fim da rota (`:id/cancel`): conhecido = ele mesmo; POST = ele mesmo; senão `<ação>.<update|delete>`. */
const tailVerb = (tail: string, m: string) => (VERBS[tail] || m === 'POST' ? tail : `${tail}.${methodVerb(m)}`);
const clean = (s: string) => String(s || '').slice(0, 64);

function matchRule(segs: string[], p: string): boolean {
  const ps = p.split('/');
  if (ps.length !== segs.length) return false;
  return ps.every((x, i) => x === ':x' || x === segs[i]);
}

function make(entity: string, entityId: string | null, verb: string, customerId: string | null, actor: AuditActor): AuditRoute {
  const v = verb || 'update';
  return { entity, entityId: entityId ? clean(entityId) : null, verb: v, action: clean(`${entity}.${v}`), customerId: customerId ? clean(customerId) : null, actor };
}

/** Rotas do WhatsApp (painel e API v1) — `rest` = segmentos depois de `/whatsapp/`. */
function whatsappRoute(method: string, rest: string[], actor: AuditActor): AuditRoute | null {
  if (!rest.length) return null;
  const joined = rest.join('/');
  if (WA_SKIP.some((re) => re.test(joined))) return null;
  for (const r of RULES) {
    if (!matchRule(rest, r.p)) continue;
    let verb: string;
    if (typeof r.v === 'string') verb = r.v;
    else if (r.v && r.v[method]) verb = r.v[method] as string;
    else if (r.p.endsWith('/:x/:x')) verb = r.p.startsWith('broadcasts/') ? `runs.${rest[rest.length - 1]}` : tailVerb(rest[rest.length - 1], method);
    else verb = methodVerb(method);
    return make(r.e, r.id != null ? rest[r.id] : null, verb, r.cust != null ? rest[r.cust] : null, actor);
  }
  // genérico: <entidade>[/<id>][/<verbo…>]
  const entity = rest[0];
  if (rest.length === 1) return make(entity, null, methodVerb(method), null, actor);
  const second = rest[1];
  const secondIsId = !COLLECTION_WORDS.has(second) && (ID_RE.test(second) || method !== 'POST' || rest.length > 2);
  if (rest.length === 2) {
    return secondIsId ? make(entity, second, methodVerb(method), null, actor) : make(entity, null, second, null, actor);
  }
  if (!secondIsId) return make(entity, null, rest.slice(1).join('.'), null, actor);
  return make(entity, second, tailVerb(rest.slice(2).join('.'), method), null, actor);
}

/**
 * Rota auditável? `path` sem query (aceita com query também). Devolve null para leituras, rotas fora do escopo
 * e rotas ruidosas.
 */
export function auditRouteFor(methodIn: string, pathIn: string): AuditRoute | null {
  const method = String(methodIn || '').toUpperCase();
  if (!WRITE.has(method)) return null;
  const path = String(pathIn || '').split('?')[0].replace(/\/+$/, '');
  const segs = path.split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
  if (!segs.length) return null;
  if (segs[0] === 'api' && segs[1] === 'v1' && segs[2] === 'whatsapp') return whatsappRoute(method, segs.slice(3), 'api');
  if (segs[0] === 'whatsapp') return whatsappRoute(method, segs.slice(1), 'user');
  if (segs[0] === 'payments') {
    if (segs[1] !== 'settings' || segs.length !== 2) return null; // webhook e "testar" ficam de fora
    return make('payments.settings', null, 'update', null, 'user');
  }
  if (segs[0] === 'system-settings') {
    if (segs.length === 1) return make('system-settings', null, 'update', null, 'user');
    if (segs[1] === 'ai-keys') return make('system-settings', null, method === 'DELETE' ? 'ai-keys.remove' : 'ai-keys.add', null, 'user');
    return make('system-settings', null, segs.slice(1).join('.'), null, 'user');
  }
  if (segs[0] === 'organizations') {
    const id = segs[1] && segs[1] !== 'me' ? segs[1] : null;
    return make('organizations', id, segs.length > 2 ? segs.slice(2).join('.') : methodVerb(method), null, 'user');
  }
  if (segs[0] === 'users') {
    if (segs.length === 1) return make('users', null, methodVerb(method), null, 'user');
    return make('users', segs[1], segs.length > 2 ? segs.slice(2).join('.') : methodVerb(method), null, 'user');
  }
  if (segs[0] === 'org' && (segs[1] === 'api-keys' || segs[1] === 'webhooks')) {
    const entity = segs[1];
    const rest = segs.slice(2);
    if (entity === 'webhooks' && (rest[0] === 'deliveries' || rest[rest.length - 1] === 'test')) return null;
    if (!rest.length) return make(entity, null, methodVerb(method), null, 'user');
    if (rest.length === 1) return make(entity, rest[0], methodVerb(method), null, 'user');
    return make(entity, rest[0], rest.slice(1).join('.'), null, 'user');
  }
  return null;
}

// ---------------------------------------------------------------- resumo em português
// {the} = "o produto"; {de} = "do produto"; {em} = "no produto"; {a} = "ao produto"; {L} = rótulo plural em minúsculas
const VERBS: Record<string, string> = {
  create: 'Criou {the}',
  update: 'Alterou {the}',
  delete: 'Apagou {the}',
  cancel: 'Cancelou {the}',
  pause: 'Pausou {the}',
  resume: 'Retomou {the}',
  reactivate: 'Reativou {the}',
  'change-plan': 'Trocou o plano {de}',
  'mark-paid': 'Deu baixa manual {em}',
  resend: 'Reenviou {the}',
  'reconcile-fix': 'Corrigiu a conciliação {de}',
  reorder: 'Reordenou {L}',
  import: 'Importou {L}',
  'run-daily': 'Rodou a rotina diária de cobranças',
  sync: 'Sincronizou {L}',
  bulk: 'Alterou {L} em massa',
  retry: 'Tentou de novo {the}',
  'retry-failed': 'Reenviou as falhas da fila de envios',
  'cancel-pending': 'Cancelou os envios pendentes da fila',
  rate: 'Alterou o ritmo {de}',
  confirm: 'Confirmou {the}',
  start: 'Iniciou {the}',
  stop: 'Parou {the}',
  done: 'Concluiu {the}',
  reopen: 'Reabriu {the}',
  'no-show': 'Marcou falta {em}',
  reschedule: 'Remarcou {the}',
  charge: 'Gerou cobrança {de}',
  offer: 'Ofereceu vaga {em}',
  apply: 'Aplicou {the}',
  assign: 'Atribuiu {the}',
  comments: 'Comentou {em}',
  status: 'Mudou a situação {de}',
  active: 'Ligou/desligou {the}',
  sessions: 'Alterou os números {de}',
  purge: 'Apagou os dados {de}',
  logout: 'Desconectou {the}',
  'switch-engine': 'Trocou o motor {de}',
  pacing: 'Alterou o aquecimento {de}',
  profile: 'Alterou o perfil {de}',
  'profile.picture': 'Alterou a foto {de}',
  'profile.picture.delete': 'Removeu a foto {de}',
  fire: 'Disparou {the}',
  copies: 'Alterou as copies {de}',
  'send-now': 'Enviou agora {the}',
  tags: 'Alterou as etiquetas {de}',
  move: 'Moveu uma conversa no funil',
  deal: 'Alterou o valor de negócio no funil',
  'contacts.create': 'Vinculou um número {a}',
  'contacts.update': 'Mudou o papel de um número {de}',
  'contacts.delete': 'Desvinculou um número {de}',
  'ai-keys.add': 'Adicionou chave de IA nas integrações',
  'ai-keys.remove': 'Removeu chave de IA das integrações',
  'blocks.create': 'Criou um bloqueio {em}',
  'blocks.delete': 'Removeu um bloqueio {de}',
  'ics.rotate': 'Gerou novo link da agenda {de}',
  'runs.pause': 'Pausou um disparo {de}',
  'runs.resume': 'Retomou um disparo {de}',
  'rotate-secret': 'Gerou novo segredo {de}',
  rotate: 'Gerou nova chave {de}',
  erase: 'Apagou os dados pessoais (LGPD) {de}',
  export: 'Exportou os dados pessoais (LGPD) {de}',
  'payment-methods.delete': 'Removeu um cartão salvo {de}',
};

const contract = (the: string, prep: 'de' | 'em' | 'a') => {
  const m = /^(o|a|os|as)\s+(.*)$/.exec(the);
  if (!m) return `${prep === 'a' ? 'a' : prep} ${the}`;
  const art = m[1];
  const map: Record<string, Record<string, string>> = {
    de: { o: 'do', a: 'da', os: 'dos', as: 'das' },
    em: { o: 'no', a: 'na', os: 'nos', as: 'nas' },
    a: { o: 'ao', a: 'à', os: 'aos', as: 'às' },
  };
  return `${map[prep][art]} ${m[2]}`;
};

/** "Alterou o produto “Plano X”" — `name` opcional (nome/título do registro). */
export function summaryFor(route: Pick<AuditRoute, 'entity' | 'verb'>, name?: string | null): string {
  const meta = ENTITY_META[route.entity] || { the: `o registro (${route.entity})`, label: route.entity };
  const tpl = VERBS[route.verb] || `Executou “${route.verb}” {em}`;
  let s = tpl
    .replace('{the}', meta.the)
    .replace('{de}', contract(meta.the, 'de'))
    .replace('{em}', contract(meta.the, 'em'))
    .replace('{a}', contract(meta.the, 'a'))
    .replace('{L}', meta.label.toLowerCase());
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (n && tpl.includes('{')) s += ` “${n.length > 80 ? `${n.slice(0, 79)}…` : n}”`;
  return s.slice(0, 255);
}

// ---------------------------------------------------------------- saneamento (mascarar sensíveis + teto de tamanho)
// `document_id` (CNPJ/CPF da organização), `document`/`cpf`/`cnpj` também ficam mascarados (revisão 14/10/2026, A-17)
const SENSITIVE_RE = /(^doc$|^doc_hash$|^document(_id)?$|^cpf$|^cnpj$|^cpf_cnpj$|token|secret|password|passwd|^keys?$|_key$|apikey|api_key|^card|cvv|signature|^authorization$|pix_code)/i;
export const AUDIT_MAX_BYTES = 8 * 1024;
export const MASK = '••••';

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_RE.test(String(key || ''));
}

/** Clona tirando segredos (strings sensíveis viram "••••"), corta strings longas, listas e profundidade. */
export function sanitize(value: unknown, depth = 0, keyName = ''): unknown {
  if (keyName && isSensitiveKey(keyName)) {
    if (value == null || value === '') return value ?? null;
    if (typeof value === 'string' || typeof value === 'number' || Array.isArray(value)) return MASK;
    if (typeof value === 'object') return MASK;
  }
  if (value == null) return null;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 499)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return `[arquivo ${value.length} bytes]`;
  if (depth >= 5) return '[…]';
  if (Array.isArray(value)) {
    const out = value.slice(0, 50).map((v) => sanitize(v, depth + 1));
    if (value.length > 50) out.push(`[+${value.length - 50} itens]`);
    return out;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (n++ >= 80) { out['…'] = 'mais campos omitidos'; break; }
      out[k] = sanitize(v, depth + 1, k);
    }
    return out;
  }
  return String(value);
}

/** Garante o teto de 8 KB do JSON gravado (corta e marca `truncated`). */
export function capJson(value: unknown, max = AUDIT_MAX_BYTES): unknown {
  let s: string;
  try { s = JSON.stringify(value); } catch { return { truncated: true }; }
  if (s === undefined) return null;
  if (Buffer.byteLength(s, 'utf8') <= max) return value;
  // tenta reduzir strings longas antes de desistir do objeto
  const shrink = (v: unknown, lim: number): unknown => {
    if (typeof v === 'string') return v.length > lim ? `${v.slice(0, lim)}…` : v;
    if (Array.isArray(v)) return v.slice(0, 20).map((x) => shrink(x, lim));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shrink(x, lim)]));
    return v;
  };
  for (const lim of [120, 40]) {
    const r = shrink(value, lim);
    const rs = JSON.stringify(r);
    if (Buffer.byteLength(rs, 'utf8') <= max) return r && typeof r === 'object' && !Array.isArray(r) ? { ...(r as object), truncated: true } : { value: r, truncated: true };
  }
  return { truncated: true, preview: s.slice(0, Math.floor(max / 2)) };
}

// ---------------------------------------------------------------- diferença antes × depois
const DIFF_IGNORE = new Set(['updated_at', 'created_at', 'organization_id', 'id']);

/** Campos que mudaram entre duas linhas do banco (sensíveis mascarados; JSON comparado por conteúdo). */
export function diffRows(before: Record<string, any> | null, after: Record<string, any> | null): Array<{ field: string; before: unknown; after: unknown }> {
  if (!before || !after) return [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !DIFF_IGNORE.has(k));
  const norm = (v: unknown) => {
    if (v instanceof Date) return v.toISOString();
    if (v && typeof v === 'object') { try { return JSON.stringify(v); } catch { return String(v); } }
    return v ?? null;
  };
  const out: Array<{ field: string; before: unknown; after: unknown }> = [];
  for (const k of keys) {
    if (norm(before[k]) === norm(after[k])) continue;
    if (isSensitiveKey(k)) out.push({ field: k, before: before[k] == null || before[k] === '' ? null : MASK, after: after[k] == null || after[k] === '' ? null : MASK });
    else out.push({ field: k, before: sanitize(before[k], 1), after: sanitize(after[k], 1) });
    if (out.length >= 60) break;
  }
  return out;
}

/** Nome "humano" de um registro para o resumo. */
export function recordName(row: any): string | null {
  if (!row || typeof row !== 'object') return null;
  for (const k of ['name', 'title', 'product_name', 'subject', 'protocol', 'code', 'label', 'service_name', 'description']) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 120);
  }
  if (typeof row.number === 'number') return `#${row.number}`;
  return null;
}
