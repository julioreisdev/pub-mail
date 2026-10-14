import axios from 'axios';

/**
 * ============================
 * Axios instance
 * ============================
 */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * ============================
 * Sessão (storage)
 * ============================
 * Chaves: 'token' (access), 'refreshToken', 'user'.
 */

const SESSION_KEYS = ['token', 'refreshToken', 'user'];

export function getAccessToken() {
  return localStorage.getItem('token') || '';
}

export function getRefreshToken() {
  return localStorage.getItem('refreshToken') || '';
}

export function storeTokens(tokens) {
  if (tokens?.accessToken) localStorage.setItem('token', tokens.accessToken);
  if (tokens?.refreshToken) localStorage.setItem('refreshToken', tokens.refreshToken);
}

export function clearStoredSession() {
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
}

/**
 * ============================
 * Interceptors
 * ============================
 */

// Request interceptor (ex: token)
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ---- Refresh de sessão no 401 (uma vez, com fila) ----
//
// Contrato do back (auth.controller.ts):
//   POST /auth/refresh  body { refreshToken }
//   → 200 { tokens: { accessToken, refreshToken, accessExpiresIn, refreshExpiresIn } }  (rotação)
//   → 401 se o refresh token for inválido/revogado
//
// Fluxo: 1º 401 de uma request "normal" dispara UM refresh; as demais que
// falharem enquanto ele roda entram na fila e são reexecutadas com o token
// novo. Se o refresh falhar → limpa sessão e manda pro /login.
// Endpoints /auth/* (login/refresh/logout) nunca disparam refresh (evita loop).

const AUTH_PATH_RE = /(^|\/)auth\/(login|refresh|register|logout)(\?|$)/;

let refreshPromise = null;

function isAuthEndpoint(config) {
  const url = String(config?.url || '');
  return AUTH_PATH_RE.test(url);
}

function redirectToLogin() {
  clearStoredSession();
  const path = window.location.pathname || '';
  if (path.startsWith('/login')) return;
  // rotas públicas (webchat/quiz/legal/pagamento) nunca são redirecionadas
  if (/^\/(webchat|quiz|legal|pay)\//.test(path)) return;
  window.location.assign('/login');
}

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('no_refresh_token');
  // usa axios "cru" (sem interceptors) pra não reentrar no fluxo
  const res = await axios.post(
    `${api.defaults.baseURL}/auth/refresh`,
    { refreshToken },
    { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
  );
  const tokens = res?.data?.tokens;
  if (!tokens?.accessToken) throw new Error('invalid_refresh_response');
  storeTokens(tokens);
  return tokens.accessToken;
}

function ensureRefresh() {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Response interceptor (erros globais)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config;

    // Assinatura/módulos (AccessInterceptor do back): avisa o AccessGate.
    //  402 PAYMENT_REQUIRED → recarrega /me e mostra a tela de pagamento
    //  403 MODULE_DISABLED  → toast + volta pro dashboard
    //  403 PERMISSION_DENIED → toast (sub-permissão do WhatsApp; a rota é protegida pelo RequirePermission)
    if (status === 402) {
      window.dispatchEvent(new CustomEvent('pm:payment-required', { detail: error?.response?.data || null }));
    } else if (status === 403 && error?.response?.data?.code === 'MODULE_DISABLED') {
      window.dispatchEvent(new CustomEvent('pm:module-disabled', { detail: error.response.data }));
    } else if (status === 403 && error?.response?.data?.code === 'PERMISSION_DENIED') {
      // sub-permissão do WhatsApp (Fase 7): só avisa (toast no AccessGate), sem redirecionar
      window.dispatchEvent(new CustomEvent('pm:permission-denied', { detail: error.response.data }));
    }

    if (status !== 401 || !config || isAuthEndpoint(config)) {
      return Promise.reject(error);
    }

    // já tentou uma vez nesta request → sessão realmente inválida
    if (config._retry) {
      redirectToLogin();
      return Promise.reject(error);
    }

    // sem sessão nenhuma (ex.: página pública) → não tenta refresh
    if (!getAccessToken() && !getRefreshToken()) {
      return Promise.reject(error);
    }

    config._retry = true;
    const tokenBefore = getAccessToken();
    try {
      const newToken = await ensureRefresh();
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${newToken}`;
      return api.request(config);
    } catch {
      // Outra aba da mesma conta pode ter renovado primeiro (o refresh token é rotativo): o localStorage é
      // compartilhado, então relê o token antes de deslogar. Só redireciona se continuar inválido.
      await new Promise((r) => setTimeout(r, 400));
      const fresh = getAccessToken();
      if (fresh && fresh !== tokenBefore) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${fresh}`;
        return api.request(config);
      }
      redirectToLogin();
      return Promise.reject(error);
    }
  }
);

/**
 * ============================
 * REST helpers
 * ============================
 */

const get = (url, config = {}) => api.get(url, config).then((res) => res.data);

const post = (url, data = {}, config = {}) => api.post(url, data, config).then((res) => res.data);

const put = (url, data = {}, config = {}) => api.put(url, data, config).then((res) => res.data);

const patch = (url, data = {}, config = {}) => api.patch(url, data, config).then((res) => res.data);

const remove = (url, config = {}) => api.delete(url, config).then((res) => res.data);

/**
 * ============================
 * SWR fetchers
 * ============================
 */

/**
 * Uso:
 * useSWR('/users', fetcher)
 */
const fetcher = (url) => get(url);

/**
 * Uso:
 * useSWR(['/users', params], fetcherWithParams)
 */
const fetcherWithParams = ([url, params]) => get(url, { params });

/**
 * Uso:
 * useSWR(() => id ? `/users/${id}` : null, fetcher)
 */
const fetcherWithConfig = ([url, config]) => get(url, config);

/**
 * ============================
 * Export
 * ============================
 */

/** Renova o access token (uma renovação por vez). Usado pelo WebSocket quando o token expira. */
export function refreshAccessToken() {
  return ensureRefresh();
}

export { api, get, post, put, patch, remove, fetcher, fetcherWithParams, fetcherWithConfig };

export default api;
