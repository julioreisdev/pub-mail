/* Push In Play — tela Broadcasts: lista de horários (adicionar/remover) e destaque das escolhas. */
(function (w, d) {
	'use strict';
	var box = d.querySelector('[data-times]');
	if (box) {
		var row = function (value) {
			var r = d.createElement('div');
			r.className = 'pip-times__row';
			var input = d.createElement('input');
			input.type = 'time';
			input.name = 'b[times][]';
			input.required = true;
			input.value = value || '';
			var btn = d.createElement('button');
			btn.type = 'button';
			btn.className = 'pip-button is-ghost is-danger';
			btn.setAttribute('data-remove-time', '');
			btn.setAttribute('aria-label', 'Remover horário');
			btn.textContent = '×';
			r.appendChild(input);
			r.appendChild(btn);
			return r;
		};
		var add = d.querySelector('[data-add-time]');
		if (add) add.addEventListener('click', function () {
			var r = row('');
			box.appendChild(r);
			r.querySelector('input').focus();
		});
		box.addEventListener('click', function (e) {
			var b = e.target.closest('[data-remove-time]');
			if (!b) return;
			b.parentNode.parentNode.removeChild(b.parentNode);
			if (!box.children.length) box.appendChild(row('12:00'));
		});
		if (!box.children.length) box.appendChild(row('12:00'));
	}
	d.querySelectorAll('.pip-choices').forEach(function (group) {
		group.addEventListener('change', function () {
			group.querySelectorAll('label').forEach(function (l) {
				var r = l.querySelector('input[type=radio]');
				l.classList.toggle('is-active', !!(r && r.checked));
			});
		});
	});
})(window, document);
