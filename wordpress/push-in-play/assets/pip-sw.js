/* Push In Play — service worker do site (servido em /?pip-sw=<versão>, escopo na raiz).
 * Só cuida do push: mostra a notificação recebida, abre o link ao tocar, renova a inscrição quando o
 * push service troca, e grava um diagnóstico no site. Não guarda páginas em cache.
 * self.PIP_SW = { vapid, rest, diag } é injetado pelo servidor na 2ª linha do arquivo.
 * O diagnóstico (pipLog) só manda algo quando está ligado no painel — desligado, nenhuma requisição extra.
 */
self.addEventListener('install', function () {
	self.skipWaiting();
});
self.addEventListener('activate', function (e) {
	e.waitUntil(self.clients.claim());
});

function pipCfg() {
	return self.PIP_SW || {};
}
function pipTail(ep) {
	return ep ? String(ep).slice(-10) : '';
}
function pipLog(ev, detail) {
	var cfg = pipCfg();
	if (!cfg.rest || !cfg.diag) return Promise.resolve();
	var det = detail == null ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail);
	return fetch(cfg.rest + 'log', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ client: 'sw', events: [{ e: ev, d: det.slice(0, 380) }] })
	}).catch(function () {});
}
function pipKey() {
	var b64 = pipCfg().vapid || '';
	var pad = '='.repeat((4 - (b64.length % 4)) % 4);
	var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
	var out = new Uint8Array(raw.length);
	for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}
function pipPostSubscription(sub, oldEndpoint) {
	var cfg = pipCfg();
	return fetch(cfg.rest + 'subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ subscription: sub.toJSON(), layout_id: 0, page: 'sw', renewed: true, old_endpoint: oldEndpoint || '', client: 'sw' })
	}).then(function (r) {
		return pipLog('sw-post', { status: r.status, ep: pipTail(sub.endpoint), old: pipTail(oldEndpoint) });
	});
}

self.addEventListener('push', function (e) {
	var data = {};
	try {
		data = e.data ? e.data.json() : {};
	} catch (err) {
		data = { body: e.data ? e.data.text() : '' };
	}
	var title = data.title || 'Novidade';
	var opts = {
		body: data.body || '',
		icon: data.icon || undefined,
		badge: data.badge || undefined,
		image: data.image || undefined,
		tag: data.tag || undefined,
		renotify: Boolean(data.tag) && data.renotify !== false,
		requireInteraction: Boolean(data.require_interaction),
		silent: Boolean(data.silent),
		vibrate: !data.silent && Array.isArray(data.vibrate) ? data.vibrate : undefined,
		data: { url: data.url || '/', id: data.id || null, click: data.click || null }
	};
	var permNow = (typeof Notification !== 'undefined' && Notification.permission) || '?';
	var shown = self.registration.showNotification(title, opts).then(function () {
		return self.registration.getNotifications().then(function (list) {
			// `visible` = quantas notificações do site o navegador diz ter na tela agora; perm = permissão vista pelo SW
			return pipLog('sw-shown', { tag: data.tag || '', id: data.id || 0, perm: permNow, visible: list.length });
		}, function () {
			return pipLog('sw-shown', { tag: data.tag || '', id: data.id || 0, perm: permNow });
		});
	}, function (err) {
		// se a 1ª tentativa falhar (opção não suportada), mostra o mínimo — o Chrome exige uma notificação por push
		return self.registration.showNotification(title, { body: opts.body, icon: opts.icon, tag: opts.tag, data: opts.data }).then(function () {
			return pipLog('sw-shown-fallback', String(err && err.message).slice(0, 150));
		});
	});
	// som personalizado: só uma página aberta do site consegue tocar (o SW não tem áudio)
	var tell = data.sound && !data.silent
		? self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
			list.forEach(function (c) {
				c.postMessage({ type: 'pip:push', sound: data.sound, vibrate: opts.vibrate || null });
			});
		})
		: Promise.resolve();
	e.waitUntil(Promise.all([shown, tell]));
});

// O push service (ou o navegador: app instalado, limpeza…) pode trocar/expirar a inscrição.
// Regras: se veio uma inscrição nova, grava-a no lugar da antiga; se há uma página do site aberta,
// ela é quem renova (evita duas inscrições disputando); só sem página aberta o SW cria uma nova.
self.addEventListener('pushsubscriptionchange', function (e) {
	var cfg = pipCfg();
	if (!cfg.vapid || !cfg.rest) return;
	var oldEp = e.oldSubscription ? e.oldSubscription.endpoint : '';
	var work = pipLog('sw-change', { old: pipTail(oldEp), hasNew: !!e.newSubscription }).then(function () {
		if (e.newSubscription) return pipPostSubscription(e.newSubscription, oldEp);
		return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
			if (list.length) {
				list.forEach(function (c) {
					c.postMessage({ type: 'pip:resub', reason: 'pushsubscriptionchange' });
				});
				return pipLog('sw-change-deferred', 'página aberta renova');
			}
			return new Promise(function (r) {
				setTimeout(r, 1500);
			}).then(function () {
				return self.registration.pushManager.getSubscription();
			}).then(function (sub) {
				return sub || self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pipKey() });
			}).then(function (sub) {
				return pipPostSubscription(sub, oldEp);
			});
		});
	}).catch(function (err) {
		return pipLog('sw-change-error', String(err && err.message).slice(0, 150));
	});
	e.waitUntil(work);
});

self.addEventListener('notificationclose', function (e) {
	var data = e.notification.data || {};
	e.waitUntil(pipLog('sw-closed', { id: data.id || 0 }));
});

self.addEventListener('notificationclick', function (e) {
	var cd = e.notification.data || {};
	pipLog('sw-click', { id: cd.id || 0 });
	e.notification.close();
	var data = e.notification.data || {};
	var url = data.url || '/';
	var ping = data.click ? fetch(data.click, { method: 'POST', keepalive: true }).catch(function () {}) : Promise.resolve();
	e.waitUntil(
		Promise.all([
			ping,
			self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
				for (var i = 0; i < list.length; i++) {
					var c = list[i];
					if ('focus' in c) {
						c.focus();
						if ('navigate' in c) return c.navigate(url);
						return;
					}
				}
				return self.clients.openWindow(url);
			})
		])
	);
});
