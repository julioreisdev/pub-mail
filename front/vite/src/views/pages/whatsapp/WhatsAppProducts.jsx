import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconBan,
  IconBellRinging,
  IconCalendarEvent,
  IconClockHour4,
  IconRepeat,
  IconCalendarPause,
  IconCheck,
  IconCreditCard,
  IconGift,
  IconLockAccess,
  IconPackage,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTag,
  IconTicket,
  IconTrash,
  IconUsers
} from '@tabler/icons-react';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { get, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import { TgCard, TgCardGridSkeleton, TgConfirmDialog, TgEmptyState } from 'views/pages/telegram/ui';
import { WaPageHeader } from './waKit';
import { WA_DARK, errMsg, tint } from './waShared';
import {
  BILLING_OPTIONS,
  CANCEL_POLICIES,
  CollapsibleSection,
  CrmModal,
  MoneyField,
  billingFromMonths,
  billingLabel,
  billingMonths,
  billingShort,
  fmtDateBR,
  formatBRL,
  isRecurring,
  waPrimaryBtn
} from './crm/crmKit';
import CouponDialog, { couponDurationLabel } from './crm/CouponDialog';
import EntitlementRulesEditor, { rulesOf, rulesPayload, rulesSummary } from './crm/EntitlementRulesEditor';
import CustomFieldsInputs from './crm/CustomFieldsInputs';
import {
  customErrorsFrom,
  customErrorsText,
  customFormValues,
  customPayload,
  useCustomFieldDefs,
  validateCustomLocal
} from './crm/customFields';

// ============================================================================
// WhatsApp → Produtos: catálogo do que a empresa vende (produto, serviço, plano).
// Cada item tem preço e tipo de cobrança; é usado nas assinaturas dos clientes e
// nas cobranças. Fase 3: teste grátis, carência, 1ª cobrança proporcional,
// política de cancelamento, régua própria. Aba Cupons (descontos).
// Criar/editar/excluir: dono ou admin.
// ============================================================================

const REMINDER_ROWS = [
  ['before', 'Antes do vencimento', 'dias antes', 1, 15],
  ['due', 'No dia do vencimento', null],
  ['after', '1º lembrete de atraso', 'dias depois', 1, 30],
  ['after2', '2º lembrete de atraso', 'dias depois', 2, 60]
];
const DEFAULT_REMINDERS = {
  before: { enabled: true, days: 3 },
  due: { enabled: true },
  after: { enabled: true, days: 1 },
  after2: { enabled: true, days: 5 }
};
const cloneRules = (r) => JSON.parse(JSON.stringify(r || DEFAULT_REMINDERS));

// ----------------------------------------------------------------------------
// Fase 6 — tipo do item (produto / plano / serviço agendável) e regras de agendamento
// ----------------------------------------------------------------------------
const KINDS = [
  { value: 'product', label: 'Produto', icon: IconPackage, hint: 'Venda avulsa (cobra uma vez).' },
  { value: 'plan', label: 'Plano', icon: IconRepeat, hint: 'Assinatura recorrente (mensal, anual…).' },
  { value: 'service', label: 'Serviço', icon: IconCalendarEvent, hint: 'Agendável: tem duração e entra na Agenda.' }
];
const kindOf = (p) => (['product', 'plan', 'service'].includes(p?.kind) ? p.kind : isRecurring(p?.billing) ? 'plan' : 'product');
const BOOKING_PAYMENTS = [
  { value: 'on_site', label: 'No local', hint: 'Agenda sem cobrança; o cliente paga no atendimento.' },
  { value: 'on_booking', label: 'Na reserva', hint: 'Cobra o valor cheio por PIX; o horário fica reservado até o prazo.' },
  { value: 'deposit', label: 'Sinal', hint: 'Cobra um sinal na reserva; o resto no local.' },
  { value: 'included', label: 'Incluso no plano', hint: 'Grátis para quem assina um plano que inclui; os outros pagam na reserva.' }
];
const LATE_CANCEL = [
  { value: 'credit', label: 'Vira crédito', hint: 'O valor pago fica de crédito para o próximo agendamento.' },
  { value: 'keep', label: 'Retém o valor', hint: 'Cancelou em cima da hora, perde o que pagou.' },
  { value: 'refund', label: 'Estorna', hint: 'Devolve no gateway (quando suportado; senão vira crédito).' }
];
const DEFAULT_BOOKING = {
  payment: 'on_site',
  deposit_cents: 0,
  pay_within_minutes: 30,
  min_notice_hours: 2,
  max_days_ahead: 60,
  cancel_free_hours: 24,
  cancel_policy: 'credit',
  reschedule_limit: 2,
  confirm: 'ask_d1',
  requires_customer: false,
  address: ''
};
const bookingFrom = (b) => ({ ...DEFAULT_BOOKING, ...(b && typeof b === 'object' ? b : {}), address: b?.address || '' });
const bookingSummary = (b) =>
  [
    BOOKING_PAYMENTS.find((x) => x.value === b.payment)?.label,
    `cancela grátis até ${b.cancel_free_hours} h antes`,
    b.confirm === 'ask_d1' ? 'pede confirmação na véspera' : null
  ]
    .filter(Boolean)
    .join(' · ');
const fmtMinutes = (m) => {
  const n = Number(m) || 0;
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  return n % 60 ? `${h} h ${n % 60} min` : `${h} h`;
};

const empty = () => ({
  name: '',
  description: '',
  price_cents: 0,
  billing: 'monthly',
  active: true,
  category: '',
  trial_days: 0,
  grace_days: 0,
  prorate: true,
  cancel_policy: 'end_of_cycle',
  charge_days_before: '',
  own_rules: false,
  reminder_rules: null,
  installments_max: 1,
  ent_rules: [],
  kind: 'plan',
  duration_minutes: 60,
  buffer_after_minutes: 0,
  capacity: 1,
  booking: bookingFrom(null),
  included_in_plans: [],
  custom: {},
  _custom0: {}
});

/** Produto (como vem do back) → estado do formulário. */
const formFrom = (p) => {
  // o intervalo em meses manda; `billing` fica por compat (null = deriva do billing)
  const months = p.billing_interval_months || billingMonths(p.billing);
  const billing = isRecurring(p.billing) || p.billing_interval_months ? billingFromMonths(months) : p.billing || 'once';
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    price_cents: p.price_cents,
    billing,
    active: p.active,
    category: p.category || '',
    trial_days: p.trial_days || 0,
    grace_days: p.grace_days || 0,
    prorate: p.prorate !== false,
    cancel_policy: p.cancel_policy === 'immediate' ? 'immediate' : 'end_of_cycle',
    charge_days_before: p.charge_days_before == null ? '' : String(p.charge_days_before),
    own_rules: Boolean(p.reminder_rules),
    reminder_rules: p.reminder_rules ? cloneRules({ ...DEFAULT_REMINDERS, ...p.reminder_rules }) : null,
    installments_max: p.installments_max || 1,
    ent_rules: rulesOf(p.entitlement),
    kind: kindOf(p),
    duration_minutes: p.duration_minutes || 60,
    buffer_after_minutes: p.buffer_after_minutes || 0,
    capacity: p.capacity || 1,
    booking: bookingFrom(p.booking),
    included_in_plans: Array.isArray(p.included_in_plans)
      ? p.included_in_plans.map((x) => ({ plan_id: x.plan_id, uses_per_cycle: x.uses_per_cycle || 1 }))
      : [],
    // Fase 7: campos personalizados (valores crus; o payload manda só as chaves definidas)
    custom: { ...(p.custom || {}) },
    _custom0: { ...(p.custom || {}) }
  };
};

const intOr = (v, min, max, def) => {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// ----------------------------------------------------------------------------
// Cartão de produto
// ----------------------------------------------------------------------------
function MiniChip({ icon: Icon, label, token, title }) {
  return (
    <Tooltip title={title || ''} disableHoverListener={!title}>
      <Chip
        size="small"
        icon={Icon ? <Icon size={12} /> : undefined}
        label={label}
        sx={{
          height: 22,
          fontWeight: 700,
          borderRadius: 1.5,
          maxWidth: '100%',
          ...(token ? { color: `${token}.main`, bgcolor: (t) => tint(t, token, 0.12), '& .MuiChip-icon': { color: `${token}.main` } } : {})
        }}
      />
    </Tooltip>
  );
}

function ProductCard({ p, canEdit, onEdit, onToggle, onRemove, busy }) {
  const recurring = isRecurring(p.billing);
  const kind = kindOf(p);
  const KindIcon = KINDS.find((k) => k.value === kind)?.icon || IconPackage;
  const accessRules = recurring ? rulesOf(p.entitlement) : [];
  return (
    <TgCard hover={false} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, opacity: p.active ? 1 : 0.65, minWidth: 0 }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: WA_DARK,
            bgcolor: (t) => tint(t, 'success', 0.14),
            flexShrink: 0
          }}
        >
          <KindIcon size={20} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }} noWrap title={p.name}>
            {p.name}
          </Typography>
          <Typography sx={{ fontWeight: 700, color: WA_DARK, fontVariantNumeric: 'tabular-nums' }}>
            {formatBRL(p.price_cents)}
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {billingShort(p.billing)}
            </Typography>
          </Typography>
        </Box>
        {canEdit ? (
          <Tooltip title={p.active ? 'Ativo — disponível para novas assinaturas' : 'Inativo — não aparece para novas assinaturas'}>
            <Switch size="small" checked={p.active} onChange={(e) => onToggle(e.target.checked)} disabled={busy} />
          </Tooltip>
        ) : null}
      </Stack>
      {p.description ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {p.description}
        </Typography>
      ) : null}
      {kind === 'service' ? (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          <MiniChip icon={IconClockHour4} label={fmtMinutes(p.duration_minutes)} token="info" title="Duração do atendimento" />
          {p.buffer_after_minutes ? (
            <MiniChip label={`+${p.buffer_after_minutes} min intervalo`} title="Intervalo depois do atendimento" />
          ) : null}
          {p.capacity > 1 ? (
            <MiniChip icon={IconUsers} label={`${p.capacity} por horário`} title="Capacidade (vagas no mesmo horário)" />
          ) : null}
          {p.booking?.payment && p.booking.payment !== 'on_site' ? (
            <MiniChip
              icon={IconCreditCard}
              label={BOOKING_PAYMENTS.find((x) => x.value === p.booking.payment)?.label || p.booking.payment}
              token="success"
              title="Pagamento do agendamento"
            />
          ) : null}
        </Stack>
      ) : null}
      {!recurring && p.installments_max > 1 ? (
        <Stack direction="row" spacing={0.5}>
          <MiniChip icon={IconCreditCard} label={`Até ${p.installments_max}× no cartão`} token="info" />
        </Stack>
      ) : null}
      {recurring &&
      (p.trial_days > 0 ||
        p.cancel_policy === 'immediate' ||
        p.grace_days > 0 ||
        p.prorate === false ||
        p.reminder_rules ||
        accessRules.length) ? (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {p.trial_days > 0 ? <MiniChip icon={IconGift} label={`${p.trial_days} dias grátis`} token="info" /> : null}
          {p.cancel_policy === 'immediate' ? (
            <MiniChip icon={IconBan} label="Cancela na hora" token="warning" title="Cancelamento imediato (sem esperar o fim do ciclo)" />
          ) : null}
          {p.grace_days > 0 ? (
            <MiniChip
              icon={IconCalendarPause}
              label={`Carência ${p.grace_days} dia${p.grace_days === 1 ? '' : 's'}`}
              token="info"
              title="Dias depois do vencimento antes de marcar em atraso"
            />
          ) : null}
          {p.prorate === false ? <MiniChip label="Sem proporcional" title="A 1ª cobrança é sempre o valor cheio" /> : null}
          {p.reminder_rules ? <MiniChip icon={IconBellRinging} label="Régua própria" title="Lembretes próprios deste produto" /> : null}
          {accessRules.length ? (
            <MiniChip
              icon={IconLockAccess}
              label={`${accessRules.length} acesso${accessRules.length === 1 ? '' : 's'} liberado${accessRules.length === 1 ? '' : 's'}`}
              token="success"
              title={`Ao pagar, libera: ${rulesSummary(accessRules).replace(/^\d+ acessos?: /, '')}`}
            />
          ) : null}
        </Stack>
      ) : null}
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 'auto', pt: 0.5, minWidth: 0 }}>
        <Chip
          size="small"
          label={kind === 'service' ? 'Serviço' : kind === 'plan' ? billingLabel(p.billing) : 'Produto'}
          sx={{ height: 22, fontWeight: 700, borderRadius: 1.5 }}
        />
        {p.category ? (
          <Chip
            size="small"
            icon={<IconTag size={12} />}
            label={p.category}
            variant="outlined"
            sx={{ height: 22, fontWeight: 600, borderRadius: 1.5, minWidth: 0, maxWidth: 140 }}
          />
        ) : null}
        <Chip
          size="small"
          icon={<IconUsers size={13} />}
          label={`${p.subscribers}`}
          title={`${p.subscribers} cliente${p.subscribers === 1 ? '' : 's'}`}
          variant="outlined"
          sx={{ height: 22, fontWeight: 600, borderRadius: 1.5 }}
        />
        <Box sx={{ flex: 1 }} />
        {canEdit ? (
          <>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={onEdit} disabled={busy} aria-label="Editar produto">
                <IconPencil size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title={p.subscribers ? 'Há clientes com este produto — desative em vez de excluir' : 'Excluir'}>
              <span>
                <IconButton size="small" onClick={onRemove} disabled={busy || p.subscribers > 0} aria-label="Excluir produto">
                  <IconTrash size={16} />
                </IconButton>
              </span>
            </Tooltip>
          </>
        ) : null}
      </Stack>
    </TgCard>
  );
}

// ----------------------------------------------------------------------------
// Cartão de escolha (política de cancelamento)
// ----------------------------------------------------------------------------
function PolicyCard({ selected, title, hint, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        flex: 1,
        minWidth: 0,
        p: 1.25,
        borderRadius: 2,
        textAlign: 'left',
        display: 'block',
        border: '1.5px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? (t) => tint(t, 'primary', 0.08) : 'transparent'
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, color: selected ? 'primary.main' : 'text.primary' }}>
        {selected ? '● ' : '○ '}
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
        {hint}
      </Typography>
    </ButtonBase>
  );
}

// ----------------------------------------------------------------------------
// Diálogo do produto
// ----------------------------------------------------------------------------
function ProductDialog({ dlg, setDlg, busy, onSave, orgSettings, plans = [], cfDefs = [] }) {
  const open = Boolean(dlg);
  const d = dlg || empty();
  const recurring = isRecurring(d.billing);
  const set = (k, v) => setDlg((x) => ({ ...x, [k]: v }));
  const setBooking = (k, v) => setDlg((x) => ({ ...x, booking: { ...x.booking, [k]: v } }));
  const setKind = (k) =>
    setDlg((x) => ({
      ...x,
      kind: k,
      billing: k === 'plan' ? (isRecurring(x.billing) ? x.billing : 'monthly') : 'once'
    }));
  const isService = d.kind === 'service';
  const planOptions = plans.filter((p) => p.id !== d.id);
  const setRule = (k, p) => setDlg((x) => ({ ...x, reminder_rules: { ...x.reminder_rules, [k]: { ...x.reminder_rules[k], ...p } } }));
  const orgDays = orgSettings?.days_before_due;
  const orgGrace = orgSettings?.grace_days_default;

  const subSummary = [
    d.trial_days > 0 ? `${d.trial_days} dias grátis` : 'sem teste grátis',
    d.prorate ? '1ª proporcional' : '1ª cheia',
    d.grace_days > 0 ? `carência ${d.grace_days}d` : null,
    d.charge_days_before !== '' ? `cobra ${d.charge_days_before}d antes` : null
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <CrmModal
      open={open}
      onClose={() => !busy && setDlg(null)}
      title={d.id ? 'Editar produto' : 'Novo produto'}
      subtitle="Produto, serviço ou plano. O valor é o preço de tabela; na assinatura dá para ajustar por cliente."
      maxWidth="sm"
      disableClose={busy}
      footer={
        <>
          <Button color="inherit" onClick={() => setDlg(null)} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={onSave}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
            sx={waPrimaryBtn}
          >
            {d.id ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      {open ? (
        <Stack spacing={1.5}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={d.kind}
            onChange={(_, v) => v && setKind(v)}
            sx={{ display: 'flex', '& .MuiToggleButton-root': { flex: 1, textTransform: 'none', fontWeight: 700, gap: 0.75 } }}
          >
            {KINDS.map((k) => (
              <ToggleButton key={k.value} value={k.value}>
                <k.icon size={16} /> {k.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: '4px !important' }}>
            {KINDS.find((k) => k.value === d.kind)?.hint}
          </Typography>
          <TextField
            size="small"
            label="Nome"
            value={d.name}
            onChange={(e) => set('name', e.target.value.slice(0, 120))}
            fullWidth
            autoFocus={!d.id}
            placeholder="Ex.: Plano Premium, Consultoria, Mensalidade"
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <MoneyField
              label="Preço"
              valueCents={d.price_cents}
              onChange={(c) => set('price_cents', c)}
              helperText="Digite só números: 1990 vira R$ 19,90"
            />
            {d.kind === 'plan' ? (
              <TextField
                select
                size="small"
                label="Cobrança"
                value={d.billing}
                onChange={(e) => set('billing', e.target.value)}
                fullWidth
                helperText={`Repete a cada ${billingMonths(d.billing)} ${billingMonths(d.billing) === 1 ? 'mês' : 'meses'}`}
              >
                {BILLING_OPTIONS.filter((o) => o.value !== 'once').map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField size="small" label="Cobrança" value="Avulso (cobra uma vez)" fullWidth disabled helperText=" " />
            )}
          </Stack>
          {isService ? (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  size="small"
                  type="number"
                  label="Duração"
                  value={d.duration_minutes}
                  onChange={(e) => set('duration_minutes', e.target.value)}
                  onBlur={() => set('duration_minutes', intOr(d.duration_minutes, 5, 720, 60))}
                  inputProps={{ min: 5, max: 720, inputMode: 'numeric' }}
                  InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
                  helperText="Tempo do atendimento (5 a 720)."
                  fullWidth
                />
                <TextField
                  size="small"
                  type="number"
                  label="Intervalo depois"
                  value={d.buffer_after_minutes}
                  onChange={(e) => set('buffer_after_minutes', e.target.value)}
                  onBlur={() => set('buffer_after_minutes', intOr(d.buffer_after_minutes, 0, 240, 0))}
                  inputProps={{ min: 0, max: 240, inputMode: 'numeric' }}
                  InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
                  helperText="Limpeza/preparo; o horário seguinte só abre depois."
                  fullWidth
                />
                <TextField
                  size="small"
                  type="number"
                  label="Capacidade"
                  value={d.capacity}
                  onChange={(e) => set('capacity', e.target.value)}
                  onBlur={() => set('capacity', intOr(d.capacity, 1, 200, 1))}
                  inputProps={{ min: 1, max: 200, inputMode: 'numeric' }}
                  helperText="Pessoas no mesmo horário (aula, turma)."
                  fullWidth
                />
              </Stack>
              <CollapsibleSection
                title="Agendamento: pagamento, prazos e cancelamento"
                summary={bookingSummary(d.booking)}
                defaultOpen={!d.id}
              >
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Pagamento
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gap: 1,
                        mt: 0.5,
                        gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2, minmax(0,1fr))' }
                      }}
                    >
                      {BOOKING_PAYMENTS.map((o) => (
                        <PolicyCard
                          key={o.value}
                          selected={d.booking.payment === o.value}
                          title={o.label}
                          hint={o.hint}
                          onClick={() => setBooking('payment', o.value)}
                        />
                      ))}
                    </Box>
                  </Box>
                  {d.booking.payment === 'deposit' ? (
                    <MoneyField
                      label="Valor do sinal"
                      valueCents={d.booking.deposit_cents}
                      onChange={(c) => setBooking('deposit_cents', c)}
                    />
                  ) : null}
                  {['on_booking', 'deposit', 'included'].includes(d.booking.payment) ? (
                    <TextField
                      size="small"
                      type="number"
                      label="Prazo para pagar"
                      value={d.booking.pay_within_minutes}
                      onChange={(e) => setBooking('pay_within_minutes', intOr(e.target.value || 5, 5, 1440, 30))}
                      InputProps={{ endAdornment: <InputAdornment position="end">min</InputAdornment> }}
                      helperText="Sem pagamento nesse tempo, a reserva expira e o horário é liberado."
                      fullWidth
                    />
                  ) : null}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      size="small"
                      type="number"
                      label="Antecedência mínima"
                      value={d.booking.min_notice_hours}
                      onChange={(e) => setBooking('min_notice_hours', intOr(e.target.value || 0, 0, 720, 2))}
                      InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
                      helperText="Não oferece horários antes disso."
                      fullWidth
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Agenda até"
                      value={d.booking.max_days_ahead}
                      onChange={(e) => setBooking('max_days_ahead', intOr(e.target.value || 1, 1, 365, 60))}
                      InputProps={{ endAdornment: <InputAdornment position="end">dias</InputAdornment> }}
                      helperText="Quão à frente o cliente pode marcar."
                      fullWidth
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      size="small"
                      type="number"
                      label="Cancela grátis até"
                      value={d.booking.cancel_free_hours}
                      onChange={(e) => setBooking('cancel_free_hours', intOr(e.target.value || 0, 0, 720, 24))}
                      InputProps={{ endAdornment: <InputAdornment position="end">h antes</InputAdornment> }}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Remarcações pelo cliente"
                      value={d.booking.reschedule_limit}
                      onChange={(e) => setBooking('reschedule_limit', intOr(e.target.value || 0, 0, 10, 2))}
                      helperText="A equipe pode remarcar sempre."
                      fullWidth
                    />
                  </Stack>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Cancelou depois do prazo
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }}>
                      {LATE_CANCEL.map((o) => (
                        <PolicyCard
                          key={o.value}
                          selected={d.booking.cancel_policy === o.value}
                          title={o.label}
                          hint={o.hint}
                          onClick={() => setBooking('cancel_policy', o.value)}
                        />
                      ))}
                    </Stack>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch
                      size="small"
                      checked={d.booking.confirm === 'ask_d1'}
                      onChange={(e) => setBooking('confirm', e.target.checked ? 'ask_d1' : 'none')}
                    />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Pedir confirmação na véspera
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        O lembrete pede "1 para confirmar, 2 para remarcar/cancelar".
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch
                      size="small"
                      checked={Boolean(d.booking.requires_customer)}
                      onChange={(e) => setBooking('requires_customer', e.target.checked)}
                    />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Exigir cadastro de cliente
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Desligado: quem agenda sem cadastro vira cliente automaticamente com o nome do contato.
                      </Typography>
                    </Box>
                  </Stack>
                  <TextField
                    size="small"
                    label="Endereço do atendimento (opcional)"
                    value={d.booking.address}
                    onChange={(e) => setBooking('address', e.target.value.slice(0, 255))}
                    helperText="Vai nas mensagens como {{agendamento.endereco}}."
                    fullWidth
                  />
                </Stack>
              </CollapsibleSection>
              <CollapsibleSection
                title="Incluso em planos"
                summary={
                  d.included_in_plans.length
                    ? d.included_in_plans
                        .map((x) => `${plans.find((p) => p.id === x.plan_id)?.name || 'Plano'} (${x.uses_per_cycle}×)`)
                        .join(' · ')
                    : 'Nenhum plano inclui este serviço'
                }
                defaultOpen={Boolean(d.included_in_plans.length)}
              >
                <Stack spacing={1}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Quem tem um destes planos ativos agenda sem pagar, até o número de usos por ciclo (depois cobra o normal). Use junto com
                    o pagamento "Incluso no plano".
                  </Typography>
                  {d.included_in_plans.map((x, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                      <TextField
                        select
                        size="small"
                        label="Plano"
                        value={x.plan_id}
                        onChange={(e) =>
                          set(
                            'included_in_plans',
                            d.included_in_plans.map((y, j) => (j === i ? { ...y, plan_id: e.target.value } : y))
                          )
                        }
                        sx={{ flex: 1, minWidth: 0 }}
                      >
                        {planOptions.map((p) => (
                          <MenuItem key={p.id} value={p.id}>
                            {p.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        type="number"
                        label="Usos/ciclo"
                        value={x.uses_per_cycle}
                        onChange={(e) =>
                          set(
                            'included_in_plans',
                            d.included_in_plans.map((y, j) =>
                              j === i ? { ...y, uses_per_cycle: intOr(e.target.value || 1, 1, 100, 1) } : y
                            )
                          )
                        }
                        sx={{ width: 110, flexShrink: 0 }}
                      />
                      <IconButton
                        size="small"
                        onClick={() =>
                          set(
                            'included_in_plans',
                            d.included_in_plans.filter((_, j) => j !== i)
                          )
                        }
                        aria-label="Remover plano"
                      >
                        <IconTrash size={16} />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button
                    size="small"
                    startIcon={<IconPlus size={15} />}
                    disabled={!planOptions.length}
                    onClick={() =>
                      set('included_in_plans', [
                        ...d.included_in_plans,
                        {
                          plan_id:
                            planOptions.find((p) => !d.included_in_plans.some((x) => x.plan_id === p.id))?.id || planOptions[0]?.id || '',
                          uses_per_cycle: 1
                        }
                      ])
                    }
                    sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                  >
                    {planOptions.length ? 'Adicionar plano' : 'Cadastre um plano primeiro'}
                  </Button>
                </Stack>
              </CollapsibleSection>
            </>
          ) : null}
          <TextField
            size="small"
            label="Descrição (opcional)"
            value={d.description}
            onChange={(e) => set('description', e.target.value.slice(0, 500))}
            fullWidth
            multiline
            minRows={2}
            maxRows={5}
          />
          <TextField
            size="small"
            label="Categoria (opcional)"
            value={d.category}
            onChange={(e) => set('category', e.target.value.slice(0, 64))}
            fullWidth
            placeholder="Ex.: Planos, Serviços, Acessórios"
          />
          {cfDefs.length ? (
            <CustomFieldsInputs
              defs={cfDefs}
              values={customFormValues(cfDefs, d.custom)}
              onChange={(v) => setDlg((x) => ({ ...x, custom: { ...x.custom, ...v }, _cfErr: null }))}
              errors={d._cfErr}
              disabled={busy}
            />
          ) : null}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch size="small" checked={d.active} onChange={(e) => set('active', e.target.checked)} />
            <Typography variant="body2">
              {d.active ? 'Ativo — disponível para novas assinaturas' : 'Inativo — fica escondido nas novas assinaturas'}
            </Typography>
          </Stack>

          {!recurring ? (
            <TextField
              select
              size="small"
              label="Parcelar no cartão em até"
              value={d.installments_max || 1}
              onChange={(e) => set('installments_max', Number(e.target.value))}
              fullWidth
              helperText="Só no cartão (Asaas). O cliente escolhe as parcelas na página de pagamento; parcela mínima de R$ 5,00."
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <MenuItem key={n} value={n}>
                  {n === 1 ? 'Sem parcelamento (à vista)' : `${n}×`}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          {recurring ? (
            <>
              <CollapsibleSection title="Assinatura: teste grátis, proporcional, carência" summary={subSummary}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      size="small"
                      type="number"
                      label="Dias grátis"
                      value={d.trial_days}
                      onChange={(e) => set('trial_days', intOr(e.target.value || 0, 0, 365, 0))}
                      inputProps={{ min: 0, max: 365, inputMode: 'numeric' }}
                      helperText="0 = sem teste. A 1ª cobrança vem depois do teste."
                      fullWidth
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Carência (dias)"
                      value={d.grace_days}
                      onChange={(e) => set('grace_days', intOr(e.target.value || 0, 0, 90, 0))}
                      inputProps={{ min: 0, max: 90, inputMode: 'numeric' }}
                      helperText={`Dias depois de vencer antes de marcar em atraso${orgGrace ? ` (padrão da empresa: ${orgGrace})` : ''}.`}
                      fullWidth
                    />
                  </Stack>
                  <TextField
                    size="small"
                    type="number"
                    label="Gerar a cobrança quantos dias antes"
                    value={d.charge_days_before}
                    onChange={(e) => set('charge_days_before', e.target.value === '' ? '' : String(intOr(e.target.value, 0, 30, 0)))}
                    inputProps={{ min: 0, max: 30, inputMode: 'numeric' }}
                    InputProps={{ endAdornment: <InputAdornment position="end">dias</InputAdornment> }}
                    helperText={`Vazio = o da empresa${orgDays != null ? ` (${orgDays} dias)` : ''}.`}
                    fullWidth
                  />
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Switch size="small" checked={d.prorate} onChange={(e) => set('prorate', e.target.checked)} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        1ª cobrança proporcional
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', pl: 5.5 }}>
                      {d.prorate
                        ? 'Quem entra no meio do ciclo paga só os dias até o 1º vencimento; depois, o valor cheio.'
                        : 'A 1ª cobrança é sempre o valor cheio, não importa o dia em que a pessoa entrou.'}
                    </Typography>
                  </Box>
                </Stack>
              </CollapsibleSection>

              <CollapsibleSection title="Cancelamento" summary={CANCEL_POLICIES.find((p) => p.value === d.cancel_policy)?.label}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  {CANCEL_POLICIES.map((p) => (
                    <PolicyCard
                      key={p.value}
                      selected={d.cancel_policy === p.value}
                      title={p.label}
                      hint={p.hint}
                      onClick={() => set('cancel_policy', p.value)}
                    />
                  ))}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                  Vale quando o cliente cancela pelo bot. No painel o atendente pode escolher outra na hora.
                </Typography>
              </CollapsibleSection>

              <CollapsibleSection
                title="Lembretes de cobrança"
                summary={d.own_rules ? 'Régua própria deste produto' : 'Usa a régua da empresa'}
              >
                <Stack spacing={1.25}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Switch
                      size="small"
                      checked={d.own_rules}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setDlg((x) => ({
                          ...x,
                          own_rules: on,
                          reminder_rules: on
                            ? x.reminder_rules || cloneRules(orgSettings?.reminders || DEFAULT_REMINDERS)
                            : x.reminder_rules
                        }));
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Régua própria
                    </Typography>
                  </Stack>
                  {!d.own_rules ? (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Desligado: usa os lembretes de WhatsApp → Cobranças → Configurar.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' } }}>
                      {REMINDER_ROWS.map(([k, label, unit, min, max]) => (
                        <Stack
                          key={k}
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 0 }}
                        >
                          <Switch
                            size="small"
                            checked={Boolean(d.reminder_rules?.[k]?.enabled)}
                            onChange={(e) => setRule(k, { enabled: e.target.checked })}
                          />
                          <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}>
                            {label}
                          </Typography>
                          {unit ? (
                            <TextField
                              size="small"
                              type="number"
                              value={d.reminder_rules?.[k]?.days ?? min}
                              onChange={(e) => setRule(k, { days: intOr(e.target.value || min, min, max, min) })}
                              sx={{ width: 120, flexShrink: 0 }}
                              inputProps={{ min, max, style: { minWidth: 30 } }}
                              InputProps={{ endAdornment: <InputAdornment position="end">{unit.split(' ')[0]}</InputAdornment> }}
                            />
                          ) : null}
                        </Stack>
                      ))}
                    </Box>
                  )}
                </Stack>
              </CollapsibleSection>

              <CollapsibleSection title="Ao pagar, liberar…" summary={rulesSummary(d.ent_rules)} defaultOpen={Boolean(d.ent_rules?.length)}>
                <EntitlementRulesEditor rules={d.ent_rules || []} onChange={(r) => set('ent_rules', r)} />
              </CollapsibleSection>
            </>
          ) : null}
        </Stack>
      ) : null}
    </CrmModal>
  );
}

// ----------------------------------------------------------------------------
// Cupons
// ----------------------------------------------------------------------------
function couponState(c) {
  if (!c.active) return { label: 'Inativo', token: null };
  if (c.expired) return { label: 'Vencido', token: 'warning' };
  if (c.exhausted) return { label: 'Esgotado', token: 'warning' };
  return { label: 'Ativo', token: 'success' };
}

function CouponCard({ c, products, canEdit, busy, onEdit, onToggle, onRemove }) {
  const st = couponState(c);
  const names = (c.product_ids || []).map((id) => products.find((p) => p.id === id)?.name).filter(Boolean);
  return (
    <TgCard hover={false} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, opacity: c.valid ? 1 : 0.7, minWidth: 0 }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: (t) => tint(t, 'primary', 0.12),
            flexShrink: 0
          }}
        >
          <IconTicket size={20} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, letterSpacing: 0.5, fontFamily: 'monospace' }} noWrap title={c.code}>
            {c.code}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {c.value_label || (c.kind === 'percent' ? `${c.value}%` : formatBRL(c.value))} de desconto
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {' '}
              · {couponDurationLabel(c)}
            </Typography>
          </Typography>
        </Box>
        {canEdit ? (
          <Tooltip title={c.active ? 'Ativo' : 'Inativo'}>
            <Switch size="small" checked={c.active} onChange={(e) => onToggle(e.target.checked)} disabled={busy} />
          </Tooltip>
        ) : null}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
        {names.length ? `Vale em: ${names.join(', ')}` : 'Vale em todos os produtos'}
        {c.expires_at ? ` · até ${fmtDateBR(c.expires_at)}` : ''}
      </Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 'auto', pt: 0.5 }}>
        <MiniChip label={st.label} token={st.token} />
        <MiniChip
          label={c.max_uses != null ? `${c.used}/${c.max_uses} usos` : `${c.used} uso${c.used === 1 ? '' : 's'}`}
          title={c.max_uses != null ? `Restam ${c.remaining ?? Math.max(0, c.max_uses - c.used)}` : 'Sem limite de usos'}
        />
        <Box sx={{ flex: 1 }} />
        {canEdit ? (
          <>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={onEdit} disabled={busy}>
                <IconPencil size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Excluir">
              <IconButton size="small" onClick={onRemove} disabled={busy}>
                <IconTrash size={16} />
              </IconButton>
            </Tooltip>
          </>
        ) : null}
      </Stack>
    </TgCard>
  );
}

const GRID = {
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }
};

// ============================================================================
export default function WhatsAppProducts() {
  const { user } = useAuth();
  const canEdit = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'coupons' ? 'coupons' : 'products';
  const setTab = (v) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (v === 'coupons') n.set('tab', 'coupons');
        else n.delete('tab');
        return n;
      },
      { replace: true }
    );

  const [items, setItems] = useState(null);
  const [dlg, setDlg] = useState(null); // {id?, ...campos}
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // {kind:'product'|'coupon', item}
  const [orgSettings, setOrgSettings] = useState(null); // config de cobrança (régua/carência padrão)
  const [coupons, setCoupons] = useState(null);
  const [couponDlg, setCouponDlg] = useState(null); // null | 'new' | cupom
  const { defs: cfDefs } = useCustomFieldDefs('product');

  const load = useCallback(async () => {
    try {
      const r = await get('/whatsapp/products');
      setItems(Array.isArray(r) ? r : []);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível carregar os produtos.'));
      setItems([]);
    }
  }, []);
  const loadCoupons = useCallback(async () => {
    try {
      const r = await get('/whatsapp/coupons');
      setCoupons(Array.isArray(r) ? r : []);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível carregar os cupons.'));
      setCoupons([]);
    }
  }, []);
  useEffect(() => {
    load();
    get('/whatsapp/charges/settings')
      .then(setOrgSettings)
      .catch(() => setOrgSettings(null));
  }, [load]);
  useEffect(() => {
    if (tab === 'coupons' && coupons === null) loadCoupons();
  }, [tab, coupons, loadCoupons]);

  const save = async () => {
    if (!dlg.name.trim()) return toast.error('Dê um nome ao produto.');
    if (dlg.kind === 'service' && dlg.booking.payment === 'deposit' && !(dlg.booking.deposit_cents >= 100))
      return toast.error('Informe o valor do sinal (mínimo R$ 1,00).');
    const recurring = isRecurring(dlg.billing);
    const access = recurring ? rulesPayload(dlg.ent_rules) : { rules: [] };
    if (access.error) return toast.error(access.error);
    // campos personalizados: na criação vão todos; na edição só os que mudaram
    let customBody = {};
    if (cfDefs.length) {
      const initial = customFormValues(cfDefs, dlg._custom0);
      const values = customFormValues(cfDefs, dlg.custom);
      const changed = dlg.id ? customPayload(cfDefs, values, { initial, onlyTouched: true }) : customPayload(cfDefs, values);
      let localErr = validateCustomLocal(cfDefs, values, { mode: dlg.id ? 'update' : 'create' });
      if (localErr && dlg.id) {
        localErr = Object.fromEntries(Object.entries(localErr).filter(([k]) => k in changed));
        if (!Object.keys(localErr).length) localErr = null;
      }
      if (localErr) {
        setDlg((x) => ({ ...x, _cfErr: localErr }));
        return toast.error(customErrorsText(cfDefs, localErr));
      }
      if (Object.keys(changed).length) customBody = { custom: changed };
    }
    setBusy(true);
    try {
      const service = dlg.kind === 'service';
      const body = {
        kind: dlg.kind,
        name: dlg.name.trim(),
        description: dlg.description,
        price_cents: dlg.price_cents,
        billing: dlg.billing,
        billing_interval_months: recurring ? billingMonths(dlg.billing) : null,
        active: dlg.active,
        category: dlg.category.trim() || null,
        trial_days: recurring ? intOr(dlg.trial_days, 0, 365, 0) : 0,
        grace_days: recurring ? intOr(dlg.grace_days, 0, 90, 0) : 0,
        prorate: Boolean(dlg.prorate),
        cancel_policy: dlg.cancel_policy,
        charge_days_before: recurring && dlg.charge_days_before !== '' ? intOr(dlg.charge_days_before, 0, 30, 0) : null,
        reminder_rules: recurring && dlg.own_rules && dlg.reminder_rules ? dlg.reminder_rules : null,
        ...(recurring ? { entitlement: { rules: access.rules } } : { installments_max: intOr(dlg.installments_max, 1, 12, 1) }),
        ...(service
          ? {
              billing: 'once',
              billing_interval_months: null,
              duration_minutes: intOr(dlg.duration_minutes, 5, 720, 60),
              buffer_after_minutes: intOr(dlg.buffer_after_minutes, 0, 240, 0),
              capacity: intOr(dlg.capacity, 1, 200, 1),
              booking: { ...dlg.booking, address: dlg.booking.address?.trim() || undefined },
              included_in_plans: dlg.included_in_plans.filter((x) => x.plan_id)
            }
          : {}),
        ...customBody
      };
      if (dlg.id) await put(`/whatsapp/products/${dlg.id}`, body);
      else await post('/whatsapp/products', body);
      toast.success(dlg.id ? 'Produto salvo.' : 'Produto criado.');
      setDlg(null);
      load();
    } catch (e) {
      const ce = customErrorsFrom(e);
      if (ce) {
        setDlg((x) => (x ? { ...x, _cfErr: ce } : x));
        toast.error(customErrorsText(cfDefs, ce));
        return undefined;
      }
      toast.error(errMsg(e, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const toggle = async (p, active) => {
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, active } : x)));
    try {
      await put(`/whatsapp/products/${p.id}`, { active });
    } catch (e) {
      setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, active: !active } : x)));
      toast.error(errMsg(e, 'Não foi possível atualizar.'));
    }
  };
  const toggleCoupon = async (c, active) => {
    setCoupons((xs) => xs.map((x) => (x.id === c.id ? { ...x, active } : x)));
    try {
      const r = await put(`/whatsapp/coupons/${c.id}`, { active });
      if (r?.id) setCoupons((xs) => xs.map((x) => (x.id === c.id ? r : x)));
    } catch (e) {
      setCoupons((xs) => xs.map((x) => (x.id === c.id ? { ...x, active: !active } : x)));
      toast.error(errMsg(e, 'Não foi possível atualizar.'));
    }
  };

  const doRemove = async () => {
    setBusy(true);
    try {
      if (confirm.kind === 'coupon') {
        await remove(`/whatsapp/coupons/${confirm.item.id}`);
        toast.success('Cupom excluído.');
        loadCoupons();
      } else {
        await remove(`/whatsapp/products/${confirm.item.id}`);
        toast.success('Produto excluído.');
        load();
      }
      setConfirm(null);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível excluir.'));
    } finally {
      setBusy(false);
    }
  };

  const productOptions = useMemo(() => items || [], [items]);

  return (
    <Box>
      <WaPageHeader
        icon={IconPackage}
        title="Produtos"
        subtitle="O que a sua empresa vende: produtos, planos e serviços agendáveis, com preço e forma de cobrança — e cupons de desconto."
        sx={{ mb: 2 }}
        action={
          // celular: o WaPageHeader põe isto numa linha própria (o botão cresce, o ícone não)
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Tooltip title="Atualizar">
              <IconButton onClick={() => (tab === 'coupons' ? loadCoupons() : load())}>
                <IconRefresh size={18} />
              </IconButton>
            </Tooltip>
            {canEdit ? (
              tab === 'coupons' ? (
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<IconPlus size={18} />}
                  onClick={() => setCouponDlg('new')}
                  sx={waPrimaryBtn}
                >
                  Novo cupom
                </Button>
              ) : (
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<IconPlus size={18} />}
                  onClick={() => setDlg(empty())}
                  sx={waPrimaryBtn}
                >
                  Novo produto
                </Button>
              )
            ) : null}
          </Stack>
        }
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          minHeight: 40,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 }
        }}
      >
        <Tab
          value="products"
          icon={<IconPackage size={16} />}
          iconPosition="start"
          label={`Produtos${items?.length ? ` (${items.length})` : ''}`}
        />
        <Tab
          value="coupons"
          icon={<IconTicket size={16} />}
          iconPosition="start"
          label={`Cupons${coupons?.length ? ` (${coupons.length})` : ''}`}
        />
      </Tabs>

      {!canEdit ? (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2.5 }}>
          {tab === 'coupons'
            ? 'Só o dono ou um admin da organização cria e altera cupons. Você pode aplicá-los nas assinaturas dos clientes.'
            : 'Só o dono ou um admin da organização altera o catálogo. Você pode usar os produtos nas assinaturas dos clientes.'}
        </Alert>
      ) : null}

      {tab === 'products' ? (
        items === null ? (
          <TgCardGridSkeleton count={6} height={150} />
        ) : items.length === 0 ? (
          <TgEmptyState
            icon={IconPackage}
            title="Nenhum produto ainda"
            description="Cadastre o que você vende — um plano mensal, um serviço avulso, um produto. Depois é só vincular aos clientes e cobrar pelo WhatsApp."
            action={
              canEdit ? (
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<IconPlus size={18} />}
                  onClick={() => setDlg(empty())}
                  sx={waPrimaryBtn}
                >
                  Criar o primeiro produto
                </Button>
              ) : null
            }
          />
        ) : (
          <Box sx={GRID}>
            {items.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                canEdit={canEdit}
                busy={busy}
                onEdit={() => setDlg(formFrom(p))}
                onToggle={(v) => toggle(p, v)}
                onRemove={() => setConfirm({ kind: 'product', item: p })}
              />
            ))}
          </Box>
        )
      ) : coupons === null ? (
        <TgCardGridSkeleton count={3} height={130} />
      ) : coupons.length === 0 ? (
        <TgEmptyState
          icon={IconTicket}
          title="Nenhum cupom ainda"
          description="Crie códigos de desconto (percentual ou valor fixo) para uma cobrança, alguns meses ou para sempre. O cliente informa o código ao assinar — no painel ou pelo bot."
          action={
            canEdit ? (
              <Button
                variant="contained"
                disableElevation
                startIcon={<IconPlus size={18} />}
                onClick={() => setCouponDlg('new')}
                sx={waPrimaryBtn}
              >
                Criar o primeiro cupom
              </Button>
            ) : null
          }
        />
      ) : (
        <Box sx={GRID}>
          {coupons.map((c) => (
            <CouponCard
              key={c.id}
              c={c}
              products={items || []}
              canEdit={canEdit}
              busy={busy}
              onEdit={() => setCouponDlg(c)}
              onToggle={(v) => toggleCoupon(c, v)}
              onRemove={() => setConfirm({ kind: 'coupon', item: c })}
            />
          ))}
        </Box>
      )}

      <ProductDialog
        dlg={dlg}
        setDlg={setDlg}
        busy={busy}
        onSave={save}
        orgSettings={orgSettings}
        plans={(items || []).filter((p) => kindOf(p) === 'plan')}
        cfDefs={cfDefs}
      />

      <CouponDialog
        open={Boolean(couponDlg)}
        coupon={couponDlg && couponDlg !== 'new' ? couponDlg : null}
        products={productOptions}
        onClose={() => setCouponDlg(null)}
        onSaved={() => loadCoupons()}
      />

      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={doRemove}
        loading={busy}
        danger
        title={confirm?.kind === 'coupon' ? 'Excluir este cupom?' : 'Excluir este produto?'}
        message={
          confirm?.kind === 'coupon'
            ? `O código ${confirm?.item?.code} deixa de funcionar. Assinaturas que já usaram mantêm o desconto aplicado.`
            : `"${confirm?.item?.name}" sai do catálogo. Assinaturas antigas mantêm o nome.`
        }
        confirmLabel="Excluir"
      />
    </Box>
  );
}
