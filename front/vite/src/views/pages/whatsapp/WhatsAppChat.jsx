import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
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
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconArchive,
  IconArchiveOff,
  IconArrowBackUp,
  IconArrowDown,
  IconArrowForwardUp,
  IconArrowLeft,
  IconBolt,
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
  IconHeadset,
  IconMailOpened,
  IconMapPin,
  IconMessagePlus,
  IconMessages,
  IconMicrophone,
  IconMoodSmile,
  IconPaperclip,
  IconPencil,
  IconPhoneIncoming,
  IconPhoneOutgoing,
  IconPhoto,
  IconPin,
  IconPinned,
  IconPinnedOff,
  IconPlayerStopFilled,
  IconPlus,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconSend,
  IconTag,
  IconTrash,
  IconUser,
  IconUsersGroup,
  IconUsers,
  IconUserDollar,
  IconReceipt2,
  IconVideo,
  IconVolume,
  IconVolumeOff,
  IconX
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { TgEmptyState, TgAvatar, TgModal, TgListSkeleton, TgConfirmDialog } from 'views/pages/telegram/ui';
import { WaPageHeader, WaSessionBanner } from './waKit';
import WaChatPicker from './WaChatPicker';
import { useRealtimeEvent, useRealtimeStatus } from 'realtime/useRealtime';
import { useAuth } from 'contexts/AuthContext';
import ScrollChipsRow from './chat/ScrollChipsRow';
import AudioPlayer from './chat/AudioPlayer';
import { contactsOfMessage } from './chat/vcard';
import ContactInfoDrawer from './chat/ContactInfo';
import { PreviewText } from './chat/mediaIcons';
import { useTeam, TeamList, TeamThread, NewGroupDialog } from './chat/TeamChat';
import {
  ADV_DEFAULT,
  ActiveAdvChips,
  AdvancedFiltersPopover,
  advActiveCount,
  advMatches,
  advToParams,
  loadAdv,
  saveAdv
} from './chat/AdvancedFilters';
import { AttendanceMenu, ServiceHistoryDialog, TagsPopover, TransferDialog } from './chat/Attendance';
import CustomerPanel from './chat/CustomerPanel';
import ChargeDialog from './crm/ChargeDialog';
import { QuickRepliesPopper, fillQuickReply, filterQuickReplies, quickMediaKind, quickMediaMeta } from './chat/QuickReplies';
import {
  ACTIVE_FG,
  MoreChip,
  ServiceTag,
  TagChip,
  THIN_SCROLL,
  WAIT_TONE,
  firstName,
  fmtCount,
  fmtWait,
  serviceInfo
} from './chat/chatKit';
import {
  WA_GREEN,
  WA_DARK,
  WA_TICK_BLUE,
  QUICK_REACTIONS,
  EmojiPicker,
  WaNotConnected,
  useWaSessions,
  WaNumberChip,
  WaNumberDot,
  WaNumberSelect,
  sessionLabel,
  tint,
  dual,
  errMsg,
  fmtPhone,
  onlyDigits,
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

// Tempo real vem pelo WebSocket (wa:message / wa:chat). O polling fica como reserva:
// lento com a conexão em tempo real de pé, rápido se ela cair.
const LIST_POLL_MS = 10000;
const MSG_POLL_MS = 3000;
const LIST_POLL_RT_MS = 60000;
const MSG_POLL_RT_MS = 30000;
const PAGE = 50;
const GROUP_GAP_MS = 3 * 60 * 1000;
const enc = (v) => encodeURIComponent(String(v));

const blink = keyframes`0%{opacity:1}50%{opacity:.25}100%{opacity:1}`;
const flashKf = keyframes`0%{background-color:rgba(37,211,102,0)}15%{background-color:rgba(37,211,102,.28)}70%{background-color:rgba(37,211,102,.16)}100%{background-color:rgba(37,211,102,0)}`;
const popIn = keyframes`from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}`;
const WAIT_MIN_MS = 10 * 60 * 1000; // "aguardando há…" só depois de 10 min sem resposta

// chips fixos: id → contagem em /whatsapp/chats/counts
const FILTERS = [
  { id: 'all', label: 'Todos', count: 'all' },
  { id: 'unread', label: 'Não lidos', count: 'unread', strong: true },
  { id: 'dms', label: 'DMs', count: 'dms' },
  { id: 'groups', label: 'Grupos', count: 'groups' },
  { id: 'mine', label: 'Meus atendimentos', count: 'mine', strong: true },
  { id: 'archived', label: 'Arquivados', count: 'archived' }
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

// sem emoji: o ícone do tipo entra pelo <PreviewText type=…> (chat/mediaIcons.jsx)
const TYPE_LABEL = {
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
// nome vazio/placeholder ou só dígitos (o back devolve `+55…` quando não há nome) → telefone formatado
const chatLabel = (c) =>
  (c?.kind === 'individual' && (c?.name === 'Contato sem nome' || /^\+?\d{8,}$/.test(String(c?.name || ''))) && c?.phone
    ? fmtPhone(c.phone)
    : c?.name) ||
  fmtPhone(c?.phone) ||
  (c?.jid ? String(c.jid).split('@')[0] : '') ||
  'Conversa';
const kindOfChat = (c) => (c?.kind === 'group' ? 'group' : c?.kind === 'channel' || c?.kind === 'broadcast' ? 'channel' : 'contact');
// participantes: você → admins → com nome (A→Z) → só telefone
const sortParticipants = (list) =>
  [...list].sort((a, b) => {
    const rank = (p) => (p.is_me ? 0 : p.is_admin ? 1 : p.name ? 2 : 3);
    const d = rank(a) - rank(b);
    if (d) return d;
    return String(a.name || a.phone || a.id || '').localeCompare(String(b.name || b.phone || b.id || ''), 'pt-BR');
  });
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
const FMT_RE = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s<]+|www\.[^\s<]+|@\d{7,16}(?!\d))/g;
// `mentions` = extra.mention_names do back ({ '<id>': { name, phone } }); `onPerson` abre os dados da pessoa
function WaText({ text, tail = 0, sx, mentions, onPerson }) {
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
        if (/^@\d{7,16}$/.test(p)) {
          const key = p.slice(1);
          const m = mentions?.[key];
          const label = m?.name ? `@${m.name}` : m?.phone ? `@${fmtPhone(m.phone)}` : p;
          const clickable = Boolean(m && (m.phone || m.name) && onPerson);
          return (
            <Box
              key={i}
              component="span"
              onClick={
                clickable
                  ? (e) => {
                      e.stopPropagation();
                      onPerson({ jid: m.phone ? `${m.phone}@c.us` : `${key}@lid`, name: m.name || null, session_id: msg?.session_id });
                    }
                  : undefined
              }
              sx={[
                dual({ color: '#027eb5' }, { color: '#53bdeb' }),
                { fontWeight: 700, cursor: clickable ? 'pointer' : 'default', '&:hover': clickable ? { textDecoration: 'underline' } : {} }
              ]}
            >
              {label}
            </Box>
          );
        }
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
const ChatListItem = memo(function ChatListItem({ chat, active, onOpen, now, session }) {
  const kind = kindOfChat(chat);
  const isGroup = chat.kind === 'group';
  const preview = chat.last_message_preview || (isGroup ? `${chat.group_meta?.participants_count ?? '—'} participantes` : 'Sem mensagens');
  const unread = Number(chat.unread_count) || 0;
  const svc = chat.kind === 'individual' ? serviceInfo(chat.service, { compact: true }) : null;
  const tags = Array.isArray(chat.tags) ? chat.tags.filter((t) => t && t.name) : [];
  const waitMs = now && chat.waiting_reply && chat.last_inbound_at ? now - new Date(chat.last_inbound_at).getTime() : 0;
  const waiting = waitMs > WAIT_MIN_MS;
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      onClick={() => onOpen(chat)}
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
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: unread ? 800 : 700, fontSize: 14.5, minWidth: 0 }} noWrap>
              {chatLabel(chat)}
            </Typography>
            {session ? <WaNumberChip session={session} sx={{ flexShrink: 0, maxWidth: 110 }} /> : null}
          </Stack>
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
            {chat.last_message_preview ? <PreviewText preview={preview} /> : preview}
          </Typography>
          {waiting ? (
            <Tooltip title={`Aguardando resposta há ${fmtWait(waitMs)}`} disableInteractive>
              <Stack
                direction="row"
                spacing={0.25}
                alignItems="center"
                sx={[WAIT_TONE, { flexShrink: 0, fontSize: 11, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }]}
              >
                <IconClock size={12} stroke={2.2} />
                <span>há {fmtWait(waitMs)}</span>
              </Stack>
            </Tooltip>
          ) : null}
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
        {svc || tags.length ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5, minWidth: 0, overflow: 'hidden' }}>
            {svc ? <ServiceTag info={svc} /> : null}
            {tags.slice(0, 2).map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
            <MoreChip
              n={Math.max(0, tags.length - 2)}
              title={tags
                .slice(2)
                .map((t) => t.name)
                .join(', ')}
            />
          </Stack>
        ) : null}
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
// Mídia que ainda não temos o arquivo: explica o motivo em vez de só "não disponível".
//  - sem motivo → o servidor está baixando (chega sozinho pelo tempo real);
//  - history    → mensagem anterior à conexão (o WhatsApp não reenvia o arquivo);
//  - unavailable/error → o WhatsApp não entregou; dá pra tentar de novo.
function MediaOmitted({ msg, label = 'Mídia' }) {
  const [busy, setBusy] = useState(false);
  const info = msg?.media_info || {};
  const reason = info.reason || null;
  const meta = [info.filename, info.size ? fmtBytes(info.size) : null].filter(Boolean).join(' · ');
  const retry = async (e) => {
    e?.stopPropagation?.();
    if (!msg?.id || busy) return;
    setBusy(true);
    try {
      const r = await post(`/whatsapp/messages/${enc(msg.id)}/media/retry`);
      if (r && r.ok === false) {
        if (r.media_info?.final)
          toast('Esse arquivo não foi baixado quando chegou e o WhatsApp não deixa baixar depois. Peça para reenviar.', {
            icon: '⚠️',
            id: 'wa-media-gone'
          });
        else toast('O WhatsApp ainda não entregou esse arquivo.', { icon: '⏳', id: 'wa-media-wait' });
      }
    } catch (err) {
      toast.error(errMsg(err, 'Não foi possível baixar.'));
    } finally {
      setBusy(false);
    }
  };
  const downloading = !reason || busy;
  const text = downloading
    ? `Baixando ${label.toLowerCase()}…`
    : reason === 'history'
      ? `${label} de antes da conexão — veja no celular`
      : info.final
        ? `${label} não foi baixado quando chegou — peça para reenviar ou veja no celular`
        : `${label} não pôde ser baixado do WhatsApp`;
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={[
        dual({ bgcolor: 'rgba(0,0,0,.05)' }, { bgcolor: 'rgba(255,255,255,.06)' }),
        { py: 0.75, px: 1, borderRadius: 1.5, mb: msg?.body ? 0.5 : 0, maxWidth: 320 }
      ]}
    >
      {downloading ? (
        <CircularProgress size={16} thickness={5} sx={{ color: 'inherit', opacity: 0.7 }} />
      ) : (
        <IconAlertCircle size={18} style={{ opacity: 0.75, flexShrink: 0 }} />
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.85, lineHeight: 1.3 }}>
          {text}
        </Typography>
        {meta ? (
          <Typography variant="caption" sx={{ opacity: 0.6 }} noWrap display="block">
            {meta}
          </Typography>
        ) : null}
      </Box>
      {!downloading && reason !== 'history' && !info.final ? (
        <Tooltip title="Tentar de novo">
          <IconButton size="small" onClick={retry} sx={{ color: 'inherit' }}>
            <IconRefresh size={16} />
          </IconButton>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

// Botão de baixar sobreposto à foto/vídeo
function MediaDownload({ url }) {
  if (!url) return null;
  return (
    <Tooltip title="Baixar">
      <IconButton
        size="small"
        component="a"
        href={dlUrl(url)}
        onClick={(e) => e.stopPropagation()}
        className="wa-media-dl"
        sx={{
          position: 'absolute',
          top: 6,
          right: 6,
          bgcolor: 'rgba(0,0,0,.45)',
          color: '#fff',
          opacity: 0,
          transition: 'opacity .15s',
          '&:hover': { bgcolor: 'rgba(0,0,0,.65)' }
        }}
      >
        <IconDownload size={16} />
      </IconButton>
    </Tooltip>
  );
}

function ImageBody({ msg, onOpen }) {
  const url = msg.media?.url;
  if (!url) return <MediaOmitted msg={msg} label="Foto" />;
  return (
    <Box
      onClick={() => onOpen(url, msg.body)}
      sx={{
        cursor: 'zoom-in',
        borderRadius: 1.5,
        overflow: 'hidden',
        maxWidth: 320,
        mb: msg.body ? 0.5 : 0,
        position: 'relative',
        '&:hover .wa-media-dl': { opacity: 1 }
      }}
    >
      {!msg.uploading ? <MediaDownload url={url} /> : null}
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
  if (!url) return <MediaOmitted msg={msg} label="Vídeo" />;
  return (
    <Box
      sx={{
        borderRadius: 1.5,
        overflow: 'hidden',
        maxWidth: 320,
        mb: msg.body ? 0.5 : 0,
        bgcolor: '#000',
        position: 'relative',
        '&:hover .wa-media-dl': { opacity: 1 }
      }}
    >
      <MediaDownload url={url} />
      <video src={url} controls preload="metadata" style={{ display: 'block', width: '100%', maxHeight: 360 }} />
    </Box>
  );
}

function AudioBody({ msg }) {
  const url = msg.media?.url;
  const voice = msg.type === 'voice';
  if (!url) return <MediaOmitted msg={msg} label={voice ? 'Áudio de voz' : 'Áudio'} />;
  return (
    <Box sx={{ mb: msg.body ? 0.5 : 0 }}>
      <AudioPlayer url={url} voice={voice} out={msg.direction === 'OUT'} />
    </Box>
  );
}

// Chamada de voz/vídeo: pílula de sistema centralizada (não é um balão)
function CallPill({ msg }) {
  const out = msg.direction === 'OUT';
  const body = String(msg.body || '').trim();
  const video = /v[íi]deo/i.test(body);
  const Icon = video ? IconVideo : out ? IconPhoneOutgoing : IconPhoneIncoming;
  const label = body && !/^📞/.test(body) ? body : `${video ? 'Chamada de vídeo' : 'Chamada de voz'} ${out ? 'realizada' : 'recebida'}`;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 1, px: 2 }}>
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={[
          dual({ bgcolor: '#ffffff', color: '#54656f' }, { bgcolor: '#182229', color: '#8696a0' }),
          { px: 1.5, py: 0.6, borderRadius: 2, fontSize: 12, fontWeight: 600, boxShadow: '0 1px 1px rgba(0,0,0,.08)', maxWidth: 420 }
        ]}
      >
        <Box sx={{ color: out ? WA_DARK : '#f15c6d', display: 'grid', placeItems: 'center' }}>
          <Icon size={15} />
        </Box>
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </Box>
        <Box component="span" sx={{ opacity: 0.7, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          · {fmtTime(msg.timestamp)}
        </Box>
      </Stack>
    </Box>
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
        { p: 1, borderRadius: 1.5, minWidth: 'min(240px, 100%)', maxWidth: 340, mb: msg.body && msg.body !== m?.filename ? 0.5 : 0 }
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
          <IconButton size="small" component="a" href={dlUrl(m.url)} sx={{ color: 'inherit' }}>
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
        {
          p: 1,
          borderRadius: 1.5,
          minWidth: 'min(220px, 100%)',
          textDecoration: 'none',
          color: 'inherit',
          cursor: ok ? 'pointer' : 'default'
        }
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
    <Box sx={{ minWidth: 'min(240px, 100%)', maxWidth: 340 }}>
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

// Contato compartilhado: um ou mais vCards → cartões com nome, empresa, telefone e "Conversar".
function ContactBody({ msg }) {
  const [, setSearchParams] = useSearchParams();
  const [opening, setOpening] = useState('');
  const cards = useMemo(() => contactsOfMessage(msg), [msg]);
  const openPhone = async (digits) => {
    setOpening(digits);
    try {
      // abre no mesmo número em que a mensagem chegou
      const chat = await post('/whatsapp/chats/open', { phone: digits, session_id: msg.session_id });
      if (chat?.chat_id)
        setSearchParams((prev) => {
          const n = new URLSearchParams(prev);
          n.set('chat', chat.chat_id);
          return n;
        });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível abrir a conversa.'));
    } finally {
      setOpening('');
    }
  };
  const boxSx = dual(
    { bgcolor: 'rgba(0,0,0,.05)', borderColor: 'rgba(0,0,0,.08)' },
    { bgcolor: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.1)' }
  );
  if (!cards.length) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={[boxSx, { p: 1, borderRadius: 1.5, width: 240, maxWidth: '100%' }]}>
        <TgAvatar name="Contato" size={36} kind="contact" icon={IconUser} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Contato compartilhado
        </Typography>
      </Stack>
    );
  }
  return (
    <Stack spacing={0.75} sx={{ width: 280, maxWidth: '100%' }}>
      {cards.slice(0, 3).map((c, i) => {
        const phone = c.phones[0];
        return (
          <Box key={i} sx={[boxSx, { borderRadius: 1.5, overflow: 'hidden' }]}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 1 }}>
              <TgAvatar name={c.name || 'Contato'} size={40} kind="contact" icon={IconUser} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={c.name}>
                  {c.name || 'Contato'}
                </Typography>
                {c.org ? (
                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.7 }} noWrap title={c.org}>
                    {c.org}
                  </Typography>
                ) : null}
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.7 }} noWrap>
                  {phone ? fmtPhone(phone) : 'sem número'}
                  {c.phones.length > 1 ? ` · +${c.phones.length - 1}` : ''}
                </Typography>
              </Box>
            </Stack>
            {phone ? (
              <ButtonBase
                onClick={() => openPhone(phone)}
                disabled={Boolean(opening)}
                sx={[
                  dual({ color: '#027eb5' }, { color: '#53bdeb' }),
                  { width: '100%', py: 0.8, fontSize: 13, fontWeight: 700, borderTop: '1px solid', borderColor: 'inherit' },
                  boxSx
                ]}
              >
                {opening === phone ? 'Abrindo…' : 'Conversar'}
              </ButtonBase>
            ) : null}
          </Box>
        );
      })}
      {cards.length > 3 ? (
        <Typography variant="caption" sx={{ opacity: 0.7, px: 0.5 }}>
          + {cards.length - 3} contatos
        </Typography>
      ) : null}
    </Stack>
  );
}

function StickerBody({ msg }) {
  const url = msg.media?.url;
  if (!url) return <MediaOmitted msg={msg} label="Figurinha" />;
  return <img src={url} alt="figurinha" style={{ display: 'block', width: 140, height: 140, objectFit: 'contain' }} loading="lazy" />;
}

// ----------------------------------------------------------------------------
// Balão de mensagem
// ----------------------------------------------------------------------------
const MessageBubble = memo(function MessageBubble({
  msg,
  isGroup,
  first,
  last,
  flash,
  onMenu,
  onImage,
  onRetry,
  onReact,
  onQuote,
  onPerson
}) {
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
        body = (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ opacity: 0.75, py: 0.25 }}>
            <IconAlertCircle size={16} />
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
              Tipo de mensagem que o painel ainda não mostra — veja no celular
            </Typography>
          </Stack>
        );
    }
  }
  const showCaption =
    !revoked && msg.type !== 'text' && msg.body && !['poll', 'location', 'contact'].includes(msg.type) && msg.body !== msg.media?.filename;
  const showText = !revoked && msg.type === 'text';
  const scheduled = Boolean(msg.extra?.scheduled);
  const byBot = out && Boolean(msg.extra?.bot);
  const metaTail = (msg.edited ? 48 : 0) + (scheduled ? 16 : 0) + 40 + (out ? 20 : 0);

  return (
    <Stack
      direction="row"
      data-msgid={msg.id}
      justifyContent={out ? 'flex-end' : 'flex-start'}
      sx={{
        px: { xs: 1, md: 4 },
        mt: first ? 1 : 0.25,
        borderRadius: 1,
        animation: flash ? `${flashKf} 1.8s ease-out` : 'none'
      }}
    >
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
              // nunca mais larga que a coluna (conteúdo sem quebra — nome, vCard, link — não empurra a conversa)
              maxWidth: '100%',
              minWidth: 0,
              overflowWrap: 'anywhere',
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
              onClick={
                onPerson && msg.from_jid
                  ? (e) => {
                      e.stopPropagation();
                      onPerson({ jid: msg.from_jid, name: msg.sender_name || null, chat_id: msg.chat_id, session_id: msg.session_id });
                    }
                  : undefined
              }
              sx={{
                fontWeight: 700,
                display: 'block',
                mb: 0.25,
                color: senderColor(msg.from_jid || msg.sender_name),
                cursor: onPerson && msg.from_jid ? 'pointer' : 'default',
                '&:hover': onPerson && msg.from_jid ? { textDecoration: 'underline' } : {}
              }}
            >
              {msg.sender_name || fmtPhone(String(msg.from_jid || '').split('@')[0])}
            </Typography>
          ) : null}

          {byBot && !revoked ? (
            <Stack
              direction="row"
              spacing={0.4}
              alignItems="center"
              sx={[dual({ color: '#6D28D9' }, { color: '#C4B5FD' }), { mb: 0.25, pr: 2.5 }]}
            >
              <IconRobot size={13} />
              <Typography variant="caption" sx={{ fontWeight: 800, fontSize: 11 }}>
                Bot
              </Typography>
            </Stack>
          ) : null}

          {msg.forwarded && !revoked ? (
            <Stack direction="row" spacing={0.4} alignItems="center" sx={{ opacity: 0.6, mb: 0.25, pr: 2.5 }}>
              <IconArrowForwardUp size={13} />
              <Typography variant="caption" sx={{ fontStyle: 'italic', fontSize: 11 }}>
                Encaminhada
              </Typography>
            </Stack>
          ) : null}

          {msg.quoted && !revoked ? (
            <Box
              role="button"
              tabIndex={0}
              title="Ir para a mensagem respondida"
              onClick={(e) => {
                e.stopPropagation();
                onQuote(msg.quoted.wa_message_id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onQuote(msg.quoted.wa_message_id);
              }}
              sx={[
                dual(
                  { bgcolor: 'rgba(0,0,0,.06)', '&:hover': { bgcolor: 'rgba(0,0,0,.1)' } },
                  { bgcolor: 'rgba(0,0,0,.25)', '&:hover': { bgcolor: 'rgba(0,0,0,.35)' } }
                ),
                {
                  borderLeft: '4px solid',
                  borderLeftColor: WA_GREEN,
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                  mb: 0.6,
                  maxWidth: 360,
                  cursor: 'pointer',
                  transition: 'background-color .12s ease'
                }
              ]}
            >
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, fontSize: 12 }} noWrap>
                <PreviewText preview={msg.quoted.preview || 'Mensagem'} />
              </Typography>
            </Box>
          ) : null}

          {body}
          {showText ? <WaText text={msg.body} tail={metaTail} mentions={msg.extra?.mention_names} onPerson={onPerson} /> : null}
          {showCaption ? (
            <WaText text={msg.body} tail={metaTail} sx={{ mt: 0.25 }} mentions={msg.extra?.mention_names} onPerson={onPerson} />
          ) : null}

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
              {msg.edited ? <span style={{ fontStyle: 'italic' }}>Editada</span> : null}
              {scheduled ? (
                <Tooltip title="Enviada por agendamento" disableInteractive>
                  <Box component="span" sx={{ display: 'inline-grid', placeItems: 'center' }}>
                    <IconClock size={12} />
                  </Box>
                </Tooltip>
              ) : null}
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

// Só busca a foto quando a linha aparece na tela (lista de participantes pode ter centenas)
function LazyAvatar({ name, photoPath, size = 38, kind = 'contact' }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '240px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return (
    <Box ref={ref} sx={{ display: 'flex', flexShrink: 0 }}>
      <TgAvatar name={name} photoPath={seen ? photoPath : undefined} size={size} kind={kind} />
    </Box>
  );
}

// Iniciar conversa com um número que não está na agenda (sem precisar salvar no celular).
// Digita DDI+DDD+número (só dígitos; sem DDI assume 55) + nome opcional → POST /whatsapp/chats/open.
const normalizePhoneInput = (v) => {
  const d = onlyDigits(v);
  if (!d) return '';
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
};
function NewChatDialog({ open, initialPhone = '', sessions = [], initialSession = '', onClose, onOpened }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [busy, setBusy] = useState(false);
  const connectedSessions = useMemo(() => sessions.filter((x) => x.connected || x.status === 'ready'), [sessions]);
  useEffect(() => {
    if (open) {
      setPhone(initialPhone ? onlyDigits(initialPhone) : '');
      setName('');
      setBusy(false);
      // número pré-selecionado: o filtrado na lista; senão o único conectado; senão o primeiro
      const pre =
        initialSession && connectedSessions.some((x) => x.id === initialSession) ? initialSession : connectedSessions[0]?.id || '';
      setSessionId(pre);
    }
  }, [open, initialPhone, initialSession, connectedSessions]);
  const digits = normalizePhoneInput(phone);
  const valid = digits.length >= 10 && digits.length <= 15 && Boolean(sessionId);
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const chat = await post('/whatsapp/chats/open', {
        phone: digits,
        session_id: sessionId,
        ...(name.trim() ? { name: name.trim() } : {})
      });
      if (!chat?.chat_id) throw new Error('sem conversa');
      onOpened?.(chat);
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível iniciar a conversa.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <TgModal open={open} onClose={busy ? undefined : onClose} title="Nova conversa" maxWidth="xs">
      <Stack spacing={1.5} sx={{ pt: 0.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Converse com um número sem precisar salvar na agenda do celular.
        </Typography>
        {!connectedSessions.length ? (
          <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 600 }}>
            Nenhum número conectado. Conecte um número em Configurações.
          </Typography>
        ) : connectedSessions.length > 1 ? (
          <WaNumberSelect
            sessions={connectedSessions}
            value={sessionId}
            onChange={setSessionId}
            label="Conversar pelo número"
            size="small"
          />
        ) : null}
        <TextField
          autoFocus
          label="Número"
          placeholder="55 11 99999-9999"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          helperText={
            digits
              ? valid
                ? `Vai abrir a conversa com ${fmtPhone(digits)}`
                : 'Use DDI + DDD + número (10 a 15 dígitos)'
              : 'DDI + DDD + número. Sem DDI, assume Brasil (55).'
          }
          inputProps={{ inputMode: 'tel' }}
          fullWidth
          size="small"
        />
        <TextField
          label="Nome (opcional)"
          placeholder="Como esse contato vai aparecer no Pub Mail"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          fullWidth
          size="small"
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={submit}
            disabled={!valid || busy}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <IconMessagePlus size={16} />}
            sx={{ bgcolor: WA_DARK, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: WA_DARK } }}
          >
            Iniciar conversa
          </Button>
        </Stack>
      </Stack>
    </TgModal>
  );
}

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
function ChatFilterModal({ open, initial, connected, sessions, initialSessionId, onClose, onSaved }) {
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
          <WaChatPicker
            value={targets}
            onChange={setTargets}
            connected={connected}
            listHeight={280}
            sessions={sessions}
            initialSessionId={initialSessionId}
          />
        </Box>
      </Stack>
    </TgModal>
  );
}

// ============================================================================
export default function WhatsAppChat() {
  const isNarrow = useMediaQuery('(max-width:860px)');
  const narrowRef = useRef(isNarrow);
  narrowRef.current = isNarrow;
  const [searchParams, setSearchParams] = useSearchParams();
  // chat interno da EQUIPE: `?team=1` (lista) ou `?team=<id da conversa>`; sai com qualquer chip de número
  const teamParam = searchParams.get('team') || '';
  const teamMode = Boolean(teamParam);
  const team = useTeam();
  const [newGroup, setNewGroup] = useState(false);
  const setTeam = useCallback(
    (v) =>
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (v) n.set('team', v);
          else n.delete('team');
          return n;
        },
        { replace: true }
      ),
    [setSearchParams]
  );
  const teamChat = useMemo(
    () => (teamParam && teamParam !== '1' ? team.chats.find((c) => c.id === teamParam) || null : null),
    [team.chats, teamParam]
  );
  // identidade do setter muda a cada troca de URL; via ref, openChat fica estável (linhas memoizadas)
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;
  const { sessions, byId: sessionsById, loading: sessionLoading, connected } = useWaSessions(15000);
  const navigate = useNavigate();
  // número filtrado na lista ('' = todos). Persistido na URL (?session=) p/ links de outras telas.
  const sessionFilter = searchParams.get('session') || '';
  // `byId` do hook é um Map (não objeto)
  const sessionFilterValid = sessionFilter && sessionsById?.get?.(sessionFilter) ? sessionFilter : '';
  // sempre sai do modo equipe: dois setSearchParams seguidos não se encadeiam (o 2º lê os
  // parâmetros antigos e devolvia o `team`), então `team` e `session` mudam numa atualização só
  const setSessionFilter = (id) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete('team');
      if (id) n.set('session', id);
      else n.delete('session');
      return n;
    });
  const manyNumbers = sessions.length > 1;
  const sessionOf = useCallback(
    (c) => (c?.session_id ? sessionsById?.get?.(c.session_id) || c.session || null : c?.session || null),
    [sessionsById]
  );
  const { user } = useAuth();
  const myId = user?.user?.id || null;
  const myIdRef = useRef(myId);
  myIdRef.current = myId;
  // gateway fora → leitura continua (histórico da org), mas nada que dependa do WhatsApp é chamado
  const connectedRef = useRef(false);
  connectedRef.current = connected;

  // ---------------- lista ----------------
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(() => filterFromParams(searchParams));
  const [list, setList] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [listLoading, setListLoading] = useState(false);
  const listSeq = useRef(0);

  // relógio de 1 min p/ "aguardando há…" (só as linhas que aguardam recebem o valor)
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  // ---------------- contagens dos chips ----------------
  const [counts, setCounts] = useState(null);
  const countsTimer = useRef(null);
  const loadCounts = useCallback(async () => {
    try {
      const r = await get('/whatsapp/chats/counts', { params: sessionFilterValid ? { session_id: sessionFilterValid } : {} });
      if (r && typeof r === 'object') setCounts(r);
    } catch {
      /* contagens são cosméticas */
    }
  }, [sessionFilterValid]);
  // agrupa rajadas de eventos (1 busca a cada ~1,5 s no máximo)
  const scheduleCounts = useCallback(() => {
    if (countsTimer.current) return;
    countsTimer.current = window.setTimeout(() => {
      countsTimer.current = null;
      loadCounts();
    }, 1500);
  }, [loadCounts]);
  useEffect(() => {
    loadCounts();
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') loadCounts();
    }, 60000);
    return () => {
      window.clearInterval(id);
      if (countsTimer.current) window.clearTimeout(countsTimer.current);
      countsTimer.current = null;
    };
  }, [loadCounts]);

  // ---------------- configurações do atendimento (só leitura aqui) ----------------
  // mark_read_on_open=false → abrir/ler a conversa no painel não marca como lida no WhatsApp
  const svcCfgRef = useRef({ mark_read_on_open: true });
  useEffect(() => {
    get('/whatsapp/service-settings')
      .then((r) => {
        if (r && typeof r === 'object') svcCfgRef.current = r;
      })
      .catch(() => {});
  }, []);
  const autoRead = () => svcCfgRef.current?.mark_read_on_open !== false;

  // ---------------- etiquetas e atendentes da organização ----------------
  const [orgTags, setOrgTags] = useState([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [attendants, setAttendants] = useState([]);
  const loadTags = useCallback(async () => {
    try {
      const r = await get('/whatsapp/tags');
      setOrgTags((Array.isArray(r) ? r : r?.items || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
      setTagsLoaded(true);
    } catch {
      /* sem etiquetas: a tela segue funcionando */
    }
  }, []);
  useEffect(() => {
    loadTags();
    get('/whatsapp/attendants')
      .then((r) => setAttendants(Array.isArray(r) ? r : r?.items || []))
      .catch(() => {});
  }, [loadTags]);

  // ---------------- filtros avançados (persistidos no navegador) ----------------
  const [adv, setAdv] = useState(loadAdv);
  const advRef = useRef(adv);
  advRef.current = adv;
  const [advAnchor, setAdvAnchor] = useState(null);
  useEffect(() => saveAdv(adv), [adv]);
  // etiqueta apagada em outro lugar some do filtro salvo
  useEffect(() => {
    if (!tagsLoaded || !adv.tags.length) return;
    const known = new Set(orgTags.map((t) => t.id));
    if (adv.tags.some((id) => !known.has(id))) setAdv((a) => ({ ...a, tags: a.tags.filter((id) => known.has(id)) }));
  }, [tagsLoaded, orgTags, adv.tags]);
  const advCount = advActiveCount(adv);

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
  const messagesRef = useRef([]);
  messagesRef.current = messages;
  const filterRef = useRef(null);
  filterRef.current = filter;
  const msgTickRef = useRef(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const sinceRef = useRef(null);
  // Cache das conversas já abertas nesta sessão (chat_id → {items, hasOlder, since, at}): voltar a uma conversa
  // mostra na hora o que já tinha e só busca o que mudou (`since`), sem skeleton. Até 40 conversas (LRU).
  const threadCacheRef = useRef(new Map());
  const hasOlderRef = useRef(false);
  const THREAD_CACHE_MAX = 40;
  const THREAD_CACHE_FULL_MS = 6 * 3600_000; // cache mais velho que isso recarrega inteiro (o `since` devolve no máx. 300)
  hasOlderRef.current = hasOlder;
  const msgSeq = useRef(0);
  const threadRef = useRef(null);
  // "grudado no fim": true enquanto o usuário não rolar para cima. Mídia que carrega
  // depois (fotos/vídeos/áudios) ou o composer crescendo re-rolam para o fim.
  const pinnedRef = useRef(true);
  const smoothNextRef = useRef(false);
  const lastTopRef = useRef(0);
  const [showJump, setShowJump] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [flashId, setFlashId] = useState(null);
  const flashTimer = useRef(null);
  const anchorRef = useRef(null); // {el, top} p/ manter a posição ao carregar mensagens antigas
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
  const composerBoxRef = useRef(null);
  // respostas rápidas: lista (cache), popup {mode:'slash'|'button', query, index} e anexo pendente
  const [qrList, setQrList] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qr, setQr] = useState(null);
  const [qrMedia, setQrMedia] = useState(null); // {media, shortcut}

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
  const [person, setPerson] = useState(null); // { jid, name?, chat_id? } → ContactInfoDrawer
  const [newChat, setNewChat] = useState(null); // { phone } → NewChatDialog (null = fechado)
  const openNewChat = useCallback(
    (chat) => {
      setQ('');
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        n.set('chat', chat.chat_id);
        return n;
      });
    },
    [setSearchParams]
  );
  const openPerson = useCallback((t) => setPerson(t), []);
  const [customerOpen, setCustomerOpen] = useState(false); // painel "Cliente" (CRM)
  const [charge, setCharge] = useState(null); // {customer, products} → diálogo "Cobrar"
  const [chargeBusy, setChargeBusy] = useState(false);
  const openCharge = async () => {
    if (!active?.chat_id || chargeBusy) return;
    setChargeBusy(true);
    try {
      const [r, prods] = await Promise.all([
        get(`/whatsapp/customers/by-chat/${encodeURIComponent(active.chat_id)}`),
        get('/whatsapp/products').catch(() => [])
      ]);
      if (!r?.customer) {
        toast('Cadastre este contato como cliente para cobrar.', { icon: '💳' });
        setCustomerOpen(true);
        return;
      }
      setCharge({ customer: r.customer, products: Array.isArray(prods) ? prods : [] });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível abrir a cobrança.'));
    } finally {
      setChargeBusy(false);
    }
  };
  const [tagsAnchor, setTagsAnchor] = useState(null);
  const [svcAnchor, setSvcAnchor] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ============================================================ lista
  const loadList = useCallback(
    async ({ page = 1, append = false, silent = false } = {}) => {
      const seq = ++listSeq.current;
      if (!silent && !append) setListLoading(true);
      try {
        const custom = isCustomFilter(filter);
        // filtros avançados + chip ativo (o chip vence em caso de conflito, ex.: "Meus atendimentos")
        const params = {
          ...advToParams(adv),
          q: q.trim() || undefined,
          page,
          page_size: PAGE,
          session_id: sessionFilterValid || undefined
        };
        const chip = custom
          ? { filter }
          : {
              kind: filter === 'groups' ? 'group' : filter === 'dms' ? 'dm' : 'all',
              archived: filter === 'archived' ? 1 : 0,
              unread: filter === 'unread' ? 1 : undefined,
              assigned: filter === 'mine' ? 'me' : undefined
            };
        Object.entries(chip).forEach(([k, v]) => {
          if (v !== undefined) params[k] = v;
        });
        const r = await get('/whatsapp/chats', { params });
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
    [q, filter, adv, sessionFilterValid]
  );
  listReloadRef.current = loadList;

  // busca (debounce) + troca de filtro
  useEffect(() => {
    const t = window.setTimeout(() => loadList(), 250);
    return () => window.clearTimeout(t);
  }, [loadList]);

  // tempo real: ao reconectar, busca o que pode ter passado enquanto a conexão estava caída
  const { connected: rtConnected } = useRealtimeStatus(() => {
    listReloadRef.current?.({ silent: true });
    msgTickRef.current?.();
    loadCounts();
  });

  // polling da lista (reserva)
  useEffect(() => {
    const id = window.setInterval(
      () => {
        if (document.visibilityState === 'hidden') return;
        loadList({ silent: true });
      },
      rtConnected ? LIST_POLL_RT_MS : LIST_POLL_MS
    );
    return () => window.clearInterval(id);
  }, [loadList, rtConnected]);

  const activeId = active?.chat_id || null;
  const visibleChats = useMemo(() => {
    let items = list.items;
    // a conversa aberta fica na lista mesmo depois de lida (igual ao WhatsApp Web)
    if (filter === 'unread') items = items.filter((c) => (Number(c.unread_count) || 0) > 0 || c.chat_id === activeId);
    return [...items].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
    });
  }, [list.items, filter, activeId]);

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
  // Regra: abrir a conversa cai na última mensagem e fica "grudado" no fim enquanto
  // fotos/vídeos/áudios carregam (ResizeObserver). Rolou para cima → solta; mensagens
  // novas viram a pílula "N novas mensagens". Envio próprio sempre desce.
  const stickToEnd = useCallback((el) => {
    if (!el || !pinnedRef.current) return;
    const smooth = smoothNextRef.current;
    smoothNextRef.current = false;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
    lastTopRef.current = el.scrollTop;
  }, []);

  const scrollToEnd = useCallback((smooth = true) => {
    pinnedRef.current = true;
    setUnseen(0);
    requestAnimationFrame(() => {
      const el = threadRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  // conteúdo e a própria área mudando de tamanho → re-gruda no fim (se grudado)
  const threadRO = useRef(null);
  const contentRO = useRef(null);
  const setThreadEl = useCallback(
    (node) => {
      threadRef.current = node;
      threadRO.current?.disconnect();
      threadRO.current = null;
      if (!node || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(() => stickToEnd(node));
      ro.observe(node);
      threadRO.current = ro;
    },
    [stickToEnd]
  );
  const setContentEl = useCallback(
    (node) => {
      contentRO.current?.disconnect();
      contentRO.current = null;
      if (!node || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(() => stickToEnd(threadRef.current));
      ro.observe(node);
      contentRO.current = ro;
    },
    [stickToEnd]
  );
  useEffect(
    () => () => {
      threadRO.current?.disconnect();
      contentRO.current?.disconnect();
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    []
  );

  const onThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const up = el.scrollTop < lastTopRef.current - 1;
    lastTopRef.current = el.scrollTop;
    if (dist < 80) {
      pinnedRef.current = true;
      setUnseen(0);
    } else if (up) pinnedRef.current = false; // rolagem para cima = o usuário quer ler; solta do fim
    setShowJump(dist > 320);
    if (el.scrollTop < 60 && hasOlder && !loadingOlder && !msgLoading) loadOlder();
  };

  // depois de inserir as antigas no topo: devolve a mensagem-âncora ao mesmo lugar
  useLayoutEffect(() => {
    const a = anchorRef.current;
    const el = threadRef.current;
    if (!a || !el) return;
    anchorRef.current = null;
    if (!a.el.isConnected) return;
    const delta = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(delta) > 1) el.scrollTop += delta;
    lastTopRef.current = el.scrollTop;
  }, [messages]);

  // mensagem nova chegou: grudado → desce suave; lendo acima → soma na pílula
  const noteIncoming = useCallback(
    (n = 1) => {
      if (pinnedRef.current) {
        smoothNextRef.current = true;
        scrollToEnd(true);
      } else setUnseen((u) => u + n);
    },
    [scrollToEnd]
  );

  // citação clicável → rola até a mensagem respondida e pisca
  const jumpToQuoted = useCallback((waId) => {
    if (!waId) return;
    const target = messagesRef.current.find((m) => m.wa_message_id === waId);
    const thread = threadRef.current;
    const el = target && thread ? thread.querySelector(`[data-msgid="${String(target.id).replace(/["\\]/g, '')}"]`) : null;
    if (!el) {
      toast('Mensagem antiga — role para cima para carregar.', { icon: '⬆️' });
      return;
    }
    pinnedRef.current = false;
    const top = el.getBoundingClientRect().top - thread.getBoundingClientRect().top + thread.scrollTop;
    thread.scrollTo({ top: Math.max(0, top - thread.clientHeight / 2 + el.offsetHeight / 2), behavior: 'smooth' });
    setFlashId(null);
    requestAnimationFrame(() => setFlashId(target.id));
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1900);
  }, []);

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
      if (prev) {
        draftsRef.current.set(prev.chat_id, { text: textRef.current, reply: replyRef.current });
        // guarda a conversa que está saindo (sem bolhas provisórias) pra reabrir sem recarregar
        if (sinceRef.current && messagesRef.current.length) {
          const cache = threadCacheRef.current;
          cache.delete(prev.chat_id);
          cache.set(prev.chat_id, {
            items: messagesRef.current.filter((m) => !m.pending),
            hasOlder: hasOlderRef.current,
            since: sinceRef.current,
            at: Date.now()
          });
          while (cache.size > THREAD_CACHE_MAX) cache.delete(cache.keys().next().value);
        }
      }
      stopTyping();
      setActive(chat);
      setEditing(null);
      setAttachment(null);
      setQrMedia(null);
      setQr(null);
      setShowJump(false);
      setUnseen(0);
      setFlashId(null);
      pinnedRef.current = true;
      lastTopRef.current = 0;
      const d = draftsRef.current.get(chat.chat_id);
      setText(d?.text || '');
      setReply(d?.reply || null);
      setSearchParamsRef.current(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set('chat', chat.chat_id);
          return n;
        },
        { replace: true }
      );
      const seq = ++msgSeq.current;
      const cached = threadCacheRef.current.get(chat.chat_id);
      const fresh = cached && Date.now() - cached.at < THREAD_CACHE_FULL_MS;
      if (cached) {
        // mostra o que já tinha na hora; o que mudou chega logo abaixo (sem skeleton)
        setMessages(cached.items);
        setHasOlder(cached.hasOlder);
        sinceRef.current = cached.since;
        setMsgLoading(false);
        scrollToEnd(false);
      } else {
        setMessages([]);
        setHasOlder(false);
        sinceRef.current = null;
        setMsgLoading(true);
      }
      if (Number(chat.unread_count) > 0 && autoRead()) markRead(chat.chat_id);
      try {
        if (fresh) {
          const r = await get(`/whatsapp/chats/${enc(chat.chat_id)}/messages`, { params: { since: cached.since } });
          if (seq !== msgSeq.current) return;
          if (r.server_time) sinceRef.current = r.server_time;
          if (r.items?.length) {
            setMessages((p) => upsertMsgs(p, r.items));
            scrollToEnd(false);
          }
          return;
        }
        const r = await get(`/whatsapp/chats/${enc(chat.chat_id)}/messages`, { params: { limit: PAGE } });
        if (seq !== msgSeq.current) return;
        const items = sortMsgs(r.items || []);
        setMessages(items);
        setHasOlder(items.length >= PAGE);
        sinceRef.current = r.server_time || new Date().toISOString();
        scrollToEnd(false);
      } catch (e) {
        if (seq === msgSeq.current && !cached) toast.error(errMsg(e, 'Falha ao abrir a conversa.'));
      } finally {
        if (seq === msgSeq.current) setMsgLoading(false);
      }
    },
    [markRead, scrollToEnd, stopTyping]
  );

  // Foco no campo de mensagem ao abrir uma conversa (só desktop: no celular o teclado cobriria as mensagens).
  // Efeito (depois do commit) + nova tentativa quando as mensagens terminam de carregar; nunca rouba o foco
  // de outro campo em que o usuário já esteja digitando.
  const focusComposer = useCallback(() => {
    if (narrowRef.current) return;
    const el = inputRef.current;
    if (!el) return;
    const cur = document.activeElement;
    if (cur && cur !== el && /^(INPUT|TEXTAREA)$/.test(cur.tagName)) return;
    el.focus();
  }, []);
  useEffect(() => {
    if (!active?.chat_id) return undefined;
    const t = setTimeout(focusComposer, 30);
    return () => clearTimeout(t);
  }, [active?.chat_id, focusComposer]);
  useEffect(() => {
    if (msgLoading || !active?.chat_id) return undefined;
    const t = setTimeout(focusComposer, 0);
    return () => clearTimeout(t);
  }, [msgLoading, active?.chat_id, focusComposer]);

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
    pinnedRef.current = false; // quem pede as antigas quer lê-las, não voltar ao fim
    const before = messages[0].timestamp;
    try {
      const r = await get(`/whatsapp/chats/${enc(cur.chat_id)}/messages`, { params: { before, limit: PAGE } });
      if (activeRef.current?.chat_id !== cur.chat_id) return;
      const items = r.items || [];
      setHasOlder(items.length >= PAGE);
      if (items.length) {
        // mantém na tela a mesma mensagem que estava no topo (independe do scroll anchoring do navegador)
        const anchor = el?.querySelector('[data-msgid]');
        anchorRef.current = anchor ? { el: anchor, top: anchor.getBoundingClientRect().top } : null;
        setMessages((prev) => upsertMsgs(prev, items));
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
        const known = new Set(messagesRef.current.map((m) => m.id));
        setMessages((prev) => upsertMsgs(prev, items));
        const fresh = items.filter((m) => m.direction === 'IN' && new Date(m.timestamp).getTime() > new Date(since).getTime());
        if (fresh.length) {
          const lastIn = fresh[fresh.length - 1];
          patchChat(cur.chat_id, {
            last_message_at: lastIn.timestamp,
            last_message_preview: previewOf(lastIn),
            last_message_direction: 'IN',
            last_inbound_at: lastIn.timestamp,
            waiting_reply: cur.kind === 'individual'
          });
          if (document.hasFocus() && autoRead()) markRead(cur.chat_id);
          const unknown = fresh.filter((m) => !known.has(m.id)).length;
          if (unknown) noteIncoming(unknown);
        }
      } catch {
        /* silencioso */
      }
    };
    msgTickRef.current = tick;
    const id = window.setInterval(tick, rtConnected ? MSG_POLL_RT_MS : MSG_POLL_MS);
    return () => window.clearInterval(id);
  }, [active?.chat_id, markRead, patchChat, noteIncoming, rtConnected]);

  // ============================================================ eventos em tempo real
  // conversa passa (ou não) no filtro atual da lista?
  const chatMatchesFilter = useCallback(
    (c) => {
      const f = filterRef.current || 'all';
      const me = myIdRef.current;
      if (!advMatches(c, advRef.current, me)) return false;
      if (isCustomFilter(f)) {
        const cf = customFilters.find((x) => x.id === f);
        return Boolean(cf && (cf.chat_ids || []).includes(c.chat_id));
      }
      if (f === 'archived') return Boolean(c.archived);
      if (c.archived) return false;
      if (f === 'groups') return c.kind === 'group';
      if (f === 'dms') return c.kind === 'individual';
      if (f === 'unread') return (Number(c.unread_count) || 0) > 0;
      if (f === 'mine') return Boolean(me) && c.service?.assigned_user?.id === me;
      return true;
    },
    [customFilters]
  );

  useRealtimeEvent('wa:chat', ({ chat } = {}) => {
    if (!chat?.chat_id) return;
    if (sessionFilterValid && chat.session_id && chat.session_id !== sessionFilterValid) return;
    const searching = Boolean(q.trim());
    const isOpen = activeRef.current?.chat_id === chat.chat_id;
    scheduleCounts();
    setList((prev) => {
      const idx = prev.items.findIndex((c) => c.chat_id === chat.chat_id);
      const ok = chatMatchesFilter(chat);
      if (idx >= 0) {
        // saiu do filtro: some da lista — menos a conversa aberta, que fica até trocar
        if (!ok && !searching && !isOpen)
          return { ...prev, items: prev.items.filter((c) => c.chat_id !== chat.chat_id), total: Math.max(0, (prev.total || 1) - 1) };
        const items = [...prev.items];
        items[idx] = { ...items[idx], ...chat };
        return { ...prev, items };
      }
      if (!ok || searching) return prev;
      return { ...prev, items: [chat, ...prev.items], total: (prev.total || 0) + 1 };
    });
    const cur = activeRef.current;
    if (cur && cur.chat_id === chat.chat_id) {
      setActive((prev) => (prev ? { ...prev, ...chat } : prev));
      // chegou mensagem na conversa aberta e a janela está em foco → marca lida
      if ((Number(chat.unread_count) || 0) > 0 && document.hasFocus() && document.visibilityState === 'visible' && autoRead())
        markRead(chat.chat_id);
    }
  });

  useRealtimeEvent('wa:message', ({ chat_id: chatId, message } = {}) => {
    const cur = activeRef.current;
    if (!cur || !message?.id || chatId !== cur.chat_id) return;
    const existed = messagesRef.current.some((m) => m.id === message.id);
    setMessages((prev) => {
      let base = prev;
      // eco do nosso envio chegando antes da resposta HTTP: some a bolha provisória
      if (!existed && message.direction === 'OUT') {
        const tmp = prev.find(
          (m) => m.pending && String(m.id).startsWith('tmp-') && m.type === message.type && (m.body || '') === (message.body || '')
        );
        if (tmp) base = prev.filter((m) => m.id !== tmp.id);
      }
      return upsertMsgs(base, [message]);
    });
    if (!existed) {
      if (message.direction === 'OUT') scrollToEnd(true);
      else noteIncoming(1);
    }
    // mensagem já existente mudou (mídia chegou, reação…) → o ResizeObserver mantém o fim
  });

  useRealtimeEvent('wa:message_deleted', ({ chat_id: chatId, id } = {}) => {
    const cur = activeRef.current;
    if (!cur || chatId !== cur.chat_id) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
  });

  // ao voltar o foco pra janela, marca lidas se há não lidas no chat aberto
  useEffect(() => {
    const onFocus = () => {
      const cur = activeRef.current;
      if (cur && Number(cur.unread_count) > 0 && autoRead()) markRead(cur.chat_id);
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

  // ============================================================ respostas rápidas
  const qrFetchRef = useRef(null);
  const qrLoadedAt = useRef(0);
  const loadQuickReplies = useCallback(() => {
    if (qrFetchRef.current) return qrFetchRef.current;
    setQrLoading(true);
    qrFetchRef.current = get('/whatsapp/quick-replies')
      .then((r) => {
        setQrList(Array.isArray(r) ? r : r?.items || []);
        qrLoadedAt.current = Date.now();
      })
      .catch(() => setQrList((prev) => prev || []))
      .finally(() => {
        setQrLoading(false);
        qrFetchRef.current = null;
      });
    return qrFetchRef.current;
  }, []);
  useEffect(() => {
    loadQuickReplies();
  }, [loadQuickReplies]);
  // cache: recarrega em segundo plano se ficou velho (alguém pode ter cadastrado outra)
  const refreshQuickReplies = () => {
    if (Date.now() - qrLoadedAt.current > 120000) loadQuickReplies();
  };
  const qrItems = useMemo(() => (qr ? filterQuickReplies(qrList, qr.query) : []), [qr, qrList]);

  const pickQuickReply = (item) => {
    const cur = activeRef.current;
    if (!item || !cur) return;
    const label = chatLabel(cur) || '';
    const name = /^[+\d(]/.test(label) ? '' : firstName(label);
    const body = fillQuickReply(item.text || '', { name, phone: fmtPhone(cur.phone) });
    const mode = qr?.mode;
    setQr(null);
    const el = inputRef.current;
    let caret = body.length;
    if (mode === 'slash' || !text) setText(body);
    else {
      const s0 = el && typeof el.selectionStart === 'number' ? el.selectionStart : text.length;
      const e0 = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : text.length;
      setText(text.slice(0, s0) + body + text.slice(e0));
      caret = s0 + body.length;
    }
    // anexo da resposta rápida: fica visível acima do campo e só vai junto no envio (Enter/Enviar)
    if (item.media?.id) {
      setAttachment(null);
      setQrMedia({ media: item.media, shortcut: item.shortcut, title: item.title });
    }
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        /* ignore */
      }
    });
  };

  const toggleQuickReplies = () => {
    if (qr) {
      setQr(null);
      return;
    }
    refreshQuickReplies();
    if (!qrList?.length && !qrLoading) loadQuickReplies();
    const empty = !text;
    if (empty) setText('/');
    setQr({ mode: empty ? 'slash' : 'button', query: '', index: 0 });
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (empty) {
        try {
          el.setSelectionRange(1, 1);
        } catch {
          /* ignore */
        }
      }
    });
  };

  // ============================================================ composer
  const onTextChange = (v) => {
    setText(v);
    const cur = activeRef.current;
    // "/atalho" no início do campo abre as respostas rápidas (e não avisa "digitando…")
    const slash = !editing ? /^\/(\S*)$/.exec(v) : null;
    if (slash) {
      setQr((p) => ({ mode: 'slash', query: slash[1], index: p?.mode === 'slash' && p.query === slash[1] ? p.index : 0 }));
      refreshQuickReplies();
      return;
    }
    if (qr?.mode === 'slash') setQr(null);
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
    patchChat(chatId, {
      last_message_at: m.timestamp,
      last_message_preview: previewOf(m),
      last_message_direction: 'OUT',
      last_outbound_at: m.timestamp,
      waiting_reply: false
    });
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
    if (qrMedia && !editing) return sendQuickMedia(body);
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

  // resposta rápida com anexo: reenvia a mídia já guardada no servidor (sem upload)
  const sendQuickMedia = async (caption) => {
    const cur = activeRef.current;
    const qm = qrMedia;
    if (!cur || !qm?.media?.id) return;
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const replyWas = reply;
    const optimistic = {
      id: tmpId,
      chat_id: cur.chat_id,
      direction: 'OUT',
      type: quickMediaKind(qm.media),
      body: caption,
      ack: 0,
      pending: true,
      uploading: true,
      reactions: [],
      media: { ...qm.media },
      quoted: replyWas ? { wa_message_id: replyWas.wa_message_id, preview: previewOf(replyWas) } : null,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimistic]);
    setQrMedia(null);
    setText('');
    setReply(null);
    stopTyping();
    scrollToEnd(true);
    setSending(true);
    try {
      const m = await post('/whatsapp/messages/send-media', {
        chat_id: cur.chat_id,
        media_id: qm.media.id,
        caption: caption || undefined,
        quoted_wa_id: replyWas?.wa_message_id || undefined
      });
      setMessages((prev) => replaceTmp(prev, tmpId, m));
      touchListAfterSend(cur.chat_id, m || optimistic);
    } catch (e) {
      setMessages((prev) => prev.filter((x) => x.id !== tmpId));
      if (activeRef.current?.chat_id === cur.chat_id) {
        setQrMedia(qm);
        setText(caption);
        setReply(replyWas);
      }
      toast.error(errMsg(e, 'Não foi possível enviar a resposta rápida.'));
    } finally {
      setSending(false);
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
    setQrMedia(null);
    setAttachment({ file: f, url: URL.createObjectURL(f), kind, asDocument: Boolean(asDocument) || kind === 'document' });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const sendMediaFile = async (file, { caption = '', asVoice = false, asDocument = false, kind = 'document', localUrl } = {}) => {
    const cur = activeRef.current;
    if (!cur) return;
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const replyWas = reply;
    const url = localUrl || (kind === 'image' || asVoice ? URL.createObjectURL(file) : null);
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
      const r = await post(`/whatsapp/chats/${enc(cur.chat_id)}/${kind}`, { [field]: next });
      patchChat(cur.chat_id, { [field]: next });
      const label = {
        archive: next ? 'Conversa arquivada.' : 'Conversa desarquivada.',
        pin: next ? 'Conversa fixada.' : 'Conversa desafixada.',
        mute: next ? 'Conversa silenciada.' : 'Som reativado.'
      };
      // o WhatsApp pode recusar (ex.: conversa antiga sem mensagens): vale só no painel
      if (r?.synced === false) toast(`${label[kind]} Só no Pub Mail: o WhatsApp não aceitou a mudança nesta conversa.`, { icon: 'ℹ️' });
      else toast.success(label[kind]);
      if (kind === 'archive') {
        loadList({ silent: true });
        scheduleCounts();
      }
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

  // ============================================================ etiquetas da conversa
  const tagSeq = useRef(0);
  const saveChatTags = async (chatId, ids, prevTags, extra = []) => {
    const byId = new Map([...orgTags, ...extra].map((t) => [t.id, t]));
    patchChat(chatId, {
      tags: ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((t) => ({ id: t.id, name: t.name, color: t.color }))
    });
    const seq = ++tagSeq.current;
    try {
      const r = await put(`/whatsapp/chats/${enc(chatId)}/tags`, { tag_ids: ids });
      if (seq === tagSeq.current && r?.chat_id) patchChat(chatId, r);
      return true;
    } catch (e) {
      if (seq === tagSeq.current) patchChat(chatId, { tags: prevTags });
      toast.error(errMsg(e, 'Não foi possível salvar as etiquetas.'));
      return false;
    }
  };

  const toggleChatTag = (tagId) => {
    const cur = activeRef.current;
    if (!cur) return;
    const prevTags = Array.isArray(cur.tags) ? cur.tags : [];
    const has = prevTags.some((t) => t.id === tagId);
    const ids = has ? prevTags.filter((t) => t.id !== tagId).map((t) => t.id) : [...prevTags.map((t) => t.id), tagId];
    setOrgTags((list) => list.map((t) => (t.id === tagId ? { ...t, count: Math.max(0, (Number(t.count) || 0) + (has ? -1 : 1)) } : t)));
    saveChatTags(cur.chat_id, ids, prevTags);
  };

  const createTag = async (name, color) => {
    try {
      const t = await post('/whatsapp/tags', { name, color });
      if (!t?.id) throw new Error('Resposta inválida do servidor.');
      setOrgTags((list) => [...list, { ...t, count: 1 }]);
      const cur = activeRef.current;
      if (cur) {
        const prevTags = Array.isArray(cur.tags) ? cur.tags : [];
        await saveChatTags(cur.chat_id, [...prevTags.map((x) => x.id), t.id], prevTags, [t]);
      }
      toast.success(`Etiqueta “${t.name}” criada.`);
      return true;
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível criar a etiqueta.'));
      return false;
    }
  };

  // ============================================================ atendimento
  const SERVICE_TOAST = {
    assume: 'Você assumiu o atendimento.',
    release: 'Conversa liberada para a fila.',
    close: 'Atendimento encerrado.',
    reopen: 'Atendimento reaberto.',
    bot_start: 'Conversa enviada para o bot.',
    bot_stop: 'Bot parado nesta conversa.'
  };
  const serviceAction = async (action, userId) => {
    const cur = activeRef.current;
    if (!cur) return false;
    const tid = toast.loading('Atualizando o atendimento…');
    try {
      const isBot = action === 'bot_start' || action === 'bot_stop';
      const r = isBot
        ? await post(`/whatsapp/chats/${enc(cur.chat_id)}/bot`, { action: action === 'bot_start' ? 'start' : 'stop' })
        : await post(`/whatsapp/chats/${enc(cur.chat_id)}/service`, { action, user_id: userId || undefined });
      const chat = r?.chat_id ? r : r?.chat?.chat_id ? r.chat : null;
      if (chat) patchChat(chat.chat_id, chat);
      const who = action === 'transfer' ? attendants.find((a) => a.id === userId)?.name : null;
      toast.success(
        action === 'transfer'
          ? `Atendimento transferido para ${who || 'o atendente'}.`
          : SERVICE_TOAST[action] || 'Atendimento atualizado.',
        {
          id: tid
        }
      );
      scheduleCounts();
      return true;
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível atualizar o atendimento.'), { id: tid });
      return false;
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
      if (m.type === 'call') {
        out.push(<CallPill key={m.id} msg={m} />);
        return;
      }
      out.push(
        <MessageBubble
          key={m.id}
          msg={m}
          isGroup={isGroup}
          first={!sameAsPrev}
          last={!sameAsNext}
          flash={m.id === flashId}
          onMenu={openBubbleMenu}
          onImage={openImage}
          onRetry={retrySend}
          onReact={react}
          onQuote={jumpToQuoted}
          onPerson={openPerson}
        />
      );
    });
    return out;
  }, [messages, isGroup, flashId, openBubbleMenu, openImage, react, jumpToQuoted, openPerson]);

  // chips de modo: números do WhatsApp (quando há mais de um) + "Equipe" (chat interno); ficam na URL (?session= / ?team=)
  const modeChips = (
    <ScrollChipsRow sx={{ mt: 1 }}>
      <Tooltip title="Chat interno da equipe (não vai para clientes)">
        <Chip
          size="small"
          onClick={() => (teamMode ? setTeam('') : setTeam(teamChat?.id || '1'))}
          icon={<IconUsers size={14} />}
          label={
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
              Equipe
              {team.unreadTotal ? (
                <Box
                  component="span"
                  sx={{
                    minWidth: 17,
                    height: 17,
                    px: 0.5,
                    borderRadius: 9,
                    fontSize: 10.5,
                    fontWeight: 800,
                    display: 'inline-grid',
                    placeItems: 'center',
                    bgcolor: teamMode ? 'rgba(255,255,255,.3)' : '#377EF0',
                    color: '#fff'
                  }}
                >
                  {fmtCount(team.unreadTotal)}
                </Box>
              ) : null}
            </Box>
          }
          sx={{
            fontWeight: 700,
            borderRadius: 4,
            flexShrink: 0,
            bgcolor: teamMode ? '#377EF0' : 'background.paper',
            color: teamMode ? '#fff' : 'text.primary',
            border: '1px solid',
            borderColor: teamMode ? '#377EF0' : 'rgba(55,126,240,.4)',
            '& .MuiChip-icon': { color: 'inherit', ml: 0.75, mr: -0.25 },
            '&:hover': { bgcolor: teamMode ? '#1e5dc8' : 'rgba(55,126,240,.12)' }
          }}
        />
      </Tooltip>
      {manyNumbers ? <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: 'divider', mx: 0.5, flexShrink: 0 }} /> : null}
      {manyNumbers ? (
        <>
          <Chip
            size="small"
            onClick={() => setSessionFilter('')}
            label="Todos os números"
            sx={{
              fontWeight: 700,
              borderRadius: 4,
              flexShrink: 0,
              bgcolor: !sessionFilterValid && !teamMode ? WA_DARK : 'background.paper',
              color: !sessionFilterValid && !teamMode ? '#fff' : 'text.secondary',
              border: '1px solid',
              borderColor: !sessionFilterValid && !teamMode ? WA_DARK : 'divider',
              '&:hover': { bgcolor: !sessionFilterValid && !teamMode ? WA_DARK : 'action.hover' }
            }}
          />
          {sessions.map((sx) => {
            const on = !teamMode && sessionFilterValid === sx.id;
            const color = sx.color || WA_GREEN;
            const n = Number(counts?.by_session?.[sx.id]) || 0;
            return (
              <Tooltip
                key={sx.id}
                title={`${sessionLabel(sx)}${sx.phone ? ` · ${fmtPhone(sx.phone)}` : ''}${sx.connected ? '' : ' · não conectado'}`}
              >
                <Chip
                  size="small"
                  onClick={() => setSessionFilter(on ? '' : sx.id)}
                  icon={<WaNumberDot session={sx} size={8} sx={{ ml: 0.75 }} />}
                  label={
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
                      {sessionLabel(sx)}
                      {n ? (
                        <Box
                          component="span"
                          sx={{
                            minWidth: 17,
                            height: 17,
                            px: 0.5,
                            borderRadius: 9,
                            fontSize: 10.5,
                            fontWeight: 800,
                            display: 'inline-grid',
                            placeItems: 'center',
                            bgcolor: on ? 'rgba(255,255,255,.3)' : color,
                            color: '#fff'
                          }}
                        >
                          {fmtCount(n)}
                        </Box>
                      ) : null}
                    </Box>
                  }
                  sx={{
                    fontWeight: 700,
                    borderRadius: 4,
                    flexShrink: 0,
                    opacity: sx.connected ? 1 : 0.7,
                    bgcolor: on ? color : 'background.paper',
                    color: on ? '#fff' : 'text.primary',
                    border: '1px solid',
                    borderColor: on ? color : `${color}66`,
                    '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
                    '&:hover': { bgcolor: on ? color : `${color}1F` }
                  }}
                />
              </Tooltip>
            );
          })}
        </>
      ) : null}
    </ScrollChipsRow>
  );

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
          : fmtPhone(active.phone) || (active.jid ? String(active.jid).split('@')[0] : '');

  const emptyState = (() => {
    if (q)
      return {
        title: 'Nenhuma conversa encontrada',
        description:
          onlyDigits(q).length >= 8
            ? 'Esse número ainda não tem conversa aqui.'
            : advCount
              ? 'A busca também respeita os filtros avançados ativos.'
              : undefined
      };
    if (advCount)
      return { title: 'Nenhuma conversa com esses filtros', description: 'Ajuste ou limpe os filtros avançados para ver mais conversas.' };
    if (filter === 'unread') return { title: 'Nada por ler' };
    if (filter === 'archived') return { title: 'Nenhuma conversa arquivada' };
    if (filter === 'mine')
      return {
        title: 'Nenhum atendimento com você',
        description: 'Conversas que você assumir ou receber por transferência aparecem aqui.'
      };
    if (filter === 'dms') return { title: 'Nenhuma conversa individual' };
    if (filter === 'groups') return { title: 'Nenhum grupo' };
    if (isCustomFilter(filter))
      return { title: 'Filtro vazio', description: 'Use o menu ⋮ do chip para editar o filtro e adicionar conversas.' };
    return {
      title: 'Nenhuma conversa ainda',
      description: 'As conversas do número conectado aparecem aqui. Para começar uma, use o botão + ao lado da busca.'
    };
  })();

  const isIndividual = active?.kind === 'individual';
  const canTag = Boolean(active) && (active.kind === 'individual' || active.kind === 'group');
  const activeSvc = isIndividual ? serviceInfo(active.service, { myId, compact: isNarrow, showClosed: true }) : null;
  const activeTags = useMemo(() => (Array.isArray(active?.tags) ? active.tags.filter((t) => t && t.name) : []), [active?.tags]);
  // etapa do funil (chip no cabeçalho) — lista de etapas carregada 1x e atualizada por wa:sync
  const [stageMap, setStageMap] = useState(new Map());
  const loadStages = useCallback(() => {
    get('/whatsapp/pipeline/stages')
      .then((r) => setStageMap(new Map((Array.isArray(r) ? r : []).map((st) => [st.id, st]))))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    loadStages();
  }, [loadStages]);
  useRealtimeEvent('wa:sync', (p) => p?.kind === 'pipeline' && loadStages());
  const activeStage = active?.stage_id ? stageMap.get(active.stage_id) : null;
  const activeTagIds = useMemo(() => activeTags.map((t) => t.id), [activeTags]);

  const offline = !connected;
  const canSend = !offline && (Boolean(text.trim()) || Boolean(attachment) || Boolean(qrMedia));
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
    // lista de respostas rápidas aberta: teclado navega/insere (Enter nunca envia daqui)
    if (qr) {
      const n = qrItems.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (n) setQr((p) => (p ? { ...p, index: (p.index + (e.key === 'ArrowDown' ? 1 : -1) + n) % n } : p));
        return;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        if (n) {
          e.preventDefault();
          pickQuickReply(qrItems[Math.min(qr.index, n - 1)]);
          return;
        }
        if (e.key === 'Enter' && qr.mode === 'slash') {
          // nenhum atalho: fecha a lista; um segundo Enter envia o texto como está
          e.preventDefault();
          setQr(null);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setQr(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending && canSend) sendText();
    } else if (e.key === 'Escape') {
      if (editing) {
        setEditing(null);
        setText('');
      } else if (qrMedia) setQrMedia(null);
      else if (reply) setReply(null);
    }
  };

  const bubbleMsg = bubbleMenu?.msg;
  const canEdit = bubbleMsg && bubbleMsg.direction === 'OUT' && bubbleMsg.type === 'text' && !bubbleMsg.revoked;
  const fmtRec = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ============================================================ render
  if (sessionLoading && !sessions.length) {
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
          manyNumbers
            ? `${sessions.length} números · ${sessions.filter((x) => x.connected).length} conectado${sessions.filter((x) => x.connected).length === 1 ? '' : 's'}`
            : connected && sessions[0]?.push_name
              ? `${sessions[0].push_name} · ${fmtPhone(sessions[0].phone)}`
              : (connected && fmtPhone(sessions[0]?.phone)) || 'Converse com pessoas e grupos do seu WhatsApp.'
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
      <WaSessionBanner
        session={{ status: sessions[0]?.status || 'none', sessions }}
        loading={sessionLoading}
        connected={connected}
        what="enviar e responder mensagens"
      />

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
        {/* ---------------- modo EQUIPE (chat interno) ---------------- */}
        {teamMode && (!isNarrow || !teamChat) ? (
          <Box
            sx={{
              width: { xs: '100%', md: 360 },
              flexShrink: 0,
              borderRight: { md: '1px solid' },
              borderColor: { md: 'divider' },
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}
          >
            <TeamList
              team={team}
              activeId={teamChat?.id}
              onOpen={(c) => setTeam(c.id)}
              onNewGroup={() => setNewGroup(true)}
              headerChips={modeChips}
            />
          </Box>
        ) : null}
        {teamMode && (!isNarrow || teamChat) ? (
          <TeamThread
            chat={teamChat}
            me={{ id: myId, name: user?.user?.name, role: user?.user?.role }}
            team={team}
            isNarrow={isNarrow}
            onBack={() => setTeam('1')}
            onChatChanged={() => team.reload()}
            onLeft={() => setTeam('1')}
          />
        ) : null}

        {/* ---------------- coluna esquerda ---------------- */}
        {!teamMode && showList ? (
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
              <Stack direction="row" spacing={0.75} alignItems="center">
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Pesquisar ou iniciar conversa"
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
                  sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: 'background.default' } }}
                />
                <Tooltip title={advCount ? `Filtros avançados · ${advCount} ativo${advCount === 1 ? '' : 's'}` : 'Filtros avançados'}>
                  <IconButton
                    onClick={(e) => {
                      setAdvAnchor(e.currentTarget);
                      loadTags();
                    }}
                    aria-label="Filtros avançados"
                    sx={[
                      {
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: advCount ? WA_GREEN : 'divider',
                        color: 'text.secondary',
                        bgcolor: advCount ? (t) => tint(t, 'success', 0.1) : 'background.default',
                        '&:hover': advCount
                          ? { bgcolor: (t) => tint(t, 'success', 0.16) }
                          : { bgcolor: 'action.hover', color: 'text.primary' }
                      },
                      Boolean(advCount) && ACTIVE_FG
                    ]}
                  >
                    <Badge
                      badgeContent={advCount}
                      invisible={!advCount}
                      sx={{
                        '& .MuiBadge-badge': {
                          minWidth: 16,
                          height: 16,
                          px: 0.4,
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#fff',
                          bgcolor: WA_GREEN,
                          border: '1.5px solid',
                          borderColor: 'background.paper',
                          top: -3,
                          right: -4
                        }
                      }}
                    >
                      <IconAdjustmentsHorizontal size={18} />
                    </Badge>
                  </IconButton>
                </Tooltip>
                <Tooltip title="Nova conversa com um número">
                  <IconButton
                    onClick={() => setNewChat({ phone: onlyDigits(q).length >= 8 ? onlyDigits(q) : '' })}
                    aria-label="Nova conversa"
                    sx={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: 2.5,
                      color: '#fff',
                      bgcolor: WA_GREEN,
                      '&:hover': { bgcolor: WA_DARK }
                    }}
                  >
                    <IconMessagePlus size={18} />
                  </IconButton>
                </Tooltip>
              </Stack>

              {modeChips}

              <ActiveAdvChips value={adv} onChange={setAdv} tags={orgTags} attendants={attendants} myId={myId} sx={{ mt: 1 }} />

              <ScrollChipsRow
                sx={{ mt: 1 }}
                trailing={
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
                        border: '1px dashed',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        color: 'text.secondary',
                        '& .MuiChip-icon': { color: 'inherit', ml: customFilters.length ? 0 : 0.75, mr: customFilters.length ? 0 : -0.25 },
                        '& .MuiChip-label': { px: customFilters.length ? 0.75 : 1 },
                        '&:hover': { bgcolor: 'action.hover', color: WA_DARK, borderColor: WA_DARK }
                      }}
                    />
                  </Tooltip>
                }
              >
                {FILTERS.map((f) => {
                  const on = filter === f.id;
                  const n = Number(counts?.[f.count]) || 0;
                  return (
                    <Chip
                      key={f.id}
                      ref={on ? activeChipRef : undefined}
                      size="small"
                      onClick={() => selectFilter(f.id)}
                      label={
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
                          {f.label}
                          {n ? (
                            <Box
                              component="span"
                              sx={{
                                minWidth: 17,
                                height: 17,
                                px: 0.55,
                                borderRadius: 9,
                                display: 'inline-grid',
                                placeItems: 'center',
                                fontSize: 10,
                                fontWeight: 800,
                                lineHeight: 1,
                                fontVariantNumeric: 'tabular-nums',
                                ...(f.strong
                                  ? { bgcolor: WA_GREEN, color: '#fff' }
                                  : { bgcolor: on ? 'rgba(18,140,126,.18)' : 'action.selected', color: 'inherit' })
                              }}
                            >
                              {fmtCount(n)}
                            </Box>
                          ) : null}
                        </Box>
                      }
                      sx={[
                        {
                          fontWeight: 700,
                          borderRadius: 4,
                          flexShrink: 0,
                          bgcolor: on ? (t) => tint(t, 'success', 0.18) : 'action.hover',
                          color: 'text.secondary',
                          '& .MuiChip-label': { px: 1.1 },
                          '&:hover': { bgcolor: on ? (t) => tint(t, 'success', 0.24) : 'action.selected' }
                        },
                        on && ACTIVE_FG
                      ]}
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
                      sx={[
                        {
                          fontWeight: 700,
                          borderRadius: 4,
                          flexShrink: 0,
                          maxWidth: 180,
                          bgcolor: on ? (t) => tint(t, 'success', 0.18) : 'action.hover',
                          color: 'text.secondary',
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
                        },
                        on && ACTIVE_FG
                      ]}
                    />
                  );
                })}
              </ScrollChipsRow>
            </Box>

            <Box sx={[THIN_SCROLL, { flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', p: 0.75 }]}>
              {listLoading && list.items.length === 0 ? (
                <Box sx={{ p: 1 }}>
                  <TgListSkeleton rows={7} />
                </Box>
              ) : visibleChats.length === 0 ? (
                <TgEmptyState
                  dense
                  icon={IconMessages}
                  title={emptyState.title}
                  description={emptyState.description}
                  action={
                    q && onlyDigits(q).length >= 8 ? (
                      <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        startIcon={<IconMessagePlus size={15} />}
                        onClick={() => setNewChat({ phone: onlyDigits(q) })}
                        sx={{ fontWeight: 700, textTransform: 'none', bgcolor: WA_DARK, '&:hover': { bgcolor: WA_DARK } }}
                      >
                        Iniciar conversa com {fmtPhone(normalizePhoneInput(q))}
                      </Button>
                    ) : advCount ? (
                      <Button
                        size="small"
                        onClick={() => setAdv({ ...ADV_DEFAULT, tags: [] })}
                        sx={{ fontWeight: 700, textTransform: 'none', color: WA_DARK }}
                      >
                        Limpar filtros avançados
                      </Button>
                    ) : undefined
                  }
                  sx={{ m: 1, border: 'none', bgcolor: 'transparent' }}
                />
              ) : (
                <Stack spacing={0.25}>
                  {visibleChats.map((c) => (
                    <ChatListItem
                      key={c.chat_id}
                      chat={c}
                      active={activeId === c.chat_id}
                      onOpen={openChat}
                      now={c.waiting_reply ? nowTick : 0}
                      session={manyNumbers && !sessionFilterValid ? sessionOf(c) : null}
                    />
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
        {!teamMode && showChat ? (
          <Box
            sx={[
              THREAD_BG,
              { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', '&::before': WALLPAPER }
            ]}
          >
            {!active && offline && !listLoading && list.items.length === 0 ? (
              <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3, position: 'relative', zIndex: 1, overflowY: 'auto' }}>
                <WaNotConnected session={sessions[0]} title="Conecte o WhatsApp para conversar" sx={{ py: 0, width: '100%' }} />
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
                    onClick={
                      isGroup
                        ? openGroupInfo
                        : isIndividual
                          ? () =>
                              setPerson({
                                jid: active.jid,
                                name: chatLabel(active),
                                chat_id: active.chat_id,
                                session_id: active.session_id
                              })
                          : undefined
                    }
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      cursor: isGroup || isIndividual ? 'pointer' : 'default',
                      borderRadius: 2,
                      px: 0.5,
                      py: 0.25,
                      '&:hover': isGroup || isIndividual ? { bgcolor: 'action.hover' } : {}
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
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
                          {chatLabel(active)}
                        </Typography>
                        {manyNumbers ? <WaNumberChip session={sessionOf(active)} showPhone={!isNarrow} sx={{ flexShrink: 0 }} /> : null}
                        {activeSvc && !isNarrow ? <ServiceTag info={activeSvc} sx={{ maxWidth: 240 }} /> : null}
                        {active.muted ? <IconVolumeOff size={14} style={{ opacity: 0.5, flexShrink: 0 }} /> : null}
                        {active.pinned ? <IconPinned size={14} style={{ opacity: 0.5, flexShrink: 0 }} /> : null}
                      </Stack>
                      {activeSvc && isNarrow ? (
                        // no celular a etiqueta de atendimento desce para a 2ª linha (o nome fica inteiro)
                        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0, mt: 0.25 }}>
                          <ServiceTag info={activeSvc} sx={{ maxWidth: 150 }} />
                          <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 0 }} noWrap>
                            {headerSubtitle}
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                          {headerSubtitle}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  {activeStage || active.contact?.opted_out ? (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
                      {activeStage ? (
                        <Tooltip title={`Etapa do funil: ${activeStage.name}`}>
                          <Chip
                            size="small"
                            onClick={() => setCustomerOpen(true)}
                            label={activeStage.name}
                            icon={
                              <Box
                                component="span"
                                sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: activeStage.color, ml: '6px !important' }}
                              />
                            }
                            sx={{
                              height: 22,
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 1.5,
                              borderLeft: '3px solid',
                              borderColor: activeStage.color
                            }}
                          />
                        </Tooltip>
                      ) : null}
                      {active.contact?.opted_out ? (
                        <Tooltip title="Pediu para não receber mensagens (LGPD): fora dos broadcasts e agendamentos">
                          <Chip
                            size="small"
                            label="Descadastrado"
                            color="warning"
                            variant="outlined"
                            sx={{ height: 22, fontSize: 11, fontWeight: 700, borderRadius: 1.5 }}
                          />
                        </Tooltip>
                      ) : null}
                    </Stack>
                  ) : null}
                  {activeTags.length ? (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      onClick={(e) => setTagsAnchor(e.currentTarget)}
                      sx={{ display: { xs: 'none', md: 'flex' }, cursor: 'pointer', maxWidth: 260, overflow: 'hidden' }}
                    >
                      {activeTags.slice(0, 2).map((t) => (
                        <TagChip key={t.id} tag={t} size="md" />
                      ))}
                      <MoreChip
                        n={Math.max(0, activeTags.length - 2)}
                        title={activeTags
                          .slice(2)
                          .map((t) => t.name)
                          .join(', ')}
                      />
                    </Stack>
                  ) : active.contact?.tags?.length ? (
                    <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', lg: 'flex' } }}>
                      {active.contact.tags.slice(0, 3).map((t) => (
                        <Chip
                          key={t}
                          label={t}
                          size="small"
                          variant="outlined"
                          title="Etiqueta do contato"
                          sx={{ height: 20, fontSize: 10.5, borderRadius: 1, borderColor: WA_DARK, color: WA_DARK }}
                        />
                      ))}
                    </Stack>
                  ) : null}
                  {canTag ? (
                    <Tooltip title="Etiquetas da conversa">
                      <IconButton size="small" onClick={(e) => setTagsAnchor(e.currentTarget)} aria-label="Etiquetas da conversa">
                        <Badge
                          badgeContent={activeTags.length}
                          invisible={!activeTags.length}
                          sx={{
                            '& .MuiBadge-badge': {
                              minWidth: 15,
                              height: 15,
                              px: 0.35,
                              fontSize: 9.5,
                              fontWeight: 800,
                              color: '#fff',
                              bgcolor: WA_DARK,
                              top: 1,
                              right: 1
                            }
                          }}
                        >
                          <IconTag size={20} />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  {isIndividual ? (
                    <Tooltip title="Cliente (cadastro, assinaturas, vencimentos)">
                      <IconButton size="small" onClick={() => setCustomerOpen(true)} aria-label="Cliente">
                        <IconUserDollar size={20} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  {isIndividual ? (
                    <Tooltip title="Cobrar (PIX / boleto na conversa)">
                      <span>
                        <IconButton size="small" onClick={openCharge} aria-label="Cobrar" disabled={chargeBusy}>
                          <IconReceipt2 size={20} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : null}
                  {isIndividual ? (
                    <Tooltip title="Atendimento">
                      <IconButton
                        size="small"
                        onClick={(e) => setSvcAnchor(e.currentTarget)}
                        aria-label="Atendimento"
                        sx={activeSvc && activeSvc.key !== 'closed' ? ACTIVE_FG : undefined}
                      >
                        <IconHeadset size={20} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  <IconButton size="small" onClick={(e) => setHdrAnchor(e.currentTarget)}>
                    <IconDotsVertical size={20} />
                  </IconButton>
                </Stack>

                {/* thread (+ pílula de novas mensagens por cima, logo acima do composer) */}
                <Box sx={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box
                    ref={setThreadEl}
                    onScroll={onThreadScroll}
                    sx={[
                      THIN_SCROLL,
                      { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', position: 'relative' }
                    ]}
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
                      <Box ref={setContentEl} sx={{ py: 1 }}>
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
                  {unseen > 0 ? (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => scrollToEnd(true)}
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        bottom: 14,
                        transform: 'translateX(-50%)',
                        zIndex: 3,
                        border: 0,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.6,
                        pl: 1.5,
                        pr: 1.1,
                        height: 32,
                        borderRadius: 16,
                        fontSize: 12.5,
                        fontWeight: 800,
                        fontFamily: 'inherit',
                        color: '#fff',
                        bgcolor: WA_DARK,
                        boxShadow: '0 6px 18px rgba(0,0,0,.22)',
                        animation: `${popIn} .18s ease-out`,
                        '&:hover': { bgcolor: '#0f7a6e' }
                      }}
                    >
                      {unseen > 99 ? '99+' : unseen} {unseen === 1 ? 'nova mensagem' : 'novas mensagens'}
                      <IconArrowDown size={15} stroke={2.4} />
                    </Box>
                  ) : showJump ? (
                    <Fab
                      size="small"
                      onClick={() => scrollToEnd(true)}
                      aria-label="Ir para a última mensagem"
                      sx={{
                        position: 'absolute',
                        right: 20,
                        bottom: 16,
                        zIndex: 3,
                        bgcolor: 'background.paper',
                        color: 'text.secondary',
                        '&:hover': { bgcolor: 'background.paper' }
                      }}
                    >
                      <IconArrowDown size={18} />
                    </Fab>
                  ) : null}
                </Box>

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
                        <PreviewText
                          preview={previewOf(editing || reply)}
                          type={
                            (editing || reply)?.type && (editing || reply).type !== 'text' && !(editing || reply).revoked
                              ? (editing || reply).type
                              : undefined
                          }
                        />
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

                {/* anexo da resposta rápida (só vai no envio: Enter / Enviar) */}
                {qrMedia ? (
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
                    {quickMediaKind(qrMedia.media) === 'image' && qrMedia.media.url ? (
                      <img src={qrMedia.media.url} alt="anexo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: (t) => tint(t, 'success', 0.12),
                          color: WA_DARK,
                          flexShrink: 0
                        }}
                      >
                        {(() => {
                          const MI = quickMediaMeta(qrMedia.media).icon;
                          return <MI size={22} />;
                        })()}
                      </Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={[ACTIVE_FG, { display: 'grid' }]}>
                          <IconBolt size={13} />
                        </Box>
                        <Typography variant="caption" sx={[ACTIVE_FG, { fontWeight: 800 }]}>
                          Anexo da resposta rápida · /{qrMedia.shortcut}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {qrMedia.media.filename || qrMedia.title || quickMediaMeta(qrMedia.media).label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                        {qrMedia.media.size ? `${fmtBytes(qrMedia.media.size)} · ` : ''}vai junto com o texto ao enviar (o texto vira a
                        legenda)
                      </Typography>
                    </Box>
                    <Tooltip title="Remover anexo">
                      <IconButton size="small" onClick={() => setQrMedia(null)}>
                        <IconX size={16} />
                      </IconButton>
                    </Tooltip>
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
                      borderTop: reply || editing || attachment || qrMedia ? 'none' : '1px solid',
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
                        ref={composerBoxRef}
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
                          borderColor: qr ? WA_GREEN : 'divider',
                          transition: 'border-color .12s ease'
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
                        <Tooltip title="Respostas rápidas (digite / no início)">
                          <span>
                            <IconButton
                              size="small"
                              onClick={toggleQuickReplies}
                              disabled={Boolean(editing) || offline}
                              aria-label="Respostas rápidas"
                              sx={qr ? ACTIVE_FG : undefined}
                            >
                              <IconBolt size={21} />
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
                                : attachment || qrMedia
                                  ? 'Legenda (opcional)'
                                  : isNarrow
                                    ? 'Digite uma mensagem'
                                    : 'Digite uma mensagem ou / para respostas rápidas'
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

      {/* ---------------- respostas rápidas ---------------- */}
      <QuickRepliesPopper
        open={Boolean(qr) && Boolean(active)}
        anchorEl={composerBoxRef.current}
        items={qrItems}
        total={qrList?.length || 0}
        loading={qrLoading}
        index={qr ? Math.min(qr.index, Math.max(0, qrItems.length - 1)) : 0}
        query={qr?.query || ''}
        onHover={(i) => setQr((p) => (p ? { ...p, index: i } : p))}
        onPick={pickQuickReply}
        onClose={() => setQr(null)}
        onManage={() => {
          setQr(null);
          navigate('/whatsapp/settings');
        }}
      />

      {/* ---------------- filtros avançados ---------------- */}
      <AdvancedFiltersPopover
        anchorEl={advAnchor}
        onClose={() => setAdvAnchor(null)}
        value={adv}
        onChange={setAdv}
        tags={orgTags}
        attendants={attendants}
        myId={myId}
      />

      {/* ---------------- etiquetas / atendimento da conversa ---------------- */}
      <TagsPopover
        anchorEl={tagsAnchor}
        onClose={() => setTagsAnchor(null)}
        selectedIds={activeTagIds}
        tags={orgTags}
        onToggle={toggleChatTag}
        onCreate={createTag}
      />
      <AttendanceMenu
        anchorEl={svcAnchor}
        onClose={() => setSvcAnchor(null)}
        chat={active}
        myId={myId}
        onAction={(a) => serviceAction(a)}
        onTransfer={() => setTransferOpen(true)}
        onHistory={() => setHistoryOpen(true)}
      />
      <TransferDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        attendants={attendants}
        currentId={active?.service?.assigned_user?.id || null}
        myId={myId}
        onConfirm={(userId) => serviceAction('transfer', userId)}
      />
      <ServiceHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        chatId={active?.chat_id}
        chatName={active ? chatLabel(active) : ''}
        attendants={attendants}
        tags={orgTags}
      />

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
        sessions={sessions}
        initialSessionId={sessionFilterValid || undefined}
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

      {/* ---------------- cliente (CRM) ---------------- */}
      <CustomerPanel open={customerOpen && Boolean(active)} onClose={() => setCustomerOpen(false)} chat={active} canDelete={canTag} />
      <ChargeDialog
        open={Boolean(charge)}
        onClose={() => setCharge(null)}
        customer={charge?.customer || null}
        products={charge?.products || []}
      />

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
              {sortParticipants(groupDrawer.info.group_meta?.participants || []).map((p) => (
                <Stack
                  key={p.id || p.phone}
                  direction="row"
                  spacing={1.25}
                  alignItems="center"
                  onClick={() =>
                    setPerson({
                      jid: p.phone ? `${p.phone}@c.us` : p.id,
                      name: p.is_me ? null : p.name || null,
                      chat_id: groupDrawer.info.chat_id,
                      session_id: groupDrawer.info.session_id
                    })
                  }
                  sx={{ px: 1, py: 0.75, borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <LazyAvatar
                    name={p.name || p.phone}
                    photoPath={`/whatsapp/photo?jid=${enc(p.phone ? `${p.phone}@c.us` : p.id)}&session_id=${enc(groupDrawer.info.session_id || '')}`}
                    size={38}
                    kind="contact"
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {p.is_me ? 'Você' : p.name || fmtPhone(p.phone) || p.id}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                      {p.is_me || p.name ? fmtPhone(p.phone) || p.id : 'Sem nome salvo'}
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

      <NewGroupDialog
        open={newGroup}
        users={team.users}
        onClose={() => setNewGroup(false)}
        onCreated={(c) => {
          team.reload();
          setTeam(c.id);
        }}
      />
      <NewChatDialog
        open={Boolean(newChat)}
        initialPhone={newChat?.phone || ''}
        sessions={sessions}
        initialSession={sessionFilterValid || active?.session_id || ''}
        onClose={() => setNewChat(null)}
        onOpened={openNewChat}
      />

      <ContactInfoDrawer
        target={person}
        onClose={() => setPerson(null)}
        onOpenChat={(chat) => {
          setGroupDrawer(null);
          setSearchParams((prev) => {
            const n = new URLSearchParams(prev);
            n.set('chat', chat.chat_id);
            return n;
          });
        }}
        onOpenCustomer={() => navigate('/whatsapp/customers')}
      />
    </Box>
  );
}
