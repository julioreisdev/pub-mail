// Módulos do Pub Mail que o superadmin libera POR USUÁRIO (users.modules).
// "Administração" não é módulo: é exclusivo do role SUPER_ADMIN.
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
