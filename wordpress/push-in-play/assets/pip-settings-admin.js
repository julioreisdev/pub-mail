/* Push In Play — tela Configurações básicas: ouvir sons, testar vibração, destaque das escolhas e
 * prévia do "Enviar agora". Config em window.PIP_SETTINGS = { site, icon, twemoji }.
 */
(function (w, d) {
	'use strict';
	var S = w.PIP_SOUNDS;
	d.querySelectorAll('.pip-play').forEach(function (b) {
		b.addEventListener('click', function () {
			if (!S || !S.play(b.getAttribute('data-sound'))) w.alert('Este navegador não deixou tocar o som.');
		});
	});
	d.querySelectorAll('.pip-vibe').forEach(function (b) {
		b.addEventListener('click', function () {
			if (!S || !S.vibrate(b.getAttribute('data-vibe'))) {
				var old = b.textContent;
				b.textContent = 'só no Android';
				w.setTimeout(function () {
					b.textContent = old;
				}, 1800);
			}
		});
	});
	// destaque do item escolhido
	d.querySelectorAll('.pip-choices, .pip-sound-list').forEach(function (group) {
		group.addEventListener('change', function () {
			group.querySelectorAll('label').forEach(function (l) {
				var r = l.querySelector('input[type=radio]');
				l.classList.toggle('is-active', !!(r && r.checked));
			});
		});
	});

	// prévia do "Enviar agora"
	var form = d.getElementById('pip-blast-form');
	var cfg = w.PIP_SETTINGS || {};
	if (form) {
		var prev = d.getElementById('pip-blast-preview');
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
		function render() {
			var mode = val('b[icon_mode]');
			var icon = cfg.icon;
			if (mode === 'image' && val('b[icon_url]')) icon = val('b[icon_url]');
			if (mode === 'emoji' && val('b[icon_emoji]').trim()) icon = emojiUrl(val('b[icon_emoji]').trim()) || cfg.icon;
			prev.querySelector('.pip-notif__icon').src = icon;
			prev.querySelector('.pip-notif__title').textContent = val('b[title]') || '(sem título)';
			prev.querySelector('.pip-notif__text').textContent = val('b[body]');
			var img = prev.querySelector('.pip-notif__image');
			img.hidden = !val('b[image_url]');
			if (val('b[image_url]')) img.src = val('b[image_url]');
			var wrap = form.querySelector('[data-icon-fields]');
			if (wrap) wrap.setAttribute('data-mode', mode);
		}
		form.addEventListener('input', render);
		form.addEventListener('change', render);
		render();
	}
})(window, document);
