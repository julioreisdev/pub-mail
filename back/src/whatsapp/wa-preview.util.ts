// Prévia de mensagem para a lista de conversas e citações (sem dependências: pode ser
// importado por qualquer serviço, inclusive o presenter, sem criar import circular).
const PREVIEW: Record<string, string> = { image: '📷 Foto', video: '🎥 Vídeo', audio: '🎵 Áudio', voice: '🎤 Áudio', document: '📎 Documento', sticker: '🖼️ Figurinha', location: '📍 Localização', contact: '👤 Contato', poll: '📊 Enquete', revoked: '🚫 Mensagem apagada', call: '📞 Chamada' };

// Contato compartilhado (vCard) → "👤 Contato · Nome" / "👤 3 contatos · A, B, C".
// Aceita o vCard original (com quebras) e prévias antigas já achatadas em uma linha.
export function vcardPreview(body?: string | null): string | null {
  const b = String(body || '').replace(/\s+/g, ' ');
  if (!/BEGIN:VCARD/i.test(b)) return null;
  const names = [...b.matchAll(/(?:^|\s)(?:item\d+\.)?FN(?:;[^:\s]*)?:(.+?)(?=\s(?:item\d+\.)?[A-Z][A-Z0-9-]*[;:]|\sEND:VCARD|$)/gi)]
    .map((m) => m[1].replace(/\\([,;:\\])/g, '$1').trim())
    .filter(Boolean);
  const count = Math.max(names.length, (b.match(/BEGIN:VCARD/gi) || []).length);
  const list = names.slice(0, 3).join(', ');
  return (count > 1 ? `👤 ${count} contatos${list ? ` · ${list}` : ''}` : `👤 Contato${list ? ` · ${list}` : ''}`).slice(0, 255);
}

export function previewOf(type: string, body?: string | null) {
  if (type === 'contact') return vcardPreview(body) || '👤 Contato';
  const b = String(body || '').replace(/\s+/g, ' ').trim();
  if (type === 'text' || type === 'unknown' || type === 'masked') return b.slice(0, 255) || (type === 'masked' ? '🔒 Mensagem protegida' : '');
  return `${PREVIEW[type] || type}${b ? ` · ${b}` : ''}`.slice(0, 255);
}
