import { useCallback, useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { alpha } from '@mui/material/styles';

import { ScienceRoundedIcon as ScienceRoundedIcon } from 'ui-component/icons';
import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import { DeleteOutlineRoundedIcon as DeleteOutlineRoundedIcon } from 'ui-component/icons';
import { RefreshRoundedIcon as RefreshRoundedIcon } from 'ui-component/icons';
import { EmojiEventsRoundedIcon as EmojiEventsRoundedIcon } from 'ui-component/icons';
import { CloseRoundedIcon as CloseRoundedIcon } from 'ui-component/icons';
import { AccessTimeRoundedIcon as AccessTimeRoundedIcon } from 'ui-component/icons';
import { CheckCircleRoundedIcon as CheckCircleRoundedIcon } from 'ui-component/icons';

import toast from 'react-hot-toast';
import MainCard from 'ui-component/cards/MainCard';
import { get, post, remove } from 'api/api';
import useEmailProjects from '../../../hooks/useEmailProjects';
import useTemplatesPerProject from '../../../hooks/useTemplatesPerProject';

const toList = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);
const getErr = (e, f) => e?.response?.data?.message || e?.message || f;
const pct = (r) => `${Math.round((Number(r) || 0) * 1000) / 10}%`;
const LABELS = ['A', 'B', 'C', 'D'];

function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------- Create dialog
function CreateDialog({ open, projectId, templates, loading, error, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [variants, setVariants] = useState([{ template_id: '', subject: '' }, { template_id: '', subject: '' }]);
  const [percent, setPercent] = useState(30);
  const [metric, setMetric] = useState('open');
  const [hours, setHours] = useState(4);

  useEffect(() => {
    if (!open) return;
    setName(''); setPercent(30); setMetric('open'); setHours(4);
    setVariants([{ template_id: '', subject: '' }, { template_id: '', subject: '' }]);
  }, [open]);

  const setVar = (i, patch) => setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const addVar = () => setVariants((prev) => (prev.length < 4 ? [...prev, { template_id: '', subject: '' }] : prev));
  const removeVar = (i) => setVariants((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));

  const canSubmit = name.trim() && variants.length >= 2 && variants.every((v) => v.template_id);

  const handleSubmit = () => {
    if (!canSubmit || loading) return;
    onSubmit({
      name: name.trim(),
      test_percent: Math.max(5, Math.min(90, Number(percent) || 30)),
      winner_metric: metric,
      decision_hours: Math.max(1, Math.min(168, Number(hours) || 4)),
      variants: variants.map((v) => ({ template_id: v.template_id, subject: v.subject?.trim() || undefined }))
    });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ScienceRoundedIcon color="secondary" />
        <Typography variant="h5" sx={{ fontWeight: 900, flex: 1 }}>Novo teste A/B</Typography>
        <IconButton onClick={onClose} disabled={loading} size="small"><CloseRoundedIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField size="small" label="Nome do teste" value={name} onChange={(e) => setName(e.target.value)} fullWidth placeholder="Ex.: Assunto A vs B — Black Friday" />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>Variantes</Typography>
            <Stack spacing={1}>
              {variants.map((v, i) => (
                <Box key={i} sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Chip size="small" color="secondary" label={`Variante ${LABELS[i]}`} sx={{ fontWeight: 800, borderRadius: 1.5 }} />
                    <Box sx={{ flex: 1 }} />
                    {variants.length > 2 ? (
                      <IconButton size="small" color="error" onClick={() => removeVar(i)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                    ) : null}
                  </Stack>
                  <TextField select size="small" label="Template" value={v.template_id} onChange={(e) => setVar(i, { template_id: e.target.value })} fullWidth sx={{ mb: 1 }}>
                    <MenuItem value="" disabled>Selecione um template</MenuItem>
                    {templates.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </TextField>
                  <TextField size="small" label="Assunto (opcional)" value={v.subject} onChange={(e) => setVar(i, { subject: e.target.value })} fullWidth placeholder="Deixe vazio para usar o assunto do template" />
                </Box>
              ))}
            </Stack>
            {variants.length < 4 ? (
              <Button size="small" startIcon={<AddRoundedIcon fontSize="small" />} onClick={addVar} sx={{ mt: 1, borderRadius: 2, fontWeight: 700 }}>Adicionar variante</Button>
            ) : null}
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField size="small" type="number" label="% da base no teste" value={percent} onChange={(e) => setPercent(e.target.value)} inputProps={{ min: 5, max: 90 }} sx={{ flex: 1 }} helperText="Restante recebe a vencedora." />
            <TextField select size="small" label="Vencedora por" value={metric} onChange={(e) => setMetric(e.target.value)} sx={{ flex: 1 }}>
              <MenuItem value="open">Aberturas</MenuItem>
              <MenuItem value="click">Cliques</MenuItem>
            </TextField>
            <TextField size="small" type="number" label="Decidir após (horas)" value={hours} onChange={(e) => setHours(e.target.value)} inputProps={{ min: 1, max: 168 }} sx={{ flex: 1 }} />
          </Stack>

          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Ao iniciar, cada variante é enviada agora para uma fatia da base. Depois de {hours || 4}h, a vencedora vai automaticamente para o restante.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" onClick={onClose} disabled={loading} sx={{ borderRadius: 2 }}>Cancelar</Button>
        <Button variant="contained" color="secondary" disabled={!canSubmit || loading} onClick={handleSubmit} startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ScienceRoundedIcon fontSize="small" />} sx={{ borderRadius: 2, fontWeight: 900 }}>
          {loading ? 'Iniciando…' : 'Iniciar teste'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Test card
function TestCard({ test, onCancel, disabled }) {
  const testing = test.status === 'testing';
  const metricLabel = test.winner_metric === 'click' ? 'cliques' : 'aberturas';
  const variants = test.variants || [];
  const totalInTest = variants.reduce((a, v) => a + (v.recipients_count || 0), 0);
  const primaryOf = (v) => (test.winner_metric === 'click' ? v.metrics?.click_rate : v.metrics?.open_rate) || 0;
  const maxPrimary = Math.max(0.0001, ...variants.map(primaryOf));
  const leader = variants.reduce((best, v) => (primaryOf(v) > primaryOf(best) ? v : best), variants[0] || null);

  const statusChip = testing
    ? <Chip size="small" color="warning" icon={<AccessTimeRoundedIcon sx={{ fontSize: 14 }} />} label={`Testando · decide ${fmtWhen(test.decision_at)}`} sx={{ borderRadius: 1.5, fontWeight: 700 }} />
    : test.status === 'canceled'
      ? <Chip size="small" variant="outlined" label="Cancelado" sx={{ borderRadius: 1.5 }} />
      : <Chip size="small" color="success" icon={<CheckCircleRoundedIcon sx={{ fontSize: 15 }} />} label="Concluído" sx={{ borderRadius: 1.5, fontWeight: 700 }} />;

  return (
    <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
      {/* Cabeçalho */}
      <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, flex: 1 }} noWrap>{test.name}</Typography>
          {statusChip}
          {testing ? (
            <Tooltip title="Cancelar teste"><span><IconButton size="small" color="error" disabled={disabled} onClick={() => onCancel(test)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
          ) : null}
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          <Chip size="small" variant="outlined" label={`${test.test_percent}% no teste`} sx={{ borderRadius: 1.5, height: 22 }} />
          <Chip size="small" variant="outlined" label={`Vence por ${metricLabel}`} sx={{ borderRadius: 1.5, height: 22 }} />
          <Chip size="small" variant="outlined" label={`${totalInTest} e-mails enviados no teste`} sx={{ borderRadius: 1.5, height: 22 }} />
        </Stack>
      </Box>
      <Divider />

      {/* Variantes com barra comparativa */}
      <Stack sx={{ p: 1.25 }} spacing={1}>
        {variants.map((v) => {
          const m = v.metrics || {};
          const primary = primaryOf(v);
          const win = v.is_winner || (testing && leader && leader.id === v.id && primary > 0);
          const barPct = Math.round((primary / maxPrimary) * 100);
          const barColor = v.is_winner ? 'success.main' : win ? 'secondary.main' : 'grey.400';
          return (
            <Box key={v.id} sx={{ p: 1.1, borderRadius: 2, bgcolor: (t) => (v.is_winner ? `rgba(${t.vars.palette.success.mainChannel} / 0.10)` : 'action.hover'), border: v.is_winner ? '1px solid' : '1px solid transparent', borderColor: v.is_winner ? 'success.main' : 'transparent' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: v.is_winner ? 'success.main' : 'secondary.main', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{v.label}</Box>
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap title={v.subject}>{v.subject}</Typography>
                {v.is_winner ? (
                  <Chip size="small" color="success" icon={<EmojiEventsRoundedIcon sx={{ fontSize: 15 }} />} label="Vencedora" sx={{ borderRadius: 1.5, fontWeight: 800, height: 22 }} />
                ) : (
                  <Typography variant="h5" sx={{ fontWeight: 900, color: win ? 'secondary.main' : 'text.secondary', lineHeight: 1 }}>{pct(primary)}</Typography>
                )}
              </Stack>

              {/* barra do indicador vencedor */}
              <Box sx={{ height: 8, borderRadius: 999, bgcolor: 'action.selected', overflow: 'hidden', mb: 0.6 }}>
                <Box sx={{ height: '100%', width: `${barPct}%`, bgcolor: barColor, borderRadius: 999, transition: 'width .4s' }} />
              </Box>

              <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary"><b>{v.recipients_count}</b> enviados</Typography>
                <Typography variant="caption" sx={{ color: test.winner_metric === 'open' ? 'text.primary' : 'text.secondary', fontWeight: test.winner_metric === 'open' ? 800 : 400 }}>
                  {m.opens || 0} aberturas · {pct(m.open_rate)}
                </Typography>
                <Typography variant="caption" sx={{ color: test.winner_metric === 'click' ? 'text.primary' : 'text.secondary', fontWeight: test.winner_metric === 'click' ? 800 : 400 }}>
                  {m.clicks || 0} cliques · {pct(m.click_rate)}
                </Typography>
              </Stack>
            </Box>
          );
        })}

        {test.error_message ? <Alert severity="warning" sx={{ borderRadius: 2, py: 0.25 }}>{test.error_message}</Alert> : null}
      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------- Main
export default function AbTests() {
  const { emailProjects } = useEmailProjects();
  const projects = useMemo(() => toList(emailProjects), [emailProjects]);
  const [projectId, setProjectId] = useState('');

  const { templates } = useTemplatesPerProject(projectId, { recycle: false });
  const templateList = useMemo(() => toList(templates), [templates]);

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const load = useCallback(async (pid) => {
    if (!pid) { setTests([]); return; }
    setLoading(true);
    try {
      const data = await get(`/email/projects/${pid}/ab-tests`);
      setTests(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(getErr(e, 'Falha ao carregar testes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(projectId); }, [projectId, load]);

  const handleCreate = async (payload) => {
    setCreating(true); setCreateError('');
    try {
      await post(`/email/projects/${projectId}/ab-tests`, payload);
      toast.success('Teste A/B iniciado! As amostras foram enviadas.');
      setDialogOpen(false);
      load(projectId);
    } catch (e) {
      setCreateError(getErr(e, 'Falha ao iniciar o teste.'));
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (t) => {
    try {
      await remove(`/email/projects/${projectId}/ab-tests/${t.id}`);
      toast.success('Teste cancelado.');
      load(projectId);
    } catch (e) {
      toast.error(getErr(e, 'Falha ao cancelar.'));
    }
  };

  return (
    <MainCard content={false} sx={{ overflow: 'hidden', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 1.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <ScienceRoundedIcon color="secondary" />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>Testes A/B</Typography>
              <Typography variant="body2" color="text.secondary">Teste assuntos e templates numa fatia da base; a vencedora vai para o resto.</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField select size="small" label="Projeto" value={projectId} onChange={(e) => setProjectId(e.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="" disabled>Selecione um projeto</MenuItem>
              {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
            <Tooltip title="Atualizar"><span><IconButton onClick={() => load(projectId)} disabled={!projectId} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><RefreshRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
            <Button variant="contained" color="secondary" startIcon={<AddRoundedIcon fontSize="small" />} onClick={() => { setCreateError(''); setDialogOpen(true); }} disabled={!projectId} sx={{ borderRadius: 2, fontWeight: 800 }}>Novo teste A/B</Button>
          </Stack>
        </Stack>
      </Box>
      <Divider />

      <Box sx={{ p: { xs: 2, md: 3 } }}>
        {!projectId ? (
          <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
            <Typography variant="h6">Selecione um projeto</Typography>
            <Typography variant="body2" color="text.secondary">Escolha um projeto de e-mail para ver e criar testes A/B.</Typography>
          </Box>
        ) : loading ? (
          <Grid container spacing={2}>{[0, 1].map((i) => <Grid size={{ xs: 12, md: 6 }} key={i}><Skeleton variant="rounded" height={190} /></Grid>)}</Grid>
        ) : tests.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
            <Typography variant="h6">Nenhum teste A/B ainda</Typography>
            <Typography variant="body2" color="text.secondary">Crie o primeiro para descobrir qual assunto/template converte mais.</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {tests.map((t) => (
              <Grid size={{ xs: 12, md: 6 }} key={t.id}><TestCard test={t} onCancel={handleCancel} disabled={loading} /></Grid>
            ))}
          </Grid>
        )}
      </Box>

      <CreateDialog
        open={dialogOpen}
        projectId={projectId}
        templates={templateList}
        loading={creating}
        error={createError}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
      />
    </MainCard>
  );
}
