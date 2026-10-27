// =============================================================================
// WordPress → Push In Play: painel de métricas de TODOS os sites que rodam o plugin (os sites mandam
// um resumo ao Pub Mail a cada 15 min e logo após cada disparo; "Sincronizar agora" pede na hora),
// download do plugin vinculado à conta, como instalar, chave da conta e o que cada tela faz.
// Mesma chave do Tradutor Invisível. Dark-mode: só tokens e theme.vars (gráficos pelo `mode`).
// =============================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Chart from 'react-apexcharts';
import toast from 'react-hot-toast';
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconBellPlus,
  IconBellRinging,
  IconBrandAndroid,
  IconBrandApple,
  IconBrandWordpress,
  IconChartBar,
  IconClick,
  IconCopy,
  IconDeviceDesktop,
  IconDownload,
  IconEye,
  IconHistory,
  IconKey,
  IconLayoutBottombar,
  IconPlugConnected,
  IconRefresh,
  IconRoute,
  IconSend,
  IconSpeakerphone,
  IconStar,
  IconTrendingDown,
  IconTrendingUp,
  IconUsers,
  IconWorldWww
} from '@tabler/icons-react';

import api, { get, post } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgCard, TgConfirmDialog, TgEmptyState, TgStatusPill } from 'views/pages/telegram/ui';

const WP_GRADIENT = 'linear-gradient(135deg, #3858e9 0%, #21759b 100%)';
const PIP_GRADIENT = 'linear-gradient(135deg, #377ef0 0%, #7c3aed 100%)';
const tint = (t, token, a) => `rgba(${t.vars.palette[token].mainChannel} / ${a})`;

const errMsg = (e, fb) => {
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const nfmt = (n) => Number(n || 0).toLocaleString('pt-BR');
const pct = (a, b) => (Number(b) > 0 ? `${((Number(a || 0) / Number(b)) * 100).toFixed(1).replace('.', ',')}%` : '—');
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
const fmtDay = (iso) => {
  const [, m, d] = String(iso || '').split('-');
  return m && d ? `${d}/${m}` : iso;
};
const fmtAgo = (v) => {
  if (!v) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(v).getTime()) / 1000));
  if (s < 60) return 'agora';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d === 1 ? '' : 's'}`;
};
const fmtWhen = (unix) => {
  if (!unix) return '';
  const d = new Date(unix * 1000);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

// delta % entre o período e o anterior (inverse=true → cair é bom)
function delta(curr, prev, inverse = false) {
  const c = Number(curr || 0);
  const p = Number(prev || 0);
  if (p === 0) return c > 0 ? { txt: 'novo', up: true, good: !inverse } : null;
  const change = (c - p) / p;
  if (Math.abs(change) < 0.005) return null;
  const up = change > 0;
  return { txt: `${up ? '+' : ''}${(change * 100).toFixed(0)}%`, up, good: inverse ? !up : up };
}

const PLATFORM_LABEL = { android: 'Android', ios: 'iPhone / iPad', windows: 'Windows', macos: 'Mac', linux: 'Linux', outro: 'Outro' };
const PLATFORM_COLOR = { android: '#22c55e', ios: '#64748b', windows: '#3b82f6', macos: '#8b5cf6', linux: '#f59e0b', outro: '#94a3b8' };

const STEPS = [
  { title: 'Baixe o plugin', text: 'O arquivo já vem ligado à sua conta do Pub Mail.' },
  { title: 'Envie no WordPress', text: 'Plugins → Adicionar novo → Enviar plugin → Ativar.' },
  {
    title: 'Ligue um layout de popup',
    text: 'No grupo "Push In Play" do site: Popup Layout → ativar. Os visitantes passam a ver o convite e as métricas aparecem aqui.'
  }
];

const SCREEN_ICON = {
  'popup-layout': IconLayoutBottombar,
  automation: IconRoute,
  settings: IconAdjustmentsHorizontal,
  copys: IconCopy,
  broadcasts: IconSpeakerphone
};

const PLATFORMS = [
  {
    icon: IconBrandAndroid,
    label: 'Android',
    text: 'Chrome, Samsung Internet, Edge, Firefox: chega na barra de notificações mesmo com o site fechado.'
  },
  { icon: IconDeviceDesktop, label: 'Computador', text: 'Chrome, Edge, Firefox e Safari 16+: aviso do sistema (Windows, macOS, Linux).' },
  {
    icon: IconBrandApple,
    label: 'iPhone / iPad',
    text: 'iOS 16.4+: só com o site na Tela de Início. O plugin traz o convite guiado para isso.'
  }
];

function accessLabel(access) {
  if (!access) return { status: 'inactive', label: '—' };
  if (!access.active) return { status: 'error', label: 'Pausado' };
  if (access.until) return { status: 'active', label: `Ativo até ${fmtDate(access.until)}` };
  return { status: 'active', label: 'Ativo' };
}

function siteStatus(s) {
  if (s.old_key) return { status: 'paused', label: 'Chave antiga' };
  if (!s.active) return { status: 'error', label: 'Pausado' };
  if (!s.stats_at) return { status: 'inactive', label: 'Sem métricas' };
  return { status: 'active', label: 'Enviando' };
}

function siteHealth(s) {
  const h = s.health;
  if (!h) return null;
  const items = [];
  if (h.cron_ok === 0) items.push({ label: 'Cron parado', color: 'error' });
  if (h.pending > 0) items.push({ label: `Fila ${nfmt(h.pending)}`, color: 'warning' });
  if (h.failed_24h > 0) items.push({ label: `${nfmt(h.failed_24h)} falhas em 24 h`, color: 'warning' });
  if (!items.length) items.push({ label: 'Tudo certo', color: 'success' });
  return items;
}

function Header() {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
      <Box
        sx={{
          width: 46,
          height: 46,
          flexShrink: 0,
          borderRadius: 3,
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          background: WP_GRADIENT,
          boxShadow: (t) => `0 8px 20px ${tint(t, 'primary', 0.28)}`
        }}
      >
        <IconBrandWordpress size={24} stroke={1.8} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          Push In Play
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          Notificações push nos seus sites WordPress — e as métricas de todos eles aqui, sem entrar em cada site.
        </Typography>
      </Box>
    </Stack>
  );
}

function SectionTitle({ icon: Icon, title, sub, action }) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={1.25} sx={{ mb: 2 }}>
      <Box sx={{ color: 'text.secondary', mt: 0.25, flexShrink: 0 }}>
        <Icon size={20} stroke={1.8} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {sub ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {sub}
          </Typography>
        ) : null}
      </Box>
      {action}
    </Stack>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color, deltaInfo, loading }) {
  return (
    <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', minWidth: 0 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: color || 'text.secondary',
            bgcolor: color ? `${color}1f` : 'action.selected'
          }}
        >
          <Icon size={19} stroke={1.7} />
        </Box>
        {deltaInfo ? (
          <Tooltip title="Comparado com o período anterior">
            <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: deltaInfo.good ? 'success.main' : 'error.main' }}>
              {deltaInfo.up ? <IconTrendingUp size={15} stroke={2} /> : <IconTrendingDown size={15} stroke={2} />}
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {deltaInfo.txt}
              </Typography>
            </Stack>
          </Tooltip>
        ) : null}
      </Stack>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', lineHeight: 1.3 }}
      >
        {label}
      </Typography>
      {loading ? (
        <Skeleton width={90} height={38} />
      ) : (
        <Typography variant="h3" sx={{ fontWeight: 700, mt: 0.25, color: color || 'text.primary' }}>
          {value}
        </Typography>
      )}
      {sub ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35 }}>
          {sub}
        </Typography>
      ) : null}
    </Box>
  );
}

function Num({ children, dim }) {
  return (
    <Typography variant="body2" sx={{ fontWeight: 700, color: dim ? 'text.disabled' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
      {children}
    </Typography>
  );
}

export default function PushInPlay() {
  const { user } = useAuth();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('md'));
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const canManage = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [an, setAn] = useState(null);
  const [anLoading, setAnLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [site, setSite] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await get('/wordpress/push-in-play'); // get() já devolve os dados
      setData(d);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível carregar.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (site) params.set('site', site);
      const d = await get(`/wordpress/push-in-play/analytics?${params.toString()}`);
      setAn(d);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível carregar as métricas.'));
    } finally {
      setAnLoading(false);
    }
  }, [days, site]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // os sites mandam sozinhos a cada 15 min: a tela acompanha sem recarregar
  useEffect(() => {
    const t = window.setInterval(
      () => {
        if (document.visibilityState === 'visible') loadAnalytics();
      },
      5 * 60 * 1000
    );
    return () => window.clearInterval(t);
  }, [loadAnalytics]);

  const sync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await post('/wordpress/push-in-play/sync');
      setSyncResult(r);
      if (r.total === 0) toast('Nenhum site com o plugin ativo nos últimos 30 dias.');
      else if (r.synced === r.total) toast.success(r.total === 1 ? 'Site sincronizado.' : `${r.total} sites sincronizados.`);
      else toast.error(`${r.synced} de ${r.total} site(s) sincronizado(s).`);
      await Promise.all([loadAnalytics(), load()]);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível sincronizar.'));
    } finally {
      setSyncing(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/wordpress/push-in-play/download', { responseType: 'blob' });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'push-in-play.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      let msg = 'Não foi possível baixar o plugin.';
      try {
        const txt = e?.response?.data instanceof Blob ? await e.response.data.text() : '';
        const j = txt ? JSON.parse(txt) : null;
        if (j?.message) msg = Array.isArray(j.message) ? j.message.join(' | ') : j.message;
      } catch {
        /* resposta sem JSON */
      }
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  const rotate = async () => {
    setRotating(true);
    try {
      const d = await post('/wordpress/push-in-play/rotate');
      setData(d);
      setConfirmRotate(false);
      toast.success('Nova chave criada. Baixe os plugins de novo e instale nos seus sites.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível trocar a chave.'));
    } finally {
      setRotating(false);
    }
  };

  const acc = accessLabel(data?.access);
  const screens = data?.screens || [];
  const sites = an?.sites || [];
  const totals = an?.totals || {};
  const previous = an?.previous || {};
  const series = an?.series || [];
  const subs = an?.subscribers || { active: 0, expired: 0, by_platform: {} };
  const blasts = an?.blasts || [];
  const copies = an?.copies_top || [];
  const anySynced = sites.some((s) => s.stats_at);
  const siteOptions = useMemo(
    () => (data?.sites || []).map((s) => ({ id: s.id, host: s.host })).filter((s, i, arr) => arr.findIndex((x) => x.host === s.host) === i),
    [data]
  );

  // -------- gráfico: envios por dia (automação + broadcasts) e cliques
  const sendOptions = useMemo(
    () => ({
      chart: { type: 'line', stacked: true, toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: isDark ? 'dark' : 'light' },
      stroke: { width: [0, 0, 3], curve: 'smooth' },
      plotOptions: { bar: { columnWidth: series.length > 40 ? '70%' : '55%', borderRadius: 3 } },
      dataLabels: { enabled: false },
      colors: ['#3b82f6', '#8b5cf6', '#06b6d4'],
      xaxis: {
        categories: series.map((s) => fmtDay(s.date)),
        labels: { rotate: -45, style: { fontSize: '10px' } },
        tickAmount: Math.min(12, series.length),
        axisBorder: { show: false }
      },
      yaxis: [
        { seriesName: 'Automação', labels: { formatter: (v) => nfmt(Math.round(v)) } },
        { seriesName: 'Automação', show: false },
        { seriesName: 'Cliques', opposite: true, labels: { formatter: (v) => nfmt(Math.round(v)) } }
      ],
      legend: { position: 'top' },
      grid: { borderColor: gridColor, strokeDashArray: 4 },
      tooltip: { theme: isDark ? 'dark' : 'light', shared: true, intersect: false }
    }),
    [series, isDark, gridColor]
  );
  const sendSeries = useMemo(
    () => [
      { name: 'Automação', type: 'column', data: series.map((s) => s.sent_flow) },
      { name: 'Broadcasts', type: 'column', data: series.map((s) => s.sent_broadcast) },
      { name: 'Cliques', type: 'line', data: series.map((s) => s.clicked) }
    ],
    [series]
  );

  // -------- gráfico: convite de permissão por dia
  const popupOptions = useMemo(
    () => ({
      chart: { type: 'line', toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: isDark ? 'dark' : 'light' },
      stroke: { width: [0, 3], curve: 'smooth' },
      plotOptions: { bar: { columnWidth: series.length > 40 ? '70%' : '55%', borderRadius: 3 } },
      dataLabels: { enabled: false },
      colors: ['#94a3b8', '#22c55e'],
      xaxis: {
        categories: series.map((s) => fmtDay(s.date)),
        labels: { rotate: -45, style: { fontSize: '10px' } },
        tickAmount: Math.min(12, series.length),
        axisBorder: { show: false }
      },
      yaxis: [
        { seriesName: 'Exibições', labels: { formatter: (v) => nfmt(Math.round(v)) } },
        { seriesName: 'Ativações', opposite: true, labels: { formatter: (v) => nfmt(Math.round(v)) } }
      ],
      legend: { position: 'top' },
      grid: { borderColor: gridColor, strokeDashArray: 4 },
      tooltip: { theme: isDark ? 'dark' : 'light', shared: true, intersect: false }
    }),
    [series, isDark, gridColor]
  );
  const popupSeries = useMemo(
    () => [
      { name: 'Exibições', type: 'column', data: series.map((s) => s.impressions) },
      { name: 'Ativações', type: 'line', data: series.map((s) => s.granted) }
    ],
    [series]
  );

  // -------- donut: inscritos por plataforma
  const platKeys = useMemo(
    () =>
      Object.keys(subs.by_platform || {})
        .filter((k) => subs.by_platform[k] > 0)
        .sort((a, b) => subs.by_platform[b] - subs.by_platform[a]),
    [subs]
  );
  const donutOptions = useMemo(
    () => ({
      chart: { type: 'donut', fontFamily: 'inherit', background: 'transparent' },
      theme: { mode: isDark ? 'dark' : 'light' },
      labels: platKeys.map((k) => PLATFORM_LABEL[k] || k),
      colors: platKeys.map((k) => PLATFORM_COLOR[k] || '#94a3b8'),
      legend: { position: 'bottom' },
      dataLabels: { enabled: true, formatter: (v) => `${v.toFixed(0)}%` },
      stroke: { width: 0 },
      plotOptions: {
        pie: {
          donut: { size: '66%', labels: { show: true, total: { show: true, label: 'Inscritos', formatter: () => nfmt(subs.active) } } }
        }
      }
    }),
    [isDark, platKeys, subs.active]
  );
  const donutSeries = useMemo(() => platKeys.map((k) => subs.by_platform[k]), [platKeys, subs]);

  const kpis = [
    {
      icon: IconUsers,
      label: 'Inscritos ativos',
      value: nfmt(subs.active),
      sub: subs.expired ? `${nfmt(subs.expired)} expiraram` : 'aparelhos que recebem',
      color: '#22c55e',
      deltaInfo: null
    },
    {
      icon: IconEye,
      label: 'Convite exibido',
      value: nfmt(totals.impressions),
      sub: `taxa de ativação ${pct(totals.granted, totals.impressions)}`,
      color: '#3b82f6',
      deltaInfo: delta(totals.impressions, previous.impressions)
    },
    {
      icon: IconBellPlus,
      label: 'Ativações',
      value: nfmt(totals.granted),
      sub: totals.installed ? `${nfmt(totals.installed)} adicionaram o app` : 'novos inscritos no período',
      color: '#8b5cf6',
      deltaInfo: delta(totals.granted, previous.granted)
    },
    {
      icon: IconSend,
      label: 'Enviadas',
      value: nfmt(totals.sent),
      sub: `${nfmt(totals.sent_flow)} automação · ${nfmt(totals.sent_broadcast)} broadcasts`,
      color: '#0ea5e9',
      deltaInfo: delta(totals.sent, previous.sent)
    },
    {
      icon: IconClick,
      label: 'Cliques',
      value: nfmt(totals.clicked),
      sub: `CTR ${pct(totals.clicked, totals.sent)}`,
      color: '#06b6d4',
      deltaInfo: delta(totals.clicked, previous.clicked)
    },
    {
      icon: IconAlertTriangle,
      label: 'Falhas',
      value: nfmt(totals.failed),
      sub: `taxa ${pct(totals.failed, Number(totals.sent || 0) + Number(totals.failed || 0))}`,
      color: totals.failed ? '#f59e0b' : undefined,
      deltaInfo: delta(totals.failed, previous.failed, true)
    }
  ];

  const syncCaption = an?.synced_at
    ? `Sincronizado ${fmtAgo(an.synced_at)} · os sites mandam sozinhos a cada 15 min e logo após cada disparo`
    : 'Os sites mandam as métricas sozinhos a cada 15 min e logo após cada disparo';

  return (
    <Box sx={{ maxWidth: 1180 }}>
      <Header />

      {/* ------------------------------------------------ painel de métricas */}
      <TgCard hover={false} sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }} justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                background: PIP_GRADIENT
              }}
            >
              <IconChartBar size={22} stroke={1.8} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Métricas dos seus sites
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {syncCaption}
              </Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={0.75}>
              {[7, 30, 90].map((d) => (
                <Chip
                  key={d}
                  label={`${d} dias`}
                  size="small"
                  onClick={() => setDays(d)}
                  color={days === d ? 'primary' : 'default'}
                  variant={days === d ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Stack>
            <TextField
              select
              size="small"
              label="Site"
              value={site || 'all'}
              onChange={(e) => setSite(e.target.value === 'all' ? '' : e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="all">Todos os sites</MenuItem>
              {siteOptions.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.host}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              size="small"
              onClick={sync}
              disabled={syncing || loading}
              startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <IconRefresh size={17} />}
              sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
            >
              Sincronizar agora
            </Button>
          </Stack>
        </Stack>
        {syncResult?.failed?.length ? (
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setSyncResult(null)}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {syncResult.failed.length === 1 ? 'Um site não respondeu:' : `${syncResult.failed.length} sites não responderam:`}
            </Typography>
            {syncResult.failed.slice(0, 6).map((f) => (
              <Typography key={f.id} variant="body2" component="div">
                <strong>{f.host}</strong> — {f.error}
              </Typography>
            ))}
          </Alert>
        ) : null}
      </TgCard>

      {!anLoading && an && sites.length === 0 ? (
        <TgCard hover={false} sx={{ p: { xs: 2.5, sm: 3 }, mb: 2 }}>
          <TgEmptyState
            icon={IconPlugConnected}
            title="Nenhum site ainda"
            description="Baixe o plugin abaixo, instale no WordPress e ative um layout de popup. O site aparece aqui em instantes e as métricas chegam sozinhas."
          />
        </TgCard>
      ) : !anLoading && an && !anySynced ? (
        <TgCard hover={false} sx={{ p: { xs: 2.5, sm: 3 }, mb: 2 }}>
          <TgEmptyState
            icon={IconChartBar}
            title="Os sites ainda não enviaram métricas"
            description="Sites com o plugin a partir da versão 0.10 mandam o resumo sozinhos (o plugin atualiza automaticamente). Para ver agora, clique em Sincronizar agora."
            action={
              <Button
                variant="contained"
                onClick={sync}
                disabled={syncing}
                startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <IconRefresh size={17} />}
              >
                Sincronizar agora
              </Button>
            }
          />
        </TgCard>
      ) : (
        <>
          {/* KPIs */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
              gap: 1.5,
              mb: 2
            }}
          >
            {kpis.map((k) => (
              <KpiCard key={k.label} {...k} loading={anLoading && !an} />
            ))}
          </Box>

          {/* envios por dia + plataformas */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2, mb: 2 }}>
            <TgCard hover={false} sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
              <SectionTitle
                icon={IconSend}
                title="Notificações por dia"
                sub="Enviadas pela automação e pelos broadcasts, e quantas foram clicadas"
              />
              {anLoading && !an ? <Skeleton height={300} /> : <Chart type="line" height={300} options={sendOptions} series={sendSeries} />}
            </TgCard>
            <TgCard hover={false} sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
              <SectionTitle icon={IconUsers} title="Inscritos por plataforma" sub="Aparelhos ativos hoje, em todos os sites" />
              {anLoading && !an ? (
                <Skeleton height={280} />
              ) : platKeys.length ? (
                <Chart type="donut" height={280} options={donutOptions} series={donutSeries} />
              ) : (
                <TgEmptyState
                  dense
                  icon={IconUsers}
                  title="Ninguém inscrito ainda"
                  description="Quando os visitantes aceitarem o convite, a divisão por aparelho aparece aqui."
                />
              )}
            </TgCard>
          </Box>

          {/* convite + últimos disparos */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2, mb: 2 }}>
            <TgCard hover={false} sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
              <SectionTitle
                icon={IconEye}
                title="Convite de permissão por dia"
                sub="Quantas vezes o popup apareceu e quantos visitantes ativaram"
              />
              {anLoading && !an ? (
                <Skeleton height={280} />
              ) : (
                <Chart type="line" height={280} options={popupOptions} series={popupSeries} />
              )}
            </TgCard>
            <TgCard hover={false} sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
              <SectionTitle
                icon={IconHistory}
                title="Últimos disparos"
                sub="Broadcasts e 'Enviar agora' mais recentes, em todos os sites"
              />
              {anLoading && !an ? (
                <Stack spacing={1}>
                  <Skeleton height={44} />
                  <Skeleton height={44} />
                  <Skeleton height={44} />
                </Stack>
              ) : blasts.length === 0 ? (
                <TgEmptyState
                  dense
                  icon={IconSpeakerphone}
                  title="Nenhum disparo ainda"
                  description="Crie copys e um broadcast no WordPress, ou use 'Enviar agora' em Configurações básicas."
                />
              ) : (
                <Stack
                  divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}
                  sx={{ maxHeight: 300, overflowY: 'auto', pr: 0.5 }}
                >
                  {blasts.map((b) => (
                    <Stack key={`${b.site_id}-${b.id}`} direction="row" spacing={1.25} alignItems="center" sx={{ py: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          flexShrink: 0,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          color: b.kind === 'broadcast' ? '#8b5cf6' : '#0ea5e9',
                          bgcolor: b.kind === 'broadcast' ? '#8b5cf61f' : '#0ea5e91f'
                        }}
                      >
                        {b.kind === 'broadcast' ? <IconSpeakerphone size={17} stroke={1.8} /> : <IconSend size={17} stroke={1.8} />}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                          {b.title || '(sem título)'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="div">
                          {[
                            b.host,
                            b.kind === 'broadcast' ? `Broadcast${b.broadcast ? ` · ${b.broadcast}` : ''}` : 'Enviar agora',
                            fmtWhen(b.at)
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Typography>
                      </Box>
                      <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {nfmt(b.sent)}{' '}
                          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            env.
                          </Box>{' '}
                          · {nfmt(b.clicked)}{' '}
                          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            cliques
                          </Box>
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: b.status === 'sending' ? 'warning.main' : b.failed ? 'warning.main' : 'text.secondary' }}
                        >
                          {b.status === 'sending'
                            ? 'enviando…'
                            : b.failed
                              ? `${nfmt(b.failed)} falha${b.failed === 1 ? '' : 's'}`
                              : `CTR ${pct(b.clicked, b.sent)}`}
                        </Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              )}
            </TgCard>
          </Box>

          {/* por site */}
          <TgCard hover={false} sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
            <SectionTitle
              icon={IconWorldWww}
              title="Por site"
              sub={`Inscritos de hoje e o que aconteceu nos últimos ${days} dias em cada site com o plugin ativo agora (desativou ou apagou, sai daqui). Clique num site para ver só ele.`}
              action={site ? <Chip size="small" label="Ver todos" onClick={() => setSite('')} onDelete={() => setSite('')} /> : null}
            />
            {anLoading && !an ? (
              <Stack spacing={1}>
                <Skeleton height={48} />
                <Skeleton height={48} />
              </Stack>
            ) : isXs ? (
              <Stack spacing={1.25}>
                {sites.map((s) => {
                  const st = siteStatus(s);
                  const health = siteHealth(s);
                  return (
                    <Box
                      key={s.id}
                      sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', minWidth: 0 }}
                      onClick={() => setSite(s.id)}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                            {s.host}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="div">
                            {[
                              s.name,
                              s.plugin_version ? `plugin ${s.plugin_version}` : null,
                              s.stats_at ? `sincronizado ${fmtAgo(s.stats_at)}` : null
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Typography>
                        </Box>
                        <TgStatusPill status={st.status} label={st.label} />
                      </Stack>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1 }}>
                        {[
                          ['Inscritos', nfmt(s.subscribers?.active || 0)],
                          ['Enviadas', nfmt(s.period.sent)],
                          ['Cliques', `${nfmt(s.period.clicked)} · ${pct(s.period.clicked, s.period.sent)}`],
                          ['Ativações', nfmt(s.period.granted)]
                        ].map(([l, v]) => (
                          <Box key={l} sx={{ minWidth: 0 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              {l}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                              {v}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                      {health ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                          {health.map((h) => (
                            <Chip
                              key={h.label}
                              size="small"
                              label={h.label}
                              color={h.color}
                              variant="outlined"
                              sx={{ height: 22, fontSize: 11 }}
                            />
                          ))}
                        </Stack>
                      ) : null}
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 760, '& td, & th': { borderColor: 'divider' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Site</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Inscritos</TableCell>
                      <TableCell align="right">Enviadas</TableCell>
                      <TableCell align="right">Cliques</TableCell>
                      <TableCell align="right">Ativações</TableCell>
                      <TableCell>Saúde</TableCell>
                      <TableCell>Sincronizado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sites.map((s) => {
                      const st = siteStatus(s);
                      const health = siteHealth(s);
                      return (
                        <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSite(s.id)} selected={site === s.id}>
                          <TableCell sx={{ maxWidth: 260 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                              {s.host}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="div">
                              {[s.name, s.plugin_version ? `plugin ${s.plugin_version}` : null].filter(Boolean).join(' · ') || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <TgStatusPill status={st.status} label={st.label} />
                          </TableCell>
                          <TableCell align="right">
                            <Num dim={!s.stats_at}>{nfmt(s.subscribers?.active || 0)}</Num>
                          </TableCell>
                          <TableCell align="right">
                            <Num>{nfmt(s.period.sent)}</Num>
                            {s.period.failed ? (
                              <Typography variant="caption" sx={{ color: 'warning.main', display: 'block' }}>
                                {nfmt(s.period.failed)} falhas
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell align="right">
                            <Num>{nfmt(s.period.clicked)}</Num>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              CTR {pct(s.period.clicked, s.period.sent)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Num>{nfmt(s.period.granted)}</Num>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              de {nfmt(s.period.impressions)} exibições
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {health ? (
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                {health.map((h) => (
                                  <Chip
                                    key={h.label}
                                    size="small"
                                    label={h.label}
                                    color={h.color}
                                    variant="outlined"
                                    sx={{ height: 22, fontSize: 11 }}
                                  />
                                ))}
                              </Stack>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {s.stats_at ? fmtAgo(s.stats_at) : 'nunca'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
          </TgCard>

          {/* copys com mais cliques */}
          {copies.length ? (
            <TgCard hover={false} sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
              <SectionTitle
                icon={IconStar}
                title="Copys com mais cliques"
                sub="As notificações que mais renderam cliques, somando todos os disparos de cada uma"
              />
              <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
                {copies.map((c) => {
                  const rate = c.sent > 0 ? Math.min(100, (c.clicked / c.sent) * 100) : 0;
                  return (
                    <Stack key={`${c.site_id}-${c.id}`} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1, minWidth: 0 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                          {c.title || '(sem título)'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="div">
                          {c.host}
                          {c.used ? ' · já usada' : ''}
                        </Typography>
                      </Box>
                      <Box sx={{ width: { xs: 70, sm: 140 }, flexShrink: 0 }}>
                        <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${rate}%`, borderRadius: 4, bgcolor: '#06b6d4' }} />
                        </Box>
                      </Box>
                      <Stack alignItems="flex-end" sx={{ flexShrink: 0, minWidth: 92 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {nfmt(c.clicked)} cliques
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {nfmt(c.sent)} env. · CTR {pct(c.clicked, c.sent)}
                        </Typography>
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            </TgCard>
          ) : null}
        </>
      )}

      {/* ------------------------------------------------ plugin + download */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 2, mb: 2 }}>
        <TgCard hover={false} sx={{ p: { xs: 2.5, sm: 3 }, minWidth: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                flexShrink: 0,
                borderRadius: 3.5,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                background: PIP_GRADIENT,
                boxShadow: (t) => `0 8px 20px ${tint(t, 'primary', 0.25)}`
              }}
            >
              <IconBellRinging size={34} stroke={1.6} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Plugin Push In Play
                </Typography>
                {loading ? (
                  <Skeleton width={70} />
                ) : data?.plugin?.version ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    versão {data.plugin.version}
                  </Typography>
                ) : null}
                {!loading ? <TgStatusPill status={acc.status} label={acc.label} /> : null}
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Vinculado à sua conta · sites ilimitados · atualiza sozinho · sem limite de inscritos
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              onClick={download}
              disabled={downloading || loading}
              startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <IconDownload size={20} />}
              sx={{ flexShrink: 0, px: 3, borderRadius: 2.5, width: { xs: '100%', sm: 'auto' } }}
            >
              Baixar plugin
            </Button>
          </Stack>

          {/* 3 passos */}
          <Box sx={{ mt: 3, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
            {STEPS.map((s, i) => (
              <Stack key={s.title} direction="row" spacing={1.5} sx={{ p: 1.75, borderRadius: 2.5, bgcolor: 'action.hover', minWidth: 0 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: 14,
                    color: '#fff',
                    background: PIP_GRADIENT
                  }}
                >
                  {i + 1}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {s.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {s.text}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Box>

          {/* Onde chega */}
          <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
            {PLATFORMS.map((p) => (
              <Stack key={p.label} direction="row" spacing={1.25} alignItems="flex-start" sx={{ px: 1.75, py: 1.25, minWidth: 0 }}>
                <Box sx={{ color: 'text.secondary', flexShrink: 0, mt: 0.25 }}>
                  <p.icon size={20} stroke={1.7} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {p.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.45 }}>
                    {p.text}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Box>
        </TgCard>

        {/* Chave */}
        <TgCard hover={false} sx={{ p: { xs: 2.5, sm: 3 }, alignSelf: 'start', minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <IconKey size={20} stroke={1.8} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Chave da conta
            </Typography>
          </Stack>
          {loading ? (
            <Skeleton height={40} />
          ) : (
            <Box
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 2,
                bgcolor: 'action.hover',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {data?.license?.prefix ? `${data.license.prefix}••••••••••••` : '—'}
            </Box>
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.25 }}>
            Vai dentro do plugin baixado e é a mesma do Tradutor Invisível: trocar aqui troca para os dois. Se o arquivo vazar, gere outra —
            os sites com a chave antiga param (e deixam de mandar métricas) até receberem os plugins novos.
          </Typography>
          {canManage ? (
            <Button variant="outlined" color="error" size="small" sx={{ mt: 2 }} onClick={() => setConfirmRotate(true)} disabled={loading}>
              Gerar nova chave
            </Button>
          ) : null}
        </TgCard>
      </Box>

      {/* ------------------------------------------------ o que o plugin faz (telas) */}
      <TgCard hover={false} sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          O que o plugin faz
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Tudo é configurado dentro do WordPress, no grupo "Push In Play" da barra lateral. Os inscritos e os envios ficam no seu site; só o
          resumo das métricas vem para cá.
        </Typography>
        {loading ? (
          <Stack spacing={1}>
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </Stack>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
            {screens.map((s) => {
              const Icon = SCREEN_ICON[s.key] || IconBellRinging;
              return (
                <Stack
                  key={s.key}
                  direction="row"
                  spacing={1.5}
                  sx={{ p: 1.75, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', minWidth: 0, opacity: s.ready ? 1 : 0.7 }}
                >
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      flexShrink: 0,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      color: s.ready ? '#fff' : 'text.secondary',
                      background: s.ready ? PIP_GRADIENT : undefined,
                      bgcolor: s.ready ? undefined : 'action.hover'
                    }}
                  >
                    <Icon size={20} stroke={1.7} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {s.title}
                      </Typography>
                      {!s.ready ? <Chip size="small" label="Em breve" variant="outlined" sx={{ height: 20, fontSize: 11 }} /> : null}
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                      {s.text}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Box>
        )}
      </TgCard>

      <TgConfirmDialog
        open={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        onConfirm={rotate}
        loading={rotating}
        danger
        title="Gerar nova chave?"
        message="A chave vale para o Push In Play E para o Tradutor Invisível. Os sites que usam os plugins atuais param até você baixar os plugins de novo e instalar neles."
        confirmLabel="Gerar nova chave"
      />
    </Box>
  );
}
