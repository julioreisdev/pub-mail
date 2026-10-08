import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconAddressBook, IconCheck, IconCopy, IconMessages, IconPencil, IconUserDollar, IconX } from '@tabler/icons-react';

import { get, patch, post } from 'api/api';
import { TgAvatar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WA_DARK, fmtPhone, WaNumberChip } from '../waShared';

// ----------------------------------------------------------------------------
// Detalhes de uma pessoa (clique na foto na DM, no nome dentro do grupo, na menção @ ou na lista de participantes).
// target = { jid, name?, chat_id? } → GET /whatsapp/contacts/lookup. "Conversar" abre/cria a DM.
// ----------------------------------------------------------------------------
export default function ContactInfoDrawer({ target, onClose, onOpenChat, onOpenCustomer, onRenamed }) {
  const [state, setState] = useState({ loading: true, info: null, error: null });
  const [opening, setOpening] = useState(false);
  // renomear: lápis ao lado do nome → campo inline (Enter salva, Esc cancela)
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const open = Boolean(target);

  useEffect(() => {
    if (!target?.jid) return undefined;
    let alive = true;
    setEditing(false);
    setState({ loading: true, info: null, error: null });
    const params = new URLSearchParams({ jid: target.jid });
    if (target.chat_id) params.set('chat_id', target.chat_id);
    if (target.session_id) params.set('session_id', target.session_id);
    get(`/whatsapp/contacts/lookup?${params.toString()}`)
      .then((info) => alive && setState({ loading: false, info, error: null }))
      .catch(
        (e) =>
          alive && setState({ loading: false, info: null, error: e?.response?.data?.message || 'Não foi possível carregar o contato.' })
      );
    return () => {
      alive = false;
    };
  }, [target?.jid, target?.chat_id, target?.session_id]);

  const info = state.info;
  const name = info?.name || target?.name || (info?.phone ? fmtPhone(info.phone) : '') || 'Contato';
  const phone = info?.phone ? fmtPhone(info.phone) : '';

  const copy = async (v) => {
    try {
      await navigator.clipboard.writeText(v);
      toast.success('Copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const canRename = Boolean(info?.contact?.id) && !info?.is_me;
  const startEdit = () => {
    setDraft(info?.contact?.name || info?.name || '');
    setEditing(true);
  };
  const saveName = async () => {
    const v = draft.trim();
    if (!v) return toast.error('Informe um nome.');
    if (saving) return undefined;
    setSaving(true);
    try {
      const r = await patch(`/whatsapp/contacts/${info.contact.id}`, { name: v });
      const nm = r?.name || v;
      setState((st) => (st.info ? { ...st, info: { ...st.info, name: nm, contact: { ...st.info.contact, name: nm } } } : st));
      setEditing(false);
      toast.success('Nome atualizado.');
      onRenamed?.({ name: nm, contact_id: info.contact.id, chats: r?.renamed_chats || [] });
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Não foi possível renomear.');
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const openChat = async () => {
    if (!info) return;
    setOpening(true);
    try {
      let chat = info.chat?.chat_id
        ? {
            chat_id: info.chat.chat_id,
            kind: 'individual',
            name: info.chat.name || name,
            phone: info.phone,
            session_id: info.chat.session_id
          }
        : null;
      if (!chat) {
        if (!info.phone) throw new Error('sem telefone');
        // abre no número de onde veio o clique (grupo/menção); sem ele, o back usa o primeiro conectado
        const r = await post('/whatsapp/chats/open', { phone: info.phone, session_id: target?.session_id || undefined });
        chat = r?.chat_id ? r : r?.chat?.chat_id ? r.chat : null;
      }
      if (!chat) throw new Error('sem conversa');
      onOpenChat?.(chat);
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Não foi possível abrir a conversa.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 360 } } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 800, fontSize: 17, flex: 1 }}>Dados do contato</Typography>
        <IconButton size="small" onClick={onClose}>
          <IconX size={18} />
        </IconButton>
      </Stack>
      {state.loading ? (
        <Box sx={{ p: 2 }}>
          <TgListSkeleton rows={3} />
        </Box>
      ) : state.error ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', p: 3 }}>
          {state.error}
        </Typography>
      ) : info ? (
        <Box sx={{ overflowY: 'auto' }}>
          <Stack alignItems="center" spacing={1} sx={{ p: 3, textAlign: 'center' }}>
            <TgAvatar name={name} photoPath={info.photo_path} size={96} kind="contact" />
            {editing ? (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: '100%' }}>
                <TextField
                  size="small"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                  fullWidth
                  placeholder="Nome do contato"
                  inputProps={{ maxLength: 255 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveName();
                    }
                    if (e.key === 'Escape') setEditing(false);
                  }}
                />
                <Tooltip title="Salvar">
                  <span>
                    <IconButton size="small" onClick={saveName} disabled={saving} sx={{ color: WA_DARK }}>
                      <IconCheck size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Cancelar">
                  <span>
                    <IconButton size="small" onClick={() => setEditing(false)} disabled={saving}>
                      <IconX size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            ) : (
              <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="center" sx={{ maxWidth: '100%' }}>
                <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                  {info.is_me ? 'Você' : name}
                </Typography>
                {canRename ? (
                  <Tooltip title="Renomear contato">
                    <IconButton size="small" onClick={startEdit} aria-label="Renomear contato">
                      <IconPencil size={15} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>
            )}
            {phone ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {phone}
                </Typography>
                <Tooltip title="Copiar número">
                  <IconButton size="small" onClick={() => copy(`+${info.phone}`)}>
                    <IconCopy size={14} />
                  </IconButton>
                </Tooltip>
              </Stack>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Número não disponível (id de privacidade do WhatsApp)
              </Typography>
            )}
            <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="center" useFlexGap>
              {info.contact?.is_my_contact ? (
                <Chip size="small" icon={<IconAddressBook size={13} />} label="Na agenda" sx={{ height: 22 }} />
              ) : null}
              {info.contact?.saved ? <Chip size="small" label="Salvo na organização" sx={{ height: 22 }} /> : null}
              {info.customer ? (
                <Chip
                  size="small"
                  color="success"
                  icon={<IconUserDollar size={13} />}
                  label="Cliente"
                  sx={{ height: 22, fontWeight: 700 }}
                />
              ) : null}
              {info.contact?.opted_out_at ? <Chip size="small" color="warning" label="Descadastrado" sx={{ height: 22 }} /> : null}
            </Stack>
            {Array.isArray(info.contact?.tags) && info.contact.tags.length ? (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="center" useFlexGap sx={{ mt: 0.5 }}>
                {info.contact.tags.map((t) => (
                  <Chip key={t} size="small" variant="outlined" label={t} sx={{ height: 22 }} />
                ))}
              </Stack>
            ) : null}
          </Stack>
          <Divider />
          <Stack spacing={1} sx={{ p: 2 }}>
            {!info.is_me ? (
              <Button
                variant="contained"
                disableElevation
                startIcon={<IconMessages size={16} />}
                onClick={openChat}
                disabled={opening || (!info.chat && !info.phone)}
                sx={{ bgcolor: WA_DARK, fontWeight: 700, '&:hover': { bgcolor: WA_DARK } }}
              >
                {info.chat ? 'Abrir conversa' : 'Conversar'}
              </Button>
            ) : null}
            {info.customer && onOpenCustomer ? (
              <Button
                variant="outlined"
                startIcon={<IconUserDollar size={16} />}
                onClick={() => onOpenCustomer(info.customer)}
                sx={{ fontWeight: 700 }}
              >
                Ver cliente
              </Button>
            ) : null}
            {info.contact?.name && info.contact?.push_name && info.contact.name !== info.contact.push_name ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                No WhatsApp se apresenta como “{info.contact.push_name}”
              </Typography>
            ) : null}
            {Array.isArray(info.chats) && info.chats.length > 1 ? (
              <Stack spacing={0.5} sx={{ pt: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                  Conversas em {info.chats.length} números
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="center" useFlexGap>
                  {info.chats.map((c) => (
                    <WaNumberChip
                      key={c.chat_id}
                      session={c.session}
                      showPhone
                      onClick={() => {
                        onOpenChat?.({
                          chat_id: c.chat_id,
                          kind: 'individual',
                          name: c.name || name,
                          phone: info.phone,
                          session_id: c.session_id
                        });
                        onClose?.();
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            ) : null}
            {info.chat?.last_message_at ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                Última mensagem na conversa:{' '}
                {new Date(info.chat.last_message_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </Typography>
            ) : null}
          </Stack>
        </Box>
      ) : null}
    </Drawer>
  );
}
