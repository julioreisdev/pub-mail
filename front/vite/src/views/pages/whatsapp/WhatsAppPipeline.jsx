import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconArrowRight,
  IconCash,
  IconCheck,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutKanban,
  IconMessage,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconTrophy,
  IconX,
  IconBolt
} from '@tabler/icons-react';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgAvatar, TgCard, TgEmptyState, TgFilterBar, TgListSkeleton } from 'views/pages/telegram/ui';
import WaChatPicker from './WaChatPicker';
import { WaNumberChip, WaPageHeader, useNow, useWaSessions } from './waKit';
import { errMsg, fmtAgo, fmtPhone, tint } from './waShared';
import { CrmKpi, CrmModal, MoneyField, WaNumberFilter, chatUrl, formatBRL, useSessionFilter, useXs, waPrimaryBtn } from './crm/crmKit';

// ============================================================================
// WhatsApp → Funil (Kanban): colunas = etapas (por org), cards = conversas.
// Arrastar entre colunas (HTML5 DnD) ou menu "Mover para…". Etapa pode disparar
// ações ao receber uma conversa (mensagem, etiquetas, tarefa) — configuradas no
// diálogo da etapa (dono/admin).
// Multi-número: `chat_id` dos cards = uuid da conversa (o jid vem em `jid`); filtro
// "Número" (?session=) no quadro e chip do número em cada card quando a org tem > 1.
// ============================================================================

const COLORS = ['#3B82F6', '#06B6D4', '#F59E0B', '#8B5CF6', '#EC4899', '#22C55E', '#EF4444', '#64748B'];

// ----------------------------------------------------------------------------
function StageDialog({ open, onClose, stage, tags, onSaved }) {
  const [f, setF] = useState({
    name: '',
    color: COLORS[0],
    kind: 'open',
    send_text: '',
    add_tags: [],
    remove_tags: [],
    task_title: '',
    task_days: 1
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const a = stage?.actions || {};
    setF({
      name: stage?.name || '',
      color: stage?.color || COLORS[0],
      kind: stage?.kind || 'open',
      send_text: a.send_text || '',
      add_tags: a.add_tags || [],
      remove_tags: a.remove_tags || [],
      task_title: a.task?.title || '',
      task_days: a.task?.days ?? 1
    });
  }, [open, stage]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const tagOf = (id) => tags.find((t) => t.id === id);
  const save = async () => {
    if (!f.name.trim()) return toast.error('Dê um nome à etapa.');
    setBusy(true);
    try {
      const body = {
        name: f.name.trim(),
        color: f.color,
        kind: f.kind,
        actions: {
          send_text: f.send_text.trim() || undefined,
          add_tags: f.add_tags,
          remove_tags: f.remove_tags,
          task: f.task_title.trim() ? { title: f.task_title.trim(), days: f.task_days } : null
        }
      };
      const r = stage ? await put(`/whatsapp/pipeline/stages/${stage.id}`, body) : await post('/whatsapp/pipeline/stages', body);
      toast.success(stage ? 'Etapa atualizada.' : 'Etapa criada.');
      onSaved?.(r);
      onClose();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar a etapa.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose()}
      title={stage ? 'Editar etapa' : 'Nova etapa'}
      subtitle="Ao receber uma conversa, a etapa pode enviar uma mensagem, mudar etiquetas e criar uma tarefa."
      maxWidth="sm"
      disableClose={busy}
      footer={
        <>
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Nome"
            value={f.name}
            onChange={(e) => set('name', e.target.value.slice(0, 60))}
            fullWidth
            autoFocus
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={f.kind}
            onChange={(e) => set('kind', e.target.value)}
            sx={{ minWidth: { sm: 170 }, width: { xs: '100%', sm: 'auto' } }}
          >
            <MenuItem value="open">Em andamento</MenuItem>
            <MenuItem value="won">Ganho (fechou)</MenuItem>
            <MenuItem value="lost">Perdido</MenuItem>
          </TextField>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
            Cor
          </Typography>
          {COLORS.map((c) => (
            <Box
              key={c}
              onClick={() => set('color', c)}
              role="button"
              aria-label={`Cor ${c}`}
              sx={{
                width: { xs: 30, sm: 22 },
                height: { xs: 30, sm: 22 },
                borderRadius: '50%',
                bgcolor: c,
                cursor: 'pointer',
                outline: f.color === c ? '3px solid' : '2px solid transparent',
                outlineColor: f.color === c ? 'text.primary' : 'transparent',
                outlineOffset: 1
              }}
            />
          ))}
        </Stack>
        <Divider>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Ações ao entrar nesta etapa (opcional)
          </Typography>
        </Divider>
        <TextField
          size="small"
          label="Enviar mensagem ao cliente"
          value={f.send_text}
          onChange={(e) => set('send_text', e.target.value.slice(0, 2000))}
          fullWidth
          multiline
          minRows={2}
          maxRows={5}
          helperText="Aceita {{nome}}, {{cliente.produto}} etc. Vazio = não envia."
        />
        <Autocomplete
          multiple
          size="small"
          options={tags}
          value={f.add_tags.map(tagOf).filter(Boolean)}
          onChange={(_, v) =>
            set(
              'add_tags',
              v.map((t) => t.id)
            )
          }
          getOptionLabel={(t) => t.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(p) => <TextField {...p} label="Aplicar etiquetas" />}
          renderTags={(v, getProps) =>
            v.map((t, i) => (
              <Chip
                {...getProps({ index: i })}
                key={t.id}
                size="small"
                label={t.name}
                sx={{ bgcolor: t.color, color: '#fff', fontWeight: 700 }}
              />
            ))
          }
        />
        <Autocomplete
          multiple
          size="small"
          options={tags}
          value={f.remove_tags.map(tagOf).filter(Boolean)}
          onChange={(_, v) =>
            set(
              'remove_tags',
              v.map((t) => t.id)
            )
          }
          getOptionLabel={(t) => t.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(p) => <TextField {...p} label="Remover etiquetas" />}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Criar tarefa (título)"
            value={f.task_title}
            onChange={(e) => set('task_title', e.target.value.slice(0, 160))}
            fullWidth
            placeholder="Ex.: Fazer follow-up da proposta"
          />
          <TextField
            size="small"
            type="number"
            label="Prazo"
            value={f.task_days}
            onChange={(e) => set('task_days', Math.max(0, Math.min(365, parseInt(e.target.value || '0', 10) || 0)))}
            sx={{ width: { xs: '100%', sm: 150 }, flexShrink: 0 }}
            InputProps={{ endAdornment: <InputAdornment position="end">dias</InputAdornment> }}
            inputProps={{ min: 0, max: 365 }}
          />
        </Stack>
      </Stack>
    </CrmModal>
  );
}

// ----------------------------------------------------------------------------
function AutomationDialog({ open, onClose, stages }) {
  const [f, setF] = useState({ auto_enter_stage_id: '', paid_stage_id: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    get('/whatsapp/pipeline/automation')
      .then((r) => setF({ auto_enter_stage_id: r?.auto_enter_stage_id || '', paid_stage_id: r?.paid_stage_id || '' }))
      .catch(() => undefined);
  }, [open]);
  const save = async () => {
    setBusy(true);
    try {
      await put('/whatsapp/pipeline/automation', {
        auto_enter_stage_id: f.auto_enter_stage_id || null,
        paid_stage_id: f.paid_stage_id || null
      });
      toast.success('Automação salva.');
      onClose();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
  };
  const sel = (k, label, help) => (
    <TextField
      select
      size="small"
      label={label}
      value={f[k]}
      onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))}
      fullWidth
      helperText={help}
    >
      <MenuItem value="">
        <em>Desligado</em>
      </MenuItem>
      {stages.map((s) => (
        <MenuItem key={s.id} value={s.id}>
          <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: s.color, mr: 1 }} />
          {s.name}
        </MenuItem>
      ))}
    </TextField>
  );
  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Automação do funil"
      subtitle="Conversas entram e avançam sozinhas."
      maxWidth="sm"
      footer={
        <>
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
      <Stack spacing={2}>
        {sel(
          'auto_enter_stage_id',
          'Entrada automática',
          'Toda conversa individual que mandar mensagem e nunca esteve no funil entra nesta etapa (as ações da etapa rodam normalmente).'
        )}
        {sel('paid_stage_id', 'Cobrança paga → etapa', 'Quando uma cobrança do CRM é paga, a conversa vai para esta etapa (ex.: Fechado).')}
      </Stack>
    </CrmModal>
  );
}

// ----------------------------------------------------------------------------
function DealDialog({ open, onClose, card, onSaved }) {
  const [cents, setCents] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setCents(card?.deal_cents || 0);
  }, [open, card]);
  const save = async () => {
    setBusy(true);
    try {
      const r = await put('/whatsapp/pipeline/deal', { chat_id: card.chat_id, deal_cents: cents || null });
      onSaved?.(r);
      onClose();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar o valor.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Valor estimado"
      subtitle={card?.session ? `${card?.name || ''} · ${card.session.label || ''}` : card?.name}
      maxWidth="xs"
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button variant="contained" disableElevation onClick={save} disabled={busy} sx={waPrimaryBtn}>
            Salvar
          </Button>
        </>
      }
    >
      <MoneyField
        label="Valor da oportunidade"
        valueCents={cents}
        onChange={setCents}
        autoFocus
        helperText="Soma por etapa aparece no topo da coluna. Zero = sem valor."
      />
    </CrmModal>
  );
}

// ----------------------------------------------------------------------------
function AddChatDialog({ open, onClose, stages, defaultStage, onDone, sessions, initialSessionId }) {
  const [picked, setPicked] = useState([]);
  const [stageId, setStageId] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setPicked([]);
      setStageId(defaultStage || stages[0]?.id || '');
    }
  }, [open, defaultStage, stages]);
  const save = async () => {
    if (!picked.length) return toast.error('Escolha pelo menos uma conversa.');
    if (!stageId) return toast.error('Escolha a etapa.');
    setBusy(true);
    let ok = 0;
    for (const c of picked) {
      try {
        await post('/whatsapp/pipeline/move', { chat_id: c.chat_id, stage_id: stageId });
        ok += 1;
      } catch (e) {
        toast.error(errMsg(e, `Falha em ${c.name || c.chat_id}`));
      }
    }
    setBusy(false);
    if (ok) toast.success(`${ok} conversa${ok === 1 ? '' : 's'} no funil.`);
    onDone?.();
    onClose();
    return undefined;
  };
  return (
    <CrmModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Adicionar conversas ao funil"
      maxWidth="sm"
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={busy || !picked.length}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconPlus size={16} />}
            sx={waPrimaryBtn}
          >
            Adicionar {picked.length ? `(${picked.length})` : ''}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <TextField select size="small" label="Etapa" value={stageId} onChange={(e) => setStageId(e.target.value)} fullWidth>
          {stages.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: s.color, mr: 1 }} />
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <WaChatPicker value={picked} onChange={setPicked} listHeight={320} sessions={sessions} initialSessionId={initialSessionId} />
      </Stack>
    </CrmModal>
  );
}

// ----------------------------------------------------------------------------
function Card({ c, now, onOpen, onMenu, dragging, multi }) {
  const stale = c.last_message_at ? Date.now() - new Date(c.last_message_at).getTime() > 3 * 86400000 : false;
  return (
    <Box
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/wa-chat', c.chat_id);
        e.dataTransfer.effectAllowed = 'move';
        dragging.current = c;
      }}
      onDragEnd={() => {
        dragging.current = null;
      }}
      onClick={() => onOpen(c)}
      sx={{
        p: 1.25,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'box-shadow .15s, transform .15s',
        '&:hover': { boxShadow: 3, transform: 'translateY(-1px)' },
        '&:active': { cursor: 'grabbing' }
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <IconGripVertical size={14} style={{ opacity: 0.35, marginTop: 4, flexShrink: 0 }} />
        <TgAvatar name={c.name} size={34} kind={c.kind === 'group' ? 'group' : 'contact'} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
              {c.name}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMenu(e, c);
              }}
              sx={{ p: { xs: 0.75, md: 0.25 }, mr: { xs: -1, md: -0.5 }, mt: { xs: -0.5, md: 0 } }}
            >
              <IconDotsVertical size={15} />
            </IconButton>
          </Stack>
          {c.phone ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
              {fmtPhone(c.phone)}
            </Typography>
          ) : null}
          {c.last_message_preview ? (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                mt: 0.25
              }}
            >
              {c.last_message_preview}
            </Typography>
          ) : null}
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
            {multi && c.session ? <WaNumberChip session={c.session} /> : null}
            {c.deal_cents ? (
              <Chip
                size="small"
                icon={<IconCash size={12} />}
                label={formatBRL(c.deal_cents)}
                sx={{
                  height: 20,
                  fontWeight: 800,
                  fontSize: 11,
                  bgcolor: (t) => tint(t, 'success', 0.14),
                  '& .MuiChip-icon': { color: 'success.main' }
                }}
              />
            ) : null}
            {(c.tags || []).slice(0, 3).map((t) => (
              <Chip
                key={t.id}
                size="small"
                label={t.name}
                sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: t.color, color: '#fff' }}
              />
            ))}
            {c.service?.assigned_user ? (
              <Tooltip title={`Responsável: ${c.service.assigned_user.name || ''}`}>
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  {(c.service.assigned_user.name || '?').trim().charAt(0).toUpperCase()}
                </Box>
              </Tooltip>
            ) : null}
            <Box sx={{ flex: 1 }} />
            {c.unread_count ? (
              <Chip
                size="small"
                label={c.unread_count}
                sx={{ height: 18, fontSize: 10, fontWeight: 800, bgcolor: 'success.main', color: '#fff' }}
              />
            ) : null}
            <Typography variant="caption" sx={{ color: stale ? 'warning.main' : 'text.disabled', fontSize: 10 }}>
              {c.last_message_at ? fmtAgo(c.last_message_at) : ''}
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

// ============================================================================
export default function WhatsAppPipeline() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAdmin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const xs = useXs();
  const now = useNow(30000);
  const { sessions } = useWaSessions(30000);
  const { value: sessionId, set: setSessionId, multi } = useSessionFilter(sessions);
  const [board, setBoard] = useState(null);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [mine, setMine] = useState(false);
  const [stageDlg, setStageDlg] = useState(null); // {stage?}
  const [delStage, setDelStage] = useState(null); // {stage, moveTo}
  const [dealDlg, setDealDlg] = useState(null); // card
  const [addDlg, setAddDlg] = useState(null); // {stageId}
  const [autoDlg, setAutoDlg] = useState(false);
  const [cardMenu, setCardMenu] = useState(null); // {anchor, card}
  const [colMenu, setColMenu] = useState(null); // {anchor, stage}
  const [over, setOver] = useState(null);
  const dragging = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    get('/whatsapp/tags')
      .then((r) => setTags(Array.isArray(r) ? r : []))
      .catch(() => setTags([]));
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const s = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const r = await get('/whatsapp/pipeline/board', {
          params: { q: debouncedQ || undefined, assigned: mine ? 'me' : undefined, session_id: sessionId || undefined, per: 40 }
        });
        if (s !== seq.current) return;
        setBoard(r);
      } catch (e) {
        if (s === seq.current && !silent) toast.error(errMsg(e, 'Falha ao carregar o funil.'));
      } finally {
        if (s === seq.current) setLoading(false);
      }
    },
    [debouncedQ, mine, sessionId]
  );
  useEffect(() => {
    load();
  }, [load]);

  // tempo real: conversa mudou (etapa, valor, prévia…) → recarrega de leve (agrupado)
  const reloadT = useRef(null);
  const scheduleReload = useCallback(() => {
    if (reloadT.current) return;
    reloadT.current = window.setTimeout(() => {
      reloadT.current = null;
      load({ silent: true });
    }, 800);
  }, [load]);
  useRealtimeEvent('wa:chat', (p) => {
    if (!sessionId || !p?.session_id || p.session_id === sessionId) scheduleReload();
  });
  useRealtimeEvent('wa:sync', (p) => p?.kind === 'pipeline' && scheduleReload());

  const stages = useMemo(() => board?.columns.map((c) => c.stage) || [], [board]);
  const openChat = (c) => navigate(chatUrl(c.chat_id));

  const moveTo = async (card, stageId) => {
    if (!card || (card.stage_id || null) === (stageId || null)) return;
    // otimista
    setBoard((b) => {
      if (!b) return b;
      const cols = b.columns.map((col) => ({
        ...col,
        cards: col.cards.filter((x) => x.chat_id !== card.chat_id),
        total: col.cards.some((x) => x.chat_id === card.chat_id) ? col.total - 1 : col.total
      }));
      const idx = cols.findIndex((col) => col.stage.id === stageId);
      if (idx >= 0) cols[idx] = { ...cols[idx], cards: [{ ...card, stage_id: stageId }, ...cols[idx].cards], total: cols[idx].total + 1 };
      return { ...b, columns: cols };
    });
    try {
      await post('/whatsapp/pipeline/move', { chat_id: card.chat_id, stage_id: stageId || null });
      const st = stages.find((s) => s.id === stageId);
      toast.success(st ? `Movido para "${st.name}".` : 'Removido do funil.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível mover.'));
    }
    load({ silent: true });
  };

  const onDrop = (e, stageId) => {
    e.preventDefault();
    setOver(null);
    const card = dragging.current;
    dragging.current = null;
    if (card) moveTo(card, stageId);
  };

  const k = board?.kpis;

  return (
    <Box>
      <WaPageHeader
        icon={IconLayoutKanban}
        title="Funil"
        subtitle="Arraste as conversas pelas etapas. Cada etapa pode enviar mensagem, mudar etiquetas e criar tarefa ao receber uma conversa."
        sx={{ mb: 2.5 }}
        action={
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
            sx={{ width: { xs: '100%', md: 'auto' }, '& .MuiButton-root': { flex: { xs: '1 1 45%', md: '0 0 auto' }, minHeight: 40 } }}
          >
            {canAdmin ? (
              <>
                <Button
                  variant="outlined"
                  startIcon={<IconBolt size={18} />}
                  onClick={() => setAutoDlg(true)}
                  sx={{ fontWeight: 700, borderRadius: 2 }}
                >
                  Automação
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<IconPlus size={18} />}
                  onClick={() => setStageDlg({})}
                  sx={{ fontWeight: 700, borderRadius: 2 }}
                >
                  Nova etapa
                </Button>
              </>
            ) : null}
            <Button
              variant="contained"
              disableElevation
              startIcon={<IconMessage size={18} />}
              onClick={() => setAddDlg({})}
              disabled={!stages.length}
              sx={waPrimaryBtn}
            >
              Adicionar conversa
            </Button>
          </Stack>
        }
      />

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, mb: 2.5 }}>
        <CrmKpi icon={IconLayoutKanban} label="Conversas no funil" value={k ? String(k.in_funnel) : null} accent />
        <CrmKpi icon={IconCash} label={`Em andamento (${k?.open_count ?? 0})`} value={k ? k.open_label : null} />
        <CrmKpi icon={IconTrophy} label={`Ganhos (${k?.won_count ?? 0})`} value={k ? k.won_label : null} />
      </Box>

      <TgFilterBar>
        <TextField
          size="small"
          placeholder="Buscar por nome ou telefone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, minWidth: { md: 220 }, maxWidth: { md: 420 } }}
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
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ display: { xs: 'flex', md: 'contents' } }}
        >
          <Chip
            label="Só as minhas"
            clickable
            color={mine ? 'success' : 'default'}
            variant={mine ? 'filled' : 'outlined'}
            onClick={() => setMine((v) => !v)}
            sx={{ fontWeight: 700, height: 36 }}
          />
          <WaNumberFilter
            sessions={sessions}
            value={sessionId}
            onChange={setSessionId}
            sx={{ flex: { xs: '1 1 160px', md: '0 0 auto' } }}
          />
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Atualizar">
            <span>
              <IconButton onClick={() => load()} disabled={loading}>
                <IconRefresh size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </TgFilterBar>

      {xs && board?.columns.length > 1 ? (
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.75 }}>
          Deslize para o lado para ver as outras etapas · use o menu ⋮ do card para mover.
        </Typography>
      ) : null}
      {loading && !board ? (
        <TgCard hover={false} sx={{ p: 2 }}>
          <TgListSkeleton rows={6} />
        </TgCard>
      ) : !board?.columns.length ? (
        <TgEmptyState icon={IconLayoutKanban} title="Nenhuma etapa" description="Crie as etapas do seu funil para começar." />
      ) : (
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            width: '100%',
            maxWidth: '100%',
            overflowX: 'auto',
            overscrollBehaviorX: 'contain',
            WebkitOverflowScrolling: 'touch',
            pb: 2,
            px: { xs: 0.25, md: 0 },
            alignItems: 'flex-start',
            scrollSnapType: { xs: 'x mandatory', md: 'none' },
            scrollPaddingLeft: 2
          }}
        >
          {board.columns.map((col) => {
            const st = col.stage;
            const isOver = over === st.id;
            return (
              <Box
                key={st.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (over !== st.id) setOver(st.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setOver((o) => (o === st.id ? null : o));
                }}
                onDrop={(e) => onDrop(e, st.id)}
                sx={{
                  width: { xs: '85vw', sm: 292 },
                  minWidth: { xs: '85vw', sm: 292 },
                  maxWidth: { xs: 360, sm: 'none' },
                  scrollSnapAlign: 'start',
                  flexShrink: 0,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: isOver ? st.color : 'divider',
                  bgcolor: isOver ? `${st.color}14` : 'action.hover',
                  transition: 'border-color .15s, background-color .15s',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: { xs: '70dvh', md: 'calc(100dvh - 330px)' },
                  minHeight: 220
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ px: 1.5, py: 1.25, borderBottom: '3px solid', borderColor: st.color }}
                >
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: st.color, flexShrink: 0 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, flex: 1, minWidth: 0 }} noWrap>
                    {st.name}
                  </Typography>
                  <Chip size="small" label={col.total} sx={{ height: 20, fontWeight: 800, fontSize: 11 }} />
                  <IconButton
                    size="small"
                    onClick={(e) => setColMenu({ anchor: e.currentTarget, stage: st })}
                    sx={{ p: { xs: 0.75, md: 0.25 }, mr: { xs: -0.5, md: 0 } }}
                  >
                    <IconDotsVertical size={16} />
                  </IconButton>
                </Stack>
                {col.deal_cents ? (
                  <Typography variant="caption" sx={{ px: 1.5, pt: 0.75, color: 'text.secondary', fontWeight: 700 }}>
                    {col.deal_label} em {col.total} conversa{col.total === 1 ? '' : 's'}
                  </Typography>
                ) : null}
                <Stack spacing={1} sx={{ p: 1, overflowY: 'auto', flex: 1 }}>
                  {col.cards.map((c) => (
                    <Card
                      key={c.chat_id}
                      c={c}
                      now={now}
                      onOpen={openChat}
                      onMenu={(e, card) => setCardMenu({ anchor: e.currentTarget, card })}
                      dragging={dragging}
                      multi={multi}
                    />
                  ))}
                  {col.total > col.cards.length ? (
                    <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center', py: 0.5 }}>
                      + {col.total - col.cards.length} não mostradas (use a busca)
                    </Typography>
                  ) : null}
                  {!col.cards.length ? (
                    <Box
                      sx={{
                        py: 3,
                        textAlign: 'center',
                        color: 'text.disabled',
                        border: '1px dashed',
                        borderColor: 'divider',
                        borderRadius: 2
                      }}
                    >
                      <Typography variant="caption">Solte uma conversa aqui</Typography>
                    </Box>
                  ) : null}
                </Stack>
                <Button
                  size="small"
                  startIcon={<IconPlus size={14} />}
                  onClick={() => setAddDlg({ stageId: st.id })}
                  sx={{
                    m: 1,
                    mt: 0,
                    minHeight: 40,
                    textTransform: 'none',
                    fontWeight: 700,
                    justifyContent: 'flex-start',
                    color: 'text.secondary'
                  }}
                >
                  Adicionar conversa
                </Button>
              </Box>
            );
          })}
        </Box>
      )}

      {/* menu do card */}
      <Menu
        open={Boolean(cardMenu)}
        anchorEl={cardMenu?.anchor}
        onClose={() => setCardMenu(null)}
        slotProps={{ paper: { sx: { borderRadius: 2.5, minWidth: 230 } } }}
      >
        <MenuItem
          onClick={() => {
            openChat(cardMenu.card);
            setCardMenu(null);
          }}
        >
          <ListItemIcon>
            <IconMessage size={18} />
          </ListItemIcon>
          <ListItemText>Abrir conversa</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDealDlg(cardMenu.card);
            setCardMenu(null);
          }}
        >
          <ListItemIcon>
            <IconCash size={18} />
          </ListItemIcon>
          <ListItemText>Valor estimado…</ListItemText>
        </MenuItem>
        <Divider />
        <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary', fontWeight: 700 }}>
          Mover para
        </Typography>
        {stages
          .filter((s) => s.id !== cardMenu?.card?.stage_id)
          .map((s) => (
            <MenuItem
              key={s.id}
              onClick={() => {
                moveTo(cardMenu.card, s.id);
                setCardMenu(null);
              }}
            >
              <ListItemIcon>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
              </ListItemIcon>
              <ListItemText>{s.name}</ListItemText>
              <IconArrowRight size={14} style={{ opacity: 0.5 }} />
            </MenuItem>
          ))}
        <Divider />
        <MenuItem
          onClick={() => {
            moveTo(cardMenu.card, null);
            setCardMenu(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <IconX size={18} />
          </ListItemIcon>
          <ListItemText>Tirar do funil</ListItemText>
        </MenuItem>
      </Menu>

      {/* menu da coluna */}
      <Menu
        open={Boolean(colMenu)}
        anchorEl={colMenu?.anchor}
        onClose={() => setColMenu(null)}
        slotProps={{ paper: { sx: { borderRadius: 2.5, minWidth: 220 } } }}
      >
        <MenuItem
          onClick={() => {
            setAddDlg({ stageId: colMenu.stage.id });
            setColMenu(null);
          }}
        >
          <ListItemIcon>
            <IconPlus size={18} />
          </ListItemIcon>
          <ListItemText>Adicionar conversa</ListItemText>
        </MenuItem>
        {canAdmin
          ? [
              <MenuItem
                key="edit"
                onClick={() => {
                  setStageDlg({ stage: colMenu.stage });
                  setColMenu(null);
                }}
              >
                <ListItemIcon>
                  <IconPencil size={18} />
                </ListItemIcon>
                <ListItemText>Editar etapa e ações</ListItemText>
              </MenuItem>,
              <MenuItem
                key="left"
                disabled={stages.findIndex((s) => s.id === colMenu?.stage?.id) <= 0}
                onClick={async () => {
                  const ids = stages.map((s) => s.id);
                  const i = ids.indexOf(colMenu.stage.id);
                  [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                  setColMenu(null);
                  await put('/whatsapp/pipeline/stages/reorder', { ids }).catch((e) => toast.error(errMsg(e)));
                  load({ silent: true });
                }}
              >
                <ListItemText inset>Mover coluna para a esquerda</ListItemText>
              </MenuItem>,
              <MenuItem
                key="right"
                disabled={stages.findIndex((s) => s.id === colMenu?.stage?.id) >= stages.length - 1}
                onClick={async () => {
                  const ids = stages.map((s) => s.id);
                  const i = ids.indexOf(colMenu.stage.id);
                  [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                  setColMenu(null);
                  await put('/whatsapp/pipeline/stages/reorder', { ids }).catch((e) => toast.error(errMsg(e)));
                  load({ silent: true });
                }}
              >
                <ListItemText inset>Mover coluna para a direita</ListItemText>
              </MenuItem>,
              <Divider key="d" />,
              <MenuItem
                key="del"
                onClick={() => {
                  setDelStage({ stage: colMenu.stage, moveTo: '' });
                  setColMenu(null);
                }}
                sx={{ color: 'error.main' }}
              >
                <ListItemIcon>
                  <IconTrash size={18} />
                </ListItemIcon>
                <ListItemText>Excluir etapa</ListItemText>
              </MenuItem>
            ]
          : null}
      </Menu>

      <StageDialog
        open={Boolean(stageDlg)}
        onClose={() => setStageDlg(null)}
        stage={stageDlg?.stage || null}
        tags={tags}
        onSaved={() => load({ silent: true })}
      />
      <AutomationDialog open={autoDlg} onClose={() => setAutoDlg(false)} stages={stages} />
      <DealDialog open={Boolean(dealDlg)} onClose={() => setDealDlg(null)} card={dealDlg} onSaved={() => load({ silent: true })} />
      <AddChatDialog
        open={Boolean(addDlg)}
        onClose={() => setAddDlg(null)}
        stages={stages}
        defaultStage={addDlg?.stageId}
        sessions={sessions}
        initialSessionId={sessionId || undefined}
        onDone={() => load({ silent: true })}
      />
      <CrmModal
        open={Boolean(delStage)}
        onClose={() => setDelStage(null)}
        title={`Excluir a etapa "${delStage?.stage?.name}"?`}
        maxWidth="xs"
        footer={
          <>
            <Button color="inherit" onClick={() => setDelStage(null)} sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="error"
              disableElevation
              onClick={async () => {
                const d = delStage;
                setDelStage(null);
                try {
                  await remove(`/whatsapp/pipeline/stages/${d.stage.id}${d.moveTo ? `?move_to=${d.moveTo}` : ''}`);
                  toast.success('Etapa excluída.');
                } catch (e) {
                  toast.error(errMsg(e, 'Não foi possível excluir.'));
                }
                load({ silent: true });
              }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <Stack spacing={1.5}>
          <Typography variant="body2">As conversas desta etapa podem ir para outra etapa ou sair do funil.</Typography>
          <TextField
            select
            size="small"
            label="Mover as conversas para"
            value={delStage?.moveTo || ''}
            onChange={(e) => setDelStage((d) => ({ ...d, moveTo: e.target.value }))}
            fullWidth
          >
            <MenuItem value="">
              <em>Tirar do funil</em>
            </MenuItem>
            {stages
              .filter((s) => s.id !== delStage?.stage?.id)
              .map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
          </TextField>
        </Stack>
      </CrmModal>
    </Box>
  );
}
