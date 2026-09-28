import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconAddressBook, IconMessages, IconSearch, IconUsersGroup, IconX } from '@tabler/icons-react';

import { get, post } from 'api/api';
import { TgAvatar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WA_DARK, WA_GREEN, errMsg, fmtPhone, onlyDigits, tint } from './waShared';

// ============================================================================
// WaChatPicker — seletor de conversas (contatos e grupos) reutilizável.
// Usado nos filtros personalizados do Chat e nos destinatários dos Agendamentos.
//
//   value    : [{ chat_id, name?, kind?, phone? }]   (ordem = ordem de seleção)
//   onChange : (next) => void
//   connected: sessão conectada — necessária para abrir conversa de um contato
//              salvo que ainda não tem chat (POST /whatsapp/chats/open).
//
// Fontes: GET /whatsapp/chats?q&kind&page_size=100  (aba Conversas)
//         GET /whatsapp/contacts?q&saved=1&page_size=50 (aba Contatos salvos)
// ============================================================================

const enc = (v) => encodeURIComponent(String(v));
const kindOf = (c) => (c?.kind === 'group' ? 'group' : c?.kind === 'channel' || c?.kind === 'broadcast' ? 'channel' : 'contact');
const KIND_LABEL = { group: 'Grupo', channel: 'Canal', broadcast: 'Lista', individual: 'Contato' };

export const chatDisplayName = (c) =>
  (c?.kind === 'individual' && c?.name === 'Contato sem nome' && c?.phone ? fmtPhone(c.phone) : c?.name) ||
  (c?.phone ? fmtPhone(c.phone) : '') ||
  c?.chat_id ||
  '—';

const chatPhotoPath = (c) => (c?.chat_id ? `/whatsapp/chats/${enc(c.chat_id)}/photo` : undefined);

const SOURCES = [
  { id: 'chats', label: 'Conversas', icon: IconMessages },
  { id: 'contacts', label: 'Contatos salvos', icon: IconAddressBook }
];

// ----------------------------------------------------------------------------
// linha de item (chat ou contato)
// ----------------------------------------------------------------------------
function PickerRow({ name, secondary, kind, photoPath, checked, busy, disabled, onToggle, badge }) {
  const isGroup = kind === 'group';
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      onClick={disabled || busy ? undefined : onToggle}
      sx={{
        px: 0.75,
        py: 0.6,
        borderRadius: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'background-color .12s ease',
        bgcolor: checked ? (t) => tint(t, 'success', 0.12) : 'transparent',
        '&:hover': { bgcolor: checked ? (t) => tint(t, 'success', 0.16) : 'action.hover' }
      }}
    >
      {busy ? (
        <Box sx={{ width: 34, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={16} sx={{ color: WA_DARK }} />
        </Box>
      ) : (
        <Checkbox
          size="small"
          checked={checked}
          tabIndex={-1}
          disabled={disabled}
          sx={{ p: 0.5, color: WA_DARK, '&.Mui-checked': { color: WA_GREEN } }}
        />
      )}
      <TgAvatar name={name} photoPath={photoPath} size={34} kind={kind} icon={isGroup ? IconUsersGroup : undefined} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
          {secondary}
        </Typography>
      </Box>
      {badge ? (
        <Chip
          size="small"
          label={badge}
          variant="outlined"
          sx={{ height: 20, fontSize: 10.5, borderRadius: 1, fontWeight: 700, flexShrink: 0, color: 'text.secondary' }}
        />
      ) : null}
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// componente principal
// ----------------------------------------------------------------------------
export default function WaChatPicker({ value = [], onChange, connected = true, listHeight = 300, hideSelected = false }) {
  const [source, setSource] = useState('chats');
  const [q, setQ] = useState('');
  const [groupsOnly, setGroupsOnly] = useState(false);
  const [chats, setChats] = useState({ items: [], loading: true });
  const [contacts, setContacts] = useState({ items: [], loading: false, loaded: false });
  const [opening, setOpening] = useState(null); // contact.id sendo aberto
  const seqRef = useRef(0);

  const selectedIds = useMemo(() => new Set((value || []).map((v) => v.chat_id)), [value]);

  // ---------------- carga (debounce na busca) ----------------
  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    const term = q.trim() || undefined;
    if (source === 'chats') {
      setChats((p) => ({ ...p, loading: true }));
      try {
        const r = await get('/whatsapp/chats', { params: { q: term, kind: groupsOnly ? 'group' : 'all', page_size: 100 } });
        if (seq !== seqRef.current) return;
        setChats({ items: Array.isArray(r) ? r : r?.items || [], loading: false });
      } catch (e) {
        if (seq !== seqRef.current) return;
        setChats((p) => ({ ...p, loading: false }));
        toast.error(errMsg(e, 'Falha ao carregar conversas.'));
      }
    } else {
      setContacts((p) => ({ ...p, loading: true }));
      try {
        const r = await get('/whatsapp/contacts', { params: { q: term, saved: 1, page_size: 50 } });
        if (seq !== seqRef.current) return;
        setContacts({ items: Array.isArray(r) ? r : r?.items || [], loading: false, loaded: true });
      } catch (e) {
        if (seq !== seqRef.current) return;
        setContacts((p) => ({ ...p, loading: false, loaded: true }));
        toast.error(errMsg(e, 'Falha ao carregar contatos.'));
      }
    }
  }, [q, source, groupsOnly]);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  // enriquece a seleção (ids vindos do servidor sem nome) quando a lista chega
  useEffect(() => {
    if (!value?.length || !chats.items.length) return;
    let changed = false;
    const next = value.map((v) => {
      if (v.name) return v;
      const c = chats.items.find((x) => x.chat_id === v.chat_id);
      if (!c) return v;
      changed = true;
      return { chat_id: c.chat_id, name: chatDisplayName(c), kind: c.kind || 'individual', phone: c.phone };
    });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats.items]);

  const toggle = (entry) => {
    if (selectedIds.has(entry.chat_id)) onChange((value || []).filter((v) => v.chat_id !== entry.chat_id));
    else onChange([...(value || []), entry]);
  };
  const removeOne = (chatId) => onChange((value || []).filter((v) => v.chat_id !== chatId));
  const clearAll = () => onChange([]);

  const toggleChat = (c) => toggle({ chat_id: c.chat_id, name: chatDisplayName(c), kind: c.kind || 'individual', phone: c.phone });

  // contato salvo: pode não ter conversa ainda → abre (precisa de sessão)
  const toggleContact = async (c) => {
    const name = c.display_name || c.name || c.push_name || fmtPhone(c.phone);
    if (c.chat_id) {
      toggle({ chat_id: c.chat_id, name, kind: 'individual', phone: c.phone });
      return;
    }
    if (!connected) {
      toast.error('Conecte o WhatsApp para adicionar um contato que ainda não tem conversa.');
      return;
    }
    setOpening(c.id);
    try {
      const chat = await post('/whatsapp/chats/open', { phone: onlyDigits(c.phone) });
      const chatId = chat?.chat_id;
      if (!chatId) throw new Error('Não foi possível abrir a conversa.');
      setContacts((p) => ({ ...p, items: p.items.map((x) => (x.id === c.id ? { ...x, chat_id: chatId } : x)) }));
      if (!selectedIds.has(chatId)) onChange([...(value || []), { chat_id: chatId, name, kind: 'individual', phone: c.phone }]);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível abrir a conversa deste contato.'));
    } finally {
      setOpening(null);
    }
  };

  const loading = source === 'chats' ? chats.loading : contacts.loading;
  const items = source === 'chats' ? chats.items : contacts.items;
  const total = value?.length || 0;

  return (
    <Stack spacing={1.25}>
      {/* ---------- selecionados ---------- */}
      {!hideSelected ? (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: total ? (t) => `rgba(${t.vars.palette.success.mainChannel} / 0.5)` : 'divider',
            borderRadius: 2,
            p: 1,
            minHeight: 52,
            bgcolor: total ? (t) => tint(t, 'success', 0.05) : 'transparent'
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: total ? 0.75 : 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: total ? WA_DARK : 'text.secondary' }}>
              {total ? `${total} ${total === 1 ? 'selecionado' : 'selecionados'}` : 'Nenhum selecionado ainda'}
            </Typography>
            {total ? (
              <Typography
                variant="caption"
                onClick={clearAll}
                sx={{ color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'error.main' } }}
              >
                limpar
              </Typography>
            ) : null}
          </Stack>
          {total ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {value.map((v) => (
                <Chip
                  key={v.chat_id}
                  size="small"
                  label={v.name || (v.phone ? fmtPhone(v.phone) : v.chat_id)}
                  icon={v.kind === 'group' ? <IconUsersGroup size={13} /> : undefined}
                  onDelete={() => removeOne(v.chat_id)}
                  sx={{
                    fontWeight: 600,
                    borderRadius: 1.5,
                    maxWidth: 220,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                />
              ))}
            </Stack>
          ) : null}
        </Box>
      ) : null}

      {/* ---------- fonte + busca ---------- */}
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
        {SOURCES.map((s) => {
          const on = source === s.id;
          const I = s.icon;
          return (
            <Chip
              key={s.id}
              size="small"
              icon={<I size={14} />}
              label={s.label}
              onClick={() => setSource(s.id)}
              sx={{
                fontWeight: 700,
                borderRadius: 4,
                bgcolor: on ? (t) => tint(t, 'success', 0.18) : 'action.hover',
                color: on ? WA_DARK : 'text.secondary',
                '& .MuiChip-icon': { color: 'inherit' },
                '&:hover': { bgcolor: on ? (t) => tint(t, 'success', 0.24) : 'action.selected' }
              }}
            />
          );
        })}
        {source === 'chats' ? (
          <Chip
            size="small"
            icon={<IconUsersGroup size={14} />}
            label="Só grupos"
            variant={groupsOnly ? 'filled' : 'outlined'}
            onClick={() => setGroupsOnly((v) => !v)}
            sx={{
              ml: 'auto',
              fontWeight: 700,
              borderRadius: 4,
              color: groupsOnly ? WA_DARK : 'text.secondary',
              bgcolor: groupsOnly ? (t) => tint(t, 'success', 0.18) : 'transparent',
              '& .MuiChip-icon': { color: 'inherit' }
            }}
          />
        ) : null}
      </Stack>
      <TextField
        fullWidth
        size="small"
        autoFocus
        placeholder={source === 'chats' ? 'Buscar conversa por nome ou número' : 'Buscar contato salvo'}
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

      {/* ---------- lista ---------- */}
      <Box
        sx={{
          height: listHeight,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 0.5
        }}
      >
        {loading && items.length === 0 ? (
          <Box sx={{ p: 1 }}>
            <TgListSkeleton rows={5} />
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {q
                ? 'Nada encontrado com essa busca.'
                : source === 'chats'
                  ? groupsOnly
                    ? 'Nenhum grupo por aqui.'
                    : 'Nenhuma conversa ainda.'
                  : 'Nenhum contato salvo. Salve contatos na aba Contatos.'}
            </Typography>
          </Box>
        ) : source === 'chats' ? (
          items.map((c) => (
            <PickerRow
              key={c.chat_id}
              name={chatDisplayName(c)}
              secondary={c.kind === 'group' ? `${c.group_meta?.participants_count ?? '—'} participantes` : fmtPhone(c.phone) || c.chat_id}
              kind={kindOf(c)}
              photoPath={chatPhotoPath(c)}
              checked={selectedIds.has(c.chat_id)}
              onToggle={() => toggleChat(c)}
              badge={KIND_LABEL[c.kind] || null}
            />
          ))
        ) : (
          items.map((c) => {
            const name = c.display_name || c.name || c.push_name || fmtPhone(c.phone);
            const noChat = !c.chat_id;
            return (
              <Tooltip
                key={c.id}
                title={
                  noChat
                    ? connected
                      ? 'Ainda sem conversa — será aberta ao selecionar.'
                      : 'Sem conversa. Conecte o WhatsApp para abrir.'
                    : ''
                }
                placement="left"
              >
                <Box>
                  <PickerRow
                    name={name}
                    secondary={fmtPhone(c.phone)}
                    kind="contact"
                    photoPath={c.id ? `/whatsapp/contacts/${enc(c.id)}/photo` : undefined}
                    checked={Boolean(c.chat_id) && selectedIds.has(c.chat_id)}
                    busy={opening === c.id}
                    disabled={noChat && !connected}
                    onToggle={() => toggleContact(c)}
                    badge={noChat ? 'sem conversa' : null}
                  />
                </Box>
              </Tooltip>
            );
          })
        )}
      </Box>
      {source === 'chats' && items.length >= 100 ? (
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          Mostrando as 100 primeiras conversas — use a busca para encontrar outras.
        </Typography>
      ) : null}
    </Stack>
  );
}
