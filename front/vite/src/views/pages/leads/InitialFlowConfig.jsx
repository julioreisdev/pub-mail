import { useEffect, useState } from 'react';

import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import { CloseRoundedIcon as CloseRoundedIcon } from 'ui-component/icons';
import { SaveRoundedIcon as SaveRoundedIcon } from 'ui-component/icons';
import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import { DeleteRoundedIcon as DeleteRoundedIcon } from 'ui-component/icons';
import { ArrowUpwardRoundedIcon as ArrowUpwardRoundedIcon } from 'ui-component/icons';
import { ArrowDownwardRoundedIcon as ArrowDownwardRoundedIcon } from 'ui-component/icons';
import { ContentCopyRoundedIcon as ContentCopyRoundedIcon } from 'ui-component/icons';
import { EditRoundedIcon as EditRoundedIcon } from 'ui-component/icons';
import { AccessTimeRoundedIcon as AccessTimeRoundedIcon } from 'ui-component/icons';
import { PersonAddAlt1RoundedIcon as PersonAddAlt1RoundedIcon } from 'ui-component/icons';
import { MailRoundedIcon as MailRoundedIcon } from 'ui-component/icons';
import { CheckCircleRoundedIcon as CheckCircleRoundedIcon } from 'ui-component/icons';
import { AltRouteRoundedIcon as AltRouteRoundedIcon } from 'ui-component/icons';
import { QueryStatsRoundedIcon as QueryStatsRoundedIcon } from 'ui-component/icons';

import { get, put } from 'api/api';
import EmailBuilder from '../email/EmailBuilder';

const getErr = (e, f) => e?.response?.data?.message || e?.message || f;
const pct = (r) => `${Math.round((Number(r) || 0) * 100)}%`;

function emptyStep(first) {
  return {
    delay_value: first ? 5 : 60,
    delay_unit: 'minutes',
    subject: '',
    body_html: '',
    builder_model: null,
    condition: { type: 'always', on_fail: 'skip' }
  };
}

const normCond = (c) => ({
  type: c?.type === 'opened' || c?.type === 'clicked' ? c.type : 'always',
  on_fail: c?.on_fail === 'stop' ? 'stop' : 'skip'
});

// Editor de condição do passo (só p/ passos após o 1º).
function StepCondition({ condition, onChange }) {
  const c = normCond(condition);
  return (
    <Stack
      direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap
      sx={{ px: 1.25, py: 0.6, mt: 0.75, borderRadius: 2, border: '1px dashed', borderColor: c.type === 'always' ? 'divider' : 'secondary.main', bgcolor: 'background.paper' }}
    >
      <AltRouteRoundedIcon fontSize="small" color={c.type === 'always' ? 'disabled' : 'secondary'} />
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Enviar</Typography>
      <TextField
        select size="small" value={c.type}
        onChange={(e) => onChange({ type: e.target.value, on_fail: c.on_fail })}
        sx={{ '& .MuiSelect-select': { py: 0.4, fontSize: 13 } }}
      >
        <MenuItem value="always">sempre</MenuItem>
        <MenuItem value="opened">se abriu o e-mail anterior</MenuItem>
        <MenuItem value="clicked">se clicou no e-mail anterior</MenuItem>
      </TextField>
      {c.type !== 'always' ? (
        <>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>senão</Typography>
          <TextField
            select size="small" value={c.on_fail}
            onChange={(e) => onChange({ type: c.type, on_fail: e.target.value })}
            sx={{ '& .MuiSelect-select': { py: 0.4, fontSize: 13 } }}
          >
            <MenuItem value="skip">pular este e-mail</MenuItem>
            <MenuItem value="stop">sair do fluxo</MenuItem>
          </TextField>
        </>
      ) : null}
    </Stack>
  );
}

// Faixa de métricas de um passo.
function MetricsStrip({ m }) {
  if (!m || (m.sent || 0) === 0) {
    return (
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
        <QueryStatsRoundedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
        <Typography variant="caption" color="text.secondary">Sem envios ainda.</Typography>
      </Stack>
    );
  }
  const items = [
    { label: 'Enviados', value: m.sent },
    { label: 'Entregues', value: m.delivered, sub: pct(m.delivery_rate), color: 'success' },
    { label: 'Aberturas', value: m.opens, sub: pct(m.open_rate), color: 'info' },
    { label: 'Cliques', value: m.clicks, sub: pct(m.click_rate), color: 'secondary' },
    { label: 'CTOR', value: pct(m.ctor), plain: true },
    ...(m.bounces ? [{ label: 'Bounces', value: m.bounces, sub: pct(m.bounce_rate), color: 'warning' }] : []),
    ...(m.complaints ? [{ label: 'Spam', value: m.complaints, sub: pct(m.complaint_rate), color: 'error' }] : [])
  ];
  return (
    <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
      {items.map((it, idx) => (
        <Chip
          key={idx}
          size="small"
          variant="outlined"
          color={it.color || 'default'}
          label={it.plain ? `${it.label} ${it.value}` : `${it.label}: ${it.value}${it.sub ? ` · ${it.sub}` : ''}`}
          sx={{ height: 22, borderRadius: 1.5, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
        />
      ))}
    </Stack>
  );
}

// linha vertical do fluxo
function Line({ h = 22 }) {
  return <Box sx={{ width: 3, height: h, bgcolor: 'divider', mx: 'auto', borderRadius: 2 }} />;
}

// conector com o editor de tempo de espera
function DelayConnector({ step, index, onChange }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Line h={20} />
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ px: 1.25, py: 0.6, borderRadius: 999, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 2px 8px rgba(2,6,23,.06)' }}
      >
        <AccessTimeRoundedIcon fontSize="small" color="secondary" />
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
          {index === 0 ? 'Após captar, aguardar' : 'Aguardar'}
        </Typography>
        <TextField
          size="small"
          type="number"
          value={step.delay_value}
          onChange={(e) => onChange({ delay_value: Math.max(0, Number(e.target.value) || 0) })}
          inputProps={{ min: 0, style: { width: 52, textAlign: 'center', padding: '4px 6px' } }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <TextField
          select
          size="small"
          value={step.delay_unit}
          onChange={(e) => onChange({ delay_unit: e.target.value })}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 }, '& .MuiSelect-select': { py: 0.5 } }}
        >
          <MenuItem value="minutes">min</MenuItem>
          <MenuItem value="hours">horas</MenuItem>
        </TextField>
      </Stack>
      {index > 0 ? (
        <Box sx={{ maxWidth: 520, width: '100%', px: 1 }}>
          <StepCondition condition={step.condition} onChange={(c) => onChange({ condition: c })} />
        </Box>
      ) : null}
      <Line h={20} />
    </Box>
  );
}

// balão de nó
function Node({ accent, icon, children, sx }) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 520,
        borderRadius: 3,
        border: '1px solid',
        borderColor: accent ? 'secondary.main' : 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 8px 26px rgba(2,6,23,.08)',
        p: 1.75,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        ...sx
      }}
    >
      {icon}
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

function IconCircle({ children, color = 'secondary.main' }) {
  return (
    <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: color, color: '#fff', flexShrink: 0 }}>
      {children}
    </Box>
  );
}

export default function InitialFlowConfig({ open, project, onClose, onSaved, inline = false }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState([]);
  const [enrolled, setEnrolled] = useState(0);
  const [builderIndex, setBuilderIndex] = useState(null);
  const [metricsByStep, setMetricsByStep] = useState({});
  const [funnel, setFunnel] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !project?.id) return;
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const data = await get(`/email/projects/${project.id}/flow`);
        if (!alive) return;
        setActive(Boolean(data?.active));
        setSteps(Array.isArray(data?.steps) ? data.steps.map((s) => ({
          id: s.id || null,
          delay_value: Number(s.delay_value) || 0,
          delay_unit: s.delay_unit === 'hours' ? 'hours' : 'minutes',
          subject: s.subject || '',
          body_html: s.body_html || '',
          builder_model: s.builder_model || null,
          condition: normCond(s.condition)
        })) : []);
        setEnrolled(Number(data?.enrolled_active) || 0);

        // métricas por passo (best-effort)
        try {
          const met = await get(`/email/projects/${project.id}/flow/metrics`);
          if (!alive) return;
          const map = {};
          (met?.steps || []).forEach((st) => { if (st.step_id) map[st.step_id] = st; });
          setMetricsByStep(map);
          setFunnel(met?.enrollments || null);
        } catch { /* métricas são opcionais */ }
      } catch (e) {
        if (alive) setError(getErr(e, 'Falha ao carregar o fluxo.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, project?.id]);

  const updateStep = (i, patch) => setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addStep = () => setSteps((prev) => [...prev, emptyStep(prev.length === 0)]);
  const removeStep = (i) => setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const duplicateStep = (i) => setSteps((prev) => { const n = [...prev]; n.splice(i + 1, 0, { ...prev[i], id: null }); return n; });
  const moveStep = (i, dir) => setSteps((prev) => {
    const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const n = [...prev];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        active,
        steps: steps.map((s, i) => ({
          id: s.id || undefined,
          delay_value: Math.max(0, Math.floor(Number(s.delay_value) || 0)),
          delay_unit: s.delay_unit === 'hours' ? 'hours' : 'minutes',
          subject: s.subject || '',
          body_html: s.body_html || '',
          builder_model: s.builder_model || null,
          condition: i === 0 ? { type: 'always', on_fail: 'skip' } : normCond(s.condition)
        }))
      };
      await put(`/email/projects/${project.id}/flow`, payload);
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setError(getErr(e, 'Falha ao salvar o fluxo.'));
      setSaving(false);
    }
  };

  const emptyTemplates = steps.some((s) => !String(s.body_html || '').trim());

  const handleDelete = async () => {
    setSaving(true);
    setError('');
    try {
      await put(`/email/projects/${project.id}/flow`, { active: false, steps: [] });
      setSteps([]);
      setActive(false);
      setConfirmDelete(false);
      onSaved && onSaved();
    } catch (e) {
      setError(getErr(e, 'Falha ao apagar o fluxo.'));
    } finally {
      setSaving(false);
    }
  };

  const inner = (
    <>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: inline ? 0 : 2, py: 1.25, borderBottom: inline ? 'none' : '1px solid', borderColor: 'divider', bgcolor: inline ? 'transparent' : 'background.paper' }}>
        {!inline && (
          <IconButton onClick={onClose} disabled={saving}><CloseRoundedIcon /></IconButton>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }} noWrap>{inline ? project?.name : `Fluxo Inicial — ${project?.name}`}</Typography>
          <Typography variant="caption" color="text.secondary">
            {steps.length} e-mail{steps.length === 1 ? '' : 's'} · {enrolled} em andamento
            {funnel ? ` · ${funnel.completed} concluíram · ${funnel.stopped} saíram por condição` : ''}
          </Typography>
        </Box>
        {steps.length > 0 && (
          <Button variant="outlined" color="error" startIcon={<DeleteRoundedIcon />} disabled={saving || loading} onClick={() => setConfirmDelete(true)} sx={{ borderRadius: 2, fontWeight: 700 }}>
            Apagar fluxo
          </Button>
        )}
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.25, py: 0.5, borderRadius: 2, border: '1px solid', borderColor: active ? 'secondary.main' : 'divider' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: active ? 'secondary.main' : 'text.secondary' }}>
            {active ? 'Ativo' : 'Inativo'}
          </Typography>
          <Switch color="secondary" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </Stack>
        <Button variant="contained" color="secondary" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />} disabled={saving || loading} onClick={handleSave} sx={{ borderRadius: 2, fontWeight: 700 }}>
          Salvar
        </Button>
      </Stack>

      {/* Body */}
      <Box sx={inline ? { py: 3 } : { flex: 1, overflowY: 'auto', bgcolor: 'background.default', px: 2, py: 3 }}>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 300 }}><CircularProgress /></Box>
        ) : (
          <Box sx={{ maxWidth: 560, mx: 'auto' }}>
            {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert> : null}
            {active && emptyTemplates ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Há e-mails sem template. E-mails sem conteúdo são ignorados no envio — clique em <b>Editar template</b> para montá-los.
              </Alert>
            ) : null}

            <Stack alignItems="center" spacing={0}>
              {/* Nó inicial */}
              <Node accent icon={<IconCircle color="secondary.main"><PersonAddAlt1RoundedIcon fontSize="small" /></IconCircle>}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Lead captado</Typography>
                <Typography variant="caption" color="text.secondary">
                  Quando um lead entra no projeto “{project?.name}”, começa o fluxo.
                </Typography>
              </Node>

              {steps.map((s, i) => (
                <Box key={i} sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <DelayConnector step={s} index={i} onChange={(patch) => updateStep(i, patch)} />
                  <Node icon={<IconCircle color={String(s.body_html || '').trim() ? 'primary.main' : 'grey.400'}><MailRoundedIcon fontSize="small" /></IconCircle>}>
                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>E-mail {i + 1}</Typography>
                          {String(s.body_html || '').trim() ? (
                            <Chip size="small" color="success" variant="outlined" icon={<CheckCircleRoundedIcon />} label="Template pronto" sx={{ height: 20, borderRadius: 1.5, '& .MuiChip-label': { px: 0.5, fontSize: 11 } }} />
                          ) : (
                            <Chip size="small" color="warning" variant="outlined" label="Sem template" sx={{ height: 20, borderRadius: 1.5, '& .MuiChip-label': { fontSize: 11 } }} />
                          )}
                        </Stack>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Assunto do e-mail"
                          value={s.subject}
                          onChange={(e) => updateStep(i, { subject: e.target.value })}
                          sx={{ mt: 0.75, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                        <Button size="small" variant="outlined" color="secondary" startIcon={<EditRoundedIcon fontSize="small" />} onClick={() => setBuilderIndex(i)} sx={{ mt: 1, borderRadius: 2, fontWeight: 800 }}>
                          Editar template
                        </Button>
                        <MetricsStrip m={s.id ? metricsByStep[s.id] : null} />
                      </Box>
                      <Stack spacing={0}>
                        <Tooltip title="Subir"><span><IconButton size="small" disabled={i === 0} onClick={() => moveStep(i, -1)}><ArrowUpwardRoundedIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
                        <Tooltip title="Descer"><span><IconButton size="small" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}><ArrowDownwardRoundedIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
                        <Tooltip title="Duplicar"><span><IconButton size="small" onClick={() => duplicateStep(i)}><ContentCopyRoundedIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                        <Tooltip title="Remover"><span><IconButton size="small" color="error" onClick={() => removeStep(i)}><DeleteRoundedIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
                      </Stack>
                    </Stack>
                  </Node>
                </Box>
              ))}

              {/* Adicionar e-mail */}
              <Line h={20} />
              <Box sx={{ borderTop: 'none' }}>
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={addStep} sx={{ borderRadius: 999, fontWeight: 800, boxShadow: '0 6px 18px rgba(2,6,23,.12)' }}>
                  Adicionar e-mail
                </Button>
              </Box>

              {steps.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                  Adicione o primeiro e-mail para começar o fluxo.
                </Typography>
              ) : null}
            </Stack>
          </Box>
        )}
      </Box>

      {/* Construtor do template do step */}
      <EmailBuilder
        open={builderIndex !== null}
        mode="step"
        initialModel={builderIndex !== null ? steps[builderIndex]?.builder_model || null : null}
        initialSubject={builderIndex !== null ? steps[builderIndex]?.subject || '' : ''}
        onClose={() => setBuilderIndex(null)}
        onSave={({ subject, html, model }) => {
          if (builderIndex !== null) updateStep(builderIndex, { subject: subject || steps[builderIndex]?.subject || '', body_html: html, builder_model: model });
          setBuilderIndex(null);
        }}
      />
    </>
  );

  const confirmDialog = (
    <Dialog open={confirmDelete} onClose={saving ? undefined : () => setConfirmDelete(false)} maxWidth="xs" fullWidth>
      <Box sx={{ p: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Apagar fluxo inicial?</Typography>
        <Typography variant="body2" color="text.secondary">
          Os {steps.length} e-mail{steps.length === 1 ? '' : 's'} configurado{steps.length === 1 ? '' : 's'} serão removidos e o fluxo desativado. Leads em andamento param de receber os próximos e-mails.
        </Typography>
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2.5 }}>
          <Button variant="outlined" onClick={() => setConfirmDelete(false)} disabled={saving} sx={{ borderRadius: 2 }}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <DeleteRoundedIcon />} sx={{ borderRadius: 2 }}>Apagar</Button>
        </Stack>
      </Box>
    </Dialog>
  );

  if (inline) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {inner}
        {confirmDialog}
      </Box>
    );
  }
  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullScreen>
      {inner}
      {confirmDialog}
    </Dialog>
  );
}
