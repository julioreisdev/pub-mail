import { useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import { DeleteRoundedIcon as DeleteRoundedIcon } from 'ui-component/icons';
import { SaveRoundedIcon as SaveRoundedIcon } from 'ui-component/icons';
import { CloseRoundedIcon as CloseRoundedIcon } from 'ui-component/icons';
import { BoltRoundedIcon as BoltRoundedIcon } from 'ui-component/icons';
import { VisibilityRoundedIcon as VisibilityRoundedIcon } from 'ui-component/icons';
import { TouchAppRoundedIcon as TouchAppRoundedIcon } from 'ui-component/icons';
import { SellRoundedIcon as SellRoundedIcon } from 'ui-component/icons';
import { SendRoundedIcon as SendRoundedIcon } from 'ui-component/icons';

import toast from 'react-hot-toast';
import { get, post, patch, remove } from 'api/api';
import useEmailProjects from '../../../hooks/useEmailProjects';
import useTemplatesPerProject from '../../../hooks/useTemplatesPerProject';

const getErr = (e, f) => e?.response?.data?.message || e?.message || f;
const toList = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);
const parseTags = (s) => String(s || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20);

function TriggerDialog({ open, mode, loading, error, initial, templates, onClose, onSubmit }) {
  const [event, setEvent] = useState('OPEN');
  const [action, setAction] = useState('ADD_TAG');
  const [tagsText, setTagsText] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [freqType, setFreqType] = useState('once'); // once | unlimited | cooldown
  const [freqValue, setFreqValue] = useState(1);
  const [freqUnit, setFreqUnit] = useState('days');

  useEffect(() => {
    if (!open) return;
    setEvent(initial?.event === 'CLICK' ? 'CLICK' : 'OPEN');
    setAction(initial?.action === 'SEND_TEMPLATE' ? 'SEND_TEMPLATE' : 'ADD_TAG');
    setTagsText(Array.isArray(initial?.tags) ? initial.tags.join(', ') : '');
    setTemplateId(initial?.template_id || '');
    const f = initial?.frequency || {};
    setFreqType(['unlimited', 'cooldown'].includes(f.type) ? f.type : 'once');
    setFreqValue(Math.max(1, Number(f.value) || 1));
    setFreqUnit(['minutes', 'hours', 'days'].includes(f.unit) ? f.unit : 'days');
  }, [open, initial]);

  const tags = parseTags(tagsText);
  const canSubmit = action === 'ADD_TAG' ? tags.length > 0 : Boolean(templateId);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!canSubmit || loading) return;
    const frequency =
      freqType === 'cooldown'
        ? { type: 'cooldown', value: Math.max(1, Number(freqValue) || 1), unit: freqUnit }
        : { type: freqType };
    const payload = { event, action, active: initial?.active ?? true, frequency };
    if (action === 'ADD_TAG') payload.tags = tags;
    else payload.template_id = templateId;
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>{mode === 'create' ? 'Novo gatilho' : 'Editar gatilho'}</Typography>
        <IconButton onClick={onClose} disabled={loading} size="small"><CloseRoundedIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1.5 }}>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          <Stack spacing={2}>
            <TextField select label="Quando o lead" value={event} onChange={(e) => setEvent(e.target.value)} fullWidth size="small">
              <MenuItem value="OPEN">Abrir um e-mail</MenuItem>
              <MenuItem value="CLICK">Clicar num link (CTA)</MenuItem>
            </TextField>

            <TextField select label="Então" value={action} onChange={(e) => setAction(e.target.value)} fullWidth size="small">
              <MenuItem value="ADD_TAG">Adicionar tag(s) ao lead</MenuItem>
              <MenuItem value="SEND_TEMPLATE">Enviar um template</MenuItem>
            </TextField>

            {action === 'ADD_TAG' ? (
              <Box>
                <TextField label="Tags" placeholder="ex: engajado, quente" value={tagsText} onChange={(e) => setTagsText(e.target.value)} fullWidth size="small" helperText="Separe por vírgula." />
                {tags.length ? (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    {tags.map((t) => <Chip key={t} size="small" label={t} sx={{ borderRadius: 1.5 }} />)}
                  </Stack>
                ) : null}
              </Box>
            ) : (
              <TextField select label="Template a enviar" value={templateId} onChange={(e) => setTemplateId(e.target.value)} fullWidth size="small" helperText={templates.length ? 'Cobra token por envio (1 lead).' : 'Nenhum template neste projeto.'}>
                <MenuItem value="" disabled>Selecione um template</MenuItem>
                {templates.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            )}

            <Box>
              <TextField select label="Com que frequência (por lead)" value={freqType} onChange={(e) => setFreqType(e.target.value)} fullWidth size="small">
                <MenuItem value="once">Uma única vez por lead</MenuItem>
                <MenuItem value="cooldown">No máximo 1x a cada…</MenuItem>
                <MenuItem value="unlimited">Toda vez que acontecer</MenuItem>
              </TextField>
              {freqType === 'cooldown' ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">No máximo 1x a cada</Typography>
                  <TextField size="small" type="number" value={freqValue} onChange={(e) => setFreqValue(Math.max(1, Number(e.target.value) || 1))} inputProps={{ min: 1, style: { width: 60, textAlign: 'center' } }} />
                  <TextField select size="small" value={freqUnit} onChange={(e) => setFreqUnit(e.target.value)} sx={{ minWidth: 110 }}>
                    <MenuItem value="minutes">minutos</MenuItem>
                    <MenuItem value="hours">horas</MenuItem>
                    <MenuItem value="days">dias</MenuItem>
                  </TextField>
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {freqType === 'once'
                    ? 'Dispara só uma vez por lead — reaberturas/recliques não repetem.'
                    : 'Dispara toda vez que o lead abrir/clicar (cuidado com envios de template).'}
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" onClick={onClose} disabled={loading} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button type="submit" variant="contained" color="secondary" disabled={!canSubmit || loading} startIcon={loading ? <CircularProgress size={16} /> : <SaveRoundedIcon fontSize="small" />} sx={{ borderRadius: 2, fontWeight: 900 }}>Salvar</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function TriggerCard({ trigger, templates, onToggle, onDelete, disabled }) {
  const evt = trigger.event === 'CLICK'
    ? { icon: <TouchAppRoundedIcon sx={{ fontSize: 16 }} />, label: 'Ao clicar' }
    : { icon: <VisibilityRoundedIcon sx={{ fontSize: 16 }} />, label: 'Ao abrir' };
  const tplName = templates.find((t) => t.id === trigger.template_id)?.name;
  const actionEl = trigger.action === 'SEND_TEMPLATE'
    ? <Chip size="small" color="secondary" variant="outlined" icon={<SendRoundedIcon sx={{ fontSize: 14 }} />} label={`Enviar: ${tplName || 'template'}`} sx={{ borderRadius: 1.5, height: 24 }} />
    : <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        <Chip size="small" color="secondary" variant="outlined" icon={<SellRoundedIcon sx={{ fontSize: 14 }} />} label="Tag" sx={{ borderRadius: 1.5, height: 24 }} />
        {(Array.isArray(trigger.tags) ? trigger.tags : []).map((t) => <Chip key={t} size="small" label={t} sx={{ borderRadius: 1.5, height: 24 }} />)}
      </Stack>;

  const f = trigger.frequency || {};
  const unitLabel = { minutes: 'min', hours: 'h', days: 'd' }[f.unit] || 'd';
  const freqLabel =
    f.type === 'unlimited' ? 'Toda vez'
      : f.type === 'cooldown' ? `1x a cada ${f.value || 1}${unitLabel}`
        : '1x por lead';

  return (
    <Box sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: trigger.active ? 'secondary.main' : 'divider', bgcolor: 'background.paper', opacity: trigger.active ? 1 : 0.65 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Chip size="small" variant="outlined" icon={evt.icon} label={evt.label} sx={{ borderRadius: 2, fontWeight: 800 }} />
        <Box sx={{ fontSize: 18, color: 'text.disabled' }}>→</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>{actionEl}</Box>
        <Tooltip title="Frequência"><Chip size="small" label={freqLabel} sx={{ borderRadius: 1.5, height: 22, fontWeight: 700 }} /></Tooltip>
        <Tooltip title={trigger.active ? 'Ativo' : 'Pausado'}>
          <Switch size="small" checked={Boolean(trigger.active)} onChange={() => onToggle(trigger)} disabled={disabled} color="secondary" />
        </Tooltip>
        <Tooltip title="Apagar"><span><IconButton size="small" color="error" onClick={() => onDelete(trigger)} disabled={disabled} sx={{ borderRadius: 2 }}><DeleteRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
      </Stack>
    </Box>
  );
}

export default function TriggersTab() {
  const { emailProjects } = useEmailProjects();
  const projects = useMemo(() => toList(emailProjects), [emailProjects]);
  const [projectId, setProjectId] = useState('');

  const { templates } = useTemplatesPerProject(projectId, { recycle: false });
  const templateList = useMemo(() => toList(templates), [templates]);

  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const basePath = projectId ? `/email/projects/${projectId}/triggers` : null;

  const loadTriggers = async (pid) => {
    if (!pid) { setTriggers([]); return; }
    setLoading(true);
    try {
      const data = await get(`/email/projects/${pid}/triggers`);
      setTriggers(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(getErr(e, 'Falha ao carregar gatilhos.'));
    } finally {
      setLoading(false);
    }
  };

  const onSelectProject = (pid) => { setProjectId(pid); loadTriggers(pid); };

  const openCreate = () => { setDialogMode('create'); setEditing(null); setActionError(''); setDialogOpen(true); };

  const handleSubmit = async (payload) => {
    if (!basePath) return;
    setActionLoading(true);
    setActionError('');
    try {
      if (dialogMode === 'create') await post(basePath, payload);
      else await patch(`${basePath}/${editing?.id}`, payload);
      toast.success('Gatilho salvo!');
      setDialogOpen(false);
      loadTriggers(projectId);
    } catch (e) {
      setActionError(getErr(e, 'Falha ao salvar o gatilho.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (t) => {
    setActionLoading(true);
    try {
      await patch(`${basePath}/${t.id}`, { active: !t.active });
      loadTriggers(projectId);
    } catch (e) {
      toast.error(getErr(e, 'Falha ao atualizar.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (t) => {
    setActionLoading(true);
    try {
      await remove(`${basePath}/${t.id}`);
      toast.success('Gatilho removido.');
      loadTriggers(projectId);
    } catch (e) {
      toast.error(getErr(e, 'Falha ao remover.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <BoltRoundedIcon color="secondary" />
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Gatilhos por comportamento</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Reaja automaticamente quando um lead abre ou clica: aplique tags para segmentar ou dispare um template.
      </Typography>

      <TextField select size="small" label="Projeto de e-mail" value={projectId} onChange={(e) => onSelectProject(e.target.value)} sx={{ mb: 2, maxWidth: 420 }} fullWidth>
        <MenuItem value="" disabled>Selecione um projeto</MenuItem>
        {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
      </TextField>

      {!projectId ? (
        <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
          <Typography variant="h6">Selecione um projeto</Typography>
          <Typography variant="body2" color="text.secondary">Escolha um projeto para configurar os gatilhos de comportamento.</Typography>
        </Box>
      ) : (
        <>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Gatilhos deste projeto</Typography>
            <Button variant="contained" color="secondary" startIcon={<AddRoundedIcon fontSize="small" />} onClick={openCreate} sx={{ borderRadius: 2, fontWeight: 800 }}>Novo gatilho</Button>
          </Stack>

          {loading ? (
            <Stack spacing={1}>{[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={60} />)}</Stack>
          ) : triggers.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">Nenhum gatilho ainda. Crie o primeiro acima.</Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>
              {triggers.map((t) => (
                <TriggerCard key={t.id} trigger={t} templates={templateList} onToggle={handleToggle} onDelete={handleDelete} disabled={actionLoading} />
              ))}
            </Stack>
          )}
        </>
      )}

      <TriggerDialog
        open={dialogOpen}
        mode={dialogMode}
        loading={actionLoading}
        error={actionError}
        initial={editing}
        templates={templateList}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
