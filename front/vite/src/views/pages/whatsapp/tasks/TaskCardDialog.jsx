import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  IconAlignLeft,
  IconArrowsMove,
  IconBrandWhatsapp,
  IconCheck,
  IconCircleCheckFilled,
  IconClock,
  IconLayoutCards,
  IconPalette,
  IconPencil,
  IconPlus,
  IconSquareCheck,
  IconTag,
  IconTrash,
  IconUser,
  IconX
} from '@tabler/icons-react';

import { post, put, remove } from 'api/api';
import { TgConfirmDialog } from 'views/pages/telegram/ui';
import { THIN_SCROLL } from '../chat/chatKit';
import { WaNumberChip, brtLocalNow, brtLocalToIso, fmtDateBRT, isoToBrtLocal } from '../waKit';
import { errMsg } from '../waShared';
import { chatUrl } from '../crm/crmKit';
import { LABEL_COLORS, checklistStats, dueLabel, dueState, initials, inkOn, newId, personColor } from './taskKit';

// ============================================================================
// Detalhe do cartão (estilo Trello). Tudo salva na hora (PUT /whatsapp/tasks/:id): campos de texto ao sair
// do campo; etiquetas/responsável/prazo/checklist/capa ao mudar. Coluna = POST /:id/move (vale no celular,
// onde não há arrasto). Etiquetas da conta são geridas em <LabelsEditor/> (também usado pela barra do quadro).
// ============================================================================

const QUICK_DUE = [
  ['Hoje 18h', 'today18'],
  ['Amanhã 9h', 'tomorrow9'],
  ['Em 3 dias', 3 * 24 * 60],
  ['Em 1 semana', 7 * 24 * 60]
];
const quickDue = (v) => {
  if (typeof v === 'number') return brtLocalToIso(brtLocalNow(v).slice(0, 10) + 'T09:00');
  const base = brtLocalNow(0).slice(0, 10);
  if (v === 'today18') return brtLocalToIso(`${base}T18:00`);
  const d = new Date(`${base}T12:00:00-03:00`);
  d.setDate(d.getDate() + 1);
  return brtLocalToIso(`${isoToBrtLocal(d.toISOString()).slice(0, 10)}T09:00`);
};

function Section({ icon: Icon, title, action, children }) {
  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex', width: 22, justifyContent: 'center' }}>
          <Icon size={20} />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{title}</Typography>
        {action}
      </Stack>
      <Box sx={{ pl: { xs: 0, sm: 4.25 } }}>{children}</Box>
    </Box>
  );
}
Section.propTypes = { icon: PropTypes.elementType, title: PropTypes.node, action: PropTypes.node, children: PropTypes.node };

function SideButton({ icon: Icon, children, onClick, danger, active }) {
  return (
    <Button
      fullWidth
      size="small"
      onClick={onClick}
      startIcon={<Icon size={16} />}
      sx={(t) => ({
        justifyContent: 'flex-start',
        textTransform: 'none',
        fontWeight: 600,
        px: 1.25,
        py: 0.75,
        borderRadius: 2,
        color: danger ? 'error.main' : 'text.primary',
        bgcolor: active ? `rgba(${t.vars.palette.success.mainChannel} / .14)` : 'action.hover',
        '&:hover': { bgcolor: danger ? `rgba(${t.vars.palette.error.mainChannel} / .12)` : 'action.selected' }
      })}
    >
      {children}
    </Button>
  );
}
SideButton.propTypes = {
  icon: PropTypes.elementType,
  children: PropTypes.node,
  onClick: PropTypes.func,
  danger: PropTypes.bool,
  active: PropTypes.bool
};

// ---------------------------------------------------------------- etiquetas da conta
export function LabelsEditor({ labels, selected, onToggle, onChanged }) {
  const [editing, setEditing] = useState(null); // {id?, name, color}
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      if (editing.id) await put(`/whatsapp/tasks/labels/${editing.id}`, { name: editing.name, color: editing.color });
      else await post('/whatsapp/tasks/labels', { name: editing.name, color: editing.color });
      setEditing(null);
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar a etiqueta.'));
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    setBusy(true);
    try {
      await remove(`/whatsapp/tasks/labels/${editing.id}`);
      setEditing(null);
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível apagar.'));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <Box sx={{ p: 2, width: 300 }}>
        <Typography sx={{ fontWeight: 700, mb: 1.5, textAlign: 'center' }}>{editing.id ? 'Editar etiqueta' : 'Nova etiqueta'}</Typography>
        <Box
          sx={{
            height: 34,
            borderRadius: 1.5,
            bgcolor: editing.color,
            color: inkOn(editing.color),
            display: 'flex',
            alignItems: 'center',
            px: 1.5,
            fontWeight: 700,
            fontSize: 13,
            mb: 1.5
          }}
        >
          {editing.name}
        </Box>
        <TextField
          size="small"
          fullWidth
          autoFocus
          label="Nome (opcional)"
          value={editing.name}
          inputProps={{ maxLength: 40 }}
          onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5, mb: 0.75, fontWeight: 600 }}>
          Cor
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.75 }}>
          {LABEL_COLORS.map((c) => (
            <Box
              key={c}
              onClick={() => setEditing((x) => ({ ...x, color: c }))}
              sx={{
                height: 30,
                borderRadius: 1,
                bgcolor: c,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                color: inkOn(c),
                outline: editing.color === c ? '2px solid' : 'none',
                outlineColor: 'primary.main',
                outlineOffset: 2
              }}
            >
              {editing.color === c ? <IconCheck size={16} /> : null}
            </Box>
          ))}
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="contained" disableElevation disabled={busy} onClick={save} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Salvar
          </Button>
          <Button disabled={busy} onClick={() => setEditing(null)} sx={{ textTransform: 'none' }}>
            Voltar
          </Button>
          <Box sx={{ flex: 1 }} />
          {editing.id ? (
            <Button color="error" disabled={busy} onClick={del} sx={{ textTransform: 'none' }}>
              Apagar
            </Button>
          ) : null}
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, width: 300 }}>
      <Typography sx={{ fontWeight: 700, mb: 1.5, textAlign: 'center' }}>Etiquetas</Typography>
      <Stack spacing={0.75} sx={(th) => ({ maxHeight: 320, overflowY: 'auto', ...THIN_SCROLL(th) })}>
        {labels.map((l) => (
          <Stack key={l.id} direction="row" spacing={0.75} alignItems="center">
            {onToggle ? (
              <Checkbox size="small" checked={selected?.includes(l.id) || false} onChange={() => onToggle(l.id)} sx={{ p: 0.5 }} />
            ) : null}
            <Box
              onClick={() => (onToggle ? onToggle(l.id) : setEditing({ ...l }))}
              sx={{
                flex: 1,
                height: 32,
                borderRadius: 1,
                bgcolor: l.color,
                color: inkOn(l.color),
                display: 'flex',
                alignItems: 'center',
                px: 1.25,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                '&:hover': { filter: 'brightness(.95)' }
              }}
            >
              {l.name}
            </Box>
            <IconButton size="small" onClick={() => setEditing({ ...l })}>
              <IconPencil size={15} />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button
        fullWidth
        startIcon={<IconPlus size={16} />}
        onClick={() => setEditing({ name: '', color: LABEL_COLORS[5] })}
        sx={{ mt: 1.5, textTransform: 'none', fontWeight: 600, bgcolor: 'action.hover' }}
      >
        Criar etiqueta
      </Button>
    </Box>
  );
}
LabelsEditor.propTypes = { labels: PropTypes.array, selected: PropTypes.array, onToggle: PropTypes.func, onChanged: PropTypes.func };

// ---------------------------------------------------------------- diálogo
export default function TaskCardDialog({ open, task, lists, labels, users, myId, multi, onClose, onChanged, onDeleted, onLabelsChanged }) {
  const theme = useTheme();
  const xs = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const [t, setT] = useState(task);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [editDesc, setEditDesc] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const [pop, setPop] = useState(null); // {kind, el}
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!open || !task) return;
    setT(task);
    setTitle(task.title || '');
    setDesc(task.description || '');
    setEditDesc(false);
    setNewItem('');
  }, [open, task]);

  const labelsById = useMemo(() => new Map((labels || []).map((l) => [l.id, l])), [labels]);
  if (!t) return null;
  const list = lists.find((l) => l.id === t.list_id);
  const cl = checklistStats(t);
  const ds = dueState(t);
  const items = Array.isArray(t.checklist) ? t.checklist : [];

  const patch = async (body, optimistic) => {
    const prev = t;
    if (optimistic) setT((x) => ({ ...x, ...optimistic }));
    try {
      const r = await put(`/whatsapp/tasks/${t.id}`, body);
      setT(r);
      onChanged?.(r);
      return r;
    } catch (e) {
      setT(prev);
      toast.error(errMsg(e, 'Não foi possível salvar.'));
      return null;
    }
  };
  const saveTitle = () => {
    const v = title.trim();
    if (!v) return setTitle(t.title);
    if (v !== t.title) patch({ title: v }, { title: v });
  };
  const saveDesc = () => {
    setEditDesc(false);
    if (desc.trim() !== (t.description || '')) patch({ description: desc.trim() || null }, { description: desc.trim() });
  };
  const setChecklist = (next) => patch({ checklist: next }, { checklist: next });
  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    setNewItem('');
    setChecklist([...items, { id: newId(), text: v, done: false }]);
  };
  const toggleLabel = (id) => {
    const cur = t.label_ids || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    patch({ label_ids: next }, { label_ids: next });
  };
  const moveTo = async (listId) => {
    if (listId === t.list_id) return;
    setBusy(true);
    try {
      const r = await post(`/whatsapp/tasks/${t.id}/move`, { list_id: listId });
      setT(r);
      onChanged?.(r);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível mover.'));
    } finally {
      setBusy(false);
    }
  };
  const toggleDone = async () => {
    setBusy(true);
    try {
      const r = await post(`/whatsapp/tasks/${t.id}/${t.done ? 'reopen' : 'done'}`);
      setT(r);
      onChanged?.(r);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível atualizar.'));
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    setBusy(true);
    try {
      await remove(`/whatsapp/tasks/${t.id}`);
      toast.success('Cartão apagado.');
      setConfirmDel(false);
      onDeleted?.(t);
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível apagar.'));
    } finally {
      setBusy(false);
    }
  };
  const openPop = (kind) => (e) => setPop({ kind, el: e.currentTarget });
  const visibleItems = hideDone ? items.filter((i) => !i.done) : items;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={xs}
      PaperProps={{ sx: { p: 0, borderRadius: { xs: 0, sm: 3 }, overflow: 'hidden', bgcolor: 'background.paper' } }}
    >
      {t.cover ? (
        <Box sx={{ height: 96, bgcolor: t.cover, position: 'relative', flexShrink: 0 }}>
          <Button
            size="small"
            startIcon={<IconPalette size={15} />}
            onClick={openPop('cover')}
            sx={{
              position: 'absolute',
              right: 56,
              bottom: 10,
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: 'rgba(255,255,255,.85)',
              color: '#172b4d',
              '&:hover': { bgcolor: '#fff' }
            }}
          >
            Capa
          </Button>
        </Box>
      ) : null}
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 2,
          bgcolor: t.cover ? 'rgba(255,255,255,.85)' : 'transparent',
          '&:hover': { bgcolor: t.cover ? '#fff' : 'action.hover' }
        }}
      >
        <IconX size={20} />
      </IconButton>

      <Box sx={{ overflowY: 'auto', ...THIN_SCROLL(theme), px: { xs: 2, sm: 3 }, pt: 2.5, pb: 3 }}>
        {/* título */}
        <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ pr: 5 }}>
          <Tooltip title={t.done ? 'Reabrir' : 'Marcar como concluída'}>
            <IconButton onClick={toggleDone} disabled={busy} sx={{ mt: 0.25, p: 0.5, color: t.done ? '#22a06b' : 'text.secondary' }}>
              {t.done ? <IconCircleCheckFilled size={24} /> : <IconSquareCheck size={24} />}
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <InputBase
              inputRef={titleRef}
              fullWidth
              multiline
              value={title}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  titleRef.current?.blur();
                }
              }}
              inputProps={{ maxLength: 160 }}
              sx={{
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1.3,
                px: 0.75,
                borderRadius: 1.5,
                '&.Mui-focused': { boxShadow: (th) => `inset 0 0 0 2px ${th.vars.palette.primary.main}` }
              }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', px: 0.75, mt: 0.25 }}>
              na coluna{' '}
              <Box
                component="span"
                onClick={openPop('move')}
                sx={{ fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', color: 'text.primary' }}
              >
                {list?.name || '—'}
              </Box>
              {t.done && t.done_at ? ` · concluída ${fmtDateBRT(t.done_at)}${t.done_by?.name ? ` por ${t.done_by.name}` : ''}` : ''}
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) 190px' }, mt: 1 }}>
          {/* coluna principal */}
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap" sx={{ mt: 2, pl: { xs: 0, sm: 4.25 } }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Etiquetas
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {(t.label_ids || [])
                    .map((id) => labelsById.get(id))
                    .filter(Boolean)
                    .map((l) => (
                      <Box
                        key={l.id}
                        onClick={openPop('labels')}
                        sx={{
                          height: 32,
                          minWidth: 48,
                          px: 1.25,
                          borderRadius: 1,
                          bgcolor: l.color,
                          color: inkOn(l.color),
                          display: 'flex',
                          alignItems: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        {l.name}
                      </Box>
                    ))}
                  <IconButton onClick={openPop('labels')} sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: 'action.hover' }}>
                    <IconPlus size={16} />
                  </IconButton>
                </Stack>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Responsável
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    onClick={openPop('member')}
                    avatar={
                      t.assigned_user ? (
                        <Box
                          sx={{
                            borderRadius: '50%',
                            bgcolor: personColor(t.assigned_user.id),
                            color: '#fff !important',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 11,
                            fontWeight: 800
                          }}
                        >
                          {initials(t.assigned_user.name)}
                        </Box>
                      ) : undefined
                    }
                    icon={t.assigned_user ? undefined : <IconUser size={16} />}
                    label={
                      t.assigned_user ? (t.assigned_user.id === myId ? `${t.assigned_user.name} (você)` : t.assigned_user.name) : 'Ninguém'
                    }
                    sx={{ height: 32, borderRadius: 1.5, fontWeight: 600 }}
                  />
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Prazo
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    onClick={openPop('due')}
                    icon={<IconClock size={16} />}
                    label={
                      t.due_at ? `${dueLabel(t.due_at)}${ds === 'overdue' ? ' · atrasada' : ds === 'today' ? ' · hoje' : ''}` : 'Sem prazo'
                    }
                    color={ds === 'overdue' ? 'error' : ds === 'done' ? 'success' : ds === 'today' ? 'warning' : 'default'}
                    variant={ds === 'overdue' || ds === 'done' || ds === 'today' ? 'filled' : 'outlined'}
                    sx={{ height: 32, borderRadius: 1.5, fontWeight: 600 }}
                  />
                </Box>
              </Box>
              {t.chat ? (
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Conversa
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                    {multi && t.chat.session ? <WaNumberChip session={t.chat.session} /> : null}
                    <Chip
                      icon={<IconBrandWhatsapp size={16} />}
                      label={t.chat.name || t.chat.phone || 'Conversa'}
                      onClick={t.chat.chat_id ? () => navigate(chatUrl(t.chat.chat_id)) : undefined}
                      disabled={!t.chat.chat_id}
                      sx={{
                        height: 32,
                        borderRadius: 1.5,
                        fontWeight: 600,
                        maxWidth: 240,
                        color: '#1f9c56',
                        '& .MuiChip-icon': { color: '#1f9c56' }
                      }}
                    />
                  </Stack>
                </Box>
              ) : null}
            </Stack>

            {/* descrição */}
            <Section
              icon={IconAlignLeft}
              title="Descrição"
              action={
                !editDesc && t.description ? (
                  <Button
                    size="small"
                    onClick={() => setEditDesc(true)}
                    sx={{ textTransform: 'none', fontWeight: 600, bgcolor: 'action.hover' }}
                  >
                    Editar
                  </Button>
                ) : null
              }
            >
              {editDesc || !t.description ? (
                editDesc ? (
                  <Box>
                    <TextField
                      multiline
                      minRows={4}
                      fullWidth
                      autoFocus
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      inputProps={{ maxLength: 4000 }}
                      placeholder="Detalhes, combinados, links…"
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button variant="contained" disableElevation onClick={saveDesc} sx={{ textTransform: 'none', fontWeight: 700 }}>
                        Salvar
                      </Button>
                      <Button
                        onClick={() => {
                          setDesc(t.description || '');
                          setEditDesc(false);
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        Cancelar
                      </Button>
                    </Stack>
                  </Box>
                ) : (
                  <Box
                    onClick={() => setEditDesc(true)}
                    sx={{
                      p: 1.5,
                      minHeight: 56,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      color: 'text.secondary',
                      fontSize: 14,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.selected' }
                    }}
                  >
                    Adicione uma descrição mais detalhada…
                  </Box>
                )
              ) : (
                <Typography
                  onClick={() => setEditDesc(true)}
                  sx={{ whiteSpace: 'pre-wrap', fontSize: 14, cursor: 'pointer', wordBreak: 'break-word' }}
                >
                  {t.description}
                </Typography>
              )}
            </Section>

            {/* checklist */}
            <Section
              icon={IconSquareCheck}
              title="Checklist"
              action={
                cl.done ? (
                  <Button
                    size="small"
                    onClick={() => setHideDone((v) => !v)}
                    sx={{ textTransform: 'none', fontWeight: 600, bgcolor: 'action.hover' }}
                  >
                    {hideDone ? `Mostrar marcados (${cl.done})` : 'Ocultar marcados'}
                  </Button>
                ) : null
              }
            >
              {cl.total ? (
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ width: 32, fontWeight: 700, color: 'text.secondary' }}>
                    {Math.round((cl.done / cl.total) * 100)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(cl.done / cl.total) * 100}
                    color={cl.complete ? 'success' : 'primary'}
                    sx={{ flex: 1, height: 8, borderRadius: 4 }}
                  />
                </Stack>
              ) : null}
              <Stack spacing={0.25}>
                {visibleItems.map((it) => (
                  <Stack
                    key={it.id}
                    direction="row"
                    alignItems="center"
                    spacing={0.5}
                    sx={{ borderRadius: 1.5, '&:hover': { bgcolor: 'action.hover' }, '&:hover .ci-del': { opacity: 1 } }}
                  >
                    <Checkbox
                      size="small"
                      checked={Boolean(it.done)}
                      onChange={() => setChecklist(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
                      sx={{ color: 'text.secondary', '&.Mui-checked': { color: 'success.main' } }}
                    />
                    <InputBase
                      fullWidth
                      defaultValue={it.text}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!v) setChecklist(items.filter((x) => x.id !== it.id));
                        else if (v !== it.text) setChecklist(items.map((x) => (x.id === it.id ? { ...x, text: v } : x)));
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      inputProps={{ maxLength: 300 }}
                      sx={{
                        fontSize: 14,
                        textDecoration: it.done ? 'line-through' : 'none',
                        color: it.done ? 'text.secondary' : 'text.primary'
                      }}
                    />
                    <IconButton
                      className="ci-del"
                      size="small"
                      onClick={() => setChecklist(items.filter((x) => x.id !== it.id))}
                      sx={{ opacity: { xs: 1, md: 0 } }}
                    >
                      <IconTrash size={15} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Adicionar um item"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  inputProps={{ maxLength: 300 }}
                />
                <Button
                  variant="contained"
                  disableElevation
                  onClick={addItem}
                  disabled={!newItem.trim()}
                  sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
                >
                  Adicionar
                </Button>
              </Stack>
            </Section>

            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 3, pl: { xs: 0, sm: 4.25 } }}>
              Criada {fmtDateBRT(t.created_at)}
              {t.created_by?.name ? ` por ${t.created_by.name}` : ''}
            </Typography>
          </Box>

          {/* ações */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75, mt: { xs: 0, md: 2 } }}
            >
              Adicionar ao cartão
            </Typography>
            <Stack spacing={0.75}>
              <SideButton icon={IconTag} onClick={openPop('labels')}>
                Etiquetas
              </SideButton>
              <SideButton icon={IconUser} onClick={openPop('member')}>
                Responsável
              </SideButton>
              <SideButton icon={IconClock} onClick={openPop('due')}>
                Prazo
              </SideButton>
              <SideButton icon={IconPalette} onClick={openPop('cover')}>
                Capa
              </SideButton>
            </Stack>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75, mt: 2 }}>
              Ações
            </Typography>
            <Stack spacing={0.75}>
              <SideButton icon={t.done ? IconCircleCheckFilled : IconCheck} onClick={toggleDone} active={t.done}>
                {t.done ? 'Reabrir' : 'Concluir'}
              </SideButton>
              <SideButton icon={IconArrowsMove} onClick={openPop('move')}>
                Mover
              </SideButton>
              <SideButton icon={IconTrash} onClick={() => setConfirmDel(true)} danger>
                Apagar
              </SideButton>
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* popovers */}
      <Popover
        open={Boolean(pop)}
        anchorEl={pop?.el}
        onClose={() => setPop(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: { borderRadius: 2.5, mt: 0.5 } }}
      >
        {pop?.kind === 'labels' ? (
          <LabelsEditor labels={labels} selected={t.label_ids || []} onToggle={toggleLabel} onChanged={onLabelsChanged} />
        ) : null}
        {pop?.kind === 'member' ? (
          <Box sx={{ p: 1, width: 260 }}>
            <Typography sx={{ fontWeight: 700, p: 1, textAlign: 'center' }}>Responsável</Typography>
            {[{ id: '', name: 'Ninguém' }, ...users].map((u) => (
              <MenuItem
                key={u.id || 'none'}
                selected={(t.assigned_user?.id || '') === u.id}
                onClick={() => {
                  setPop(null);
                  patch({ assigned_user_id: u.id || null }, { assigned_user: u.id ? { id: u.id, name: u.name } : null });
                }}
                sx={{ borderRadius: 1.5, gap: 1 }}
              >
                {u.id ? (
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      bgcolor: personColor(u.id),
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11,
                      fontWeight: 800
                    }}
                  >
                    {initials(u.name)}
                  </Box>
                ) : (
                  <Box sx={{ width: 26, height: 26, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
                    <IconUser size={16} />
                  </Box>
                )}
                {u.name}
                {u.id === myId ? ' (você)' : ''}
              </MenuItem>
            ))}
          </Box>
        ) : null}
        {pop?.kind === 'due' ? (
          <Box sx={{ p: 2, width: 290 }}>
            <Typography sx={{ fontWeight: 700, mb: 1.5, textAlign: 'center' }}>Prazo</Typography>
            <TextField
              type="datetime-local"
              size="small"
              fullWidth
              value={t.due_at ? isoToBrtLocal(t.due_at) : ''}
              onChange={(e) =>
                e.target.value && patch({ due_at: brtLocalToIso(e.target.value) }, { due_at: brtLocalToIso(e.target.value) })
              }
              InputLabelProps={{ shrink: true }}
              label="Data e hora (Brasília)"
            />
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
              {QUICK_DUE.map(([label, v]) => (
                <Chip
                  key={label}
                  size="small"
                  label={label}
                  onClick={() => {
                    const iso = quickDue(v);
                    patch({ due_at: iso }, { due_at: iso });
                    setPop(null);
                  }}
                />
              ))}
            </Stack>
            {t.due_at ? (
              <Button
                fullWidth
                color="error"
                onClick={() => {
                  patch({ due_at: null }, { due_at: null });
                  setPop(null);
                }}
                sx={{ mt: 1.5, textTransform: 'none', bgcolor: 'action.hover' }}
              >
                Remover prazo
              </Button>
            ) : null}
          </Box>
        ) : null}
        {pop?.kind === 'cover' ? (
          <Box sx={{ p: 2, width: 280 }}>
            <Typography sx={{ fontWeight: 700, mb: 1.5, textAlign: 'center' }}>Capa</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.75 }}>
              {LABEL_COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => patch({ cover: c }, { cover: c })}
                  sx={{
                    height: 36,
                    borderRadius: 1,
                    bgcolor: c,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    color: inkOn(c),
                    outline: t.cover === c ? '2px solid' : 'none',
                    outlineColor: 'primary.main',
                    outlineOffset: 2
                  }}
                >
                  {t.cover === c ? <IconCheck size={16} /> : null}
                </Box>
              ))}
            </Box>
            {t.cover ? (
              <Button
                fullWidth
                onClick={() => {
                  patch({ cover: null }, { cover: null });
                  setPop(null);
                }}
                sx={{ mt: 1.5, textTransform: 'none', bgcolor: 'action.hover' }}
              >
                Remover capa
              </Button>
            ) : null}
          </Box>
        ) : null}
        {pop?.kind === 'move' ? (
          <Box sx={{ p: 1, width: 260 }}>
            <Typography sx={{ fontWeight: 700, p: 1, textAlign: 'center' }}>Mover para</Typography>
            {lists.map((l) => (
              <MenuItem
                key={l.id}
                selected={l.id === t.list_id}
                disabled={busy}
                onClick={() => {
                  setPop(null);
                  moveTo(l.id);
                }}
                sx={{ borderRadius: 1.5, gap: 1 }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: l.color || 'grey.500' }} />
                <Box sx={{ flex: 1 }}>{l.name}</Box>
                {l.is_done ? <IconLayoutCards size={14} /> : null}
              </MenuItem>
            ))}
          </Box>
        ) : null}
      </Popover>

      <TgConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={del}
        loading={busy}
        danger
        icon={IconTrash}
        title="Apagar este cartão?"
        message={`"${t.title}" será apagado para toda a equipe. Não dá para desfazer.`}
        confirmLabel="Apagar"
      />
    </Dialog>
  );
}

TaskCardDialog.propTypes = {
  open: PropTypes.bool,
  task: PropTypes.object,
  lists: PropTypes.array,
  labels: PropTypes.array,
  users: PropTypes.array,
  myId: PropTypes.string,
  multi: PropTypes.bool,
  onClose: PropTypes.func,
  onChanged: PropTypes.func,
  onDeleted: PropTypes.func,
  onLabelsChanged: PropTypes.func
};
