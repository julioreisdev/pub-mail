// =============================================================================
// Administração → Pagamentos (SUPER_ADMIN): gateway das ASSINATURAS do Pub Mail,
// dashboard de assinaturas por conta e histórico de cobranças.
// Dark-mode: tokens/theme.vars apenas (nunca theme.palette em callback sx).
// =============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useColorScheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';

import Chart from 'react-apexcharts';
import toast from 'react-hot-toast';
import {
  IconCreditCard,
  IconCheck,
  IconCopy,
  IconPlugConnected,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconEdit,
  IconCalendarPlus,
  IconCash,
  IconLock,
  IconLockOpen,
  IconRefresh,
  IconCoin,
  IconTrendingUp,
  IconUsers,
  IconHourglass,
  IconClockPause,
  IconReceipt2,
  IconSearch
} from '@tabler/icons-react';

import MainCard from 'ui-component/cards/MainCard';
import { get, post, put, patch } from 'api/api';

import { ModuleChips } from './ModulesPicker';
import PlanFields, { planLabel, AccessPill, fmtBRL, fmtDate, fmtDateTime, ExtendDialog } from './PlanFields';

const errMsg = (e, fb) => {
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};

const PROVIDERS = [
  { value: 'mercadopago', label: 'Mercado Pago', hint: 'Access Token de produção (Suas integrações → Credenciais de produção).' },
  { value: 'pushinpay', label: 'PushinPay', hint: 'Token da API (painel PushinPay → Integrações).' }
];
const PROVIDER_LABEL = { mercadopago: 'Mercado Pago', pushinpay: 'PushinPay', manual: 'Manual' };

// ------------------------------------------------------------------ átomos
function Card({ children, sx }) {
  return (
    <Box sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', ...sx }}>{children}</Box>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color = 'primary', loading }) {
  return (
    <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', height: '100%' }}>
      <Box
        sx={(t) => ({
          width: 34,
          height: 34,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          mb: 1,
          color: `${color}.main`,
          bgcolor: `rgba(${t.vars.palette[color].mainChannel} / 0.12)`
        })}
      >
        {Icon ? <Icon size={19} stroke={1.7} /> : null}
      </Box>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, display: 'block' }}
      >
        {label}
      </Typography>
      {loading ? (
        <Skeleton width={90} height={34} />
      ) : (
        <Typography variant="h3" sx={{ fontWeight: 700, mt: 0.25, lineHeight: 1.2 }}>
          {value}
        </Typography>
      )}
      {sub ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {sub}
        </Typography>
      ) : null}
    </Box>
  );
}

function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', color = 'error', loading, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button color={color} variant="contained" onClick={onConfirm} disabled={loading}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Pagination({ page, pages, total, pageSize, onPage, noun = 'registro(s)' }) {
  const first = total === 0 ? 0 : Math.min((page - 1) * pageSize + 1, total);
  const last = Math.min(total, page * pageSize);
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ pt: 1.5 }} flexWrap="wrap" useFlexGap>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        Mostrando {first}–{last} de {total} {noun}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton size="small" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
          <IconChevronLeft size={18} />
        </IconButton>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Página {page} de {Math.max(1, pages)}
        </Typography>
        <IconButton size="small" onClick={() => onPage(Math.min(Math.max(1, pages), page + 1))} disabled={page >= pages}>
          <IconChevronRight size={18} />
        </IconButton>
      </Stack>
    </Stack>
  );
}

const PERIODS = [
  { value: 'all', label: 'Todo o período' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'custom', label: 'Personalizado' }
];
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
function periodRange(period, from, to) {
  const now = new Date();
  if (period === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (period === '7d') return { from: startOfDay(new Date(now.getTime() - 6 * 86400000)), to: endOfDay(now) };
  if (period === '30d') return { from: startOfDay(new Date(now.getTime() - 29 * 86400000)), to: endOfDay(now) };
  if (period === 'custom') {
    return {
      from: from ? startOfDay(new Date(`${from}T00:00:00`)) : null,
      to: to ? endOfDay(new Date(`${to}T00:00:00`)) : null
    };
  }
  return { from: null, to: null };
}

// =============================== GATEWAY ===============================
function GatewayTab() {
  const [data, setData] = useState(null);
  const [token, setToken] = useState('');
  const [provider, setProvider] = useState('mercadopago');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await get('/admin/billing/settings');
      setData(s);
      setProvider(s.provider || 'mercadopago');
      setActive(s.active !== false);
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao carregar.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { provider, active };
      if (token.trim()) payload.access_token = token.trim();
      const s = await put('/admin/billing/settings', payload);
      setData(s);
      setToken('');
      setTestResult(null);
      toast.success('Gateway salvo.');
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao salvar.'));
    } finally {
      setSaving(false);
    }
  };
  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await post('/admin/billing/settings/test', {});
      setTestResult(r);
      if (r.ok) toast.success(`Conexão OK — ${r.detail || 'credencial válida'}`);
      else toast.error(`Falhou: ${r.detail || 'credencial inválida'}`);
    } catch (e) {
      setTestResult({ ok: false, detail: errMsg(e, 'Falha no teste.') });
    } finally {
      setTesting(false);
    }
  };
  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(data.webhook_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  if (loading) {
    return (
      <Stack spacing={1.5} sx={{ maxWidth: 760 }}>
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={260} />
        <Skeleton variant="rounded" height={140} />
      </Stack>
    );
  }
  const providers =
    Array.isArray(data?.providers) && data.providers.length ? PROVIDERS.filter((p) => data.providers.includes(p.value)) : PROVIDERS;
  const providerMeta = providers.find((p) => p.value === provider) || PROVIDERS[0];

  return (
    <Stack spacing={2} sx={{ maxWidth: 760 }}>
      <Alert severity="info">
        Este gateway recebe as assinaturas do Pub Mail (acesso à plataforma). O gateway que cada cliente usa para vender fica em{' '}
        <strong>Configurações → Pagamentos</strong> da própria conta.
      </Alert>
      <Alert severity={data?.ready ? 'success' : 'warning'} icon={<IconPlugConnected size={20} />}>
        {data?.ready ? (
          <>
            <strong>Gateway pronto.</strong> Contas com plano pago recebem o PIX na tela de pagamento ao entrar.
          </>
        ) : (
          <>
            <strong>Gateway não configurado.</strong> Sem token ativo, as contas com plano pago não conseguem gerar o PIX — só o “Marcar
            como pago” manual libera o acesso.
          </>
        )}
      </Alert>

      <Card>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconCreditCard size={20} />
            <Typography variant="h5" sx={{ fontWeight: 800, flex: 1 }}>
              Provedor PIX
            </Typography>
            <Chip
              size="small"
              label={data?.ready ? 'Ativo' : 'Inativo'}
              color={data?.ready ? 'success' : 'default'}
              variant={data?.ready ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700 }}
            />
          </Stack>
          <FormControl size="small" fullWidth>
            <InputLabel id="adm-pay-provider">Provedor</InputLabel>
            <Select labelId="adm-pay-provider" label="Provedor" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {providers.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            fullWidth
            type="password"
            label="Token de acesso"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={data?.has_token ? `Salvo: ${data.token_masked} (deixe em branco para manter)` : 'Cole o token aqui'}
            helperText={providerMeta.hint}
            autoComplete="new-password"
          />
          <FormControlLabel
            control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
            label="Cobranças ativas (desligar pausa a geração de novos PIX)"
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Button variant="contained" onClick={save} disabled={saving} sx={{ borderRadius: 2, fontWeight: 700 }}>
              {saving ? 'Salvando…' : 'Salvar gateway'}
            </Button>
            <Button variant="outlined" onClick={test} disabled={testing || !data?.has_token} sx={{ borderRadius: 2, fontWeight: 700 }}>
              {testing ? 'Testando…' : 'Testar conexão'}
            </Button>
            {data?.has_token ? (
              <Chip size="small" color="success" variant="outlined" icon={<IconCheck size={14} />} label="Chave salva" />
            ) : null}
          </Stack>
          {testResult ? (
            <Alert severity={testResult.ok ? 'success' : 'error'} sx={{ py: 0.5 }}>
              {testResult.ok
                ? `Conexão OK — ${testResult.detail || 'credencial válida'}`
                : `Falhou: ${testResult.detail || 'credencial inválida'}`}
            </Alert>
          ) : null}
        </Stack>
      </Card>

      <Card>
        <Stack spacing={1.25}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Webhook (confirmação instantânea)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cadastre esta URL no painel do provedor (Mercado Pago: <em>Suas integrações → Webhooks → Pagamentos</em>). Sem o webhook o
            sistema ainda confirma sozinho a cada minuto — o webhook só deixa instantâneo.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              fullWidth
              value={data?.webhook_url || ''}
              InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } }}
              onFocus={(e) => e.target.select()}
            />
            <Tooltip title={copied ? 'Copiado!' : 'Copiar'}>
              <span>
                <IconButton onClick={copyWebhook} disabled={!data?.webhook_url}>
                  {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}

// =============================== ASSINATURAS ===============================
const SUB_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'active', label: 'Ativas' },
  { value: 'pending', label: 'Aguardando pagamento' },
  { value: 'expired', label: 'Vencidas' },
  { value: 'blocked', label: 'Bloqueadas' },
  { value: 'free', label: 'Grátis' }
];

const monthLabel = (ym) => {
  if (!ym || typeof ym !== 'string') return '';
  const [y, m] = ym.split('-');
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const idx = parseInt(m, 10) - 1;
  return names[idx] ? `${names[idx]}/${String(y).slice(2)}` : ym;
};

function PlanEditDialog({ open, item, loading, onClose, onSubmit }) {
  // null = fechado/sem item: o PlanFields só monta com o plano da conta atual (nada de estado velho)
  const [plan, setPlan] = useState(null);
  useEffect(() => {
    if (!open || !item) {
      setPlan(null);
      return;
    }
    const a = item.access || {};
    setPlan({
      price_cents: a.price_cents || 0,
      period_days: a.lifetime ? null : (a.period_days ?? null),
      notes: a.notes || '',
      period_invalid: false
    });
  }, [open, item]);
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (plan && !plan.period_invalid) onSubmit(plan);
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          Editar plano
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
            Conta <strong>{item?.organization_name}</strong> · preço/período novos valem na próxima cobrança; preço 0 libera na hora.
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {plan ? (
              <>
                <PlanFields
                  priceCents={plan.price_cents}
                  periodDays={plan.period_days}
                  onChange={({ price_cents, period_days, period_invalid }) =>
                    setPlan((p) => ({ ...p, price_cents, period_days, period_invalid: !!period_invalid }))
                  }
                />
                <TextField
                  size="small"
                  label="Observações (internas)"
                  value={plan.notes}
                  onChange={(e) => setPlan((p) => ({ ...p, notes: e.target.value.slice(0, 255) }))}
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder="Ex.: negociado com desconto até dez/2026"
                  inputProps={{ maxLength: 255 }}
                  helperText={`${(plan.notes || '').length}/255`}
                  FormHelperTextProps={{ sx: { textAlign: 'right', mx: 0.5 } }}
                />
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !plan || !!plan.period_invalid}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Salvar plano
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function SubscriptionsTab() {
  const { mode, systemMode } = useColorScheme();
  const isDark = (mode === 'system' ? systemMode : mode) === 'dark';

  // ---- overview
  const [overview, setOverview] = useState(null);
  const [ovLoading, setOvLoading] = useState(true);
  const loadOverview = useCallback(async () => {
    setOvLoading(true);
    try {
      const o = await get('/admin/billing/overview');
      setOverview(o);
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao carregar o resumo.'));
    } finally {
      setOvLoading(false);
    }
  }, []);
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // ---- lista
  const empty = { items: [], total: 0, page: 1, pages: 1 };
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [status, setStatus] = useState('all');
  const [paid, setPaid] = useState('all');
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const reqRef = useRef(0);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(1);
  }, [status, paid, qDebounced, pageSize]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), status });
    if (qDebounced) params.set('q', qDebounced);
    if (paid !== 'all') params.set('paid', paid);
    const seq = ++reqRef.current;
    setLoading(true);
    get(`/admin/billing/subscriptions?${params.toString()}`)
      .then((d) => {
        if (seq !== reqRef.current) return;
        const ok = d && Array.isArray(d.items) ? d : empty;
        setData(ok);
        // página além do fim (ex.: filtro encolheu a lista) → volta pra última
        if (ok.pages && ok.page > ok.pages) setPage(ok.pages);
      })
      .catch((e) => {
        if (seq === reqRef.current) {
          setData(empty);
          toast.error(errMsg(e, 'Falha ao carregar assinaturas.'));
        }
      })
      .finally(() => {
        if (seq === reqRef.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, paid, qDebounced, reloadTick]);

  const reloadAll = () => {
    setReloadTick((t) => t + 1);
    loadOverview();
  };

  // ---- ações por linha
  const [menu, setMenu] = useState({ anchor: null, item: null });
  const [planDialog, setPlanDialog] = useState({ open: false, item: null });
  const [extendDialog, setExtendDialog] = useState({ open: false, item: null });
  const [confirm, setConfirm] = useState({ open: false });
  const [busy, setBusy] = useState(false);

  const openMenu = (e, item) => setMenu({ anchor: e.currentTarget, item });
  const closeMenu = () => setMenu({ anchor: null, item: null });

  const applyItem = (updated) => {
    if (!updated?.organization_id) return;
    setData((d) => ({ ...d, items: d.items.map((it) => (it.organization_id === updated.organization_id ? updated : it)) }));
  };

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      applyItem(r);
      toast.success(okMsg);
      setConfirm({ open: false });
      setExtendDialog({ open: false, item: null });
      setPlanDialog({ open: false, item: null });
      reloadAll();
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao processar a ação.'));
    } finally {
      setBusy(false);
    }
  };

  const askMarkPaid = (item) =>
    setConfirm({
      open: true,
      title: 'Marcar como pago',
      color: 'success',
      confirmLabel: 'Marcar como pago',
      message: `Registrar um pagamento manual de ${fmtBRL(item.access?.price_cents)} para "${item.organization_name}" e ativar o acesso pelo período do plano (${
        item.access?.lifetime || !item.access?.period_days ? 'vitalício' : `${item.access.period_days} dias`
      })?${item.access?.status === 'BLOCKED' ? ' Isso também desbloqueia a conta.' : ''}`,
      action: () =>
        run(() => post(`/admin/billing/subscriptions/${item.organization_id}/mark-paid`, {}), 'Pagamento registrado e acesso ativado.')
    });
  const askBlock = (item) =>
    setConfirm({
      open: true,
      title: 'Bloquear conta',
      confirmLabel: 'Bloquear',
      message: `Bloquear "${item.organization_name}"? Todos os usuários da conta perdem o acesso até o desbloqueio.`,
      action: () => run(() => post(`/admin/billing/subscriptions/${item.organization_id}/block`, {}), 'Conta bloqueada.')
    });
  const askUnblock = (item) =>
    setConfirm({
      open: true,
      title: 'Desbloquear conta',
      color: 'primary',
      confirmLabel: 'Desbloquear',
      message: `Liberar o acesso de "${item.organization_name}"? A conta volta ao status normal do plano.`,
      action: () => run(() => post(`/admin/billing/subscriptions/${item.organization_id}/unblock`, {}), 'Conta desbloqueada.')
    });

  // ---- gráfico (1 série: receita por mês)
  const series = useMemo(() => (Array.isArray(overview?.series) ? overview.series : []), [overview]);
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const chartOptions = useMemo(
    () => ({
      chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent', animations: { speed: 400 } },
      theme: { mode: isDark ? 'dark' : 'light' },
      colors: ['#3b82f6'],
      plotOptions: { bar: { columnWidth: series.length > 8 ? '55%' : '40%', borderRadius: 4, borderRadiusApplication: 'end' } },
      dataLabels: { enabled: false },
      states: { hover: { filter: { type: 'lighten', value: 0.08 } }, active: { filter: { type: 'none' } } },
      xaxis: {
        categories: series.map((s) => monthLabel(s.month)),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { fontSize: '11px' } }
      },
      yaxis: { labels: { formatter: (v) => fmtBRL(Math.round(v)).replace(',00', ''), style: { fontSize: '11px' } }, tickAmount: 4 },
      grid: { borderColor: gridColor, strokeDashArray: 4, xaxis: { lines: { show: false } }, padding: { left: 8, right: 8 } },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: {
          formatter: (v, { dataPointIndex }) => `${fmtBRL(v)} · ${series[dataPointIndex]?.count ?? 0} pagamento(s)`,
          title: { formatter: () => 'Receita' }
        }
      }
    }),
    [series, isDark, gridColor]
  );
  const chartSeries = useMemo(() => [{ name: 'Receita', data: series.map((s) => Number(s.revenue_cents) || 0) }], [series]);
  const hasChart = series.some((s) => (Number(s.revenue_cents) || 0) > 0);

  const subs = overview?.subscriptions || {};
  const filtersOn = q || status !== 'all' || paid !== 'all';

  return (
    <Box>
      {/* KPIs */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))', lg: 'repeat(6, minmax(0,1fr))' },
          gap: 1.5,
          mb: 2
        }}
      >
        <KpiCard
          icon={IconCoin}
          label="Receita total"
          value={fmtBRL(overview?.revenue_total_cents)}
          sub={`${overview?.payments_total ?? 0} pagamento(s)`}
          color="success"
          loading={ovLoading}
        />
        <KpiCard
          icon={IconReceipt2}
          label="Receita no período"
          value={fmtBRL(overview?.revenue_period_cents)}
          sub={`${overview?.payments_period ?? 0} pagamento(s)`}
          color="primary"
          loading={ovLoading}
        />
        <KpiCard
          icon={IconTrendingUp}
          label="MRR estimado"
          value={fmtBRL(overview?.mrr_cents)}
          sub="receita recorrente / mês"
          color="info"
          loading={ovLoading}
        />
        <KpiCard
          icon={IconUsers}
          label="Ativas"
          value={subs.ACTIVE ?? 0}
          sub={`${subs.FREE ?? 0} grátis`}
          color="success"
          loading={ovLoading}
        />
        <KpiCard
          icon={IconHourglass}
          label="Aguardando pagamento"
          value={subs.PENDING ?? 0}
          sub={`${overview?.pending_charges ?? 0} PIX em aberto`}
          color="warning"
          loading={ovLoading}
        />
        <KpiCard
          icon={IconClockPause}
          label="Vencidas"
          value={subs.EXPIRED ?? 0}
          sub={`${subs.BLOCKED ?? 0} bloqueada(s)`}
          color="error"
          loading={ovLoading}
        />
      </Box>

      {/* Gráfico */}
      <Card sx={{ mb: 2, p: 2 }}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Receita por mês
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            pagamentos confirmados (PIX e manuais)
          </Typography>
        </Stack>
        {ovLoading ? (
          <Skeleton variant="rounded" height={220} />
        ) : hasChart ? (
          <Chart options={chartOptions} series={chartSeries} type="bar" height={230} />
        ) : (
          <Box sx={{ height: 160, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">Nenhum pagamento confirmado ainda.</Typography>
          </Box>
        )}
      </Card>

      {/* Filtros */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField
          size="small"
          label="Buscar"
          placeholder="Conta, nome ou e-mail…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: 240 }}
          InputProps={{ startAdornment: <IconSearch size={16} style={{ marginRight: 6, opacity: 0.6 }} /> }}
        />
        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel id="sub-status-label">Status</InputLabel>
          <Select labelId="sub-status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {SUB_STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="sub-paid-label">Plano</InputLabel>
          <Select labelId="sub-paid-label" label="Plano" value={paid} onChange={(e) => setPaid(e.target.value)}>
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="true">Pagas</MenuItem>
            <MenuItem value="false">Grátis</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="sub-size-label">Por página</InputLabel>
          <Select labelId="sub-size-label" label="Por página" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[15, 30, 50].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {filtersOn ? (
          <Button
            size="small"
            onClick={() => {
              setQ('');
              setStatus('all');
              setPaid('all');
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Recarregar">
          <span>
            <IconButton size="small" onClick={reloadAll} disabled={loading || ovLoading}>
              <IconRefresh size={18} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Tabela */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cliente</TableCell>
              <TableCell>Módulos</TableCell>
              <TableCell>Plano</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Pago em / Vence em</TableCell>
              <TableCell align="right">Total pago</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              [0, 1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton height={28} />
                  </TableCell>
                </TableRow>
              ))
            ) : data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                  {filtersOn ? 'Nenhuma conta bate com os filtros.' : 'Nenhuma conta cadastrada ainda.'}
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((it) => {
                const a = it.access || {};
                return (
                  <TableRow key={it.organization_id} hover sx={{ opacity: it.org_status === false ? 0.6 : 1 }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        {it.owner?.name || '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {it.owner?.email || 'sem usuário dono'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
                        {it.organization_name}
                        {it.users_count > 1 ? ` · ${it.users_count} usuários` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {it.owner?.role === 'SUPER_ADMIN' ? (
                        <Chip size="small" label="Tudo" color="secondary" variant="outlined" sx={{ height: 22, fontWeight: 700 }} />
                      ) : (
                        <ModuleChips value={it.owner?.modules} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {planLabel(a.price_cents, a.lifetime ? null : a.period_days)}
                      </Typography>
                      {a.notes ? (
                        <Tooltip title={a.notes} arrow>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 160 }} noWrap>
                            {a.notes}
                          </Typography>
                        </Tooltip>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <AccessPill access={a} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        {a.last_paid_at ? `Pago ${fmtDate(a.last_paid_at)}` : 'Nunca pagou'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {a.lifetime && a.status === 'ACTIVE' ? 'Vitalício' : a.access_until ? `Vence ${fmtDate(a.access_until)}` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {fmtBRL(it.total_paid_cents)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {it.payments_count ?? 0} pagamento(s)
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => openMenu(e, it)} disabled={busy}>
                        <IconDotsVertical size={18} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pagination
        page={data.page || page}
        pages={data.pages || 1}
        total={data.total || 0}
        pageSize={pageSize}
        onPage={setPage}
        noun="conta(s)"
      />

      <Menu
        anchorEl={menu.anchor}
        open={!!menu.anchor}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            setPlanDialog({ open: true, item: menu.item });
            closeMenu();
          }}
        >
          <ListItemIcon>
            <IconEdit size={18} />
          </ListItemIcon>
          <ListItemText>Editar plano</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setExtendDialog({ open: true, item: menu.item });
            closeMenu();
          }}
        >
          <ListItemIcon>
            <IconCalendarPlus size={18} />
          </ListItemIcon>
          <ListItemText>Estender dias…</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={(menu.item?.access?.price_cents || 0) <= 0}
          onClick={() => {
            askMarkPaid(menu.item);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <IconCash size={18} />
          </ListItemIcon>
          <ListItemText>Marcar como pago</ListItemText>
        </MenuItem>
        <Divider />
        {menu.item?.access?.status === 'BLOCKED' ? (
          <MenuItem
            onClick={() => {
              askUnblock(menu.item);
              closeMenu();
            }}
          >
            <ListItemIcon>
              <IconLockOpen size={18} />
            </ListItemIcon>
            <ListItemText>Desbloquear</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem
            sx={{ color: 'error.main' }}
            onClick={() => {
              askBlock(menu.item);
              closeMenu();
            }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              <IconLock size={18} />
            </ListItemIcon>
            <ListItemText>Bloquear</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <PlanEditDialog
        open={planDialog.open}
        item={planDialog.item}
        loading={busy}
        onClose={() => setPlanDialog({ open: false, item: null })}
        onSubmit={(plan) =>
          run(
            () =>
              patch(`/admin/billing/subscriptions/${planDialog.item.organization_id}`, {
                price_cents: plan.price_cents,
                period_days: plan.period_days,
                notes: plan.notes || ''
              }),
            'Plano atualizado.'
          )
        }
      />
      <ExtendDialog
        open={extendDialog.open}
        orgName={extendDialog.item?.organization_name}
        loading={busy}
        onClose={() => setExtendDialog({ open: false, item: null })}
        onSubmit={(days) =>
          run(
            () => post(`/admin/billing/subscriptions/${extendDialog.item.organization_id}/extend`, { days }),
            `Acesso estendido em ${days} dia(s).`
          )
        }
      />
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        color={confirm.color || 'error'}
        loading={busy}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.action?.()}
      />
    </Box>
  );
}

// =============================== COBRANÇAS ===============================
const PAY_STATUS = {
  PAID: { label: 'Pago', color: 'success' },
  PENDING: { label: 'Aguardando', color: 'warning' },
  EXPIRED: { label: 'Expirado', color: 'default' },
  FAILED: { label: 'Falhou', color: 'error' },
  MANUAL: { label: 'Manual', color: 'info' }
};
function PayStatusChip({ status, provider }) {
  const key = String(status || '').toUpperCase();
  const cfg = PAY_STATUS[key] || { label: status || '—', color: 'default' };
  const manual = key === 'PAID' && provider === 'manual';
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Chip
        size="small"
        label={cfg.label}
        color={cfg.color}
        variant={cfg.color === 'default' ? 'outlined' : 'filled'}
        sx={{ fontWeight: 700 }}
      />
      {manual ? <Chip size="small" label="manual" variant="outlined" sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }} /> : null}
    </Stack>
  );
}

function PaymentsTab() {
  const empty = { items: [], total: 0, page: 1, pages: 1 };
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const reqRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(1);
  }, [status, period, from, to, qDebounced, pageSize]);

  useEffect(() => {
    const range = periodRange(period, from, to);
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), status });
    if (qDebounced) params.set('q', qDebounced);
    if (range.from) params.set('from', range.from.toISOString());
    if (range.to) params.set('to', range.to.toISOString());
    const seq = ++reqRef.current;
    setLoading(true);
    get(`/admin/billing/payments?${params.toString()}`)
      .then((d) => {
        if (seq !== reqRef.current) return;
        const ok = d && Array.isArray(d.items) ? d : empty;
        setData(ok);
        if (ok.pages && ok.page > ok.pages) setPage(ok.pages);
      })
      .catch((e) => {
        if (seq === reqRef.current) {
          setData(empty);
          toast.error(errMsg(e, 'Falha ao carregar cobranças.'));
        }
      })
      .finally(() => {
        if (seq === reqRef.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, period, from, to, qDebounced, tick]);

  const filtersOn = q || status !== 'all' || period !== 'all';

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField
          size="small"
          label="Buscar"
          placeholder="Conta, nome ou e-mail…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: 240 }}
          InputProps={{ startAdornment: <IconSearch size={16} style={{ marginRight: 6, opacity: 0.6 }} /> }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="pay-status-label">Status</InputLabel>
          <Select labelId="pay-status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="all">Todos os status</MenuItem>
            <MenuItem value="paid">Pagos</MenuItem>
            <MenuItem value="manual">Manuais</MenuItem>
            <MenuItem value="pending">Aguardando</MenuItem>
            <MenuItem value="expired">Expirados</MenuItem>
            <MenuItem value="failed">Falhou</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="pay-period-label">Período</InputLabel>
          <Select labelId="pay-period-label" label="Período" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {period === 'custom' ? (
          <>
            <TextField
              size="small"
              type="date"
              label="De"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="date"
              label="Até"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </>
        ) : null}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="pay-size-label">Por página</InputLabel>
          <Select labelId="pay-size-label" label="Por página" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[15, 30, 50].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {filtersOn ? (
          <Button
            size="small"
            onClick={() => {
              setQ('');
              setStatus('all');
              setPeriod('all');
              setFrom('');
              setTo('');
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Recarregar">
          <span>
            <IconButton size="small" onClick={() => setTick((t) => t + 1)} disabled={loading}>
              <IconRefresh size={18} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Provedor</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Pago em</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              [0, 1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton height={28} />
                  </TableCell>
                </TableRow>
              ))
            ) : data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                  {filtersOn
                    ? 'Nenhuma cobrança bate com os filtros.'
                    : 'Nenhuma cobrança ainda — elas aparecem quando um cliente gera o PIX ou você marca como pago.'}
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="caption">{fmtDateTime(p.created_at)}</Typography>
                    {p.status === 'PENDING' && p.expires_at ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        expira {fmtDateTime(p.expires_at)}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {p.user_name || p.organization_name || '—'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      {p.user_email || ''}
                      {p.user_email && p.organization_name ? ' · ' : ''}
                      {p.organization_name || ''}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {fmtBRL(p.amount_cents)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {p.period_days == null || Number(p.period_days) === 0 ? 'Vitalício' : `${p.period_days} dias`}
                  </TableCell>
                  <TableCell>{PROVIDER_LABEL[p.provider] || p.provider || '—'}</TableCell>
                  <TableCell>
                    <PayStatusChip status={p.status} provider={p.provider} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="caption">{p.paid_at ? fmtDateTime(p.paid_at) : '—'}</Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pagination
        page={data.page || page}
        pages={data.pages || 1}
        total={data.total || 0}
        pageSize={pageSize}
        onPage={setPage}
        noun="cobrança(s)"
      />
    </Box>
  );
}

// =============================== PÁGINA ===============================
export default function AdminPayments() {
  const [tab, setTab] = useState('subs');
  return (
    <MainCard
      title="Pagamentos das assinaturas"
      secondary={
        <Chip size="small" icon={<IconCreditCard size={14} />} label="Administração" variant="outlined" sx={{ fontWeight: 700 }} />
      }
    >
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="gateway" label="Gateway" sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab value="subs" label="Assinaturas" sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab value="payments" label="Cobranças" sx={{ textTransform: 'none', fontWeight: 700 }} />
      </Tabs>
      {tab === 'gateway' ? <GatewayTab /> : tab === 'payments' ? <PaymentsTab /> : <SubscriptionsTab />}
    </MainCard>
  );
}
