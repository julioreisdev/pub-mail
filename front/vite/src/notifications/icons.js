import { post } from 'api/api';

// Ícones das notificações: emoji → PNG (desenhado no canvas com a fonte de emoji do aparelho) e
// upload de imagem. O servidor guarda em uploads/notification-icons/<usuário>[-slot].png e devolve a URL.

export const ICON_EMOJIS = ['🔔', '💬', '📣', '⚡', '✅', '🚀', '💰', '📅', '🧪', '🎉', '❗', '🤖', '📞', '🛒', '⭐', '🔥'];

/** Desenha o emoji num quadrado de `size` px (fundo branco com cantos arredondados) e devolve o PNG. */
export function emojiToPng(emoji, size = 192) {
  return new Promise((resolve, reject) => {
    try {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const x = c.getContext('2d');
      const r = size * 0.22;
      x.fillStyle = '#ffffff';
      x.beginPath();
      x.moveTo(r, 0);
      x.arcTo(size, 0, size, size, r);
      x.arcTo(size, size, 0, size, r);
      x.arcTo(0, size, 0, 0, r);
      x.arcTo(0, 0, size, 0, r);
      x.closePath();
      x.fill();
      x.font = `${Math.round(size * 0.6)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(emoji, size / 2, size / 2 + size * 0.04);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas vazio'))), 'image/png');
    } catch (e) {
      reject(e);
    }
  });
}

/** Envia a imagem (Blob/File) para o servidor. `slot` separa o ícone geral dos avisos personalizados. → url */
export async function uploadIcon(blob, slot) {
  const fd = new FormData();
  fd.append('file', blob, 'icon.png');
  const r = await post(`/notifications/icon${slot ? `?slot=${encodeURIComponent(slot)}` : ''}`, fd, {
    headers: { 'Content-Type': undefined }
  });
  return r?.url || r?.data?.url || null;
}

export const isHttpUrl = (u) => /^https?:\/\/\S+$/i.test(String(u || '').trim());
