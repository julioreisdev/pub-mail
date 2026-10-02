import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconChecklist,
  IconMessage,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconUser,
  IconX
} from '@tabler/icons-react';

import { get, post } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgAvatar, TgCard, TgEmptyState, TgFilterBar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaPageHeader, fmtDateBRT, relTime, useNow } from './waKit';
import { errMsg, tint } from './waShared';
import TaskDialog from './crm/TaskDialog';
import { CrmKpi, waPrimaryBtn } from './crm/crmKit';

// ============================================================================
// WhatsApp → Tarefas: lembretes da equipe (ligados ou não a uma conversa/cliente).
// Abas Minhas / Todas / Concluídas; grupos Atrasadas / Hoje / Próximas / Sem prazo.
// ============================================================================

const groupOf = (t, now) => {
  if (t.done) return 'done';
  if (!t.due_at) return 'nodate';
  const d = new Date(t.due_at).getTime();
  if (d < now) return 'overdue';
  if (t.due_today) return 'today';
  return 'next';
};
const GROUPS = [
  ['overdue', 'Atrasadas', 'error'],
  ['today', 'Hoje', 'warning'],
  ['next', 'Próximas', 'info'],
  ['nodate', 'Sem prazo', null],
  ['done', 'Concluídas', 'success']
];

export default function WhatsAppTasks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.user?.id || null;
  const now = useNow(30000);
  const [tab, setTab] = useState('mine'); // mine | all | done
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [assignee, setAssignee] = useState('all');
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState(null); // {task?}
  const seq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    get('/whatsapp/attendants')
      .then((r) => setUsers(Array.isArray(r) ? r : []))
      .catch(() => setUsers([]));
  }, []);

  const loadCounts = useCallback(
    () =>
      get('/whatsapp/tasks/counts')
        .then(setCounts)
        .catch(() => undefined),
    []
  );
  const load = useCallback(
    async ({ silent = false } = {}) => {
      const s = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const params = { page_size: 200, q: debouncedQ || undefined };
        if (tab === 'mine') {
          params.scope = 'mine';
          params.status = 'open';
        } else if (tab === 'all') {
          params.scope = assignee;
          params.status = 'open';
        } else {
          params.scope = assignee;
          params.status = 'done';
        }
        const r = await get('/whatsapp/tasks', { params });
        if (s !== seq.current) return;
        setItems(r.items || []);
      } catch (e) {
        if (s === seq.current && !silent) toast.error(errMsg(e, 'Falha ao carregar as tarefas.'));
      } finally {
        if (s === seq.current) setLoading(false);
      }
      loadCounts();
    },
    [tab, assignee, debouncedQ, loadCounts]
  );
  useEffect(() => {
    load();
  }, [load]);

  useRealtimeEvent('wa:task', () => load({ silent: true }));
  useRealtimeEvent('wa:task_due', () => load({ silent: true }));

  const toggle = async (t) => {
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)));
    try {
      await post(`/whatsapp/tasks/${t.id}/${t.done ? 'reopen' : 'done'}`);
      load({ silent: true });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível atualizar.'));
      load({ silent: true });
    }
  };

  const grouped = useMemo(() => {
    const m = new Map(GROUPS.map(([k]) => [k, []]));
    for (const t of items) m.get(groupOf(t, now))?.push(t);
    return m;
  }, [items, now]);
  const visibleGroups = GROUPS.filter(([k]) => (tab === 'done' ? k === 'done' : k !== 'done')).filter(([k]) => grouped.get(k)?.length);
  const k = counts;

  return (
    <Box>
      <WaPageHeader
        icon={IconChecklist}
        title="Tarefas"
        subtitle="Lembretes da equipe: ligar, cobrar, enviar proposta. Avisamos quando o prazo chega."
        sx={{ mb: 2.5 }}
        action={
          <Button variant="contained" disableElevation startIcon={<IconPlus size={18} />} onClick={() => setDlg({})} sx={waPrimaryBtn}>
            Nova tarefa
          </Button>
        }
      />
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, mb: 2.5 }}>
        <CrmKpi icon={IconChecklist} label="Minhas em aberto" value={k ? String(k.mine.open) : null} accent />
        <CrmKpi icon={IconAlertTriangle} label="Minhas atrasadas" value={k ? String(k.mine.overdue) : null} />
        <CrmKpi icon={IconCalendarEvent} label={`Para hoje (equipe: ${k?.today ?? 0})`} value={k ? String(k.mine.today) : null} />
      </Box>

      <TgCard hover={false} sx={{ p: 0, mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 1, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 44 } }}
        >
          <Tab value="mine" label={`Minhas${k ? ` (${k.mine.open})` : ''}`} />
          <Tab value="all" label={`Todas${k ? ` (${k.open})` : ''}`} />
          <Tab value="done" label="Concluídas" />
        </Tabs>
      </TgCard>

      <TgFilterBar>
        <TextField
          size="small"
          placeholder="Buscar pelo título"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
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
        />
        {tab !== 'mine' ? (
          <TextField
            select
            size="small"
            label="Responsável"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="unassigned">Sem responsável</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
                {u.id === myId ? ' (eu)' : ''}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Atualizar">
          <span>
            <IconButton onClick={() => load()} disabled={loading}>
              <IconRefresh size={18} />
            </IconButton>
          </span>
        </Tooltip>
      </TgFilterBar>

      {loading && !items.length ? (
        <TgCard hover={false} sx={{ p: 2 }}>
          <TgListSkeleton rows={5} />
        </TgCard>
      ) : !items.length ? (
        <TgEmptyState
          icon={IconChecklist}
          title={tab === 'done' ? 'Nenhuma tarefa concluída' : tab === 'mine' ? 'Você está em dia' : 'Nenhuma tarefa em aberto'}
          description={
            tab === 'done'
              ? 'As tarefas concluídas aparecem aqui.'
              : 'Crie tarefas aqui, pelo painel da conversa ou automaticamente ao mover uma conversa no funil.'
          }
          action={
            tab !== 'done' ? (
              <Button variant="contained" disableElevation startIcon={<IconPlus size={18} />} onClick={() => setDlg({})} sx={waPrimaryBtn}>
                Nova tarefa
              </Button>
            ) : null
          }
        />
      ) : (
        <Stack spacing={2}>
          {visibleGroups.map(([key, label, token]) => (
            <TgCard key={key} hover={false} sx={{ p: 0, overflow: 'hidden' }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  px: 2,
                  py: 1.25,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: token ? (t) => tint(t, token, 0.08) : 'transparent'
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: token ? `${token}.main` : 'text.secondary' }}>
                  {label}
                </Typography>
                <Chip size="small" label={grouped.get(key).length} sx={{ height: 20, fontWeight: 700 }} />
              </Stack>
              {grouped.get(key).map((t) => (
                <Stack
                  key={t.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-of-type': { borderBottom: 0 },
                    '&:hover': { bgcolor: 'action.hover' },
                    opacity: t.done ? 0.65 : 1
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={Boolean(t.done)}
                    onChange={() => toggle(t)}
                    sx={{ color: 'success.main', '&.Mui-checked': { color: 'success.main' } }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={() => setDlg({ task: t })}>
                    <Typography variant="body2" sx={{ fontWeight: 700, textDecoration: t.done ? 'line-through' : 'none' }} noWrap>
                      {t.title}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }} flexWrap="wrap" useFlexGap>
                      {t.due_at ? (
                        <Typography
                          variant="caption"
                          sx={{ color: key === 'overdue' ? 'error.main' : 'text.secondary', fontWeight: key === 'overdue' ? 700 : 400 }}
                        >
                          {fmtDateBRT(t.due_at)} · {relTime(t.due_at, now)}
                        </Typography>
                      ) : null}
                      {t.assigned_user ? (
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
                        >
                          <IconUser size={12} /> {t.assigned_user.id === myId ? 'eu' : t.assigned_user.name}
                        </Typography>
                      ) : null}
                      {t.description ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                          {t.description}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>
                  {t.chat ? (
                    <Tooltip title={`Abrir conversa: ${t.chat.name || t.chat.chat_id}`}>
                      <Chip
                        size="small"
                        avatar={<TgAvatar name={t.chat.name} size={20} kind="contact" />}
                        label={t.chat.name || t.chat.chat_id}
                        onClick={() => navigate(`/whatsapp/chat?chat=${encodeURIComponent(t.chat.chat_id)}`)}
                        icon={undefined}
                        deleteIcon={<IconMessage size={14} />}
                        onDelete={() => navigate(`/whatsapp/chat?chat=${encodeURIComponent(t.chat.chat_id)}`)}
                        sx={{ maxWidth: 220, height: 24, borderRadius: 1.5 }}
                      />
                    </Tooltip>
                  ) : null}
                  <IconButton size="small" onClick={() => setDlg({ task: t })}>
                    <IconPencil size={16} />
                  </IconButton>
                </Stack>
              ))}
            </TgCard>
          ))}
        </Stack>
      )}

      <TaskDialog
        open={Boolean(dlg)}
        onClose={() => setDlg(null)}
        task={dlg?.task || null}
        onSaved={() => load({ silent: true })}
        onDeleted={() => load({ silent: true })}
      />
    </Box>
  );
}
