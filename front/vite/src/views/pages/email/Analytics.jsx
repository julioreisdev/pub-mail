import { useCallback, useEffect, useMemo, useState } from 'react';

import { useColorScheme, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';

import {
  IconRefresh,
  IconTrendingUp,
  IconTrendingDown,
  IconDownload,
  IconSend,
  IconMailOpened,
  IconClick,
  IconAlertTriangle,
  IconMoodSad,
  IconUserOff,
  IconUsers,
  IconRocket,
  IconClock,
  IconCalendarStats
} from '@tabler/icons-react';

import Chart from 'react-apexcharts';

import MainCard from 'ui-component/cards/MainCard';
import { get } from 'api/api';
import useEmailProjects from '../../../hooks/useEmailProjects';

const toList = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);
const getErr = (e, f) => e?.response?.data?.message || e?.message || f;
const pct = (r) => `${(Number(r || 0) * 100).toFixed(1)}%`;
const nfmt = (n) => Number(n || 0).toLocaleString('pt-BR');
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function isoDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
const todayIso = () => new Date().toISOString().slice(0, 10);
function firstOfMonthIso() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

// delta % entre atual e anterior (inverse=true → cair é bom, ex.: bounces)
function delta(curr, prev, inverse = false) {
  const c = Number(curr || 0);
  const p = Number(prev || 0);
  if (p === 0) return c > 0 ? { txt: 'novo', up: true, good: !inverse } : null;
  const change = (c - p) / p;
  if (Math.abs(change) < 0.001) return null;
  const up = change > 0;
  return { txt: `${up ? '+' : ''}${(change * 100).toFixed(0)}%`, up, good: inverse ? !up : up };
}

// ---------------------------------------------------------------- KPI card
function KpiCard({ icon: Icon, label, value, sub, color, deltaInfo }) {
  return (
    <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: color || 'text.secondary',
            bgcolor: (t) => alpha(typeof color === 'string' && color.startsWith('#') ? color : t.palette.text.primary, 0.12)
          }}
        >
          {Icon ? <Icon size={19} stroke={1.7} /> : null}
        </Box>
        {deltaInfo ? (
          <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: deltaInfo.good ? 'success.main' : 'error.main' }}>
            {deltaInfo.up ? <IconTrendingUp size={15} stroke={2} /> : <IconTrendingDown size={15} stroke={2} />}
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{deltaInfo.txt}</Typography>
          </Stack>
        ) : null}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="h3" sx={{ fontWeight: 700, mt: 0.25, color: color || 'text.primary' }}>{value}</Typography>
      {sub ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>{sub}</Typography> : null}
    </Box>
  );
}

// ---------------------------------------------------------------- Funil
function FunnelStage({ label, value, base, prev, color }) {
  const wPct = base > 0 ? Math.min(100, Math.round((value / base) * 100)) : 0;
  const conv = prev != null && prev > 0 ? Math.round((value / prev) * 100) : null;
  return (
    <Box sx={{ mb: 1.25 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{nfmt(value)}</Typography>
          {conv != null ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>{conv}%</Typography> : null}
        </Stack>
      </Stack>
      <Box sx={{ height: 12, borderRadius: 6, bgcolor: 'action.hover', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${wPct}%`, borderRadius: 6, bgcolor: color, transition: 'width .5s ease' }} />
      </Box>
    </Box>
  );
}

export default function Analytics() {
  const { emailProjects } = useEmailProjects();
  const projects = useMemo(() => toList(emailProjects), [emailProjects]);

  const [projectId, setProjectId] = useState('');
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const applyPreset = (p) => {
    setPreset(p);
    if (p === 'month') {
      setFrom(firstOfMonthIso());
      setTo(todayIso());
    } else if (p !== 'custom') {
      setFrom(isoDaysAgo(Number(p)));
      setTo(todayIso());
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('project_id', projectId);
      if (from) params.set('from', `${from}T00:00:00.000Z`);
      if (to) params.set('to', `${to}T23:59:59.999Z`);
      const res = await get(`/email/analytics/overview?${params.toString()}`);
      setData(res);
    } catch (e) {
      setError(getErr(e, 'Falha ao carregar analytics.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, from, to]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const totals = data?.totals || {};
  const previous = data?.previous || {};
  const rates = data?.rates || {};
  const engagement = data?.engagement || {};
  const series = data?.series || [];
  const growth = data?.growth || [];
  const perProject = data?.per_project || [];
  const topSubjects = data?.top_subjects || [];
  const byWeekday = data?.by_weekday || [];
  const byHour = data?.by_hour || [];

  // -------- gráfico principal: barras (volume) + linhas (taxas) eixo duplo
  const mainOptions = useMemo(
    () => ({
      chart: { type: 'line', stacked: false, toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: isDark ? 'dark' : 'light' },
      stroke: { width: [0, 3, 3], curve: 'smooth' },
      plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      colors: ['#3b82f6', '#06b6d4', '#8b5cf6'],
      fill: { type: ['solid', 'solid', 'solid'], opacity: [0.85, 1, 1] },
      xaxis: {
        categories: series.map((s) => s.date),
        labels: { rotate: -45, style: { fontSize: '10px' } },
        tickAmount: Math.min(12, series.length),
        axisBorder: { show: false }
      },
      yaxis: [
        { seriesName: 'Enviados', title: { text: 'Volume' }, labels: { formatter: (v) => nfmt(Math.round(v)) } },
        { seriesName: ['Abertura', 'Cliques'], opposite: true, min: 0, max: 100, title: { text: 'Taxa' }, labels: { formatter: (v) => `${Math.round(v)}%` } }
      ],
      legend: { position: 'top' },
      grid: { borderColor: gridColor, strokeDashArray: 4 },
      tooltip: { theme: isDark ? 'dark' : 'light', shared: true, intersect: false }
    }),
    [series, isDark, gridColor]
  );
  const mainSeries = useMemo(
    () => [
      { name: 'Enviados', type: 'column', data: series.map((s) => s.sent) },
      { name: 'Abertura', type: 'line', data: series.map((s) => Math.round((s.open_rate || 0) * 1000) / 10) },
      { name: 'Cliques', type: 'line', data: series.map((s) => Math.round((s.click_rate || 0) * 1000) / 10) }
    ],
    [series]
  );

  // -------- donut engajamento
  const donutOptions = useMemo(
    () => ({
      chart: { type: 'donut', fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: isDark ? 'dark' : 'light' },
      labels: ['Clicaram', 'Abriram (sem clicar)', 'Sem interação'],
      colors: ['#8b5cf6', '#06b6d4', isDark ? '#475569' : '#cbd5e1'],
      legend: { position: 'bottom' },
      dataLabels: { enabled: true, formatter: (v) => `${v.toFixed(0)}%` },
      stroke: { width: 0 },
      plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'Leads', formatter: () => nfmt(engagement.total) } } } } }
    }),
    [isDark, engagement.total]
  );
  const donutSeries = useMemo(() => [engagement.clicked || 0, engagement.opened || 0, engagement.none || 0], [engagement]);
  const hasEngagement = (engagement.total || 0) > 0;

  // -------- crescimento da base
  const growthOptions = useMemo(
    () => ({
      chart: { type: 'area', toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: isDark ? 'dark' : 'light' },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
      colors: ['#22c55e'],
      xaxis: { categories: growth.map((g) => g.date), labels: { rotate: -45, style: { fontSize: '10px' } }, tickAmount: Math.min(12, growth.length) },
      yaxis: { labels: { formatter: (v) => nfmt(Math.round(v)) } },
      grid: { borderColor: gridColor, strokeDashArray: 4 },
      tooltip: { theme: isDark ? 'dark' : 'light' }
    }),
    [growth, isDark, gridColor]
  );
  const growthSeries = useMemo(() => [{ name: 'Novos leads', data: growth.map((g) => g.new_leads) }], [growth]);
  const totalNewLeads = useMemo(() => growth.reduce((a, g) => a + (g.new_leads || 0), 0), [growth]);

  // -------- melhor dia / horário
  const bestDay = useMemo(() => {
    const cand = byWeekday.filter((w) => w.sent >= 5);
    if (!cand.length) return null;
    return cand.reduce((a, b) => (b.open_rate > a.open_rate ? b : a));
  }, [byWeekday]);
  const bestHour = useMemo(() => {
    const cand = byHour.filter((h) => h.sent >= 5);
    if (!cand.length) return null;
    return cand.reduce((a, b) => (b.open_rate > a.open_rate ? b : a));
  }, [byHour]);
  const maxWeekdayRate = useMemo(() => Math.max(0.0001, ...byWeekday.map((w) => w.open_rate)), [byWeekday]);

  const handleExport = () => {
    const rows = [['Data', 'Enviados', 'Entregues', 'Aberturas', 'Cliques', 'Bounces', 'Taxa abertura', 'Taxa clique']];
    series.forEach((s) => rows.push([s.date, s.sent, s.delivered, s.opens, s.clicks, s.bounces, pct(s.open_rate), pct(s.click_rate)]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analytics_${from}_${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };

  const kpis = [
    { icon: IconSend, label: 'Disparos', value: nfmt(totals.dispatches), sub: `${nfmt(totals.leads_reached)} leads alcançados`, color: '#3b82f6', deltaInfo: delta(totals.dispatches, previous.dispatches) },
    { icon: IconRocket, label: 'Entregues', value: nfmt(totals.delivered), sub: `taxa ${pct(rates.delivery_rate)}`, color: '#0ea5e9', deltaInfo: delta(totals.delivered, previous.delivered) },
    { icon: IconMailOpened, label: 'Aberturas', value: nfmt(totals.opens), sub: `taxa ${pct(rates.open_rate)}`, color: '#06b6d4', deltaInfo: delta(totals.opens, previous.opens) },
    { icon: IconClick, label: 'Cliques', value: nfmt(totals.clicks), sub: `CTOR ${pct(rates.ctor)}`, color: '#8b5cf6', deltaInfo: delta(totals.clicks, previous.clicks) },
    { icon: IconAlertTriangle, label: 'Bounces', value: nfmt(totals.bounces), sub: `taxa ${pct(rates.bounce_rate)}`, color: totals.bounces ? '#f59e0b' : undefined, deltaInfo: delta(totals.bounces, previous.bounces, true) },
    { icon: IconMoodSad, label: 'Reclamações', value: nfmt(totals.complaints), sub: `taxa ${pct(rates.complaint_rate)}`, color: totals.complaints ? '#ef4444' : undefined, deltaInfo: delta(totals.complaints, previous.complaints, true) },
    { icon: IconUserOff, label: 'Suprimidos', value: nfmt(engagement.suppressed), sub: 'bounce/spam', color: engagement.suppressed ? '#ef4444' : undefined, deltaInfo: null },
    { icon: IconUsers, label: 'Leads ativos', value: nfmt(engagement.total), sub: 'inscritos no escopo', color: '#22c55e', deltaInfo: null }
  ];

  return (
    <Box sx={{ p: { xs: 1, md: 1.5 } }}>
      {/* Header + filtros */}
      <MainCard content={false} sx={{ borderRadius: 3, mb: 2, overflow: 'visible' }}>
        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }} justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.14) }}>
                <IconCalendarStats size={22} stroke={1.7} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>Analytics de E-mail</Typography>
                <Typography variant="body2" color="text.secondary">Desempenho de campanhas, projetos e engajamento.</Typography>
              </Box>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <TextField select size="small" label="Projeto" value={projectId} onChange={(e) => setProjectId(e.target.value)} sx={{ minWidth: 180 }}>
                <MenuItem value="">Todos os projetos</MenuItem>
                {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </TextField>
              <Button size="small" variant="outlined" color="inherit" startIcon={<IconDownload size={16} />} onClick={handleExport} disabled={loading || !series.length} sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.primary' }}>
                Exportar
              </Button>
              <Tooltip title="Atualizar"><span><IconButton onClick={load} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><IconRefresh size={18} /></IconButton></span></Tooltip>
            </Stack>
          </Stack>

          {/* presets de período */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            {[{ k: '7', l: '7 dias' }, { k: '30', l: '30 dias' }, { k: '90', l: '90 dias' }, { k: 'month', l: 'Este mês' }, { k: 'custom', l: 'Personalizado' }].map((o) => (
              <Chip
                key={o.k}
                label={o.l}
                size="small"
                onClick={() => applyPreset(o.k)}
                color={preset === o.k ? 'primary' : 'default'}
                variant={preset === o.k ? 'filled' : 'outlined'}
                sx={{ fontWeight: 600 }}
              />
            ))}
            {preset === 'custom' ? (
              <>
                <TextField size="small" type="date" label="De" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
                <TextField size="small" type="date" label="Até" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
              </>
            ) : null}
          </Stack>
        </Box>
      </MainCard>

      {error ? <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert> : null}

      {loading ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
          {[...Array(8)].map((_, i) => <Skeleton key={i} variant="rounded" height={116} sx={{ borderRadius: 3 }} />)}
        </Box>
      ) : (
        <>
          {/* KPIs */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
            {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
          </Box>

          {/* Funil + Donut */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' }, mt: 2 }}>
            <MainCard content={false} sx={{ borderRadius: 3 }}>
              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Funil de conversão</Typography>
                <FunnelStage label="Enviados" value={totals.leads_reached} base={totals.leads_reached} prev={null} color="#3b82f6" />
                <FunnelStage label="Entregues" value={totals.delivered} base={totals.leads_reached} prev={totals.leads_reached} color="#0ea5e9" />
                <FunnelStage label="Aberturas" value={totals.opens} base={totals.leads_reached} prev={totals.delivered || totals.leads_reached} color="#06b6d4" />
                <FunnelStage label="Cliques" value={totals.clicks} base={totals.leads_reached} prev={totals.opens || totals.delivered} color="#8b5cf6" />
              </Box>
            </MainCard>

            <MainCard content={false} sx={{ borderRadius: 3 }}>
              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Engajamento dos leads</Typography>
                {hasEngagement ? (
                  <Chart type="donut" height={260} options={donutOptions} series={donutSeries} />
                ) : (
                  <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}><Typography variant="body2">Sem leads no escopo.</Typography></Box>
                )}
              </Box>
            </MainCard>
          </Box>

          {/* Gráfico principal */}
          <MainCard content={false} sx={{ borderRadius: 3, mt: 2 }}>
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Evolução no período</Typography>
              {series.length ? (
                <Chart type="line" height={320} options={mainOptions} series={mainSeries} />
              ) : (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}><Typography variant="body2">Sem dados no período.</Typography></Box>
              )}
            </Box>
          </MainCard>

          {/* Melhor dia/horário + Top assuntos */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr' }, mt: 2 }}>
            <MainCard content={false} sx={{ borderRadius: 3 }}>
              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>Melhor momento pra enviar</Typography>
                <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                  <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      <IconCalendarStats size={16} /><Typography variant="caption" sx={{ fontWeight: 700 }}>Melhor dia</Typography>
                    </Stack>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{bestDay ? WEEKDAYS[bestDay.weekday] : '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">{bestDay ? `${pct(bestDay.open_rate)} de abertura` : 'dados insuficientes'}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      <IconClock size={16} /><Typography variant="caption" sx={{ fontWeight: 700 }}>Melhor horário</Typography>
                    </Stack>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{bestHour ? `${String(bestHour.hour).padStart(2, '0')}h` : '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">{bestHour ? `${pct(bestHour.open_rate)} de abertura` : 'dados insuficientes'}</Typography>
                  </Box>
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Abertura por dia da semana</Typography>
                <Box sx={{ mt: 1 }}>
                  {byWeekday.map((w) => (
                    <Stack key={w.weekday} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      <Typography variant="caption" sx={{ width: 30, color: 'text.secondary' }}>{WEEKDAYS[w.weekday]}</Typography>
                      <Box sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', width: `${Math.round((w.open_rate / maxWeekdayRate) * 100)}%`, bgcolor: 'primary.main', borderRadius: 4 }} />
                      </Box>
                      <Typography variant="caption" sx={{ width: 40, textAlign: 'right', color: 'text.secondary' }}>{pct(w.open_rate)}</Typography>
                    </Stack>
                  ))}
                </Box>
              </Box>
            </MainCard>

            <MainCard content={false} sx={{ borderRadius: 3 }}>
              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>Assuntos que mais convertem</Typography>
                {topSubjects.length ? (
                  <Stack spacing={1.25}>
                    {topSubjects.map((su, i) => (
                      <Box key={i}>
                        <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={su.subject}>{su.subject}</Typography>
                          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ flexShrink: 0 }}>
                            <Chip size="small" variant="outlined" color="info" label={`${pct(su.open_rate)} abriu`} sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }} />
                            <Chip size="small" variant="outlined" color="secondary" label={`${pct(su.click_rate)} clicou`} sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }} />
                          </Stack>
                        </Stack>
                        <LinearProgress variant="determinate" value={Math.min(100, (su.open_rate || 0) * 100)} sx={{ mt: 0.5, height: 5, borderRadius: 3 }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{su.dispatches} disparo{su.dispatches === 1 ? '' : 's'} · {nfmt(su.leads_reached)} leads</Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}><Typography variant="body2">Sem assuntos no período.</Typography></Box>
                )}
              </Box>
            </MainCard>
          </Box>

          {/* Crescimento da base */}
          <MainCard content={false} sx={{ borderRadius: 3, mt: 2 }}>
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Crescimento da base</Typography>
                <Chip size="small" color="success" variant="outlined" label={`+${nfmt(totalNewLeads)} no período`} sx={{ fontWeight: 700 }} />
              </Stack>
              {growth.length ? (
                <Chart type="area" height={220} options={growthOptions} series={growthSeries} />
              ) : (
                <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}><Typography variant="body2">Sem novos leads no período.</Typography></Box>
              )}
            </Box>
          </MainCard>

          {/* Por projeto (só na visão "Todos") */}
          {!projectId && perProject.length > 0 ? (
            <MainCard content={false} sx={{ borderRadius: 3, mt: 2 }}>
              <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>Por projeto</Typography>
                <Stack spacing={1}>
                  {perProject.map((p) => (
                    <Box key={p.project_id}>
                      <Divider sx={{ mb: 1 }} />
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.project_name}</Typography>
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                          <Typography variant="caption" color="text.secondary">{nfmt(p.dispatches)} disparos</Typography>
                          <Typography variant="caption" color="text.secondary">{nfmt(p.leads_reached)} leads</Typography>
                          <Typography variant="caption" sx={{ color: 'info.main', fontWeight: 600 }}>{pct(p.open_rate)} abriu</Typography>
                          <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 600 }}>{pct(p.click_rate)} clicou</Typography>
                          {p.bounces ? <Typography variant="caption" sx={{ color: 'warning.main' }}>{nfmt(p.bounces)} bounces</Typography> : null}
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </MainCard>
          ) : null}
        </>
      )}
    </Box>
  );
}
