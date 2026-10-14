import { useCallback, useEffect, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  IconBuildingStore,
  IconCash,
  IconCircleCheck,
  IconCircleX,
  IconClockDollar,
  IconInbox,
  IconPackage,
  IconToolsKitchen2,
  IconTruckDelivery
} from '@tabler/icons-react';

import { get, post } from 'api/api';
import { errMsg } from '../waShared';
import { ToneChip } from '../tickets/ticketKit';

// ============================================================================
// Pedidos (Fase 7, contrato docs/whatsapp-assinaturas-contrato.md §11.3) — peças
// compartilhadas: andamento (status), pagamento, entrega, textos padrão (iguais ao
// back `DEFAULT_ORDER_TEXTS`), totais (mesma conta do back `computeTotals`),
// campos personalizados de pedido e carga das configurações/unidades.
// ============================================================================

export const API = '/whatsapp/orders';

// ----------------------------------------------------------------------------
// Andamento
// ----------------------------------------------------------------------------
export const ORDER_STATUS = {
  new: { label: 'Recebido', color: '#2563EB', dark: '#60A5FA', icon: IconInbox, action: 'Confirmar' },
  confirmed: { label: 'Confirmado', color: '#7C3AED', dark: '#A78BFA', icon: IconCircleCheck, action: 'Confirmar' },
  preparing: { label: 'Em preparo', color: '#B45309', dark: '#FBBF24', icon: IconToolsKitchen2, action: 'Preparar' },
  out_for_delivery: {
    label: 'Saiu para entrega',
    color: '#0E7490',
    dark: '#22D3EE',
    icon: IconTruckDelivery,
    action: 'Saiu para entrega'
  },
  delivered: { label: 'Entregue', color: '#128C7E', dark: '#25D366', icon: IconPackage, action: 'Entregue' },
  canceled: { label: 'Cancelado', color: '#64748B', dark: '#94A3B8', icon: IconCircleX, action: 'Cancelar' }
};
export const ORDER_STATUS_KEYS = ['new', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'canceled'];
export const OPEN_STATUSES = ['new', 'confirmed', 'preparing', 'out_for_delivery'];
export const orderStatusOf = (s) => ORDER_STATUS[s] || { label: s || '—', color: '#64748B', dark: '#94A3B8', icon: IconInbox, action: s };

/** Rótulo do botão que leva o pedido ao status `to` (retirada: "Retirado" no lugar de "Entregue"). */
export const actionLabel = (to, order) => {
  if (to === 'delivered' && order?.delivery?.mode !== 'delivery') return 'Retirado';
  return orderStatusOf(to).action;
};

/** Próximos status "de avanço" (sem cancelar); retirada não passa por "saiu para entrega". */
export const forwardStatuses = (o) =>
  (o?.next_statuses || []).filter((s) => s !== 'canceled' && !(s === 'out_for_delivery' && o?.delivery?.mode !== 'delivery'));

export function OrderStatusChip({ status, label, size, sx }) {
  const s = orderStatusOf(status);
  return <ToneChip tone={s} label={label || s.label} icon={s.icon} size={size} sx={sx} />;
}

// ----------------------------------------------------------------------------
// Pagamento
// ----------------------------------------------------------------------------
export const PAYMENT_METHOD_LABEL = { pix: 'PIX', on_delivery: 'Na entrega', link: 'Link de pagamento', none: 'Sem pagamento' };
export const PAYMENT_STATUS = {
  pending: { label: 'Aguardando pagamento', short: 'A pagar', color: '#B45309', dark: '#FBBF24', icon: IconClockDollar },
  paid: { label: 'Pago', short: 'Pago', color: '#128C7E', dark: '#25D366', icon: IconCash },
  not_required: { label: 'Paga na entrega', short: 'Na entrega', color: '#64748B', dark: '#94A3B8', icon: IconCash }
};
export const paymentStatusOf = (s) => PAYMENT_STATUS[s] || { label: s || '—', short: s || '—', color: '#64748B', dark: '#94A3B8' };

export function PaymentChip({ order, short, size, sx }) {
  const p = paymentStatusOf(order?.payment_status);
  let label = short ? p.short : order?.payment_status_label || p.label;
  const pickup = order?.delivery?.mode === 'pickup' || order?.delivery === 'pickup';
  if (order?.payment_status === 'not_required' && order?.payment_method === 'none') label = 'Sem pagamento';
  else if (order?.payment_status === 'not_required' && pickup) label = short ? 'Na retirada' : 'Paga na retirada';
  else if (short && order?.payment_status !== 'not_required' && order?.payment_method)
    label = `${order.payment_method === 'on_delivery' && pickup ? 'Na retirada' : PAYMENT_METHOD_LABEL[order.payment_method] || order.payment_method} · ${p.short.toLowerCase()}`;
  return <ToneChip tone={p} label={label} icon={p.icon} size={size} sx={sx} />;
}

export function DeliveryChip({ order, size, sx }) {
  const delivery = order?.delivery?.mode === 'delivery';
  const tone = delivery ? { color: '#0E7490', dark: '#22D3EE' } : { color: '#64748B', dark: '#94A3B8' };
  return (
    <ToneChip
      tone={tone}
      label={delivery ? 'Entrega' : 'Retirada'}
      icon={delivery ? IconTruckDelivery : IconBuildingStore}
      size={size}
      sx={sx}
    />
  );
}

// ----------------------------------------------------------------------------
// Pessoa, endereço, totais
// ----------------------------------------------------------------------------
export const orderPersonName = (o) => o?.customer?.name || o?.contact?.name || '';
export const orderPersonPhone = (o) => o?.customer?.phone || o?.contact?.phone || '';

/** Mesmo texto do back `addressLine`. */
export const addressLine = (a) => {
  if (!a) return '';
  if (typeof a === 'string') return a;
  return [
    [a.street, a.number].filter(Boolean).join(', '),
    a.complement,
    a.district,
    [a.city, a.state].filter(Boolean).join('/'),
    a.zip ? `CEP ${a.zip}` : ''
  ]
    .filter(Boolean)
    .join(' · ');
};

export const ADDRESS_KIND_LABEL = { service: 'Atendimento', delivery: 'Entrega', billing: 'Cobrança', other: 'Outro' };

/** Mesma conta do back `computeTotals` (prévia no "Novo pedido"; o valor final é sempre o do servidor). */
export const computeTotals = (items, s, mode, discountCents = 0) => {
  const subtotal = items.reduce((acc, i) => acc + i.qty * i.unit_cents, 0);
  const d = s?.delivery || {};
  const fee = mode === 'delivery' && d.enabled ? (d.free_from_cents > 0 && subtotal >= d.free_from_cents ? 0 : d.fee_cents || 0) : 0;
  const discount = Math.max(0, Math.min(Math.round(discountCents) || 0, subtotal + fee));
  return { subtotal_cents: subtotal, delivery_fee_cents: fee, discount_cents: discount, total_cents: subtotal + fee - discount };
};

// ----------------------------------------------------------------------------
// Textos padrão (iguais ao back) + variáveis
// ----------------------------------------------------------------------------
export const DEFAULT_TEXTS = {
  created:
    'Recebemos seu pedido *#{{pedido.numero}}* ✅\n\n{{pedido.itens}}\n\n*Total: {{pedido.total}}*\n{{pedido.entrega}}\n💳 {{pedido.pagamento}}',
  confirmed: 'Pedido *#{{pedido.numero}}* confirmado 👍 Já vamos começar.',
  paid: 'Pagamento do pedido *#{{pedido.numero}}* confirmado ✅',
  preparing: 'Seu pedido *#{{pedido.numero}}* está sendo preparado 👨‍🍳',
  out_for_delivery: 'Seu pedido *#{{pedido.numero}}* saiu para entrega 🛵',
  delivered: 'Pedido *#{{pedido.numero}}* entregue. Obrigado pela preferência! 💚',
  canceled: 'O pedido *#{{pedido.numero}}* foi cancelado.{{pedido.motivo}}'
};

export const TEXT_VARS = [
  '{{cliente.nome}}',
  '{{cliente.primeiro_nome}}',
  '{{pedido.numero}}',
  '{{pedido.itens}}',
  '{{pedido.total}}',
  '{{pedido.status}}',
  '{{pedido.entrega}}',
  '{{pedido.pagamento}}',
  '{{pedido.motivo}}'
];

/** Configurações iguais ao back `normalizeOrderSettings` (usadas enquanto o GET não volta). */
export const DEFAULT_SETTINGS = {
  enabled: true,
  delivery: { enabled: true, fee_cents: 0, free_from_cents: 0 },
  pickup: { enabled: true, address: '' },
  min_order_cents: 0,
  payment_methods: ['pix', 'on_delivery'],
  max_items: 30,
  pix_minutes: 60,
  notify_customer: { confirmed: true, preparing: true, out_for_delivery: true, delivered: true, canceled: true },
  texts: { ...DEFAULT_TEXTS }
};

/** Muda o status no servidor (devolve o pedido já formatado). */
export const moveOrder = (id, status, extra = {}) => post(`${API}/${id}/status`, { status, ...extra });

// ----------------------------------------------------------------------------
// Erros (mensagem pode vir como objeto { code, message, fields })
// ----------------------------------------------------------------------------
export const orderErr = (e, fb) => {
  const d = e?.response?.data;
  const m = d?.message;
  if (m && typeof m === 'object' && !Array.isArray(m)) {
    if (m.code === 'CUSTOM_REQUIRED' && Array.isArray(m.fields)) return `Preencha: ${m.fields.map((f) => f.label || f.key).join(', ')}.`;
    if (m.code === 'CUSTOM_INVALID' && Array.isArray(m.fields))
      return m.fields.map((f) => `${f.label || f.key}: ${f.error || 'inválido'}`).join(' · ');
    if (m.message) return String(m.message);
  }
  return errMsg(e, fb);
};

// ----------------------------------------------------------------------------
// Configurações + unidades + campos de pedido (com sequência: resposta antiga não sobrescreve)
// ----------------------------------------------------------------------------
export function useOrderBase() {
  const [settings, setSettings] = useState(null);
  const [units, setUnits] = useState([]);
  const [fields, setFields] = useState([]);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const s = ++seq.current;
    const [st, un, crm] = await Promise.all([
      get(`${API}/settings`).catch(() => null),
      get('/whatsapp/units').catch(() => []),
      get('/whatsapp/crm-settings').catch(() => null)
    ]);
    if (s !== seq.current) return;
    setSettings(st || DEFAULT_SETTINGS);
    setUnits(Array.isArray(un) ? un : un?.items || []);
    const cf = crm?.custom_fields;
    setFields(cf && !Array.isArray(cf) && Array.isArray(cf.order) ? cf.order : []);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { settings, setSettings, units, fields, reload, loading: settings === null };
}

// ----------------------------------------------------------------------------
// Campos personalizados do pedido (definições em crm-settings.custom_fields.order)
// ----------------------------------------------------------------------------
export function CustomFieldInputs({ fields = [], value = {}, onChange, disabled }) {
  if (!fields.length) return null;
  const set = (k, v) => onChange({ ...(value || {}), [k]: v });
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2, minmax(0,1fr))' } }}>
      {fields.map((f) => {
        const v = value?.[f.key];
        const label = `${f.label || f.key}${f.required ? ' *' : ''}`;
        if (f.type === 'bool')
          return (
            <Stack key={f.key} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Switch size="small" checked={v === true} onChange={(e) => set(f.key, e.target.checked)} disabled={disabled} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {label}
              </Typography>
            </Stack>
          );
        if (f.type === 'select')
          return (
            <TextField
              key={f.key}
              select
              size="small"
              label={label}
              value={v ?? ''}
              onChange={(e) => set(f.key, e.target.value)}
              disabled={disabled}
              helperText={f.help || ' '}
            >
              <MenuItem value="">—</MenuItem>
              {(f.options || []).map((o) => (
                <MenuItem key={o} value={o}>
                  {o}
                </MenuItem>
              ))}
            </TextField>
          );
        return (
          <TextField
            key={f.key}
            size="small"
            label={label}
            value={v ?? ''}
            type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
            InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
            inputProps={f.type === 'phone' || f.type === 'cpf' ? { inputMode: 'numeric' } : undefined}
            onChange={(e) => set(f.key, e.target.value)}
            disabled={disabled}
            helperText={f.help || ' '}
          />
        );
      })}
    </Box>
  );
}

/** Lista "Rótulo: valor" dos campos personalizados preenchidos. */
export const customEntries = (fields = [], custom = {}) => {
  const known = new Set(fields.map((f) => f.key));
  const out = fields
    .filter((f) => custom?.[f.key] !== undefined && custom?.[f.key] !== null && custom?.[f.key] !== '')
    .map((f) => ({
      key: f.key,
      label: f.label || f.key,
      value: f.type === 'bool' ? (custom[f.key] ? 'Sim' : 'Não') : String(custom[f.key])
    }));
  Object.entries(custom || {}).forEach(([k, v]) => {
    if (!known.has(k) && v !== null && v !== '' && typeof v !== 'object') out.push({ key: k, label: k, value: String(v) });
  });
  return out;
};
