import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconAlertTriangle,
  IconBarcode,
  IconCash,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconDotsVertical,
  IconExternalLink,
  IconHourglass,
  IconMessage,
  IconPlayerPlay,
  IconPlus,
  IconQrcode,
  IconReceipt2,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSettings,
  IconX
} from '@tabler/icons-react';

import { get, post, put } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgAvatar, TgCard, TgConfirmDialog, TgEmptyState, TgFilterBar, TgListSkeleton, TgModal } from 'views/pages/telegram/ui';
import { WaPageHeader } from './waKit';
import { WA_DARK, errMsg, fmtDateTime, fmtPhone, tint } from './waShared';
import ChargeDialog from './crm/ChargeDialog';
import { CrmKpi, StatusChip, dueText, waPrimaryBtn } from './crm/crmKit';

// ============================================================================
// WhatsApp → Cobranças: PIX/boleto enviados na conversa (manuais e recorrentes),
// situação, lembretes, confirmação automática. KPIs: a receber, em atraso,
// recebido no mês.
// ============================================================================

const PAGE_SIZES = [25, 50, 100];
const STATUS = {
  PENDING: { label: 'Em aberto', token: 'info', color: '#2563EB', dark: '#60A5FA', icon: IconHourglass },
  OVERDUE: { label: 'Em atraso', token: 'warning', color: '#B45309', dark: '#FBBF24', icon: IconAlertTriangle },
  PAID: { label: 'Paga', token: 'success', color: '#128C7E', dark: '#25D366', icon: IconCircleCheck },
  EXPIRED: { label: 'Expirada', token: 'info', color: '#64748B', dark: '#94A3B8' },
  CANCELED: { label: 'Cancelada', token: 'info', color: '#64748B', dark: '#94A3B8' },
  FAILED: { label: 'Falhou', token: 'error', color: '#B91C1C', dark: '#F87171' }
};
const ORIGIN = { manual: 'Manual', recurring: 'Recorrente', bot: 'Bot' };
const KIND = { pix: 'PIX', boleto: 'Boleto', both: 'PIX + Boleto' };
const statusOf = (c) => (c.overdue ? 'OVERDUE' : c.status);

const copy = async (text, msg) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  } catch {
    toast.error('Não foi possível copiar.');
  }
};

// ----------------------------------------------------------------------------
// Configurações da cobrança (dono/admin)
// ----------------------------------------------------------------------------
const TEXT_FIELDS = [
  ['charge', 'Mensagem da cobrança', 'Enviada junto com o PIX / boleto.'],
  ['boleto', 'Texto do boleto', 'Depois do PIX, quando a cobrança tem boleto.'],
  ['reminder_before', 'Lembrete antes do vencimento', ''],
  ['reminder_due', 'Lembrete no dia do vencimento', ''],
  ['reminder_after', 'Lembrete depois do vencimento', 'Usado nos dois lembretes de atraso.'],
  ['paid', 'Recibo (pagamento confirmado)', ''],
  ['expired', 'Cobrança expirada', 'Não é enviado automaticamente; fica disponível para o futuro.']
];
function SettingsDialog({ open, onClose, settings, onSaved }) {
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && settings) setS(JSON.parse(JSON.stringify(settings)));
  }, [open, settings]);
  if (!s) return null;
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const setRem = (k, p) => setS((x) => ({ ...x, reminders: { ...x.reminders, [k]: { ...x.reminders[k], ...p } } }));
  const setText = (k, v) => setS((x) => ({ ...x, texts: { ...x.texts, [k]: v } }));
  const save = async () => {
    setBusy(true);
    try {
      const r = await put('/whatsapp/charges/settings', {
        pix_days: s.pix_days,
        boleto_days: s.boleto_days,
        default_kind: s.default_kind,
        days_before_due: s.days_before_due,
        auto_recurring: s.auto_recurring,
        send_qr: s.send_qr,
        overdue_tag: s.overdue_tag,
        reminders: s.reminders,
        texts: s.texts
      });
      onSaved(r);
      toast.success('Configurações salvas.');
      onClose();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
  };
  const num = (k, label, min, max, help) => (
    <TextField
      size="small"
      type="number"
      label={label}
      value={s[k]}
      onChange={(e) => set(k, Math.min(max, Math.max(min, parseInt(e.target.value || String(min), 10) || min)))}
      inputProps={{ min, max }}
      helperText={help}
      fullWidth
    />
  );
  return (
    <TgModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Configurações de cobrança"
      subtitle="Validade, cobrança recorrente, lembretes e textos. Variáveis: {{cliente.primeiro_nome}}, {{cobranca.valor}}, {{cobranca.descricao}}, {{cobranca.vencimento}}, {{cobranca.pix}}, {{cobranca.boleto_link}}, {{cobranca.boleto_codigo}}."
      maxWidth="md"
      disableClose={busy}
      footer={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
            sx={waPrimaryBtn}
          >
            Salvar
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0,1fr))' } }}>
          {num('pix_days', 'PIX vale (dias após vencer)', 1, 30, 'Depois disso o PIX expira (pagamento tardio é estornado pelo MP).')}
          {num('boleto_days', 'Boleto vale (dias após vencer)', 3, 60, '')}
          <TextField
            select
            size="small"
            label="Meio padrão"
            value={s.default_kind}
            onChange={(e) => set('default_kind', e.target.value)}
            fullWidth
          >
            <MenuItem value="pix">PIX</MenuItem>
            <MenuItem value="boleto" disabled={!s.boleto_available}>
              Boleto
            </MenuItem>
            <MenuItem value="both" disabled={!s.boleto_available}>
              PIX + Boleto
            </MenuItem>
          </TextField>
        </Box>
        <Divider>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Cobrança recorrente (assinaturas)
          </Typography>
        </Divider>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <FormControlLabel
            control={<Switch size="small" checked={s.auto_recurring} onChange={(e) => set('auto_recurring', e.target.checked)} />}
            label={<Typography variant="body2">Gerar e enviar sozinho</Typography>}
          />
          <Box sx={{ width: { sm: 220 } }}>{num('days_before_due', 'Dias antes do vencimento', 0, 30, '')}</Box>
          <FormControlLabel
            control={<Switch size="small" checked={s.send_qr} onChange={(e) => set('send_qr', e.target.checked)} />}
            label={<Typography variant="body2">Enviar imagem do QR Code</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={s.overdue_tag} onChange={(e) => set('overdue_tag', e.target.checked)} />}
            label={<Typography variant="body2">Etiqueta "Inadimplente" no atraso</Typography>}
          />
        </Stack>
        <Divider>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Lembretes (régua)
          </Typography>
        </Divider>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' } }}>
          {[
            ['before', 'Antes do vencimento', 'dias antes'],
            ['due', 'No dia do vencimento', null],
            ['after', '1º lembrete de atraso', 'dias depois'],
            ['after2', '2º lembrete de atraso', 'dias depois']
          ].map(([k, label, unit]) => (
            <Stack
              key={k}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
              <Switch size="small" checked={s.reminders[k].enabled} onChange={(e) => setRem(k, { enabled: e.target.checked })} />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                {label}
              </Typography>
              {unit ? (
                <TextField
                  size="small"
                  type="number"
                  value={s.reminders[k].days}
                  onChange={(e) => setRem(k, { days: Math.max(1, parseInt(e.target.value || '1', 10) || 1) })}
                  sx={{ width: 168, flexShrink: 0 }}
                  inputProps={{ min: 1, style: { minWidth: 36 } }}
                  InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                />
              ) : null}
            </Stack>
          ))}
        </Box>
        <Divider>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Textos
          </Typography>
        </Divider>
        {TEXT_FIELDS.map(([k, label, help]) => (
          <TextField
            key={k}
            size="small"
            label={label}
            value={s.texts[k]}
            onChange={(e) => setText(k, e.target.value.slice(0, 1500))}
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            helperText={help || undefined}
          />
        ))}
      </Stack>
    </TgModal>
  );
}

// ============================================================================
export default function WhatsAppCharges() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAdmin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [origin, setOrigin] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1, kpis: null });
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [newDlg, setNewDlg] = useState(false);
  const [cfgDlg, setCfgDlg] = useState(false);
  const [menu, setMenu] = useState(null); // {anchor, charge}
  const [confirm, setConfirm] = useState(null); // {kind:'cancel'|'paid', charge}
  const [rowBusy, setRowBusy] = useState({});
  const [runBusy, setRunBusy] = useState(false);
  const seqRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, kind, origin, pageSize]);
  useEffect(() => {
    get('/whatsapp/charges/settings')
      .then(setSettings)
      .catch(() => setSettings(null));
    get('/whatsapp/products')
      .then((r) => setProducts(Array.isArray(r) ? r : []))
      .catch(() => setProducts([]));
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const seq = ++seqRef.current;
      if (!silent) setLoading(true);
      try {
        const r = await get('/whatsapp/charges', {
          params: {
            q: debouncedQ || undefined,
            status: status === 'all' ? undefined : status,
            kind: kind === 'all' ? undefined : kind,
            origin: origin === 'all' ? undefined : origin,
            page,
            page_size: pageSize
          }
        });
        if (seq !== seqRef.current) return;
        setData({ items: r.items || [], total: r.total || 0, page: r.page || page, pages: r.pages || 1, kpis: r.kpis || null });
      } catch (e) {
        if (seq === seqRef.current && !silent) toast.error(errMsg(e, 'Falha ao carregar as cobranças.'));
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [debouncedQ, status, kind, origin, page, pageSize]
  );
  useEffect(() => {
    load();
  }, [load]);

  const patchRow = (c) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === c.id ? { ...x, ...c } : x)) }));
  const act = async (c, path, okMsg) => {
    setRowBusy((m) => ({ ...m, [c.id]: true }));
    try {
      const r = await post(`/whatsapp/charges/${c.id}/${path}`);
      if (r?.id) patchRow(r);
      if (okMsg) toast.success(typeof okMsg === 'function' ? okMsg(r) : okMsg);
      load({ silent: true });
      return r;
    } catch (e) {
      toast.error(errMsg(e, 'Falha na operação.'));
      return null;
    } finally {
      setRowBusy((m) => ({ ...m, [c.id]: false }));
    }
  };
  const runDaily = async () => {
    setRunBusy(true);
    try {
      const r = await post('/whatsapp/charges/run-daily');
      toast.success(
        `Rodado: ${r.generated} cobrança(s) gerada(s), ${r.reminders} lembrete(s), ${r.overdue} assinatura(s) marcada(s) em atraso.${r.errors?.length ? ` ${r.errors.length} erro(s).` : ''}`
      );
      if (r.errors?.length) toast.error(r.errors[0]);
      load({ silent: true });
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível rodar agora.'));
    } finally {
      setRunBusy(false);
    }
  };
  const openChat = (c) => navigate(`/whatsapp/chat?chat=${encodeURIComponent(c.chat_id)}`);

  const k = data.kpis;
  const items = data.items;
  const total = data.total;
  const from = total ? (data.page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, data.page * pageSize);
  const filtered = Boolean(debouncedQ || status !== 'all' || kind !== 'all' || origin !== 'all');

  return (
    <Box>
      <WaPageHeader
        icon={IconReceipt2}
        title="Cobranças"
        subtitle="PIX e boleto enviados na conversa, com lembretes e confirmação automática."
        sx={{ mb: 2.5 }}
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
            {canAdmin ? (
              <>
                <Tooltip title="Gera as cobranças recorrentes que vencem nos próximos dias e manda os lembretes de hoje (roda sozinho todo dia às 09:00).">
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={runBusy ? <CircularProgress size={14} color="inherit" /> : <IconPlayerPlay size={18} />}
                      onClick={runDaily}
                      disabled={runBusy}
                      sx={{ fontWeight: 700, borderRadius: 2 }}
                    >
                      Rodar agora
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  variant="outlined"
                  startIcon={<IconSettings size={18} />}
                  onClick={() => setCfgDlg(true)}
                  disabled={!settings}
                  sx={{ fontWeight: 700, borderRadius: 2 }}
                >
                  Configurar
                </Button>
              </>
            ) : null}
            <Button
              variant="contained"
              disableElevation
              startIcon={<IconPlus size={18} />}
              onClick={() => setNewDlg(true)}
              sx={waPrimaryBtn}
            >
              Nova cobrança
            </Button>
          </Stack>
        }
      />

      {settings && !settings.gateway_ready ? (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2.5 }}>
          Nenhum gateway de pagamento ativo. Configure em <strong>Configurações → Pagamentos</strong> para gerar PIX
          {settings.provider === 'mercadopago' ? ' e boleto' : ''}.
        </Alert>
      ) : null}

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, mb: 2.5 }}>
        <CrmKpi icon={IconHourglass} label={`A receber (${k?.pending?.count ?? 0} em aberto)`} value={k ? k.pending.label : null} accent />
        <CrmKpi icon={IconAlertTriangle} label={`Em atraso (${k?.overdue?.count ?? 0})`} value={k ? k.overdue.label : null} />
        <CrmKpi icon={IconCash} label={`Recebido no mês (${k?.paid_month?.count ?? 0})`} value={k ? k.paid_month.label : null} />
      </Box>

      <TgFilterBar>
        <TextField
          size="small"
          placeholder="Buscar por cliente ou descrição"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={16} />
              </InputAdornment>
            ),
            endAdornment: q ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setQ('')}>
                  <IconX size={14} />
                </IconButton>
              </InputAdornment>
            ) : null
          }}
        />
        <TextField select size="small" label="Situação" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="all">Todas</MenuItem>
          <MenuItem value="PENDING">Em aberto</MenuItem>
          <MenuItem value="OVERDUE">Em atraso</MenuItem>
          <MenuItem value="PAID">Pagas</MenuItem>
          <MenuItem value="EXPIRED">Expiradas</MenuItem>
          <MenuItem value="CANCELED">Canceladas</MenuItem>
          <MenuItem value="FAILED">Falharam</MenuItem>
        </TextField>
        <TextField select size="small" label="Meio" value={kind} onChange={(e) => setKind(e.target.value)} sx={{ minWidth: 130 }}>
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="pix">PIX</MenuItem>
          <MenuItem value="boleto">Boleto</MenuItem>
          <MenuItem value="both">PIX + Boleto</MenuItem>
        </TextField>
        <TextField select size="small" label="Origem" value={origin} onChange={(e) => setOrigin(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="all">Todas</MenuItem>
          <MenuItem value="manual">Manual</MenuItem>
          <MenuItem value="recurring">Recorrente</MenuItem>
          <MenuItem value="bot">Bot</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Por página"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          sx={{ minWidth: 110 }}
        >
          {PAGE_SIZES.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Atualizar">
          <span>
            <IconButton onClick={() => load()} disabled={loading}>
              <IconRefresh size={18} />
            </IconButton>
          </span>
        </Tooltip>
      </TgFilterBar>

      {loading && !items.length ? (
        <TgCard hover={false} sx={{ p: 2 }}>
          <TgListSkeleton rows={6} />
        </TgCard>
      ) : items.length === 0 ? (
        <TgEmptyState
          icon={IconReceipt2}
          title={filtered ? 'Nenhuma cobrança com esses filtros' : 'Nenhuma cobrança ainda'}
          description={
            filtered
              ? 'Tente outra busca ou limpe os filtros.'
              : 'Crie uma cobrança aqui ou pelo botão "Cobrar" na conversa. Assinaturas geram cobranças sozinhas antes do vencimento.'
          }
          action={
            !filtered ? (
              <Button
                variant="contained"
                disableElevation
                startIcon={<IconPlus size={18} />}
                onClick={() => setNewDlg(true)}
                sx={waPrimaryBtn}
              >
                Criar a primeira cobrança
              </Button>
            ) : null
          }
        />
      ) : (
        <TgCard hover={false} sx={{ p: 0, overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Descrição</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Vencimento</TableCell>
                  <TableCell>Meio</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell>Origem</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((c) => {
                  const st = statusOf(c);
                  return (
                    <TableRow key={c.id} hover sx={{ opacity: ['CANCELED', 'EXPIRED', 'FAILED'].includes(c.status) ? 0.6 : 1 }}>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                          <TgAvatar name={c.customer?.name} size={34} kind="contact" />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                              {c.customer?.name || '—'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                              {fmtPhone(c.customer?.phone)}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>
                        <Typography variant="body2" noWrap title={c.description}>
                          {c.description}
                        </Typography>
                        {c.error ? (
                          <Typography variant="caption" sx={{ color: 'error.main' }} noWrap display="block" title={c.error}>
                            {c.error}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                        {c.amount_label}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {c.due_label}
                        </Typography>
                        {c.status === 'PENDING' ? (
                          <Typography variant="caption" sx={{ color: c.days_to_due < 0 ? 'warning.main' : 'text.secondary' }}>
                            {dueText(c.days_to_due)}
                          </Typography>
                        ) : c.status === 'PAID' && c.paid_at ? (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            pago {fmtDateTime(c.paid_at)}
                            {c.paid_via ? ` · ${c.paid_via === 'manual' ? 'manual' : c.paid_via.toUpperCase()}` : ''}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          {c.pix ? (
                            <Tooltip title="Copiar PIX copia e cola">
                              <Chip
                                size="small"
                                icon={<IconQrcode size={13} />}
                                label="PIX"
                                onClick={() => copy(c.pix.code, 'Código PIX copiado.')}
                                sx={{
                                  height: 22,
                                  fontWeight: 700,
                                  borderRadius: 1.5,
                                  bgcolor: (t) => tint(t, 'success', 0.12),
                                  color: WA_DARK,
                                  '& .MuiChip-icon': { color: WA_DARK }
                                }}
                              />
                            </Tooltip>
                          ) : null}
                          {c.boleto ? (
                            <Tooltip title={c.boleto.url ? 'Abrir boleto' : 'Copiar linha digitável'}>
                              <Chip
                                size="small"
                                icon={<IconBarcode size={13} />}
                                label="Boleto"
                                onClick={() =>
                                  c.boleto.url
                                    ? window.open(c.boleto.url, '_blank', 'noopener')
                                    : copy(c.boleto.digitable || c.boleto.barcode, 'Linha digitável copiada.')
                                }
                                sx={{ height: 22, fontWeight: 700, borderRadius: 1.5 }}
                              />
                            </Tooltip>
                          ) : null}
                          {!c.pix && !c.boleto ? (
                            <Chip size="small" label={KIND[c.kind] || c.kind} sx={{ height: 22, borderRadius: 1.5 }} />
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <StatusChip map={STATUS} status={st} size="md" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {ORIGIN[c.origin] || c.origin}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Abrir conversa">
                          <IconButton size="small" onClick={() => openChat(c)}>
                            <IconMessage size={17} />
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, charge: c })} disabled={rowBusy[c.id]}>
                          {rowBusy[c.id] ? <CircularProgress size={14} /> : <IconDotsVertical size={17} />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            sx={{ px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mostrando {from}–{to} de {total.toLocaleString('pt-BR')}
            </Typography>
            <Pagination size="small" count={data.pages} page={data.page} onChange={(_, p) => setPage(p)} />
          </Stack>
        </TgCard>
      )}

      <Menu
        open={Boolean(menu)}
        anchorEl={menu?.anchor}
        onClose={() => setMenu(null)}
        slotProps={{ paper: { sx: { borderRadius: 2.5, minWidth: 230 } } }}
      >
        {menu?.charge?.status === 'PENDING'
          ? [
              <MenuItem
                key="check"
                onClick={() => {
                  const c = menu.charge;
                  setMenu(null);
                  act(c, 'check', (r) => (r?.status === 'PAID' ? 'Pagamento confirmado!' : 'Ainda não consta pagamento.'));
                }}
              >
                <ListItemIcon>
                  <IconRefresh size={18} />
                </ListItemIcon>
                <ListItemText>Verificar pagamento</ListItemText>
              </MenuItem>,
              <MenuItem
                key="resend"
                onClick={() => {
                  const c = menu.charge;
                  setMenu(null);
                  act(c, 'resend', 'Cobrança reenviada na conversa.');
                }}
              >
                <ListItemIcon>
                  <IconSend size={18} />
                </ListItemIcon>
                <ListItemText>Reenviar na conversa</ListItemText>
              </MenuItem>,
              canAdmin ? (
                <MenuItem
                  key="paid"
                  onClick={() => {
                    setConfirm({ kind: 'paid', charge: menu.charge });
                    setMenu(null);
                  }}
                >
                  <ListItemIcon>
                    <IconCircleCheck size={18} />
                  </ListItemIcon>
                  <ListItemText>Marcar como paga (manual)</ListItemText>
                </MenuItem>
              ) : null,
              <MenuItem
                key="cancel"
                onClick={() => {
                  setConfirm({ kind: 'cancel', charge: menu.charge });
                  setMenu(null);
                }}
                sx={{ color: 'error.main' }}
              >
                <ListItemIcon>
                  <IconX size={18} />
                </ListItemIcon>
                <ListItemText>Cancelar cobrança</ListItemText>
              </MenuItem>
            ]
          : null}
        {menu?.charge?.pix?.code ? (
          <MenuItem
            onClick={() => {
              copy(menu.charge.pix.code, 'Código PIX copiado.');
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <IconCopy size={18} />
            </ListItemIcon>
            <ListItemText>Copiar PIX copia e cola</ListItemText>
          </MenuItem>
        ) : null}
        {menu?.charge?.boleto?.url ? (
          <MenuItem
            onClick={() => {
              window.open(menu.charge.boleto.url, '_blank', 'noopener');
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <IconExternalLink size={18} />
            </ListItemIcon>
            <ListItemText>Abrir boleto</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>

      <ChargeDialog open={newDlg} onClose={() => setNewDlg(false)} products={products} onCreated={() => load({ silent: true })} />
      <SettingsDialog open={cfgDlg} onClose={() => setCfgDlg(false)} settings={settings} onSaved={setSettings} />
      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        danger={confirm?.kind === 'cancel'}
        title={confirm?.kind === 'cancel' ? 'Cancelar esta cobrança?' : 'Marcar como paga?'}
        message={
          confirm?.kind === 'cancel'
            ? `${confirm?.charge?.amount_label} de ${confirm?.charge?.customer?.name} será cancelada no gateway; o cliente não consegue mais pagar por ela.`
            : `Use quando o cliente pagou por fora (dinheiro, transferência). A assinatura avança e o recibo é enviado.`
        }
        confirmLabel={confirm?.kind === 'cancel' ? 'Cancelar cobrança' : 'Marcar como paga'}
        onConfirm={async () => {
          const { kind: k2, charge } = confirm;
          setConfirm(null);
          await act(charge, k2 === 'cancel' ? 'cancel' : 'mark-paid', k2 === 'cancel' ? 'Cobrança cancelada.' : 'Marcada como paga.');
        }}
      />
    </Box>
  );
}
