import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconAddressBook, IconMessagePlus, IconMessages, IconSearch, IconUsersGroup, IconX } from '@tabler/icons-react';

import { get, post } from 'api/api';
import { TgAvatar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WA_DARK, WA_GREEN, errMsg, fmtPhone, onlyDigits, tint } from './waShared';
import { WaNumberChip, WaNumberDot, WaNumberSelect, sessionLabel } from './waKit';

// ============================================================================
// WaChatPicker — seletor de conversas (contatos e grupos) reutilizável.
// Usado nos filtros personalizados do Chat, nos destinatários dos Agendamentos,
// no Funil e no público de teste do Bot.
//
//   value     : [{ chat_id, session_id, session, name, phone, kind, jid }]
//               (chat_id = uuid da conversa; ordem = ordem de seleção)
//   onChange  : (next) => void
//   connected : algum número conectado — necessário para abrir conversa de um
//               contato salvo que ainda não tem chat (POST /whatsapp/chats/open).
//   sessionId : (opcional) restringe às conversas DESTE número (GET ?session_id=).
//               Sem a prop e com mais de um número, o picker mostra um seletor
//               interno ("Todos os números" + um por número).
//   sessions  : (opcional) lista de números da org (useWaSessions().sessions).
//               Sem a prop, o picker busca GET /whatsapp/sessions uma vez.
//   listHeight, hideSelected: como antes.
//
// Fontes: GET /whatsapp/chats?q&kind&session_id&page_size=100  (aba Conversas)
//         GET /whatsapp/contacts?q&saved=1&page_size=50         (aba Contatos salvos)
// Em multi-número, um contato pode ter uma conversa por número (`chats[]`).
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
const isReady = (s) => Boolean(s && (s.connected || s.status === 'ready'));

// conversas de um contato (o back manda `chats:[{id|chat_id, session_id}]`)
const contactChats = (c) =>
  (Array.isArray(c?.chats) ? c.chats : [])
    .map((x) => ({ chat_id: x.chat_id || x.id, session_id: x.session_id || null, session: x.session || null }))
    .filter((x) => x.chat_id);

const SOURCES = [
  { id: 'chats', label: 'Conversas', icon: IconMessages },
  { id: 'contacts', label: 'Contatos salvos', icon: IconAddressBook }
];

// ----------------------------------------------------------------------------
// linha de item (chat ou contato)
// ----------------------------------------------------------------------------
function PickerRow({ name, secondary, kind, photoPath, checked, indeterminate, busy, disabled, onToggle, badge, session }) {
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
          indeterminate={Boolean(indeterminate) && !checked}
          tabIndex={-1}
          disabled={disabled}
          sx={{ p: 0.5, color: WA_DARK, '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: WA_GREEN } }}
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
      {session ? <WaNumberChip session={session} sx={{ flexShrink: 0 }} /> : null}
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
export default function WaChatPicker({
  value = [],
  onChange,
  connected = true,
  listHeight = 300,
  hideSelected = false,
  sessionId,
  initialSessionId,
  sessions: sessionsProp
}) {
  const [source, setSource] = useState('chats');
  const [q, setQ] = useState('');
  const [groupsOnly, setGroupsOnly] = useState(false);
  const [chats, setChats] = useState({ items: [], loading: true });
  const [contacts, setContacts] = useState({ items: [], loading: false, loaded: false });
  const [opening, setOpening] = useState(null); // contact.id sendo aberto
  const [menu, setMenu] = useState(null); // { anchor, contact, options:[{ chat_id?, session, openWith? }] }
  const seqRef = useRef(0);

  // ---------------- números da organização ----------------
  const [fetchedSessions, setFetchedSessions] = useState(null);
  useEffect(() => {
    if (sessionsProp) return undefined;
    let on = true;
    get('/whatsapp/sessions')
      .then((r) => on && setFetchedSessions(Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : []))
      .catch(() => on && setFetchedSessions([]));
    return () => {
      on = false;
    };
  }, [sessionsProp]);
  const sessions = useMemo(() => sessionsProp || fetchedSessions || [], [sessionsProp, fetchedSessions]);
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const many = sessions.length > 1;
  const controlled = sessionId !== undefined && sessionId !== null;
  // número inicial do seletor interno (ex.: o filtro de número da tela que abriu o picker); o usuário pode trocar
  const [innerSession, setInnerSession] = useState(initialSessionId ? String(initialSessionId) : '');
  const effSession = controlled ? String(sessionId || '') : innerSession && byId.has(innerSession) ? innerSession : '';
  const sessionOf = useCallback((id, fallback) => (id && byId.get(id)) || fallback || null, [byId]);
  const readySessions = useMemo(() => sessions.filter(isReady), [sessions]);
  // "conectado" para abrir conversa: o número escolhido (se houver) ou algum da org
  const canOpen = effSession
    ? isReady(byId.get(effSession)) || (!byId.size && connected)
    : readySessions.length > 0 || (!sessions.length && connected);

  // selecionado por uuid da conversa OU por jid (lista de teste do bot guarda o contato, não a conversa)
  const selectedIds = useMemo(() => new Set((value || []).flatMap((v) => [v.chat_id, v.jid].filter(Boolean))), [value]);
  const isSelected = useCallback((entry) => selectedIds.has(entry.chat_id) || (entry.jid && selectedIds.has(entry.jid)), [selectedIds]);

  // ---------------- carga (debounce na busca) ----------------
  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    const term = q.trim() || undefined;
    if (source === 'chats') {
      setChats((p) => ({ ...p, loading: true }));
      try {
        const r = await get('/whatsapp/chats', {
          params: { q: term, kind: groupsOnly ? 'group' : 'all', page_size: 100, session_id: effSession || undefined }
        });
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
  }, [q, source, groupsOnly, effSession]);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const entryFromChat = useCallback(
    (c) => ({
      chat_id: c.chat_id,
      jid: c.jid || null,
      session_id: c.session_id || null,
      session: sessionOf(c.session_id, c.session),
      name: chatDisplayName(c),
      kind: c.kind || 'individual',
      phone: c.phone || null
    }),
    [sessionOf]
  );

  // enriquece a seleção (ids vindos do servidor sem nome/número) quando a lista chega
  useEffect(() => {
    if (!value?.length || !chats.items.length) return;
    let changed = false;
    const next = value.map((v) => {
      if (v.name && (v.session || !v.session_id || !byId.size)) return v;
      const c = chats.items.find((x) => x.chat_id === v.chat_id) || (v.jid ? chats.items.find((x) => x.jid === v.jid) : null);
      if (!c && v.name) {
        const s = sessionOf(v.session_id);
        if (!s) return v;
        changed = true;
        return { ...v, session: s };
      }
      if (!c) return v;
      changed = true;
      return { ...v, ...entryFromChat(c) };
    });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats.items, byId]);

  const toggle = (entry) => {
    if (isSelected(entry))
      onChange((value || []).filter((v) => v.chat_id !== entry.chat_id && !(entry.jid && v.jid === entry.jid) && v.chat_id !== entry.jid));
    else onChange([...(value || []), entry]);
  };
  const removeOne = (chatId) => onChange((value || []).filter((v) => v.chat_id !== chatId));
  const clearAll = () => onChange([]);

  const toggleChat = (c) => toggle(entryFromChat(c));

  const contactEntry = (c, chat) => ({
    chat_id: chat.chat_id,
    jid: c.wa_id || null,
    session_id: chat.session_id || null,
    session: sessionOf(chat.session_id, chat.session),
    name: c.display_name || c.name || c.push_name || fmtPhone(c.phone),
    kind: 'individual',
    phone: c.phone || null
  });

  // abre (ou cria) a conversa do contato por um número e seleciona
  const openContact = async (c, withSession) => {
    const s = withSession ? byId.get(withSession) : null;
    if (withSession && byId.size && !isReady(s)) {
      toast.error(`${sessionLabel(s)} não está conectado.`);
      return;
    }
    if (!withSession && !canOpen) {
      toast.error('Conecte um número do WhatsApp para adicionar um contato que ainda não tem conversa.');
      return;
    }
    setOpening(c.id);
    try {
      const chat = await post('/whatsapp/chats/open', { phone: onlyDigits(c.phone), ...(withSession ? { session_id: withSession } : {}) });
      const chatId = chat?.chat_id;
      if (!chatId) throw new Error('Não foi possível abrir a conversa.');
      const opened = { chat_id: chatId, session_id: chat.session_id || withSession || null, session: chat.session || null };
      setContacts((p) => ({
        ...p,
        items: p.items.map((x) =>
          x.id === c.id
            ? { ...x, chat_id: x.chat_id || chatId, chats: [...contactChats(x).filter((y) => y.chat_id !== chatId), opened] }
            : x
        )
      }));
      if (!selectedIds.has(chatId)) onChange([...(value || []), contactEntry(c, opened)]);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível abrir a conversa deste contato.'));
    } finally {
      setOpening(null);
    }
  };

  // contato salvo: uma conversa por número → escolhe pelo número filtrado, senão pergunta
  const toggleContact = (c, ev) => {
    const list = contactChats(c);
    if (effSession) {
      const own = list.find((x) => x.session_id === effSession);
      if (own) toggle(contactEntry(c, own));
      else openContact(c, effSession);
      return;
    }
    if (list.length === 1) {
      toggle(contactEntry(c, list[0]));
      return;
    }
    if (list.length === 0) {
      if (readySessions.length > 1) {
        setMenu({ anchor: ev?.currentTarget || null, contact: c, options: readySessions.map((s) => ({ session: s, openWith: s.id })) });
        return;
      }
      openContact(c, readySessions[0]?.id || undefined);
      return;
    }
    // várias conversas (uma por número)
    const options = list.map((x) => ({ chat_id: x.chat_id, session: sessionOf(x.session_id, x.session) }));
    for (const s of readySessions) if (!list.some((x) => x.session_id === s.id)) options.push({ session: s, openWith: s.id });
    setMenu({ anchor: ev?.currentTarget || null, contact: c, options });
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
              {value.map((v) => {
                const s = many ? sessionOf(v.session_id, v.session) : null;
                const label = v.name || (v.phone ? fmtPhone(v.phone) : v.chat_id);
                return (
                  <Tooltip key={v.chat_id} title={s ? `${label} · ${sessionLabel(s)}` : ''}>
                    <Chip
                      size="small"
                      label={label}
                      icon={
                        v.kind === 'group' ? (
                          <IconUsersGroup size={13} />
                        ) : s ? (
                          <WaNumberDot session={s} size={8} sx={{ ml: 0.75 }} />
                        ) : undefined
                      }
                      onDelete={() => removeOne(v.chat_id)}
                      sx={{
                        fontWeight: 600,
                        borderRadius: 1.5,
                        maxWidth: 220,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: s ? `${s.color || WA_GREEN}66` : 'divider'
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Stack>
          ) : null}
        </Box>
      ) : null}

      {/* ---------- número (quando a tela não fixa um) ---------- */}
      {!controlled && many ? (
        <WaNumberSelect
          sessions={sessions}
          value={effSession}
          onChange={(v) => setInnerSession(v || '')}
          allowAll
          label="Número"
          size="small"
          fullWidth={false}
          sx={{ minWidth: 220, maxWidth: 320, '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
        />
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
                    ? effSession
                      ? 'Nenhum grupo neste número.'
                      : 'Nenhum grupo por aqui.'
                    : effSession
                      ? 'Nenhuma conversa neste número ainda.'
                      : 'Nenhuma conversa ainda.'
                  : 'Nenhum contato salvo. Salve contatos na aba Contatos.'}
            </Typography>
          </Box>
        ) : source === 'chats' ? (
          items.map((c) => (
            <PickerRow
              key={c.chat_id}
              name={chatDisplayName(c)}
              secondary={
                c.kind === 'group' ? `${c.group_meta?.participants_count ?? '—'} participantes` : fmtPhone(c.phone) || c.jid || c.chat_id
              }
              kind={kindOf(c)}
              photoPath={chatPhotoPath(c)}
              checked={isSelected(c)}
              onToggle={() => toggleChat(c)}
              badge={KIND_LABEL[c.kind] || null}
              session={many ? sessionOf(c.session_id, c.session) : null}
            />
          ))
        ) : (
          items.map((c) => {
            const name = c.display_name || c.name || c.push_name || fmtPhone(c.phone);
            const list = contactChats(c);
            const inSession = effSession ? list.find((x) => x.session_id === effSession) : null;
            const noChat = effSession ? !inSession : list.length === 0;
            const picked = list.filter((x) => isSelected(x));
            const checked = effSession ? Boolean(inSession && isSelected(inSession)) : picked.length > 0 && picked.length === list.length;
            const partial = !effSession && picked.length > 0 && picked.length < list.length;
            const rowSession = many
              ? effSession
                ? byId.get(effSession)
                : list.length === 1
                  ? sessionOf(list[0].session_id, list[0].session)
                  : null
              : null;
            const disabled = noChat && !canOpen;
            return (
              <Tooltip
                key={c.id}
                title={
                  noChat
                    ? canOpen
                      ? 'Ainda sem conversa — será aberta ao selecionar.'
                      : 'Sem conversa. Conecte o WhatsApp para abrir.'
                    : !effSession && list.length > 1
                      ? `Conversa em ${list.length} números — clique para escolher.`
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
                    checked={checked}
                    indeterminate={partial}
                    busy={opening === c.id}
                    disabled={disabled}
                    onToggle={(ev) => toggleContact(c, ev)}
                    badge={noChat ? 'sem conversa' : !effSession && list.length > 1 && many ? `${list.length} números` : null}
                    session={rowSession}
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

      {/* ---------- escolha do número (contato com conversa em vários números) ---------- */}
      <Menu
        anchorEl={menu?.anchor}
        open={Boolean(menu?.anchor)}
        onClose={() => setMenu(null)}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 240 } } }}
      >
        {menu ? (
          <Typography variant="caption" sx={{ px: 2, pt: 0.5, pb: 0.75, display: 'block', color: 'text.secondary', fontWeight: 700 }}>
            {menu.contact.display_name || menu.contact.name || fmtPhone(menu.contact.phone)} — por qual número?
          </Typography>
        ) : null}
        {(menu?.options || []).map((o) => {
          const sel = o.chat_id ? isSelected(o) : false;
          return (
            <MenuItem
              key={o.chat_id || `open-${o.openWith}`}
              onClick={() => {
                const c = menu.contact;
                setMenu(null);
                if (o.chat_id) toggle(contactEntry(c, { chat_id: o.chat_id, session_id: o.session?.id || null, session: o.session }));
                else openContact(c, o.openWith);
              }}
              sx={{ gap: 1.25, fontSize: 14 }}
            >
              {o.chat_id ? (
                <Checkbox size="small" checked={sel} tabIndex={-1} sx={{ p: 0, color: WA_DARK, '&.Mui-checked': { color: WA_GREEN } }} />
              ) : (
                <IconMessagePlus size={16} style={{ opacity: 0.7 }} />
              )}
              <WaNumberChip session={o.session} />
              <ListItemText
                primary={o.chat_id ? 'conversa existente' : 'abrir conversa nova'}
                slotProps={{ primary: { sx: { fontSize: 12.5, color: 'text.secondary' } } }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </Stack>
  );
}
