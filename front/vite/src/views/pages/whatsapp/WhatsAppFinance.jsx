import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'react-apexcharts';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import {
  IconAlertTriangle,
  IconBuildingStore,
  IconCalendarStats,
  IconCash,
  IconChartBar,
  IconChartPie,
  IconDownload,
  IconInfoCircle,
  IconLock,
  IconPackage,
  IconReceipt,
  IconRefresh,
  IconRepeat,
  IconReportMoney,
  IconTrendingUp,
  IconUserMinus,
  IconUserPlus,
  IconUsersGroup
} from '@tabler/icons-react';

import { api, get } from 'api/api';
import { TgCard, TgEmptyState, TgFilterBar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaPageHeader, useWaSessions } from './waKit';
import { errMsg } from './waShared';
import { WaNumberFilter, fmtDateBR, formatBRL, todayIso, useSessionFilter } from './crm/crmKit';
import { THIN_SCROLL } from './chat/chatKit';

// ============================================================================
// WhatsApp → Financeiro (Fase 7, contrato §11.4): MRR, assinaturas, churn,
// recebido, ticket médio, inadimplência, previsão 30/60/90, recebido por dia /
// meio / produto / unidade, cohort de retenção e exportação CSV.
// GET /whatsapp/finance?from&to&unit_id&session_id (dias em Brasília).
// Exige a sub-permissão `whatsapp:finance` (403 PERMISSION_DENIED → aviso).
// ============================================================================

// Paleta categórica validada (claro e escuro, CVD) — cor segue a ENTIDADE, nunca a posição.
const METHOD_COLOR = { pix: '#16A34A', boleto: '#2563EB', card: '#D97706', manual: '#9333EA', orders_on_delivery: '#0891B2', other: '#64748B' };
const SERIES_GREEN = '#16A34A';
const SERIES_BLUE = '#2563EB';

const PRESETS = [
  ['month', 'Este mês'],
  ['last_month', 'Mês passado'],
  ['30', 'Últimos 30 dias'],
  ['90', 'Últimos 90 dias'],
  ['year', 'Este ano'],
  ['custom', 'Personalizado']
];

/** `YYYY-MM-DD` ± N dias (conta em UTC ao meio-dia — sem pulo de fuso). */
const addDays = (day, n) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const presetRange = (k) => {
  const today = todayIso();
  const [y, m] = today.split('-').map(Number);
  if (k === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (k === 'last_month') {
    const first = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
    return { from: first, to: last };
  }
  if (k === 'year') return { from: `${y}-01-01`, to: today };
  const n = Number(k) || 30;
  return { from: addDays(today, -(n - 1)), to: today };
};
const fmtPct = (n) => `${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const shortBRL = (cents) => {
  const v = (Number(cents) || 0) / 100;
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1e4) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return formatBRL(cents);
};
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtMonth = (ym) => {
  const [y, m] = String(ym || '').split('-');
  return y && m ? `${MONTHS[Number(m) - 1] || m}/${y.slice(2)}` : ym;
};

/** Lê a mensagem de erro de uma resposta `blob` (download). */
const blobErr = async (e, fb) => {
  const d = e?.response?.data;
  if (d instanceof Blob) {
    try {
      const j = JSON.parse(await d.text());
      const m = j?.message;
      return Array.isArray(m) ? m.join(' | ') : typeof m === 'string' ? m : fb;
    } catch {
      return fb;
    }
  }
  return errMsg(e, fb);
};

// ----------------------------------------------------------------------------
// Peças visuais
// ----------------------------------------------------------------------------
function Section({ title, icon: Icon, children, right, sx }) {
  return (
    <TgCard hover={false} sx={{ p: 0, overflow: 'hidden', minWidth: 0, ...sx }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        {Icon ? <Icon size={18} /> : null}
        <Typography variant="subtitle2" sx={{ fontWeight: 800, flex: 1, minWidth: 0 }}>
          {title}
        </Typography>
        {right}
      </Stack>
      {children}
    </TgCard>
  );
}

function FinKpi({ icon: Icon, label, value, sub, hint, tone = 'success' }) {
  return (
    <TgCard hover={false} sx={{ px: 1.75, py: 1.5, minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          sx={(t) => ({
            width: 30,
            height: 30,
            borderRadius: 1.5,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            color: t.vars.palette[tone].main,
            bgcolor: `rgba(${t.vars.palette[tone].mainChannel} / 0.12)`
          })}
        >
          <Icon size={17} stroke={1.9} />
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, flex: 1, minWidth: 0, lineHeight: 1.25 }}>
          {label}
        </Typography>
        {hint ? (
          <Tooltip title={hint} enterTouchDelay={0} leaveTouchDelay={6000}>
            <Box component="span" sx={{ color: 'text.disabled', display: 'flex', cursor: 'help', flexShrink: 0 }} aria-label={hint}>
              <IconInfoCircle size={15} />
            </Box>
          </Tooltip>
        ) : null}
      </Stack>
      <Typography
        sx={{
          mt: 0.75,
          fontWeight: 800,
          fontSize: { xs: 18, sm: 22 },
          lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
          overflowWrap: 'anywhere'
        }}
      >
        {value}
      </Typography>
      {sub ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, overflowWrap: 'break-word' }}>
          {sub}
        </Typography>
      ) : null}
    </TgCard>
  );
}

function Empty({ children }) {
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {children}
      </Typography>
    </Box>
  );
}

// ----------------------------------------------------------------------------
// Página
// ----------------------------------------------------------------------------
export default function WhatsAppFinance() {
  const { mode, systemMode } = useColorScheme();
  const dark = (mode === 'system' ? systemMode : mode) === 'dark';
  const { sessions } = useWaSessions(60000);
  const { value: sessionId, set: setSessionId, multi } = useSessionFilter(sessions);
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(() => presetRange('month'));
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [exporting, setExporting] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    get('/whatsapp/units')
      .then((r) => setUnits(Array.isArray(r) ? r : r?.items || []))
      .catch(() => setUnits([]));
  }, []);

  const applyPreset = (k) => {
    setPreset(k);
    if (k !== 'custom') setRange(presetRange(k));
  };

  const { from, to } = range;
  const validRange = Boolean(from && to && from <= to);
  const load = useCallback(async () => {
    if (!validRange) return;
    const s = ++seq.current;
    setLoading(true);
    try {
      const r = await get('/whatsapp/finance', {
        params: { from, to, unit_id: unitId || undefined, session_id: sessionId || undefined }
      });
      if (s !== seq.current) return;
      setData(r);
      setDenied(false);
    } catch (e) {
      if (s !== seq.current) return;
      if (e?.response?.status === 403) setDenied(true);
      else toast.error(errMsg(e, 'Não foi possível carregar o financeiro.'));
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, [from, to, unitId, sessionId, validRange]);
  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async (kind) => {
    setExporting(kind);
    try {
      const res = await api.get('/whatsapp/finance/export', {
        params: { kind, from, to, unit_id: unitId || undefined, session_id: sessionId || undefined },
        responseType: 'blob'
      });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const cd = String(res.headers?.['content-disposition'] || '');
      const name = cd.match(/filename="?([^";]+)"?/)?.[1] || `${kind === 'charges' ? 'recebimentos' : 'assinaturas'}-${from}-a-${to}.csv`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
      toast.success('Exportação pronta.');
    } catch (e) {
      toast.error(await blobErr(e, 'Não foi possível exportar.'));
    } finally {
      setExporting('');
    }
  };

  // ---------------------------------------------------------------- gráficos
  const axisColor = dark ? '#94A3B8' : '#64748B';
  const gridColor = dark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)';
  const series = useMemo(() => data?.series || [], [data]);
  const longRange = series.length > 45;
  const dayOptions = useMemo(
    () => ({
      chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: dark ? 'dark' : 'light' },
      colors: [SERIES_GREEN],
      stroke: longRange ? { curve: 'smooth', width: 2 } : { width: 0 },
      fill: longRange ? { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } } : { opacity: 1 },
      plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '62%' } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: series.map((d) => d.day.slice(5).split('-').reverse().join('/')),
        labels: { style: { colors: axisColor }, rotate: 0, hideOverlappingLabels: true },
        tickAmount: Math.min(series.length, 10),
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false }
      },
      yaxis: { labels: { style: { colors: axisColor }, formatter: (v) => shortBRL(v) } },
      grid: { borderColor: gridColor, strokeDashArray: 3 },
      legend: { show: false },
      tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: (v) => formatBRL(v) } }
    }),
    [series, dark, axisColor, gridColor, longRange]
  );
  const daySeries = useMemo(() => [{ name: 'Recebido', data: series.map((d) => d.received_cents) }], [series]);

  const methods = useMemo(() => (data?.received_by_method || []).filter((m) => m.cents > 0), [data]);
  const methodOptions = useMemo(
    () => ({
      chart: { fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: dark ? 'dark' : 'light' },
      labels: methods.map((m) => m.label || m.method),
      colors: methods.map((m) => METHOD_COLOR[m.method] || METHOD_COLOR.other),
      stroke: { width: 2, colors: [dark ? '#151d30' : '#ffffff'] },
      dataLabels: { enabled: false },
      legend: {
        position: 'bottom',
        labels: { colors: axisColor },
        formatter: (name, o) => `${name} · ${shortBRL(methods[o.seriesIndex]?.cents)}`
      },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              value: { color: dark ? '#E2E8F0' : '#0F172A', formatter: (v) => shortBRL(v) },
              name: { color: axisColor },
              total: {
                show: true,
                label: 'Recebido',
                color: axisColor,
                formatter: (w) => shortBRL(w.globals.seriesTotals.reduce((a, b) => a + b, 0))
              }
            }
          }
        }
      },
      tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: (v) => formatBRL(v) } }
    }),
    [methods, dark, axisColor]
  );

  const products = useMemo(() => (data?.by_product || []).slice(0, 10), [data]);
  const barOptions = useCallback(
    (cats, color) => ({
      chart: { toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: dark ? 'dark' : 'light' },
      colors: [color],
      plotOptions: { bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: 'end', barHeight: '62%' } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: cats,
        labels: { style: { colors: axisColor }, formatter: (v) => shortBRL(v) },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: { labels: { style: { colors: axisColor }, maxWidth: 160 } },
      grid: { borderColor: gridColor, strokeDashArray: 3, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
      legend: { show: false },
      tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: (v) => formatBRL(v) } }
    }),
    [dark, axisColor, gridColor]
  );
  const productOptions = useMemo(
    () =>
      barOptions(
        products.map((p) => p.name),
        SERIES_GREEN
      ),
    [barOptions, products]
  );
  const byUnit = useMemo(() => data?.by_unit || [], [data]);
  const showUnits = units.length > 0 && byUnit.length > 0;
  const unitOptions = useMemo(
    () =>
      barOptions(
        byUnit.map((u) => u.name),
        SERIES_BLUE
      ),
    [barOptions, byUnit]
  );

  const k = data?.kpis;
  const f = data?.forecast;
  const cohort = data?.cohort || [];

  return (
    <Box>
      <WaPageHeader
        icon={IconReportMoney}
        title="Financeiro"
        subtitle="Receita recorrente, recebimentos, inadimplência e previsão das cobranças e assinaturas do WhatsApp."
        sx={{ mb: 2 }}
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Tooltip title="Atualizar">
              <IconButton onClick={load} disabled={loading}>
                <IconRefresh size={18} />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={exporting === 'charges' ? <CircularProgress size={15} /> : <IconDownload size={16} />}
              onClick={() => exportCsv('charges')}
              disabled={Boolean(exporting) || denied || !validRange}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Recebimentos CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={exporting === 'subscriptions' ? <CircularProgress size={15} /> : <IconDownload size={16} />}
              onClick={() => exportCsv('subscriptions')}
              disabled={Boolean(exporting) || denied}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Assinaturas CSV
            </Button>
          </Stack>
        }
      />

      <TgFilterBar>
        <TextField
          select
          size="small"
          label="Período"
          value={preset}
          onChange={(e) => applyPreset(e.target.value)}
          sx={{ minWidth: { md: 180 } }}
        >
          {PRESETS.map(([key, label]) => (
            <MenuItem key={key} value={key}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        {preset === 'custom' ? (
          <>
            <TextField
              size="small"
              type="date"
              label="De"
              value={from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              error={!validRange}
              sx={{ minWidth: { md: 160 } }}
            />
            <TextField
              size="small"
              type="date"
              label="Até"
              value={to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              error={!validRange}
              helperText={!validRange ? 'O início é depois do fim.' : undefined}
              sx={{ minWidth: { md: 160 } }}
            />
          </>
        ) : null}
        {units.length ? (
          <TextField
            select
            size="small"
            label="Unidade"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            sx={{ minWidth: { md: 180 } }}
          >
            <MenuItem value="">Todas as unidades</MenuItem>
            {units.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
            <MenuItem value="none">Clientes sem unidade</MenuItem>
          </TextField>
        ) : null}
        <WaNumberFilter sessions={sessions} value={sessionId} onChange={setSessionId} />
      </TgFilterBar>
      <Typography variant="caption" component="div" sx={{ color: 'text.secondary', mt: -1, mb: 1.5 }}>
        {validRange ? `${fmtDateBR(from)} a ${fmtDateBR(to)} (horário de Brasília)` : 'Escolha um período válido.'}
        {multi && sessionId
          ? ' · O filtro de número vale só para as cobranças (recebido, em atraso e previsão de cobranças abertas); assinaturas não têm número.'
          : ''}
        {multi && !sessionId ? ' · Filtrar por número afeta só as cobranças; MRR e assinaturas são da conta toda.' : ''}
      </Typography>

      {loading ? <LinearProgress color="success" sx={{ mb: 1.5, borderRadius: 1 }} /> : null}

      {denied ? (
        <TgEmptyState
          icon={IconLock}
          title="Sem acesso ao financeiro"
          description="Seu usuário não tem a permissão de Financeiro do WhatsApp. Peça ao dono ou administrador da conta para liberar em Administração → Usuários."
        />
      ) : !data ? (
        <TgCard hover={false} sx={{ p: 2 }}>
          <TgListSkeleton rows={4} />
        </TgCard>
      ) : (
        <Stack spacing={2}>
          {/* KPIs */}
          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' }
            }}
          >
            <FinKpi
              icon={IconRepeat}
              label="MRR (receita mensal recorrente)"
              value={k.mrr_label || formatBRL(k.mrr_cents)}
              sub="hoje, das assinaturas ativas e em atraso"
              hint="Soma do valor mensal equivalente das assinaturas ativas ou em atraso (o preço dividido pelos meses do ciclo: anual ÷ 12, trimestral ÷ 3…), já com descontos vigentes."
            />
            <FinKpi
              icon={IconUsersGroup}
              label="Assinaturas ativas"
              value={(k.active_subscriptions || 0).toLocaleString('pt-BR')}
              sub={`${(k.active_at_start ?? 0).toLocaleString('pt-BR')} no início do período`}
              hint="Assinaturas recorrentes com status ativo ou em atraso, agora."
              tone="info"
            />
            <FinKpi
              icon={IconUserPlus}
              label="Novas assinaturas"
              value={(k.new_subscriptions || 0).toLocaleString('pt-BR')}
              sub="criadas no período"
              tone="info"
            />
            <FinKpi
              icon={IconUserMinus}
              label="Canceladas · churn"
              value={`${(k.canceled_subscriptions || 0).toLocaleString('pt-BR')} · ${fmtPct(k.churn_rate)}`}
              sub={`churn = ${(k.churned_subscriptions ?? k.canceled_subscriptions ?? 0).toLocaleString('pt-BR')} que estavam ativas ÷ ativas no início`}
              hint="Canceladas = todas as assinaturas canceladas no período. Churn (taxa de cancelamento) conta só as que estavam ativas no início do período (já iniciadas e fora do teste grátis) ÷ as ativas no início — quem nunca chegou a ativar não entra."
              tone="warning"
            />
            <FinKpi
              icon={IconCash}
              label="Recebido"
              value={k.received_label || formatBRL(k.received_cents)}
              sub={`${(k.received_count || 0).toLocaleString('pt-BR')} pagamento${k.received_count === 1 ? '' : 's'}`}
              hint="Cobranças com pagamento confirmado dentro do período (pela data do pagamento) + pedidos pagos na entrega/retirada ou marcados pagos sem cobrança (linha Pedidos pagos na entrega)."
            />
            <FinKpi
              icon={IconReceipt}
              label="Ticket médio"
              value={formatBRL(k.avg_ticket_cents)}
              sub="recebido ÷ pagamentos"
              tone="info"
            />
            <FinKpi
              icon={IconAlertTriangle}
              label="Em atraso · inadimplência"
              value={k.overdue_label || formatBRL(k.overdue_cents)}
              sub={`${(k.overdue_customers || 0).toLocaleString('pt-BR')} cliente${k.overdue_customers === 1 ? '' : 's'} · ${fmtPct(k.overdue_rate)} de inadimplência`}
              hint="Em atraso = cobranças em aberto já vencidas (hoje). Inadimplência = em atraso ÷ (recebido no período + em atraso)."
              tone="error"
            />
            <FinKpi
              icon={IconTrendingUp}
              label="Previsão 30 dias"
              value={formatBRL(f?.d30)}
              sub="a receber até daqui a 30 dias"
              hint="Cobranças em aberto que vencem na janela + cada vencimento das assinaturas ativas que cai na janela e ainda não tem cobrança gerada."
            />
          </Box>

          {/* Previsão */}
          <Section
            title="Previsão de recebimento"
            icon={IconCalendarStats}
            right={
              <Tooltip title="Cobranças em aberto que vencem na janela + cada vencimento das assinaturas ativas que cai na janela (uma mensal conta até 3 vezes em 90 dias) e ainda não tem cobrança. Não desconta inadimplência.">
                <Box component="span" sx={{ color: 'text.disabled', display: 'flex', cursor: 'help' }}>
                  <IconInfoCircle size={16} />
                </Box>
              </Tooltip>
            }
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
              {[
                ['Próximos 30 dias', f?.d30],
                ['Próximos 60 dias', f?.d60],
                ['Próximos 90 dias', f?.d90]
              ].map(([label, v], i) => (
                <Box key={label} sx={{ p: { xs: 1.25, sm: 2 }, borderLeft: i ? '1px solid' : 'none', borderColor: 'divider', minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                    {label}
                  </Typography>
                  <Typography
                    sx={{ fontWeight: 800, fontSize: { xs: 15, sm: 20 }, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
                  >
                    {formatBRL(v)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Section>

          {/* Recebido por dia + por meio */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(0,2fr) minmax(0,1fr)' } }}>
            <Section title="Recebido por dia" icon={IconChartBar}>
              {k.received_cents ? (
                <Box sx={{ p: 1 }}>
                  <Chart type={longRange ? 'area' : 'bar'} height={280} options={dayOptions} series={daySeries} />
                </Box>
              ) : (
                <Empty>Nenhum pagamento confirmado no período.</Empty>
              )}
            </Section>
            <Section title="Por meio de pagamento" icon={IconChartPie}>
              {methods.length ? (
                <Box sx={{ p: 1 }}>
                  <Chart type="donut" height={300} options={methodOptions} series={methods.map((m) => m.cents)} />
                </Box>
              ) : (
                <Empty>Sem recebimentos no período.</Empty>
              )}
            </Section>
          </Box>

          {/* Produto + unidade */}
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: showUnits ? 'repeat(2, minmax(0,1fr))' : 'minmax(0,1fr)' }
            }}
          >
            <Section title={`Recebido por produto${(data.by_product || []).length > 10 ? ' (10 maiores)' : ''}`} icon={IconPackage}>
              {products.length ? (
                <Box sx={{ p: 1 }}>
                  <Chart
                    type="bar"
                    height={Math.max(160, products.length * 38 + 60)}
                    options={productOptions}
                    series={[{ name: 'Recebido', data: products.map((p) => p.cents) }]}
                  />
                </Box>
              ) : (
                <Empty>Sem recebimentos no período.</Empty>
              )}
            </Section>
            {showUnits ? (
              <Section title="Recebido por unidade" icon={IconBuildingStore}>
                <Box sx={{ p: 1 }}>
                  <Chart
                    type="bar"
                    height={Math.max(160, byUnit.length * 38 + 60)}
                    options={unitOptions}
                    series={[{ name: 'Recebido', data: byUnit.map((u) => u.cents) }]}
                  />
                </Box>
              </Section>
            ) : null}
          </Box>

          {/* Tabela por produto (leitura exata) */}
          {(data.by_product || []).length ? (
            <Section title="Detalhe por produto" icon={IconPackage}>
              <TableContainer sx={(t) => ({ ...THIN_SCROLL(t), maxHeight: 360 })}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Produto</TableCell>
                      <TableCell align="right">Cobranças</TableCell>
                      <TableCell align="right">Recebido</TableCell>
                      <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        % do total
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.by_product.map((p, i) => (
                      <TableRow key={`${p.product_id || p.name}-${i}`}>
                        <TableCell sx={{ maxWidth: 260, overflowWrap: 'anywhere' }}>{p.name}</TableCell>
                        <TableCell align="right">{p.count.toLocaleString('pt-BR')}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {formatBRL(p.cents)}
                        </TableCell>
                        <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          {k.received_cents ? fmtPct((p.cents / k.received_cents) * 100) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Section>
          ) : null}

          {/* Cohort */}
          <Section
            title="Retenção por mês de entrada (cohort)"
            icon={IconUsersGroup}
            right={
              <Tooltip title="Clientes agrupados pelo mês em que foram cadastrados (últimos 12 meses até o fim do período) e quantos deles têm assinatura ativa hoje.">
                <Box component="span" sx={{ color: 'text.disabled', display: 'flex', cursor: 'help' }}>
                  <IconInfoCircle size={16} />
                </Box>
              </Tooltip>
            }
          >
            {cohort.length ? (
              <TableContainer sx={(t) => ({ ...THIN_SCROLL(t) })}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Mês de entrada</TableCell>
                      <TableCell align="right">Clientes</TableCell>
                      <TableCell align="right">Ativos hoje</TableCell>
                      <TableCell align="right">Retenção</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cohort.map((c) => {
                      const r = Math.max(0, Math.min(100, Number(c.retention) || 0));
                      return (
                        <TableRow key={c.month}>
                          <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtMonth(c.month)}</TableCell>
                          <TableCell align="right">{c.customers.toLocaleString('pt-BR')}</TableCell>
                          <TableCell align="right">{c.active_now.toLocaleString('pt-BR')}</TableCell>
                          <TableCell align="right" sx={{ p: 0.5 }}>
                            <Box
                              sx={(t) => ({
                                display: 'inline-block',
                                minWidth: 64,
                                px: 1,
                                py: 0.5,
                                borderRadius: 1.5,
                                textAlign: 'right',
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                color: 'text.primary',
                                bgcolor: `rgba(${t.vars.palette.success.mainChannel} / ${(0.06 + (r / 100) * 0.5).toFixed(2)})`
                              })}
                            >
                              {fmtPct(r)}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Empty>Nenhum cliente cadastrado nos últimos 12 meses.</Empty>
            )}
          </Section>
        </Stack>
      )}
    </Box>
  );
}
