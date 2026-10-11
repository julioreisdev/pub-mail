/* Push In Play — renderizador do popup de permissão. Compartilhado pelo site (pip-front.js)
 * e pela prévia do editor (pip-admin.js), para a prévia ser exatamente o que o visitante vê.
 * Sem dependências. Expõe window.PIP = { TYPES, DEFAULT_CSS, cssFor, build }.
 */
(function (w, d) {
	'use strict';
	var PIP = (w.PIP = w.PIP || {});

	PIP.TYPES = {
		modal: 'Modal no centro',
		'bar-top': 'Barra no topo',
		'bar-bottom': 'Barra no rodapé',
		'corner-tl': 'Canto superior esquerdo',
		'corner-tr': 'Canto superior direito',
		'corner-bl': 'Canto inferior esquerdo',
		'corner-br': 'Canto inferior direito'
	};

	// Celular (tela ≤ 640 px no site; classe pip-narrow na prévia): cantos viram faixas com margem,
	// mantendo a posição vertical escolhida (topo ou rodapé); barras ganham botões em largura total.
	var MOBILE =
		'.pip-type-corner-tl .pip-box,.pip-type-corner-tr .pip-box{left:12px;right:12px;top:12px;bottom:auto;width:auto}' +
		'.pip-type-corner-bl .pip-box,.pip-type-corner-br .pip-box{left:12px;right:12px;bottom:12px;top:auto;width:auto}' +
		'.pip-type-bar-top .pip-actions,.pip-type-bar-bottom .pip-actions{width:100%}' +
		'.pip-type-bar-top .pip-close,.pip-type-bar-bottom .pip-close{position:absolute;top:8px;right:8px;margin:0}' +
		'.pip-type-bar-top .pip-body,.pip-type-bar-bottom .pip-body{padding-right:26px}';
	var MOBILE_MQ = '@media (max-width:640px){' + MOBILE + '}';
	var MOBILE_NARROW = MOBILE.replace(/\.pip-type-/g, '.pip-narrow.pip-type-');

	PIP.DEFAULT_CSS = [
		'.pip-root{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif;color:var(--pip-fg,#0b1120);-webkit-font-smoothing:antialiased;line-height:1.4}',
		'.pip-root *{box-sizing:border-box;margin:0}',
		'.pip-overlay{position:absolute;inset:0;background:var(--pip-overlay,rgba(11,17,32,.55));pointer-events:auto;animation:pip-fade .3s ease}',
		'.pip-box{position:absolute;pointer-events:auto;display:flex;gap:14px;align-items:flex-start;width:min(92%,400px);padding:20px;background:var(--pip-bg,#fff);border-radius:var(--pip-radius,16px);box-shadow:0 18px 50px rgba(11,17,32,.22);animation:pip-fade .35s ease}',
		'.pip-type-modal .pip-box{left:50%;top:50%;transform:translate(-50%,-50%);width:min(92%,420px);flex-direction:column;align-items:center;text-align:center;padding:30px 26px 24px}',
		'.pip-type-corner-tl .pip-box{left:20px;top:20px}',
		'.pip-type-corner-tr .pip-box{right:20px;top:20px}',
		'.pip-type-corner-bl .pip-box{left:20px;bottom:20px}',
		'.pip-type-corner-br .pip-box{right:20px;bottom:20px}',
		'.pip-type-bar-top .pip-box,.pip-type-bar-bottom .pip-box{left:0;right:0;width:auto;max-width:none;align-items:center;flex-wrap:wrap;padding:14px 20px;box-shadow:0 10px 40px rgba(11,17,32,.18)}',
		'.pip-type-bar-top .pip-box{top:0;border-radius:0 0 var(--pip-radius,16px) var(--pip-radius,16px)}',
		'.pip-type-bar-bottom .pip-box{bottom:0;border-radius:var(--pip-radius,16px) var(--pip-radius,16px) 0 0}',
		'.pip-icon{flex-shrink:0;width:48px;height:48px;border-radius:14px;display:grid;place-items:center;font-size:26px;background:rgba(127,127,127,.12);overflow:hidden}',
		'.pip-icon img{width:100%;height:100%;object-fit:cover;display:block}',
		'.pip-type-modal .pip-icon{width:64px;height:64px;border-radius:20px;font-size:34px;margin-bottom:14px}',
		'.pip-body{flex:1;min-width:0}',
		'.pip-type-bar-top .pip-body,.pip-type-bar-bottom .pip-body{flex:1 1 260px}',
		'.pip-title{font-weight:700;font-size:17px;letter-spacing:-.01em;margin-bottom:4px}',
		'.pip-type-modal .pip-title{font-size:20px}',
		'.pip-text{font-size:14px;opacity:.82}',
		'.pip-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}',
		'.pip-type-modal .pip-actions{justify-content:center;margin-top:20px}',
		'.pip-type-bar-top .pip-actions,.pip-type-bar-bottom .pip-actions{margin-top:0;flex-shrink:0}',
		'.pip-btn{border:0;cursor:pointer;font:inherit;font-weight:700;font-size:14px;line-height:1;padding:12px 18px;border-radius:calc(var(--pip-radius,16px) - 4px);transition:filter .15s ease,transform .15s ease}',
		'.pip-btn:hover{filter:brightness(1.06)}.pip-btn:active{transform:scale(.98)}',
		'.pip-accept{background:var(--pip-btn,#377ef0);color:var(--pip-btn-fg,#fff)}',
		'.pip-dismiss{background:transparent;color:var(--pip-fg,#0b1120);opacity:.65}.pip-dismiss:hover{opacity:1;background:rgba(127,127,127,.1)}',
		'.pip-close{position:absolute;top:8px;right:8px;width:30px;height:30px;border:0;border-radius:50%;background:transparent;color:var(--pip-fg,#0b1120);opacity:.5;cursor:pointer;font-size:20px;line-height:1;display:grid;place-items:center}.pip-close:hover{opacity:1;background:rgba(127,127,127,.12)}',
		'.pip-type-bar-top .pip-close,.pip-type-bar-bottom .pip-close{position:static;margin-left:4px}',
		'.pip-steps{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:6px;font-size:13px;opacity:.9}.pip-steps li{display:flex;gap:8px;align-items:center}.pip-steps b{flex-shrink:0;width:20px;height:20px;border-radius:50%;background:var(--pip-btn,#377ef0);color:var(--pip-btn-fg,#fff);font-size:11px;font-weight:700;display:grid;place-items:center}',
		'.pip-share-ico{display:inline-block;width:15px;height:15px;vertical-align:-2px;margin-right:6px}',
		'.pip-sheet{margin:12px 0 2px;padding:8px 10px 6px;border-radius:12px;background:rgba(127,127,127,.1);font-size:12.5px}.pip-sheet__bar{width:36px;height:4px;border-radius:2px;background:rgba(127,127,127,.4);margin:0 auto 8px}.pip-sheet__apps{display:flex;gap:10px;margin-bottom:8px}.pip-sheet__apps i{width:30px;height:30px;border-radius:9px;background:rgba(127,127,127,.22)}.pip-sheet__row{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;opacity:.55}.pip-sheet__row i{width:16px;height:16px;border-radius:4px;border:1.5px solid currentColor;flex-shrink:0}.pip-sheet__row.is-hit{opacity:1;background:var(--pip-bg,#fff);box-shadow:0 0 0 2px var(--pip-btn,#377ef0);font-weight:700}.pip-sheet__row.is-hit i{border-color:var(--pip-btn,#377ef0);position:relative}.pip-sheet__row.is-hit i:before,.pip-sheet__row.is-hit i:after{content:"";position:absolute;left:50%;top:50%;background:var(--pip-btn,#377ef0);transform:translate(-50%,-50%)}.pip-sheet__row.is-hit i:before{width:8px;height:1.5px}.pip-sheet__row.is-hit i:after{width:1.5px;height:8px}.pip-sheet__tip{font-size:11.5px;opacity:.7;margin-top:4px;text-align:center}',
		'@keyframes pip-fade{from{opacity:0}to{opacity:1}}',
		MOBILE_MQ,
		MOBILE_NARROW,
		'@media (prefers-reduced-motion:reduce){.pip-overlay,.pip-box{animation:none}}',
		'.pip-preview .pip-root{position:absolute}'
	].join('\n');

	/** CSS final de um layout: o padrão + o do usuário, ou só o do usuário (modo "substituir"). */
	PIP.cssFor = function (layout) {
		var custom = String(layout.custom_css || '');
		if (layout.css_mode === 'replace' && custom.trim()) return custom;
		return PIP.DEFAULT_CSS + (custom.trim() ? '\n/* custom */\n' + custom : '');
	};

	function el(tag, cls, text) {
		var e = d.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	/**
	 * Monta o popup. `layout` = { type, config:{...} }. Devolve { root, accept, dismiss, close }.
	 * Nada de HTML vindo do usuário entra como HTML: só textContent.
	 */
	var SHARE_SVG = '<svg class="pip-share-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';

	/** Caminho das configurações de notificação do navegador atual (para o texto "negado"). */
	PIP.browserPath = function () {
		var ua = navigator.userAgent;
		if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet → ⋮ → Configurações → Sites e downloads → Notificações (e, no Android, Configurações → Apps → Samsung Internet → Notificações ligadas)';
		if (/iPhone|iPad|iPod/.test(ua)) return 'Ajustes do iPhone → Notificações → nome do site';
		if (/Firefox|FxiOS/i.test(ua)) return 'Firefox → ⋮ → Configurações → Permissões do site → Notificações';
		if (/Edg\//i.test(ua)) return 'Edge → ⋮ → Configurações → Permissões do site → Notificações';
		if (/Android/i.test(ua)) return 'Chrome → ⋮ → Configurações → Configurações do site → Notificações (e, no Android, Configurações → Apps → Chrome → Notificações ligadas)';
		return 'ícone de cadeado ao lado do endereço → Notificações → Permitir';
	};

	/** Monta o popup. variant: 'permission' (padrão), 'ios', 'install' (app no Android/PC) ou 'denied' (navegador negou). */
	PIP.build = function (layout, variant) {
		var c = layout.config || {};
		var inst = c.install || {};
		variant = variant || 'permission';
		var type = PIP.TYPES[layout.type] ? layout.type : 'modal';
		var colors = c.colors || {};
		var root = el('div', 'pip-root pip-type-' + type);
		root.setAttribute('role', 'dialog');
		root.setAttribute('aria-label', c.title || c.accept || '');
		root.style.setProperty('--pip-bg', colors.bg || '#ffffff');
		root.style.setProperty('--pip-fg', colors.fg || '#0b1120');
		root.style.setProperty('--pip-btn', colors.btn || '#377ef0');
		root.style.setProperty('--pip-btn-fg', colors.btn_fg || '#ffffff');
		root.style.setProperty('--pip-overlay', colors.overlay || 'rgba(11,17,32,.55)');
		root.style.setProperty('--pip-radius', (c.radius == null ? 16 : Number(c.radius)) + 'px');

		if (type === 'modal') root.appendChild(el('div', 'pip-overlay'));
		var box = el('div', 'pip-box');

		var icon = c.icon || {};
		var mode = icon.mode || 'emoji';
		if (mode !== 'none') {
			var ic = el('div', 'pip-icon');
			if ((mode === 'image' || mode === 'site') && icon.url) {
				var img = d.createElement('img');
				img.src = icon.url;
				img.alt = '';
				ic.appendChild(img);
			} else {
				ic.textContent = icon.emoji || '🔔';
			}
			box.appendChild(ic);
		}

		var body = el('div', 'pip-body');
		// Nenhum texto fixo aqui: tudo vem da configuração do layout; em branco = não aparece.
		var title = c.title;
		var text = c.message;
		var acceptLabel = c.accept;
		if (variant === 'ios') {
			title = inst.ios_title;
			text = inst.ios_message;
			acceptLabel = layout.inApp ? inst.ios_safari : inst.ios_button;
		} else if (variant === 'install') {
			title = inst.title;
			text = inst.message;
			acceptLabel = inst.button;
		} else if (variant === 'denied') {
			title = c.denied_title;
			text = String(c.denied_text || '').replace('{browser}', PIP.browserPath());
			acceptLabel = '';
		}
		if (title && String(title).trim()) body.appendChild(el('div', 'pip-title', title));
		if (text && String(text).trim()) body.appendChild(el('div', 'pip-text', text));
		if (variant === 'ios') {
			var stepTexts = [inst.ios_step1, inst.ios_step2, inst.ios_step3].filter(function (t) {
				return t && String(t).trim();
			});
			if (stepTexts.length) {
				var steps = el('ol', 'pip-steps');
				stepTexts.forEach(function (t, i) {
					var li = el('li');
					li.appendChild(el('b', '', String(i + 1)));
					var span = el('span');
					// texto como texto (sem HTML); só o marcador {share} vira o ícone
					String(t).split('{share}').forEach(function (part, k) {
						if (k > 0) span.insertAdjacentHTML('beforeend', SHARE_SVG.replace('margin-right:6px', 'margin:0 2px'));
						if (part) span.appendChild(d.createTextNode(part));
					});
					li.appendChild(span);
					steps.appendChild(li);
				});
				body.appendChild(steps);
			}
			// ilustração da folha de compartilhar do iPhone, com o item certo destacado
			if (inst.ios_guide !== false) {
				var sheet = el('div', 'pip-sheet');
				sheet.setAttribute('aria-hidden', 'true');
				sheet.appendChild(el('div', 'pip-sheet__bar'));
				var apps = el('div', 'pip-sheet__apps');
				for (var a = 0; a < 5; a++) apps.appendChild(el('i'));
				sheet.appendChild(apps);
				var rows = String(inst.ios_rows || '').split('|').map(function (t) {
					return t.trim();
				}).filter(Boolean).map(function (t) {
					return ['', t];
				});
				rows.push(['is-hit', inst.ios_target || '']);
				rows.forEach(function (r) {
					var row = el('div', 'pip-sheet__row' + (r[0] ? ' ' + r[0] : ''));
					row.appendChild(el('i'));
					row.appendChild(el('span', '', r[1]));
					sheet.appendChild(row);
				});
				if (inst.ios_tip && String(inst.ios_tip).trim()) sheet.appendChild(el('div', 'pip-sheet__tip', inst.ios_tip));
				body.appendChild(sheet);
			}
		}
		var actions = el('div', 'pip-actions');
		var accept = el('button', 'pip-btn pip-accept', acceptLabel || '');
		accept.type = 'button';
		if (variant === 'ios') accept.insertAdjacentHTML('afterbegin', SHARE_SVG);
		if (variant !== 'denied') actions.appendChild(accept);
		var dismiss = null;
		if (variant === 'denied') {
			dismiss = el('button', 'pip-btn pip-accept', c.denied_button || 'OK');
			dismiss.type = 'button';
			actions.appendChild(dismiss);
		} else if (c.show_dismiss !== false) {
			dismiss = el('button', 'pip-btn pip-dismiss', c.dismiss || '');
			dismiss.type = 'button';
			actions.appendChild(dismiss);
		}
		if (type === 'bar-top' || type === 'bar-bottom') {
			box.appendChild(body);
			box.appendChild(actions);
		} else {
			body.appendChild(actions);
			box.appendChild(body);
		}
		var close = null;
		if (c.show_close !== false) {
			close = el('button', 'pip-close', '×');
			close.type = 'button';
			close.setAttribute('aria-label', 'Fechar');
			box.appendChild(close);
		}
		root.appendChild(box);
		root.setAttribute('data-variant', variant);
		return { root: root, accept: accept, dismiss: dismiss, close: close, variant: variant };
	};
})(window, document);
