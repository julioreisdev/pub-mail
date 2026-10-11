/* Push In Play — editor de layout: prévia ao vivo (mesmo renderizador do site), tipo por cartões,
 * cor + hex sincronizados, CSS padrão para copiar. Tudo sem dependências.
 */
(function (w, d) {
	'use strict';
	var form = d.getElementById('pip-layout-form');
	var stage = d.getElementById('pip-stage');
	var PIP = w.PIP;
	if (!form || !stage || !PIP) return;

	function val(name) {
		var f = form.elements[name];
		if (!f) return '';
		if (f.type === 'checkbox') return f.checked;
		return f.value;
	}

	function read() {
		var iconMode = val('c[icon_mode]');
		return {
			type: val('l[type]') || 'modal',
			css_mode: val('css_mode') || 'append',
			custom_css: val('custom_css'),
			config: {
				title: val('c[title]'),
				message: val('c[message]'),
				accept: val('c[accept]'),
				dismiss: val('c[dismiss]'),
				show_dismiss: val('c[show_dismiss]'),
				show_close: val('c[show_close]'),
				denied_title: val('c[denied_title]'),
				denied_text: val('c[denied_text]'),
				denied_button: val('c[denied_button]'),
				radius: val('c[radius]'),
				icon: { mode: iconMode, emoji: val('c[icon_emoji]'), url: iconMode === 'site' ? form.dataset.siteIcon : val('c[icon_url]') },
				colors: { bg: val('c[bg]'), fg: val('c[fg]'), btn: val('c[btn]'), btn_fg: val('c[btn_fg]'), overlay: val('c[overlay]') },
				install: {
					ios_enabled: val('c[ios_enabled]'),
					app_enabled: val('c[app_enabled]'),
					title: val('c[install_title]'),
					message: val('c[install_message]'),
					button: val('c[install_button]'),
					ios_title: val('c[ios_title]'),
					ios_message: val('c[ios_message]'),
					ios_button: val('c[ios_button]'),
					ios_step1: val('c[ios_step1]'),
					ios_step2: val('c[ios_step2]'),
					ios_step3: val('c[ios_step3]'),
					ios_retry: val('c[ios_retry]'),
					ios_guide: val('c[ios_guide]'),
					ios_target: val('c[ios_target]'),
					ios_safari: val('c[ios_safari]'),
					ios_rows: val('c[ios_rows]'),
					ios_tip: val('c[ios_tip]')
				}
			}
		};
	}

	var style = d.getElementById('pip-preview-style');
	if (!style) {
		style = d.createElement('style');
		style.id = 'pip-preview-style';
		d.head.appendChild(style);
	}

	var variant = 'permission';
	function render() {
		var layout = read();
		style.textContent = PIP.cssFor(layout);
		var old = stage.querySelector('.pip-root');
		if (old) old.remove();
		var ui = PIP.build(layout, variant);
		ui.root.style.pointerEvents = 'none';
		if (stage.closest('.pip-preview').getAttribute('data-size') === 'phone') ui.root.classList.add('pip-narrow');
		stage.appendChild(ui.root);
		var icon = form.querySelector('[data-icon-fields]');
		if (icon) icon.setAttribute('data-mode', layout.config.icon.mode);
	}

	// cor <input type=color> ↔ texto hex
	form.querySelectorAll('[data-color]').forEach(function (wrap) {
		var color = wrap.querySelector('input[type=color]');
		var text = wrap.querySelector('input[type=text]');
		if (!color || !text) return;
		color.addEventListener('input', function () {
			text.value = color.value;
			render();
		});
		text.addEventListener('input', function () {
			if (/^#[0-9a-f]{6}$/i.test(text.value)) color.value = text.value;
			render();
		});
	});

	// tipo por cartões (radio escondido)
	form.querySelectorAll('.pip-type-card input[type=radio]').forEach(function (r) {
		r.addEventListener('change', function () {
			form.querySelectorAll('.pip-type-card').forEach(function (c) {
				c.classList.toggle('is-active', c.contains(r) && r.checked);
			});
			render();
		});
	});

	form.addEventListener('input', render);
	form.addEventListener('change', render);

	// ver / copiar o CSS padrão
	var btnDefault = d.getElementById('pip-css-default');
	if (btnDefault) {
		btnDefault.addEventListener('click', function () {
			var ta = form.elements['custom_css'];
			if (!ta) return;
			if (ta.value.trim() && !w.confirm('Substituir o CSS personalizado atual pelo CSS padrão?')) return;
			ta.value = PIP.DEFAULT_CSS;
			var mode = form.elements['css_mode'];
			if (mode && mode.length) mode[1].checked = true; // replace
			render();
		});
	}

	// variante da prévia (permissão / iPhone / instalar app)
	d.querySelectorAll('[data-stage-variant]').forEach(function (b) {
		b.addEventListener('click', function () {
			d.querySelectorAll('[data-stage-variant]').forEach(function (x) {
				x.classList.toggle('is-active', x === b);
			});
			variant = b.getAttribute('data-stage-variant');
			render();
		});
	});

	// prévia em escala real: o aparelho é desenhado no tamanho verdadeiro (1024 px / 390 px) e
	// reduzido para caber na coluna → proporção igual à da tela de verdade.
	var SIZES = { desktop: { w: 1024, h: 640, max: 1 }, phone: { w: 390, h: 780, max: 0.78 } };
	var preview = stage.closest('.pip-preview');
	function fitStage() {
		var size = preview.getAttribute('data-size') || 'desktop';
		var dev = preview.querySelector('.pip-device');
		if (!dev) return;
		var sz = SIZES[size] || SIZES.desktop;
		var cs = w.getComputedStyle(preview);
		var avail = preview.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
		var scale = Math.min(sz.max, avail / sz.w);
		dev.style.width = sz.w + 'px';
		dev.style.transform = 'scale(' + scale + ')';
		var scr = dev.querySelector('.pip-device__screen');
		if (scr) scr.style.height = sz.h + 'px';
		dev.parentNode.style.height = Math.round(dev.offsetHeight * scale) + 'px';
		dev.parentNode.style.width = Math.round(sz.w * scale) + 'px';
	}
	w.addEventListener('resize', fitStage);

	// modo de tela da prévia (desktop / celular)
	d.querySelectorAll('[data-stage-size]').forEach(function (b) {
		b.addEventListener('click', function () {
			d.querySelectorAll('[data-stage-size]').forEach(function (x) {
				x.classList.toggle('is-active', x === b);
			});
			stage.closest('.pip-preview').setAttribute('data-size', b.getAttribute('data-stage-size'));
			render();
			fitStage();
		});
	});

	render();
	fitStage();
	w.setTimeout(fitStage, 300);
})(window, document);
