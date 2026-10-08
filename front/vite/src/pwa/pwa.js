import { useSyncExternalStore } from 'react';
import { get, post, remove } from 'api/api';
import { refreshSocketAuth } from 'realtime/socket';

// =============================================================================
// PWA do painel: instalação + permissão de notificação.
// O manifesto e o service worker NÃO ficam fixos no index.html porque o mesmo HTML atende os
// domínios dos clientes (webchats/quizzes públicos) — lá não pode aparecer "Instalar Pub Mail".
// Eles entram só quando o painel logado abre (initPwa, chamado pelo PwaBoot no MainLayout).
// O `beforeinstallprompt` é capturado aqui, no carregamento do módulo, para não se perder.
// =============================================================================

const hasWindow = typeof window !== 'undefined';
const ua = hasWindow ? navigator.userAgent || '' : '';

// iPadOS se apresenta como Mac: diferencia pelo toque
export const isIOS = hasWindow && (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const isAndroid = /android/i.test(ua);
export const isMobile = isIOS || isAndroid || /mobile|tablet|silk|kindle/i.test(ua);
export const isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\//i.test(ua);

function detectStandalone() {
  if (!hasWindow) return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true
  );
}

function readPermission() {
  if (!hasWindow || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // default | granted | denied
}

let state = {
  canPrompt: false, // o navegador entregou o convite de instalação (Chrome/Edge/Samsung)
  installed: false, // instalou nesta aba (appinstalled)
  standalone: detectStandalone(), // está rodando como app instalado
  permission: readPermission(),
  dialog: null, // 'install' | 'notify' | null
  pushSupported: hasWindow && 'serviceWorker' in navigator && 'PushManager' in window,
  pushSubscribed: null, // null = ainda não conferido
  pushId: null, // id da inscrição deste aparelho no servidor
  pushError: null
};
const subs = new Set();
const setState = (patch) => {
  state = { ...state, ...patch };
  subs.forEach((fn) => fn());
};
let deferredPrompt = null;

if (hasWindow) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // o convite vira o NOSSO botão
    deferredPrompt = e;
    setState({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setState({ canPrompt: false, installed: true });
  });
  const mq = window.matchMedia?.('(display-mode: standalone)');
  mq?.addEventListener?.('change', () => setState({ standalone: detectStandalone() }));
  // a permissão pode mudar nos ajustes do aparelho enquanto o app está aberto
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const p = readPermission();
      if (p !== state.permission) setState({ permission: p });
    }
  });
}

function upsertHead(selector, create) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

let started = false;
/** Liga o PWA no painel: manifesto, ícone da Apple e service worker. Idempotente. */
export function initPwa() {
  if (!hasWindow || started) return;
  started = true;

  upsertHead('link[rel="manifest"]', () => {
    const l = document.createElement('link');
    l.rel = 'manifest';
    l.href = '/manifest.webmanifest';
    return l;
  });
  // o index.html aponta o SVG (o iOS ignora SVG na tela de início)
  upsertHead('link[rel="apple-touch-icon"]', () => {
    const l = document.createElement('link');
    l.rel = 'apple-touch-icon';
    return l;
  }).href = '/pwa/apple-touch-icon.png';
  const meta = (name, content) =>
    (upsertHead(`meta[name="${name}"]`, () => {
      const m = document.createElement('meta');
      m.name = name;
      return m;
    }).content = content);
  meta('apple-mobile-web-app-capable', 'yes');
  meta('mobile-web-app-capable', 'yes');
  meta('apple-mobile-web-app-title', 'Pub Mail');
  meta('apple-mobile-web-app-status-bar-style', 'default'); // conteúdo abaixo da barra de status (não cobre o botão do menu)

  void vapid();
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && secure) {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      /* sem SW o painel funciona normal, só não instala */
    });
  }
}

/** Cor da barra do sistema acompanhando o tema do painel. */
export function syncThemeColor(dark) {
  if (!hasWindow) return;
  const el = upsertHead('meta[name="theme-color"]', () => {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    return m;
  });
  el.content = dark ? '#0b1120' : '#f8fafc';
}

export const openPwaDialog = (kind) => setState({ dialog: kind });
export const closePwaDialog = () => setState({ dialog: null });

/** Abre o convite nativo de instalação. Precisa vir de um clique. → 'accepted' | 'dismissed' | 'unavailable' */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  const ev = deferredPrompt;
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    deferredPrompt = null;
    setState({ canPrompt: false, installed: choice?.outcome === 'accepted' || state.installed });
    return choice?.outcome || 'dismissed';
  } catch {
    return 'unavailable';
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const waitState = (worker, target, ms) =>
  new Promise((resolve) => {
    if (!worker || worker.state === target) return resolve(true);
    const t = setTimeout(() => resolve(worker.state === target), ms);
    worker.addEventListener('statechange', function h() {
      if (worker.state === target || worker.state === 'redundant') {
        clearTimeout(t);
        worker.removeEventListener('statechange', h);
        resolve(worker.state === target);
      }
    });
  });

/** Último motivo de falha do service worker (para o diagnóstico da tela). */
export let lastSwIssue = '';

/**
 * Registro do service worker PRONTO para push: `register()` (idempotente — devolve o registro
 * existente e refaz se o iOS tiver descartado) → `ready` (worker ativo) → espera terminar de
 * ativar. Logo depois de um deploy o SW novo troca de lugar com o antigo e, nesse instante, o
 * Safari recusa ("requires a service worker") e o Chrome falha com "storage error".
 */
async function swRegistration(timeoutMs = 10000) {
  if (!('serviceWorker' in navigator)) {
    lastSwIssue = 'navigator.serviceWorker ausente';
    return null;
  }
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  } catch (e) {
    lastSwIssue = `register falhou: ${e?.message || e}`;
    return null;
  }
  // NÃO usa `navigator.serviceWorker.ready`: no iOS (app instalado) ele resolve com um registro SEM worker
  // ativo, enquanto getRegistration() devolve o registro certo, já ativado (visto no diagnóstico do iPhone).
  const deadline = Date.now() + timeoutMs;
  let reg = null;
  while (Date.now() < deadline) {
    try {
      reg = (await navigator.serviceWorker.getRegistration('/')) || (await navigator.serviceWorker.getRegistrations())[0] || null;
    } catch {
      reg = null;
    }
    const w = reg?.active;
    if (w && w.state === 'activated') {
      lastSwIssue = '';
      return reg;
    }
    if (w && w.state === 'activating') {
      await waitState(w, 'activated', 3000);
      continue;
    }
    await sleep(200);
  }
  lastSwIssue = reg
    ? `worker ${reg.active?.state || 'ausente'} (installing=${reg.installing?.state || '-'}, waiting=${reg.waiting?.state || '-'})`
    : 'nenhum registro';
  return reg?.active ? reg : null;
}

// ---------------------------------------------------------------- push (Web Push / VAPID)
const PUSH_LS = 'pm-push-sub'; // {id, endpoint} deste aparelho
const lsGet = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* modo privado */
  }
};

async function sha256Hex(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/** Hash do endpoint de push deste aparelho (vai no handshake do WebSocket). */
export function getPushHash() {
  return lsGet(PUSH_LS)?.hash || null;
}

function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let vapidKey;
async function vapid() {
  if (vapidKey !== undefined) return vapidKey;
  try {
    const c = await get('/notifications/catalog');
    vapidKey = c?.data?.vapid_public_key || c?.vapid_public_key || null;
  } catch {
    vapidKey = null;
  }
  return vapidKey;
}

/** Inscrição atual deste aparelho no navegador (ou null). */
export async function currentPushSubscription() {
  if (!state.pushSupported) return null;
  const reg = await swRegistration();
  if (!reg) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

const sameKey = (a, b) => {
  if (!a || !b) return true; // Safari não devolve a chave da inscrição: assume igual
  const x = new Uint8Array(a);
  if (x.length !== b.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== b[i]) return false;
  return true;
};

/**
 * Inscreve este aparelho no push e registra no servidor. → { ok, reason }
 * Inscrição antiga com OUTRA chave VAPID é desfeita antes (senão o Chrome recusa). Em erro
 * transitório (SW trocando, "storage error") tenta de novo até 3× com pausa.
 */
export async function subscribePush() {
  if (!state.pushSupported) return { ok: false, reason: 'unsupported' };
  if (readPermission() !== 'granted') return { ok: false, reason: 'permission' };
  const key = await vapid();
  if (!key) return { ok: false, reason: 'server_off' };
  const keyBytes = b64ToBytes(key);
  let lastErr = 'no_sw';
  for (let attempt = 0; attempt < 3; attempt++) {
    const reg = await swRegistration(attempt ? 6000 : 10000);
    if (!reg) {
      lastErr = `sem service worker (${lastSwIssue || 'motivo desconhecido'})`;
      await sleep(800);
      continue;
    }
    try {
      let sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub.options?.applicationServerKey, keyBytes)) {
        await sub.unsubscribe().catch(() => undefined);
        sub = null;
      }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
      const json = sub.toJSON();
      const r = await post('/notifications/subscriptions', { endpoint: json.endpoint, keys: json.keys, user_agent: navigator.userAgent });
      const id = r?.data?.id || r?.id || null;
      const hash = await sha256Hex(json.endpoint);
      lsSet(PUSH_LS, { id, endpoint: json.endpoint, hash });
      setState({ pushSubscribed: true, pushId: id, pushError: null });
      refreshSocketAuth(); // o servidor passa a saber que ESTE aparelho está com o painel aberto
      return { ok: true, id };
    } catch (e) {
      lastErr = `${e?.name ? `${e.name}: ` : ''}${e?.message || e}`;
      // inscrição presa no navegador: limpa e tenta de novo
      if (/storage error|requires a service worker|AbortError|InvalidState/i.test(lastErr)) {
        try {
          const stale = await reg.pushManager.getSubscription();
          if (stale) await stale.unsubscribe();
        } catch {
          /* segue */
        }
      }
      await sleep(1200 * (attempt + 1));
    }
  }
  setState({ pushSubscribed: false, pushError: lastErr });
  return { ok: false, reason: lastErr };
}

/** Raio-X deste aparelho (para a tela de Notificações e para suporte). */
export async function pushDiagnostics() {
  const d = {
    navegador: navigator.userAgent,
    app_instalado: detectStandalone(),
    ios: isIOS,
    permissao: readPermission(),
    service_worker_suportado: 'serviceWorker' in navigator,
    push_suportado: state.pushSupported,
    chave_servidor: null,
    registro: null,
    inscricao: null,
    ultimo_erro: state.pushError || null,
    sw_motivo: lastSwIssue || null
  };
  try {
    const k = await vapid();
    d.chave_servidor = k ? `${k.slice(0, 8)}… (${k.length} chars)` : 'ausente';
  } catch (e) {
    d.chave_servidor = `erro: ${e?.message || e}`;
  }
  try {
    const regs = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    d.registro = regs.map((r) => ({
      scope: r.scope,
      active: r.active?.state || null,
      installing: r.installing?.state || null,
      waiting: r.waiting?.state || null,
      script: r.active?.scriptURL || null
    }));
    d.controlado = Boolean(navigator.serviceWorker?.controller);
    const r0 = regs[0];
    const sub = r0 ? await r0.pushManager.getSubscription() : null;
    d.inscricao = sub ? { endpoint: `${sub.endpoint.slice(0, 48)}…`, expira: sub.expirationTime || null } : null;
  } catch (e) {
    d.registro = `erro: ${e?.message || e}`;
  }
  d.salvo_localmente = lsGet(PUSH_LS);
  return d;
}

/** Cancela o push neste aparelho (navegador + servidor). */
export async function unsubscribePush() {
  const sub = await currentPushSubscription();
  const saved = lsGet(PUSH_LS);
  const endpoint = sub?.endpoint || saved?.endpoint || null;
  try {
    if (sub) await sub.unsubscribe();
  } catch {
    /* segue para tirar do servidor */
  }
  if (endpoint) await remove('/notifications/subscriptions', { data: { endpoint } }).catch(() => undefined);
  lsSet(PUSH_LS, null);
  setState({ pushSubscribed: false, pushId: null });
  return { ok: true };
}

/**
 * Confere o estado do push ao abrir o painel: inscrição que existe no navegador mas mudou
 * (chave rotacionada) ou que ainda não foi registrada no servidor é (re)enviada; sem inscrição,
 * `pushSubscribed=false`. Não pede permissão — isso só com clique do usuário.
 */
export async function syncPush() {
  if (!state.pushSupported || readPermission() !== 'granted') {
    setState({ pushSubscribed: false });
    return;
  }
  const sub = await currentPushSubscription();
  const saved = lsGet(PUSH_LS);
  if (!sub) {
    // o usuário já tinha ativado neste aparelho e o navegador perdeu a inscrição → refaz
    if (saved?.endpoint) await subscribePush();
    else setState({ pushSubscribed: false });
    return;
  }
  if (!saved || saved.endpoint !== sub.endpoint) {
    await subscribePush();
    return;
  }
  setState({ pushSubscribed: true, pushId: saved.id || null });
  post('/notifications/subscriptions/touch', { endpoint: sub.endpoint }).catch(() => undefined);
}

/** Pede a permissão de notificação; liberada → inscreve o push e mostra uma confirmação. */
export async function enableNotifications() {
  if (readPermission() === 'unsupported') {
    setState({ permission: 'unsupported' });
    return 'unsupported';
  }
  let p = Notification.permission;
  if (p === 'default') {
    try {
      p = await Notification.requestPermission();
    } catch {
      p = Notification.permission;
    }
  }
  setState({ permission: p });
  if (p === 'granted') {
    const r = await subscribePush().catch(() => ({ ok: false }));
    try {
      const reg = await swRegistration();
      // no Android só funciona pelo service worker (new Notification() lança erro lá)
      if (reg) {
        await reg.showNotification('Notificações ativadas', {
          body: r?.ok
            ? 'Você vai receber os avisos do Pub Mail por aqui, mesmo com o app fechado.'
            : 'Avisos no painel ativados neste aparelho.',
          icon: '/pwa/icon-192.png',
          badge: '/pwa/badge-96.png',
          tag: 'pm-notifications-on',
          data: { url: '/whatsapp/notifications' }
        });
      }
    } catch {
      /* confirmação é só cortesia */
    }
  }
  return p;
}

const subscribe = (fn) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
const snapshot = () => state;

/**
 * Estado do PWA para os componentes.
 * showInstall: botão "Instalar" (fora do app instalado; com convite nativo, ou celular/tablet com instruções)
 * showEnableNotifications: dentro do app instalado e ainda sem resposta sobre notificações
 */
/** Estado atual (fora do React). */
export const pwaState = () => state;

export function usePwa() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const showInstall = !s.standalone && !s.installed && (s.canPrompt || isMobile);
  // dentro do app instalado: ainda sem resposta OU permitido mas este aparelho perdeu/não tem a inscrição do push
  const showEnableNotifications =
    s.standalone && (s.permission === 'default' || (s.permission === 'granted' && s.pushSupported && s.pushSubscribed === false));
  const mode = s.canPrompt ? 'prompt' : isIOS ? 'ios' : 'manual';
  return { ...s, showInstall, showEnableNotifications, mode };
}
