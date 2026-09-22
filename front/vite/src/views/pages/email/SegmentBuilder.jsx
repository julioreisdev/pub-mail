import { useCallback, useEffect, useMemo, useState } from 'react';

import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

import { AddRoundedIcon as AddRoundedIcon } from 'ui-component/icons';
import { DeleteOutlineRoundedIcon as DeleteOutlineRoundedIcon } from 'ui-component/icons';
import { GroupsRoundedIcon as GroupsRoundedIcon } from 'ui-component/icons';

import { post } from 'api/api';

// Catálogo de condições (rótulos PT-BR + campos por tipo).
const CONDITION_DEFS = {
  opened_within: { label: 'Abriu algum e-mail', fields: ['days'] },
  not_opened_within: { label: 'NÃO abriu nenhum e-mail', fields: ['days'] },
  clicked_within: { label: 'Clicou em algum link', fields: ['days'] },
  not_clicked_within: { label: 'NÃO clicou em nenhum link', fields: ['days'] },
  never_interacted: { label: 'Nunca interagiu (nem abriu nem clicou)', fields: [] },
  open_rate: { label: 'Taxa de abertura', fields: ['op', 'percent', 'days'] },
  open_count: { label: 'Quantidade de aberturas', fields: ['op', 'count', 'days'] },
  click_rate: { label: 'Taxa de clique', fields: ['op', 'percent', 'days'] },
  click_count: { label: 'Quantidade de cliques', fields: ['op', 'count', 'days'] },
  has_tag: { label: 'Tem a tag', fields: ['tag'] },
  not_has_tag: { label: 'NÃO tem a tag', fields: ['tag'] },
  source_is: { label: 'Origem é', fields: ['source'] },
  joined_within: { label: 'Entrou no projeto', fields: ['days'] },
  joined_before: { label: 'Está no projeto há mais de', fields: ['days'] }
};

const TYPE_ORDER = [
  'opened_within', 'not_opened_within', 'clicked_within', 'not_clicked_within',
  'never_interacted', 'open_rate', 'open_count', 'click_rate', 'click_count',
  'has_tag', 'not_has_tag', 'source_is', 'joined_within', 'joined_before'
];

const defaultsFor = (type) => {
  const base = { type };
  const f = CONDITION_DEFS[type].fields;
  if (f.includes('days')) base.days = 30;
  if (f.includes('op')) base.op = 'gte';
  if (f.includes('percent')) base.percent = 15;
  if (f.includes('count')) base.count = 1;
  if (f.includes('tag')) base.tag = '';
  if (f.includes('source')) base.source = '';
  return base;
};

// Um lead pode casar? (validação leve p/ não mandar condição incompleta)
const isValidCondition = (c) => {
  const f = CONDITION_DEFS[c.type]?.fields || [];
  if (f.includes('tag') && !String(c.tag || '').trim()) return false;
  if (f.includes('source') && !String(c.source || '').trim()) return false;
  return true;
};

function ConditionRow({ cond, onChange, onRemove }) {
  const def = CONDITION_DEFS[cond.type];
  const f = def.fields;
  const set = (patch) => onChange({ ...cond, ...patch });

  return (
    <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField
          select size="small" value={cond.type}
          onChange={(e) => onChange(defaultsFor(e.target.value))}
          sx={{ minWidth: 210 }}
        >
          {TYPE_ORDER.map((t) => <MenuItem key={t} value={t}>{CONDITION_DEFS[t].label}</MenuItem>)}
        </TextField>

        {f.includes('op') ? (
          <TextField select size="small" value={cond.op} onChange={(e) => set({ op: e.target.value })} sx={{ minWidth: 92 }}>
            <MenuItem value="gte">≥</MenuItem>
            <MenuItem value="lte">≤</MenuItem>
          </TextField>
        ) : null}

        {f.includes('percent') ? (
          <TextField size="small" type="number" label="%" value={cond.percent}
            onChange={(e) => set({ percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            inputProps={{ min: 0, max: 100 }} sx={{ width: 90 }} />
        ) : null}

        {f.includes('count') ? (
          <TextField size="small" type="number" label="qtd" value={cond.count}
            onChange={(e) => set({ count: Math.max(0, Number(e.target.value) || 0) })}
            inputProps={{ min: 0 }} sx={{ width: 90 }} />
        ) : null}

        {f.includes('days') ? (
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography variant="body2" color="text.secondary">nos últimos</Typography>
            <TextField size="small" type="number" value={cond.days}
              onChange={(e) => set({ days: Math.max(1, Number(e.target.value) || 1) })}
              inputProps={{ min: 1 }} sx={{ width: 84 }} />
            <Typography variant="body2" color="text.secondary">dias</Typography>
          </Stack>
        ) : null}

        {f.includes('tag') ? (
          <TextField size="small" label="tag" value={cond.tag} onChange={(e) => set({ tag: e.target.value })} sx={{ minWidth: 140 }} />
        ) : null}

        {f.includes('source') ? (
          <TextField size="small" label="origem" placeholder="ex: quiz, formulário" value={cond.source} onChange={(e) => set({ source: e.target.value })} sx={{ minWidth: 160 }} />
        ) : null}

        <Box sx={{ flex: 1 }} />
        <IconButton size="small" color="error" onClick={onRemove}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
      </Stack>
    </Box>
  );
}

/**
 * value: segmento ({ match, conditions }) ou null
 * onChange(segment|null)
 */
export default function SegmentBuilder({ value, projectId, onChange }) {
  const [enabled, setEnabled] = useState(Boolean(value?.conditions?.length));
  const [match, setMatch] = useState(value?.match === 'any' ? 'any' : 'all');
  const [conditions, setConditions] = useState(
    Array.isArray(value?.conditions) && value.conditions.length ? value.conditions : []
  );

  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  // Emite o segmento pro pai sempre que muda.
  const emit = useCallback((en, m, conds) => {
    const valid = conds.filter(isValidCondition);
    if (!en || valid.length === 0) onChange(null);
    else onChange({ match: m, conditions: valid });
  }, [onChange]);

  // Sincroniza o pai com o estado inicial ao montar (edição de um segmento existente).
  useEffect(() => {
    emit(enabled, match, conditions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (en) => {
    setEnabled(en);
    if (en && conditions.length === 0) {
      const first = [defaultsFor('open_rate')];
      setConditions(first);
      emit(true, match, first);
    } else {
      emit(en, match, conditions);
    }
  };
  const setConds = (next) => { setConditions(next); emit(enabled, match, next); };
  const setMatchMode = (m) => { setMatch(m); emit(enabled, m, conditions); };

  const addCondition = () => setConds([...conditions, defaultsFor('opened_within')]);
  const updateCondition = (i, c) => setConds(conditions.map((x, idx) => (idx === i ? c : x)));
  const removeCondition = (i) => setConds(conditions.filter((_, idx) => idx !== i));

  // Preview ao vivo da contagem.
  const validConds = useMemo(() => conditions.filter(isValidCondition), [conditions]);
  const segmentForPreview = useMemo(
    () => (enabled && validConds.length ? { match, conditions: validConds } : null),
    [enabled, match, validConds]
  );

  useEffect(() => {
    if (!projectId || !segmentForPreview) { setPreview(null); return; }
    let alive = true;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const data = await post(`/email/projects/${projectId}/segment-preview`, { segment: segmentForPreview });
        if (alive) setPreview(data);
      } catch {
        if (alive) setPreview(null);
      } finally {
        if (alive) setPreviewing(false);
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [projectId, segmentForPreview]);

  return (
    <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: enabled ? 'secondary.main' : 'divider', p: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <GroupsRoundedIcon fontSize="small" color={enabled ? 'secondary' : 'disabled'} />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Segmentar leads (condições)</Typography>
            <Typography variant="caption" color="text.secondary">Enviar só para quem casa com as regras. Desligado = todos os inscritos.</Typography>
          </Box>
        </Stack>
        <Switch checked={enabled} onChange={(e) => toggle(e.target.checked)} color="secondary" />
      </Stack>

      {enabled ? (
        <Box sx={{ mt: 1.5 }}>
          {/* Contagem ao vivo — proeminente, sempre visível */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              mb: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'secondary.light',
              bgcolor: (theme) => `rgba(${theme.vars.palette.secondary.mainChannel} / 0.08)`
            }}
          >
            <Box
              sx={{
                width: 40, height: 40, flexShrink: 0, borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                bgcolor: (theme) => `rgba(${theme.vars.palette.secondary.mainChannel} / 0.16)`,
                color: 'secondary.main'
              }}
            >
              <GroupsRoundedIcon />
            </Box>
            {previewing ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} color="secondary" />
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>Calculando…</Typography>
              </Stack>
            ) : preview ? (
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h4" color="secondary.main" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                  {preview.count} {preview.count === 1 ? 'lead se encaixa' : 'leads se encaixam'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  de {preview.total} inscritos ativos receberiam este disparo
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                Configure ao menos uma condição para ver quantos leads se encaixam.
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2">O lead deve casar com</Typography>
            <TextField select size="small" value={match} onChange={(e) => setMatchMode(e.target.value)} sx={{ minWidth: 150 }}>
              <MenuItem value="all">TODAS as condições</MenuItem>
              <MenuItem value="any">QUALQUER condição</MenuItem>
            </TextField>
          </Stack>

          <Stack spacing={1}>
            {conditions.map((c, i) => (
              <ConditionRow key={i} cond={c} onChange={(nc) => updateCondition(i, nc)} onRemove={() => removeCondition(i)} />
            ))}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <Button size="small" variant="outlined" startIcon={<AddRoundedIcon fontSize="small" />} onClick={addCondition} sx={{ borderRadius: 2, fontWeight: 700 }}>
              Adicionar condição
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}
