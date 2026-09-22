import { useCallback, useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import OutlinedInput from '@mui/material/OutlinedInput';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { RefreshRoundedIcon as RefreshRoundedIcon } from 'ui-component/icons';
import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import { EditRoundedIcon as EditRoundedIcon } from 'ui-component/icons';
import { DeleteRoundedIcon as DeleteRoundedIcon } from 'ui-component/icons';
import { SaveRoundedIcon as SaveRoundedIcon } from 'ui-component/icons';
import { CloseRoundedIcon as CloseRoundedIcon } from 'ui-component/icons';
import { ScheduleRoundedIcon as ScheduleRoundedIcon } from 'ui-component/icons';
import { EventRoundedIcon as EventRoundedIcon } from 'ui-component/icons';
import { AutorenewRoundedIcon as AutorenewRoundedIcon } from 'ui-component/icons';
import { TodayRoundedIcon as TodayRoundedIcon } from 'ui-component/icons';
import { AcUnitRoundedIcon as AcUnitRoundedIcon } from 'ui-component/icons';
import { CheckCircleRoundedIcon as CheckCircleRoundedIcon } from 'ui-component/icons';
import { ErrorOutlineRoundedIcon as ErrorOutlineRoundedIcon } from 'ui-component/icons';
import { MarkEmailReadRoundedIcon as MarkEmailReadRoundedIcon } from 'ui-component/icons';
import { DashboardCustomizeRoundedIcon as DashboardCustomizeRoundedIcon } from 'ui-component/icons';
import { ArticleRoundedIcon as ArticleRoundedIcon } from 'ui-component/icons';

import toast from 'react-hot-toast';
import { get, post, patch, remove } from 'api/api';
import useEmailProjects from '../../../hooks/useEmailProjects';
import useSchedules from '../../../hooks/useSchedules';
import useSchedulesSents from '../../../hooks/useSchedulesSents';
import useTemplatesPerProject from '../../../hooks/useTemplatesPerProject';
import EmailBuilder from '../email/EmailBuilder';
import ImportTemplatesButton from '../email/ImportTemplatesButton';

const getErr = (e, f) => e?.response?.data?.message || e?.message || f;
const toList = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);
const hourOptions = Array.from({ length: 24 }, (_, i) => i);

// `time` é minuto-do-dia (0..1439).
const minToHHMM = (m) => {
  const n = Number.isFinite(Number(m)) ? Math.max(0, Math.min(1439, Number(m))) : 0;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
};
const hhmmToMin = (s) => {
  const [h, mm] = String(s || '').split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return 0;
  return Math.max(0, Math.min(1439, h * 60 + mm));
};

const formatDateForInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const toISODateTime = (dateStr) => (dateStr ? `${dateStr}T00:00:00.000Z` : null);
const formatHumanDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ------------------------------------------------------------------ Dialog
function RecycleScheduleDialog({ open, mode, projectId, loading, error, initial, templates = [], onClose, onSubmit }) {
  const [scheduleType, setScheduleType] = useState('daily'); // daily | specific | interval
  const [time, setTime] = useState(600); // minuto-do-dia (10:00)
  const [date, setDate] = useState('');
  const [forXDays, setForXDays] = useState(7);
  const [criteria, setCriteria] = useState('inactive'); // never | inactive
  const [days, setDays] = useState(30);
  const [templateIds, setTemplateIds] = useState([]);

  const [count, setCount] = useState(null);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const isInterval = Number(initial?.for_x_days) > 0;
    setScheduleType(isInterval ? 'interval' : initial?.daily ? 'daily' : initial?.date ? 'specific' : 'daily');
    setTime(Number.isFinite(initial?.time) ? Number(initial.time) : 600);
    setDate(formatDateForInput(initial?.date) || '');
    const fx = Number(initial?.for_x_days);
    setForXDays(Number.isFinite(fx) && fx > 0 ? fx : 7);
    setCriteria(initial?.recycle_criteria === 'never' ? 'never' : 'inactive');
    setDays(Math.max(1, Number(initial?.recycle_days) || 30));
    const ids = Array.isArray(initial?.template_ids) ? initial.template_ids : [];
    setTemplateIds(ids.filter((id) => templates.some((t) => t.id === id)));
  }, [open, initial, templates]);

  // contagem ao vivo de leads frios do critério
  const loadCount = useCallback(async () => {
    if (!open || !projectId) return;
    setCounting(true);
    try {
      const params = new URLSearchParams({ criteria, days: String(days) });
      const data = await get(`/email/projects/${projectId}/cold-count?${params.toString()}`);
      setCount(Number(data?.count || 0));
    } catch {
      setCount(null);
    } finally {
      setCounting(false);
    }
  }, [open, projectId, criteria, days]);

  useEffect(() => {
    const t = setTimeout(loadCount, 300);
    return () => clearTimeout(t);
  }, [loadCount]);

  const canSubmit = useMemo(() => {
    if (!Number.isFinite(Number(time))) return false;
    if (scheduleType === 'specific') return Boolean(date);
    if (scheduleType === 'interval') return Number(forXDays) > 0;
    return true;
  }, [time, date, forXDays, scheduleType]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!canSubmit || loading) return;
    const recycleFields = {
      recycle: true,
      recycle_criteria: criteria,
      recycle_days: criteria === 'inactive' ? Number(days) : undefined,
      template_ids: templateIds
    };
    if (scheduleType === 'interval') {
      onSubmit({ time: Number(time), for_x_days: Number(forXDays), daily: false, date: null, ...recycleFields });
      return;
    }
    const dailyMode = scheduleType === 'daily';
    onSubmit({ daily: dailyMode, time: Number(time), date: dailyMode ? null : toISODateTime(date), for_x_days: null, ...recycleFields });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          {mode === 'create' ? 'Novo agendamento de reciclagem' : 'Editar agendamento de reciclagem'}
        </Typography>
        <IconButton onClick={onClose} disabled={loading} size="small"><CloseRoundedIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1.5 }}>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

          <Stack spacing={2}>
            {/* Tipo */}
            <TextField select size="small" label="Quando disparar" value={scheduleType} onChange={(e) => setScheduleType(e.target.value)} fullWidth>
              <MenuItem value="daily">Todos os dias</MenuItem>
              <MenuItem value="specific">Dia específico</MenuItem>
              <MenuItem value="interval">A cada X dias</MenuItem>
            </TextField>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Horário" type="time" value={minToHHMM(time)} onChange={(e) => setTime(hhmmToMin(e.target.value))} fullWidth
                InputLabelProps={{ shrink: true }} inputProps={{ step: 60 }} helperText="Brasília — aceita minutos (ex.: 11:30)."
                InputProps={{ startAdornment: <InputAdornment position="start"><ScheduleRoundedIcon fontSize="small" /></InputAdornment> }} />

              {scheduleType === 'specific' ? (
                <TextField label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><EventRoundedIcon fontSize="small" /></InputAdornment> }} />
              ) : null}

              {scheduleType === 'interval' ? (
                <TextField label="A cada X dias" type="number" value={forXDays} onChange={(e) => setForXDays(Number(e.target.value))} fullWidth inputProps={{ min: 1, step: 1 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AutorenewRoundedIcon fontSize="small" /></InputAdornment> }} />
              ) : null}
            </Stack>

            <Divider textAlign="left"><Typography variant="caption" color="text.secondary">Quem receber (leads frios)</Typography></Divider>

            <RadioGroup value={criteria} onChange={(e) => setCriteria(e.target.value)}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <FormControlLabel value="inactive" control={<Radio size="small" />} label="Inativos há" sx={{ mr: 0 }} />
                <TextField size="small" type="number" value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} disabled={criteria !== 'inactive'} inputProps={{ min: 1, style: { width: 56, textAlign: 'center' } }} />
                <Typography variant="body2">dias</Typography>
              </Stack>
              <FormControlLabel value="never" control={<Radio size="small" />} label="Nunca interagiram (não abriram nem clicaram)" />
            </RadioGroup>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, bgcolor: 'action.hover' }}>
              <AcUnitRoundedIcon color="info" fontSize="small" />
              {counting ? <CircularProgress size={14} /> : (
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {count == null ? '—' : `${count} lead${count === 1 ? '' : 's'} frio${count === 1 ? '' : 's'} hoje neste critério`}
                </Typography>
              )}
            </Box>

            {/* Templates */}
            <FormControl fullWidth size="small">
              <InputLabel id="rec-tpl-label">Templates deste agendamento</InputLabel>
              <Select
                labelId="rec-tpl-label"
                multiple
                value={templateIds}
                onChange={(e) => setTemplateIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                input={<OutlinedInput label="Templates deste agendamento" />}
                renderValue={(selected) => selected.length === 0 ? <em>Todos os templates do projeto</em> : (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((id) => { const t = templates.find((x) => x.id === id); return <Chip key={id} size="small" label={t?.name || 'template'} sx={{ borderRadius: 1.5 }} />; })}
                  </Stack>
                )}
                MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
              >
                {templates.length === 0 ? (
                  <MenuItem disabled value=""><em>Nenhum template de reciclagem — crie um no construtor acima</em></MenuItem>
                ) : templates.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    <Checkbox checked={templateIds.indexOf(t.id) > -1} size="small" />
                    <ListItemText primary={t.name} secondary={t.subject} />
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                O disparo sorteia um destes. Reciclagem <b>nunca apaga</b> templates. Vazio = usa todos.
              </Typography>
            </FormControl>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" onClick={onClose} disabled={loading} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button type="submit" variant="contained" color="secondary" disabled={!canSubmit || loading} startIcon={loading ? <CircularProgress size={16} /> : <SaveRoundedIcon fontSize="small" />} sx={{ borderRadius: 2, fontWeight: 900 }}>
            Salvar
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ------------------------------------------------------------------ Card
function RecycleScheduleCard({ schedule, onEdit, onDelete, disableActions }) {
  const isInterval = Number(schedule?.for_x_days) > 0;
  const timing = isInterval
    ? `Às ${minToHHMM(schedule?.time)} • a cada ${schedule?.for_x_days} dias`
    : `Às ${minToHHMM(schedule?.time)} ${schedule?.daily ? '• todo dia' : `• ${schedule?.date?.split('T')[0]?.split('-').reverse().join('/')}`}`;
  const badge = isInterval ? { icon: <AutorenewRoundedIcon sx={{ fontSize: 16 }} />, label: `A cada ${schedule?.for_x_days} dias` }
    : schedule?.daily ? { icon: <TodayRoundedIcon sx={{ fontSize: 16 }} />, label: 'Todos os dias' }
      : { icon: <EventRoundedIcon sx={{ fontSize: 16 }} />, label: 'Dia específico' };
  const coldLabel = schedule?.recycle_criteria === 'never' ? 'Nunca interagiram' : `Inativos há ${schedule?.recycle_days || 30}d`;
  const tplCount = Array.isArray(schedule?.template_ids) ? schedule.template_ids.length : 0;

  return (
    <Box sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Chip size="small" variant="outlined" color="secondary" icon={badge.icon} label={badge.label} sx={{ borderRadius: 2 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.15 }}>{timing}</Typography>
          <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip size="small" icon={<AcUnitRoundedIcon sx={{ fontSize: 14 }} />} label={coldLabel} sx={{ borderRadius: 1.5, height: 22 }} />
            <Chip size="small" variant="outlined" label={tplCount > 0 ? `${tplCount} template${tplCount === 1 ? '' : 's'}` : 'Todos os templates'} sx={{ borderRadius: 1.5, height: 22 }} />
            {schedule?.last_run ? <Chip size="small" variant="outlined" label={`Última: ${formatHumanDateTime(schedule.last_run)}`} sx={{ borderRadius: 1.5, height: 22 }} /> : null}
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Editar"><span><IconButton size="small" disabled={disableActions} onClick={() => onEdit(schedule)} sx={{ borderRadius: 2 }}><EditRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title="Apagar"><span><IconButton size="small" color="error" disabled={disableActions} onClick={() => onDelete(schedule)} sx={{ borderRadius: 2 }}><DeleteRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}

// ------------------------------------------------------------------ Sent row
function SentRow({ s }) {
  const ok = Boolean(s?.sent);
  return (
    <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.25 }}>
      {ok ? <MarkEmailReadRoundedIcon color="success" fontSize="small" /> : <ErrorOutlineRoundedIcon color={s?.error_message ? 'error' : 'disabled'} fontSize="small" />}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>{s?.subject || (ok ? 'Disparo de reciclagem' : s?.error_message || 'Processando…')}</Typography>
        <Typography variant="caption" color="text.secondary">{formatHumanDateTime(s?.run_at || s?.created_at)}</Typography>
      </Box>
      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end' }}>
        <Chip size="small" variant="outlined" label={`${s?.total_leads ?? 0} leads`} sx={{ borderRadius: 1.5, height: 22 }} />
        {Number(s?.delivered_count) > 0 ? <Chip size="small" variant="outlined" color="success" label={`${s.delivered_count} entregues`} sx={{ borderRadius: 1.5, height: 22 }} /> : null}
        <Chip size="small" variant="outlined" color="info" label={`${s?.open_count ?? 0} aberturas`} sx={{ borderRadius: 1.5, height: 22 }} />
        <Chip size="small" variant="outlined" color="secondary" label={`${s?.click_cta_count ?? 0} cliques`} sx={{ borderRadius: 1.5, height: 22 }} />
        {Number(s?.bounced_count) > 0 ? <Chip size="small" variant="outlined" color="warning" label={`${s.bounced_count} bounce${s.bounced_count === 1 ? '' : 's'}`} sx={{ borderRadius: 1.5, height: 22 }} /> : null}
        {Number(s?.complained_count) > 0 ? <Chip size="small" variant="outlined" color="error" label={`${s.complained_count} spam`} sx={{ borderRadius: 1.5, height: 22 }} /> : null}
      </Stack>
    </Box>
  );
}

// ------------------------------------------------------------------ Main
export default function RecycleTab() {
  const { emailProjects } = useEmailProjects();
  const projects = useMemo(() => toList(emailProjects), [emailProjects]);
  const [projectId, setProjectId] = useState('');

  const { schedules, isLoading: loadingSchedules, refresh: refreshSchedules } = useSchedules(projectId, { recycle: true });
  const { sents, isLoading: loadingSents, refresh: refreshSents } = useSchedulesSents(projectId, { recycle: true });
  const { templates, isLoading: loadingTemplates, mutate: mutateTemplates } = useTemplatesPerProject(projectId, { recycle: true });

  const scheduleList = useMemo(() => toList(schedules), [schedules]);
  const sentList = useMemo(() => toList(sents), [sents]);
  const templateList = useMemo(() => toList(templates), [templates]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState(null);

  // Templates de reciclagem (construtor)
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderTarget, setBuilderTarget] = useState(null); // null=criar, template=editar
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderError, setBuilderError] = useState('');
  const [confirmTplDelete, setConfirmTplDelete] = useState(null);

  const openBuilderCreate = () => { setBuilderTarget(null); setBuilderError(''); setBuilderOpen(true); };
  const openBuilderEdit = (t) => { setBuilderTarget(t); setBuilderError(''); setBuilderOpen(true); };

  const handleBuilderSave = async ({ name, subject, html, model }) => {
    if (!projectId) return;
    setBuilderSaving(true);
    setBuilderError('');
    try {
      const payload = { name, subject, body_html: html, builder_model: model };
      if (builderTarget?.id) await patch(`/email/templates/${builderTarget.id}`, payload);
      else await post(`/email/projects/${projectId}/templates`, { ...payload, recycle: true });
      toast.success(builderTarget?.id ? 'Template atualizado!' : 'Template de reciclagem criado!');
      setBuilderOpen(false);
      setBuilderTarget(null);
      mutateTemplates();
    } catch (e) {
      setBuilderError(getErr(e, 'Falha ao salvar o template.'));
    } finally {
      setBuilderSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!confirmTplDelete) return;
    setActionLoading(true);
    try {
      await remove(`/email/templates/${confirmTplDelete.id}`);
      toast.success('Template removido.');
      setConfirmTplDelete(null);
      mutateTemplates();
    } catch (e) {
      toast.error(getErr(e, 'Falha ao remover o template.'));
    } finally {
      setActionLoading(false);
    }
  };

  const basePath = projectId ? `/email/projects/${projectId}/schedules` : null;

  const openCreate = () => { setDialogMode('create'); setEditing(null); setActionError(''); setDialogOpen(true); };
  const openEdit = (s) => { setDialogMode('edit'); setEditing(s); setActionError(''); setDialogOpen(true); };

  const handleSubmit = async (payload) => {
    if (!basePath) return;
    setActionLoading(true);
    setActionError('');
    try {
      if (dialogMode === 'create') await post(basePath, payload);
      else await patch(`${basePath}/${editing?.id}`, payload);
      toast.success(dialogMode === 'create' ? 'Agendamento de reciclagem criado!' : 'Agendamento atualizado!');
      setDialogOpen(false);
      refreshSchedules();
    } catch (e) {
      setActionError(getErr(e, 'Falha ao salvar o agendamento.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!basePath || !confirmDelete) return;
    setActionLoading(true);
    try {
      await remove(`${basePath}/${confirmDelete.id}`);
      toast.success('Agendamento removido.');
      setConfirmDelete(null);
      refreshSchedules();
    } catch (e) {
      toast.error(getErr(e, 'Falha ao remover.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Reciclagem (win-back)</Typography>
          <Typography variant="body2" color="text.secondary">
            Agende disparos recorrentes só para os leads frios de um projeto — com templates, igual aos agendamentos.
          </Typography>
        </Box>
        <Tooltip title="Atualizar">
          <span>
            <IconButton onClick={() => { refreshSchedules(); refreshSents(); }} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <RefreshRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <TextField select size="small" label="Projeto de e-mail" value={projectId} onChange={(e) => setProjectId(e.target.value)} sx={{ mb: 2, maxWidth: 420 }} fullWidth>
        <MenuItem value="" disabled>Selecione um projeto</MenuItem>
        {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
      </TextField>

      {!projectId ? (
        <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
          <Typography variant="h6">Selecione um projeto</Typography>
          <Typography variant="body2" color="text.secondary">Escolha um projeto de e-mail para configurar a reciclagem.</Typography>
        </Box>
      ) : (
        <>
          {/* Templates de reciclagem */}
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Templates de reciclagem</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <ImportTemplatesButton projectId={projectId} recycle onImported={() => mutateTemplates()} size="small" />
              <Button variant="outlined" color="secondary" startIcon={<DashboardCustomizeRoundedIcon fontSize="small" />} onClick={openBuilderCreate} sx={{ borderRadius: 2, fontWeight: 800 }}>
                Novo template (construtor)
              </Button>
            </Stack>
          </Stack>

          {loadingTemplates ? (
            <Stack spacing={1}>{[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={56} />)}</Stack>
          ) : templateList.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">Nenhum template de reciclagem ainda. Crie um pelo construtor para usar nos agendamentos.</Typography>
            </Box>
          ) : (
            <Stack spacing={1}>
              {templateList.map((t) => (
                <Box key={t.id} sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.25, bgcolor: 'background.paper' }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', flexShrink: 0 }}>
                    <ArticleRoundedIcon fontSize="small" color="secondary" />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>{t.name}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{t.subject}</Typography>
                  </Box>
                  <Button size="small" variant="text" startIcon={<EditRoundedIcon fontSize="small" />} onClick={() => openBuilderEdit(t)} sx={{ borderRadius: 2, fontWeight: 800 }}>Editar</Button>
                  <Tooltip title="Apagar"><span><IconButton size="small" color="error" onClick={() => setConfirmTplDelete(t)} sx={{ borderRadius: 2 }}><DeleteRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
                </Box>
              ))}
            </Stack>
          )}

          <Divider sx={{ my: 2.5 }} />

          {/* Agendamentos */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Agendamentos de reciclagem</Typography>
            <Button variant="contained" color="secondary" startIcon={<AddRoundedIcon fontSize="small" />} onClick={openCreate} sx={{ borderRadius: 2, fontWeight: 800 }}>
              Novo agendamento
            </Button>
          </Stack>

          {loadingSchedules ? (
            <Stack spacing={1}>{[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={64} />)}</Stack>
          ) : scheduleList.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3, mb: 1 }}>
              <Typography variant="body2" color="text.secondary">Nenhum agendamento de reciclagem ainda. Crie o primeiro acima.</Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>
              {scheduleList.map((s) => (
                <RecycleScheduleCard key={s.id} schedule={s} onEdit={openEdit} onDelete={setConfirmDelete} disableActions={actionLoading} />
              ))}
            </Stack>
          )}

          <Divider sx={{ my: 2.5 }} />

          {/* Envios */}
          <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>Envios de reciclagem</Typography>
          {loadingSents ? (
            <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={54} />)}</Stack>
          ) : sentList.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">Nenhum envio de reciclagem registrado ainda.</Typography>
            </Box>
          ) : (
            <Stack spacing={1}>
              {sentList.map((s) => <SentRow key={s.id} s={s} />)}
            </Stack>
          )}
        </>
      )}

      <RecycleScheduleDialog
        open={dialogOpen}
        mode={dialogMode}
        projectId={projectId}
        loading={actionLoading}
        error={actionError}
        initial={editing}
        templates={templateList}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />

      {/* construtor de template de reciclagem */}
      <EmailBuilder
        open={builderOpen}
        mode="template"
        initialModel={builderTarget?.builder_model || null}
        initialName={builderTarget?.name || ''}
        initialSubject={builderTarget?.subject || ''}
        saving={builderSaving}
        error={builderOpen ? builderError : ''}
        onClose={() => { setBuilderOpen(false); setBuilderTarget(null); }}
        onSave={handleBuilderSave}
      />

      {/* confirm delete agendamento */}
      <Dialog open={Boolean(confirmDelete)} onClose={actionLoading ? undefined : () => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Remover agendamento?</DialogTitle>
        <DialogContent><Typography variant="body2" color="text.secondary">Esta ação não pode ser desfeita.</Typography></DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" onClick={() => setConfirmDelete(null)} disabled={actionLoading} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={actionLoading} startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteRoundedIcon fontSize="small" />} sx={{ borderRadius: 2, fontWeight: 900 }}>
            Apagar
          </Button>
        </DialogActions>
      </Dialog>

      {/* confirm delete template */}
      <Dialog open={Boolean(confirmTplDelete)} onClose={actionLoading ? undefined : () => setConfirmTplDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Remover template?</DialogTitle>
        <DialogContent><Typography variant="body2" color="text.secondary">"{confirmTplDelete?.name}" será apagado. Agendamentos que só usavam este template passam a usar os demais.</Typography></DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" onClick={() => setConfirmTplDelete(null)} disabled={actionLoading} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDeleteTemplate} disabled={actionLoading} startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteRoundedIcon fontSize="small" />} sx={{ borderRadius: 2, fontWeight: 900 }}>
            Apagar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
