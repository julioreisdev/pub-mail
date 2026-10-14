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
  IconCreditCard,
  IconDotsVertical,
  IconLink,
  IconScale,
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
import { TgAvatar, TgCard, TgConfirmDialog, TgEmptyState, TgFilterBar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberChip, WaPageHeader, useWaSessions } from './waKit';
import { WA_DARK, errMsg, fmtDateTime, fmtPhone, tint } from './waShared';
import ChargeDialog from './crm/ChargeDialog';
import ReconcileDialog from './crm/ReconcileDialog';
import { CrmKpi, CrmModal, StatusChip, WaNumberFilter, chatUrl, dueText, useSessionFilter, useXs, waPrimaryBtn } from './crm/crmKit';
import { customSummary, useCustomFieldDefs } from './crm/customFields';

// ============================================================================
// WhatsApp → Cobranças: PIX/boleto enviados na conversa (manuais e recorrentes),
// situação, lembretes, confirmação automática. KPIs: a receber, em atraso,
// recebido no mês.
// Multi-número: cada cobrança sai por um número (`session_id` + `session`); `chat_id` = uuid da
// conversa (pode ser null em cobrança antiga). Filtro "Número" (?session=) e chip do número na linha.
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
const KIND = { pix: 'PIX', boleto: 'Boleto', both: 'PIX + Boleto', card: 'Cartão' };
const PAID_VIA = { pix: 'PIX', boleto: 'boleto', card: 'cartão', manual: 'manual', credit: 'crédito' };

// Cartão (Fase 4): cartão salvo (cobra sozinho; mostra tentativas/recusa) ou página segura do Asaas.
function CardChip({ c, h = 24 }) {
  if (!c.card) return null;
  const k = c.card;
  const label = k.saved
    ? k.error && c.status === 'PENDING'
      ? `Cartão recusado${k.attempts ? ` · ${k.attempts}×` : ''}`
      : 'Cartão salvo'
    : k.installments > 1
      ? `Cartão · ${k.installments}×`
      : 'Cartão';
  const tip = k.saved
    ? k.error && c.status === 'PENDING'
      ? `${k.error}${k.next_attempt_at ? ` — nova tentativa em ${fmtDateTime(k.next_attempt_at)}` : ''}`
      : k.next_attempt_at && c.status === 'PENDING'
        ? `Debitado sozinho em ${fmtDateTime(k.next_attempt_at)}`
        : 'Cobrado no cartão salvo do cliente'
    : k.url
      ? 'Abrir a página segura do cartão'
      : 'Cartão';
  return (
    <Tooltip title={tip}>
      <Chip
        size="small"
        icon={<IconCreditCard size={13} />}
        label={label}
        color={k.saved && k.error && c.status === 'PENDING' ? 'warning' : 'default'}
        onClick={k.url ? () => window.open(k.url, '_blank', 'noopener') : undefined}
        sx={{ height: h, fontWeight: 700, borderRadius: 1.5 }}
      />
    </Tooltip>
  );
}
/** Linha de aviso do cartão salvo recusado (em aberto): o erro + quando tenta de novo. Vazio nos outros casos. */
const cardHint = (c) => {
  const k = c.card;
  if (!k?.saved || !k.error || c.status !== 'PENDING') return '';
  const next = k.next_attempt_at ? ` · nova tentativa ${fmtDateTime(k.next_attempt_at)}` : '';
  return `Cartão recusado${k.attempts ? ` (${k.attempts}×)` : ''}: ${k.error}${next}`;
};
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
  ['expired', 'Cobrança expirada', 'Não é enviado automaticamente; fica disponível para o futuro.'],
  [
    'second_copy',
    '2ª via com juros e multa',
    'Reenvio de cobrança vencida. Extras: {{cobranca.valor_original}}, {{cobranca.multa}}, {{cobranca.juros}}, {{cobranca.dias_atraso}}.'
  ],
  ['trial_ending', 'Teste grátis acabando', '3 dias antes do fim do teste. Extras: {{assinatura.fim_teste}}.'],
  ['cancel_scheduled', 'Cancelamento agendado (fim do ciclo)', 'Extras: {{assinatura.fim}}, {{assinatura.fim_texto}}.'],
  ['canceled', 'Assinatura cancelada', ''],
  ['paused', 'Assinatura pausada', 'Extras: {{assinatura.pausa_ate}}.'],
  ['resumed', 'Assinatura retomada', ''],
  ['plan_changed', 'Troca de plano', ''],
  ['price_changed', 'Reajuste de valor', 'Extras: {{assinatura.reajuste}}.'],
  ['card', 'Cobrança no cartão (link seguro)', 'Cobrança só no cartão: vai no lugar da mensagem do PIX. Use {{cobranca.cartao_link}}.'],
  ['card_reminder', 'Lembrete da cobrança no cartão', ''],
  [
    'card_auto',
    'Aviso de débito no cartão salvo',
    'Só quando a equipe reenvia antes do vencimento. Extras: {{cartao.bandeira}}, {{cartao.final}}.'
  ],
  ['card_declined', 'Cartão recusado', 'A cada recusa do cartão salvo. Extras: {{cartao.bandeira}}, {{cartao.final}}, {{cartao.proxima}}.']
];
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];
const DEFAULT_REASONS = ['Está caro', 'Não uso mais', 'Mudei de serviço', 'Problemas no atendimento', 'Outro'];
const pct = (v, max) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 100) / 100)) : 0;
};
function SettingsDialog({ open, onClose, settings, onSaved }) {
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [newReason, setNewReason] = useState('');
  useEffect(() => {
    if (!open || !settings) return;
    const c = JSON.parse(JSON.stringify(settings));
    // campos da Fase 3 podem faltar se o back ainda for o antigo: completa com os padrões
    c.late_fee_percent = c.late_fee_percent ?? 2;
    c.interest_month_percent = c.interest_month_percent ?? 1;
    c.grace_days_default = c.grace_days_default ?? 0;
    c.cancel_reasons = Array.isArray(c.cancel_reasons) && c.cancel_reasons.length ? c.cancel_reasons : [...DEFAULT_REASONS];
    c.readjust = { enabled: false, percent: 0, month: 1, notify: true, ...(c.readjust || {}) };
    c.outbox_per_minute = c.outbox_per_minute ?? 20;
    c.texts = c.texts || {};
    setS(c);
    setNewReason('');
  }, [open, settings]);
  if (!s) return null;
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const setRem = (k, p) => setS((x) => ({ ...x, reminders: { ...x.reminders, [k]: { ...x.reminders[k], ...p } } }));
  const setText = (k, v) => setS((x) => ({ ...x, texts: { ...x.texts, [k]: v } }));
  const setReadjust = (p) => setS((x) => ({ ...x, readjust: { ...x.readjust, ...p } }));
  const addReason = () => {
    const r = newReason.trim().slice(0, 80);
    if (!r) return;
    setS((x) =>
      x.cancel_reasons.some((y) => y.toLowerCase() === r.toLowerCase())
        ? x
        : { ...x, cancel_reasons: [...x.cancel_reasons, r].slice(0, 20) }
    );
    setNewReason('');
  };
  const removeReason = (r) => setS((x) => ({ ...x, cancel_reasons: x.cancel_reasons.filter((y) => y !== r) }));
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
        texts: s.texts,
        late_fee_percent: pct(s.late_fee_percent, 20),
        interest_month_percent: pct(s.interest_month_percent, 20),
        grace_days_default: s.grace_days_default,
        cancel_reasons: s.cancel_reasons,
        readjust: {
          enabled: Boolean(s.readjust.enabled),
          percent: pct(s.readjust.percent, 100),
          month: s.readjust.month,
          notify: Boolean(s.readjust.notify)
        },
        outbox_per_minute: s.outbox_per_minute
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
    <CrmModal
      open={open}
      onClose={() => !busy && onClose()}
      title="Configurações de cobrança"
      subtitle="Validade, cobrança recorrente, lembretes, juros/multa, cancelamento e textos."
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
          <Box sx={{ width: { xs: '100%', sm: 220 } }}>{num('days_before_due', 'Dias antes do vencimento', 0, 30, '')}</Box>
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
                  sx={{ width: { xs: 132, sm: 168 }, flexShrink: 0 }}
                  inputProps={{ min: 1, style: { minWidth: 36 } }}
                  InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                />
              ) : null}
            </Stack>
          ))}
        </Box>
        <Divider>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Juros, multa e cancelamento
          </Typography>
        </Divider>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0,1fr))' } }}>
          <TextField
            size="small"
            type="number"
            label="Multa por atraso"
            value={s.late_fee_percent}
            onChange={(e) => set('late_fee_percent', e.target.value)}
            onBlur={(e) => set('late_fee_percent', pct(e.target.value, 20))}
            inputProps={{ min: 0, max: 20, step: 0.1, inputMode: 'decimal' }}
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            helperText="Cobrada uma vez na 2ª via (máx. 2% no CDC)."
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label="Juros ao mês"
            value={s.interest_month_percent}
            onChange={(e) => set('interest_month_percent', e.target.value)}
            onBlur={(e) => set('interest_month_percent', pct(e.target.value, 20))}
            inputProps={{ min: 0, max: 20, step: 0.1, inputMode: 'decimal' }}
            InputProps={{ endAdornment: <InputAdornment position="end">% a.m.</InputAdornment> }}
            helperText="Proporcional aos dias de atraso."
            fullWidth
          />
          {num(
            'grace_days_default',
            'Carência (dias)',
            0,
            90,
            'Dias depois de vencer antes de marcar a assinatura em atraso. O produto pode ter a sua.'
          )}
        </Box>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
            Motivos de cancelamento
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Aparecem na lista quando o cliente cancela pelo bot e quando a equipe cancela no painel.
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            {s.cancel_reasons.map((r) => (
              <Chip key={r} label={r} onDelete={() => removeReason(r)} size="small" sx={{ fontWeight: 600, maxWidth: '100%' }} />
            ))}
            {!s.cancel_reasons.length ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Sem motivos: o cliente responde com as próprias palavras.
              </Typography>
            ) : null}
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="Novo motivo"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value.slice(0, 80))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addReason();
                }
              }}
              sx={{ flex: 1, minWidth: 0 }}
            />
            <Button
              variant="outlined"
              onClick={addReason}
              disabled={!newReason.trim() || s.cancel_reasons.length >= 20}
              startIcon={<IconPlus size={16} />}
              sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
            >
              Adicionar
            </Button>
          </Stack>
        </Box>
        <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <FormControlLabel
            control={
              <Switch size="small" checked={Boolean(s.readjust.enabled)} onChange={(e) => setReadjust({ enabled: e.target.checked })} />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Reajuste anual automático
              </Typography>
            }
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: s.readjust.enabled ? 1.25 : 0 }}>
            Uma vez por ano, no mês escolhido, o valor das assinaturas ativas sobe o percentual abaixo.
          </Typography>
          {s.readjust.enabled ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
              <TextField
                size="small"
                type="number"
                label="Percentual"
                value={s.readjust.percent}
                onChange={(e) => setReadjust({ percent: e.target.value })}
                onBlur={(e) => setReadjust({ percent: pct(e.target.value, 100) })}
                inputProps={{ min: 0, max: 100, step: 0.1, inputMode: 'decimal' }}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                sx={{ width: { xs: '100%', sm: 150 } }}
              />
              <TextField
                select
                size="small"
                label="Mês do ano"
                value={s.readjust.month}
                onChange={(e) => setReadjust({ month: Number(e.target.value) })}
                sx={{ width: { xs: '100%', sm: 170 } }}
              >
                {MONTHS.map((m, i) => (
                  <MenuItem key={m} value={i + 1}>
                    {m}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Switch size="small" checked={Boolean(s.readjust.notify)} onChange={(e) => setReadjust({ notify: e.target.checked })} />
                }
                label={<Typography variant="body2">Avisar o cliente</Typography>}
              />
            </Stack>
          ) : null}
        </Box>
        <Divider>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Ritmo de envio
          </Typography>
        </Divider>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
          <Box sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0 }}>
            {num('outbox_per_minute', 'Envios por minuto (por número)', 1, 60, '')}
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', pt: { sm: 1 } }}>
            Cobranças recorrentes, lembretes e avisos automáticos (teste acabando, cancelamento, pausa, reajuste) entram numa fila e saem
            aos poucos, no máximo esse número por minuto em cada WhatsApp — rajadas de mensagens iguais fazem o WhatsApp restringir o
            número. Cobranças enviadas na hora pela equipe ou pelo bot não esperam a fila.
          </Typography>
        </Stack>
        <Divider>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Textos
          </Typography>
        </Divider>
        <Alert severity="info" icon={false} sx={{ borderRadius: 2, '& .MuiAlert-message': { overflowWrap: 'anywhere' } }}>
          <Typography variant="caption" component="div">
            <b>Cobrança:</b> {'{{cliente.primeiro_nome}}'}, {'{{cliente.nome}}'}, {'{{cobranca.valor}}'}, {'{{cobranca.descricao}}'},{' '}
            {'{{cobranca.vencimento}}'}, {'{{cobranca.pix}}'}, {'{{cobranca.boleto_link}}'}, {'{{cobranca.boleto_codigo}}'},{' '}
            {'{{cobranca.link}}'} (página com todos os meios de pagamento), {'{{cobranca.cartao_link}}'}.
          </Typography>
          <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
            <b>Assinatura:</b> {'{{assinatura.produto}}'}, {'{{assinatura.valor}}'}, {'{{assinatura.vencimento}}'},{' '}
            {'{{assinatura.status}}'}, {'{{assinatura.fim}}'}, {'{{assinatura.fim_texto}}'}, {'{{assinatura.pausa_ate}}'},{' '}
            {'{{assinatura.fim_teste}}'}, {'{{assinatura.reajuste}}'}.
          </Typography>
        </Alert>
        {TEXT_FIELDS.map(([k, label, help]) => (
          <TextField
            key={k}
            size="small"
            label={label}
            value={s.texts[k] ?? ''}
            onChange={(e) => setText(k, e.target.value.slice(0, 1500))}
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            helperText={help || undefined}
          />
        ))}
      </Stack>
    </CrmModal>
  );
}

// ============================================================================
export default function WhatsAppCharges() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAdmin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const xs = useXs();
  const { sessions } = useWaSessions(30000);
  const { value: sessionId, set: setSessionId, multi } = useSessionFilter(sessions);
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
  const [recDlg, setRecDlg] = useState(false);
  const [rowBusy, setRowBusy] = useState({});
  const [runBusy, setRunBusy] = useState(false);
  const { defs: cfDefs } = useCustomFieldDefs('charge'); // Fase 7: valores dos campos personalizados na linha
  const seqRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, kind, origin, pageSize, sessionId]);
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
            session_id: sessionId || undefined,
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
    [debouncedQ, status, kind, origin, sessionId, page, pageSize]
  );
  useEffect(() => {
    load();
  }, [load]);

  const patchRow = (c) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === c.id ? { ...x, ...c } : x)) }));
  // `body` opcional (ex.: resend { kind }) — troca o meio e reemite no gateway
  const act = async (c, path, okMsg, body) => {
    setRowBusy((m) => ({ ...m, [c.id]: true }));
    try {
      const r = await post(`/whatsapp/charges/${c.id}/${path}`, body);
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
  const openChat = (c) => {
    if (!c.chat_id) return toast.error('Esta cobrança não tem conversa aberta neste número.');
    return navigate(chatUrl(c.chat_id));
  };

  const k = data.kpis;
  const items = data.items;
  const total = data.total;
  const from = total ? (data.page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, data.page * pageSize);
  const filtered = Boolean(debouncedQ || status !== 'all' || kind !== 'all' || origin !== 'all' || sessionId);

  return (
    <Box>
      <WaPageHeader
        icon={IconReceipt2}
        title="Cobranças"
        subtitle="PIX e boleto enviados na conversa, com lembretes e confirmação automática."
        sx={{ mb: 2.5 }}
        action={
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
            sx={{
              width: { xs: '100%', md: 'auto' },
              '& .MuiButton-root': { minHeight: 40, width: { xs: '100%', md: 'auto' } },
              '& > *': { flex: { xs: '1 1 45%', md: '0 0 auto' } }
            }}
          >
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
                {settings?.providers?.card || settings?.providers?.pix === 'asaas' || settings?.providers?.boleto === 'asaas' ? (
                  <Tooltip title="Compara as cobranças do Asaas com as do Pub Mail e corrige o que ficou diferente.">
                    <Button
                      variant="outlined"
                      startIcon={<IconScale size={18} />}
                      onClick={() => setRecDlg(true)}
                      sx={{ fontWeight: 700, borderRadius: 2 }}
                    >
                      Conciliar
                    </Button>
                  </Tooltip>
                ) : null}
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
          Nenhum gateway de pagamento ativo. Configure em <strong>Configurações → Pagamentos</strong> (Mercado Pago, PushinPay ou Asaas)
          para gerar PIX, boleto ou cartão.
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
        <Box sx={{ display: { xs: 'grid', md: 'contents' }, gap: 1.25, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
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
            <MenuItem value="card">Cartão</MenuItem>
          </TextField>
          <TextField select size="small" label="Origem" value={origin} onChange={(e) => setOrigin(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="all">Todas</MenuItem>
            <MenuItem value="manual">Manual</MenuItem>
            <MenuItem value="recurring">Recorrente</MenuItem>
            <MenuItem value="bot">Bot</MenuItem>
          </TextField>
          <WaNumberFilter sessions={sessions} value={sessionId} onChange={setSessionId} sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }} />
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
        </Box>
        <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
        <Tooltip title="Atualizar">
          <Box component="span" sx={{ alignSelf: { xs: 'flex-end', md: 'center' } }}>
            <IconButton onClick={() => load()} disabled={loading} aria-label="Atualizar">
              <IconRefresh size={18} />
            </IconButton>
          </Box>
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
          {xs ? (
            <Box>
              {items.map((c) => {
                const st = statusOf(c);
                return (
                  <Box
                    key={c.id}
                    sx={{
                      p: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      opacity: ['CANCELED', 'EXPIRED', 'FAILED'].includes(c.status) ? 0.6 : 1
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <TgAvatar name={c.customer?.name} size={40} kind="contact" />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between">
                          <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
                            {c.customer?.name || '—'}
                          </Typography>
                          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, flexShrink: 0 }}>
                            {c.amount_label}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                            {fmtPhone(c.customer?.phone)}
                          </Typography>
                          {multi && c.session ? <WaNumberChip session={c.session} /> : null}
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                          {c.description}
                        </Typography>
                        {cfDefs.length && customSummary(cfDefs, c.custom) ? (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', overflowWrap: 'anywhere' }}>
                            {customSummary(cfDefs, c.custom)}
                          </Typography>
                        ) : null}
                        {c.error ? (
                          <Typography variant="caption" sx={{ color: 'error.main', display: 'block', overflowWrap: 'anywhere' }}>
                            {c.error}
                          </Typography>
                        ) : null}
                        {cardHint(c) ? (
                          <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', overflowWrap: 'anywhere' }}>
                            {cardHint(c)}
                          </Typography>
                        ) : null}
                        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                          <StatusChip map={STATUS} status={st} size="md" />
                          {c.pix ? (
                            <Chip
                              size="small"
                              icon={<IconQrcode size={13} />}
                              label="PIX"
                              onClick={() => copy(c.pix.code, 'Código PIX copiado.')}
                              sx={{
                                height: 24,
                                fontWeight: 700,
                                borderRadius: 1.5,
                                bgcolor: (t) => tint(t, 'success', 0.12),
                                color: WA_DARK,
                                '& .MuiChip-icon': { color: WA_DARK }
                              }}
                            />
                          ) : null}
                          {c.boleto ? (
                            <Chip
                              size="small"
                              icon={<IconBarcode size={13} />}
                              label="Boleto"
                              onClick={() =>
                                c.boleto.url
                                  ? window.open(c.boleto.url, '_blank', 'noopener')
                                  : copy(c.boleto.digitable || c.boleto.barcode, 'Linha digitável copiada.')
                              }
                              sx={{ height: 24, fontWeight: 700, borderRadius: 1.5 }}
                            />
                          ) : null}
                          <CardChip c={c} />
                          {!c.pix && !c.boleto && !c.card ? (
                            <Chip size="small" label={KIND[c.kind] || c.kind} sx={{ height: 24, borderRadius: 1.5 }} />
                          ) : null}
                          <Chip
                            size="small"
                            variant="outlined"
                            label={ORIGIN[c.origin] || c.origin}
                            sx={{ height: 24, borderRadius: 1.5 }}
                          />
                        </Stack>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'text.secondary' }}>
                          Vence <b>{c.due_label}</b>
                          {c.status === 'PENDING' ? (
                            <Box component="span" sx={{ color: c.days_to_due < 0 ? 'warning.main' : 'inherit' }}>
                              {' '}
                              · {dueText(c.days_to_due)}
                            </Box>
                          ) : c.status === 'PAID' && c.paid_at ? (
                            <>
                              {' '}
                              · pago {fmtDateTime(c.paid_at)}
                              {c.paid_via ? ` · ${PAID_VIA[c.paid_via] || c.paid_via}` : ''}
                            </>
                          ) : null}
                        </Typography>
                      </Box>
                      <Stack spacing={0.25} sx={{ flexShrink: 0, mr: -0.5, mt: -0.5 }}>
                        <IconButton onClick={() => openChat(c)} disabled={!c.chat_id} aria-label="Abrir conversa">
                          <IconMessage size={19} />
                        </IconButton>
                        <IconButton
                          onClick={(e) => setMenu({ anchor: e.currentTarget, charge: c })}
                          disabled={rowBusy[c.id]}
                          aria-label="Mais ações"
                        >
                          {rowBusy[c.id] ? <CircularProgress size={16} /> : <IconDotsVertical size={19} />}
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          ) : (
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
                              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                                  {fmtPhone(c.customer?.phone)}
                                </Typography>
                                {multi && c.session ? <WaNumberChip session={c.session} /> : null}
                              </Stack>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          <Typography variant="body2" noWrap title={c.description}>
                            {c.description}
                          </Typography>
                          {cfDefs.length && customSummary(cfDefs, c.custom) ? (
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary' }}
                              noWrap
                              display="block"
                              title={customSummary(cfDefs, c.custom)}
                            >
                              {customSummary(cfDefs, c.custom)}
                            </Typography>
                          ) : null}
                          {c.error ? (
                            <Typography variant="caption" sx={{ color: 'error.main' }} noWrap display="block" title={c.error}>
                              {c.error}
                            </Typography>
                          ) : null}
                          {cardHint(c) ? (
                            <Typography variant="caption" sx={{ color: 'warning.main' }} noWrap display="block" title={cardHint(c)}>
                              {cardHint(c)}
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
                              {c.paid_via ? ` · ${PAID_VIA[c.paid_via] || c.paid_via}` : ''}
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
                            <CardChip c={c} h={22} />
                            {!c.pix && !c.boleto && !c.card ? (
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
                          <Tooltip title={c.chat_id ? 'Abrir conversa' : 'Sem conversa aberta neste número'}>
                            <span>
                              <IconButton size="small" onClick={() => openChat(c)} disabled={!c.chat_id} aria-label="Abrir conversa">
                                <IconMessage size={17} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <IconButton
                            size="small"
                            onClick={(e) => setMenu({ anchor: e.currentTarget, charge: c })}
                            disabled={rowBusy[c.id]}
                            aria-label="Ações da cobrança"
                          >
                            {rowBusy[c.id] ? <CircularProgress size={14} /> : <IconDotsVertical size={17} />}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2, py: 1.25, borderTop: { sm: '1px solid' }, borderColor: 'divider' }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mostrando {from}–{to} de {total.toLocaleString('pt-BR')}
            </Typography>
            <Pagination
              size={xs ? 'medium' : 'small'}
              count={data.pages}
              page={data.page}
              onChange={(_, p) => setPage(p)}
              siblingCount={xs ? 0 : 1}
            />
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
                <ListItemText>Reenviar na conversa (mesmo meio)</ListItemText>
              </MenuItem>,
              // trocar o meio: reemite no gateway e manda de novo (cartão recusado → PIX/boleto; PIX vencido → cartão…)
              <MenuItem
                key="resend-pix"
                onClick={() => {
                  const c = menu.charge;
                  setMenu(null);
                  act(c, 'resend', 'Cobrança reenviada por PIX.', { kind: 'pix' });
                }}
              >
                <ListItemIcon>
                  <IconQrcode size={18} />
                </ListItemIcon>
                <ListItemText>Reenviar por PIX</ListItemText>
              </MenuItem>,
              settings?.boleto_available ? (
                <MenuItem
                  key="resend-boleto"
                  onClick={() => {
                    const c = menu.charge;
                    setMenu(null);
                    act(c, 'resend', 'Cobrança reenviada por boleto.', { kind: 'boleto' });
                  }}
                >
                  <ListItemIcon>
                    <IconBarcode size={18} />
                  </ListItemIcon>
                  <ListItemText>Reenviar por boleto</ListItemText>
                </MenuItem>
              ) : null,
              settings?.card_available ? (
                <MenuItem
                  key="resend-card"
                  onClick={() => {
                    const c = menu.charge;
                    setMenu(null);
                    act(c, 'resend', 'Link do cartão enviado na conversa.', { kind: 'card' });
                  }}
                >
                  <ListItemIcon>
                    <IconCreditCard size={18} />
                  </ListItemIcon>
                  <ListItemText primary="Reenviar com link do cartão" secondary="O cliente digita o cartão na página segura" />
                </MenuItem>
              ) : null,
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
        {menu?.charge?.pay_link ? (
          <MenuItem
            onClick={() => {
              copy(menu.charge.pay_link, 'Link de pagamento copiado.');
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <IconLink size={18} />
            </ListItemIcon>
            <ListItemText primary="Copiar link de pagamento" secondary="Página com PIX, boleto e cartão" />
          </MenuItem>
        ) : null}
        {menu?.charge?.card?.url && menu?.charge?.status === 'PENDING' ? (
          <MenuItem
            onClick={() => {
              window.open(menu.charge.card.url, '_blank', 'noopener');
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <IconCreditCard size={18} />
            </ListItemIcon>
            <ListItemText>Abrir página do cartão</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>

      <ChargeDialog open={newDlg} onClose={() => setNewDlg(false)} products={products} onCreated={() => load({ silent: true })} />
      <SettingsDialog open={cfgDlg} onClose={() => setCfgDlg(false)} settings={settings} onSaved={setSettings} />
      <ReconcileDialog open={recDlg} onClose={() => setRecDlg(false)} onFixed={() => load({ silent: true })} />
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
