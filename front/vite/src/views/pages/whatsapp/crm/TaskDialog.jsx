import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { IconCheck, IconTrash } from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgConfirmDialog, TgModal } from 'views/pages/telegram/ui';
import { brtLocalNow, brtLocalToIso, isoToBrtLocal } from '../waKit';
import { errMsg } from '../waShared';
import { waPrimaryBtn } from './crmKit';

// ============================================================================
// Criar/editar tarefa (usada na página Tarefas e no painel da conversa).
// `chat` fixa a conversa; `task` = edição.
// ============================================================================

const QUICK = [
  ['Em 1 h', 60],
  ['Hoje 18h', 'today18'],
  ['Amanhã 9h', 'tomorrow9'],
  ['Em 3 dias', 3 * 24 * 60]
];
const quickValue = (v) => {
  if (typeof v === 'number') return brtLocalNow(v);
  const base = brtLocalNow(0).slice(0, 10);
  if (v === 'today18') return `${base}T18:00`;
  const d = new Date(`${base}T12:00:00-03:00`);
  d.setDate(d.getDate() + 1);
  return `${isoToBrtLocal(d.toISOString()).slice(0, 10)}T09:00`;
};

export default function TaskDialog({ open, onClose, task, chat, customerId, onSaved, onDeleted }) {
  const { user } = useAuth();
  const myId = user?.user?.id || null;
  const [f, setF] = useState({ title: '', description: '', due_local: '', assigned_user_id: '' });
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({
      title: task?.title || '',
      description: task?.description || '',
      due_local: task?.due_at ? isoToBrtLocal(task.due_at) : '',
      assigned_user_id: task ? task.assigned_user?.id || '' : myId || ''
    });
    get('/whatsapp/attendants')
      .then((r) => setUsers(Array.isArray(r) ? r : []))
      .catch(() => setUsers([]));
  }, [open, task, myId]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.title.trim()) return toast.error('Dê um título à tarefa.');
    setBusy(true);
    try {
      const body = {
        title: f.title.trim(),
        description: f.description.trim() || null,
        due_at: f.due_local ? brtLocalToIso(f.due_local) : null,
        assigned_user_id: f.assigned_user_id || null,
        ...(task ? {} : { chat_id: chat?.chat_id || null, customer_id: customerId || null })
      };
      const r = task ? await put(`/whatsapp/tasks/${task.id}`, body) : await post('/whatsapp/tasks', body);
      toast.success(task ? 'Tarefa atualizada.' : 'Tarefa criada.');
      onSaved?.(r);
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar a tarefa.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  const del = async () => {
    setBusy(true);
    try {
      await remove(`/whatsapp/tasks/${task.id}`);
      toast.success('Tarefa apagada.');
      onDeleted?.(task);
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível apagar.'));
    } finally {
      setBusy(false);
      setConfirmDel(false);
    }
  };

  return (
    <>
      <TgModal
        open={open}
        onClose={() => !busy && onClose?.()}
        title={task ? 'Editar tarefa' : 'Nova tarefa'}
        subtitle={
          chat
            ? `Conversa: ${chat.name || chat.phone || chat.chat_id}`
            : task?.chat?.name
              ? `Conversa: ${task.chat.name}`
              : 'Lembrete interno da equipe (nada é enviado ao cliente)'
        }
        maxWidth="sm"
        disableClose={busy}
        footer={
          <>
            {task ? (
              <Button
                color="error"
                startIcon={<IconTrash size={16} />}
                onClick={() => setConfirmDel(true)}
                disabled={busy}
                sx={{ textTransform: 'none', mr: 'auto' }}
              >
                Apagar
              </Button>
            ) : null}
            <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={save}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
              sx={waPrimaryBtn}
            >
              Salvar
            </Button>
          </>
        }
      >
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Título"
            value={f.title}
            onChange={(e) => set('title', e.target.value.slice(0, 160))}
            fullWidth
            autoFocus
            placeholder="Ex.: Ligar para confirmar a proposta"
          />
          <TextField
            size="small"
            label="Detalhes (opcional)"
            value={f.description}
            onChange={(e) => set('description', e.target.value.slice(0, 4000))}
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              type="datetime-local"
              label="Prazo (horário de Brasília)"
              value={f.due_local}
              onChange={(e) => set('due_local', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              select
              size="small"
              label="Responsável"
              value={f.assigned_user_id}
              onChange={(e) => set('assigned_user_id', e.target.value)}
              fullWidth
            >
              <MenuItem value="">
                <em>Sem responsável</em>
              </MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name}
                  {u.id === myId ? ' (eu)' : ''}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Atalhos:
            </Typography>
            {QUICK.map(([label, v]) => (
              <Button
                key={label}
                size="small"
                variant="outlined"
                onClick={() => set('due_local', quickValue(v))}
                sx={{ textTransform: 'none', borderRadius: 2, py: 0, minHeight: 26 }}
              >
                {label}
              </Button>
            ))}
            {f.due_local ? (
              <Button
                size="small"
                color="inherit"
                onClick={() => set('due_local', '')}
                sx={{ textTransform: 'none', py: 0, minHeight: 26 }}
              >
                sem prazo
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </TgModal>
      <TgConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={del}
        danger
        loading={busy}
        title="Apagar esta tarefa?"
        message={task?.title}
        confirmLabel="Apagar"
      />
    </>
  );
}
