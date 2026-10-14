import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputBase from '@mui/material/InputBase';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconArrowLeft,
  IconArrowRight,
  IconChecklist,
  IconCircleCheck,
  IconDots,
  IconEraser,
  IconPalette,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTag,
  IconTrash,
  IconX
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgConfirmDialog, TgModal } from 'views/pages/telegram/ui';
import { WaPageHeader, useNow, useWaSessions } from './waKit';
import { errMsg } from './waShared';
import TaskDialog from './crm/TaskDialog';
import { WaNumberFilter, useSessionFilter, waPrimaryBtn } from './crm/crmKit';
import { THIN_SCROLL } from './chat/chatKit';
import TaskCard from './tasks/TaskCard';
import TaskCardDialog, { LabelsEditor } from './tasks/TaskCardDialog';
import { LIST_COLORS } from './tasks/taskKit';

// ============================================================================
// WhatsApp → Tarefas: quadro estilo Trello.
// Colunas da conta (GET /whatsapp/tasks/board), cartões arrastáveis entre e dentro das colunas
// (POST /whatsapp/tasks/:id/move {list_id, index}) e colunas arrastáveis pelo cabeçalho (PUT lists/reorder).
// A coluna marcada "de concluídas" conclui o que entra nela. Criar rápido no rodapé de cada coluna.
// Celular: sem arrasto (HTML5 não funciona com toque) — "Mover" no detalhe do cartão.
// Toda resposta do servidor com um cartão passa por `upsertTask` (reposiciona pelo `position`).
// ============================================================================

const COL_W = 284;
const isAdminRole = (r) => ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(String(r || ''));

export default function WhatsAppTasks() {
  const { user } = useAuth();
  const myId = user?.user?.id || null;
  const canManage = isAdminRole(user?.user?.role);
  const now = useNow(60000);
  const { sessions } = useWaSessions(30000);
  const { value: sessionId, set: setSessionId, multi } = useSessionFilter(sessions);

  const [board, setBoard] = useState({ lists: [], labels: [], truncated: false });
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [scope, setScope] = useState('all'); // mine | all
  const [assignee, setAssignee] = useState('all');
  const [labelId, setLabelId] = useState('');
  const [due, setDue] = useState('');

  const [openTask, setOpenTask] = useState(null);
  const [creating, setCreating] = useState(false);
  const [delTask, setDelTask] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [labelsPop, setLabelsPop] = useState(null);

  // arrastar
  const dragRef = useRef(null); // {kind:'card', id, from, h} | {kind:'list', id}
  const [draggingId, setDraggingId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // {listId, index}
  const [listDrop, setListDrop] = useState(null); // índice de inserção da coluna arrastada

  // compositores
  const [composer, setComposer] = useState(null); // {listId, text}
  const [newList, setNewList] = useState(null); // string | null
  const [editingList, setEditingList] = useState(null); // {id, name}
  const [listMenu, setListMenu] = useState(null); // {el, list}
  const [colorPop, setColorPop] = useState(null); // {el, list}
  const [confirmClear, setConfirmClear] = useState(null); // list
  const [delList, setDelList] = useState(null); // {list, moveTo}

  const seq = useRef(0);
  const boardRef = useRef(null);
  const [boardH, setBoardH] = useState(560);

  // ---------------------------------------------------------------- dados
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    get('/whatsapp/attendants')
      .then((r) => setUsers(Array.isArray(r) ? r : []))
      .catch(() => setUsers([]));
  }, []);

  const params = useMemo(
    () => ({
      scope: scope === 'mine' ? 'mine' : assignee,
      q: debouncedQ || undefined,
      session_id: sessionId || undefined,
      label_id: labelId || undefined,
      due: due || undefined
    }),
    [scope, assignee, debouncedQ, sessionId, labelId, due]
  );

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const s = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const r = await get('/whatsapp/tasks/board', { params });
        if (s !== seq.current) return;
        setBoard({ lists: r.lists || [], labels: r.labels || [], truncated: Boolean(r.truncated) });
      } catch (e) {
        if (s === seq.current && !silent) toast.error(errMsg(e, 'Falha ao carregar o quadro.'));
      } finally {
        if (s === seq.current) setLoading(false);
      }
      get('/whatsapp/tasks/counts', { params: sessionId ? { session_id: sessionId } : {} })
        .then(setCounts)
        .catch(() => undefined);
    },
    [params, sessionId]
  );
  useEffect(() => {
    load();
  }, [load]);

  // tempo real: recarrega em silêncio (agrupado); durante um arrasto espera terminar
  const reloadTimer = useRef(null);
  const scheduleReload = useCallback(() => {
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(function again() {
      if (dragRef.current) {
        reloadTimer.current = window.setTimeout(again, 800);
        return;
      }
      load({ silent: true });
    }, 600);
  }, [load]);
  useEffect(() => () => window.clearTimeout(reloadTimer.current), []);
  useRealtimeEvent('wa:task', (p) => {
    if (p?.action === 'deleted' && p.task?.id) {
      setBoard((b) => ({ ...b, lists: b.lists.map((l) => ({ ...l, tasks: l.tasks.filter((t) => t.id !== p.task.id) })) }));
      return;
    }
    if (p?.by && p.by === myId && p.action !== 'board') return; // já aplicado aqui
    scheduleReload();
  });

  // altura do quadro = resto da janela
  useEffect(() => {
    const calc = () => {
      const el = boardRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setBoardH(Math.max(420, window.innerHeight - top - 24));
    };
    calc();
    window.addEventListener('resize', calc);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(calc) : null;
    ro?.observe(document.body);
    return () => {
      window.removeEventListener('resize', calc);
      ro?.disconnect();
    };
  }, []);

  const labelsById = useMemo(() => new Map(board.labels.map((l) => [l.id, l])), [board.labels]);

  /** Encaixa o cartão vindo do servidor na coluna dele (ordem por `position`). */
  const upsertTask = useCallback((task) => {
    if (!task?.id) return;
    setBoard((b) => ({
      ...b,
      lists: b.lists.map((l) => {
        const had = l.tasks.some((t) => t.id === task.id);
        let tasks = l.tasks.filter((t) => t.id !== task.id);
        if (l.id === task.list_id) tasks = [...tasks, task].sort((a, c) => a.position - c.position);
        const delta = (l.id === task.list_id ? 1 : 0) - (had ? 1 : 0);
        return { ...l, tasks, total: Math.max(0, (l.total || 0) + delta) };
      })
    }));
    setOpenTask((cur) => (cur && cur.id === task.id ? task : cur));
  }, []);
  const dropTaskLocal = useCallback((id) => {
    setBoard((b) => ({
      ...b,
      lists: b.lists.map((l) =>
        l.tasks.some((t) => t.id === id) ? { ...l, tasks: l.tasks.filter((t) => t.id !== id), total: Math.max(0, (l.total || 1) - 1) } : l
      )
    }));
  }, []);

  // ---------------------------------------------------------------- cartões
  const toggleDone = useCallback(
    async (task) => {
      try {
        upsertTask(await post(`/whatsapp/tasks/${task.id}/${task.done ? 'reopen' : 'done'}`));
      } catch (e) {
        toast.error(errMsg(e, 'Não foi possível atualizar.'));
      }
    },
    [upsertTask]
  );

  const moveCard = async (taskId, toList, index) => {
    // otimista: tira da origem e põe na posição do destino
    let moving = null;
    setBoard((b) => {
      const lists = b.lists.map((l) => {
        const t = l.tasks.find((x) => x.id === taskId);
        if (t) moving = t;
        return t ? { ...l, tasks: l.tasks.filter((x) => x.id !== taskId), total: Math.max(0, (l.total || 1) - 1) } : l;
      });
      if (!moving) return b;
      const target = lists.find((l) => l.id === toList);
      const moved = { ...moving, list_id: toList, done: target?.is_done ? true : moving.done };
      return {
        ...b,
        lists: lists.map((l) => {
          if (l.id !== toList) return l;
          const tasks = [...l.tasks];
          tasks.splice(Math.min(index, tasks.length), 0, moved);
          return { ...l, tasks, total: (l.total || 0) + 1 };
        })
      };
    });
    try {
      upsertTask(await post(`/whatsapp/tasks/${taskId}/move`, { list_id: toList, index }));
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível mover o cartão.'));
      load({ silent: true });
    }
  };

  const confirmDelete = async () => {
    if (!delTask) return;
    setDelBusy(true);
    try {
      await remove(`/whatsapp/tasks/${delTask.id}`);
      dropTaskLocal(delTask.id);
      toast.success('Cartão apagado.');
      setDelTask(null);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível apagar.'));
    } finally {
      setDelBusy(false);
    }
  };

  const addCard = async () => {
    const title = composer?.text?.trim();
    if (!title) return;
    const listId = composer.listId;
    setComposer({ listId, text: '' });
    try {
      upsertTask(await post('/whatsapp/tasks', { title, list_id: listId, assigned_user_id: scope === 'mine' ? myId : null }));
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível criar o cartão.'));
    }
  };

  // ---------------------------------------------------------------- colunas
  const createList = async () => {
    const name = (newList || '').trim();
    if (!name) return;
    try {
      const l = await post('/whatsapp/tasks/lists', { name, color: LIST_COLORS[board.lists.length % LIST_COLORS.length] });
      setBoard((b) => ({ ...b, lists: [...b.lists, { ...l, total: 0, tasks: [] }] }));
      setNewList('');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível criar a coluna.'));
    }
  };
  const updateList = async (list, body) => {
    const prev = board.lists;
    setBoard((b) => ({ ...b, lists: b.lists.map((l) => (l.id === list.id ? { ...l, ...body } : l)) }));
    try {
      await put(`/whatsapp/tasks/lists/${list.id}`, body);
      if (body.is_done !== undefined) load({ silent: true });
    } catch (e) {
      setBoard((b) => ({ ...b, lists: prev }));
      toast.error(errMsg(e, 'Não foi possível salvar a coluna.'));
    }
  };
  const reorderLists = async (ids) => {
    setBoard((b) => ({ ...b, lists: ids.map((id) => b.lists.find((l) => l.id === id)).filter(Boolean) }));
    try {
      await put('/whatsapp/tasks/lists/reorder', { ids });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível reordenar.'));
      load({ silent: true });
    }
  };
  const shiftList = (list, dir) => {
    const ids = board.lists.map((l) => l.id);
    const i = ids.indexOf(list.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderLists(ids);
  };
  const clearList = async () => {
    const list = confirmClear;
    setDelBusy(true);
    try {
      const r = await post(`/whatsapp/tasks/lists/${list.id}/clear`);
      setBoard((b) => ({ ...b, lists: b.lists.map((l) => (l.id === list.id ? { ...l, tasks: [], total: 0 } : l)) }));
      toast.success(`${r.deleted} cartão(ões) apagado(s).`);
      setConfirmClear(null);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível limpar a coluna.'));
    } finally {
      setDelBusy(false);
    }
  };
  const deleteList = async (mode) => {
    const { list, moveTo } = delList;
    setDelBusy(true);
    try {
      await post(
        `/whatsapp/tasks/lists/${list.id}/delete`,
        mode === 'move' ? { move_to: moveTo } : mode === 'delete' ? { delete_tasks: true } : {}
      );
      toast.success('Coluna apagada.');
      setDelList(null);
      load({ silent: true });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível apagar a coluna.'));
    } finally {
      setDelBusy(false);
    }
  };

  // ---------------------------------------------------------------- arrastar (HTML5)
  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
    setListDrop(null);
  }, []);
  useEffect(() => {
    window.addEventListener('dragend', endDrag);
    window.addEventListener('drop', endDrag);
    return () => {
      window.removeEventListener('dragend', endDrag);
      window.removeEventListener('drop', endDrag);
    };
  }, [endDrag]);

  const cardDragProps = (task, listId) => ({
    draggable: true,
    onDragStart: (e) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
      dragRef.current = { kind: 'card', id: task.id, from: listId, h: e.currentTarget.offsetHeight };
      window.setTimeout(() => setDraggingId(task.id), 0);
    }
  });
  const onCardOver = (e, listId, idx) => {
    if (dragRef.current?.kind !== 'card') return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const index = e.clientY < r.top + r.height / 2 ? idx : idx + 1;
    setDropTarget((d) => (d && d.listId === listId && d.index === index ? d : { listId, index }));
  };
  const onColumnOver = (e, list, colIdx, visibleCount) => {
    const d = dragRef.current;
    if (!d) return;
    e.preventDefault();
    if (d.kind === 'card') {
      if (!dropTarget || dropTarget.listId !== list.id) setDropTarget({ listId: list.id, index: visibleCount });
    } else if (d.kind === 'list') {
      const r = e.currentTarget.getBoundingClientRect();
      const at = e.clientX < r.left + r.width / 2 ? colIdx : colIdx + 1;
      if (listDrop !== at) setListDrop(at);
    }
  };
  const onBodyOver = (e, list, visibleCount) => {
    if (dragRef.current?.kind !== 'card') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.target === e.currentTarget) setDropTarget({ listId: list.id, index: visibleCount });
  };
  const onColumnDrop = (e) => {
    const d = dragRef.current;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    if (d.kind === 'card' && dropTarget) {
      const src = board.lists.find((l) => l.id === d.from);
      const srcIdx = src ? src.tasks.findIndex((t) => t.id === d.id) : -1;
      // índices contam os cartões SEM o arrastado: na mesma coluna, soltar no índice original = não mexeu
      if (!(dropTarget.listId === d.from && dropTarget.index === srcIdx)) moveCard(d.id, dropTarget.listId, dropTarget.index);
    } else if (d.kind === 'list' && listDrop !== null) {
      const ids = board.lists.map((l) => l.id);
      const from = ids.indexOf(d.id);
      let to = listDrop > from ? listDrop - 1 : listDrop;
      if (to !== from && from >= 0) {
        ids.splice(from, 1);
        ids.splice(to, 0, d.id);
        reorderLists(ids);
      }
    }
    endDrag();
  };

  // ---------------------------------------------------------------- render
  const k = counts;
  const summary = k
    ? [
        `${k.mine.open} ${k.mine.open === 1 ? 'tarefa sua' : 'tarefas suas'} em aberto`,
        k.mine.overdue ? `${k.mine.overdue} atrasada${k.mine.overdue === 1 ? '' : 's'}` : null,
        k.mine.today ? `${k.mine.today} para hoje` : null
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Quadro da equipe: arraste os cartões entre as colunas.';
  const filtersOn = Boolean(debouncedQ || labelId || due || scope === 'mine' || assignee !== 'all');

  return (
    <Box>
      <WaPageHeader
        icon={IconChecklist}
        title="Tarefas"
        subtitle={summary}
        sx={{ mb: 2 }}
        action={
          <Button
            variant="contained"
            disableElevation
            startIcon={<IconPlus size={18} />}
            onClick={() => setCreating(true)}
            sx={waPrimaryBtn}
          >
            Nova tarefa
          </Button>
        }
      />

      {/* filtros */}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          placeholder="Buscar cartões"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: '1 1 200px', maxWidth: { sm: 280 } }}
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
        <ToggleButtonGroup
          size="small"
          exclusive
          value={scope}
          onChange={(_, v) => v && setScope(v)}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, px: 1.5 } }}
        >
          <ToggleButton value="all">Todas</ToggleButton>
          <ToggleButton value="mine">Minhas</ToggleButton>
        </ToggleButtonGroup>
        {scope === 'all' ? (
          <TextField
            select
            size="small"
            label="Responsável"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="unassigned">Sem responsável</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
                {u.id === myId ? ' (você)' : ''}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <TextField
          select
          size="small"
          label="Etiqueta"
          InputLabelProps={{ shrink: true }}
          SelectProps={{ displayEmpty: true }}
          value={labelId}
          onChange={(e) => setLabelId(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {board.labels.map((l) => (
            <MenuItem key={l.id} value={l.id}>
              <Box sx={{ width: 22, height: 12, borderRadius: '3px', bgcolor: l.color, mr: 1 }} />
              {l.name || 'Sem nome'}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Prazo"
          InputLabelProps={{ shrink: true }}
          SelectProps={{ displayEmpty: true }}
          value={due}
          onChange={(e) => setDue(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">Qualquer</MenuItem>
          <MenuItem value="overdue">Atrasadas</MenuItem>
          <MenuItem value="today">Hoje</MenuItem>
          <MenuItem value="week">Próximos 7 dias</MenuItem>
          <MenuItem value="none">Sem prazo</MenuItem>
        </TextField>
        <WaNumberFilter sessions={sessions} value={sessionId} onChange={setSessionId} />
        {filtersOn ? (
          <Button
            size="small"
            onClick={() => {
              setQ('');
              setScope('all');
              setAssignee('all');
              setLabelId('');
              setDue('');
            }}
            sx={{ textTransform: 'none' }}
          >
            Limpar filtros
          </Button>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<IconTag size={16} />}
          onClick={(e) => setLabelsPop(e.currentTarget)}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Etiquetas
        </Button>
        <Tooltip title="Atualizar">
          <span>
            <IconButton onClick={() => load()} disabled={loading}>
              <IconRefresh size={18} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* quadro */}
      <Box
        ref={boardRef}
        sx={(t) => ({
          height: boardH,
          borderRadius: 4,
          p: { xs: 1, sm: 1.5 },
          background: 'linear-gradient(160deg,#e3edff 0%,#efe9ff 55%,#fdeef6 100%)',
          // chave aninhada: o THIN_SCROLL abaixo também usa applyStyles('dark') e sobrescreveria esta chave
          '&': t.applyStyles('dark', { background: 'linear-gradient(160deg,#0f1a33 0%,#171533 60%,#221329 100%)' }),
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: { xs: 'x mandatory', sm: 'none' },
          ...THIN_SCROLL(t)
        })}
      >
        {loading && !board.lists.length
          ? [0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={(t) => ({
                  width: COL_W,
                  flexShrink: 0,
                  height: 180 + i * 60,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,.6)',
                  ...t.applyStyles('dark', { bgcolor: 'rgba(255,255,255,.05)' })
                })}
              />
            ))
          : board.lists.map((list, colIdx) => {
              const vis = list.tasks.filter((t) => t.id !== draggingId);
              const placeholderAt = dropTarget && dropTarget.listId === list.id ? Math.min(dropTarget.index, vis.length) : -1;
              const hiddenCount = Math.max(0, (list.total || 0) - list.tasks.length);
              const isComposer = composer?.listId === list.id;
              return (
                <Box
                  key={list.id}
                  onDragOver={(e) => onColumnOver(e, list, colIdx, vis.length)}
                  onDrop={onColumnDrop}
                  sx={(t) => ({
                    position: 'relative',
                    width: { xs: '86vw', sm: COL_W },
                    maxWidth: COL_W + 40,
                    flexShrink: 0,
                    maxHeight: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    bgcolor: '#f1f2f4',
                    boxShadow: '0 1px 1px rgba(9,30,66,.18)',
                    scrollSnapAlign: 'start',
                    opacity: draggingId === list.id ? 0.4 : 1,
                    ...t.applyStyles('dark', { bgcolor: '#101418', boxShadow: '0 1px 1px rgba(0,0,0,.5)' }),
                    '&::before':
                      listDrop !== null && (listDrop === colIdx || (listDrop === colIdx + 1 && colIdx === board.lists.length - 1))
                        ? {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            [listDrop === colIdx ? 'left' : 'right']: -8,
                            width: 4,
                            borderRadius: 2,
                            bgcolor: 'primary.main'
                          }
                        : undefined
                  })}
                >
                  {/* cabeçalho (arrastável) */}
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={0.75}
                    draggable={editingList?.id !== list.id}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', `list:${list.id}`);
                      dragRef.current = { kind: 'list', id: list.id };
                      window.setTimeout(() => setDraggingId(list.id), 0);
                    }}
                    sx={{ px: 1.25, pt: 1.25, pb: 0.75, cursor: 'grab' }}
                  >
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: list.color || 'grey.500', flexShrink: 0 }} />
                    {editingList?.id === list.id ? (
                      <InputBase
                        autoFocus
                        value={editingList.name}
                        onChange={(e) => setEditingList((x) => ({ ...x, name: e.target.value }))}
                        onBlur={() => {
                          const n = editingList.name.trim();
                          if (n && n !== list.name) updateList(list, { name: n });
                          setEditingList(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') setEditingList(null);
                        }}
                        inputProps={{ maxLength: 60 }}
                        sx={{
                          flex: 1,
                          fontSize: 14,
                          fontWeight: 700,
                          px: 0.75,
                          borderRadius: 1,
                          bgcolor: 'background.paper',
                          boxShadow: (t) => `inset 0 0 0 2px ${t.vars.palette.primary.main}`
                        }}
                      />
                    ) : (
                      <Typography
                        onClick={() => setEditingList({ id: list.id, name: list.name })}
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'text.primary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'text'
                        }}
                      >
                        {list.name}
                      </Typography>
                    )}
                    {list.is_done ? (
                      <Tooltip title="Coluna de concluídas: o que entra aqui fica concluído">
                        <Box sx={{ display: 'flex', color: 'success.main' }}>
                          <IconCircleCheck size={16} />
                        </Box>
                      </Tooltip>
                    ) : null}
                    <Box
                      sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', px: 0.75, borderRadius: 99, bgcolor: 'action.hover' }}
                    >
                      {list.total ?? list.tasks.length}
                    </Box>
                    <IconButton size="small" onClick={(e) => setListMenu({ el: e.currentTarget, list })}>
                      <IconDots size={16} />
                    </IconButton>
                  </Stack>

                  {/* cartões */}
                  <Box
                    onDragOver={(e) => onBodyOver(e, list, vis.length)}
                    sx={(t) => ({
                      flex: '1 1 auto',
                      minHeight: 24,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      px: 1,
                      pt: 0.5,
                      ...THIN_SCROLL(t)
                    })}
                  >
                    {vis.map((task, i) => (
                      <Box key={task.id}>
                        {placeholderAt === i ? <DropSlot h={dragRef.current?.h} /> : null}
                        <Box onDragOver={(e) => onCardOver(e, list.id, i)} sx={{ pb: 1 }}>
                          <TaskCard
                            task={task}
                            labelsById={labelsById}
                            myId={myId}
                            multi={multi}
                            now={now}
                            onOpen={setOpenTask}
                            onToggleDone={toggleDone}
                            onDelete={setDelTask}
                            dragProps={cardDragProps(task, list.id)}
                          />
                        </Box>
                      </Box>
                    ))}
                    {placeholderAt === vis.length ? <DropSlot h={dragRef.current?.h} /> : null}
                    {hiddenCount ? (
                      <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', pb: 1 }}>
                        + {hiddenCount} mais antiga{hiddenCount === 1 ? '' : 's'} (use a busca)
                      </Typography>
                    ) : null}
                    {!vis.length && placeholderAt < 0 && !isComposer ? (
                      <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', py: 1.5 }}>
                        {list.is_done ? 'Solte aqui o que terminou' : 'Nenhum cartão'}
                      </Typography>
                    ) : null}
                    {isComposer ? (
                      <Box sx={{ pb: 1 }}>
                        <InputBase
                          autoFocus
                          multiline
                          minRows={2}
                          fullWidth
                          placeholder="Insira um título para este cartão…"
                          value={composer.text}
                          onChange={(e) => setComposer((c) => ({ ...c, text: e.target.value.replace(/\n/g, '') }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCard();
                            }
                            if (e.key === 'Escape') setComposer(null);
                          }}
                          inputProps={{ maxLength: 160 }}
                          sx={(t) => ({
                            fontSize: 14,
                            p: 1,
                            borderRadius: '10px',
                            bgcolor: '#fff',
                            boxShadow: '0 1px 1px rgba(9,30,66,.25)',
                            ...t.applyStyles('dark', { bgcolor: '#22272b' })
                          })}
                        />
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            disableElevation
                            onClick={addCard}
                            sx={{ textTransform: 'none', fontWeight: 700 }}
                          >
                            Adicionar cartão
                          </Button>
                          <IconButton size="small" onClick={() => setComposer(null)}>
                            <IconX size={18} />
                          </IconButton>
                        </Stack>
                      </Box>
                    ) : null}
                  </Box>

                  {!isComposer ? (
                    <Box sx={{ px: 1, pb: 1, pt: 0.25 }}>
                      <Button
                        fullWidth
                        startIcon={<IconPlus size={16} />}
                        onClick={() => setComposer({ listId: list.id, text: '' })}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          fontWeight: 600,
                          color: 'text.secondary',
                          borderRadius: 2,
                          '&:hover': { bgcolor: 'action.selected', color: 'text.primary' }
                        }}
                      >
                        Adicionar um cartão
                      </Button>
                    </Box>
                  ) : null}
                </Box>
              );
            })}

        {/* nova coluna */}
        {!loading || board.lists.length ? (
          <Box sx={{ width: { xs: '86vw', sm: COL_W }, flexShrink: 0, scrollSnapAlign: 'start' }}>
            {newList !== null ? (
              <Box sx={(t) => ({ p: 1, borderRadius: 3, bgcolor: '#f1f2f4', ...t.applyStyles('dark', { bgcolor: '#101418' }) })}>
                <TextField
                  autoFocus
                  size="small"
                  fullWidth
                  placeholder="Nome da coluna"
                  value={newList}
                  onChange={(e) => setNewList(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createList();
                    if (e.key === 'Escape') setNewList(null);
                  }}
                  inputProps={{ maxLength: 60 }}
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
                />
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    disableElevation
                    onClick={createList}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Adicionar coluna
                  </Button>
                  <IconButton size="small" onClick={() => setNewList(null)}>
                    <IconX size={18} />
                  </IconButton>
                </Stack>
              </Box>
            ) : (
              <Button
                fullWidth
                startIcon={<IconPlus size={16} />}
                onClick={() => setNewList('')}
                sx={(t) => ({
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  fontWeight: 700,
                  py: 1.25,
                  px: 1.5,
                  borderRadius: 3,
                  color: '#172b4d',
                  bgcolor: 'rgba(255,255,255,.55)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,.8)' },
                  ...t.applyStyles('dark', {
                    color: '#e2e8f0',
                    bgcolor: 'rgba(255,255,255,.08)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,.14)' }
                  })
                })}
              >
                Adicionar outra coluna
              </Button>
            )}
          </Box>
        ) : null}
      </Box>
      {board.truncated ? (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'warning.main' }}>
          Mostrando os primeiros 3.000 cartões em aberto. Use os filtros para achar o resto.
        </Typography>
      ) : null}

      {/* menu da coluna */}
      <Menu
        anchorEl={listMenu?.el}
        open={Boolean(listMenu)}
        onClose={() => setListMenu(null)}
        PaperProps={{ sx: { borderRadius: 2.5, minWidth: 240 } }}
      >
        {listMenu
          ? [
              <MenuItem
                key="add"
                onClick={() => {
                  setComposer({ listId: listMenu.list.id, text: '' });
                  setListMenu(null);
                }}
              >
                <ListItemIcon>
                  <IconPlus size={16} />
                </ListItemIcon>
                Adicionar cartão
              </MenuItem>,
              <MenuItem
                key="rename"
                onClick={() => {
                  setEditingList({ id: listMenu.list.id, name: listMenu.list.name });
                  setListMenu(null);
                }}
              >
                <ListItemIcon>
                  <IconPencil size={16} />
                </ListItemIcon>
                Renomear
              </MenuItem>,
              <MenuItem
                key="color"
                onClick={() => {
                  setColorPop({ el: listMenu.el, list: listMenu.list });
                  setListMenu(null);
                }}
              >
                <ListItemIcon>
                  <IconPalette size={16} />
                </ListItemIcon>
                Cor
              </MenuItem>,
              <MenuItem
                key="done"
                onClick={() => {
                  updateList(listMenu.list, { is_done: !listMenu.list.is_done });
                  setListMenu(null);
                }}
              >
                <ListItemIcon>
                  <IconCircleCheck size={16} />
                </ListItemIcon>
                {listMenu.list.is_done ? 'Deixar de ser coluna de concluídas' : 'Usar como coluna de concluídas'}
              </MenuItem>,
              <MenuItem
                key="left"
                disabled={board.lists[0]?.id === listMenu.list.id}
                onClick={() => {
                  shiftList(listMenu.list, -1);
                  setListMenu(null);
                }}
              >
                <ListItemIcon>
                  <IconArrowLeft size={16} />
                </ListItemIcon>
                Mover para a esquerda
              </MenuItem>,
              <MenuItem
                key="right"
                disabled={board.lists[board.lists.length - 1]?.id === listMenu.list.id}
                onClick={() => {
                  shiftList(listMenu.list, 1);
                  setListMenu(null);
                }}
              >
                <ListItemIcon>
                  <IconArrowRight size={16} />
                </ListItemIcon>
                Mover para a direita
              </MenuItem>,
              canManage ? <Divider key="d" /> : null,
              canManage ? (
                <MenuItem
                  key="clear"
                  disabled={!listMenu.list.total}
                  onClick={() => {
                    setConfirmClear(listMenu.list);
                    setListMenu(null);
                  }}
                >
                  <ListItemIcon>
                    <IconEraser size={16} />
                  </ListItemIcon>
                  Apagar todos os cartões
                </MenuItem>
              ) : null,
              canManage ? (
                <MenuItem
                  key="del"
                  disabled={board.lists.length <= 1}
                  onClick={() => {
                    const other = board.lists.find((l) => l.id !== listMenu.list.id);
                    setDelList({ list: listMenu.list, moveTo: other?.id || '' });
                    setListMenu(null);
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon sx={{ color: 'error.main' }}>
                    <IconTrash size={16} />
                  </ListItemIcon>
                  Apagar coluna
                </MenuItem>
              ) : null
            ]
          : null}
      </Menu>

      <Popover
        open={Boolean(colorPop)}
        anchorEl={colorPop?.el}
        onClose={() => setColorPop(null)}
        PaperProps={{ sx: { p: 1.5, borderRadius: 2.5 } }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 32px)', gap: 1 }}>
          {LIST_COLORS.map((c) => (
            <Box
              key={c}
              onClick={() => {
                updateList(colorPop.list, { color: c });
                setColorPop(null);
              }}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: c,
                cursor: 'pointer',
                outline: colorPop?.list.color === c ? '2px solid' : 'none',
                outlineColor: 'primary.main',
                outlineOffset: 2
              }}
            />
          ))}
        </Box>
      </Popover>

      <Popover
        open={Boolean(labelsPop)}
        anchorEl={labelsPop}
        onClose={() => setLabelsPop(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { borderRadius: 2.5, mt: 0.5 } }}
      >
        <LabelsEditor labels={board.labels} onChanged={() => load({ silent: true })} />
      </Popover>

      {/* detalhe do cartão */}
      <TaskCardDialog
        open={Boolean(openTask)}
        task={openTask}
        lists={board.lists}
        labels={board.labels}
        users={users}
        myId={myId}
        multi={multi}
        onClose={() => setOpenTask(null)}
        onChanged={upsertTask}
        onDeleted={(t) => dropTaskLocal(t.id)}
        onLabelsChanged={() => load({ silent: true })}
      />

      {/* nova tarefa (formulário completo) — entra na 1ª coluna aberta */}
      <TaskDialog open={creating} onClose={() => setCreating(false)} task={null} onSaved={upsertTask} />

      <TgConfirmDialog
        open={Boolean(delTask)}
        onClose={() => setDelTask(null)}
        onConfirm={confirmDelete}
        loading={delBusy}
        danger
        icon={IconTrash}
        title="Apagar este cartão?"
        message={
          delTask
            ? `"${delTask.title}" será apagado para toda a equipe${delTask.done ? ' (mesmo concluído)' : ''}. Não dá para desfazer.`
            : ''
        }
        confirmLabel="Apagar"
      />
      <TgConfirmDialog
        open={Boolean(confirmClear)}
        onClose={() => setConfirmClear(null)}
        onConfirm={clearList}
        loading={delBusy}
        danger
        icon={IconEraser}
        title={`Apagar todos os cartões de "${confirmClear?.name || ''}"?`}
        message={`${confirmClear?.total || 0} cartão(ões) serão apagados para toda a equipe. Não dá para desfazer.`}
        confirmLabel="Apagar todos"
      />

      <TgModal
        open={Boolean(delList)}
        onClose={() => !delBusy && setDelList(null)}
        title={`Apagar a coluna "${delList?.list.name || ''}"`}
        maxWidth="xs"
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ width: '100%' }}>
            <Button onClick={() => setDelList(null)} disabled={delBusy} sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            {delList?.list.total ? (
              <>
                <Button color="error" disabled={delBusy} onClick={() => deleteList('delete')} sx={{ textTransform: 'none' }}>
                  Apagar com os cartões
                </Button>
                <Button
                  variant="contained"
                  disableElevation
                  disabled={delBusy || !delList?.moveTo}
                  onClick={() => deleteList('move')}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Mover e apagar
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                color="error"
                disableElevation
                disabled={delBusy}
                onClick={() => deleteList('empty')}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Apagar coluna
              </Button>
            )}
          </Stack>
        }
      >
        {delList?.list.total ? (
          <Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
              A coluna tem {delList.list.total} cartão(ões). Para onde eles vão?
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              label="Mover os cartões para"
              value={delList.moveTo}
              onChange={(e) => setDelList((d) => ({ ...d, moveTo: e.target.value }))}
            >
              {board.lists
                .filter((l) => l.id !== delList.list.id)
                .map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name}
                  </MenuItem>
                ))}
            </TextField>
          </Box>
        ) : (
          <Typography variant="body2">A coluna está vazia e será apagada.</Typography>
        )}
      </TgModal>
    </Box>
  );
}

function DropSlot({ h }) {
  return (
    <Box
      sx={(t) => ({
        height: Math.max(40, Number(h) || 56),
        mb: 1,
        borderRadius: '10px',
        bgcolor: 'rgba(9,30,66,.08)',
        border: '2px dashed rgba(9,30,66,.18)',
        ...t.applyStyles('dark', { bgcolor: 'rgba(255,255,255,.05)', borderColor: 'rgba(255,255,255,.16)' })
      })}
    />
  );
}
