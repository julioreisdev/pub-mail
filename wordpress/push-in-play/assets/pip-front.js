/* Push In Play — lógica no site do cliente: escolhe um layout (peso + fixo por visitante),
 * espera o gatilho, mostra o popup, pede a permissão, registra o service worker, inscreve o
 * visitante no push e manda tudo para o WordPress (impressão, clique, ativação, recusa).
 * Também grava um diagnóstico de cada passo no servidor (tela Automação → Diagnóstico) — só quando o
 * diagnóstico está ligado no painel (cfg.diag); desligado, nenhuma requisição extra por visita.
 * Config em window.PIP_CFG = { layouts:[…], vapid, rest, sw, scope, cooldown_days, site, diag }.
 */
(function (w, d) {
	'use strict';
	var cfg = w.PIP_CFG;
	var PIP = w.PIP;
	if (!cfg || !cfg.rest) return;

	/* ------------------------------------------------------------------ util */
	var LS = {
		get: function (k) {
			try {
				return w.localStorage.getItem('pip_' + k);
			} catch (e) {
				return null;
			}
		},
		set: function (k, v) {
			try {
				w.localStorage.setItem('pip_' + k, v);
			} catch (e) {
				/* privado/bloqueado */
			}
		}
	};
	// id curto do navegador, só para juntar as linhas do diagnóstico
	var CID = LS.get('cid');
	if (!CID) {
		CID = Math.random().toString(36).slice(2, 8);
		LS.set('cid', CID);
	}
	var UA = navigator.userAgent;
	var isIOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
	var standalone = (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
	var hasPush = 'Notification' in w && 'serviceWorker' in navigator && 'PushManager' in w;
	var inApp = isIOS && /GSA\/|FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Twitter|Line\/|MicroMessenger|Snapchat|Pinterest/i.test(UA);
	var DEBUG = /[?&]pip=debug(&|$)/.test(w.location.search);
	var DIAG = !!cfg.diag;

	function tail(ep) {
		return ep ? String(ep).slice(-10) : '';
	}
	function post(path, body, beacon) {
		var url = cfg.rest + path;
		var json = JSON.stringify(body);
		if (beacon && navigator.sendBeacon) {
			try {
				if (navigator.sendBeacon(url, new Blob([json], { type: 'application/json' }))) return Promise.resolve(true);
			} catch (e) {
				/* cai no fetch */
			}
		}
		return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true, credentials: 'omit' }).catch(function () {});
	}

	// diagnóstico: junta eventos e manda em lote (beacon) — vai para a tela Automação
	var logBuf = [];
	var logTimer = null;
	function flushLog() {
		logTimer = null;
		if (!logBuf.length) return;
		var batch = logBuf.splice(0, 25);
		post('log', { client: CID, events: batch }, true);
	}
	function log(ev, detail) {
		var det = detail == null ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail);
		if (DEBUG) {
			try {
				console.log('[Push In Play] ' + ev + ' ' + det);
			} catch (e) {
				/* sem console */
			}
		}
		if (!DIAG) return;
		logBuf.push({ e: ev, d: det.slice(0, 380) });
		if (!logTimer) logTimer = w.setTimeout(flushLog, 400);
	}
	w.addEventListener('pagehide', flushLog);
	function why(msg) {
		log('why', msg);
		if (DEBUG) {
			try {
				w.alert('Push In Play: ' + msg);
			} catch (e) {
				/* sem alert */
			}
		}
	}
	function event(layoutId, name) {
		post('event', { layout_id: layoutId, event: name }, true);
	}
	function b64ToBytes(b64) {
		var pad = '='.repeat((4 - (b64.length % 4)) % 4);
		var raw = w.atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
		var out = new Uint8Array(raw.length);
		for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
		return out;
	}

	log('load', {
		perm: hasPush ? Notification.permission : 'sem-push',
		standalone: standalone,
		ios: isIOS,
		inApp: inApp,
		ctrl: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
		ep: tail(LS.get('endpoint')),
		ua: UA.slice(0, 120)
	});

	// Som personalizado e pedidos do service worker (reinscrever) chegam por mensagem.
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.addEventListener('message', function (ev) {
			var m = ev.data || {};
			if (m.type === 'pip:push') {
				if (w.PIP_SOUNDS && m.sound) w.PIP_SOUNDS.play(m.sound);
			} else if (m.type === 'pip:resub') {
				log('sw-asked-resub', m.reason || '');
				if (hasPush && Notification.permission === 'granted') subscribe(Number(LS.get('layout') || 0), 1, false, false);
			}
		});
	}

	if (!cfg.vapid || !PIP) return why('configuração ausente (nenhum layout ligado ou sem chave VAPID).');
	if (navigator.webdriver || /bot|crawl|spider|slurp|headless/i.test(UA)) return why('navegador automatizado/robô.');

	/* ------------------------------------------------------------------ inscrição */
	// O register() resolve antes de o worker estar ativo; o subscribe() do Chrome falha nessa janela
	// ("no active Service Worker" / "storage error"). Espera ativar, com teto de 6 s.
	function swReady(reg) {
		return new Promise(function (resolve) {
			var done = false;
			var finish = function () {
				if (!done) {
					done = true;
					resolve(reg);
				}
			};
			if (reg.active && reg.active.state === 'activated') return finish();
			navigator.serviceWorker.ready.then(finish, finish);
			var sw = reg.installing || reg.waiting || reg.active;
			if (sw) sw.addEventListener('statechange', function () {
				if (sw.state === 'activated') finish();
			});
			w.setTimeout(finish, 6000);
		});
	}
	function getOrCreate(reg, key) {
		return reg.pushManager.getSubscription().then(function (sub) {
			if (sub) {
				log('sub-existing', tail(sub.endpoint));
				return sub;
			}
			return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).then(function (s) {
				log('sub-created', tail(s.endpoint));
				// se outra chamada criou outra inscrição no meio tempo, a viva é a que o navegador devolve agora
				return reg.pushManager.getSubscription().then(function (live) {
					if (live && live.endpoint !== s.endpoint) log('sub-live-differs', tail(live.endpoint));
					return live || s;
				}, function () {
					return s;
				});
			}, function (err) {
				// chave diferente da inscrição guardada pelo navegador: troca (única situação em que descartamos)
				if (!/applicationServerKey|different/i.test(String(err && err.message))) throw err;
				log('sub-key-mismatch', String(err && err.message).slice(0, 120));
				return reg.pushManager.getSubscription().then(function (old) {
					return (old ? old.unsubscribe().catch(function () {}) : Promise.resolve()).then(function () {
						return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
					});
				}).then(function (s) {
					log('sub-created', tail(s.endpoint));
					return s;
				});
			});
		});
	}
	/**
	 * Registra o SW, garante UMA inscrição e grava no site. Nunca descarta uma inscrição por conta
	 * própria: só quando o servidor diz que o push service a recusou (410). Se a inscrição mudou
	 * (navegador renovou, app instalado…), manda `old_endpoint` e o servidor troca NO LUGAR — o mesmo
	 * inscrito continua, sem duplicar nem repetir o fluxo. Resolve true se ficou inscrito.
	 * lazy = visita com permissão já dada: só fala com o servidor se mudou ou se passou 1 dia.
	 */
	// Voo único: chamadas simultâneas (aceite + aviso do service worker + app instalado) reaproveitam a
	// mesma inscrição em andamento — duas em paralelo criavam duas inscrições e a 1ª virava órfã.
	var inflight = null;
	function subscribe(layoutId, attempt, renewed, lazy) {
		if (inflight) {
			log('sub-joined');
			return inflight;
		}
		inflight = doSubscribe(layoutId, attempt, renewed, lazy).then(function (r) {
			inflight = null;
			return r;
		}, function (e) {
			inflight = null;
			throw e;
		});
		return inflight;
	}
	// O worker já registrado com ESTA versão serve: nada de baixar o script de novo a cada visita.
	function registration(lazy) {
		var scope = cfg.scope || '/';
		var want = new URL(cfg.sw, w.location.href).href;
		var reg = function () {
			return navigator.serviceWorker.register(cfg.sw, { scope: scope });
		};
		if (!lazy) return reg();
		return navigator.serviceWorker.getRegistration(scope).then(function (r) {
			var sw = r && (r.active || r.waiting || r.installing);
			if (r && r.active && sw && sw.scriptURL === want) return r;
			return reg();
		}, reg);
	}
	function doSubscribe(layoutId, attempt, renewed, lazy) {
		attempt = attempt || 1;
		var key = b64ToBytes(cfg.vapid);
		return registration(lazy)
			.then(swReady)
			.then(function (reg) {
				return getOrCreate(reg, key);
			})
			.then(function (sub) {
				var known = LS.get('endpoint') || '';
				var same = known === sub.endpoint;
				var fresh = Date.now() - Number(LS.get('synced') || 0) < 86400000;
				if (lazy && same && fresh) {
					log('sub-unchanged', tail(sub.endpoint));
					return true;
				}
				var body = { subscription: sub.toJSON(), layout_id: layoutId, page: w.location.href, renewed: !!renewed, client: CID, standalone: standalone };
				if (known && !same) body.old_endpoint = known;
				return fetch(cfg.rest + 'subscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'omit',
					body: JSON.stringify(body)
				})
					.then(function (r) {
						return r.json().then(function (j) {
							j.status = r.status;
							return j;
						}, function () {
							return { ok: r.ok, status: r.status };
						});
					})
					.then(function (j) {
						log('post', { status: j.status, ok: j.ok, expired: !!j.expired, replaced: !!j.replaced, id: j.subscriber_id || 0 });
						if (j.expired && !renewed) {
							// o push service já recusou esta inscrição: descarta e cria outra (uma vez)
							log('renew', tail(sub.endpoint));
							LS.set('endpoint', sub.endpoint); // vira o old_endpoint da próxima
							return sub.unsubscribe().catch(function () {}).then(function () {
								return doSubscribe(layoutId, attempt, true, false);
							});
						}
						if (j.ok) {
							LS.set('subscribed', String(Date.now()));
							LS.set('synced', String(Date.now()));
							LS.set('endpoint', sub.endpoint);
							LS.set('last_error', '');
							why('inscrito no push e gravado no site (' + tail(sub.endpoint) + ').');
						} else {
							why('o site recusou a inscrição (HTTP ' + j.status + ').');
						}
						return !!j.ok;
					});
			})
			.catch(function (err) {
				var msg = String((err && err.message) || err || 'erro');
				LS.set('last_error', msg);
				log('error', { attempt: attempt, msg: msg.slice(0, 200) });
				if (attempt < 3) {
					return new Promise(function (r) {
						w.setTimeout(r, 1500 * attempt);
					}).then(function () {
						return doSubscribe(layoutId, attempt + 1, renewed, false);
					});
				}
				why('falha ao inscrever no push depois de 3 tentativas: ' + msg);
				return false;
			});
	}

	// Depois de instalar o app (Android/PC), o Chrome pode trocar a inscrição: ressincroniza.
	w.addEventListener('appinstalled', function () {
		log('appinstalled');
		w.setTimeout(function () {
			if (hasPush && Notification.permission === 'granted') subscribe(Number(LS.get('layout') || 0), 1, false, false);
		}, 4000);
	});

	/* ------------------------------------------------------------------ layout */
	var layouts = (cfg.layouts || []).filter(function (l) {
		return l && l.id;
	});
	if (!layouts.length) return why('nenhum layout ligado.');

	var layout = null;
	var stickyId = Number(LS.get('layout') || 0);
	for (var i = 0; i < layouts.length; i++) if (layouts[i].id === stickyId) layout = layouts[i];
	if (!layout) {
		var total = 0;
		layouts.forEach(function (l) {
			total += Math.max(0, Number(l.weight) || 0);
		});
		var r = Math.random() * (total || layouts.length);
		for (var j = 0; j < layouts.length; j++) {
			r -= total ? Math.max(0, Number(layouts[j].weight) || 0) : 1;
			if (r <= 0) {
				layout = layouts[j];
				break;
			}
		}
		layout = layout || layouts[0];
		LS.set('layout', String(layout.id));
	}
	var inst = (layout.config && layout.config.install) || {};
	var wantIos = inst.ios_enabled !== false && inst.enabled !== false;
	var wantApp = inst.app_enabled !== false && inst.enabled !== false;

	if (standalone && !LS.get('installed')) {
		LS.set('installed', String(Date.now()));
		event(layout.id, 'installed');
		log('installed-first-open');
	}

	var until = Number(LS.get('dismiss_until') || 0);
	var coolingDown = until && until > Date.now();

	/* ------------------------------------------------------------------ popup */
	var ui = null;
	function hide() {
		if (ui && ui.root.parentNode) ui.root.parentNode.removeChild(ui.root);
		ui = null;
		d.removeEventListener('keydown', onKey);
	}
	function onKey(e) {
		if (e.key === 'Escape') dismissed();
	}
	function coolDown(ms) {
		if (ms == null) {
			var days = Number((layout.config && layout.config.cooldown_days) != null ? layout.config.cooldown_days : cfg.cooldown_days);
			if (!(days >= 0)) days = 7;
			ms = days * 86400000;
		}
		LS.set('dismiss_until', String(Date.now() + ms));
	}
	function dismissed() {
		if (!ui) return;
		if (ui.variant !== 'install' && ui.variant !== 'denied') event(layout.id, 'dismissed');
		log('dismiss', ui.variant);
		coolDown();
		hide();
	}
	function accepted() {
		event(layout.id, 'click');
		log('accept');
		ui.accept.disabled = true;
		Notification.requestPermission().then(function (p) {
			log('permission', p);
			if (p === 'granted') {
				hide();
				subscribe(layout.id).then(maybeOfferApp);
			} else {
				event(layout.id, p === 'denied' ? 'denied' : 'dismissed');
				// não some em silêncio: explica onde liberar (o navegador negou, não a pessoa)
				if (p === 'denied') show('denied');
				else hide();
			}
		}, function (err) {
			log('error', 'requestPermission: ' + String(err && err.message));
			hide();
		});
	}
	function maybeOfferApp(ok) {
		if (!ok) return;
		if (!wantApp || standalone || !w.__pipInstallEvt) return why('sem convite nativo de instalação disponível (já instalado, navegador sem suporte ou critérios do manifesto não atendidos).');
		show('install');
	}
	function installTapped() {
		var evt = w.__pipInstallEvt;
		if (!evt) return hide();
		w.__pipInstallEvt = null;
		log('install-prompt');
		evt.prompt();
		(evt.userChoice || Promise.resolve()).then(function (c) {
			log('install-choice', c && c.outcome);
			hide();
		});
	}
	function shareTapped() {
		event(layout.id, 'click');
		log('ios-share', inApp ? 'inapp' : 'share');
		if (inApp) {
			var target = 'x-safari-' + w.location.href.replace(/^https?:\/\//, 'https://');
			var t0 = Date.now();
			w.location.href = target;
			w.setTimeout(function () {
				if (Date.now() - t0 < 2500 && d.visibilityState === 'visible' && navigator.share) {
					navigator.share({ title: d.title, url: w.location.href }).catch(function () {});
				}
			}, 1200);
			return;
		}
		var done = function () {
			var mins = Math.max(0, Number(inst.ios_retry) || 0);
			if (mins > 0) coolDown(mins * 60000);
			hide();
		};
		if (navigator.share) {
			navigator.share({ title: d.title, url: w.location.href }).then(done, function () {
				/* cancelou: deixa o passo a passo na tela */
			});
		} else {
			done();
		}
	}
	function show(variant) {
		variant = variant || 'permission';
		log('show', { layout: layout.id, type: layout.type, variant: variant });
		if (!d.getElementById('pip-style')) {
			var style = d.createElement('style');
			style.id = 'pip-style';
			style.textContent = PIP.cssFor(layout);
			d.head.appendChild(style);
		}
		if (ui) hide();
		layout.inApp = inApp;
		ui = PIP.build(layout, variant);
		if (w.matchMedia && w.matchMedia('(max-width:640px)').matches) ui.root.classList.add('pip-narrow');
		d.body.appendChild(ui.root);
		ui.accept.addEventListener('click', variant === 'ios' ? shareTapped : variant === 'install' ? installTapped : accepted);
		if (ui.dismiss) ui.dismiss.addEventListener('click', dismissed);
		if (ui.close) ui.close.addEventListener('click', dismissed);
		d.addEventListener('keydown', onKey);
		if (variant !== 'install' && variant !== 'denied') event(layout.id, 'impression');
	}

	/* ------------------------------------------------------------------ gatilho */
	var trig = (layout.config && layout.config.trigger) || {};
	var delay = Math.max(0, Number(trig.delay) || 0);
	var scrollPct = Math.max(0, Math.min(100, Number(trig.scroll) || 0));
	function arm(fn) {
		var fired = false;
		var fire = function () {
			if (fired) return;
			fired = true;
			fn();
		};
		var go = function () {
			if (scrollPct > 0) {
				var onScroll = function () {
					var h = d.documentElement;
					var max = h.scrollHeight - h.clientHeight;
					var pct = max > 0 ? (w.scrollY / max) * 100 : 100;
					if (pct >= scrollPct) {
						w.removeEventListener('scroll', onScroll);
						fire();
					}
				};
				w.addEventListener('scroll', onScroll, { passive: true });
				onScroll();
			}
			if (scrollPct === 0 || delay > 0) w.setTimeout(fire, delay * 1000);
		};
		if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go);
		else go();
	}

	/* ------------------------------------------------------------------ decisão */
	if (!hasPush) {
		if (isIOS && !standalone && wantIos) {
			if (coolingDown) return why('o visitante recusou há pouco; o convite volta em ' + new Date(until).toLocaleString() + '.');
			return arm(function () {
				show('ios');
			});
		}
		return why(isIOS ? 'este navegador não tem Web Push. No iPhone/iPad só funciona com o site adicionado à Tela de Início (iOS 16.4+).' : 'este navegador não tem Web Push (Notification/ServiceWorker/PushManager).');
	}
	if (Notification.permission === 'granted') {
		// confere o navegador em TODA visita: sem inscrição → cria; mudou ou > 1 dia → reenvia
		subscribe(stickyId || layout.id, 1, false, true);
		return why('as notificações já estão permitidas neste navegador — o popup não é mostrado (a inscrição é garantida em silêncio).');
	}
	if (Notification.permission === 'denied') return why('as notificações estão BLOQUEADAS para este site no navegador — libere nas configurações do site/navegador.');
	if (coolingDown) return why('o visitante recusou há pouco; o popup volta em ' + new Date(until).toLocaleString() + '.');

	arm(function () {
		show('permission');
	});
})(window, document);
