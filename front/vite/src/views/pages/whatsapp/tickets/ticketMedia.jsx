import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconDownload, IconFile, IconFileTypePdf, IconMicrophone, IconMovie, IconPaperclip, IconX } from '@tabler/icons-react';

import { post } from 'api/api';
import { dlUrl, fmtBytes } from '../waShared';

// ============================================================================
// Anexos dos chamados: envio para POST /whatsapp/media (multipart `file`, mesmo
// endpoint do chat/status) e exibição — imagem = miniatura (abre em nova aba),
// vídeo = player, demais = cartão com link de download (URL assinada).
// Forma da mídia (back `toPublic`): { id, kind, mime, filename, size, url }.
// ============================================================================

export const MAX_FILE_MB = 64;

/** Sobe um arquivo e devolve a mídia pública ({ id, url, … }). Lança com mensagem amigável. */
export async function uploadTicketMedia(file, onProgress) {
  if (!file) throw new Error('Nenhum arquivo.');
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Arquivo grande demais (máx. ${MAX_FILE_MB} MB).`);
  const fd = new FormData();
  fd.append('file', file);
  const res = await post('/whatsapp/media', fd, {
    headers: { 'Content-Type': undefined },
    onUploadProgress: (e) => {
      if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    }
  });
  if (!res?.id) throw new Error(res?.error || 'O servidor não devolveu o arquivo.');
  return { ...res, filename: res.filename || file.name };
}

const kindOf = (m) => {
  const k = String(m?.kind || '').toLowerCase();
  const mime = String(m?.mime || m?.mimetype || '');
  if (k === 'image' || k === 'sticker' || mime.startsWith('image/')) return 'image';
  if (k === 'video' || mime.startsWith('video/')) return 'video';
  if (k === 'audio' || k === 'voice' || mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  return 'file';
};

const FILE_ICON = { video: IconMovie, audio: IconMicrophone, pdf: IconFileTypePdf, file: IconFile };

/** Uma mídia (miniatura ou cartão). */
export function MediaItem({ media, size = 96 }) {
  if (!media?.url) return null;
  const k = kindOf(media);
  if (k === 'image') {
    return (
      <Tooltip title={media.filename ? `${media.filename} · abrir em nova aba` : 'Abrir em nova aba'}>
        <Box
          component="a"
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: 'block',
            width: size,
            height: size,
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
            bgcolor: 'action.hover'
          }}
        >
          <Box
            component="img"
            src={media.url}
            alt={media.filename || 'Imagem'}
            loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
      </Tooltip>
    );
  }
  if (k === 'video') {
    return (
      <Box sx={{ width: '100%', maxWidth: 320 }}>
        <Box
          component="video"
          src={media.url}
          controls
          preload="metadata"
          sx={{ width: '100%', maxHeight: 220, borderRadius: 2, bgcolor: '#000' }}
        />
      </Box>
    );
  }
  if (k === 'audio') {
    return <Box component="audio" src={media.url} controls preload="metadata" sx={{ width: '100%', maxWidth: 320 }} />;
  }
  const Icon = FILE_ICON[k] || IconFile;
  return (
    <Box
      component="a"
      href={dlUrl(media.url)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
        textDecoration: 'none',
        maxWidth: '100%',
        minWidth: 0,
        '&:hover': { bgcolor: 'action.hover' }
      }}
    >
      <Icon size={20} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
          {media.filename || 'Arquivo'}
        </Typography>
        {media.size ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {fmtBytes(media.size)}
          </Typography>
        ) : null}
      </Box>
      <IconDownload size={16} />
    </Box>
  );
}

/** Lista de mídias (imagens lado a lado; arquivos empilhados). */
export function MediaList({ media = [], size }) {
  const list = (media || []).filter((m) => m?.url);
  if (!list.length) return null;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
      {list.map((m) => (
        <MediaItem key={m.id} media={m} size={size} />
      ))}
    </Stack>
  );
}

/** Chips dos anexos escolhidos antes de enviar (com remover). */
export function PendingAttachments({ items = [], onRemove, disabled }) {
  if (!items.length) return null;
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
      {items.map((m) => (
        <Chip
          key={m.id}
          size="small"
          icon={<IconPaperclip size={13} />}
          label={m.filename || 'Arquivo'}
          onDelete={disabled ? undefined : () => onRemove?.(m.id)}
          deleteIcon={<IconX size={14} />}
          sx={{ maxWidth: 220, fontWeight: 600 }}
        />
      ))}
    </Stack>
  );
}
