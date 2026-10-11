/* Push In Play — tela Automação: "Teste neste aparelho" (inscreve o navegador da equipe e envia um
 * teste), botões "Testar neste aparelho" por passo e prévia ao vivo da notificação no editor.
 * Config em window.PIP_FLOW = { rest, nonce, vapid, sw, scope, site, icon, twemoji }.
 */
(function (w, d) {
	'use strict';
	var cfg = w.PIP_FLOW;
	if (!cfg) return;

	var $ = function (sel, root) {
		return (root || d).querySelector(sel);
	};
	var status = $('#pip-device-status');
	var btnEnable = $('#pip-device-enable');
	var btnTest = $('#pip-device-test');
	var msg = $('#pip-device-msg');
	var supported = 'Notification' in w && 'serviceWorker' in navigator && 'PushManager' in w;
	var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

	function setStatus(text, on) {
		if (!status) return;
		status.innerHTML = '<i></i> ' + text;
		status.classList.toggle('is-on', !!on);
	}
	function say(text, bad) {
		if (!msg) return;
		msg.textContent = text || '';
		msg.style.color = bad ? '#b91c1c' : '';
	}
	function b64ToBytes(b64) {
		var pad = '='.repeat((4 - (b64.length % 4)) % 4);
		var raw = w.atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
		var out = new Uint8Array(raw.length);
		for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
		return out;
	}
	function api(path, body) {
		return fetch(cfg.rest + path, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce },
			body: JSON.stringify(body)
		}).then(function (r) {
			return r.json().catch(function () {
				return { ok: false, error: 'resposta inválida (' + r.status + ')' };
			});
		});
	}
	function swReady(reg) {
		return new Promise(function (resolve) {
			if (reg.active && reg.active.state === 'activated') return resolve(reg);
			var done = false;
			var finish = function () {
				if (!done) {
					done = true;
					resolve(reg);
				}
			};
			navigator.serviceWorker.ready.then(finish, finish);
			w.setTimeout(finish, 6000);
		});
	}
	function currentSub() {
		if (!supported) return Promise.resolve(null);
		return navigator.serviceWorker.getRegistration(cfg.scope || '/').then(function (reg) {
			return reg ? reg.pushManager.getSubscription() : null;
		}).catch(function () {
			return null;
		});
	}
	function subscribe() {
		return navigator.serviceWorker.register(cfg.sw, { scope: cfg.scope || '/' }).then(swReady).then(function (reg) {
			return reg.pushManager.getSubscription().then(function (sub) {
				return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.vapid) });
			});
		});
	}

	function refresh() {
		if (!supported) {
			setStatus(isIOS ? 'no iPhone/iPad, abra o painel pelo site na Tela de Início' : 'este navegador não tem Web Push', false);
			if (btnEnable) btnEnable.disabled = true;
			return;
		}
		if (Notification.permission === 'denied') {
			setStatus('notificações bloqueadas neste navegador', false);
			if (btnEnable) btnEnable.disabled = true;
			return;
		}
		currentSub().then(function (sub) {
			if (sub && Notification.permission === 'granted') {
				setStatus('este aparelho está inscrito', true);
				if (btnEnable) btnEnable.textContent = 'Aparelho inscrito ✓';
				if (btnEnable) btnEnable.disabled = true;
				if (btnTest) btnTest.disabled = false;
				d.querySelectorAll('.pip-step-test, #pip-step-test-form, .pip-copy-test, #pip-copy-test-form').forEach(function (b) {
					b.disabled = false;
				});
			} else {
				setStatus(d.getElementById('pip-device-enable') ? 'aparelho ainda não inscrito' : 'aparelho não inscrito — ative em Automação', false);
				if (btnTest) btnTest.disabled = true;
				d.querySelectorAll('.pip-step-test, #pip-step-test-form, .pip-copy-test, #pip-copy-test-form').forEach(function (b) {
					b.disabled = true;
				});
			}
		});
	}

	if (btnEnable) {
		btnEnable.addEventListener('click', function () {
			btnEnable.disabled = true;
			say('pedindo permissão…');
			Notification.requestPermission().then(function (p) {
				if (p !== 'granted') {
					say('permissão não concedida.', true);
					btnEnable.disabled = false;
					refresh();
					return;
				}
				say('inscrevendo…');
				return subscribe().then(function (sub) {
					return api('admin/test', { subscription: sub.toJSON(), register_only: true });
				}).then(function (r) {
					say(r.ok ? 'pronto: este aparelho recebe as notificações do site.' : 'erro: ' + (r.error || ''), !r.ok);
					refresh();
				});
			}).catch(function (e) {
				say('falhou: ' + (e && e.message ? e.message : e), true);
				btnEnable.disabled = false;
			});
		});
	}

	function sendTest(extra, btn) {
		var label = btn ? btn.textContent : '';
		if (btn) {
			btn.disabled = true;
			btn.textContent = 'enviando…';
		}
		say('');
		return currentSub().then(function (sub) {
			if (!sub) {
				say('ative as notificações neste aparelho primeiro.', true);
				return { ok: false };
			}
			return api('admin/test', Object.assign({ subscription: sub.toJSON() }, extra || {}));
		}).then(function (r) {
			if (r.ok) say('enviada! Deve aparecer em instantes neste aparelho.');
			else if (r.error !== undefined) say('não foi: ' + (r.error || ('código ' + r.code)), true);
			return r;
		}).catch(function (e) {
			say('falhou: ' + (e && e.message ? e.message : e), true);
		}).then(function () {
			if (btn) {
				btn.disabled = false;
				btn.textContent = label;
			}
		});
	}
	if (btnTest) btnTest.addEventListener('click', function () {
		sendTest({}, btnTest);
	});
	d.querySelectorAll('.pip-step-test').forEach(function (b) {
		b.addEventListener('click', function () {
			sendTest({ step_id: Number(b.getAttribute('data-step')) }, b);
		});
	});
	d.querySelectorAll('.pip-copy-test').forEach(function (b) {
		b.addEventListener('click', function () {
			sendTest({ copy_id: Number(b.getAttribute('data-copy')) }, b);
		});
	});
	w.PIP_FLOW_API = { sendTest: sendTest, currentSub: currentSub, refresh: refresh };

	// editor: prévia ao vivo + teste do formulário
	var form = $('#pip-step-form');
	if (form) {
		var prev = $('#pip-notif-preview');
		function val(n) {
			var f = form.elements[n];
			return f ? f.value : '';
		}
		function emojiUrl(e) {
			var cps = [];
			for (var i = 0; i < e.length; i++) {
				var c = e.codePointAt(i);
				if (c > 0xffff) i++;
				cps.push(c);
			}
			if (cps.indexOf(0x200d) < 0) cps = cps.filter(function (c) {
				return c !== 0xfe0f;
			});
			return cps.length ? cfg.twemoji + cps.map(function (c) {
				return c.toString(16);
			}).join('-') + '.png' : '';
		}
		function iconUrl() {
			var mode = val('s[icon_mode]');
			if (mode === 'image' && val('s[icon_url]')) return val('s[icon_url]');
			if (mode === 'emoji' && val('s[icon_emoji]').trim()) return emojiUrl(val('s[icon_emoji]').trim()) || cfg.icon;
			return cfg.icon;
		}
		function render() {
			if (!prev) return;
			$('.pip-notif__icon', prev).src = iconUrl();
			$('.pip-notif__title', prev).textContent = val('s[title]') || '(sem título)';
			$('.pip-notif__text', prev).textContent = val('s[body]');
			var img = $('.pip-notif__image', prev);
			var iu = val('s[image_url]');
			img.hidden = !iu;
			if (iu) img.src = iu;
			var wrap = form.querySelector('[data-icon-fields]');
			if (wrap) wrap.setAttribute('data-mode', val('s[icon_mode]'));
		}
		form.addEventListener('input', render);
		form.addEventListener('change', render);
		render();
		var btnForm = $('#pip-step-test-form');
		if (btnForm) btnForm.addEventListener('click', function () {
			sendTest({ step: { title: val('s[title]'), body: val('s[body]'), icon_mode: val('s[icon_mode]'), icon_emoji: val('s[icon_emoji]'), icon_url: val('s[icon_url]'), image_url: val('s[image_url]'), url: val('s[url]') } }, btnForm);
		});
	}

	refresh();
})(window, document);
