import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconArrowLeft,
  IconArrowBackUp,
  IconCheck,
  IconCrown,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconFileText,
  IconLogout,
  IconMoodSmile,
  IconPaperclip,
  IconPencil,
  IconSearch,
  IconSend,
  IconTrash,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
  IconUsersGroup,
  IconUsersPlus,
  IconX
} from '@tabler/icons-react';

import { get, post, patch, remove } from 'api/api';
import { TgConfirmDialog, TgEmptyState, TgListSkeleton, TgModal } from 'views/pages/telegram/ui';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { EmojiPicker, dual, errMsg, fmtTime, fmtListTime, fmtBytes, dateLabel, startOfDay } from '../waShared';
import AudioPlayer from './AudioPlayer';
import { PreviewText, previewText } from './mediaIcons';

// ============================================================================
// Chat interno da EQUIPE (usuários da organização): conversas diretas e grupos.
// API: /team/users, /team/chats, /team/chats/:id/messages, /team/media. Tempo real por usuário:
// team:message, team:message_updated, team:chat, team:read. Visual no padrão do chat do WhatsApp
// (lista à esquerda, conversa à direita), mas com a cor primária do sistema para "nossas" mensagens.
// ============================================================================

const PRIMARY = '#377EF0';
const PRIMARY_DARK = '#1e5dc8';
const PAGE = 50;
const GROUP_GAP_MS = 3 * 60 * 1000;
const enc = (v) => encodeURIComponent(String(v));

// cor estável por usuário (avatar e nome no grupo)
const USER_COLORS = ['#377EF0', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#EF4444', '#6366F1', '#84CC16', '#F97316', '#0EA5E9'];
const colorOf = (id) => {
  let h = 0;
  for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return USER_COLORS[h % USER_COLORS.length];
};
const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

export function UserAvatar({ user, size = 40, online, sx }) {
  const color = colorOf(user?.id);
  return (
    <Box sx={{ position: 'relative', flexShrink: 0, ...sx }}>
      <Avatar
        sx={{
          width: size,
          height: size,
          bgcolor: `${color}22`,
          color,
          fontWeight: 800,
          fontSize: size * 0.38,
          border: `1.5px solid ${color}55`
        }}
      >
        {initials(user?.name)}
      </Avatar>
      {online !== undefined ? (
        <Box
          sx={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: Math.max(10, size * 0.28),
            height: Math.max(10, size * 0.28),
            borderRadius: '50%',
            bgcolor: online ? '#22c55e' : '#94a3b8',
            border: '2px solid',
            borderColor: 'background.paper'
          }}
        />
      ) : null}
    </Box>
  );
}
UserAvatar.propTypes = { user: PropTypes.object, size: PropTypes.number, online: PropTypes.bool, sx: PropTypes.object };

function GroupAvatar({ size = 40, sx }) {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
        color: '#fff',
        flexShrink: 0,
        ...sx
      }}
    >
      <IconUsersGroup size={size * 0.5} />
    </Avatar>
  );
}

// ---------------------------------------------------------------- dados (lista + usuários)
export function useTeam() {
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const loadChats = useCallback(async () => {
    const s = ++seq.current;
    try {
      const r = await get('/team/chats');
      if (s !== seq.current) return;
      setChats(r?.items || []);
      setUnreadTotal(Number(r?.unread_total) || 0);
    } catch {
      /* silencioso */
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, []);
  const loadUsers = useCallback(async () => {
    try {
      const r = await get('/team/users');
      setUsers(Array.isArray(r) ? r : r?.items || []);
    } catch {
      /* silencioso */
    }
  }, []);
  useEffect(() => {
    loadChats();
    loadUsers();
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        loadChats();
        loadUsers();
      }
    }, 60000);
    return () => window.clearInterval(id);
  }, [loadChats, loadUsers]);
  useRealtimeEvent('team:chat', () => {
    loadChats();
  });
  // marcado como lido em outra aba do mesmo usuário: zera localmente (sem refetch — evita tempestade de requisições)
  useRealtimeEvent('team:read', ({ chat_id: chatId } = {}) => {
    if (!chatId) return;
    setChats((prev) => prev.map((c) => (c.id === chatId && c.unread_count ? { ...c, unread_count: 0 } : c)));
  });
  useRealtimeEvent('team:message', ({ chat_id: chatId, message } = {}) => {
    if (!chatId || !message) return;
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === chatId);
      if (idx < 0) {
        loadChats();
        return prev;
      }
      const c = prev[idx];
      const mine = Boolean(message.user?.is_me);
      const next = {
        ...c,
        last_message_at: message.created_at,
        last_preview: previewText(message),
        last_user: { id: message.user?.id, name: message.user?.name, is_me: mine },
        unread_count: mine ? c.unread_count : (c.unread_count || 0) + 1
      };
      const rest = prev.filter((x) => x.id !== chatId);
      return [next, ...rest];
    });
  });
  useEffect(() => {
    setUnreadTotal(chats.reduce((a, c) => a + (Number(c.unread_count) || 0), 0));
  }, [chats]);
  const patchChat = useCallback((id, p) => setChats((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c))), []);
  // objeto estável: quem depende de `team` num useEffect não roda de novo a cada render
  return useMemo(
    () => ({ users, chats, unreadTotal, loading, reload: loadChats, reloadUsers: loadUsers, patchChat, setChats }),
    [users, chats, unreadTotal, loading, loadChats, loadUsers, patchChat]
  );
}

// ---------------------------------------------------------------- lista (coluna esquerda)
const ChatRow = memo(function ChatRow({ chat, active, onOpen }) {
  const unread = Number(chat.unread_count) || 0;
  const isGroup = chat.kind === 'group';
  const who = chat.last_user ? (chat.last_user.is_me ? 'Você' : isGroup ? chat.last_user.name?.split(' ')[0] : null) : null;
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
        bgcolor: active ? (t) => `rgba(${t.vars.palette.primary.mainChannel} / 0.12)` : 'transparent',
        '&:hover': { bgcolor: active ? (t) => `rgba(${t.vars.palette.primary.mainChannel} / 0.16)` : 'action.hover' }
      }}
    >
      {isGroup ? <GroupAvatar size={46} /> : <UserAvatar user={chat.peer} size={46} online={Boolean(chat.peer?.online)} />}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography sx={{ fontWeight: unread ? 800 : 700, fontSize: 14.5, minWidth: 0 }} noWrap>
            {chat.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: unread ? PRIMARY : 'text.secondary', fontWeight: unread ? 700 : 500, flexShrink: 0, fontSize: 11 }}
          >
            {chat.last_message_at ? fmtListTime(chat.last_message_at) : ''}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography
            variant="caption"
            component="div"
            sx={{
              color: unread ? 'text.primary' : 'text.secondary',
              flex: 1,
              minWidth: 0,
              fontSize: 12.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            {who ? (
              <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600, flexShrink: 0 }}>
                {who}:
              </Box>
            ) : null}
            {chat.last_preview ? (
              <PreviewText preview={chat.last_preview} />
            ) : (
              <Box component="span" sx={{ fontStyle: 'italic' }}>
                {isGroup ? `${chat.members_count} membros` : 'Sem mensagens'}
              </Box>
            )}
          </Typography>
          {unread ? (
            <Box
              sx={{
                minWidth: 20,
                height: 20,
                px: 0.75,
                borderRadius: 10,
                bgcolor: PRIMARY,
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
ChatRow.propTypes = { chat: PropTypes.object.isRequired, active: PropTypes.bool, onOpen: PropTypes.func.isRequired };

export function TeamList({ team, activeId, onOpen, onNewGroup, headerChips }) {
  const [tab, setTab] = useState('chats'); // chats | people
  const [q, setQ] = useState('');
  const [opening, setOpening] = useState('');
  const ql = q.trim().toLowerCase();
  const chats = useMemo(
    () =>
      ql
        ? team.chats.filter((c) =>
            String(c.name || '')
              .toLowerCase()
              .includes(ql)
          )
        : team.chats,
    [team.chats, ql]
  );
  const people = useMemo(
    () =>
      team.users.filter(
        (u) =>
          !u.is_me &&
          (!ql ||
            u.name.toLowerCase().includes(ql) ||
            String(u.email || '')
              .toLowerCase()
              .includes(ql))
      ),
    [team.users, ql]
  );
  const openDm = async (u) => {
    setOpening(u.id);
    try {
      const chat = await post('/team/chats/dm', { user_id: u.id });
      await team.reload();
      onOpen(chat);
      setTab('chats');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível abrir a conversa.'));
    } finally {
      setOpening('');
    }
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Box sx={{ p: 1.25, pb: 0.75 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder={tab === 'chats' ? 'Buscar conversa da equipe' : 'Buscar pessoa'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            fullWidth
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
          <Tooltip title="Novo grupo">
            <IconButton
              onClick={onNewGroup}
              aria-label="Novo grupo"
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: 2.5,
                color: '#fff',
                bgcolor: PRIMARY,
                '&:hover': { bgcolor: PRIMARY_DARK }
              }}
            >
              <IconUsersPlus size={18} />
            </IconButton>
          </Tooltip>
        </Stack>
        {headerChips}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{ mt: 1, minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontWeight: 700, textTransform: 'none', fontSize: 13 } }}
        >
          <Tab value="chats" label={`Conversas${team.chats.length ? ` · ${team.chats.length}` : ''}`} />
          <Tab value="people" label={`Pessoas${people.length ? ` · ${people.length}` : ''}`} />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 0.75, pb: 1, overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}>
        {tab === 'chats' ? (
          team.loading && !team.chats.length ? (
            <Box sx={{ p: 1 }}>
              <TgListSkeleton rows={5} />
            </Box>
          ) : !chats.length ? (
            <TgEmptyState
              dense
              icon={IconUsers}
              title={ql ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
              description={ql ? undefined : 'Escolha uma pessoa na aba Pessoas ou crie um grupo.'}
              action={
                !ql ? (
                  <Button size="small" onClick={() => setTab('people')} sx={{ fontWeight: 700, textTransform: 'none', color: PRIMARY }}>
                    Ver pessoas
                  </Button>
                ) : undefined
              }
              sx={{ m: 1, border: 'none', bgcolor: 'transparent' }}
            />
          ) : (
            <Stack spacing={0.25}>
              {chats.map((c) => (
                <ChatRow key={c.id} chat={c} active={activeId === c.id} onOpen={onOpen} />
              ))}
            </Stack>
          )
        ) : !people.length ? (
          <TgEmptyState
            dense
            icon={IconUsers}
            title={ql ? 'Ninguém encontrado' : 'Só você por aqui'}
            description={ql ? undefined : 'Convide outros usuários em Administração → Usuários.'}
            sx={{ m: 1, border: 'none', bgcolor: 'transparent' }}
          />
        ) : (
          <Stack spacing={0.25}>
            {people.map((u) => (
              <Stack
                key={u.id}
                direction="row"
                spacing={1.25}
                alignItems="center"
                onClick={() => !opening && openDm(u)}
                sx={{ px: 1.25, py: 1, borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <UserAvatar user={u} size={42} online={Boolean(u.online)} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14.5 }} noWrap>
                    {u.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                    {u.online ? 'Online' : u.email}
                  </Typography>
                </Box>
                {opening === u.id ? (
                  <CircularProgress size={16} />
                ) : (
                  <Chip
                    size="small"
                    label={u.role === 'OWNER' ? 'Dono' : u.role === 'ADMIN' ? 'Admin' : u.role === 'SUPER_ADMIN' ? 'Super' : 'Membro'}
                    sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                  />
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
TeamList.propTypes = {
  team: PropTypes.object.isRequired,
  activeId: PropTypes.string,
  onOpen: PropTypes.func.isRequired,
  onNewGroup: PropTypes.func.isRequired,
  headerChips: PropTypes.node
};

// ---------------------------------------------------------------- novo grupo
export function NewGroupDialog({ open, users, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [sel, setSel] = useState(new Set());
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName('');
      setSel(new Set());
      setQ('');
      setBusy(false);
    }
  }, [open]);
  const ql = q.trim().toLowerCase();
  const list = users.filter((u) => !u.is_me && (!ql || u.name.toLowerCase().includes(ql)));
  const toggle = (id) =>
    setSel((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const submit = async () => {
    if (!name.trim()) return toast.error('Dê um nome ao grupo.');
    if (!sel.size) return toast.error('Escolha ao menos uma pessoa.');
    setBusy(true);
    try {
      const chat = await post('/team/chats/groups', { name: name.trim(), member_ids: [...sel] });
      toast.success('Grupo criado.');
      onCreated?.(chat);
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível criar o grupo.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <TgModal
      open={open}
      onClose={busy ? undefined : onClose}
      title="Novo grupo da equipe"
      subtitle="Só usuários da sua organização. Você entra como administrador."
      maxWidth="xs"
      footer={
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={submit}
            disabled={busy || !name.trim() || !sel.size}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <IconUsersPlus size={16} />}
            sx={{ fontWeight: 700, bgcolor: PRIMARY, '&:hover': { bgcolor: PRIMARY_DARK } }}
          >
            Criar grupo{sel.size ? ` (${sel.size + 1})` : ''}
          </Button>
        </Stack>
      }
    >
      <Stack spacing={1.5}>
        <TextField
          autoFocus
          size="small"
          label="Nome do grupo"
          placeholder="Ex.: Vendas, Suporte, Diretoria"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          fullWidth
        />
        <TextField
          size="small"
          placeholder="Buscar pessoa"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={16} />
              </InputAdornment>
            )
          }}
        />
        <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          {!list.length ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', p: 2, textAlign: 'center' }}>
              Ninguém encontrado.
            </Typography>
          ) : (
            list.map((u) => (
              <Stack
                key={u.id}
                direction="row"
                spacing={1}
                alignItems="center"
                onClick={() => toggle(u.id)}
                sx={{ px: 1, py: 0.75, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Checkbox size="small" checked={sel.has(u.id)} sx={{ p: 0.5 }} />
                <UserAvatar user={u} size={32} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {u.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                    {u.email}
                  </Typography>
                </Box>
              </Stack>
            ))
          )}
        </Box>
      </Stack>
    </TgModal>
  );
}
NewGroupDialog.propTypes = { open: PropTypes.bool, users: PropTypes.array.isRequired, onClose: PropTypes.func, onCreated: PropTypes.func };

// ---------------------------------------------------------------- membros do grupo (drawer)
function MembersDrawer({ chat, users, me, onClose, onChanged, onLeft }) {
  const open = Boolean(chat);
  const [addOpen, setAddOpen] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [confirm, setConfirm] = useState(null); // {kind:'leave'|'delete'|'remove', user?}
  const isAdmin = chat?.my_role === 'admin' || ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(me?.role);
  const memberIds = new Set((chat?.members || []).map((m) => m.id));
  const candidates = users.filter((u) => !u.is_me && !memberIds.has(u.id));
  useEffect(() => {
    if (!open) {
      setAddOpen(false);
      setSel(new Set());
      setRenaming(null);
    }
  }, [open]);
  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      const r = await fn();
      if (okMsg) toast.success(okMsg);
      onChanged?.(r);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível concluir.'));
    } finally {
      setBusy('');
    }
  };
  const addMembers = () =>
    run('add', () => post(`/team/chats/${enc(chat.id)}/members`, { user_ids: [...sel] }), 'Membros adicionados.').then(() =>
      setAddOpen(false)
    );
  const doConfirm = async () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    if (c.kind === 'remove')
      await run(`rm-${c.user.id}`, () => remove(`/team/chats/${enc(chat.id)}/members/${enc(c.user.id)}`), 'Membro removido.');
    if (c.kind === 'leave') {
      setBusy('leave');
      try {
        await remove(`/team/chats/${enc(chat.id)}/members/${enc(me.id)}`);
        toast.success('Você saiu do grupo.');
        onLeft?.();
      } catch (e) {
        toast.error(errMsg(e, 'Não foi possível sair.'));
      } finally {
        setBusy('');
      }
    }
    if (c.kind === 'delete') {
      setBusy('delete');
      try {
        await remove(`/team/chats/${enc(chat.id)}`);
        toast.success('Grupo apagado.');
        onLeft?.();
      } catch (e) {
        toast.error(errMsg(e, 'Não foi possível apagar.'));
      } finally {
        setBusy('');
      }
    }
  };
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 380 } } }}>
      {chat ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 800, fontSize: 17, flex: 1 }}>{chat.kind === 'group' ? 'Dados do grupo' : 'Conversa'}</Typography>
            <IconButton size="small" onClick={onClose}>
              <IconX size={18} />
            </IconButton>
          </Stack>
          <Box sx={{ overflowY: 'auto', flex: 1 }}>
            <Stack alignItems="center" spacing={1} sx={{ p: 3, textAlign: 'center' }}>
              {chat.kind === 'group' ? (
                <GroupAvatar size={84} />
              ) : (
                <UserAvatar user={chat.peer} size={84} online={Boolean(chat.peer?.online)} />
              )}
              {renaming !== null ? (
                <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                  <TextField
                    size="small"
                    autoFocus
                    value={renaming}
                    onChange={(e) => setRenaming(e.target.value.slice(0, 80))}
                    fullWidth
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      run('rename', () => patch(`/team/chats/${enc(chat.id)}`, { name: renaming }), 'Grupo renomeado.').then(() =>
                        setRenaming(null)
                      )
                    }
                  />
                  <IconButton
                    onClick={() =>
                      run('rename', () => patch(`/team/chats/${enc(chat.id)}`, { name: renaming }), 'Grupo renomeado.').then(() =>
                        setRenaming(null)
                      )
                    }
                    disabled={!renaming.trim() || busy === 'rename'}
                  >
                    <IconCheck size={18} />
                  </IconButton>
                </Stack>
              ) : (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{chat.name}</Typography>
                  {chat.kind === 'group' && isAdmin ? (
                    <IconButton size="small" onClick={() => setRenaming(chat.name || '')} aria-label="Renomear">
                      <IconPencil size={15} />
                    </IconButton>
                  ) : null}
                </Stack>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {chat.kind === 'group' ? `${chat.members_count} membros` : chat.peer?.online ? 'Online agora' : chat.peer?.email}
              </Typography>
            </Stack>
            <Divider />
            {chat.kind === 'group' ? (
              <>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                  <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                    Membros
                  </Typography>
                  {isAdmin ? (
                    <Button
                      size="small"
                      startIcon={<IconUserPlus size={15} />}
                      onClick={() => setAddOpen(true)}
                      sx={{ fontWeight: 700, textTransform: 'none' }}
                    >
                      Adicionar
                    </Button>
                  ) : null}
                </Stack>
                <Stack sx={{ px: 1, pb: 1 }}>
                  {[...(chat.members || [])]
                    .sort((a, b) =>
                      a.is_me ? -1 : b.is_me ? 1 : a.role === b.role ? a.name.localeCompare(b.name, 'pt-BR') : a.role === 'admin' ? -1 : 1
                    )
                    .map((m) => (
                      <Stack key={m.id} direction="row" spacing={1.25} alignItems="center" sx={{ px: 1, py: 0.75, borderRadius: 2 }}>
                        <UserAvatar user={m} size={36} online={Boolean(m.online)} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {m.is_me ? 'Você' : m.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                            {m.online ? 'Online' : m.email}
                          </Typography>
                        </Box>
                        {m.role === 'admin' ? (
                          <Chip size="small" icon={<IconCrown size={13} />} label="Admin" sx={{ height: 22, fontWeight: 700 }} />
                        ) : null}
                        {isAdmin && !m.is_me ? (
                          <MemberMenu
                            member={m}
                            busy={busy}
                            onRole={(role) =>
                              run(
                                `role-${m.id}`,
                                () => patch(`/team/chats/${enc(chat.id)}/members/${enc(m.id)}`, { role }),
                                role === 'admin' ? 'Agora é administrador.' : 'Deixou de ser administrador.'
                              )
                            }
                            onRemove={() => setConfirm({ kind: 'remove', user: m })}
                          />
                        ) : null}
                      </Stack>
                    ))}
                </Stack>
                <Divider />
                <Stack spacing={1} sx={{ p: 2 }}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<IconLogout size={16} />}
                    onClick={() => setConfirm({ kind: 'leave' })}
                    disabled={Boolean(busy)}
                    sx={{ fontWeight: 700, textTransform: 'none', borderColor: 'divider' }}
                  >
                    Sair do grupo
                  </Button>
                  {isAdmin ? (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<IconTrash size={16} />}
                      onClick={() => setConfirm({ kind: 'delete' })}
                      disabled={Boolean(busy)}
                      sx={{ fontWeight: 700, textTransform: 'none' }}
                    >
                      Apagar grupo
                    </Button>
                  ) : null}
                </Stack>
              </>
            ) : null}
          </Box>
        </Box>
      ) : null}

      <TgModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Adicionar ao grupo"
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              variant="contained"
              disableElevation
              onClick={addMembers}
              disabled={!sel.size || busy === 'add'}
              sx={{ fontWeight: 700, bgcolor: PRIMARY, '&:hover': { bgcolor: PRIMARY_DARK } }}
            >
              Adicionar{sel.size ? ` (${sel.size})` : ''}
            </Button>
          </Stack>
        }
      >
        {!candidates.length ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Todos os usuários da organização já estão no grupo.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 320, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            {candidates.map((u) => (
              <Stack
                key={u.id}
                direction="row"
                spacing={1}
                alignItems="center"
                onClick={() =>
                  setSel((p) => {
                    const n = new Set(p);
                    if (n.has(u.id)) n.delete(u.id);
                    else n.add(u.id);
                    return n;
                  })
                }
                sx={{ px: 1, py: 0.75, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Checkbox size="small" checked={sel.has(u.id)} sx={{ p: 0.5 }} />
                <UserAvatar user={u} size={32} />
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {u.name}
                </Typography>
              </Stack>
            ))}
          </Box>
        )}
      </TgModal>
      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        danger={confirm?.kind !== 'leave'}
        loading={busy === 'leave' || busy === 'delete'}
        title={
          confirm?.kind === 'remove'
            ? `Remover ${confirm.user?.name} do grupo?`
            : confirm?.kind === 'delete'
              ? 'Apagar o grupo para todos?'
              : 'Sair do grupo?'
        }
        message={
          confirm?.kind === 'remove'
            ? 'A pessoa deixa de ver as mensagens novas. Dá para adicionar de novo depois.'
            : confirm?.kind === 'delete'
              ? 'As mensagens somem para todos os membros. Não dá para desfazer.'
              : 'Você deixa de receber as mensagens deste grupo. Um administrador pode adicionar você de novo.'
        }
        confirmLabel={confirm?.kind === 'remove' ? 'Remover' : confirm?.kind === 'delete' ? 'Apagar grupo' : 'Sair'}
      />
    </Drawer>
  );
}
MembersDrawer.propTypes = {
  chat: PropTypes.object,
  users: PropTypes.array.isRequired,
  me: PropTypes.object,
  onClose: PropTypes.func,
  onChanged: PropTypes.func,
  onLeft: PropTypes.func
};

function MemberMenu({ member, busy, onRole, onRemove }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} disabled={Boolean(busy)} aria-label="Opções do membro">
        <IconDotsVertical size={16} />
      </IconButton>
      <Menu open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onRole(member.role === 'admin' ? 'member' : 'admin');
          }}
        >
          <ListItemIcon>
            <IconCrown size={16} />
          </ListItemIcon>
          <ListItemText>{member.role === 'admin' ? 'Tirar administração' : 'Tornar administrador'}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onRemove();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}>
            <IconUserMinus size={16} />
          </ListItemIcon>
          <ListItemText>Remover do grupo</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
MemberMenu.propTypes = {
  member: PropTypes.object.isRequired,
  busy: PropTypes.string,
  onRole: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired
};

// ---------------------------------------------------------------- balão
function MediaBody({ msg }) {
  const m = msg.media;
  const mine = Boolean(msg.user?.is_me);
  if (!m?.url) return null;
  if (msg.type === 'image') {
    return (
      <Box
        component="a"
        href={m.url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: 'block', borderRadius: 1.5, overflow: 'hidden', maxWidth: 320, mb: msg.body ? 0.5 : 0 }}
      >
        <img
          src={m.url}
          alt={m.filename || 'imagem'}
          style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover' }}
          loading="lazy"
        />
      </Box>
    );
  }
  if (msg.type === 'video') {
    return (
      <Box sx={{ borderRadius: 1.5, overflow: 'hidden', maxWidth: 360, mb: msg.body ? 0.5 : 0 }}>
        <video src={m.url} controls preload="metadata" style={{ display: 'block', width: '100%', maxHeight: 360 }} />
      </Box>
    );
  }
  if (msg.type === 'audio' || msg.type === 'voice') {
    return (
      <Box sx={{ mb: msg.body ? 0.5 : 0, minWidth: 'min(260px, 100%)' }}>
        <AudioPlayer url={m.url} voice={msg.type === 'voice'} out={Boolean(msg.user?.is_me)} />
      </Box>
    );
  }
  const ext = String(m.filename || '')
    .split('.')
    .pop()
    ?.slice(0, 4)
    .toUpperCase();
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={[
        mine ? { bgcolor: 'rgba(255,255,255,.14)' } : dual({ bgcolor: 'rgba(0,0,0,.05)' }, { bgcolor: 'rgba(255,255,255,.06)' }),
        { p: 1, borderRadius: 1.5, mb: msg.body ? 0.5 : 0, minWidth: 'min(240px, 100%)', color: mine ? '#fff' : 'inherit' }
      ]}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          bgcolor: mine ? 'rgba(255,255,255,.9)' : `${PRIMARY}22`,
          color: PRIMARY,
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0
        }}
      >
        {ext || <IconFileText size={20} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'inherit' }} noWrap>
          {m.filename || 'Arquivo'}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.8, color: 'inherit', display: 'block' }}>
          {m.size ? fmtBytes(m.size) : ''}
        </Typography>
      </Box>
      <IconButton
        size="small"
        component="a"
        href={`${m.url}${m.url.includes('?') ? '&' : '?'}dl=1`}
        aria-label="Baixar"
        sx={{ color: 'inherit' }}
      >
        <IconDownload size={16} />
      </IconButton>
    </Stack>
  );
}
MediaBody.propTypes = { msg: PropTypes.object.isRequired };

const Bubble = memo(function Bubble({ msg, isGroup, first, last, onMenu, onQuote }) {
  const mine = Boolean(msg.user?.is_me);
  const deleted = msg.deleted || msg.type === 'deleted';
  if (msg.type === 'system') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 0.75 }}>
        <Typography
          variant="caption"
          sx={[
            dual({ bgcolor: 'rgba(0,0,0,.05)', color: 'text.secondary' }, { bgcolor: 'rgba(255,255,255,.08)', color: 'text.secondary' }),
            { px: 1.25, py: 0.4, borderRadius: 2, fontSize: 11.5, textAlign: 'center' }
          ]}
        >
          <strong>{mine ? 'Você' : msg.user?.name}</strong> {msg.body}
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', px: { xs: 1, md: 3 }, mt: first ? 1 : 0.25 }}>
      {!mine && isGroup ? (
        <Box sx={{ width: 36, mr: 1, flexShrink: 0 }}>{first ? <UserAvatar user={msg.user} size={32} /> : null}</Box>
      ) : null}
      <Box
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu(e.currentTarget, msg);
        }}
        sx={[
          mine
            ? { bgcolor: PRIMARY, color: '#fff' }
            : dual({ bgcolor: '#fff', color: 'text.primary' }, { bgcolor: '#1e293b', color: '#fff' }),
          {
            position: 'relative',
            maxWidth: 'min(72%, 560px)',
            minWidth: 0,
            px: 1.25,
            py: 0.75,
            borderRadius: 2.5,
            borderTopRightRadius: mine && !first ? 6 : 20,
            borderTopLeftRadius: !mine && !first ? 6 : 20,
            borderBottomRightRadius: mine && !last ? 6 : 20,
            borderBottomLeftRadius: !mine && !last ? 6 : 20,
            boxShadow: '0 1px 1px rgba(0,0,0,.06)',
            overflowWrap: 'anywhere',
            '&:hover .tm-menu': { opacity: 1 }
          }
        ]}
      >
        {!mine && isGroup && first ? (
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: colorOf(msg.user?.id), mb: 0.25 }}>
            {msg.user?.name}
          </Typography>
        ) : null}
        {msg.quoted && !deleted ? (
          <Box
            role="button"
            tabIndex={0}
            onClick={() => onQuote(msg.quoted.id)}
            sx={{
              borderLeft: '3px solid',
              borderLeftColor: mine ? 'rgba(255,255,255,.7)' : PRIMARY,
              bgcolor: mine ? 'rgba(255,255,255,.15)' : 'rgba(55,126,240,.08)',
              borderRadius: 1,
              px: 1,
              py: 0.5,
              mb: 0.6,
              cursor: 'pointer'
            }}
          >
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, fontSize: 11, color: 'inherit' }}>
              {msg.quoted.user_name}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, fontSize: 12, color: 'inherit' }} noWrap>
              <PreviewText preview={msg.quoted.preview} />
            </Typography>
          </Box>
        ) : null}
        {deleted ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ opacity: 0.7, pr: 5.5 }}>
            <IconTrash size={14} />
            <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'inherit' }}>
              Mensagem apagada
            </Typography>
          </Stack>
        ) : (
          <>
            <MediaBody msg={msg} />
            {msg.body ? (
              <Typography
                component="div"
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45, pr: 5.5, color: 'inherit' }}
              >
                {msg.body}
              </Typography>
            ) : null}
          </>
        )}
        <Typography variant="caption" sx={{ position: 'absolute', right: 10, bottom: 4, fontSize: 10.5, opacity: 0.8, color: 'inherit' }}>
          {msg.edited_at && !deleted ? 'editada · ' : ''}
          {fmtTime(msg.created_at)}
        </Typography>
        {!deleted ? (
          <IconButton
            size="small"
            className="tm-menu"
            onClick={(e) => onMenu(e.currentTarget, msg)}
            aria-label="Opções"
            sx={{
              position: 'absolute',
              top: 2,
              right: 2,
              opacity: 0,
              transition: 'opacity .12s',
              color: 'inherit',
              bgcolor: mine ? 'rgba(0,0,0,.15)' : 'rgba(0,0,0,.06)',
              p: 0.25
            }}
          >
            <IconDotsVertical size={14} />
          </IconButton>
        ) : null}
      </Box>
    </Box>
  );
});
Bubble.propTypes = {
  msg: PropTypes.object.isRequired,
  isGroup: PropTypes.bool,
  first: PropTypes.bool,
  last: PropTypes.bool,
  onMenu: PropTypes.func.isRequired,
  onQuote: PropTypes.func.isRequired
};

function DateSep({ label }) {
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
DateSep.propTypes = { label: PropTypes.string };

// ---------------------------------------------------------------- conversa (coluna direita)
const sortMsgs = (arr) => [...arr].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
const upsert = (prev, incoming) => {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, { ...(map.get(m.id) || {}), ...m, pending: false });
  return sortMsgs([...map.values()]);
};

export function TeamThread({ chat, me, team, isNarrow, onBack, onChatChanged, onLeft }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState(null);
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null); // {anchor, msg}
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [members, setMembers] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [del, setDel] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const sinceRef = useRef(null);
  const chatId = chat?.id;
  const isGroup = chat?.kind === 'group';
  const { patchChat } = team;

  // o Menu do MUI devolve o foco ao elemento âncora ao fechar; focar depois disso (e com o cursor no fim ao editar)
  const focusComposer = useCallback((caretAtEnd = false) => {
    window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (caretAtEnd) {
        const n = el.value?.length ?? 0;
        try {
          el.setSelectionRange(n, n);
        } catch {
          /* input sem seleção */
        }
      }
    }, 120);
  }, []);
  const scrollToEnd = useCallback((smooth = false) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  // rolagem presa ao fim: mídia carrega depois do fetch e empurra o conteúdo; enquanto o usuário
  // estiver no fim (ou acabou de abrir a conversa), acompanha o crescimento da lista
  const stickRef = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const onScroll = () => {
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    const ro = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight;
    });
    // observa cada bloco de mensagem (a lista em si não muda de tamanho quando o conteúdo cresce)
    Array.from(el.children).forEach((c) => ro.observe(c));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
    };
  }, [chatId, messages.length]);

  // carrega ao trocar de conversa
  useEffect(() => {
    if (!chatId) return undefined;
    let alive = true;
    setMessages([]);
    setReply(null);
    setEditing(null);
    setText('');
    setLoading(true);
    stickRef.current = true;
    get(`/team/chats/${enc(chatId)}/messages`, { params: { limit: PAGE } })
      .then((r) => {
        if (!alive) return;
        setMessages(sortMsgs(r.items || []));
        setHasMore(Boolean(r.has_more));
        sinceRef.current = r.server_time;
        window.requestAnimationFrame(() => scrollToEnd(false));
        post(`/team/chats/${enc(chatId)}/read`)
          .then(() => patchChat(chatId, { unread_count: 0 }))
          .catch(() => undefined);
      })
      .catch((e) => alive && toast.error(errMsg(e, 'Falha ao carregar a conversa.')))
      .finally(() => alive && setLoading(false));
    window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      alive = false;
    };
  }, [chatId, scrollToEnd, patchChat]);

  const loadOlder = async () => {
    if (!chatId || !messages.length || loading) return;
    const el = listRef.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    setLoading(true);
    try {
      const r = await get(`/team/chats/${enc(chatId)}/messages`, { params: { before: messages[0].created_at, limit: PAGE } });
      setMessages((prev) => upsert(prev, r.items || []));
      setHasMore(Boolean(r.has_more));
      window.requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - before;
      });
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  };

  // tempo real
  useRealtimeEvent('team:message', ({ chat_id: cid, message } = {}) => {
    if (cid !== chatId || !message) return;
    setMessages((prev) => upsert(prev, [message]));
    window.requestAnimationFrame(() => scrollToEnd(true));
    if (!message.user?.is_me && document.hasFocus())
      post(`/team/chats/${enc(chatId)}/read`)
        .then(() => patchChat(chatId, { unread_count: 0 }))
        .catch(() => undefined);
  });
  useRealtimeEvent('team:message_updated', ({ chat_id: cid, message } = {}) => {
    if (cid !== chatId || !message) return;
    setMessages((prev) => upsert(prev, [message]));
  });
  // reserva: polling leve (30 s) caso o socket caia
  useEffect(() => {
    if (!chatId) return undefined;
    const id = window.setInterval(async () => {
      if (document.visibilityState === 'hidden' || !sinceRef.current) return;
      try {
        const r = await get(`/team/chats/${enc(chatId)}/messages`, { params: { since: sinceRef.current } });
        if (r.items?.length) setMessages((prev) => upsert(prev, r.items));
        sinceRef.current = r.server_time;
      } catch {
        /* silencioso */
      }
    }, 30000);
    return () => window.clearInterval(id);
  }, [chatId]);

  const send = async () => {
    const body = text.trim();
    if (!chatId || sending || (!body && !editing)) return;
    if (editing) {
      if (!body) return;
      setSending(true);
      try {
        const m = await patch(`/team/messages/${enc(editing.id)}`, { text: body });
        setMessages((prev) => upsert(prev, [m]));
        setEditing(null);
        setText('');
      } catch (e) {
        toast.error(errMsg(e, 'Não foi possível editar.'));
      } finally {
        setSending(false);
      }
      return;
    }
    const tmpId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tmpId,
      chat_id: chatId,
      user: { id: me.id, name: me.name, is_me: true },
      type: 'text',
      body,
      quoted: reply ? { id: reply.id, user_name: reply.user?.name, preview: previewText(reply) } : null,
      created_at: new Date().toISOString(),
      pending: true
    };
    setMessages((prev) => sortMsgs([...prev, optimistic]));
    const replyWas = reply;
    setText('');
    setReply(null);
    window.requestAnimationFrame(() => scrollToEnd(true));
    setSending(true);
    try {
      const m = await post(`/team/chats/${enc(chatId)}/messages`, { text: body, quoted_id: replyWas?.id || undefined });
      setMessages((prev) =>
        upsert(
          prev.filter((x) => x.id !== tmpId),
          [m]
        )
      );
    } catch (e) {
      setMessages((prev) => prev.filter((x) => x.id !== tmpId));
      setText(body);
      setReply(replyWas);
      toast.error(errMsg(e, 'Não foi possível enviar.'));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const sendFile = async (file) => {
    if (!file || !chatId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const media = await post('/team/media', fd, { headers: { 'Content-Type': undefined } });
      if (!media?.id) throw new Error(media?.error || 'upload');
      const m = await post(`/team/chats/${enc(chatId)}/messages`, {
        media_id: media.id,
        text: text.trim() || undefined,
        quoted_id: reply?.id || undefined
      });
      setMessages((prev) => upsert(prev, [m]));
      setText('');
      setReply(null);
      window.requestAnimationFrame(() => scrollToEnd(true));
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível enviar o arquivo.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doDelete = async () => {
    const m = del;
    setDel(null);
    if (!m) return;
    try {
      const r = await remove(`/team/messages/${enc(m.id)}`);
      setMessages((prev) => upsert(prev, [r]));
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível apagar.'));
    }
  };

  const jumpTo = (id) => {
    const el = document.getElementById(`tm-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.animate([{ outline: `2px solid ${PRIMARY}` }, { outline: '2px solid transparent' }], { duration: 1200 });
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (e.key === 'Escape') {
      if (editing) {
        setEditing(null);
        setText('');
      } else setReply(null);
    }
  };

  const rendered = useMemo(() => {
    const out = [];
    let lastDay = null;
    messages.forEach((m, i) => {
      const day = startOfDay(m.created_at).getTime();
      if (day !== lastDay) {
        out.push(<DateSep key={`d-${day}`} label={dateLabel(m.created_at)} />);
        lastDay = day;
      }
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const same = (a, b) =>
        a &&
        b &&
        a.user?.id === b.user?.id &&
        a.type !== 'system' &&
        b.type !== 'system' &&
        Math.abs(new Date(a.created_at) - new Date(b.created_at)) < GROUP_GAP_MS &&
        startOfDay(a.created_at).getTime() === startOfDay(b.created_at).getTime();
      out.push(
        <Box key={m.id} id={`tm-${m.id}`} sx={{ opacity: m.pending ? 0.6 : 1 }}>
          <Bubble
            msg={m}
            isGroup={isGroup}
            first={!same(prev, m)}
            last={!same(m, next)}
            onMenu={(anchor, msg) => setMenu({ anchor, msg })}
            onQuote={jumpTo}
          />
        </Box>
      );
    });
    return out;
  }, [messages, isGroup]);

  if (!chat) {
    return (
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3 }}>
        <Stack alignItems="center" spacing={1.5} sx={{ textAlign: 'center', maxWidth: 420 }}>
          <Box
            sx={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
              boxShadow: '0 16px 36px rgba(55,126,240,.28)'
            }}
          >
            <IconUsers size={42} stroke={1.7} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }}>Chat da equipe</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Converse com as pessoas da sua organização e crie grupos por time. Nada aqui vai para os clientes.
          </Typography>
        </Stack>
      </Box>
    );
  }

  const menuMsg = menu?.msg;
  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      {/* cabeçalho */}
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{ px: 1.25, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', zIndex: 2 }}
      >
        {isNarrow ? (
          <IconButton size="small" onClick={onBack} sx={{ ml: -0.5 }}>
            <IconArrowLeft size={20} />
          </IconButton>
        ) : null}
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          onClick={() => setMembers(chat)}
          sx={{ flex: 1, minWidth: 0, cursor: 'pointer', borderRadius: 2, px: 0.5, py: 0.25, '&:hover': { bgcolor: 'action.hover' } }}
        >
          {isGroup ? <GroupAvatar size={42} /> : <UserAvatar user={chat.peer} size={42} online={Boolean(chat.peer?.online)} />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {chat.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
              {isGroup
                ? `${chat.members_count} membros · ${chat.members.filter((m) => m.online).length} online`
                : chat.peer?.online
                  ? 'Online'
                  : chat.peer?.email}
            </Typography>
          </Box>
        </Stack>
        <Tooltip title={isGroup ? 'Membros do grupo' : 'Dados'}>
          <IconButton onClick={() => setMembers(chat)} aria-label="Membros">
            <IconUsers size={20} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* mensagens */}
      <Box
        ref={listRef}
        sx={[
          dual({ bgcolor: '#f1f5f9' }, { bgcolor: '#0b141a' }),
          { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', py: 1.5, overscrollBehavior: 'contain', scrollbarWidth: 'thin' }
        ]}
      >
        {hasMore ? (
          <Box sx={{ textAlign: 'center', mb: 1 }}>
            <Button size="small" onClick={loadOlder} disabled={loading} sx={{ fontWeight: 700, textTransform: 'none', color: PRIMARY }}>
              {loading ? 'Carregando…' : 'Carregar mensagens anteriores'}
            </Button>
          </Box>
        ) : null}
        {loading && !messages.length ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={26} sx={{ color: PRIMARY }} />
          </Stack>
        ) : !messages.length ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 6 }}>
            Diga olá — esta conversa ainda está vazia.
          </Typography>
        ) : (
          rendered
        )}
      </Box>

      {/* composer */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', p: 1 }}>
        {reply || editing ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              mb: 0.75,
              px: 1,
              py: 0.5,
              borderRadius: 1.5,
              borderLeft: '3px solid',
              borderLeftColor: PRIMARY,
              bgcolor: (t) => `rgba(${t.vars.palette.primary.mainChannel} / 0.08)`
            }}
          >
            {editing ? <IconEdit size={16} /> : <IconArrowBackUp size={16} />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, display: 'block' }}>
                {editing ? 'Editando mensagem' : `Respondendo ${reply.user?.is_me ? 'você' : reply.user?.name}`}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                {previewText(editing || reply)}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => {
                setReply(null);
                setEditing(null);
                if (editing) setText('');
              }}
            >
              <IconX size={16} />
            </IconButton>
          </Stack>
        ) : null}
        <Stack direction="row" spacing={0.5} alignItems="flex-end">
          <Tooltip title="Emoji">
            <IconButton onClick={(e) => setEmojiAnchor(e.currentTarget)} aria-label="Emoji">
              <IconMoodSmile size={22} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Anexar arquivo">
            <span>
              <IconButton onClick={() => fileRef.current?.click()} disabled={uploading || Boolean(editing)} aria-label="Anexar">
                {uploading ? <CircularProgress size={18} /> : <IconPaperclip size={22} />}
              </IconButton>
            </span>
          </Tooltip>
          <input ref={fileRef} type="file" hidden onChange={(e) => sendFile(e.target.files?.[0])} />
          <TextField
            inputRef={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={editing ? 'Edite a mensagem' : 'Mensagem para a equipe'}
            multiline
            maxRows={6}
            fullWidth
            size="small"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'background.default' } }}
          />
          <Tooltip title={editing ? 'Salvar' : 'Enviar'}>
            <span>
              <IconButton
                onClick={send}
                disabled={sending || !text.trim()}
                aria-label="Enviar"
                sx={{
                  width: 44,
                  height: 44,
                  color: '#fff',
                  bgcolor: PRIMARY,
                  '&:hover': { bgcolor: PRIMARY_DARK },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' }
                }}
              >
                {editing ? <IconCheck size={20} /> : <IconSend size={20} />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      <EmojiPicker
        anchorEl={emojiAnchor}
        onClose={() => setEmojiAnchor(null)}
        onPick={(e) => {
          setText((t) => t + e);
          inputRef.current?.focus();
        }}
      />

      {/* menu da mensagem */}
      <Menu open={Boolean(menu)} anchorEl={menu?.anchor} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setReply(menuMsg);
            setEditing(null);
            setMenu(null);
            focusComposer();
          }}
        >
          <ListItemIcon>
            <IconArrowBackUp size={16} />
          </ListItemIcon>
          <ListItemText>Responder</ListItemText>
        </MenuItem>
        {menuMsg?.user?.is_me && menuMsg?.type === 'text' ? (
          <MenuItem
            onClick={() => {
              setEditing(menuMsg);
              setReply(null);
              setText(menuMsg.body || '');
              setMenu(null);
              focusComposer(true);
            }}
          >
            <ListItemIcon>
              <IconEdit size={16} />
            </ListItemIcon>
            <ListItemText>Editar</ListItemText>
          </MenuItem>
        ) : null}
        {menuMsg?.body ? (
          <MenuItem
            onClick={() => {
              navigator.clipboard
                ?.writeText(menuMsg.body)
                .then(() => toast.success('Copiado.'))
                .catch(() => undefined);
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <IconFileText size={16} />
            </ListItemIcon>
            <ListItemText>Copiar texto</ListItemText>
          </MenuItem>
        ) : null}
        {menuMsg?.user?.is_me || chat.my_role === 'admin' ? (
          <MenuItem
            onClick={() => {
              setDel(menuMsg);
              setMenu(null);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'error.main' }}>
              <IconTrash size={16} />
            </ListItemIcon>
            <ListItemText>Apagar</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>
      <TgConfirmDialog
        open={Boolean(del)}
        onClose={() => setDel(null)}
        onConfirm={doDelete}
        danger
        title="Apagar a mensagem?"
        message="Ela some para todos os participantes da conversa."
        confirmLabel="Apagar"
      />

      <MembersDrawer
        chat={members}
        users={team.users}
        me={me}
        onClose={() => setMembers(null)}
        onChanged={(c) => {
          if (c?.id) {
            setMembers(c);
            onChatChanged?.(c);
          }
          team.reload();
        }}
        onLeft={() => {
          setMembers(null);
          onLeft?.();
          team.reload();
        }}
      />
    </Box>
  );
}
TeamThread.propTypes = {
  chat: PropTypes.object,
  me: PropTypes.object.isRequired,
  team: PropTypes.object.isRequired,
  isNarrow: PropTypes.bool,
  onBack: PropTypes.func,
  onChatChanged: PropTypes.func,
  onLeft: PropTypes.func
};
