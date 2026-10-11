/* Push In Play — sons sintetizados (WebAudio, sem arquivos). Usados no painel (ouvir) e no site
 * (toca quando a notificação chega com o site aberto numa aba). window.PIP_SOUNDS = { names, play, vibrate, patterns }.
 */
(function (w) {
	'use strict';
	var ctx = null;
	function ac() {
		if (!ctx) {
			var AC = w.AudioContext || w.webkitAudioContext;
			if (!AC) return null;
			ctx = new AC();
		}
		if (ctx.state === 'suspended') ctx.resume();
		return ctx;
	}
	function tone(c, t0, freq, dur, type, gain) {
		var o = c.createOscillator();
		var g = c.createGain();
		o.type = type || 'sine';
		o.frequency.setValueAtTime(freq, t0);
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(gain || 0.25, t0 + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		o.connect(g).connect(c.destination);
		o.start(t0);
		o.stop(t0 + dur + 0.05);
	}
	var SOUNDS = {
		chime: { label: 'Sino suave', play: function (c, t) {
			tone(c, t, 880, 0.35, 'sine', 0.22);
			tone(c, t + 0.18, 1175, 0.5, 'sine', 0.22);
		} },
		ping: { label: 'Ping', play: function (c, t) {
			tone(c, t, 1568, 0.45, 'triangle', 0.2);
		} },
		pop: { label: 'Pop', play: function (c, t) {
			tone(c, t, 420, 0.12, 'sine', 0.3);
		} },
		ding: { label: 'Ding', play: function (c, t) {
			tone(c, t, 1046, 0.7, 'sine', 0.2);
			tone(c, t, 2093, 0.4, 'sine', 0.06);
		} },
		alert: { label: 'Alerta (3 toques)', play: function (c, t) {
			tone(c, t, 988, 0.12, 'square', 0.12);
			tone(c, t + 0.17, 988, 0.12, 'square', 0.12);
			tone(c, t + 0.34, 1319, 0.25, 'square', 0.12);
		} },
		bell: { label: 'Campainha', play: function (c, t) {
			tone(c, t, 659, 0.6, 'triangle', 0.2);
			tone(c, t + 0.25, 523, 0.7, 'triangle', 0.2);
		} }
	};
	var PATTERNS = {
		none: { label: 'Sem vibração', value: null },
		short: { label: 'Curta', value: [120] },
		double: { label: 'Dupla', value: [100, 80, 100] },
		long: { label: 'Longa', value: [400] },
		triple: { label: 'Tripla', value: [80, 60, 80, 60, 80] },
		sos: { label: 'Insistente', value: [200, 100, 200, 100, 400] }
	};
	w.PIP_SOUNDS = {
		names: Object.keys(SOUNDS).reduce(function (o, k) {
			o[k] = SOUNDS[k].label;
			return o;
		}, {}),
		patterns: Object.keys(PATTERNS).reduce(function (o, k) {
			o[k] = PATTERNS[k];
			return o;
		}, {}),
		play: function (name) {
			var s = SOUNDS[name] || SOUNDS.chime;
			var c = ac();
			if (!c) return false;
			s.play(c, c.currentTime + 0.02);
			return true;
		},
		vibrate: function (name) {
			var p = PATTERNS[name];
			if (!p || !p.value || !navigator.vibrate) return false;
			return navigator.vibrate(p.value);
		}
	};
})(window);
