/* Service worker do Pub Mail (PWA).
 * - Não guarda o app em cache: assets e API vão sempre à rede (deploy novo aparece na hora).
 * - Só a NAVEGAÇÃO tem reserva: sem internet, mostra /offline.html.
 * - Push: o servidor manda JSON já resolvido pelas preferências do usuário:
 *   { id, kind, title, body, url, tag, icon, image, silent, vibrate:[ms…], important, renotify, data }
 */
const VERSION = 'pm-sw-2';
const OFFLINE_CACHE = `${VERSION}-offline`;
const OFFLINE_ASSETS = ['/offline.html', '/pwa/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((c) => c.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return; // resto: rede, sem interferir
  event.respondWith(
    fetch(req).catch(async () => {
      const cached = await caches.match('/offline.html');
      return cached || new Response('Sem conexão', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })
  );
});

self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { body: event.data ? event.data.text() : '' };
  }
  const title = d.title || 'Pub Mail';
  const opts = {
    body: d.body || '',
    icon: d.icon || '/pwa/icon-192.png',
    badge: '/pwa/badge-96.png',
    image: d.image || undefined,
    tag: d.tag || undefined,
    renotify: Boolean(d.tag && d.renotify !== false),
    silent: Boolean(d.silent),
    requireInteraction: Boolean(d.important),
    timestamp: d.at ? Date.parse(d.at) || Date.now() : Date.now(),
    data: { url: d.url || '/dashboard', kind: d.kind || null, id: d.id || null },
    actions: [{ action: 'open', title: 'Abrir' }, { action: 'dismiss', title: 'Dispensar' }]
  };
  if (Array.isArray(d.vibrate) && d.vibrate.length && !d.silent) opts.vibrate = d.vibrate;
  event.waitUntil(
    self.registration.showNotification(title, opts).then(() =>
      // abas abertas ficam sabendo (badge/lista do painel)
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        for (const c of list) c.postMessage({ type: 'pm:push', notification: { id: d.id || null, kind: d.kind || null, title, body: d.body || '', url: d.url || null, at: d.at || null } });
      })
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = new URL((event.notification.data && event.notification.data.url) || '/dashboard', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      // já tem uma janela do Pub Mail aberta: leva ela até a tela da notificação
      for (const client of list) {
        if (!client.url.startsWith(self.location.origin)) continue;
        try {
          if ('navigate' in client && client.url !== url) await client.navigate(url);
        } catch {
          /* janela não controlada por este SW: só foca */
        }
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

// O navegador trocou a inscrição (chave rotacionada): o painel refaz ao abrir (pwa.js syncPush).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) c.postMessage({ type: 'pm:resubscribe' });
    })
  );
});
