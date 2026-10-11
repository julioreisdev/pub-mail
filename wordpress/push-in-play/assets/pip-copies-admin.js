/* Push In Play — tela Copys: caixa de importação, seleção em massa, prévia ao vivo do editor e
 * "enviar como teste" (usa o PIP_FLOW_API do pip-flow-admin.js). Config em window.PIP_FLOW.
 */
(function (w, d) {
	'use strict';
	var cfg = w.PIP_FLOW || {};

	// caixa de importação (abre pelo botão; fica aberta quando a URL tem ?import=1 ou #pip-import)
	var imp = d.getElementById('pip-import');
	if (imp) {
		d.querySelectorAll('a[href$="#pip-import"]').forEach(function (a) {
			a.addEventListener('click', function (e) {
				e.preventDefault();
				imp.classList.add('is-open');
				imp.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
		});
		if (w.location.hash === '#pip-import') imp.classList.add('is-open');
		var file = imp.querySelector('input[type=file]');
		var lbl = imp.querySelector('[data-file-label]');
		if (file && lbl) file.addEventListener('change', function () {
			lbl.textContent = file.files && file.files[0] ? file.files[0].name : 'Escolher arquivo…';
		});
	}

	// seleção em massa
	var list = d.getElementById('pip-copies-form');
	if (list) {
		var boxes = list.querySelectorAll('input[name="ids[]"]');
		var all = list.querySelector('[data-check-all]');
		var count = list.querySelector('[data-bulk-count]');
		var btns = list.querySelectorAll('[data-bulk]');
		var sync = function () {
			var n = 0;
			boxes.forEach(function (b) {
				if (b.checked) n++;
			});
			if (count) count.textContent = n + ' selecionada(s)';
			btns.forEach(function (b) {
				b.disabled = !n;
			});
			if (all) all.checked = n > 0 && n === boxes.length;
		};
		boxes.forEach(function (b) {
			b.addEventListener('change', sync);
		});
		if (all) all.addEventListener('change', function () {
			boxes.forEach(function (b) {
				b.checked = all.checked;
			});
			sync();
		});
		btns.forEach(function (b) {
			b.addEventListener('click', function (e) {
				var m = b.getAttribute('data-confirm');
				if (m && !w.confirm(m)) e.preventDefault();
			});
		});
		sync();
	}

	// editor: prévia ao vivo + teste do formulário
	var form = d.getElementById('pip-copy-form');
	if (form) {
		var prev = d.getElementById('pip-copy-preview');
		var val = function (n) {
			var f = form.elements[n];
			return f ? f.value : '';
		};
		var emojiUrl = function (e) {
			var cps = [];
			for (var i = 0; i < e.length; i++) {
				var c = e.codePointAt(i);
				if (c > 0xffff) i++;
				cps.push(c);
			}
			if (cps.indexOf(0x200d) < 0) cps = cps.filter(function (c) {
				return c !== 0xfe0f;
			});
			return cps.length && cfg.twemoji ? cfg.twemoji + cps.map(function (c) {
				return c.toString(16);
			}).join('-') + '.png' : '';
		};
		var iconUrl = function () {
			var mode = val('c[icon_mode]');
			if (mode === 'image' && val('c[icon_url]')) return val('c[icon_url]');
			if (mode === 'emoji' && val('c[icon_emoji]').trim()) return emojiUrl(val('c[icon_emoji]').trim()) || cfg.icon;
			return cfg.icon;
		};
		var render = function () {
			if (!prev) return;
			prev.querySelector('.pip-notif__icon').src = iconUrl() || '';
			prev.querySelector('.pip-notif__title').textContent = val('c[title]') || '(sem título)';
			prev.querySelector('.pip-notif__text').textContent = val('c[body]');
			var img = prev.querySelector('.pip-notif__image');
			var iu = val('c[image_url]');
			img.hidden = !iu;
			if (iu) img.src = iu;
			var wrap = form.querySelector('[data-icon-fields]');
			if (wrap) wrap.setAttribute('data-mode', val('c[icon_mode]'));
		};
		form.addEventListener('input', render);
		form.addEventListener('change', render);
		render();
		var btn = d.getElementById('pip-copy-test-form');
		if (btn) btn.addEventListener('click', function () {
			if (!w.PIP_FLOW_API) return;
			w.PIP_FLOW_API.sendTest({ step: { title: val('c[title]'), body: val('c[body]'), icon_mode: val('c[icon_mode]'), icon_emoji: val('c[icon_emoji]'), icon_url: val('c[icon_url]'), image_url: val('c[image_url]'), url: val('c[url]') } }, btn);
		});
	}
})(window, document);
