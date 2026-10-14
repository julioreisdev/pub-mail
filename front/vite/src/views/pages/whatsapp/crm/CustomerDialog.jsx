import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  IconBan,
  IconCalendarDue,
  IconCheck,
  IconCreditCard,
  IconDownload,
  IconShieldLock,
  IconGift,
  IconPencil,
  IconPlayerPause,
  IconPlus,
  IconReceipt2,
  IconTicket,
  IconTrash,
  IconTrashX,
  IconUserPlus
} from '@tabler/icons-react';

import { get, patch, post, put, remove } from 'api/api';
import { useAuth } from 'contexts/AuthContext';
import useAccess from 'hooks/useAccess';
import { TgConfirmDialog } from 'views/pages/telegram/ui';
import { errMsg, fmtPhone, onlyDigits, tint } from '../waShared';
import { couponSummary } from './CouponDialog';
import SubscriptionActions from './SubscriptionActions';
import { SavedCards, SubPaymentMethodFields } from './PaymentMethods';
import SubscriptionTimeline from './SubscriptionTimeline';
import EntitlementsList from './EntitlementsList';
import { AuditList } from 'views/pages/account-settings/AuditLog';
import AddressesEditor, { cleanAddresses } from './AddressesEditor';
import CustomFieldsInputs from './CustomFieldsInputs';
import { useUnits } from './UnitsManager';
import {
  customErrorsFrom,
  customErrorsText,
  customFormValues,
  customPayload,
  formatCustomValue,
  useCustomFieldDefs,
  validateCustomLocal
} from './customFields';
import {
  BILLING_OPTIONS,
  CrmModal,
  MoneyField,
  StatusChip,
  SUB_STATUS,
  billingShort,
  dueText,
  fmtDateBR,
  fmtDayMonth,
  formatBRL,
  isRecurring,
  todayIso,
  waPrimaryBtn
} from './crmKit';

// ============================================================================
// Diálogo de cliente (criar / editar) — usado na página Clientes e no painel
// "Cliente" do chat. Abas: Dados · Assinaturas · Mais (campos personalizados,
// observações, situação). Assinaturas só depois de salvar (precisa do id).
// ============================================================================

const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO'
];
const emptyAddr = { zip: '', street: '', number: '', complement: '', district: '', city: '', state: '' };

const ROLES = [
  { value: 'owner', label: 'Titular' },
  { value: 'financial', label: 'Financeiro' },
  { value: 'user', label: 'Usuário' },
  { value: 'dependent', label: 'Dependente' }
];

const formFrom = (c, contact) => ({
  name: c?.name || contact?.name || '',
  phone: c?.phone || contact?.phone || '',
  code: c?.code || '',
  kind: c?.kind || 'person',
  doc: c?.doc || '',
  email: c?.email || '',
  address: { ...emptyAddr, ...(c?.address || {}) },
  notes: c?.notes || '',
  custom: { ...(c?.custom || {}) },
  status: c?.status || 'active',
  since: c?.since || todayIso(),
  // Fase 7: unidade, id no sistema externo e endereços de atendimento/entrega
  unit_id: c?.unit_id || '',
  external_id: c?.external_id || '',
  addresses: Array.isArray(c?.addresses) ? c.addresses.map((a) => ({ ...a })) : []
});

const maskDoc = (v) => {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11)
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};
const maskCep = (v) => {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

// ----------------------------------------------------------------------------
// Formulário de assinatura (inline). Criação passa pelo motor (Fase 3): cupom,
// data de início, teste grátis, "cobrar a 1ª agora" e prévia sem gravar
// (POST /whatsapp/customers/:id/subscriptions/preview). Edição = ajuste manual (PUT).
// ----------------------------------------------------------------------------
const NO_DEFS = []; // padrão estável (o efeito de campos depende da identidade da lista)
const defaultDueDay = () => Math.min(28, new Date().getDate());
const daysBetweenIso = (a, b) => {
  if (!a || !b) return null;
  const d = (new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000;
  return Number.isFinite(d) ? Math.round(d) : null;
};

function PreviewLine({ icon: Icon, children, tone }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="flex-start">
      <Box component="span" sx={{ color: tone ? `${tone}.main` : 'text.secondary', display: 'inline-flex', mt: '2px', flexShrink: 0 }}>
        <Icon size={15} />
      </Box>
      <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Stack>
  );
}

function SubscriptionForm({ initial, products, customerId, onCancel, onSave, busy, reloadKey, cfDefs = NO_DEFS, cfServerErrors = null }) {
  const canFinance = useAccess().hasPermission('whatsapp:finance'); // cartões salvos = financeiro
  const creating = !initial;
  // campos personalizados da assinatura (Fase 7)
  const [custom, setCustom] = useState(() => customFormValues(cfDefs, initial?.custom));
  const [initialCustom, setInitialCustom] = useState(() => customFormValues(cfDefs, initial?.custom));
  const [cfErr, setCfErr] = useState(null);
  const cfTouchedRef = useRef(false);
  // definições chegaram depois de abrir o formulário (cache ainda carregando): preenche com os valores atuais
  useEffect(() => {
    if (cfTouchedRef.current) return;
    const v = customFormValues(cfDefs, initial?.custom);
    setCustom(v);
    setInitialCustom(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfDefs]);
  const shownCfErr = cfErr || cfServerErrors;
  const [f, setF] = useState(() => ({
    product_id: initial?.product_id || '',
    product_name: initial?.product_name || '',
    price_cents: initial?.price_cents ?? 0,
    billing: initial?.billing || 'monthly',
    due_day: initial?.due_day || defaultDueDay(),
    next_due_at: initial?.next_due_at || '',
    status: initial?.status || 'active',
    notes: initial?.notes || '',
    payment_method: initial?.payment_method || null,
    payment_method_id: initial?.payment_method_id || null,
    // só na criação
    start_date: '',
    trial: true,
    charge_now: false
  }));
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null); // {code, label, discount_cents} aplicado
  const [couponMsg, setCouponMsg] = useState(null); // {ok, text}
  const [couponBusy, setCouponBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewErr, setPreviewErr] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const seqRef = useRef(0);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const product = products.find((x) => x.id === f.product_id) || null;
  const trialDays = product?.trial_days || 0;
  const pickProduct = (id) => {
    const p = products.find((x) => x.id === id);
    setF((x) => ({ ...x, product_id: id, ...(p ? { product_name: p.name, price_cents: p.price_cents, billing: p.billing } : {}) }));
    if (coupon) setCouponMsg(null);
  };
  const recurring = isRecurring(f.billing);

  const body = () => ({
    product_id: f.product_id || null,
    product_name: f.product_name.trim() || undefined,
    price_cents: f.price_cents,
    billing: f.billing,
    due_day: recurring ? Number(f.due_day) : null,
    payment_method: f.payment_method || null,
    payment_method_id: f.payment_method === 'card' ? f.payment_method_id || null : null
  });
  const createBody = () => ({
    ...body(),
    start_date: f.start_date || undefined,
    coupon: coupon?.code || undefined,
    trial: trialDays > 0 ? Boolean(f.trial) : undefined
  });

  // prévia (sem gravar) com debounce
  const previewKey = creating
    ? JSON.stringify([f.product_id, f.product_name, f.price_cents, f.billing, f.due_day, f.start_date, f.trial, coupon?.code || ''])
    : '';
  useEffect(() => {
    if (!creating || !customerId) return undefined;
    if (!f.product_id && !f.product_name.trim()) {
      setPreview(null);
      setPreviewErr('');
      return undefined;
    }
    const seq = ++seqRef.current;
    const t = window.setTimeout(async () => {
      setPreviewBusy(true);
      try {
        const r = await post(`/whatsapp/customers/${customerId}/subscriptions/preview`, createBody());
        if (seq !== seqRef.current) return;
        setPreview(r || null);
        setPreviewErr('');
      } catch (e) {
        if (seq !== seqRef.current) return;
        const msg = errMsg(e, 'Não foi possível calcular a prévia.');
        setPreview(null);
        setPreviewErr(msg);
        if (coupon && /cupom/i.test(msg)) {
          setCoupon(null);
          setCouponMsg({ ok: false, text: msg });
        }
      } finally {
        if (seq === seqRef.current) setPreviewBusy(false);
      }
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, customerId, creating]);

  const applyCoupon = async () => {
    const code = couponInput
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    if (!code) return toast.error('Digite o código do cupom.');
    setCouponBusy(true);
    try {
      const r = await post('/whatsapp/coupons/validate', { code, product_id: f.product_id || null });
      if (!r?.valid) {
        setCoupon(null);
        setCouponMsg({ ok: false, text: r?.reason || 'Cupom inválido.' });
      } else {
        const label = r.coupon ? couponSummary(r.coupon) : code;
        setCoupon({ code, label, discount_cents: r.discount_cents || 0 });
        setCouponMsg({
          ok: true,
          text: `${label}${r.discount_cents ? ` — desconto de ${formatBRL(r.discount_cents)} (${formatBRL(r.amount_cents)} em vez de ${formatBRL(r.price_cents)})` : ''}`
        });
      }
    } catch (e) {
      setCoupon(null);
      setCouponMsg({ ok: false, text: errMsg(e, 'Não foi possível validar o cupom.') });
    } finally {
      setCouponBusy(false);
    }
    return undefined;
  };
  const clearCoupon = () => {
    setCoupon(null);
    setCouponMsg(null);
    setCouponInput('');
  };

  const save = () => {
    if (!f.product_id && !f.product_name.trim()) return toast.error('Escolha um produto ou dê um nome à assinatura.');
    if (recurring && !(f.due_day >= 1 && f.due_day <= 28)) return toast.error('Dia de vencimento entre 1 e 28.');
    const localErr = cfDefs.length ? validateCustomLocal(cfDefs, custom, { mode: creating ? 'create' : 'update' }) : null;
    setCfErr(localErr);
    if (localErr) return toast.error(customErrorsText(cfDefs, localErr));
    if (creating) {
      if (couponInput.trim() && !coupon) return toast.error('Clique em "Aplicar" para usar o cupom (ou apague o código).');
      return onSave({
        ...createBody(),
        notes: f.notes,
        charge_now: Boolean(f.charge_now),
        ...(cfDefs.length ? { custom: customPayload(cfDefs, custom) } : {})
      });
    }
    // edição: a situação NÃO vai no PUT (o back recusa; pausar/cancelar/retomar são ações do menu ⋮)
    const changedCustom = cfDefs.length ? customPayload(cfDefs, custom, { initial: initialCustom, onlyTouched: true }) : {};
    return onSave({
      ...body(),
      next_due_at: recurring && f.next_due_at ? f.next_due_at : recurring ? undefined : null,
      notes: f.notes,
      ...(Object.keys(changedCustom).length ? { custom: changedCustom } : {})
    });
  };

  // texto da 1ª cobrança da prévia
  const fc = preview?.first_charge || null;
  const fullPrice = preview?.price_cents ?? f.price_cents;
  const startIso = f.start_date || todayIso();
  const proDays =
    fc && fc.amount_cents < Math.max(0, fullPrice - (preview?.discount_cents || 0))
      ? daysBetweenIso(startIso, fc.due_at || preview?.next_due_at)
      : null;

  return (
    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, bgcolor: 'action.hover' }}>
      <Stack spacing={1.25}>
        <TextField
          select
          size="small"
          label="Produto / serviço"
          value={f.product_id}
          onChange={(e) => pickProduct(e.target.value)}
          fullWidth
        >
          <MenuItem value="">
            <em>Sem produto do catálogo (nome livre)</em>
          </MenuItem>
          {products.map((p) => (
            <MenuItem key={p.id} value={p.id} disabled={!p.active}>
              {p.name} · {formatBRL(p.price_cents)}
              {billingShort(p.billing)}
              {p.trial_days ? ` · ${p.trial_days} dias grátis` : ''}
            </MenuItem>
          ))}
        </TextField>
        {!f.product_id ? (
          <TextField
            size="small"
            label="Nome do produto ou serviço"
            value={f.product_name}
            onChange={(e) => set('product_name', e.target.value.slice(0, 120))}
            fullWidth
          />
        ) : null}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <MoneyField label="Valor cobrado" valueCents={f.price_cents} onChange={(c) => set('price_cents', c)} />
          <TextField select size="small" label="Cobrança" value={f.billing} onChange={(e) => set('billing', e.target.value)} fullWidth>
            {BILLING_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          {recurring ? (
            <TextField
              size="small"
              type="number"
              label="Dia do vencimento"
              value={f.due_day}
              onChange={(e) => {
                const day = Math.min(28, Math.max(1, parseInt(e.target.value || '1', 10) || 1));
                // na edição, trocar o dia limpa o próximo vencimento → o back recalcula pelo dia novo
                setF((x) => ({ ...x, due_day: day, ...(creating ? {} : { next_due_at: '' }) }));
              }}
              inputProps={{ min: 1, max: 28, inputMode: 'numeric' }}
              fullWidth
              helperText="1 a 28 (todo ciclo)"
            />
          ) : null}
          {creating ? (
            <TextField
              size="small"
              type="date"
              label="Início"
              value={f.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              helperText="Vazio = hoje"
            />
          ) : recurring ? (
            <TextField
              size="small"
              type="date"
              label="Próximo vencimento"
              value={f.next_due_at}
              onChange={(e) => set('next_due_at', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              helperText="Vazio = calculado pelo dia"
            />
          ) : null}
        </Stack>

        {creating ? (
          <>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                size="small"
                label="Cupom de desconto"
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value.toUpperCase().slice(0, 32));
                  if (coupon) setCoupon(null);
                  setCouponMsg(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCoupon();
                  }
                }}
                placeholder="Opcional"
                sx={{ flex: 1, minWidth: 0 }}
                inputProps={{ style: { textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 } }}
              />
              {coupon ? (
                <Button size="small" color="inherit" onClick={clearCoupon} sx={{ textTransform: 'none', minHeight: 40, flexShrink: 0 }}>
                  Remover
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={applyCoupon}
                  disabled={couponBusy || !couponInput.trim()}
                  startIcon={couponBusy ? <CircularProgress size={13} /> : <IconTicket size={15} />}
                  sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40, flexShrink: 0 }}
                >
                  Aplicar
                </Button>
              )}
            </Stack>
            {couponMsg ? (
              <Typography
                variant="caption"
                sx={{ color: couponMsg.ok ? 'success.main' : 'error.main', mt: -0.5, overflowWrap: 'anywhere' }}
              >
                {couponMsg.ok ? '✓ ' : ''}
                {couponMsg.text}
              </Typography>
            ) : null}
            {trialDays > 0 ? (
              <FormControlLabel
                control={<Switch size="small" checked={f.trial} onChange={(e) => set('trial', e.target.checked)} />}
                label={<Typography variant="body2">Começar com os {trialDays} dias grátis do produto</Typography>}
              />
            ) : null}
            <Box>
              <FormControlLabel
                control={<Switch size="small" checked={f.charge_now} onChange={(e) => set('charge_now', e.target.checked)} />}
                label={<Typography variant="body2">Cobrar a 1ª agora</Typography>}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: -0.5, pl: { xs: 0, sm: 5.5 } }}>
                {f.charge_now
                  ? 'Gera a 1ª cobrança (PIX, boleto ou cartão) e envia na conversa assim que salvar.'
                  : 'Desligado: nada é cobrado agora — a próxima cobrança sai sozinha alguns dias antes do vencimento.'}
              </Typography>
            </Box>
            {f.product_id || f.product_name.trim() ? (
              <Box sx={{ p: 1.25, borderRadius: 2, border: '1px dashed', borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
                  >
                    Prévia
                  </Typography>
                  {previewBusy ? <CircularProgress size={12} /> : null}
                </Stack>
                {previewErr ? (
                  <Typography variant="body2" sx={{ color: 'error.main' }}>
                    {previewErr}
                  </Typography>
                ) : preview ? (
                  <Stack spacing={0.5}>
                    {preview.trial_ends_at ? (
                      <PreviewLine icon={IconGift} tone="info">
                        Teste grátis até <b>{preview.trial_ends_label || fmtDateBR(preview.trial_ends_at)}</b>
                      </PreviewLine>
                    ) : null}
                    {preview.next_due_at ? (
                      <PreviewLine icon={IconCalendarDue}>
                        1º vencimento <b>{preview.next_due_label || fmtDateBR(preview.next_due_at)}</b>
                        {preview.due_day ? ` (todo dia ${preview.due_day})` : ''}
                      </PreviewLine>
                    ) : null}
                    {preview.trial_charge ? (
                      <PreviewLine icon={IconReceipt2}>
                        No fim do teste: <b>{preview.trial_charge.amount_label || formatBRL(preview.trial_charge.amount_cents)}</b>
                        {preview.trial_charge.mode === 'prorate'
                          ? ` (proporcional, ${preview.trial_charge.days} dia${preview.trial_charge.days === 1 ? '' : 's'} até ${preview.trial_charge.next_due_label})`
                          : ` (valor cheio; o próximo vence em ${preview.trial_charge.next_due_label})`}
                      </PreviewLine>
                    ) : null}
                    {preview.discount_cents ? (
                      <PreviewLine icon={IconTicket} tone="success">
                        Cupom {preview.coupon_code || coupon?.code}: −{formatBRL(preview.discount_cents)}
                        {preview.discount_until ? ` até ${fmtDateBR(preview.discount_until)}` : ''}
                      </PreviewLine>
                    ) : null}
                    {f.charge_now ? (
                      fc ? (
                        <PreviewLine icon={IconReceipt2} tone="primary">
                          1ª cobrança agora: <b>{fc.amount_label || formatBRL(fc.amount_cents)}</b>
                          {proDays != null && proDays > 0 ? ` (proporcional, ${proDays} dia${proDays === 1 ? '' : 's'})` : ''}
                          {fc.due_label ? ` · vence ${fc.due_label}` : ''}
                        </PreviewLine>
                      ) : (
                        <PreviewLine icon={IconReceipt2}>
                          Não há cobrança agora (teste grátis ou valor menor que R$ 1,00). A próxima sai sozinha antes do vencimento.
                        </PreviewLine>
                      )
                    ) : fc ? (
                      <PreviewLine icon={IconReceipt2}>
                        Sem cobrança agora. Se ligar "Cobrar a 1ª agora", seriam {fc.amount_label || formatBRL(fc.amount_cents)}
                        {proDays != null && proDays > 0 ? ` (proporcional, ${proDays} dia${proDays === 1 ? '' : 's'})` : ''}.
                      </PreviewLine>
                    ) : null}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Calculando…
                  </Typography>
                )}
              </Box>
            ) : null}
            <TextField
              size="small"
              label="Observação"
              value={f.notes}
              onChange={(e) => set('notes', e.target.value.slice(0, 500))}
              fullWidth
            />
          </>
        ) : (
          <TextField
            size="small"
            label="Observação"
            value={f.notes}
            onChange={(e) => set('notes', e.target.value.slice(0, 500))}
            fullWidth
          />
        )}
        {cfDefs.length ? (
          <CustomFieldsInputs
            defs={cfDefs}
            values={custom}
            onChange={(v) => {
              cfTouchedRef.current = true;
              setCustom(v);
              if (cfErr) setCfErr(null);
            }}
            errors={shownCfErr}
          />
        ) : null}
        {canFinance ? (
          <SubPaymentMethodFields
            customerId={customerId}
            reloadKey={reloadKey}
            value={{ payment_method: f.payment_method, payment_method_id: f.payment_method_id }}
            onChange={(v) => setF((x) => ({ ...x, ...v }))}
          />
        ) : null}
        {!creating ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Editar aqui é um ajuste manual (não avisa o cliente nem registra na linha do tempo). A situação (
            {SUB_STATUS[f.status]?.label || f.status}) não muda por aqui: para pausar, retomar, cancelar ou trocar de plano, use o menu ⋮ da
            assinatura.
          </Typography>
        ) : null}
        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
          <Button size="small" color="inherit" onClick={onCancel} disabled={busy} sx={{ textTransform: 'none', minHeight: 36 }}>
            Cancelar
          </Button>
          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={save}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={13} color="inherit" /> : <IconCheck size={15} />}
            sx={{ ...waPrimaryBtn, minHeight: 36, flex: { xs: '1 1 auto', sm: '0 0 auto' } }}
          >
            {initial ? 'Salvar assinatura' : f.charge_now ? 'Adicionar e cobrar' : 'Adicionar assinatura'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

function SubChip({ icon: Icon, label, token = 'info', title }) {
  return (
    <Tooltip title={title || ''} disableHoverListener={!title}>
      <Chip
        size="small"
        icon={Icon ? <Icon size={12} /> : undefined}
        label={label}
        sx={{
          height: 20,
          fontSize: 11,
          fontWeight: 700,
          borderRadius: 1.5,
          maxWidth: '100%',
          color: `${token}.main`,
          bgcolor: (t) => tint(t, token, 0.12),
          '& .MuiChip-icon': { color: `${token}.main` }
        }}
      />
    </Tooltip>
  );
}

/** Valores dos campos personalizados da assinatura numa linha ("Contrato: 123 · Instalação: 10/10/2026"). */
function SubCustomLine({ defs, custom }) {
  const parts = defs.map((d) => [d.label, formatCustomValue(d, custom?.[d.key])]).filter(([, v]) => v);
  if (!parts.length) return null;
  return (
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}>
      {parts.map(([l, v]) => `${l}: ${v}`).join(' · ')}
    </Typography>
  );
}

function SubscriptionRow({ s, products, cancelReasons, onEdit, onRemove, onChanged, reloadKey, cfDefs = [] }) {
  const [timeline, setTimeline] = useState(false);
  const today = todayIso();
  const trialOn = s.trial_ends_at && s.trial_ends_at >= today;
  const discounted = s.discount_cents > 0 && (!s.discount_until || s.discount_until >= today);
  return (
    <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', opacity: s.status === 'canceled' ? 0.75 : 1 }}>
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ px: 1.25, py: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
              {s.product_name}
            </Typography>
            <StatusChip map={SUB_STATUS} status={s.status} />
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3 }} display="block">
            {discounted && s.amount_label && s.amount_cents !== s.price_cents ? (
              <>
                <Box component="span" sx={{ textDecoration: 'line-through', mr: 0.5 }}>
                  {s.price_label}
                </Box>
                {s.amount_label}
              </>
            ) : (
              s.price_label
            )}
            {billingShort(s.billing)}
            {s.next_due_label && s.status !== 'canceled' ? ` · ${s.next_due_label} (${dueText(s.days_to_due)})` : ''}
            {s.notes ? ` · ${s.notes}` : ''}
          </Typography>
          {trialOn || s.paused_until || s.cancel_at || discounted || s.coupon_code || s.payment_method ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {trialOn ? <SubChip icon={IconGift} label={`Teste até ${fmtDayMonth(s.trial_ends_at)}`} token="info" /> : null}
              {s.payment_method ? (
                <SubChip
                  icon={IconCreditCard}
                  label={
                    { pix: 'PIX', boleto: 'Boleto', both: 'PIX + Boleto', card: s.payment_method_id ? 'Cartão salvo' : 'Cartão' }[
                      s.payment_method
                    ] || s.payment_method
                  }
                  token="info"
                  title={
                    s.payment_method === 'card' && !s.payment_method_id
                      ? 'O cartão é pedido no próximo pagamento (link seguro).'
                      : undefined
                  }
                />
              ) : null}
              {s.status === 'paused' && s.paused_until ? (
                <SubChip icon={IconPlayerPause} label={`Pausada até ${fmtDayMonth(s.paused_until)}`} token="info" />
              ) : null}
              {s.cancel_at && s.status !== 'canceled' ? (
                <SubChip
                  icon={IconBan}
                  label={`Cancela em ${fmtDayMonth(s.cancel_at)}`}
                  token="error"
                  title={s.cancel_reason ? `Motivo: ${s.cancel_reason}` : undefined}
                />
              ) : null}
              {s.status === 'canceled' && s.cancel_reason ? <SubChip icon={IconBan} label={s.cancel_reason} token="error" /> : null}
              {discounted || s.coupon_code ? (
                <SubChip
                  icon={IconTicket}
                  label={`${s.coupon_code ? `${s.coupon_code} · ` : ''}${discounted ? `−${formatBRL(s.discount_cents)}` : 'cupom'}`}
                  token="success"
                  title={s.discount_until ? `Desconto até ${fmtDateBR(s.discount_until)}` : undefined}
                />
              ) : null}
            </Stack>
          ) : null}
          {cfDefs.length ? <SubCustomLine defs={cfDefs} custom={s.custom} /> : null}
        </Box>
        <Tooltip title="Editar">
          <IconButton size="small" onClick={onEdit} sx={{ p: 1 }}>
            <IconPencil size={16} />
          </IconButton>
        </Tooltip>
        <SubscriptionActions
          sub={s}
          products={products}
          cancelReasons={cancelReasons}
          onChanged={onChanged}
          onEdit={onEdit}
          onRemove={onRemove}
          timelineOpen={timeline}
          onToggleTimeline={() => setTimeline((v) => !v)}
        />
      </Stack>
      <Collapse in={timeline} unmountOnExit>
        <Box sx={{ px: 1.25, pb: 1.25, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 0.75 }}>
            Linha do tempo
          </Typography>
          <SubscriptionTimeline subscriptionId={s.id} reloadKey={reloadKey} />
        </Box>
      </Collapse>
    </Box>
  );
}

// ============================================================================
export default function CustomerDialog({
  open,
  onClose,
  customer,
  contact,
  products = [],
  fields = [],
  onSaved,
  onDeleted,
  onChargesChanged,
  canDelete,
  another = false,
  identity = null
}) {
  const { user } = useAuth();
  const canFinanceCards = useAccess().hasPermission('whatsapp:finance');
  const canManage = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(user?.user?.role);
  const [tab, setTab] = useState('data');
  // "outro cliente neste número": o back recusa criar um 2º cliente no mesmo WhatsApp sem essa marca
  const [needAnother, setNeedAnother] = useState(false);
  const [anotherOk, setAnotherOk] = useState(Boolean(another));
  // aba Números (vínculos cliente ↔ WhatsApp)
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [linkBusy, setLinkBusy] = useState(false);
  const [f, setF] = useState(() => formFrom(customer, contact));
  const [cur, setCur] = useState(customer || null); // cliente após salvar (assinaturas)
  const [busy, setBusy] = useState(false);
  const [subForm, setSubForm] = useState(null); // null | 'new' | assinatura
  const [subBusy, setSubBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // {kind:'sub', s} | {kind:'customer'}
  const [cancelReasons, setCancelReasons] = useState(null); // motivos de cancelamento (Configurações de cobrança)
  const [subsKey, setSubsKey] = useState(0); // recarrega as linhas do tempo depois de uma ação
  // Fase 8 (LGPD): exportar / apagar dados pessoais do cliente
  const [erasedAt, setErasedAt] = useState(null);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseText, setEraseText] = useState('');
  const [eraseMsgs, setEraseMsgs] = useState(false);
  const [eraseBusy, setEraseBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  // Fase 7: campos personalizados (definições do cache do CRM), unidades e erros por campo
  const { defs: hookDefs } = useCustomFieldDefs('customer');
  const cfDefs = hookDefs.length ? hookDefs : Array.isArray(fields) ? fields : [];
  const { defs: subDefs } = useCustomFieldDefs('subscription');
  const { units } = useUnits(open);
  const [cfErr, setCfErr] = useState(null); // {key: msg}
  const [fieldErr, setFieldErr] = useState({}); // {code|external_id: msg}
  const [subCfErr, setSubCfErr] = useState(null);
  const initialCustomRef = useRef({});
  const wasOpenRef = useRef(false);
  const curIdRef = useRef(null);
  const mountedRef = useRef(true);
  curIdRef.current = cur?.id || null;
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  // Reset do formulário SÓ quando o diálogo abre (false → true) ou quando, aberto, o pai troca para OUTRO
  // cliente já existente. Os objetos `customer`/`contact` mudam de identidade a cada save do painel do chat
  // (onSaved → load) — depender deles zerava o formulário no meio do uso ("Cadastrar outro cliente") e
  // devolvia a aba Dados logo depois de criar o cliente.
  useEffect(() => {
    const opening = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open) return;
    const switched = !opening && customer?.id && customer.id !== curIdRef.current;
    if (!opening && !switched) return;
    setTab('data');
    setF(formFrom(customer, contact));
    initialCustomRef.current = { ...(customer?.custom || {}) };
    setCfErr(null);
    setFieldErr({});
    setSubCfErr(null);
    setCur(customer || null);
    setBusy(false);
    setSubForm(null);
    setConfirm(null);
    setNeedAnother(false);
    setAnotherOk(Boolean(another));
    setNewPhone('');
    setNewRole('user');
    setCancelReasons(null);
    setErasedAt(null);
    setEraseOpen(false);
    setEraseText('');
    setEraseMsgs(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id, contact?.id, another]);

  // motivos de cancelamento: só quando a aba Assinaturas abre (1× por diálogo)
  useEffect(() => {
    if (!open || tab !== 'subs' || cancelReasons) return;
    get('/whatsapp/charges/settings')
      .then((r) => setCancelReasons(Array.isArray(r?.cancel_reasons) ? r.cancel_reasons : []))
      .catch(() => setCancelReasons([]));
  }, [open, tab, cancelReasons]);

  // depois de cancelar/pausar/retomar/trocar/reativar: as rotas devolvem a assinatura → recarrega o cliente
  const reloadCustomer = useCallback(async () => {
    if (!cur?.id) return;
    try {
      const r = await get(`/whatsapp/customers/${cur.id}`);
      setCur(r);
      onSaved?.(r);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível atualizar o cliente.'));
    }
    setSubsKey((n) => n + 1);
  }, [cur?.id, onSaved]);

  const set = (k, v) => {
    setF((x) => ({ ...x, [k]: v }));
    if (fieldErr[k]) setFieldErr((x) => ({ ...x, [k]: '' }));
  };
  const setAddr = (k, v) => setF((x) => ({ ...x, address: { ...x.address, [k]: v } }));

  const payload = () => ({
    name: f.name.trim(),
    code: f.code.trim() || null,
    kind: f.kind || 'person',
    doc: onlyDigits(f.doc) || '',
    email: f.email.trim(),
    address: f.address,
    notes: f.notes,
    // campos personalizados: na criação vão todos (o back confere os obrigatórios); na edição só o que mudou
    ...(cfDefs.length
      ? cur?.id
        ? (() => {
            const ch = customPayload(cfDefs, f.custom, { initial: initialCustomRef.current, onlyTouched: true });
            return Object.keys(ch).length ? { custom: ch } : {};
          })()
        : { custom: customPayload(cfDefs, f.custom) }
      : {}),
    status: f.status,
    since: f.since || null,
    unit_id: f.unit_id || null,
    external_id: f.external_id.trim() || null,
    addresses: cleanAddresses(f.addresses)
  });

  const save = async () => {
    if (!f.name.trim()) return toast.error('Informe o nome do cliente.');
    let localErr = cfDefs.length ? validateCustomLocal(cfDefs, f.custom, { mode: cur?.id ? 'update' : 'create' }) : null;
    if (localErr && cur?.id) {
      // na edição só confere o que a pessoa mexeu (o back faz o mesmo)
      const touched = customPayload(cfDefs, f.custom, { initial: initialCustomRef.current, onlyTouched: true });
      localErr = Object.fromEntries(Object.entries(localErr).filter(([k]) => k in touched));
      if (!Object.keys(localErr).length) localErr = null;
    }
    setCfErr(localErr);
    if (localErr) {
      setTab('more');
      return toast.error(customErrorsText(cfDefs, localErr));
    }
    setBusy(true);
    try {
      let saved;
      if (cur?.id) saved = await put(`/whatsapp/customers/${cur.id}`, payload());
      else {
        const body = { ...payload() };
        if (contact?.id) body.contact_id = contact.id;
        else {
          const phone = onlyDigits(f.phone);
          if (phone.length < 10 || phone.length > 15) {
            setBusy(false);
            return toast.error('Informe o WhatsApp com DDI e DDD, ex.: 5511999999999.');
          }
          body.phone = phone;
        }
        if (anotherOk) body.another = true;
        saved = await post('/whatsapp/customers', body);
      }
      setCur(saved);
      onSaved?.(saved);
      initialCustomRef.current = { ...(saved?.custom || {}) };
      if (!cur?.id) {
        toast.success('Cliente cadastrado. Agora adicione o que ele usa ou paga.');
        setTab('subs');
        setSubForm('new');
      } else {
        toast.success('Cliente salvo.');
        onClose?.();
      }
    } catch (e) {
      const ce = customErrorsFrom(e);
      if (ce) {
        setCfErr(ce);
        setTab('more');
        toast.error(customErrorsText(cfDefs, ce));
        return undefined;
      }
      const msg = errMsg(e, 'Não foi possível salvar.');
      if (/outro cliente neste número/i.test(msg)) setNeedAnother(true);
      // código duplicado: aponta o campo certo
      if (/código externo/i.test(msg)) {
        setFieldErr((x) => ({ ...x, external_id: 'Já existe um cliente com esse código externo.' }));
        setTab('data');
      } else if (/já existe um cliente com esse código/i.test(msg)) {
        setFieldErr((x) => ({ ...x, code: 'Já existe um cliente com esse código.' }));
        setTab('data');
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  // ---- números do cliente
  const linkPhone = async () => {
    if (!cur?.id) return;
    const phone = onlyDigits(newPhone);
    if (phone.length < 10 || phone.length > 15) return toast.error('Informe o WhatsApp com DDI e DDD, ex.: 5511999999999.');
    setLinkBusy(true);
    try {
      const r = await post(`/whatsapp/customers/${cur.id}/contacts`, { phone, role: newRole });
      setCur(r);
      onSaved?.(r);
      setNewPhone('');
      toast.success('Número vinculado.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível vincular.'));
    } finally {
      setLinkBusy(false);
    }
    return undefined;
  };
  const changeRole = async (contactId, role) => {
    if (!cur?.id) return;
    setLinkBusy(true);
    try {
      const r = await patch(`/whatsapp/customers/${cur.id}/contacts/${contactId}`, { role });
      setCur(r);
      onSaved?.(r);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível alterar.'));
    } finally {
      setLinkBusy(false);
    }
  };
  const unlink = async (contactId) => {
    if (!cur?.id) return;
    setLinkBusy(true);
    try {
      const r = await remove(`/whatsapp/customers/${cur.id}/contacts/${contactId}`);
      setCur(r);
      onSaved?.(r);
      toast.success('Número desvinculado.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível desvincular.'));
    } finally {
      setLinkBusy(false);
    }
  };

  const saveSub = async (body) => {
    if (!cur?.id) return;
    setSubBusy(true);
    try {
      const r =
        subForm && subForm !== 'new'
          ? await put(`/whatsapp/customers/${cur.id}/subscriptions/${subForm.id}`, body)
          : await post(`/whatsapp/customers/${cur.id}/subscriptions`, body);
      setCur(r);
      onSaved?.(r);
      setSubForm(null);
      setSubCfErr(null);
      setSubsKey((n) => n + 1);
      if (subForm === 'new') {
        // `first_charge` é a cobrança PLANEJADA: o back gera e envia em seguida (não está pronta na resposta)
        const fc = r?.subscription?.first_charge;
        if (body.charge_now && fc) {
          toast.success(
            `Assinatura adicionada. A 1ª cobrança de ${fc.amount_label || formatBRL(fc.amount_cents)} será gerada e enviada em instantes.`
          );
          // dá tempo de a cobrança existir e aí avisa quem lista "Últimas cobranças" (painel do chat)
          window.setTimeout(() => {
            if (mountedRef.current) onChargesChanged?.();
          }, 2500);
        } else toast.success('Assinatura adicionada.');
      } else toast.success('Assinatura salva.');
    } catch (e) {
      const ce = customErrorsFrom(e);
      setSubCfErr(ce);
      toast.error(ce ? customErrorsText(subDefs, ce) : errMsg(e, 'Não foi possível salvar a assinatura.'));
    } finally {
      setSubBusy(false);
    }
  };

  const removeSub = async () => {
    const s = confirm?.s;
    if (!s || !cur?.id) return;
    setSubBusy(true);
    try {
      const r = await remove(`/whatsapp/customers/${cur.id}/subscriptions/${s.id}`);
      setCur(r);
      onSaved?.(r);
      setConfirm(null);
      setSubsKey((n) => n + 1); // acessos liberados por ela passam a "revogando"
      toast.success('Assinatura excluída.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível excluir.'));
    } finally {
      setSubBusy(false);
    }
  };

  const removeCustomer = async () => {
    if (!cur?.id) return;
    setBusy(true);
    try {
      await remove(`/whatsapp/customers/${cur.id}`);
      toast.success('Cliente removido (o contato continua).');
      setConfirm(null);
      onDeleted?.(cur);
      onClose?.();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível remover.'));
    } finally {
      setBusy(false);
    }
  };

  // ---- LGPD (Fase 8): o back só aceita dono/admin/superadmin
  const erased = Boolean(cur?.erased_at || erasedAt || (cur?.id && cur?.name === 'Cliente removido' && cur?.status === 'inactive'));

  const exportData = async () => {
    if (!cur?.id) return;
    setExportBusy(true);
    try {
      const data = await get(`/whatsapp/customers/${cur.id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const slug =
        String(cur.name || 'cliente')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40) || 'cliente';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dados-lgpd-${slug}-${todayIso()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success(data?.limits?.truncated ? 'Dados exportados (as conversas muito longas foram cortadas).' : 'Dados exportados.');
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível exportar os dados.'));
    } finally {
      setExportBusy(false);
    }
  };

  const eraseData = async () => {
    if (!cur?.id || eraseText.trim().toUpperCase() !== 'APAGAR') return;
    setEraseBusy(true);
    try {
      const r = await post(`/whatsapp/customers/${cur.id}/erase`, { confirm: 'APAGAR', delete_messages: eraseMsgs });
      setErasedAt(r?.erased_at || new Date().toISOString());
      setEraseOpen(false);
      setEraseText('');
      const parts = [
        r?.subscriptions_canceled ? `${r.subscriptions_canceled} assinatura(s) cancelada(s)` : '',
        r?.charges_canceled ? `${r.charges_canceled} cobrança(s) cancelada(s)` : '',
        r?.messages_deleted ? `${r.messages_deleted} mensagem(ns) apagada(s)` : '',
        r?.audit_redacted ? `${r.audit_redacted} registro(s) do histórico sem os dados` : ''
      ].filter(Boolean);
      toast.success(`Dados pessoais apagados.${parts.length ? ` ${parts.join(' · ')}.` : ''}`);
      if (Array.isArray(r?.warnings) && r.warnings.length) toast(r.warnings.slice(0, 3).join('\n'), { icon: '⚠️', duration: 8000 });
      try {
        const fresh = await get(`/whatsapp/customers/${cur.id}`);
        setCur(fresh);
        setF(formFrom(fresh, null));
        initialCustomRef.current = { ...(fresh?.custom || {}) };
        onSaved?.(fresh);
      } catch {
        /* o diálogo já mostra como apagado */
      }
      setSubsKey((n) => n + 1);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível apagar os dados.'));
    } finally {
      setEraseBusy(false);
    }
  };

  const subs = useMemo(
    () =>
      (cur?.subscriptions || [])
        .filter((s) => s.status !== 'canceled')
        .concat((cur?.subscriptions || []).filter((s) => s.status === 'canceled')),
    [cur]
  );
  const activeProducts = products.filter((p) => p.active || subs.some((s) => s.product_id === p.id));

  return (
    <>
      <CrmModal
        open={open}
        onClose={() => !busy && onClose?.()}
        title={cur?.id ? cur.name : 'Novo cliente'}
        subtitle={
          cur?.id && erased ? (
            <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
              <Chip
                size="small"
                color="error"
                variant="outlined"
                icon={<IconShieldLock size={14} />}
                label="Dados apagados (LGPD)"
                sx={{ height: 22, fontWeight: 700 }}
              />
              {fmtPhone(cur.phone) ? <span>{fmtPhone(cur.phone)}</span> : null}
            </Stack>
          ) : cur?.id ? (
            `${fmtPhone(cur.phone) || ''}${cur.monthly_cents ? ` · ${cur.monthly_label}/mês` : ''}`
          ) : contact ? (
            `Promover ${contact.name || fmtPhone(contact.phone)} a cliente`
          ) : (
            'Cadastre quem compra ou assina algo da sua empresa'
          )
        }
        maxWidth="sm"
        disableClose={busy}
        tabs={
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40 }, minHeight: 40 }}
          >
            <Tab value="data" label="Dados" />
            <Tab value="subs" label={`Assinaturas${subs.length ? ` (${subs.length})` : ''}`} disabled={!cur?.id} />
            <Tab value="contacts" label={`Números${cur?.contacts?.length > 1 ? ` (${cur.contacts.length})` : ''}`} disabled={!cur?.id} />
            <Tab value="addresses" label={`Endereços${f.addresses.length ? ` (${f.addresses.length})` : ''}`} />
            {cur?.id && canManage ? <Tab value="history" label="Histórico" /> : null}
            <Tab
              value="more"
              label={
                cfErr ? (
                  <Box component="span" sx={{ color: 'error.main' }}>
                    Mais •
                  </Box>
                ) : (
                  'Mais'
                )
              }
            />
          </Tabs>
        }
        footer={
          <>
            {cur?.id && canDelete ? (
              <Button
                color="error"
                onClick={() => setConfirm({ kind: 'customer' })}
                disabled={busy}
                sx={{ textTransform: 'none', mr: 'auto' }}
              >
                Remover cliente
              </Button>
            ) : null}
            <Button color="inherit" onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
              {cur?.id ? 'Fechar' : 'Cancelar'}
            </Button>
            {/* Assinaturas e Números salvam na hora (cada ação tem o próprio botão) — o "Salvar" do cadastro
                ali confundia: parecia que a assinatura em edição só valia depois dele */}
            {!(cur?.id && (tab === 'subs' || tab === 'contacts' || tab === 'history' || erased)) ? (
              <Button
                variant="contained"
                disableElevation
                onClick={save}
                disabled={busy}
                startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <IconCheck size={16} />}
                sx={waPrimaryBtn}
              >
                {cur?.id ? 'Salvar' : 'Cadastrar'}
              </Button>
            ) : null}
          </>
        }
      >
        {tab === 'data' ? (
          <Stack spacing={1.5}>
            {erased ? (
              <Alert severity="warning" icon={<IconShieldLock size={18} />}>
                Os dados pessoais deste cliente foram apagados a pedido do titular (LGPD). O cadastro fica só para o histórico financeiro
                (cobranças pagas) e não pode mais ser editado.
              </Alert>
            ) : null}
            <TextField
              size="small"
              label="Nome do cliente"
              value={f.name}
              onChange={(e) => set('name', e.target.value.slice(0, 255))}
              fullWidth
              autoFocus={!cur?.id}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                label={identity?.code_label || 'Código / matrícula / contrato'}
                value={f.code}
                onChange={(e) => set('code', e.target.value.slice(0, 32))}
                fullWidth
                error={Boolean(fieldErr.code)}
                helperText={
                  fieldErr.code ||
                  (identity?.use_code ? 'O cliente pode se identificar no bot por este código.' : 'Opcional. Único por cliente.')
                }
              />
              <TextField
                select
                size="small"
                label="Tipo"
                value={f.kind}
                onChange={(e) => set('kind', e.target.value)}
                sx={{ minWidth: { sm: 160 } }}
              >
                <MenuItem value="person">Pessoa física</MenuItem>
                <MenuItem value="company">Empresa</MenuItem>
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              {units.length || f.unit_id ? (
                <TextField
                  select
                  size="small"
                  label="Unidade"
                  value={f.unit_id}
                  onChange={(e) => set('unit_id', e.target.value)}
                  fullWidth
                  helperText="Filial / loja / base do cliente."
                >
                  <MenuItem value="">
                    <em>Sem unidade</em>
                  </MenuItem>
                  {units
                    .filter((u) => u.active || u.id === f.unit_id)
                    .map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.name}
                        {u.code ? ` · ${u.code}` : ''}
                      </MenuItem>
                    ))}
                  {f.unit_id && !units.some((u) => u.id === f.unit_id) ? (
                    <MenuItem value={f.unit_id} disabled>
                      {cur?.unit?.name || 'Unidade atual'}
                    </MenuItem>
                  ) : null}
                </TextField>
              ) : null}
              <TextField
                size="small"
                label="Código externo"
                value={f.external_id}
                onChange={(e) => set('external_id', e.target.value.slice(0, 64))}
                fullWidth
                error={Boolean(fieldErr.external_id)}
                helperText={fieldErr.external_id || 'Id do cliente no seu sistema (ERP, loja…). Opcional, único.'}
              />
            </Stack>
            {!cur?.id && (needAnother || another) ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Este WhatsApp já pertence a outro cliente.
                <FormControlLabel
                  sx={{ display: 'flex', mt: 0.5 }}
                  control={<Switch size="small" checked={anotherOk} onChange={(e) => setAnotherOk(e.target.checked)} />}
                  label="Cadastrar outro cliente neste número mesmo assim"
                />
              </Alert>
            ) : null}
            <TextField
              size="small"
              label="WhatsApp"
              value={cur?.id || contact ? fmtPhone(f.phone) : f.phone}
              onChange={(e) => set('phone', e.target.value)}
              fullWidth
              disabled={Boolean(cur?.id || contact)}
              helperText={cur?.id || contact ? 'É o contato desta conversa.' : 'Com DDI e DDD, só números: 5511999999999'}
              inputProps={{ inputMode: 'numeric' }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                label="CPF ou CNPJ"
                value={maskDoc(f.doc)}
                onChange={(e) => set('doc', e.target.value)}
                fullWidth
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                size="small"
                label="E-mail"
                type="email"
                value={f.email}
                onChange={(e) => set('email', e.target.value.slice(0, 255))}
                fullWidth
              />
            </Stack>
            <Divider>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                Endereço de cobrança (boleto)
              </Typography>
            </Divider>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                label="CEP"
                value={maskCep(f.address.zip)}
                onChange={(e) => setAddr('zip', e.target.value)}
                sx={{ width: { sm: 150 } }}
                inputProps={{ inputMode: 'numeric' }}
              />
              <TextField
                size="small"
                label="Rua"
                value={f.address.street}
                onChange={(e) => setAddr('street', e.target.value.slice(0, 120))}
                fullWidth
              />
              <TextField
                size="small"
                label="Nº"
                value={f.address.number}
                onChange={(e) => setAddr('number', e.target.value.slice(0, 20))}
                sx={{ width: { sm: 110 } }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                label="Complemento"
                value={f.address.complement}
                onChange={(e) => setAddr('complement', e.target.value.slice(0, 60))}
                fullWidth
              />
              <TextField
                size="small"
                label="Bairro"
                value={f.address.district}
                onChange={(e) => setAddr('district', e.target.value.slice(0, 80))}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                label="Cidade"
                value={f.address.city}
                onChange={(e) => setAddr('city', e.target.value.slice(0, 80))}
                fullWidth
              />
              <TextField
                select
                size="small"
                label="UF"
                value={f.address.state}
                onChange={(e) => setAddr('state', e.target.value)}
                sx={{ width: { sm: 110 } }}
              >
                <MenuItem value="">—</MenuItem>
                {UFS.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        ) : null}

        {tab === 'subs' ? (
          <Stack spacing={1.25}>
            {!activeProducts.length && !subs.length ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Você ainda não tem produtos cadastrados. Dá para criar a assinatura com um nome livre, ou cadastre o catálogo em{' '}
                <strong>WhatsApp → Produtos</strong>.
              </Alert>
            ) : null}
            {subs.map((s) =>
              subForm && subForm !== 'new' && subForm.id === s.id ? (
                <SubscriptionForm
                  key={s.id}
                  initial={s}
                  customerId={cur?.id}
                  products={activeProducts}
                  busy={subBusy}
                  reloadKey={subsKey}
                  cfDefs={subDefs}
                  cfServerErrors={subCfErr}
                  onCancel={() => {
                    setSubForm(null);
                    setSubCfErr(null);
                  }}
                  onSave={saveSub}
                />
              ) : (
                <SubscriptionRow
                  cfDefs={subDefs}
                  key={s.id}
                  s={s}
                  products={products}
                  cancelReasons={cancelReasons || []}
                  reloadKey={subsKey}
                  onChanged={reloadCustomer}
                  onEdit={() => setSubForm(s)}
                  onRemove={() => setConfirm({ kind: 'sub', s })}
                />
              )
            )}
            {subForm === 'new' ? (
              <SubscriptionForm
                products={activeProducts}
                customerId={cur?.id}
                busy={subBusy}
                reloadKey={subsKey}
                cfDefs={subDefs}
                cfServerErrors={subCfErr}
                onCancel={() => {
                  setSubForm(null);
                  setSubCfErr(null);
                }}
                onSave={saveSub}
              />
            ) : (
              <Button
                startIcon={<IconPlus size={16} />}
                onClick={() => setSubForm('new')}
                sx={{ alignSelf: 'flex-start', fontWeight: 700, textTransform: 'none' }}
              >
                Adicionar produto / assinatura
              </Button>
            )}
            {!subs.length && subForm !== 'new' ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                O que este cliente usa ou paga: produto, plano, serviço — com valor e dia de vencimento quando for recorrente.
              </Typography>
            ) : null}
            {cur?.id ? <EntitlementsList customerId={cur.id} reloadKey={subsKey} canManage={canManage} /> : null}
            {cur?.id && canFinanceCards ? (
              <SavedCards customerId={cur.id} reloadKey={subsKey} canManage={canManage} onChanged={reloadCustomer} />
            ) : null}
          </Stack>
        ) : null}

        {tab === 'contacts' && cur?.id ? (
          <Stack spacing={1.5}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Todos os WhatsApps desta pessoa ou empresa. Qualquer um deles é reconhecido como este cliente no chat e no bot.
            </Typography>
            {(cur.contacts || []).map((ct) => (
              <Stack
                key={ct.id}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {fmtPhone(ct.phone) || ct.wa_id}
                    {ct.primary ? (
                      <Chip size="small" label="principal" sx={{ ml: 0.75, height: 18, fontSize: 11, fontWeight: 700 }} />
                    ) : null}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                    {ct.name || 'sem nome'}
                    {ct.linked_by === 'bot' ? ' · vinculado pelo bot' : ct.linked_by === 'import' ? ' · importado' : ''}
                  </Typography>
                </Box>
                <TextField
                  select
                  size="small"
                  value={ct.role}
                  onChange={(e) => changeRole(ct.id, e.target.value)}
                  disabled={linkBusy}
                  sx={{ width: 140 }}
                >
                  {ROLES.map((r) => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </TextField>
                <Tooltip title={(cur.contacts || []).length <= 1 ? 'O cliente precisa ter pelo menos um número' : 'Desvincular'}>
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => unlink(ct.id)}
                      disabled={linkBusy || (cur.contacts || []).length <= 1}
                    >
                      <IconTrash size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            ))}
            <Divider>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                Vincular outro número
              </Typography>
            </Divider>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="WhatsApp (DDI+DDD+número)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                inputProps={{ inputMode: 'numeric' }}
                sx={{ flex: 1 }}
                onKeyDown={(e) => e.key === 'Enter' && !linkBusy && linkPhone()}
              />
              <TextField select size="small" value={newRole} onChange={(e) => setNewRole(e.target.value)} sx={{ width: { sm: 140 } }}>
                {ROLES.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                startIcon={linkBusy ? <CircularProgress size={14} /> : <IconUserPlus size={16} />}
                onClick={linkPhone}
                disabled={linkBusy}
                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                Vincular
              </Button>
            </Stack>
          </Stack>
        ) : null}

        {tab === 'addresses' ? <AddressesEditor value={f.addresses} onChange={(v) => set('addresses', v)} disabled={busy} /> : null}

        {tab === 'history' && cur?.id && canManage ? (
          <Stack spacing={1.25}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Tudo que a equipe (ou a API) mudou neste cliente, nas assinaturas, cobranças e cartões dele.
            </Typography>
            <AuditList
              query={{ entity: 'customers', entity_id: cur.id }}
              pageSize={15}
              dense
              reloadKey={subsKey}
              emptyText="Nenhuma alteração registrada ainda (o histórico começa a valer a partir da auditoria)."
            />
          </Stack>
        ) : null}

        {tab === 'more' ? (
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                select
                size="small"
                label="Situação do cliente"
                value={f.status}
                onChange={(e) => set('status', e.target.value)}
                fullWidth
              >
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="inactive">Inativo</MenuItem>
              </TextField>
              <TextField
                size="small"
                type="date"
                label="Cliente desde"
                value={f.since || ''}
                onChange={(e) => set('since', e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            {cfDefs.length ? (
              <>
                <Divider>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                    Campos da sua empresa
                  </Typography>
                </Divider>
                <CustomFieldsInputs
                  defs={cfDefs}
                  values={f.custom}
                  onChange={(v) => {
                    setF((x) => ({ ...x, custom: v }));
                    if (cfErr) setCfErr(null);
                  }}
                  errors={cfErr}
                  disabled={busy}
                />
              </>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Precisa de campos próprios (contrato, placa, matrícula…)? Crie em{' '}
                <strong>WhatsApp → Clientes → Campos personalizados</strong>.
              </Typography>
            )}
            <TextField
              size="small"
              label="Observações"
              value={f.notes}
              onChange={(e) => set('notes', e.target.value.slice(0, 20000))}
              fullWidth
              multiline
              minRows={4}
              maxRows={12}
              placeholder="Tudo que a equipe precisa lembrar sobre este cliente."
            />
            {cur?.id && canManage ? (
              <Box
                sx={(t) => ({
                  mt: 1,
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: `rgba(${t.vars.palette.error.mainChannel} / 0.35)`,
                  bgcolor: `rgba(${t.vars.palette.error.mainChannel} / 0.04)`
                })}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <IconShieldLock size={18} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Privacidade (LGPD)
                  </Typography>
                  {erased ? (
                    <Chip
                      size="small"
                      color="error"
                      variant="outlined"
                      label="Dados apagados (LGPD)"
                      sx={{ height: 20, fontWeight: 700 }}
                    />
                  ) : null}
                </Stack>
                <Typography variant="caption" component="div" sx={{ color: 'text.secondary', mb: 1.25 }}>
                  O titular pode pedir uma cópia dos dados ou que eles sejam apagados. Apagar cancela assinaturas, cobranças em aberto,
                  cartões e agendamentos/pedidos futuros e anonimiza o cadastro. Cobranças pagas continuam (obrigação legal), sem dados
                  pessoais.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={exportData}
                    disabled={exportBusy}
                    startIcon={exportBusy ? <CircularProgress size={14} color="inherit" /> : <IconDownload size={16} />}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Exportar dados (LGPD)
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      setEraseText('');
                      setEraseMsgs(false);
                      setEraseOpen(true);
                    }}
                    disabled={erased || eraseBusy}
                    startIcon={<IconTrashX size={16} />}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    {erased ? 'Dados já apagados' : 'Apagar dados do cliente'}
                  </Button>
                </Stack>
              </Box>
            ) : null}
          </Stack>
        ) : null}
      </CrmModal>

      <Dialog
        open={eraseOpen}
        onClose={() => !eraseBusy && setEraseOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ color: 'error.main', display: 'flex' }}>
            <IconTrashX size={20} />
          </Box>
          Apagar dados do cliente?
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              <strong>{cur?.name}</strong> terá os dados pessoais apagados de vez: assinaturas e cobranças em aberto são canceladas (também
              no gateway), cartões salvos são removidos, agendamentos, chamados e pedidos em aberto são cancelados e o nome, documento,
              e-mail, endereços, observações e campos personalizados somem. Não dá para desfazer.
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Cobranças pagas ficam no histórico financeiro (obrigação legal), sem dados pessoais. Números que também são de outro cliente
              não são alterados. O histórico (auditoria) deste cliente fica sem os detalhes, mensagens na fila de envio são canceladas e os
              sistemas ligados por webhook recebem só o aviso de que os dados foram apagados. Se algo falhar no meio, é só apagar de novo: o
              que já foi feito não se repete.
            </Typography>
            <FormControlLabel
              control={<Checkbox checked={eraseMsgs} onChange={(e) => setEraseMsgs(e.target.checked)} disabled={eraseBusy} />}
              label={<Typography variant="body2">Apagar também as conversas e mídias</Typography>}
            />
            <TextField
              size="small"
              label="Digite APAGAR para confirmar"
              value={eraseText}
              onChange={(e) => setEraseText(e.target.value)}
              disabled={eraseBusy}
              autoFocus
              fullWidth
              onKeyDown={(e) => {
                if (e.key === 'Enter' && eraseText.trim().toUpperCase() === 'APAGAR') eraseData();
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setEraseOpen(false)} disabled={eraseBusy} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            onClick={eraseData}
            disabled={eraseBusy || eraseText.trim().toUpperCase() !== 'APAGAR'}
            startIcon={eraseBusy ? <CircularProgress size={14} color="inherit" /> : <IconTrashX size={16} />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Apagar dados
          </Button>
        </DialogActions>
      </Dialog>

      <TgConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.kind === 'sub' ? removeSub : removeCustomer}
        loading={subBusy || busy}
        danger
        title={confirm?.kind === 'sub' ? 'Excluir esta assinatura?' : 'Remover este cliente?'}
        message={
          confirm?.kind === 'sub'
            ? `${confirm.s?.product_name} sai do cadastro do cliente. O histórico de cobranças não é apagado.`
            : 'O cadastro de cliente e as assinaturas dele são apagados. O contato do WhatsApp e a conversa continuam.'
        }
        confirmLabel={confirm?.kind === 'sub' ? 'Excluir' : 'Remover'}
      />
    </>
  );
}
