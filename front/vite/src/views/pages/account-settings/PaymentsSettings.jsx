import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  IconBrandTelegram,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconCreditCard,
  IconMessageChatbot,
  IconPlugConnected,
  IconReceipt2
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { get, post, put } from 'api/api';
import { TgPageHeader, TgCard, TgStatusPill, TgEmptyState, TgListSkeleton } from '../telegram/ui';
import CrmGatewaysCard from './CrmGatewaysCard';

// Configurações → Pagamentos: gateway PIX da ORGANIZAÇÃO (compartilhado por
// Webchat e Telegram) + vendas de todos os canais. As mensagens do checkout do
// Telegram continuam em Telegram → Pagamentos/VIP (não confundir o usuário).
const errMsg = (e, fb) => {
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
const PROVIDERS = [
  { value: 'mercadopago', label: 'Mercado Pago', hint: 'Access Token de produção (Suas integrações → Credenciais de produção).' },
  { value: 'pushinpay', label: 'PushinPay', hint: 'Token da API (painel PushinPay → Integrações).' }
];
const fmtDate = (v) => {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
  } catch {
    return '—';
  }
};
const SALE_STATUS = { PAID: 'ok', PENDING: 'warning', EXPIRED: 'inactive', FAILED: 'error' };
const SALE_LABEL = { PAID: 'Pago', PENDING: 'Aguardando', EXPIRED: 'Expirado', FAILED: 'Falhou' };

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
      const s = await get('/payments/settings');
      setData(s);
      setProvider(s.provider);
      setActive(s.active);
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
      const s = await put('/payments/settings', payload);
      setData(s);
      setToken('');
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
      const r = await post('/payments/settings/test', {});
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

  if (loading) return <TgListSkeleton rows={3} />;
  const providerMeta = PROVIDERS.find((p) => p.value === provider) || PROVIDERS[0];
  const eff = data?.crm?.effective || {};
  const crmOnly = !data?.ready && Boolean(eff.pix || eff.boleto || eff.card);

  return (
    <Stack spacing={2} sx={{ maxWidth: 760 }}>
      <Alert severity={data?.ready ? 'success' : crmOnly ? 'info' : 'warning'} icon={<IconPlugConnected size={20} />}>
        {crmOnly ? (
          <>
            <strong>Cobranças do WhatsApp prontas</strong> (gateway por meio de pagamento, abaixo). O gateway principal (Webchat, Telegram e
            PIX do Fluxo do Bot) ainda não está configurado.
          </>
        ) : data?.ready ? (
          <>
            <strong>Gateway pronto.</strong> Este mesmo gateway é usado pelo <strong>Webchat</strong> (cobranças PIX do funil) e pelo{' '}
            <strong>Telegram</strong> (planos VIP).
          </>
        ) : (
          <>
            <strong>Gateway não configurado.</strong> Cadastre o token do seu provedor PIX e ative para começar a vender pelo Webchat e pelo
            Telegram.
          </>
        )}
      </Alert>

      <TgCard hover={false} sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconCreditCard size={20} />
            <Typography variant="h5" sx={{ fontWeight: 800, flex: 1 }}>
              Provedor PIX
            </Typography>
            <TgStatusPill status={data?.ready ? 'ok' : 'inactive'} label={data?.ready ? 'Ativo' : 'Inativo'} />
          </Stack>
          <FormControl size="small" fullWidth>
            <InputLabel id="pay-provider">Provedor</InputLabel>
            <Select labelId="pay-provider" label="Provedor" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDERS.map((p) => (
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
            label="Pagamentos ativos (desligar pausa todas as cobranças novas)"
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={save} disabled={saving} sx={{ borderRadius: 2, fontWeight: 700 }}>
              {saving ? 'Salvando…' : 'Salvar gateway'}
            </Button>
            <Button variant="outlined" onClick={test} disabled={testing || !data?.has_token} sx={{ borderRadius: 2, fontWeight: 700 }}>
              {testing ? 'Testando…' : 'Testar conexão'}
            </Button>
            {data?.has_token ? (
              <Chip size="small" color="success" variant="outlined" icon={<IconCheck size={14} />} label="Token salvo" />
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
      </TgCard>

      <TgCard hover={false} sx={{ p: 2.5 }}>
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
              <IconButton onClick={copyWebhook}>{copied ? <IconCheck size={18} /> : <IconCopy size={18} />}</IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </TgCard>

      <CrmGatewaysCard key={JSON.stringify(data?.crm || {})} data={data} onSaved={setData} />
    </Stack>
  );
}

// =============================== VENDAS ===============================
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

function SalesTab() {
  const empty = { items: [], total: 0, page: 1, pages: 1, revenue_paid: 'R$ 0,00', paid_count: 0, by_channel: null };
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [channel, setChannel] = useState('all');
  const [period, setPeriod] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const reqRef = useRef(0); // A-75: ignora respostas fora de ordem

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [status, channel, period, from, to, qDebounced, pageSize]);

  useEffect(() => {
    const range = periodRange(period, from, to);
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), status, channel });
    if (qDebounced) params.set('q', qDebounced);
    if (range.from) params.set('from', range.from.toISOString());
    if (range.to) params.set('to', range.to.toISOString());
    const seq = ++reqRef.current;
    setLoading(true);
    get(`/payments/sales?${params.toString()}`)
      .then((d) => {
        if (seq === reqRef.current) setData(d);
      })
      .catch(() => {
        if (seq === reqRef.current) setData(empty);
      })
      .finally(() => {
        if (seq === reqRef.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, channel, period, from, to, qDebounced]);

  const firstItem = data.total === 0 ? 0 : (data.page - 1) * pageSize + 1;
  const lastItem = Math.min(data.total, data.page * pageSize);

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TgCard hover={false} sx={{ p: 1.75, px: 2.5, flex: '0 0 auto' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            Receita confirmada
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'success.main' }}>
            {data.revenue_paid}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {data.paid_count} venda(s) paga(s) no filtro
          </Typography>
        </TgCard>
        {data.by_channel ? (
          <>
            <TgCard hover={false} sx={{ p: 1.75, px: 2.5, flex: '0 0 auto' }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <IconMessageChatbot size={16} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  Webchat
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {data.by_channel.webchat.revenue}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {data.by_channel.webchat.paid} paga(s)
              </Typography>
            </TgCard>
            <TgCard hover={false} sx={{ p: 1.75, px: 2.5, flex: '0 0 auto' }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <IconBrandTelegram size={16} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  Telegram
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {data.by_channel.telegram.revenue}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {data.by_channel.telegram.paid} paga(s)
              </Typography>
            </TgCard>
          </>
        ) : null}
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField
          size="small"
          label="Buscar"
          placeholder="Produto, webchat, bot, sessão…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: 240 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="sales-channel-label">Canal</InputLabel>
          <Select labelId="sales-channel-label" label="Canal" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <MenuItem value="all">Todos os canais</MenuItem>
            <MenuItem value="webchat">Webchat</MenuItem>
            <MenuItem value="telegram">Telegram</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="sales-status-label">Status</InputLabel>
          <Select labelId="sales-status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="all">Todos os status</MenuItem>
            <MenuItem value="paid">Pagos</MenuItem>
            <MenuItem value="pending">Aguardando</MenuItem>
            <MenuItem value="expired">Expirados</MenuItem>
            <MenuItem value="failed">Falhou</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="sales-period-label">Período</InputLabel>
          <Select labelId="sales-period-label" label="Período" value={period} onChange={(e) => setPeriod(e.target.value)}>
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
          <InputLabel id="sales-size-label">Por página</InputLabel>
          <Select labelId="sales-size-label" label="Por página" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[15, 30, 50].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {q || status !== 'all' || channel !== 'all' || period !== 'all' ? (
          <Button
            size="small"
            onClick={() => {
              setQ('');
              setStatus('all');
              setChannel('all');
              setPeriod('all');
              setFrom('');
              setTo('');
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
      </Stack>

      {loading ? (
        <TgListSkeleton rows={5} />
      ) : data.items.length === 0 ? (
        <TgEmptyState
          icon={IconReceipt2}
          title={
            data.total === 0 && !q && status === 'all' && channel === 'all' && period === 'all' ? 'Nenhuma venda ainda' : 'Nada encontrado'
          }
          description={
            data.total === 0 && !q && status === 'all' && channel === 'all' && period === 'all'
              ? 'As cobranças aparecem aqui assim que um lead gerar um PIX no Webchat ou tocar num plano no Telegram.'
              : 'Nenhuma venda bate com os filtros escolhidos.'
          }
          dense
        />
      ) : (
        <Stack spacing={1}>
          {data.items.map((s) => (
            <TgCard key={`${s.channel}-${s.id}`} sx={{ p: 1.5, display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  flex: '0 0 auto',
                  bgcolor: 'action.selected'
                }}
              >
                {s.channel === 'telegram' ? <IconBrandTelegram size={18} /> : <IconMessageChatbot size={18} />}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {s.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                  {s.source_name} · {s.customer} · {fmtDate(s.created_at)}
                  {s.paid_at ? ` · pago ${fmtDate(s.paid_at)}` : ''}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 800 }}>{s.amount_label}</Typography>
              <TgStatusPill status={SALE_STATUS[s.status] || 'inactive'} label={SALE_LABEL[s.status] || s.status} />
              {s.status === 'PAID' && s.delivered ? <TgStatusPill status="ok" label="Entregue" /> : null}
            </TgCard>
          ))}
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ pt: 1 }} flexWrap="wrap" useFlexGap>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Mostrando {firstItem}–{lastItem} de {data.total} venda(s)
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <IconChevronLeft size={18} />
              </IconButton>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Página {data.page} de {data.pages}
              </Typography>
              <IconButton size="small" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages}>
                <IconChevronRight size={18} />
              </IconButton>
            </Stack>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

export default function PaymentsSettings() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <TgPageHeader
        icon={IconCreditCard}
        title="Pagamentos"
        subtitle="Gateway PIX da sua organização e todas as vendas (Webchat e Telegram) num só lugar."
      />
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Gateway" sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab label="Vendas" sx={{ textTransform: 'none', fontWeight: 700 }} />
      </Tabs>
      {tab === 0 ? <GatewayTab /> : <SalesTab />}
    </Box>
  );
}
