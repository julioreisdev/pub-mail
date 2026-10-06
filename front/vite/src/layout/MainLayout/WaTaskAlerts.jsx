import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconBellRinging } from '@tabler/icons-react';

import { useAuth } from 'contexts/AuthContext';
import useAccess from 'hooks/useAccess';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { WaNumberChip } from 'views/pages/whatsapp/waKit';

// ============================================================================
// Aviso de tarefa do WhatsApp CRM no prazo (evento `wa:task_due` do WebSocket).
// Montado no MainLayout só para quem tem o módulo; mostra para o responsável
// (ou para todos, se a tarefa não tem responsável).
// Multi-número: `task.chat.chat_id` = uuid da conversa (link do Chat) e `task.chat.session`
// (ou `payload.session`) = número, mostrado no aviso quando vier.
// ============================================================================

function Alerts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.user?.id || null;
  const seen = useRef(new Set());
  useRealtimeEvent('wa:task_due', ({ task, session, session_id: sid } = {}) => {
    if (!task?.id || seen.current.has(task.id)) return;
    const mine = !task.assigned_user || task.assigned_user.id === myId;
    if (!mine) return;
    seen.current.add(task.id);
    const number = task.chat?.session || session || (sid ? { id: sid, label: 'Número' } : null);
    const chatId = task.chat?.chat_id || null;
    toast(
      (t) => (
        <Stack spacing={0.5} sx={{ minWidth: 220 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Tarefa no prazo
          </Typography>
          <Typography variant="body2">{task.title}</Typography>
          {task.chat?.name || number ? (
            <Stack direction="row" spacing={0.75} alignItems="center">
              {task.chat?.name ? (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {task.chat.name}
                </Typography>
              ) : null}
              {number ? <WaNumberChip session={number} /> : null}
            </Stack>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <Button
              size="small"
              variant="contained"
              disableElevation
              onClick={() => {
                toast.dismiss(t.id);
                navigate(chatId ? `/whatsapp/chat?chat=${encodeURIComponent(chatId)}` : '/whatsapp/tasks');
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {chatId ? 'Abrir conversa' : 'Ver tarefas'}
            </Button>
            <Button size="small" color="inherit" onClick={() => toast.dismiss(t.id)} sx={{ textTransform: 'none' }}>
              Fechar
            </Button>
          </Stack>
        </Stack>
      ),
      { icon: <IconBellRinging size={20} />, duration: 15000, id: `wa-task-${task.id}` }
    );
  });
  useEffect(() => () => seen.current.clear(), []);
  return null;
}

export default function WaTaskAlerts() {
  const { has } = useAccess();
  if (!has('whatsapp')) return null;
  return <Alerts />;
}
