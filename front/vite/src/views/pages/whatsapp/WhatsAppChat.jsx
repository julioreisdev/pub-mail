import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Fab from '@mui/material/Fab';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { keyframes } from '@mui/material/styles';

import {
  IconAlertCircle,
  IconArchive,
  IconArchiveOff,
  IconArrowBackUp,
  IconArrowDown,
  IconArrowForwardUp,
  IconArrowLeft,
  IconBrandWhatsapp,
  IconChartBar,
  IconCheck,
  IconChecks,
  IconChevronDown,
  IconClock,
  IconCopy,
  IconCornerUpLeft,
  IconCrown,
  IconDotsVertical,
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconFolder,
  IconMailOpened,
  IconMapPin,
  IconMessages,
  IconMicrophone,
  IconMoodSmile,
  IconPaperclip,
  IconPencil,
  IconPhoto,
  IconPin,
  IconPinned,
  IconPinnedOff,
  IconPlayerStopFilled,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconTrash,
  IconUser,
  IconUsersGroup,
  IconVolume,
  IconVolumeOff,
  IconX
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { TgEmptyState, TgAvatar, TgModal, TgListSkeleton, TgConfirmDialog } from 'views/pages/telegram/ui';
import { WaPageHeader, WaSessionBanner } from './waKit';
import WaChatPicker from './WaChatPicker';
import {
  WA_GREEN,
  WA_DARK,
  WA_TICK_BLUE,
  QUICK_REACTIONS,
  EmojiPicker,
  WaNotConnected,
  useWaSession,
  tint,
  dual,
  errMsg,
  fmtPhone,
  fmtTime,
  fmtListTime,
  fmtBytes,
  dateLabel,
  startOfDay,
  dlUrl
} from './waShared';

// ============================================================================
// WhatsApp → Chat: layout 2 colunas estilo WhatsApp Web.
// Lista (polling 10 s) + conversa (polling `since` 3 s, upsert por id),
// envio otimista (ack 0 → reconciliado pela resposta/polling), rascunho por chat.
// ============================================================================

const LIST_POLL_MS = 10000;
const MSG_POLL_MS = 3000;
const PAGE = 50;
const GROUP_GAP_MS = 3 * 60 * 1000;
const enc = (v) => encodeURIComponent(String(v));

const blink = keyframes`0%{opacity:1}50%{opacity:.25}100%{opacity:1}`;

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'unread', label: 'Não lidos' },
  { id: 'groups', label: 'Grupos' },
  { id: 'archived', label: 'Arquivados' }
];
const BUILTIN_FILTER_IDS = new Set(FILTERS.map((f) => f.id));
const isCustomFilter = (id) => Boolean(id) && !BUILTIN_FILTER_IDS.has(id);

// filtro inicial vindo da URL: ?filter=<id do filtro personalizado> ou ?tab=<built-in>
const filterFromParams = (sp) => {
  const custom = sp.get('filter');
  if (custom) return custom;
  const tab = sp.get('tab');
  return tab && BUILTIN_FILTER_IDS.has(tab) ? tab : 'all';
};

const TYPE_LABEL = {
  image: '📷 Foto',
  video: '🎬 Vídeo',
  audio: '🎵 Áudio',
  voice: '🎤 Mensagem de voz',
  document: '📄 Documento',
  sticker: '🩷 Figurinha',
  location: '📍 Localização',
  contact: '👤 Contato',
  poll: '📊 Enquete',
  revoked: '🚫 Mensagem apagada',
  unknown: 'Mensagem não suportada'
};

// prévia curta de uma mensagem (usada em "responder", "encaminhar", lista)
const previewOf = (m) => {
  if (!m) return '';
  if (m.revoked || m.type === 'revoked') return TYPE_LABEL.revoked;
  if (m.type === 'text') return m.body || '';
  const label = TYPE_LABEL[m.type] || TYPE_LABEL.unknown;
  return m.body ? `${label} · ${m.body}` : label;
};

const sortMsgs = (arr) => [...arr].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

// upsert por id (polling devolve novas + atualizadas)
const upsertMsgs = (prev, incoming) => {
  if (!incoming?.length) return prev;
  const map = new Map(prev.map((m) => [m.id, m]));
  let changed = false;
  for (const m of incoming) {
    const cur = map.get(m.id);
    if (!cur || cur.updated_at !== m.updated_at || cur.ack !== m.ack || cur.pending) {
      map.set(m.id, { ...cur, ...m, pending: false });
      changed = true;
    }
  }
  return changed ? sortMsgs([...map.values()]) : prev;
};

const replaceTmp = (prev, tmpId, real) => {
  const without = prev.filter((m) => m.id !== tmpId);
  if (!real?.id) return without;
  const already = prev.some((m) => m.id === real.id);
  if (already) return without.map((m) => (m.id === real.id ? { ...m, ...real, pending: false } : m));
  return sortMsgs([...without, { ...real, pending: false }]);
};

// foto do chat (indivíduo ou grupo) via proxy autenticado; AuthImage cacheia por path (chat_id)
const chatPhoto = (c) => (c?.chat_id ? `/whatsapp/chats/${enc(c.chat_id)}/photo` : undefined);
// chats por privacy-id sem contato conhecido vêm como "Contato sem nome" → mostra o telefone se houver
const chatLabel = (c) =>
  (c?.kind === 'individual' && c?.name === 'Contato sem nome' && c?.phone ? fmtPhone(c.phone) : c?.name) ||
  fmtPhone(c?.phone) ||
  c?.chat_id;
const kindOfChat = (c) => (c?.kind === 'group' ? 'group' : c?.kind === 'channel' || c?.kind === 'broadcast' ? 'channel' : 'contact');
const senderKey = (m) => (m.direction === 'OUT' ? 'me' : m.from_jid || m.sender_name || 'in');

// cor estável por remetente (nome no grupo)
const SENDER_COLORS = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774', '#c19a6b'];
const senderColor = (key) => {
  let h = 0;
  for (const ch of String(key || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SENDER_COLORS[h % SENDER_COLORS.length];
};

const summarizeReactions = (reactions) => {
  const map = new Map();
  for (const r of reactions || []) {
    if (!r?.emoji) continue;
    const cur = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    cur.count += 1;
    if (r.from_me) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return [...map.values()];
};

// ----------------------------------------------------------------------------
// Texto com formatação do WhatsApp (*negrito* _itálico_ ~tachado~ ```mono```) + links
// ----------------------------------------------------------------------------
const FMT_RE = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s<]+|www\.[^\s<]+)/g;
function WaText({ text, tail = 0, sx }) {
  const parts = useMemo(() => String(text || '').split(FMT_RE), [text]);
  return (
    <Typography component="div" variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45, ...sx }}>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith('```') && p.endsWith('```') && p.length > 6)
          return (
            <Box key={i} component="code" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.92em' }}>
              {p.slice(3, -3)}
            </Box>
          );
        if (/^\*[^*\n]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
        if (/^_[^_\n]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
        if (/^~[^~\n]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>;
        if (/^(https?:\/\/|www\.)/.test(p)) {
          const href = p.startsWith('www.') ? `https://${p}` : p;
          return (
            <Box
              key={i}
              component="a"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'inherit', textDecoration: 'underline', fontWeight: 600 }}
            >
              {p}
            </Box>
          );
        }
        return <span key={i}>{p}</span>;
      })}
      {/* espaçador invisível no fim da última linha: reserva o lugar da hora/ack (truque do WhatsApp Web) */}
      {tail ? <span style={{ display: 'inline-block', width: tail, height: 1 }} /> : null}
    </Typography>
  );
}

// ----------------------------------------------------------------------------
// Ticks de ack (só OUT)
// ----------------------------------------------------------------------------
function AckTicks({ ack, error, pending }) {
  if (error) return <IconAlertCircle size={14} color="#f15c6d" />;
  if (pending || !ack) return <IconClock size={13} style={{ opacity: 0.7 }} />;
  if (ack === 1) return <IconCheck size={14} style={{ opacity: 0.7 }} />;
  if (ack === 2) return <IconChecks size={15} style={{ opacity: 0.7 }} />;
  return <IconChecks size={15} color={WA_TICK_BLUE} />;
}

// ----------------------------------------------------------------------------
// Item da lista de conversas
// ----------------------------------------------------------------------------
const ChatListItem = memo(function ChatListItem({ chat, active, onClick }) {
  const kind = kindOfChat(chat);
  const isGroup = chat.kind === 'group';
  const preview = chat.last_message_preview || (isGroup ? `${chat.group_meta?.participants_count ?? '—'} participantes` : 'Sem mensagens');
  const unread = Number(chat.unread_count) || 0;
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      onClick={onClick}
      sx={{
        px: 1.25,
        py: 1,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'background-color .12s ease',
        bgcolor: active ? (t) => tint(t, 'success', 0.14) : 'transparent',
        '&:hover': { bgcolor: active ? (t) => tint(t, 'success', 0.18) : 'action.hover' }
      }}
    >
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <TgAvatar
          name={chat.name || chat.phone}
          photoPath={chatPhoto(chat)}
          size={46}
          kind={kind}
          icon={isGroup ? IconUsersGroup : undefined}
        />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography sx={{ fontWeight: unread ? 800 : 700, fontSize: 14.5 }} noWrap>
            {chatLabel(chat)}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: unread ? WA_DARK : 'text.secondary', fontWeight: unread ? 700 : 500, flexShrink: 0, fontSize: 11 }}
          >
            {fmtListTime(chat.last_message_at)}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography
            variant="caption"
            sx={{ color: unread ? 'text.primary' : 'text.secondary', flex: 1, minWidth: 0, display: 'block', fontSize: 12.5 }}
            noWrap
          >
            {chat.last_message_direction === 'OUT' ? (
              <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Você:{' '}
              </Box>
            ) : null}
            {preview}
          </Typography>
          {chat.muted ? <IconVolumeOff size={14} style={{ opacity: 0.55, flexShrink: 0 }} /> : null}
          {chat.pinned ? <IconPinned size={14} style={{ opacity: 0.55, flexShrink: 0 }} /> : null}
          {unread ? (
            <Box
              sx={{
                minWidth: 20,
                height: 20,
                px: 0.6,
                borderRadius: 10,
                bgcolor: WA_GREEN,
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              {unread > 99 ? '99+' : unread}
            </Box>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
});

// ----------------------------------------------------------------------------
// Separador de data
// ----------------------------------------------------------------------------
function DateSeparator({ label }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
      <Box
        sx={[
          dual({ bgcolor: '#ffffff', color: '#54656f' }, { bgcolor: '#182229', color: '#8696a0' }),
          { px: 1.5, py: 0.45, borderRadius: 2, fontSize: 11.5, fontWeight: 700, boxShadow: '0 1px 1px rgba(0,0,0,.08)' }
        ]}
      >
        {label}
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------------
// Renderizadores de mídia / tipos especiais
// ----------------------------------------------------------------------------
function MediaOmitted({ label }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ opacity: 0.75, py: 0.25 }}>
      <IconAlertCircle size={16} />
      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
        {label || 'Mídia não disponível'}
      </Typography>
    </Stack>
  );
}

function ImageBody({ msg, onOpen }) {
  const url = msg.media?.url;
  if (!url) return <MediaOmitted label="Foto não disponível" />;
  return (
    <Box
      onClick={() => onOpen(url, msg.body)}
      sx={{ cursor: 'zoom-in', borderRadius: 1.5, overflow: 'hidden', maxWidth: 320, mb: msg.body ? 0.5 : 0, position: 'relative' }}
    >
      <img
        src={url}
        alt={msg.body || 'imagem'}
        style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover' }}
        loading="lazy"
      />
      {msg.uploading ? (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,.35)' }}>
          <CircularProgress size={28} sx={{ color: '#fff' }} />
        </Box>
      ) : null}
    </Box>
  );
}

function VideoBody({ msg }) {
  const url = msg.media?.url;
  if (!url) return <MediaOmitted label="Vídeo não disponível" />;
  return (
    <Box sx={{ borderRadius: 1.5, overflow: 'hidden', maxWidth: 320, mb: msg.body ? 0.5 : 0, bgcolor: '#000' }}>
      <video src={url} controls preload="metadata" style={{ display: 'block', width: '100%', maxHeight: 360 }} />
    </Box>
  );
}

function AudioBody({ msg }) {
  const url = msg.media?.url;
  const voice = msg.type === 'voice';
  if (!url) return <MediaOmitted label={voice ? 'Mensagem de voz não disponível' : 'Áudio não disponível'} />;
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 240, mb: msg.body ? 0.5 : 0 }}>
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          bgcolor: voice ? WA_GREEN : '#8696a0'
        }}
      >
        {voice ? <IconMicrophone size={18} /> : <IconFileText size={18} />}
      </Box>
      <audio src={url} controls preload="metadata" style={{ height: 36, maxWidth: 260, width: '100%' }} />
    </Stack>
  );
}

function DocumentBody({ msg }) {
  const m = msg.media;
  const name = m?.filename || msg.body || 'Documento';
  const ext = (name.split('.').pop() || '').toUpperCase().slice(0, 5);
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={[
        dual({ bgcolor: 'rgba(0,0,0,.05)' }, { bgcolor: 'rgba(255,255,255,.06)' }),
        { p: 1, borderRadius: 1.5, minWidth: 240, maxWidth: 340, mb: msg.body && msg.body !== m?.filename ? 0.5 : 0 }
      ]}
    >
      <Box
        sx={{
          width: 40,
          height: 44,
          borderRadius: 1,
          bgcolor: '#e0416a',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          fontSize: 9,
          fontWeight: 800
        }}
      >
        {ext || <IconFileText size={20} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {name}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {m?.size ? fmtBytes(m.size) : m?.mime || (msg.media_omitted ? 'não disponível' : '')}
        </Typography>
      </Box>
      {m?.url ? (
        <Tooltip title="Baixar">
          <IconButton size="small" component="a" href={dlUrl(m.url)} target="_blank" rel="noopener noreferrer" sx={{ color: 'inherit' }}>
            <IconDownload size={18} />
          </IconButton>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

function LocationBody({ msg }) {
  const loc = msg.extra?.location || {};
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  const ok = Number.isFinite(lat) && Number.isFinite(lng);
  const href = ok ? `https://maps.google.com/?q=${lat},${lng}` : undefined;
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      component={ok ? 'a' : 'div'}
      href={href}
      target={ok ? '_blank' : undefined}
      rel="noopener noreferrer"
      sx={[
        dual({ bgcolor: 'rgba(0,0,0,.05)' }, { bgcolor: 'rgba(255,255,255,.06)' }),
        { p: 1, borderRadius: 1.5, minWidth: 220, textDecoration: 'none', color: 'inherit', cursor: ok ? 'pointer' : 'default' }
      ]}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 1.5,
          bgcolor: '#e53935',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0
        }}
      >
        <IconMapPin size={24} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {loc.description || msg.body || 'Localização'}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {ok ? `${lat.toFixed(5)}, ${lng.toFixed(5)} · abrir no mapa` : 'coordenadas indisponíveis'}
        </Typography>
      </Box>
      {ok ? <IconExternalLink size={16} style={{ opacity: 0.6 }} /> : null}
    </Stack>
  );
}

function PollBody({ msg }) {
  const poll = msg.extra?.poll || {};
  const options = Array.isArray(poll.options) ? poll.options : [];
  const total = options.reduce((a, o) => a + (Number(o.votes) || 0), 0);
  return (
    <Box sx={{ minWidth: 240, maxWidth: 340 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <IconChartBar size={16} />
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {poll.name || msg.body || 'Enquete'}
        </Typography>
      </Stack>
      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mb: 0.75 }}>
        {poll.multiple ? 'Múltipla escolha' : 'Escolha única'} · {total} voto{total === 1 ? '' : 's'}
      </Typography>
      <Stack spacing={0.75}>
        {options.map((o, i) => {
          const votes = Number(o.votes) || 0;
          const pct = total ? Math.round((votes / total) * 100) : 0;
          return (
            <Box key={i}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography variant="body2" noWrap>
                  {o.name}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, flexShrink: 0 }}>
                  {votes}
                </Typography>
              </Stack>
              <Box sx={{ height: 5, borderRadius: 3, bgcolor: 'rgba(128,128,128,.25)', mt: 0.35, overflow: 'hidden' }}>
                <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: WA_GREEN, transition: 'width .3s ease' }} />
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

function ContactBody({ msg }) {
  const raw = msg.extra?.contact;
  const c = Array.isArray(raw) ? raw[0] : raw || {};
  const name = c.name || c.displayName || c.display_name || c.formattedName || msg.body || 'Contato';
  const phone = c.phone || c.number || (Array.isArray(c.phones) ? c.phones[0] : '') || '';
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={[dual({ bgcolor: 'rgba(0,0,0,.05)' }, { bgcolor: 'rgba(255,255,255,.06)' }), { p: 1, borderRadius: 1.5, minWidth: 220 }]}
    >
      <TgAvatar name={name} size={40} kind="contact" icon={IconUser} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {name}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {fmtPhone(phone) || 'sem número'}
        </Typography>
      </Box>
    </Stack>
  );
}

function StickerBody({ msg }) {
  const url = msg.media?.url;
  if (!url) return <MediaOmitted label="Figurinha não disponível" />;
  return <img src={url} alt="figurinha" style={{ display: 'block', width: 140, height: 140, objectFit: 'contain' }} loading="lazy" />;
}

// ----------------------------------------------------------------------------
// Balão de mensagem
// ----------------------------------------------------------------------------
const MessageBubble = memo(function MessageBubble({ msg, isGroup, first, last, onMenu, onImage, onRetry, onReact }) {
  const out = msg.direction === 'OUT';
  const revoked = msg.revoked || msg.type === 'revoked';
  const sticker = msg.type === 'sticker' && !revoked;
  const reactions = summarizeReactions(msg.reactions);
  const pressRef = useRef(null);

  const openMenu = (e) => {
    e.stopPropagation();
    onMenu(e.currentTarget.closest('[data-bubble]') || e.currentTarget, msg);
  };
  const onTouchStart = (e) => {
    const el = e.currentTarget;
    pressRef.current = window.setTimeout(() => onMenu(el, msg), 480);
  };
  const cancelPress = () => {
    if (pressRef.current) window.clearTimeout(pressRef.current);
    pressRef.current = null;
  };

  let body;
  if (revoked) {
    body = (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ opacity: 0.7 }}>
        <IconTrash size={14} />
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
          Mensagem apagada
        </Typography>
      </Stack>
    );
  } else {
    switch (msg.type) {
      case 'image':
        body = <ImageBody msg={msg} onOpen={onImage} />;
        break;
      case 'video':
        body = <VideoBody msg={msg} />;
        break;
      case 'audio':
      case 'voice':
        body = <AudioBody msg={msg} />;
        break;
      case 'document':
        body = <DocumentBody msg={msg} />;
        break;
      case 'sticker':
        body = <StickerBody msg={msg} />;
        break;
      case 'location':
        body = <LocationBody msg={msg} />;
        break;
      case 'poll':
        body = <PollBody msg={msg} />;
        break;
      case 'contact':
        body = <ContactBody msg={msg} />;
        break;
      case 'text':
        body = null;
        break;
      default:
        body = <MediaOmitted label="Mensagem não suportada" />;
    }
  }
  const showCaption =
    !revoked && msg.type !== 'text' && msg.body && !['poll', 'location', 'contact'].includes(msg.type) && msg.body !== msg.media?.filename;
  const showText = !revoked && msg.type === 'text';
  const metaTail = (msg.edited ? 44 : 0) + 40 + (out ? 20 : 0);

  return (
    <Stack direction="row" justifyContent={out ? 'flex-end' : 'flex-start'} sx={{ px: { xs: 1, md: 4 }, mt: first ? 1 : 0.25 }}>
      <Box
        sx={{
          maxWidth: { xs: '86%', md: '68%' },
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: out ? 'flex-end' : 'flex-start'
        }}
      >
        <Box
          data-bubble
          onTouchStart={onTouchStart}
          onTouchEnd={cancelPress}
          onTouchMove={cancelPress}
          sx={[
            sticker
              ? { bgcolor: 'transparent' }
              : out
                ? dual({ bgcolor: '#d9fdd3', color: '#111b21' }, { bgcolor: '#005c4b', color: '#e9edef' })
                : dual({ bgcolor: '#ffffff', color: '#111b21' }, { bgcolor: '#202c33', color: '#e9edef' }),
            {
              position: 'relative',
              px: sticker ? 0 : 1.1,
              pt: sticker ? 0 : 0.6,
              pb: sticker ? 0 : 0.5,
              borderRadius: 2,
              boxShadow: sticker ? 'none' : '0 1px 0.5px rgba(0,0,0,.13)',
              ...(first && !sticker ? (out ? { borderTopRightRadius: 3 } : { borderTopLeftRadius: 3 }) : {}),
              '&:hover .wa-menu-btn': { opacity: 1 }
            }
          ]}
        >
          {/* botão do menu (hover) */}
          {!msg.pending && !msg.uploading ? (
            <IconButton
              size="small"
              className="wa-menu-btn"
              onClick={openMenu}
              sx={[
                dual({ bgcolor: 'rgba(255,255,255,.85)' }, { bgcolor: 'rgba(32,44,51,.9)' }),
                { position: 'absolute', top: 2, right: 2, opacity: 0, transition: 'opacity .12s', zIndex: 2, p: 0.25, color: 'inherit' }
              ]}
            >
              <IconChevronDown size={16} />
            </IconButton>
          ) : null}

          {isGroup && !out && first && (msg.sender_name || msg.from_jid) ? (
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, display: 'block', mb: 0.25, color: senderColor(msg.from_jid || msg.sender_name) }}
            >
              {msg.sender_name || fmtPhone(String(msg.from_jid || '').split('@')[0])}
            </Typography>
          ) : null}

          {msg.forwarded && !revoked ? (
            <Stack direction="row" spacing={0.4} alignItems="center" sx={{ opacity: 0.6, mb: 0.25 }}>
              <IconArrowForwardUp size={13} />
              <Typography variant="caption" sx={{ fontStyle: 'italic', fontSize: 11 }}>
                Encaminhada
              </Typography>
            </Stack>
          ) : null}

          {msg.quoted && !revoked ? (
            <Box
              sx={[
                dual({ bgcolor: 'rgba(0,0,0,.06)' }, { bgcolor: 'rgba(0,0,0,.25)' }),
                { borderLeft: '4px solid', borderLeftColor: WA_GREEN, borderRadius: 1, px: 1, py: 0.5, mb: 0.6, maxWidth: 360 }
              ]}
            >
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, fontSize: 12 }} noWrap>
                {msg.quoted.preview || 'Mensagem'}
              </Typography>
            </Box>
          ) : null}

          {body}
          {showText ? <WaText text={msg.body} tail={metaTail} /> : null}
          {showCaption ? <WaText text={msg.body} tail={metaTail} sx={{ mt: 0.25 }} /> : null}

          {msg.error ? (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5, color: '#f15c6d' }}>
              <IconAlertCircle size={14} />
              <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }} noWrap>
                {typeof msg.error === 'string' ? msg.error : 'Falha no envio'}
              </Typography>
              {msg.type === 'text' && msg.body ? (
                <Typography
                  variant="caption"
                  onClick={() => onRetry(msg)}
                  sx={{ fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
                >
                  Tentar de novo
                </Typography>
              ) : null}
            </Stack>
          ) : null}

          {/* hora + ack: absoluto no canto (o espaçador do texto garante que não sobrepõe) */}
          {!sticker ? (
            <Stack
              direction="row"
              spacing={0.4}
              alignItems="center"
              justifyContent="flex-end"
              sx={{
                opacity: 0.75,
                fontSize: 10.5,
                lineHeight: 1,
                ...(showText || showCaption ? { position: 'absolute', right: 7, bottom: 5 } : { mt: 0.35 })
              }}
            >
              {msg.edited ? <span style={{ fontStyle: 'italic' }}>editada</span> : null}
              <span>{fmtTime(msg.timestamp)}</span>
              {out ? <AckTicks ack={msg.ack} error={msg.error} pending={msg.pending || msg.uploading} /> : null}
            </Stack>
          ) : (
            <Typography
              variant="caption"
              sx={{ display: 'block', textAlign: out ? 'right' : 'left', opacity: 0.6, fontSize: 10.5, mt: 0.25 }}
            >
              {fmtTime(msg.timestamp)}
            </Typography>
          )}
        </Box>

        {reactions.length ? (
          <Stack direction="row" spacing={0.5} sx={{ mt: -0.6, mb: 0.25, px: 0.5, position: 'relative', zIndex: 1 }}>
            {reactions.map((r) => (
              <Box
                key={r.emoji}
                onClick={() => onReact(msg, r.mine ? '' : r.emoji)}
                sx={[
                  dual({ bgcolor: '#ffffff', borderColor: '#e9edef' }, { bgcolor: '#202c33', borderColor: '#0b141a' }),
                  {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.4,
                    px: 0.7,
                    py: 0.15,
                    borderRadius: 10,
                    border: '1px solid',
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,.15)',
                    outline: r.mine ? `1.5px solid ${WA_GREEN}` : 'none'
                  }
                ]}
              >
                <span>{r.emoji}</span>
                {r.count > 1 ? <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{r.count}</span> : null}
              </Box>
            ))}
          </Stack>
        ) : null}
        {last ? <Box sx={{ height: 2 }} /> : null}
      </Box>
    </Stack>
  );
});

function MessagesSkeleton() {
  const rows = [
    { out: false, w: '48%', h: 34 },
    { out: false, w: '32%', h: 34 },
    { out: true, w: '55%', h: 52 },
    { out: false, w: '40%', h: 34 },
    { out: true, w: '30%', h: 34 }
  ];
  return (
    <Stack spacing={1.25} sx={{ px: 4, py: 2 }}>
      {rows.map((r, i) => (
        <Stack key={i} direction="row" justifyContent={r.out ? 'flex-end' : 'flex-start'}>
          <Skeleton variant="rounded" width={r.w} height={r.h} sx={{ borderRadius: 2 }} />
        </Stack>
      ))}
    </Stack>
  );
}

// wallpaper estilo WhatsApp (bege claro / carvão no dark) com padrão sutil
const THREAD_BG = dual({ bgcolor: '#efeae2' }, { bgcolor: '#0b141a' });
const WALLPAPER = {
  content: '""',
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  opacity: 0.35,
  backgroundImage: 'radial-gradient(rgba(120,120,120,.28) 1px, transparent 1.4px)',
  backgroundSize: '22px 22px'
};

// ----------------------------------------------------------------------------
// Modal de filtro personalizado ("pasta"): nome + seleção de conversas.
// POST /whatsapp/chat-filters { name, chat_ids } | PUT /whatsapp/chat-filters/:id
// ----------------------------------------------------------------------------
function ChatFilterModal({ open, initial, connected, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [targets, setTargets] = useState([]);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || '');
    setTargets((initial?.chat_ids || []).map((id) => ({ chat_id: id })));
    setSaving(false);
  }, [open, initial]);

  const save = async () => {
    const n = name.trim();
    if (!n) return toast.error('Dê um nome ao filtro.');
    if (!targets.length) return toast.error('Selecione pelo menos uma conversa.');
    setSaving(true);
    try {
      const body = { name: n, chat_ids: targets.map((t) => t.chat_id) };
      const r = editing ? await put(`/whatsapp/chat-filters/${enc(initial.id)}`, body) : await post('/whatsapp/chat-filters', body);
      toast.success(editing ? 'Filtro atualizado.' : 'Filtro criado.');
      onSaved?.(r && r.id ? r : { ...body, id: initial?.id });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar o filtro.'));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <TgModal
      open={open}
      onClose={() => !saving && onClose?.()}
      title={editing ? 'Editar filtro' : 'Novo filtro'}
      subtitle="Agrupe conversas em uma pasta para achá-las rápido no topo da lista."
      maxWidth="sm"
      disableClose={saving}
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconFolder size={16} />}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
          >
            {editing ? 'Salvar' : 'Criar filtro'}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Nome do filtro"
          placeholder="Ex.: Clientes VIP, Fornecedores, Família…"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
          helperText={`${name.length}/40`}
        />
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
            Conversas do filtro
          </Typography>
          <WaChatPicker value={targets} onChange={setTargets} connected={connected} listHeight={280} />
        </Box>
      </Stack>
    </TgModal>
  );
}

// ============================================================================
export default function WhatsAppChat() {
  const isNarrow = useMediaQuery('(max-width:860px)');
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, loading: sessionLoading, connected } = useWaSession(15000);
  // gateway fora → leitura continua (histórico da org), mas nada que dependa do WhatsApp é chamado
  const connectedRef = useRef(false);
  connectedRef.current = connected;

  // ---------------- lista ----------------
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(() => filterFromParams(searchParams));
  const [list, setList] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [listLoading, setListLoading] = useState(false);
  const listSeq = useRef(0);

  // ---------------- filtros personalizados ("pastas") ----------------
  const [customFilters, setCustomFilters] = useState([]);
  const [filterMenu, setFilterMenu] = useState(null); // {anchor, item}
  // chip do filtro selecionado sempre visível na linha rolável (ex.: entrou por ?filter=).
  // Callback-ref estável: dispara quando o chip ativo monta (a linha só existe depois da sessão carregar).
  const activeChipRef = useCallback((el) => {
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);
  const [filterModal, setFilterModal] = useState(null); // {initial|null}
  const [filterDel, setFilterDel] = useState(null); // {item, loading}
  const longPressRef = useRef(null);

  const loadFilters = useCallback(async () => {
    try {
      const r = await get('/whatsapp/chat-filters');
      const items = (Array.isArray(r) ? r : r?.items || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      setCustomFilters(items);
    } catch {
      /* filtros são opcionais — a lista continua funcionando */
    }
  }, []);
  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  // chip selecionado persiste na URL (?filter=<id> p/ personalizado, ?tab=<id> p/ built-in), preservando ?chat=
  const selectFilter = useCallback(
    (id) => {
      setFilter(id);
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('filter');
          n.delete('tab');
          if (isCustomFilter(id)) n.set('filter', id);
          else if (id !== 'all') n.set('tab', id);
          return n;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const openFilterMenu = (anchor, item) => setFilterMenu({ anchor, item });
  const onFilterPressStart = (e, item) => {
    const anchor = e.currentTarget;
    longPressRef.current = window.setTimeout(() => {
      longPressRef.current = null;
      openFilterMenu(anchor, item);
    }, 550);
  };
  const onFilterPressEnd = () => {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const listReloadRef = useRef(null); // aponta p/ loadList (definido abaixo)
  const onFilterSaved = (saved) => {
    setFilterModal(null);
    loadFilters();
    if (saved?.id) {
      selectFilter(saved.id);
      // atualiza a lista mesmo que o chip já estivesse selecionado (edição)
      window.setTimeout(() => listReloadRef.current?.({ silent: true }), 0);
    }
  };

  const doDeleteFilter = async () => {
    if (!filterDel?.item) return;
    setFilterDel((d) => ({ ...d, loading: true }));
    try {
      await remove(`/whatsapp/chat-filters/${enc(filterDel.item.id)}`);
      toast.success('Filtro excluído.');
      if (filter === filterDel.item.id) selectFilter('all');
      setFilterDel(null);
      loadFilters();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível excluir o filtro.'));
      setFilterDel((d) => (d ? { ...d, loading: false } : d));
    }
  };

  // ---------------- conversa ativa ----------------
  const [active, setActive] = useState(null);
  const activeRef = useRef(null);
  activeRef.current = active;
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const sinceRef = useRef(null);
  const msgSeq = useRef(0);
  const threadRef = useRef(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const lastReadRef = useRef({});

  // ---------------- composer ----------------
  const [text, setText] = useState('');
  const textRef = useRef('');
  textRef.current = text;
  const [reply, setReply] = useState(null);
  const replyRef = useRef(null);
  replyRef.current = reply;
  const [editing, setEditing] = useState(null);
  const [attachment, setAttachment] = useState(null); // {file,url,kind,asDocument}
  const [sending, setSending] = useState(false);
  const draftsRef = useRef(new Map());
  const inputRef = useRef(null);
  const fileMediaRef = useRef(null);
  const fileDocRef = useRef(null);
  const typingRef = useRef({ on: false, timer: null });
  const [rec, setRec] = useState(null); // {recorder, startedAt}
  const [recElapsed, setRecElapsed] = useState(0);
  const recCancelRef = useRef(false);

  // ---------------- popups ----------------
  const [emoji, setEmoji] = useState(null); // {anchor, mode:'compose'|'react', msg}
  const [recentEmojis, setRecentEmojis] = useState([]);
  const [attachAnchor, setAttachAnchor] = useState(null);
  const [hdrAnchor, setHdrAnchor] = useState(null);
  const [bubbleMenu, setBubbleMenu] = useState(null); // {anchor, msg}
  const [lightbox, setLightbox] = useState(null); // {url, caption}
  const [forward, setForward] = useState(null); // {msg, q, items, selected:Set, loading, sending}
  const [del, setDel] = useState(null); // {msg, loading}
  const [pollDlg, setPollDlg] = useState(null); // {name, options:[], multiple, loading}
  const [locDlg, setLocDlg] = useState(null); // {lat,lng,description,loading}
  const [groupDrawer, setGroupDrawer] = useState(null); // {loading, info}

  // ============================================================ lista
  const loadList = useCallback(
    async ({ page = 1, append = false, silent = false } = {}) => {
      const seq = ++listSeq.current;
      if (!silent && !append) setListLoading(true);
      try {
        const custom = isCustomFilter(filter);
        const r = await get('/whatsapp/chats', {
          params: custom
            ? { q: q.trim() || undefined, filter, page, page_size: PAGE }
            : {
                q: q.trim() || undefined,
                kind: filter === 'groups' ? 'group' : 'all',
                archived: filter === 'archived' ? 1 : 0,
                page,
                page_size: PAGE
              }
        });
        if (seq !== listSeq.current) return;
        setList((prev) => {
          if (!append) return { items: r.items || [], total: r.total || 0, page: r.page || 1, pages: r.pages || 1 };
          const seen = new Set(prev.items.map((c) => c.chat_id));
          return {
            items: [...prev.items, ...(r.items || []).filter((c) => !seen.has(c.chat_id))],
            total: r.total || 0,
            page: r.page || page,
            pages: r.pages || 1
          };
        });
      } catch (e) {
        if (!silent) toast.error(errMsg(e, 'Falha ao carregar conversas.'));
      } finally {
        if (seq === listSeq.current) setListLoading(false);
      }
    },
    [q, filter]
  );
  listReloadRef.current = loadList;

  // busca (debounce) + troca de filtro
  useEffect(() => {
    const t = window.setTimeout(() => loadList(), 250);
    return () => window.clearTimeout(t);
  }, [loadList]);

  // polling da lista
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadList({ silent: true });
    }, LIST_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadList]);

  const visibleChats = useMemo(() => {
    let items = list.items;
    if (filter === 'unread') items = items.filter((c) => (Number(c.unread_count) || 0) > 0);
    return [...items].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
    });
  }, [list.items, filter]);

  const patchChat = useCallback((chatId, patch) => {
    setList((prev) => ({ ...prev, items: prev.items.map((c) => (c.chat_id === chatId ? { ...c, ...patch } : c)) }));
    setActive((prev) => (prev && prev.chat_id === chatId ? { ...prev, ...patch } : prev));
  }, []);

  const markRead = useCallback(
    (chatId) => {
      const now = Date.now();
      if (lastReadRef.current[chatId] && now - lastReadRef.current[chatId] < 2000) return;
      lastReadRef.current[chatId] = now;
      patchChat(chatId, { unread_count: 0 });
      if (connectedRef.current) post(`/whatsapp/chats/${enc(chatId)}/read`).catch(() => {});
    },
    [patchChat]
  );

  // ============================================================ scroll
  const scrollToEnd = useCallback((smooth = true) => {
    const el = threadRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  const onThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = dist < 80;
    setShowJump(dist > 320);
    if (el.scrollTop < 60 && hasOlder && !loadingOlder && !msgLoading) loadOlder();
  };

  // ============================================================ abrir conversa
  const stopTyping = useCallback((send = true) => {
    const t = typingRef.current;
    if (t.timer) window.clearTimeout(t.timer);
    t.timer = null;
    if (t.on) {
      t.on = false;
      const cur = activeRef.current;
      if (send && cur && connectedRef.current) post(`/whatsapp/chats/${enc(cur.chat_id)}/typing`, { typing: false }).catch(() => {});
    }
  }, []);

  const openChat = useCallback(
    async (chat) => {
      if (!chat?.chat_id) return;
      const prev = activeRef.current;
      if (prev) draftsRef.current.set(prev.chat_id, { text: textRef.current, reply: replyRef.current });
      stopTyping();
      setActive(chat);
      setMessages([]);
      setHasOlder(false);
      setEditing(null);
      setAttachment(null);
      setShowJump(false);
      atBottomRef.current = true;
      sinceRef.current = null;
      const d = draftsRef.current.get(chat.chat_id);
      setText(d?.text || '');
      setReply(d?.reply || null);
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set('chat', chat.chat_id);
          return n;
        },
        { replace: true }
      );
      const seq = ++msgSeq.current;
      setMsgLoading(true);
      try {
        const r = await get(`/whatsapp/chats/${enc(chat.chat_id)}/messages`, { params: { limit: PAGE } });
        if (seq !== msgSeq.current) return;
        const items = sortMsgs(r.items || []);
        setMessages(items);
        setHasOlder(items.length >= PAGE);
        sinceRef.current = r.server_time || new Date().toISOString();
        scrollToEnd(false);
        if (Number(chat.unread_count) > 0) markRead(chat.chat_id);
      } catch (e) {
        if (seq === msgSeq.current) toast.error(errMsg(e, 'Falha ao abrir a conversa.'));
      } finally {
        if (seq === msgSeq.current) setMsgLoading(false);
      }
    },
    [markRead, scrollToEnd, setSearchParams, stopTyping]
  );

  // ?chat=<chat_id> (vindo de Contatos ou refresh)
  const wantedChat = searchParams.get('chat');
  useEffect(() => {
    if (!wantedChat) return;
    if (activeRef.current?.chat_id === wantedChat) return;
    const found = list.items.find((c) => c.chat_id === wantedChat);
    if (found) {
      openChat(found);
      return;
    }
    get(`/whatsapp/chats/${enc(wantedChat)}`)
      .then((c) => {
        if (c?.chat_id) openChat(c);
      })
      .catch(() => toast.error('Conversa não encontrada.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedChat]);

  // carregar mais antigas
  const loadOlder = async () => {
    const cur = activeRef.current;
    const el = threadRef.current;
    if (!cur || !messages.length || loadingOlder) return;
    setLoadingOlder(true);
    const before = messages[0].timestamp;
    const prevH = el?.scrollHeight || 0;
    try {
      const r = await get(`/whatsapp/chats/${enc(cur.chat_id)}/messages`, { params: { before, limit: PAGE } });
      if (activeRef.current?.chat_id !== cur.chat_id) return;
      const items = r.items || [];
      setHasOlder(items.length >= PAGE);
      if (items.length) {
        setMessages((prev) => upsertMsgs(prev, items));
        requestAnimationFrame(() => {
          if (el) el.scrollTop += el.scrollHeight - prevH;
        });
      }
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao carregar mensagens antigas.'));
    } finally {
      setLoadingOlder(false);
    }
  };

  // polling da conversa aberta (since)
  useEffect(() => {
    if (!active?.chat_id) return undefined;
    const tick = async () => {
      const cur = activeRef.current;
      const since = sinceRef.current;
      if (!cur || !since || document.visibilityState === 'hidden') return;
      try {
        const r = await get(`/whatsapp/chats/${enc(cur.chat_id)}/messages`, { params: { since } });
        if (activeRef.current?.chat_id !== cur.chat_id) return;
        if (r.server_time) sinceRef.current = r.server_time;
        const items = r.items || [];
        if (!items.length) return;
        setMessages((prev) => upsertMsgs(prev, items));
        const fresh = items.filter((m) => m.direction === 'IN' && new Date(m.timestamp).getTime() > new Date(since).getTime());
        if (fresh.length) {
          const lastIn = fresh[fresh.length - 1];
          patchChat(cur.chat_id, {
            last_message_at: lastIn.timestamp,
            last_message_preview: previewOf(lastIn),
            last_message_direction: 'IN'
          });
          if (document.hasFocus()) markRead(cur.chat_id);
          if (atBottomRef.current) scrollToEnd(true);
        }
      } catch {
        /* silencioso */
      }
    };
    const id = window.setInterval(tick, MSG_POLL_MS);
    return () => window.clearInterval(id);
  }, [active?.chat_id, markRead, patchChat, scrollToEnd]);

  // ao voltar o foco pra janela, marca lidas se há não lidas no chat aberto
  useEffect(() => {
    const onFocus = () => {
      const cur = activeRef.current;
      if (cur && Number(cur.unread_count) > 0) markRead(cur.chat_id);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [markRead]);

  // limpa timers/gravação ao sair
  useEffect(
    () => () => {
      stopTyping(false);
      recCancelRef.current = true;
      try {
        rec?.recorder?.state !== 'inactive' && rec?.recorder?.stop();
      } catch {
        /* ignore */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ============================================================ composer
  const onTextChange = (v) => {
    setText(v);
    const cur = activeRef.current;
    if (!cur || editing || !connectedRef.current) return;
    const t = typingRef.current;
    if (!t.on && v.trim()) {
      t.on = true;
      post(`/whatsapp/chats/${enc(cur.chat_id)}/typing`, { typing: true }).catch(() => {});
    }
    if (t.timer) window.clearTimeout(t.timer);
    t.timer = window.setTimeout(() => stopTyping(), 3000);
  };

  const touchListAfterSend = (chatId, m) => {
    patchChat(chatId, { last_message_at: m.timestamp, last_message_preview: previewOf(m), last_message_direction: 'OUT' });
  };

  const insertEmoji = (em) => {
    const el = inputRef.current;
    setRecentEmojis((prev) => [em, ...prev.filter((x) => x !== em)].slice(0, 16));
    if (el && typeof el.selectionStart === 'number') {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      const next = text.slice(0, s) + em + text.slice(e);
      setText(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(s + em.length, s + em.length);
      });
    } else setText((t) => t + em);
  };

  const sendText = async () => {
    const cur = activeRef.current;
    const body = text.trim();
    if (!cur) return;
    if (attachment) return sendAttachment(body);
    if (!body) return;

    if (editing) {
      const target = editing;
      setSending(true);
      try {
        const m = await put(`/whatsapp/messages/${enc(target.id)}`, { text: body });
        setMessages((prev) => upsertMsgs(prev, [{ ...target, ...(m || {}), body: m?.body ?? body, edited: true }]));
        setEditing(null);
        setText('');
        toast.success('Mensagem editada.');
      } catch (e) {
        toast.error(errMsg(e, 'Não foi possível editar.'));
      } finally {
        setSending(false);
      }
      return;
    }

    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const replyWas = reply;
    const optimistic = {
      id: tmpId,
      chat_id: cur.chat_id,
      direction: 'OUT',
      type: 'text',
      body,
      ack: 0,
      pending: true,
      reactions: [],
      quoted: replyWas ? { wa_message_id: replyWas.wa_message_id, preview: previewOf(replyWas) } : null,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setReply(null);
    stopTyping();
    scrollToEnd(true);
    try {
      const m = await post('/whatsapp/messages/send', {
        chat_id: cur.chat_id,
        text: body,
        quoted_wa_id: replyWas?.wa_message_id || undefined
      });
      setMessages((prev) => replaceTmp(prev, tmpId, m));
      touchListAfterSend(cur.chat_id, m || optimistic);
    } catch (e) {
      setMessages((prev) => prev.filter((x) => x.id !== tmpId));
      if (activeRef.current?.chat_id === cur.chat_id) {
        setText(body);
        setReply(replyWas);
      } else draftsRef.current.set(cur.chat_id, { text: body, reply: replyWas });
      toast.error(errMsg(e, 'Não foi possível enviar.'));
    }
  };

  const retrySend = (msg) => {
    if (!msg?.body) return;
    setText(msg.body);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // arquivo escolhido → prévia no composer (legenda = textarea)
  const pickFile = (e, asDocument) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const kind = asDocument
      ? 'document'
      : f.type.startsWith('image/')
        ? 'image'
        : f.type.startsWith('video/')
          ? 'video'
          : f.type.startsWith('audio/')
            ? 'audio'
            : 'document';
    setAttachment({ file: f, url: URL.createObjectURL(f), kind, asDocument: Boolean(asDocument) || kind === 'document' });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const sendMediaFile = async (file, { caption = '', asVoice = false, asDocument = false, kind = 'document', localUrl } = {}) => {
    const cur = activeRef.current;
    if (!cur) return;
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const replyWas = reply;
    const url = localUrl || (kind === 'image' ? URL.createObjectURL(file) : null);
    const optimistic = {
      id: tmpId,
      chat_id: cur.chat_id,
      direction: 'OUT',
      type: asVoice ? 'voice' : kind,
      body: caption,
      ack: 0,
      pending: true,
      uploading: true,
      reactions: [],
      media: { url, mime: file.type, filename: file.name, size: file.size },
      quoted: replyWas ? { wa_message_id: replyWas.wa_message_id, preview: previewOf(replyWas) } : null,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimistic]);
    setReply(null);
    stopTyping();
    scrollToEnd(true);
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('chat_id', cur.chat_id);
      if (caption) fd.append('caption', caption);
      if (asVoice) fd.append('as_voice', '1');
      if (asDocument) fd.append('as_document', '1');
      if (replyWas?.wa_message_id) fd.append('quoted_wa_id', replyWas.wa_message_id);
      const m = await post('/whatsapp/messages/send-media', fd, { headers: { 'Content-Type': undefined }, timeout: 120000 });
      setMessages((prev) => replaceTmp(prev, tmpId, m));
      touchListAfterSend(cur.chat_id, m || optimistic);
      return true;
    } catch (e) {
      setMessages((prev) => prev.filter((x) => x.id !== tmpId));
      setReply(replyWas);
      toast.error(errMsg(e, 'Não foi possível enviar a mídia.'));
      return false;
    } finally {
      setSending(false);
    }
  };

  const sendAttachment = async (caption) => {
    const a = attachment;
    if (!a) return;
    setAttachment(null);
    setText('');
    const ok = await sendMediaFile(a.file, {
      caption,
      asDocument: a.asDocument,
      kind: a.kind,
      localUrl: a.kind === 'image' ? a.url : null
    });
    if (!ok) {
      setAttachment(a);
      setText(caption);
    }
  };

  // -------- gravação de voz --------
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Seu navegador não suporta gravação de áudio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime =
        ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      recCancelRef.current = false;
      recorder.ondataavailable = (ev) => {
        if (ev.data?.size) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        setRecElapsed(0);
        if (recCancelRef.current || !chunks.length) return;
        const type = recorder.mimeType || mime || 'audio/webm';
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([new Blob(chunks, { type })], `voz-${Date.now()}.${ext}`, { type });
        sendMediaFile(file, { asVoice: true, kind: 'voice' });
      };
      recorder.start(250);
      setRec({ recorder, startedAt: Date.now() });
      setRecElapsed(0);
    } catch {
      toast.error('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
    }
  };
  useEffect(() => {
    if (!rec) return undefined;
    const id = window.setInterval(() => setRecElapsed(Math.round((Date.now() - rec.startedAt) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [rec]);
  const stopRecording = (cancel) => {
    recCancelRef.current = Boolean(cancel);
    try {
      rec?.recorder?.stop();
    } catch {
      setRec(null);
    }
  };

  // -------- localização --------
  const askLocation = () => {
    setAttachAnchor(null);
    if (!navigator.geolocation) {
      toast.error('Geolocalização não disponível neste navegador.');
      return;
    }
    const tid = toast.loading('Obtendo sua localização…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss(tid);
        setLocDlg({ lat: pos.coords.latitude, lng: pos.coords.longitude, description: '', loading: false });
      },
      () => {
        toast.dismiss(tid);
        toast.error('Não foi possível obter a localização. Verifique a permissão do navegador.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };
  const sendLocation = async () => {
    const cur = activeRef.current;
    if (!cur || !locDlg) return;
    setLocDlg((d) => ({ ...d, loading: true }));
    try {
      const m = await post('/whatsapp/messages/send-location', {
        chat_id: cur.chat_id,
        latitude: locDlg.lat,
        longitude: locDlg.lng,
        description: locDlg.description.trim() || undefined
      });
      if (m?.id) setMessages((prev) => upsertMsgs(prev, [m]));
      touchListAfterSend(cur.chat_id, m || { timestamp: new Date().toISOString(), type: 'location' });
      setLocDlg(null);
      scrollToEnd(true);
    } catch (e) {
      setLocDlg((d) => (d ? { ...d, loading: false } : d));
      toast.error(errMsg(e, 'Não foi possível enviar a localização.'));
    }
  };

  // -------- enquete --------
  const sendPoll = async () => {
    const cur = activeRef.current;
    if (!cur || !pollDlg) return;
    const name = pollDlg.name.trim();
    const options = pollDlg.options.map((o) => o.trim()).filter(Boolean);
    if (!name) return toast.error('Escreva a pergunta da enquete.');
    if (options.length < 2) return toast.error('A enquete precisa de pelo menos 2 opções.');
    if (new Set(options).size !== options.length) return toast.error('As opções precisam ser diferentes entre si.');
    setPollDlg((d) => ({ ...d, loading: true }));
    try {
      const m = await post('/whatsapp/messages/send-poll', { chat_id: cur.chat_id, name, options, multiple: Boolean(pollDlg.multiple) });
      if (m?.id) setMessages((prev) => upsertMsgs(prev, [m]));
      touchListAfterSend(cur.chat_id, m || { timestamp: new Date().toISOString(), type: 'poll', body: name });
      setPollDlg(null);
      scrollToEnd(true);
    } catch (e) {
      setPollDlg((d) => (d ? { ...d, loading: false } : d));
      toast.error(errMsg(e, 'Não foi possível criar a enquete.'));
    }
  };

  // ============================================================ ações por mensagem
  const openBubbleMenu = useCallback((anchor, msg) => setBubbleMenu({ anchor, msg }), []);
  const openImage = useCallback((url, caption) => setLightbox({ url, caption }), []);

  const react = useCallback(async (msg, emojiChar) => {
    if (!msg?.id || String(msg.id).startsWith('tmp-')) return;
    if (!connectedRef.current) {
      toast.error('Conecte o WhatsApp para reagir.');
      return;
    }
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msg.id) return m;
        const others = (m.reactions || []).filter((r) => !r.from_me);
        return { ...m, reactions: emojiChar ? [...others, { emoji: emojiChar, from: 'me', from_me: true }] : others };
      })
    );
    try {
      await post(`/whatsapp/messages/${enc(msg.id)}/react`, { emoji: emojiChar || '' });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível reagir.'));
    }
  }, []);

  const copyMsg = async (msg) => {
    try {
      await navigator.clipboard.writeText(msg.body || previewOf(msg));
      toast.success('Copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const startEdit = (msg) => {
    setEditing(msg);
    setReply(null);
    setAttachment(null);
    setText(msg.body || '');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const doDelete = async (everyone) => {
    const msg = del?.msg;
    if (!msg) return;
    setDel((d) => ({ ...d, loading: true }));
    try {
      await remove(`/whatsapp/messages/${enc(msg.id)}${everyone ? '?everyone=1' : ''}`);
      if (everyone) setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, revoked: true, type: 'revoked' } : m)));
      else setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setDel(null);
      toast.success(everyone ? 'Mensagem apagada para todos.' : 'Mensagem apagada para você.');
    } catch (e) {
      setDel((d) => (d ? { ...d, loading: false } : d));
      toast.error(errMsg(e, 'Não foi possível apagar.'));
    }
  };

  // -------- encaminhar --------
  const openForward = (msg) => {
    setForward({ msg, q: '', items: [], selected: new Set(), loading: true, sending: false });
    get('/whatsapp/chats', { params: { page_size: 100, archived: 0 } })
      .then((r) => setForward((f) => (f ? { ...f, items: r.items || [], loading: false } : f)))
      .catch(() => setForward((f) => (f ? { ...f, loading: false } : f)));
  };
  useEffect(() => {
    if (!forward || !forward.q.trim()) return undefined;
    const t = window.setTimeout(() => {
      get('/whatsapp/chats', { params: { q: forward.q.trim(), page_size: 100, archived: 0 } })
        .then((r) => setForward((f) => (f && f.q === forward.q ? { ...f, items: r.items || [] } : f)))
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forward?.q]);
  const doForward = async () => {
    if (!forward?.selected.size) return;
    setForward((f) => ({ ...f, sending: true }));
    try {
      await post(`/whatsapp/messages/${enc(forward.msg.id)}/forward`, { to: [...forward.selected] });
      toast.success(`Encaminhada para ${forward.selected.size} conversa${forward.selected.size === 1 ? '' : 's'}.`);
      setForward(null);
      loadList({ silent: true });
    } catch (e) {
      setForward((f) => (f ? { ...f, sending: false } : f));
      toast.error(errMsg(e, 'Não foi possível encaminhar.'));
    }
  };

  // ============================================================ ações do chat (header)
  const chatAction = async (kind) => {
    const cur = activeRef.current;
    setHdrAnchor(null);
    if (!cur) return;
    try {
      if (kind === 'read') {
        markRead(cur.chat_id);
        toast.success('Marcada como lida.');
        return;
      }
      if (!connectedRef.current) {
        toast.error('Conecte o WhatsApp para fazer isso.');
        return;
      }
      const map = { archive: 'archived', pin: 'pinned', mute: 'muted' };
      const field = map[kind];
      const next = !cur[field];
      await post(`/whatsapp/chats/${enc(cur.chat_id)}/${kind}`, { [field]: next });
      patchChat(cur.chat_id, { [field]: next });
      const label = {
        archive: next ? 'Conversa arquivada.' : 'Conversa desarquivada.',
        pin: next ? 'Conversa fixada.' : 'Conversa desafixada.',
        mute: next ? 'Conversa silenciada.' : 'Som reativado.'
      };
      toast.success(label[kind]);
      if (kind === 'archive') loadList({ silent: true });
    } catch (e) {
      toast.error(errMsg(e, 'Falha na operação.'));
    }
  };

  const openGroupInfo = async () => {
    const cur = activeRef.current;
    if (!cur || cur.kind !== 'group') return;
    setGroupDrawer({ loading: true, info: null });
    try {
      const c = await get(`/whatsapp/chats/${enc(cur.chat_id)}`);
      setGroupDrawer({ loading: false, info: c });
      if (c?.group_meta?.participants_count == null && Array.isArray(c?.group_meta?.participants))
        patchChat(cur.chat_id, { group_meta: { ...(cur.group_meta || {}), participants_count: c.group_meta.participants.length } });
    } catch (e) {
      setGroupDrawer(null);
      toast.error(errMsg(e, 'Não foi possível carregar o grupo.'));
    }
  };

  // ============================================================ derivados
  const isGroup = active?.kind === 'group';
  const messageRows = useMemo(() => {
    const out = [];
    let lastDay = null;
    const ts = (m) => new Date(m.timestamp).getTime();
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const day = startOfDay(m.timestamp).getTime();
      if (day !== lastDay) {
        out.push(<DateSeparator key={`d-${day}`} label={dateLabel(m.timestamp)} />);
        lastDay = day;
      }
      const sameAsPrev =
        prev && senderKey(prev) === senderKey(m) && ts(m) - ts(prev) < GROUP_GAP_MS && startOfDay(prev.timestamp).getTime() === day;
      const sameAsNext =
        next && senderKey(next) === senderKey(m) && ts(next) - ts(m) < GROUP_GAP_MS && startOfDay(next.timestamp).getTime() === day;
      out.push(
        <MessageBubble
          key={m.id}
          msg={m}
          isGroup={isGroup}
          first={!sameAsPrev}
          last={!sameAsNext}
          onMenu={openBubbleMenu}
          onImage={openImage}
          onRetry={retrySend}
          onReact={react}
        />
      );
    });
    return out;
  }, [messages, isGroup, openBubbleMenu, openImage, react]);

  const headerSubtitle = !active
    ? ''
    : active.kind === 'group'
      ? active.group_meta?.participants_count != null
        ? `${active.group_meta.participants_count} participantes · toque para ver`
        : 'Grupo · toque para ver participantes'
      : active.kind === 'channel'
        ? 'Canal'
        : active.kind === 'broadcast'
          ? 'Lista de transmissão'
          : fmtPhone(active.phone) || active.chat_id;

  const offline = !connected;
  const canSend = !offline && (Boolean(text.trim()) || Boolean(attachment));
  const showList = !isNarrow || !active;
  const showChat = !isNarrow || Boolean(active);

  // altura exata (mede o topo do bloco e desconta o rodapé) — evita scroll de página
  const shellRef = useRef(null);
  const [shellH, setShellH] = useState(0);
  useEffect(() => {
    const calc = () => {
      const el = shellRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setShellH(Math.max(440, Math.round(window.innerHeight - top - 74)));
    };
    calc();
    const t1 = window.setTimeout(calc, 120);
    const t2 = window.setTimeout(calc, 400);
    window.addEventListener('resize', calc);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', calc);
    };
  }, [connected]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending && canSend) sendText();
    } else if (e.key === 'Escape') {
      if (editing) {
        setEditing(null);
        setText('');
      } else if (reply) setReply(null);
    }
  };

  const bubbleMsg = bubbleMenu?.msg;
  const canEdit = bubbleMsg && bubbleMsg.direction === 'OUT' && bubbleMsg.type === 'text' && !bubbleMsg.revoked;
  const fmtRec = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ============================================================ render
  if (sessionLoading && !session) {
    return (
      <Box>
        <WaPageHeader icon={IconMessages} title="Chat" subtitle="Converse com pessoas e grupos do seu WhatsApp." sx={{ mb: 2 }} />
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress sx={{ color: WA_GREEN }} />
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      ref={shellRef}
      sx={{ display: 'flex', flexDirection: 'column', height: shellH ? `${shellH}px` : 'calc(100dvh - 176px)', minHeight: 440 }}
    >
      <WaPageHeader
        icon={IconMessages}
        title="Chat"
        subtitle={
          connected && session?.push_name
            ? `${session.push_name} · ${fmtPhone(session.phone)}`
            : (connected && fmtPhone(session?.phone)) || 'Converse com pessoas e grupos do seu WhatsApp.'
        }
        sx={{ mb: 2 }}
        action={
          <Tooltip title="Atualizar lista">
            <IconButton onClick={() => loadList()}>
              <IconRefresh size={18} />
            </IconButton>
          </Tooltip>
        }
      />

      {/* sessão fora: aviso slim; lista/histórico continuam legíveis */}
      <WaSessionBanner session={session} loading={sessionLoading} connected={connected} what="enviar e responder mensagens" />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: 'background.paper'
        }}
      >
        {/* ---------------- coluna esquerda ---------------- */}
        {showList ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              width: isNarrow ? '100%' : 360,
              flexShrink: 0,
              borderRight: isNarrow ? 'none' : '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Pesquisar ou começar uma nova conversa"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconSearch size={16} />
                    </InputAdornment>
                  ),
                  endAdornment: q ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setQ('')}>
                        <IconX size={14} />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: 'background.default' } }}
              />
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ mt: 1, overflowX: 'auto', pb: 0.25, scrollPaddingRight: 56, scrollbarWidth: 'thin', '&::-webkit-scrollbar': { height: 4 } }}
              >
                {FILTERS.map((f) => {
                  const on = filter === f.id;
                  return (
                    <Chip
                      key={f.id}
                      ref={on ? activeChipRef : undefined}
                      label={f.label}
                      size="small"
                      onClick={() => selectFilter(f.id)}
                      sx={{
                        fontWeight: 700,
                        borderRadius: 4,
                        flexShrink: 0,
                        bgcolor: on ? (t) => tint(t, 'success', 0.18) : 'action.hover',
                        color: on ? WA_DARK : 'text.secondary',
                        '&:hover': { bgcolor: on ? (t) => tint(t, 'success', 0.24) : 'action.selected' }
                      }}
                    />
                  );
                })}
                {/* filtros personalizados: clique seleciona; ⋮ (hover) / clique-direito / toque longo abrem o menu */}
                {customFilters.map((f) => {
                  const on = filter === f.id;
                  return (
                    <Chip
                      key={f.id}
                      ref={on ? activeChipRef : undefined}
                      label={f.name}
                      size="small"
                      icon={<IconFolder size={13} />}
                      onClick={() => selectFilter(f.id)}
                      onDelete={(e) => openFilterMenu(e.currentTarget, f)}
                      deleteIcon={<IconDotsVertical size={14} />}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openFilterMenu(e.currentTarget, f);
                      }}
                      onTouchStart={(e) => onFilterPressStart(e, f)}
                      onTouchEnd={onFilterPressEnd}
                      onTouchMove={onFilterPressEnd}
                      onTouchCancel={onFilterPressEnd}
                      sx={{
                        fontWeight: 700,
                        borderRadius: 4,
                        flexShrink: 0,
                        maxWidth: 180,
                        bgcolor: on ? (t) => tint(t, 'success', 0.18) : 'action.hover',
                        color: on ? WA_DARK : 'text.secondary',
                        '& .MuiChip-icon': { color: 'inherit', ml: 0.75 },
                        '& .MuiChip-deleteIcon': {
                          color: 'inherit',
                          opacity: on ? 0.8 : 0,
                          width: on ? 18 : 0,
                          mr: on ? 0.5 : 0,
                          ml: on ? -0.25 : -0.75,
                          transition: 'opacity .15s ease, width .15s ease, margin .15s ease',
                          '&:hover': { color: 'inherit', opacity: 1 }
                        },
                        '&:hover .MuiChip-deleteIcon': { opacity: 1, width: 18, mr: 0.5, ml: -0.25 },
                        '&:hover': { bgcolor: on ? (t) => tint(t, 'success', 0.24) : 'action.selected' }
                      }}
                    />
                  );
                })}
                <Tooltip title="Novo filtro (pasta de conversas)">
                  <Chip
                    size="small"
                    icon={<IconPlus size={14} />}
                    label={customFilters.length ? '' : 'Filtro'}
                    onClick={() => setFilterModal({ initial: null })}
                    sx={{
                      fontWeight: 700,
                      borderRadius: 4,
                      flexShrink: 0,
                      // fica sempre visível no fim da linha, mesmo com muitos filtros (a linha rola por baixo dele)
                      position: 'sticky',
                      right: 0,
                      zIndex: 1,
                      ml: 'auto !important',
                      border: '1px dashed',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      boxShadow: (t) => `-10px 0 8px -4px ${t.vars.palette.background.paper}`,
                      color: 'text.secondary',
                      '& .MuiChip-icon': { color: 'inherit', ml: customFilters.length ? 0 : 0.75, mr: customFilters.length ? 0 : -0.25 },
                      '& .MuiChip-label': { px: customFilters.length ? 0.75 : 1 },
                      '&:hover': { bgcolor: 'action.hover', color: WA_DARK, borderColor: WA_DARK }
                    }}
                  />
                </Tooltip>
              </Stack>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', p: 0.75 }}>
              {listLoading && list.items.length === 0 ? (
                <Box sx={{ p: 1 }}>
                  <TgListSkeleton rows={7} />
                </Box>
              ) : visibleChats.length === 0 ? (
                <TgEmptyState
                  dense
                  icon={IconMessages}
                  title={
                    filter === 'unread'
                      ? 'Nada por ler'
                      : filter === 'archived'
                        ? 'Nenhuma conversa arquivada'
                        : isCustomFilter(filter)
                          ? q
                            ? 'Nenhuma conversa encontrada'
                            : 'Filtro vazio'
                          : q
                            ? 'Nenhuma conversa encontrada'
                            : 'Nenhuma conversa ainda'
                  }
                  description={
                    filter === 'all' && !q
                      ? 'As conversas do número conectado aparecem aqui. Para começar uma, abra um contato em Contatos.'
                      : isCustomFilter(filter) && !q
                        ? 'Use o menu ⋮ do chip para editar o filtro e adicionar conversas.'
                        : undefined
                  }
                  sx={{ m: 1, border: 'none', bgcolor: 'transparent' }}
                />
              ) : (
                <Stack spacing={0.25}>
                  {visibleChats.map((c) => (
                    <ChatListItem key={c.chat_id} chat={c} active={active?.chat_id === c.chat_id} onClick={() => openChat(c)} />
                  ))}
                  {list.page < list.pages ? (
                    <Box sx={{ textAlign: 'center', py: 1 }}>
                      <Typography
                        variant="caption"
                        onClick={() => loadList({ page: list.page + 1, append: true })}
                        sx={{ color: WA_DARK, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Carregar mais ({Math.max(0, list.total - list.items.length)})
                      </Typography>
                    </Box>
                  ) : null}
                </Stack>
              )}
            </Box>
          </Box>
        ) : null}

        {/* ---------------- coluna direita ---------------- */}
        {showChat ? (
          <Box
            sx={[
              THREAD_BG,
              { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', '&::before': WALLPAPER }
            ]}
          >
            {!active && offline && !listLoading && list.items.length === 0 ? (
              <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3, position: 'relative', zIndex: 1, overflowY: 'auto' }}>
                <WaNotConnected session={session} title="Conecte o WhatsApp para conversar" sx={{ py: 0, width: '100%' }} />
              </Box>
            ) : !active ? (
              <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3, position: 'relative', zIndex: 1 }}>
                <Stack alignItems="center" spacing={1.5} sx={{ textAlign: 'center', maxWidth: 420 }}>
                  <Box
                    sx={{
                      width: 84,
                      height: 84,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff',
                      background: `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})`,
                      boxShadow: '0 16px 36px rgba(37,211,102,.28)'
                    }}
                  >
                    <IconBrandWhatsapp size={44} stroke={1.7} />
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }}>WhatsApp no Pub Mail</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Selecione uma conversa à esquerda para ler e responder. Mensagens novas chegam sozinhas.
                  </Typography>
                </Stack>
              </Box>
            ) : (
              <>
                {/* header */}
                <Stack
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  sx={{
                    px: 1.25,
                    py: 1,
                    position: 'relative',
                    zIndex: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper'
                  }}
                >
                  {isNarrow ? (
                    <IconButton size="small" onClick={() => setActive(null)} sx={{ ml: -0.5 }}>
                      <IconArrowLeft size={20} />
                    </IconButton>
                  ) : null}
                  <Stack
                    direction="row"
                    spacing={1.25}
                    alignItems="center"
                    onClick={isGroup ? openGroupInfo : undefined}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      cursor: isGroup ? 'pointer' : 'default',
                      borderRadius: 2,
                      px: 0.5,
                      py: 0.25,
                      '&:hover': isGroup ? { bgcolor: 'action.hover' } : {}
                    }}
                  >
                    <TgAvatar
                      name={active.name || active.phone}
                      photoPath={chatPhoto(active)}
                      size={42}
                      kind={kindOfChat(active)}
                      icon={isGroup ? IconUsersGroup : undefined}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography sx={{ fontWeight: 700 }} noWrap>
                          {chatLabel(active)}
                        </Typography>
                        {active.muted ? <IconVolumeOff size={14} style={{ opacity: 0.5 }} /> : null}
                        {active.pinned ? <IconPinned size={14} style={{ opacity: 0.5 }} /> : null}
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                        {headerSubtitle}
                      </Typography>
                    </Box>
                  </Stack>
                  {active.contact?.tags?.length ? (
                    <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
                      {active.contact.tags.slice(0, 3).map((t) => (
                        <Chip
                          key={t}
                          label={t}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: 10.5, borderRadius: 1, borderColor: WA_DARK, color: WA_DARK }}
                        />
                      ))}
                    </Stack>
                  ) : null}
                  <IconButton size="small" onClick={(e) => setHdrAnchor(e.currentTarget)}>
                    <IconDotsVertical size={20} />
                  </IconButton>
                </Stack>

                {/* thread */}
                <Box
                  ref={threadRef}
                  onScroll={onThreadScroll}
                  sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', position: 'relative', zIndex: 1 }}
                >
                  {msgLoading ? (
                    <MessagesSkeleton />
                  ) : messages.length === 0 ? (
                    <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 3 }}>
                      <Box
                        sx={[
                          dual({ bgcolor: '#fff8c5', color: '#54656f' }, { bgcolor: '#182229', color: '#8696a0' }),
                          { px: 2, py: 1, borderRadius: 2, fontSize: 12.5, textAlign: 'center', maxWidth: 360 }
                        ]}
                      >
                        Sem mensagens ainda. Escreva abaixo para começar a conversa.
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ py: 1 }}>
                      {loadingOlder ? (
                        <Stack alignItems="center" sx={{ py: 1 }}>
                          <CircularProgress size={18} sx={{ color: WA_GREEN }} />
                        </Stack>
                      ) : hasOlder ? (
                        <Stack alignItems="center" sx={{ py: 0.5 }}>
                          <Typography
                            variant="caption"
                            onClick={loadOlder}
                            sx={{ color: 'text.secondary', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Carregar mensagens anteriores
                          </Typography>
                        </Stack>
                      ) : null}
                      {messageRows}
                      <Box sx={{ height: 8 }} />
                    </Box>
                  )}
                </Box>
                {showJump ? (
                  <Fab
                    size="small"
                    onClick={() => scrollToEnd(true)}
                    sx={{
                      position: 'absolute',
                      right: 20,
                      bottom: 96,
                      zIndex: 3,
                      bgcolor: 'background.paper',
                      color: 'text.secondary',
                      '&:hover': { bgcolor: 'background.paper' }
                    }}
                  >
                    <IconArrowDown size={18} />
                  </Fab>
                ) : null}

                {/* barra de resposta / edição */}
                {reply || editing ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      position: 'relative',
                      zIndex: 2,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper'
                    }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        borderLeft: '4px solid',
                        borderLeftColor: editing ? '#f5a623' : WA_GREEN,
                        pl: 1,
                        py: 0.25
                      }}
                    >
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {editing ? <IconPencil size={13} /> : <IconCornerUpLeft size={13} />}
                        <Typography variant="caption" sx={{ fontWeight: 700, color: editing ? '#f5a623' : WA_DARK }}>
                          {editing
                            ? 'Editando mensagem'
                            : reply.direction === 'OUT'
                              ? 'Você'
                              : reply.sender_name || active.name || 'Mensagem'}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                        {previewOf(editing || reply)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (editing) {
                          setEditing(null);
                          setText('');
                        } else setReply(null);
                      }}
                    >
                      <IconX size={16} />
                    </IconButton>
                  </Stack>
                ) : null}

                {/* prévia do anexo */}
                {attachment ? (
                  <Stack
                    direction="row"
                    spacing={1.25}
                    alignItems="center"
                    sx={{
                      px: 1.5,
                      py: 1,
                      position: 'relative',
                      zIndex: 2,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper'
                    }}
                  >
                    {attachment.kind === 'image' ? (
                      <img src={attachment.url} alt="anexo" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <Box sx={{ width: 56, height: 56, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}>
                        {attachment.kind === 'video' ? <IconPhoto size={24} /> : <IconFileText size={24} />}
                      </Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {attachment.file.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {fmtBytes(attachment.file.size)} ·{' '}
                        {attachment.asDocument
                          ? 'enviado como documento'
                          : attachment.kind === 'image'
                            ? 'foto'
                            : attachment.kind === 'video'
                              ? 'vídeo'
                              : 'áudio'}{' '}
                        · escreva uma legenda (opcional)
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setAttachment(null)}>
                      <IconX size={16} />
                    </IconButton>
                  </Stack>
                ) : null}

                {/* composer */}
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="flex-end"
                  sx={[
                    dual({ bgcolor: '#f0f2f5' }, { bgcolor: '#202c33' }),
                    {
                      p: 1,
                      position: 'relative',
                      zIndex: 2,
                      borderTop: reply || editing || attachment ? 'none' : '1px solid',
                      borderColor: 'divider'
                    }
                  ]}
                >
                  {rec ? (
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, px: 1, py: 0.75 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: '#f15c6d',
                          animation: `${blink} 1.2s ease-in-out infinite`
                        }}
                      />
                      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtRec(recElapsed)}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }} noWrap>
                        Gravando mensagem de voz…
                      </Typography>
                      <Tooltip title="Cancelar">
                        <IconButton onClick={() => stopRecording(true)} color="error">
                          <IconTrash size={20} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Parar e enviar">
                        <Fab
                          size="small"
                          onClick={() => stopRecording(false)}
                          sx={{ bgcolor: WA_GREEN, color: '#fff', '&:hover': { bgcolor: WA_DARK } }}
                        >
                          <IconPlayerStopFilled size={18} />
                        </Fab>
                      </Tooltip>
                    </Stack>
                  ) : (
                    <>
                      <Box
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          display: 'flex',
                          alignItems: 'flex-end',
                          gap: 0.25,
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 3,
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <Tooltip title="Emoji">
                          <span>
                            <IconButton
                              size="small"
                              onClick={(e) => setEmoji({ anchor: e.currentTarget, mode: 'compose' })}
                              disabled={offline}
                            >
                              <IconMoodSmile size={22} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Anexar">
                          <span>
                            <IconButton
                              size="small"
                              onClick={(e) => setAttachAnchor(e.currentTarget)}
                              disabled={Boolean(editing) || offline}
                            >
                              <IconPaperclip size={22} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <input ref={fileMediaRef} type="file" accept="image/*,video/*" hidden onChange={(e) => pickFile(e, false)} />
                        <input ref={fileDocRef} type="file" hidden onChange={(e) => pickFile(e, true)} />
                        <TextField
                          fullWidth
                          variant="standard"
                          multiline
                          maxRows={6}
                          placeholder={
                            offline
                              ? 'Conecte o WhatsApp para enviar'
                              : editing
                                ? 'Edite a mensagem…'
                                : attachment
                                  ? 'Legenda (opcional)'
                                  : 'Digite uma mensagem'
                          }
                          disabled={offline}
                          value={text}
                          onChange={(e) => onTextChange(e.target.value)}
                          onKeyDown={onKeyDown}
                          inputRef={inputRef}
                          InputProps={{ disableUnderline: true }}
                          sx={{ py: 0.75, px: 0.5, '& textarea': { fontSize: 14.5, lineHeight: 1.4 } }}
                        />
                      </Box>
                      {canSend || editing ? (
                        <Tooltip title={editing ? 'Salvar edição' : 'Enviar'}>
                          <span>
                            <Fab
                              onClick={sendText}
                              disabled={sending || !canSend}
                              sx={{
                                width: 46,
                                height: 46,
                                flexShrink: 0,
                                color: '#fff',
                                bgcolor: WA_GREEN,
                                '&:hover': { bgcolor: WA_DARK },
                                boxShadow: canSend ? '0 6px 16px rgba(37,211,102,.4)' : 'none'
                              }}
                            >
                              {sending ? (
                                <CircularProgress size={18} color="inherit" />
                              ) : editing ? (
                                <IconCheck size={22} />
                              ) : (
                                <IconSend size={20} />
                              )}
                            </Fab>
                          </span>
                        </Tooltip>
                      ) : (
                        <Tooltip title={offline ? 'Conecte o WhatsApp para enviar' : 'Gravar mensagem de voz'}>
                          <span>
                            <Fab
                              onClick={startRecording}
                              disabled={offline}
                              sx={{
                                width: 46,
                                height: 46,
                                flexShrink: 0,
                                color: '#fff',
                                bgcolor: WA_GREEN,
                                '&:hover': { bgcolor: WA_DARK }
                              }}
                            >
                              <IconMicrophone size={22} />
                            </Fab>
                          </span>
                        </Tooltip>
                      )}
                    </>
                  )}
                </Stack>
              </>
            )}
          </Box>
        ) : null}
      </Box>

      {/* ---------------- emoji (composer / reação) ---------------- */}
      <EmojiPicker
        anchorEl={emoji?.anchor || null}
        recent={recentEmojis}
        onClose={() => setEmoji(null)}
        onPick={(em) => {
          if (emoji?.mode === 'react') {
            react(emoji.msg, em);
            setEmoji(null);
          } else insertEmoji(em);
        }}
      />

      {/* ---------------- menu anexar ---------------- */}
      <Menu
        open={Boolean(attachAnchor)}
        anchorEl={attachAnchor}
        onClose={() => setAttachAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {[
          { icon: IconPhoto, color: '#007bfc', label: 'Fotos e vídeos', onClick: () => fileMediaRef.current?.click() },
          { icon: IconFileText, color: '#7f66ff', label: 'Documento', onClick: () => fileDocRef.current?.click() },
          { icon: IconMicrophone, color: '#ff2e74', label: 'Gravar áudio', onClick: startRecording },
          { icon: IconMapPin, color: '#1fa855', label: 'Localização', onClick: askLocation, keep: true },
          {
            icon: IconChartBar,
            color: '#ffbc38',
            label: 'Enquete',
            onClick: () => setPollDlg({ name: '', options: ['', ''], multiple: false, loading: false })
          }
        ].map((it) => (
          <MenuItem
            key={it.label}
            onClick={() => {
              if (!it.keep) setAttachAnchor(null);
              it.onClick();
            }}
            sx={{ py: 1, pr: 3 }}
          >
            <ListItemIcon>
              <Box
                sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: it.color, color: '#fff', display: 'grid', placeItems: 'center' }}
              >
                <it.icon size={17} />
              </Box>
            </ListItemIcon>
            <ListItemText slotProps={{ primary: { sx: { fontWeight: 600 } } }}>{it.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* ---------------- menu do header ---------------- */}
      <Menu
        open={Boolean(hdrAnchor)}
        anchorEl={hdrAnchor}
        onClose={() => setHdrAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {isGroup ? (
          <MenuItem
            onClick={() => {
              setHdrAnchor(null);
              openGroupInfo();
            }}
          >
            <ListItemIcon>
              <IconUsersGroup size={18} />
            </ListItemIcon>
            <ListItemText>Participantes</ListItemText>
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => chatAction('read')}>
          <ListItemIcon>
            <IconMailOpened size={18} />
          </ListItemIcon>
          <ListItemText>Marcar como lida</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => chatAction('pin')} disabled={offline}>
          <ListItemIcon>{active?.pinned ? <IconPinnedOff size={18} /> : <IconPin size={18} />}</ListItemIcon>
          <ListItemText>{active?.pinned ? 'Desafixar conversa' : 'Fixar conversa'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => chatAction('mute')} disabled={offline}>
          <ListItemIcon>{active?.muted ? <IconVolume size={18} /> : <IconVolumeOff size={18} />}</ListItemIcon>
          <ListItemText>{active?.muted ? 'Reativar som' : 'Silenciar'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => chatAction('archive')} disabled={offline}>
          <ListItemIcon>{active?.archived ? <IconArchiveOff size={18} /> : <IconArchive size={18} />}</ListItemIcon>
          <ListItemText>{active?.archived ? 'Desarquivar' : 'Arquivar'}</ListItemText>
        </MenuItem>
      </Menu>

      {/* ---------------- menu da mensagem ---------------- */}
      <Menu
        open={Boolean(bubbleMenu)}
        anchorEl={bubbleMenu?.anchor}
        onClose={() => setBubbleMenu(null)}
        anchorOrigin={{ vertical: 'top', horizontal: bubbleMsg?.direction === 'OUT' ? 'left' : 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: bubbleMsg?.direction === 'OUT' ? 'right' : 'left' }}
        slotProps={{ paper: { sx: { borderRadius: 3, minWidth: 220 } } }}
      >
        {bubbleMsg && offline ? (
          <Typography variant="caption" sx={{ display: 'block', px: 2, pb: 0.75, color: 'warning.main', fontWeight: 700 }}>
            Conecte o WhatsApp para agir nesta mensagem
          </Typography>
        ) : null}
        {bubbleMsg && !bubbleMsg.revoked && !offline ? (
          <Stack direction="row" spacing={0.25} sx={{ px: 1, pb: 0.75, pt: 0.25 }}>
            {QUICK_REACTIONS.map((em) => (
              <Box
                key={em}
                onClick={() => {
                  react(bubbleMsg, em);
                  setBubbleMenu(null);
                }}
                sx={{
                  fontSize: 22,
                  width: 34,
                  height: 34,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  transition: 'transform .1s',
                  '&:hover': { bgcolor: 'action.hover', transform: 'scale(1.2)' }
                }}
              >
                {em}
              </Box>
            ))}
            <Tooltip title="Mais emojis">
              <IconButton
                size="small"
                onClick={(e) => {
                  const anchor = bubbleMenu.anchor;
                  setBubbleMenu(null);
                  setEmoji({ anchor, mode: 'react', msg: bubbleMsg });
                  e.stopPropagation();
                }}
              >
                <IconMoodSmile size={20} />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : null}
        {bubbleMsg && !bubbleMsg.revoked ? <Divider sx={{ my: 0.5 }} /> : null}
        {bubbleMsg && !bubbleMsg.revoked ? (
          <MenuItem
            disabled={offline}
            onClick={() => {
              setReply(bubbleMsg);
              setEditing(null);
              setBubbleMenu(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <ListItemIcon>
              <IconArrowBackUp size={18} />
            </ListItemIcon>
            <ListItemText>Responder</ListItemText>
          </MenuItem>
        ) : null}
        {bubbleMsg && !bubbleMsg.revoked ? (
          <MenuItem
            disabled={offline}
            onClick={() => {
              openForward(bubbleMsg);
              setBubbleMenu(null);
            }}
          >
            <ListItemIcon>
              <IconArrowForwardUp size={18} />
            </ListItemIcon>
            <ListItemText>Encaminhar</ListItemText>
          </MenuItem>
        ) : null}
        {bubbleMsg && !bubbleMsg.revoked && (bubbleMsg.body || bubbleMsg.type !== 'text') ? (
          <MenuItem
            onClick={() => {
              copyMsg(bubbleMsg);
              setBubbleMenu(null);
            }}
          >
            <ListItemIcon>
              <IconCopy size={18} />
            </ListItemIcon>
            <ListItemText>Copiar</ListItemText>
          </MenuItem>
        ) : null}
        {canEdit ? (
          <MenuItem
            disabled={offline}
            onClick={() => {
              startEdit(bubbleMsg);
              setBubbleMenu(null);
            }}
          >
            <ListItemIcon>
              <IconPencil size={18} />
            </ListItemIcon>
            <ListItemText>Editar</ListItemText>
          </MenuItem>
        ) : null}
        {bubbleMsg ? (
          <MenuItem
            disabled={offline}
            onClick={() => {
              setDel({ msg: bubbleMsg, loading: false });
              setBubbleMenu(null);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              <IconTrash size={18} />
            </ListItemIcon>
            <ListItemText>Apagar</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>

      {/* ---------------- lightbox ---------------- */}
      <Dialog
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: '#000', borderRadius: 2, overflow: 'hidden', position: 'relative' } }}
      >
        {lightbox ? (
          <>
            <IconButton
              onClick={() => setLightbox(null)}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                color: '#fff',
                bgcolor: 'rgba(0,0,0,.4)',
                zIndex: 2,
                '&:hover': { bgcolor: 'rgba(0,0,0,.6)' }
              }}
            >
              <IconX size={20} />
            </IconButton>
            <IconButton
              component="a"
              href={dlUrl(lightbox.url)}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                position: 'absolute',
                top: 8,
                right: 52,
                color: '#fff',
                bgcolor: 'rgba(0,0,0,.4)',
                zIndex: 2,
                '&:hover': { bgcolor: 'rgba(0,0,0,.6)' }
              }}
            >
              <IconDownload size={20} />
            </IconButton>
            <img
              src={lightbox.url}
              alt={lightbox.caption || 'imagem'}
              style={{ display: 'block', maxWidth: '92vw', maxHeight: '86vh', objectFit: 'contain' }}
            />
            {lightbox.caption ? (
              <Typography variant="body2" sx={{ color: '#fff', p: 1.5, textAlign: 'center', bgcolor: 'rgba(0,0,0,.6)' }}>
                {lightbox.caption}
              </Typography>
            ) : null}
          </>
        ) : null}
      </Dialog>

      {/* ---------------- encaminhar ---------------- */}
      <TgModal
        open={Boolean(forward)}
        onClose={() => !forward?.sending && setForward(null)}
        title="Encaminhar mensagem"
        subtitle={forward ? previewOf(forward.msg) : ''}
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ width: '100%' }} alignItems="center">
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {forward?.selected.size
                ? `${forward.selected.size} selecionada${forward.selected.size === 1 ? '' : 's'}`
                : 'Escolha uma ou mais conversas'}
            </Typography>
            <Button
              variant="contained"
              disableElevation
              onClick={doForward}
              disabled={!forward?.selected.size || forward?.sending}
              startIcon={forward?.sending ? <CircularProgress size={16} color="inherit" /> : <IconSend size={16} />}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Encaminhar
            </Button>
          </Stack>
        }
      >
        {forward ? (
          <Stack spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar conversa"
              value={forward.q}
              onChange={(e) => setForward((f) => ({ ...f, q: e.target.value }))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <IconSearch size={16} />
                  </InputAdornment>
                )
              }}
            />
            <Box sx={{ maxHeight: 360, overflowY: 'auto', overscrollBehavior: 'contain' }}>
              {forward.loading ? (
                <TgListSkeleton rows={4} />
              ) : forward.items.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                  Nenhuma conversa encontrada.
                </Typography>
              ) : (
                forward.items.map((c) => {
                  const on = forward.selected.has(c.chat_id);
                  return (
                    <Stack
                      key={c.chat_id}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      onClick={() =>
                        setForward((f) => {
                          const s = new Set(f.selected);
                          if (s.has(c.chat_id)) s.delete(c.chat_id);
                          else s.add(c.chat_id);
                          return { ...f, selected: s };
                        })
                      }
                      sx={{
                        px: 0.5,
                        py: 0.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        bgcolor: on ? (t) => tint(t, 'success', 0.12) : 'transparent',
                        '&:hover': { bgcolor: on ? (t) => tint(t, 'success', 0.16) : 'action.hover' }
                      }}
                    >
                      <Checkbox size="small" checked={on} sx={{ p: 0.5, color: WA_DARK, '&.Mui-checked': { color: WA_GREEN } }} />
                      <TgAvatar
                        name={c.name || c.phone}
                        size={34}
                        kind={kindOfChat(c)}
                        icon={c.kind === 'group' ? IconUsersGroup : undefined}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {c.name || fmtPhone(c.phone) || c.chat_id}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                          {c.kind === 'group' ? 'Grupo' : fmtPhone(c.phone)}
                        </Typography>
                      </Box>
                    </Stack>
                  );
                })
              )}
            </Box>
          </Stack>
        ) : null}
      </TgModal>

      {/* ---------------- filtros personalizados ---------------- */}
      <Menu
        open={Boolean(filterMenu)}
        anchorEl={filterMenu?.anchor}
        onClose={() => setFilterMenu(null)}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 180 } } }}
      >
        <MenuItem
          onClick={() => {
            const item = filterMenu?.item;
            setFilterMenu(null);
            if (item) setFilterModal({ initial: item });
          }}
        >
          <ListItemIcon>
            <IconPencil size={17} />
          </ListItemIcon>
          <ListItemText
            primary="Editar"
            secondary={filterMenu?.item ? `${filterMenu.item.chat_ids?.length ?? filterMenu.item.count ?? 0} conversas` : null}
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            const item = filterMenu?.item;
            setFilterMenu(null);
            if (item) setFilterDel({ item, loading: false });
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <IconTrash size={17} />
          </ListItemIcon>
          <ListItemText primary="Excluir" />
        </MenuItem>
      </Menu>
      <ChatFilterModal
        open={Boolean(filterModal)}
        initial={filterModal?.initial || null}
        connected={connected}
        onClose={() => setFilterModal(null)}
        onSaved={onFilterSaved}
      />
      <TgConfirmDialog
        open={Boolean(filterDel)}
        onClose={() => !filterDel?.loading && setFilterDel(null)}
        onConfirm={doDeleteFilter}
        loading={Boolean(filterDel?.loading)}
        danger
        icon={IconTrash}
        title="Excluir filtro?"
        confirmLabel="Excluir"
        message={filterDel?.item ? `O filtro “${filterDel.item.name}” será removido. As conversas continuam intactas.` : ''}
      />

      {/* ---------------- apagar ---------------- */}
      <TgModal open={Boolean(del)} onClose={() => !del?.loading && setDel(null)} title="Apagar mensagem?" maxWidth="xs">
        {del ? (
          <Stack spacing={1.5}>
            <Box sx={{ borderLeft: '4px solid', borderLeftColor: 'divider', pl: 1.25, py: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                {previewOf(del.msg)}
              </Typography>
            </Box>
            <Stack spacing={1}>
              {del.msg.direction === 'OUT' && !del.msg.revoked ? (
                <Button
                  variant="contained"
                  color="error"
                  disableElevation
                  onClick={() => doDelete(true)}
                  disabled={del.loading}
                  sx={{ fontWeight: 700, justifyContent: 'flex-start' }}
                  startIcon={<IconTrash size={16} />}
                >
                  Apagar para todos
                </Button>
              ) : null}
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => doDelete(false)}
                disabled={del.loading}
                sx={{ fontWeight: 700, justifyContent: 'flex-start' }}
                startIcon={<IconTrash size={16} />}
              >
                Apagar para mim
              </Button>
              <Button color="inherit" onClick={() => setDel(null)} disabled={del.loading} sx={{ fontWeight: 600 }}>
                Cancelar
              </Button>
            </Stack>
            {del.msg.direction === 'OUT' && !del.msg.revoked ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                "Para todos" só funciona em mensagens recentes (limite do WhatsApp). "Para mim" remove apenas daqui.
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </TgModal>

      {/* ---------------- enquete ---------------- */}
      <TgModal
        open={Boolean(pollDlg)}
        onClose={() => !pollDlg?.loading && setPollDlg(null)}
        title="Nova enquete"
        subtitle="Pergunta + 2 a 12 opções. Os votos aparecem na conversa."
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setPollDlg(null)} disabled={pollDlg?.loading}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={sendPoll}
              disabled={pollDlg?.loading}
              startIcon={pollDlg?.loading ? <CircularProgress size={16} color="inherit" /> : <IconChartBar size={16} />}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Enviar enquete
            </Button>
          </Stack>
        }
      >
        {pollDlg ? (
          <Stack spacing={1.5}>
            <TextField
              label="Pergunta"
              size="small"
              fullWidth
              autoFocus
              value={pollDlg.name}
              onChange={(e) => setPollDlg((d) => ({ ...d, name: e.target.value.slice(0, 255) }))}
            />
            <Stack spacing={1}>
              {pollDlg.options.map((o, i) => (
                <TextField
                  key={i}
                  size="small"
                  fullWidth
                  label={`Opção ${i + 1}`}
                  value={o}
                  onChange={(e) =>
                    setPollDlg((d) => ({ ...d, options: d.options.map((x, j) => (j === i ? e.target.value.slice(0, 100) : x)) }))
                  }
                  InputProps={{
                    endAdornment:
                      pollDlg.options.length > 2 ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setPollDlg((d) => ({ ...d, options: d.options.filter((_, j) => j !== i) }))}
                          >
                            <IconX size={14} />
                          </IconButton>
                        </InputAdornment>
                      ) : null
                  }}
                />
              ))}
            </Stack>
            {pollDlg.options.length < 12 ? (
              <Button
                size="small"
                onClick={() => setPollDlg((d) => ({ ...d, options: [...d.options, ''] }))}
                sx={{ alignSelf: 'flex-start', fontWeight: 700 }}
              >
                + Adicionar opção
              </Button>
            ) : null}
            <FormControlLabel
              control={
                <Switch
                  checked={pollDlg.multiple}
                  onChange={(e) => setPollDlg((d) => ({ ...d, multiple: e.target.checked }))}
                  color="success"
                />
              }
              label="Permitir múltiplas respostas"
            />
          </Stack>
        ) : null}
      </TgModal>

      {/* ---------------- localização ---------------- */}
      <TgModal
        open={Boolean(locDlg)}
        onClose={() => !locDlg?.loading && setLocDlg(null)}
        title="Enviar localização"
        subtitle="Sua posição atual, obtida pelo navegador."
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setLocDlg(null)} disabled={locDlg?.loading}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={sendLocation}
              disabled={locDlg?.loading}
              startIcon={locDlg?.loading ? <CircularProgress size={16} color="inherit" /> : <IconMapPin size={16} />}
              sx={{ fontWeight: 700, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Enviar
            </Button>
          </Stack>
        }
      >
        {locDlg ? (
          <Stack spacing={1.5}>
            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'background.default', border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {locDlg.lat.toFixed(6)}, {locDlg.lng.toFixed(6)}
              </Typography>
              <Typography
                variant="caption"
                component="a"
                href={`https://maps.google.com/?q=${locDlg.lat},${locDlg.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: WA_DARK, fontWeight: 600 }}
              >
                Conferir no mapa
              </Typography>
            </Box>
            <TextField
              label="Descrição (opcional)"
              size="small"
              fullWidth
              value={locDlg.description}
              onChange={(e) => setLocDlg((d) => ({ ...d, description: e.target.value.slice(0, 200) }))}
              placeholder="Ex.: Nossa loja"
            />
          </Stack>
        ) : null}
      </TgModal>

      {/* ---------------- participantes do grupo ---------------- */}
      <Drawer
        anchor="right"
        open={Boolean(groupDrawer)}
        onClose={() => setGroupDrawer(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 380 } } }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 17, flex: 1 }}>Dados do grupo</Typography>
          <IconButton size="small" onClick={() => setGroupDrawer(null)}>
            <IconX size={18} />
          </IconButton>
        </Stack>
        {groupDrawer?.loading ? (
          <Box sx={{ p: 2 }}>
            <TgListSkeleton rows={5} />
          </Box>
        ) : groupDrawer?.info ? (
          <Box sx={{ overflowY: 'auto' }}>
            <Stack alignItems="center" spacing={1} sx={{ p: 3, textAlign: 'center' }}>
              <TgAvatar name={groupDrawer.info.name} photoPath={chatPhoto(groupDrawer.info)} size={88} kind="group" icon={IconUsersGroup} />
              <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
                {groupDrawer.info.group_meta?.subject || groupDrawer.info.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Grupo · {groupDrawer.info.group_meta?.participants?.length ?? groupDrawer.info.group_meta?.participants_count ?? 0}{' '}
                participantes
              </Typography>
              {groupDrawer.info.group_meta?.description ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', mt: 1 }}>
                  {groupDrawer.info.group_meta.description}
                </Typography>
              ) : null}
              {groupDrawer.info.group_meta?.invite_code ? (
                <Button
                  size="small"
                  startIcon={<IconCopy size={14} />}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`https://chat.whatsapp.com/${groupDrawer.info.group_meta.invite_code}`);
                      toast.success('Link de convite copiado.');
                    } catch {
                      toast.error('Não foi possível copiar.');
                    }
                  }}
                  sx={{ fontWeight: 700 }}
                >
                  Copiar link de convite
                </Button>
              ) : null}
            </Stack>
            <Divider />
            <Stack spacing={0} sx={{ p: 1 }}>
              {(groupDrawer.info.group_meta?.participants || []).map((p) => (
                <Stack
                  key={p.id || p.phone}
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  sx={{ px: 1, py: 0.75, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <TgAvatar name={p.name || p.phone} size={38} kind="contact" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {p.name || fmtPhone(p.phone) || p.id}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                      {fmtPhone(p.phone) || p.id}
                    </Typography>
                  </Box>
                  {p.is_admin ? (
                    <Chip
                      size="small"
                      icon={<IconCrown size={13} />}
                      label="Admin"
                      sx={{ height: 22, fontWeight: 700, color: WA_DARK, bgcolor: (t) => tint(t, 'success', 0.14) }}
                    />
                  ) : null}
                </Stack>
              ))}
              {!groupDrawer.info.group_meta?.participants?.length ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                  A lista de participantes não está disponível.
                </Typography>
              ) : null}
            </Stack>
          </Box>
        ) : null}
      </Drawer>
    </Box>
  );
}
