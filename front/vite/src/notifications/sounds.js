// Sons das notificações no painel, sintetizados com WebAudio (sem arquivos de áudio).
// `default` = ping curto e suave; `chime` = dois tons; `ping` = agudo e seco; `alert` = três toques.
let ctx = null;
function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(ac, { freq, at, dur, gain = 0.18, type = 'sine' }) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ac.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export const SOUND_LABELS = {
  default: 'Padrão',
  chime: 'Sino',
  ping: 'Ping',
  alert: 'Alerta',
  none: 'Sem som'
};

/** Toca o som escolhido. Precisa de um gesto do usuário antes (o navegador bloqueia áudio automático). */
export function playSound(name = 'default') {
  if (!name || name === 'none') return false;
  const ac = audio();
  if (!ac) return false;
  const t = ac.currentTime + 0.01;
  try {
    switch (name) {
      case 'chime':
        tone(ac, { freq: 659.25, at: t, dur: 0.35, gain: 0.16 });
        tone(ac, { freq: 987.77, at: t + 0.16, dur: 0.5, gain: 0.14 });
        break;
      case 'ping':
        tone(ac, { freq: 1318.5, at: t, dur: 0.18, gain: 0.2, type: 'triangle' });
        break;
      case 'alert':
        tone(ac, { freq: 880, at: t, dur: 0.12, gain: 0.2, type: 'square' });
        tone(ac, { freq: 880, at: t + 0.18, dur: 0.12, gain: 0.2, type: 'square' });
        tone(ac, { freq: 1174.7, at: t + 0.36, dur: 0.28, gain: 0.18, type: 'square' });
        break;
      default:
        tone(ac, { freq: 783.99, at: t, dur: 0.22, gain: 0.16 });
        tone(ac, { freq: 1046.5, at: t + 0.1, dur: 0.3, gain: 0.14 });
    }
    return true;
  } catch {
    return false;
  }
}

/** Vibra (celular) com o padrão vindo do servidor ([ms…]) — no desktop não faz nada. */
export function vibrate(pattern) {
  try {
    if (Array.isArray(pattern) && pattern.length && typeof navigator !== 'undefined' && navigator.vibrate)
      return navigator.vibrate(pattern);
  } catch {
    /* sem permissão / sem suporte */
  }
  return false;
}

/** Destrava o áudio no primeiro gesto (chamar em click/keydown): depois disso os sons tocam sozinhos. */
export function primeAudio() {
  const ac = audio();
  if (!ac) return;
  try {
    const b = ac.createBuffer(1, 1, 22050);
    const s = ac.createBufferSource();
    s.buffer = b;
    s.connect(ac.destination);
    s.start(0);
  } catch {
    /* ignore */
  }
}
