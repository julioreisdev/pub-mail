import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import {
  IconPhoto,
  IconVideo,
  IconMusic,
  IconMicrophone,
  IconFileText,
  IconSticker,
  IconMapPin,
  IconUser,
  IconChartBar,
  IconBan,
  IconPhone,
  IconLock,
  IconTrash,
  IconMessage
} from '@tabler/icons-react';

// Ícones profissionais no lugar dos emojis nas prévias (lista de conversas, citações, respostas,
// encaminhar). As prévias gravadas pelo back ainda podem começar com emoji (📷 Foto, 🎥 Vídeo…):
// `splitPreview` reconhece o emoji, remove e devolve o ícone correspondente.

export const TYPE_ICON = {
  image: IconPhoto,
  video: IconVideo,
  audio: IconMusic,
  voice: IconMicrophone,
  document: IconFileText,
  sticker: IconSticker,
  location: IconMapPin,
  contact: IconUser,
  poll: IconChartBar,
  revoked: IconBan,
  deleted: IconTrash,
  call: IconPhone,
  masked: IconLock,
  text: null
};

export const TYPE_TEXT = {
  image: 'Foto',
  video: 'Vídeo',
  audio: 'Áudio',
  voice: 'Mensagem de voz',
  document: 'Documento',
  sticker: 'Figurinha',
  location: 'Localização',
  contact: 'Contato',
  poll: 'Enquete',
  revoked: 'Mensagem apagada',
  deleted: 'Mensagem apagada',
  call: 'Chamada',
  masked: 'Mensagem protegida',
  unknown: 'Mensagem não suportada'
};

// emoji inicial → tipo (prévias antigas gravadas no banco)
const EMOJI_TYPE = [
  ['📷', 'image'],
  ['🎥', 'video'],
  ['🎬', 'video'],
  ['🎵', 'audio'],
  ['🎤', 'voice'],
  ['📎', 'document'],
  ['📄', 'document'],
  ['🖼️', 'sticker'],
  ['🖼', 'sticker'],
  ['📍', 'location'],
  ['👤', 'contact'],
  ['📊', 'poll'],
  ['🚫', 'revoked'],
  ['📞', 'call'],
  ['🔒', 'masked']
];

/** `"📷 Foto · legenda"` → `{ type: 'image', text: 'Foto · legenda' }`; texto comum → `{ type: null, text }`. */
export function splitPreview(preview) {
  const s = String(preview || '');
  for (const [emoji, type] of EMOJI_TYPE) {
    if (s.startsWith(emoji)) return { type, text: s.slice(emoji.length).replace(/^️?\s*/, '') };
  }
  return { type: null, text: s };
}

/** Texto curto de uma mensagem (sem emoji): usado em citações/respostas/encaminhar/copiar. */
export function previewText(m) {
  if (!m) return '';
  if (m.revoked || m.type === 'revoked' || m.deleted || m.type === 'deleted') return TYPE_TEXT.revoked;
  if (m.type === 'text' || !m.type) return m.body || '';
  const label = TYPE_TEXT[m.type] || TYPE_TEXT.unknown;
  return m.body ? `${label} · ${m.body}` : label;
}

/** Ícone + texto da prévia, numa linha só (noWrap). `type` opcional (mensagem conhecida); senão deduz do emoji. */
export function PreviewText({ preview, type, size = 14, sx, iconSx }) {
  const parsed = type ? { type, text: String(preview || '') } : splitPreview(preview);
  const Icon = parsed.type ? TYPE_ICON[parsed.type] || IconMessage : null;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0, maxWidth: '100%', ...sx }}>
      {Icon ? (
        <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0, opacity: 0.75, ...iconSx }}>
          <Icon size={size} stroke={2} />
        </Box>
      ) : null}
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {parsed.text}
      </Box>
    </Box>
  );
}
PreviewText.propTypes = {
  preview: PropTypes.string,
  type: PropTypes.string,
  size: PropTypes.number,
  sx: PropTypes.object,
  iconSx: PropTypes.object
};
