import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconCheck, IconExternalLink, IconNotes, IconPencil, IconPin, IconPinnedOff, IconPlus, IconTrash } from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgConfirmDialog, TgListSkeleton } from 'views/pages/telegram/ui';
import { fmtDateBRT, relTime, useNow } from '../waKit';
import { errMsg, fmtAgo, tint } from '../waShared';
import TaskDialog from '../crm/TaskDialog';
import { MoneyField, formatBRL, waPrimaryBtn } from '../crm/crmKit';

// ============================================================================
// Abas "Funil", "Tarefas" e "Notas" do painel lateral da conversa (CustomerPanel).
// ============================================================================

const Title = ({ children, action }) => (
  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
    <Typography
      variant="caption"
      sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}
    >
      {children}
    </Typography>
    {action}
  </Stack>
);

// ---------------------------------------------------------------- Funil
export function StageTab({ chat, open }) {
  const navigate = useNavigate();
  const [st, setSt] = useState(null); // {stage_id, deal_cents, stage_moved_at, stages}
  const [cents, setCents] = useState(0);
  const [busy, setBusy] = useState(false);
  const chatId = chat?.chat_id;
  const load = useCallback(() => {
    if (!chatId) return;
    get(`/whatsapp/pipeline/chat/${encodeURIComponent(chatId)}`)
      .then((r) => {
        setSt(r);
        setCents(r.deal_cents || 0);
      })
      .catch(() => setSt({ stage_id: null, deal_cents: null, stages: [] }));
  }, [chatId]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const move = async (stageId) => {
    setBusy(true);
    try {
      await post('/whatsapp/pipeline/move', { chat_id: chatId, stage_id: stageId || null });
      toast.success(stageId ? 'Etapa atualizada.' : 'Conversa fora do funil.');
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível mover.'));
    } finally {
      setBusy(false);
    }
  };
  const saveDeal = async () => {
    setBusy(true);
    try {
      await put('/whatsapp/pipeline/deal', { chat_id: chatId, deal_cents: cents || null });
      toast.success('Valor salvo.');
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
  };
  if (!st) return <TgListSkeleton rows={3} />;
  const cur = st.stages.find((s) => s.id === st.stage_id);
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box>
        <Title>Etapa do funil</Title>
        <TextField select size="small" value={st.stage_id || ''} onChange={(e) => move(e.target.value)} fullWidth disabled={busy}>
          <MenuItem value="">
            <em>Fora do funil</em>
          </MenuItem>
          {st.stages.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: s.color, mr: 1 }} />
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        {cur && st.stage_moved_at ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            Nesta etapa desde {fmtDateBRT(st.stage_moved_at)}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          {st.stages
            .filter((s) => s.id !== st.stage_id)
            .slice(0, 6)
            .map((s) => (
              <Chip
                key={s.id}
                size="small"
                label={s.name}
                onClick={() => move(s.id)}
                disabled={busy}
                sx={{ fontWeight: 700, borderLeft: '4px solid', borderColor: s.color, borderRadius: 1.5 }}
              />
            ))}
        </Stack>
      </Box>
      <Box>
        <Title>Valor estimado</Title>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <MoneyField valueCents={cents} onChange={setCents} label="Oportunidade" />
          <Button
            variant="contained"
            disableElevation
            onClick={saveDeal}
            disabled={busy || (cents || 0) === (st.deal_cents || 0)}
            sx={{ ...waPrimaryBtn, flexShrink: 0, height: 40 }}
          >
            Salvar
          </Button>
        </Stack>
        {st.deal_cents ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Atual: {formatBRL(st.deal_cents)}
          </Typography>
        ) : null}
      </Box>
      <Button
        size="small"
        endIcon={<IconExternalLink size={14} />}
        onClick={() => navigate('/whatsapp/pipeline')}
        sx={{ alignSelf: 'flex-start', fontWeight: 700, textTransform: 'none' }}
      >
        Abrir o funil
      </Button>
    </Stack>
  );
}

// ---------------------------------------------------------------- Tarefas
export function TasksTab({ chat, open, customerId }) {
  const { user } = useAuth();
  const myId = user?.user?.id || null;
  const now = useNow(30000);
  const [items, setItems] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [dlg, setDlg] = useState(null);
  const chatId = chat?.chat_id;
  const load = useCallback(() => {
    if (!chatId) return;
    get('/whatsapp/tasks', { params: { chat_id: chatId, status: showDone ? 'all' : 'open', page_size: 50 } })
      .then((r) => setItems(r.items || []))
      .catch(() => setItems([]));
  }, [chatId, showDone]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);
  useRealtimeEvent('wa:task', (p) => {
    if (open && (p?.task?.chat?.chat_id === chatId || p?.action === 'deleted')) load();
  });
  const toggle = async (t) => {
    try {
      await post(`/whatsapp/tasks/${t.id}/${t.done ? 'reopen' : 'done'}`);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível atualizar.'));
    }
  };
  return (
    <Box sx={{ p: 2 }}>
      <Title
        action={
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<IconPlus size={14} />}
            onClick={() => setDlg({})}
            sx={{ ...waPrimaryBtn, py: 0.25 }}
          >
            Nova
          </Button>
        }
      >
        Tarefas desta conversa
      </Title>
      {items === null ? (
        <TgListSkeleton rows={3} />
      ) : items.length ? (
        <Stack spacing={0.5}>
          {items.map((t) => {
            const overdue = !t.done && t.due_at && new Date(t.due_at).getTime() < now;
            return (
              <Stack
                key={t.id}
                direction="row"
                alignItems="center"
                spacing={0.5}
                sx={{ borderRadius: 1.5, px: 0.5, '&:hover': { bgcolor: 'action.hover' }, opacity: t.done ? 0.6 : 1 }}
              >
                <Checkbox
                  size="small"
                  checked={Boolean(t.done)}
                  onChange={() => toggle(t)}
                  sx={{ color: 'success.main', '&.Mui-checked': { color: 'success.main' } }}
                />
                <Box sx={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={() => setDlg({ task: t })}>
                  <Typography variant="body2" sx={{ fontWeight: 600, textDecoration: t.done ? 'line-through' : 'none' }} noWrap>
                    {t.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: overdue ? 'error.main' : 'text.secondary', fontWeight: overdue ? 700 : 400 }}
                    noWrap
                    display="block"
                  >
                    {t.due_at ? `${fmtDateBRT(t.due_at)} · ${relTime(t.due_at, now)}` : 'Sem prazo'}
                    {t.assigned_user ? ` · ${t.assigned_user.id === myId ? 'eu' : t.assigned_user.name}` : ''}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setDlg({ task: t })}>
                  <IconPencil size={15} />
                </IconButton>
              </Stack>
            );
          })}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nenhuma tarefa {showDone ? '' : 'em aberto '}para esta conversa.
        </Typography>
      )}
      <Button
        size="small"
        color="inherit"
        onClick={() => setShowDone((v) => !v)}
        sx={{ mt: 1, textTransform: 'none', color: 'text.secondary' }}
      >
        {showDone ? 'Esconder concluídas' : 'Mostrar concluídas'}
      </Button>
      <TaskDialog
        open={Boolean(dlg)}
        onClose={() => setDlg(null)}
        task={dlg?.task || null}
        chat={chat}
        customerId={customerId}
        onSaved={load}
        onDeleted={load}
      />
    </Box>
  );
}

// ---------------------------------------------------------------- Notas
export function NotesTab({ chat, open }) {
  const { user } = useAuth();
  const myId = user?.user?.id || null;
  const admin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [items, setItems] = useState(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null); // {id, text}
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const chatId = chat?.chat_id;
  const base = `/whatsapp/chats/${encodeURIComponent(chatId || '')}/notes`;
  const load = useCallback(() => {
    if (!chatId) return;
    get(base)
      .then((r) => setItems(Array.isArray(r) ? r : []))
      .catch(() => setItems([]));
  }, [chatId, base]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);
  useRealtimeEvent('wa:note', (p) => {
    if (open && (p?.note?.chat_id === chatId || p?.action === 'deleted')) load();
  });

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await post(base, { text: text.trim() });
      setText('');
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar a nota.'));
    } finally {
      setBusy(false);
    }
  };
  const saveEdit = async () => {
    if (!editing?.text.trim()) return;
    setBusy(true);
    try {
      await put(`${base}/${editing.id}`, { text: editing.text.trim() });
      setEditing(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível editar.'));
    } finally {
      setBusy(false);
    }
  };
  const pin = async (n) => {
    try {
      await put(`${base}/${n.id}`, { pinned: !n.pinned });
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível fixar.'));
    }
  };
  const del = async () => {
    const n = confirm;
    setConfirm(null);
    try {
      await remove(`${base}/${n.id}`);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível apagar.'));
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Title>Notas internas</Title>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
        Só a equipe vê. Nada é enviado ao cliente.
      </Typography>
      <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          placeholder="Escreva uma observação… (Ctrl+Enter salva)"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 4000))}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') add();
          }}
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
        />
        <Tooltip title="Salvar nota">
          <span>
            <IconButton
              onClick={add}
              disabled={busy || !text.trim()}
              sx={{
                bgcolor: 'success.main',
                color: '#fff',
                '&:hover': { bgcolor: 'success.dark' },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground' }
              }}
            >
              <IconCheck size={18} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {items === null ? (
        <TgListSkeleton rows={3} />
      ) : items.length ? (
        <Stack spacing={1}>
          {items.map((n) => {
            const own = n.user?.id === myId;
            return (
              <Box
                key={n.id}
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: (t) => (n.pinned ? tint(t, 'warning', 0.1) : 'action.hover'),
                  border: '1px solid',
                  borderColor: n.pinned ? 'warning.main' : 'divider'
                }}
              >
                {editing?.id === n.id ? (
                  <Stack spacing={1}>
                    <TextField
                      size="small"
                      value={editing.text}
                      onChange={(e) => setEditing((x) => ({ ...x, text: e.target.value.slice(0, 4000) }))}
                      fullWidth
                      multiline
                      minRows={2}
                      autoFocus
                    />
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" color="inherit" onClick={() => setEditing(null)} sx={{ textTransform: 'none' }}>
                        Cancelar
                      </Button>
                      <Button size="small" variant="contained" disableElevation onClick={saveEdit} disabled={busy} sx={waPrimaryBtn}>
                        Salvar
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {n.text}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                      <IconNotes size={12} style={{ opacity: 0.6 }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }} noWrap>
                        {n.user?.name || 'Equipe'} · {fmtAgo(n.created_at)}
                        {n.updated_at && n.updated_at !== n.created_at ? ' · editada' : ''}
                      </Typography>
                      <Tooltip title={n.pinned ? 'Desafixar' : 'Fixar no topo'}>
                        <IconButton size="small" onClick={() => pin(n)} sx={{ p: 0.25 }}>
                          {n.pinned ? <IconPinnedOff size={14} /> : <IconPin size={14} />}
                        </IconButton>
                      </Tooltip>
                      {own || admin ? (
                        <>
                          <IconButton size="small" onClick={() => setEditing({ id: n.id, text: n.text })} sx={{ p: 0.25 }}>
                            <IconPencil size={14} />
                          </IconButton>
                          <IconButton size="small" onClick={() => setConfirm(n)} sx={{ p: 0.25, color: 'error.main' }}>
                            <IconTrash size={14} />
                          </IconButton>
                        </>
                      ) : null}
                    </Stack>
                  </>
                )}
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nenhuma nota ainda.
        </Typography>
      )}
      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={del}
        danger
        title="Apagar esta nota?"
        message={confirm?.text?.slice(0, 160)}
        confirmLabel="Apagar"
      />
    </Box>
  );
}
