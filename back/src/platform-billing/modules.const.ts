// Módulos do Pub Mail que o superadmin libera POR USUÁRIO (users.modules).
// "Administração" não é módulo: é exclusivo do role SUPER_ADMIN.
/**
 * Caminho canônico para TODA checagem de acesso/auditoria: sem query, decodificado, minúsculo, barras repetidas
 * juntadas e sem barra no fim. O Express casa rotas sem diferenciar maiúsculas e aceita barra no fim — sem isto,
 * `/WhatsApp/finance` ou `/whatsapp/customers/` passavam pelo controller sem bater em nenhuma regra (auditoria 14/10/2026).
 */
export function normalizeApiPath(raw: string): string {
  let p = String(raw || '').split('?')[0].split('#')[0];
  try { p = decodeURIComponent(p); } catch { /* sequência inválida: segue como veio (o roteador também não casa) */ }
  p = p.toLowerCase().replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

export const MODULES = ['email', 'webchat', 'quiz', 'telegram', 'whatsapp', 'wordpress', 'settings'] as const;
export type ModuleKey = (typeof MODULES)[number];
export const ALL_MODULES: ModuleKey[] = [...MODULES];

export function normalizeModules(raw: unknown): ModuleKey[] {
  if (!Array.isArray(raw)) return [];
  const out: ModuleKey[] = [];
  for (const v of raw) {
    const k = String(v || '').trim().toLowerCase() as ModuleKey;
    if ((MODULES as readonly string[]).includes(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

// ---------------------------------------------------------------- sub-permissões (Fase 7, contrato §11.5)
// Guardadas em `users.modules` junto com os módulos. Só valem com `whatsapp`; OWNER/ADMIN/SUPER_ADMIN têm todas.
// `whatsapp:basic` = marcador "escolhi não dar nenhuma" (sem ele, quem tem `whatsapp` e nenhuma sub-permissão
// recebe as três — compatível com quem foi criado antes delas e com chamadas que mandam só `whatsapp`).
export const SUB_PERMISSIONS = ['whatsapp:finance', 'whatsapp:crm', 'whatsapp:settings'] as const;
export type SubPermission = (typeof SUB_PERMISSIONS)[number];
const SUB_MARKER = 'whatsapp:basic';
export const SUB_PERMISSION_LABELS: Record<SubPermission, string> = {
  'whatsapp:finance': 'Cobranças e financeiro',
  'whatsapp:crm': 'Clientes, produtos e assinaturas',
  'whatsapp:settings': 'Configurações do WhatsApp',
};

/** Sub-permissões efetivas de uma lista `users.modules` (sem `whatsapp` = nenhuma). */
export function normalizeSubPermissions(raw: unknown): SubPermission[] {
  if (!Array.isArray(raw)) return [];
  const list = raw.map((v) => String(v || '').trim().toLowerCase());
  if (!list.includes('whatsapp')) return [];
  const subs = SUB_PERMISSIONS.filter((p) => list.includes(p));
  if (!subs.length && !list.includes(SUB_MARKER)) return [...SUB_PERMISSIONS];
  return subs;
}

/** O que GRAVAR em `users.modules`: módulos + sub-permissões (+ marcador quando nenhuma). */
export function normalizeModuleList(raw: unknown): string[] {
  const mods: string[] = normalizeModules(raw);
  if (!mods.includes('whatsapp')) return mods;
  const subs = normalizeSubPermissions(raw);
  return [...mods, ...subs, ...(subs.length ? [] : [SUB_MARKER])];
}

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SUB_ANY: Array<[string, SubPermission]> = [
  ['/whatsapp/charges', 'whatsapp:finance'],
  ['/whatsapp/finance', 'whatsapp:finance'],
  ['/whatsapp/payment-methods', 'whatsapp:finance'],
  ['/whatsapp/coupons', 'whatsapp:crm'],
  ['/whatsapp/imports', 'whatsapp:crm'], // Fase 8: importação em segundo plano
  ['/whatsapp/entitlements', 'whatsapp:crm'], // acessos liberados do cliente (A-12)
];
// rotas com id no meio que mexem com dinheiro (casadas depois do `normalizeApiPath`, então sempre minúsculas)
const SUB_PATTERN: Array<[RegExp, SubPermission]> = [
  [/^\/whatsapp\/orders\/[^/]+\/mark-paid$/, 'whatsapp:finance'], // baixa manual do pedido liquida a cobrança
  [/^\/whatsapp\/customers\/[^/]+\/payment-methods(\/.*)?$/, 'whatsapp:finance'], // cartões salvos
];
// leituras com preço/valor (escrita continua na regra de SUB_WRITE)
const SUB_READ_PREFIX: Array<[string, SubPermission]> = [
  ['/whatsapp/subscriptions', 'whatsapp:crm'], // assinaturas fazem parte do CRM (a linha do tempo do cliente usa); os meios de pagamento ficam no finance
];
const SUB_WRITE: Array<[string, SubPermission]> = [
  ['/whatsapp/customers', 'whatsapp:crm'],
  ['/whatsapp/products', 'whatsapp:crm'],
  ['/whatsapp/subscriptions', 'whatsapp:crm'],
  ['/whatsapp/units', 'whatsapp:crm'],
  ['/whatsapp/crm-settings', 'whatsapp:crm'],
  ['/whatsapp/outbox', 'whatsapp:settings'], // Fase 8: ações da fila de envios
  ['/whatsapp/sessions', 'whatsapp:settings'],
  ['/whatsapp/bot/flows', 'whatsapp:settings'],
  ['/whatsapp/tags', 'whatsapp:settings'],
  ['/whatsapp/quick-replies', 'whatsapp:settings'],
  ['/whatsapp/service-settings', 'whatsapp:settings'],
  ['/whatsapp/scheduling/settings', 'whatsapp:settings'],
  ['/whatsapp/tickets/settings', 'whatsapp:settings'],
  ['/whatsapp/orders/settings', 'whatsapp:settings'],
  ['/whatsapp/templates', 'whatsapp:settings'],
  ['/whatsapp/pipeline/stages', 'whatsapp:settings'],
];
// leituras que são "a lista do CRM" (o painel do cliente dentro do chat usa by-chat/lookup e continua liberado)
const SUB_READ_EXACT: Array<[string, SubPermission]> = [
  ['/whatsapp/customers', 'whatsapp:crm'],
  ['/whatsapp/customers/export', 'whatsapp:crm'],
];

/** Sub-permissão exigida pela rota (null = nenhuma). `path` já normalizado (`normalizeApiPath`: minúsculo, sem barra no fim). */
export function subPermissionFor(path: string, method = 'GET'): SubPermission | null {
  const m = method.toUpperCase();
  for (const [prefix, perm] of SUB_ANY) if (startsWithSeg(path, prefix)) return perm;
  for (const [re, perm] of SUB_PATTERN) if (re.test(path)) return perm;
  if (m === 'GET') for (const [prefix, perm] of SUB_READ_PREFIX) if (startsWithSeg(path, prefix)) return perm;
  if (WRITE.has(m)) for (const [prefix, perm] of SUB_WRITE) if (startsWithSeg(path, prefix)) return perm;
  if (m === 'GET') for (const [exact, perm] of SUB_READ_EXACT) if (path === exact) return perm;
  return null;
}

// Prefixo de rota (sem query) → módulo exigido. Casamento por segmento
// (`/email` cobre `/email/...`, mas NÃO `/email-project-leads`, que tem entrada própria).
// Rotas fora do mapa (auth, dashboard, admin, access, posts legados…) não exigem módulo.
const ROUTE_MODULES: Array<[string, ModuleKey]> = [
  ['/email', 'email'],
  ['/email-project-leads', 'email'],
  ['/domains', 'email'],
  ['/webchats', 'webchat'],
  ['/webchat-domains', 'webchat'],
  ['/webchat-leads', 'webchat'],
  ['/webchat-splits', 'webchat'],
  ['/webchat-assets', 'webchat'],
  ['/agentes', 'webchat'],
  ['/ia', 'webchat'],
  ['/quizzes', 'quiz'],
  ['/quiz-domains', 'quiz'],
  ['/quiz-leads', 'quiz'],
  ['/quiz-splits', 'quiz'],
  ['/telegram', 'telegram'],
  ['/whatsapp', 'whatsapp'],
  ['/wordpress', 'wordpress'],
  ['/system-settings', 'settings'],
  ['/payments', 'settings'],
  ['/organizations', 'settings'],
  ['/users', 'settings'],
  ['/billing', 'settings'],
  ['/wallet', 'settings'],
  ['/transactions', 'settings'],
  ['/org', 'settings'], // chaves de API e webhooks de saída da organização (Fase 5); `/api/v1` não passa aqui (sem req.user)
];

// Rotas que NUNCA são bloqueadas por assinatura (fluxo de login/pagamento, admin, dashboard).
const OPEN_PREFIXES = ['/auth', '/access', '/admin', '/dashboard', '/profile', '/me', '/public', '/webhooks', '/uploads', '/team'];

// Leituras que módulos de outros grupos precisam (ex.: o construtor de funil do
// webchat lê `GET /payments/settings` só pra saber se o gateway está pronto —
// resposta sem token). Não exigem o módulo `settings`.
const MODULE_EXEMPT_GET = ['/payments/settings'];

const startsWithSeg = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

export function isOpenPath(path: string): boolean {
  return OPEN_PREFIXES.some((p) => startsWithSeg(path, p));
}

export function moduleForPath(path: string, method = 'GET'): ModuleKey | null {
  if (method.toUpperCase() === 'GET' && MODULE_EXEMPT_GET.some((p) => path === p)) return null;
  for (const [prefix, mod] of ROUTE_MODULES) if (startsWithSeg(path, prefix)) return mod;
  return null;
}

export const MODULE_LABELS: Record<ModuleKey, string> = {
  email: 'E-mail Marketing',
  webchat: 'Webchat',
  quiz: 'Quizzes',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  wordpress: 'WordPress',
  settings: 'Configurações',
};
