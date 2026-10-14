import { useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconBan,
  IconCash,
  IconCircleCheck,
  IconClock,
  IconGift,
  IconPlayerPause,
  IconPlayerPlay,
  IconPencil,
  IconPlus,
  IconReceiptRefund,
  IconRefresh,
  IconRotateClockwise,
  IconTicket,
  IconTrendingUp
} from '@tabler/icons-react';

import { get } from 'api/api';
import { errMsg, tint } from '../waShared';
import { cancelPolicyLabel, fmtDateBR, fmtPercent, formatBRL, billingLabel } from './crmKit';

// ============================================================================
// Linha do tempo de uma assinatura — GET /whatsapp/subscriptions/:id/events
// Cada evento: { id, kind, data, user_id, source, created_at }.
// ============================================================================

const SOURCE = { panel: 'painel', bot: 'bot', api: 'API', import: 'importação', system: 'automático' };
const VIA = { pix: 'PIX', boleto: 'boleto', card: 'cartão', credit: 'crédito', manual: 'manual' };

const KINDS = {
  created: { label: 'Assinatura criada', icon: IconPlus, token: 'primary' },
  trial_started: { label: 'Teste grátis iniciado', icon: IconGift, token: 'info' },
  activated: { label: 'Ativada (1º pagamento)', icon: IconCircleCheck, token: 'success' },
  paid: { label: 'Pagamento recebido', icon: IconCash, token: 'success' },
  overdue: { label: 'Em atraso', icon: IconAlertTriangle, token: 'warning' },
  paused: { label: 'Pausada', icon: IconPlayerPause, token: 'info' },
  resumed: { label: 'Retomada', icon: IconPlayerPlay, token: 'success' },
  plan_changed: { label: 'Troca de plano', icon: IconArrowsExchange, token: 'primary' },
  canceled: { label: 'Cancelada', icon: IconBan, token: 'error' },
  reactivated: { label: 'Reativada', icon: IconRotateClockwise, token: 'success' },
  price_changed: { label: 'Valor alterado', icon: IconTrendingUp, token: 'warning' },
  coupon_applied: { label: 'Cupom aplicado', icon: IconTicket, token: 'primary' },
  manual_edit: { label: 'Editada no painel', icon: IconPencil, token: 'info' },
  paid_after_cancel: { label: 'Pagamento depois do cancelamento', icon: IconReceiptRefund, token: 'warning' }
};

// `manual_edit` traz { fields, from, to } com os nomes das colunas — rótulos legíveis
const FIELD_LABEL = {
  price_cents: 'valor',
  due_day: 'dia de vencimento',
  next_due_at: 'próximo vencimento',
  start_date: 'início',
  status: 'situação',
  product_id: 'produto',
  product_name: 'produto',
  billing: 'cobrança',
  billing_interval_months: 'intervalo',
  payment_method: 'meio de pagamento',
  payment_method_id: 'cartão',
  notes: 'observações',
  external_id: 'código externo',
  contract_number: 'contrato',
  custom: 'campos personalizados',
  discount_cents: 'desconto',
  discount_until: 'desconto até'
};
const SUB_STATUS_LABEL = { active: 'ativa', overdue: 'em atraso', paused: 'pausada', canceled: 'cancelada' };
const showValue = (k, v) => {
  if (v == null || v === '') return '—';
  if (k === 'price_cents' || k === 'discount_cents') return money(v);
  if (/_at$|_date$|_until$/.test(k) && /^\d{4}-\d{2}-\d{2}/.test(String(v))) return fmtDateBR(v);
  if (k === 'billing') return billingLabel(v);
  if (k === 'status') return SUB_STATUS_LABEL[v] || String(v);
  if (typeof v === 'object') return '…';
  const t = String(v);
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
};

/** Data e hora em Brasília (o servidor grava em UTC). */
const fmtBRT = (v) => {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(v));
  } catch {
    return '—';
  }
};

const money = (c) => (c == null || c === '' ? '' : formatBRL(c));

/** Detalhes legíveis do `data` de cada tipo de evento (lista de frases curtas). */
function details(kind, d) {
  const x = d && typeof d === 'object' ? d : {};
  const out = [];
  switch (kind) {
    case 'created':
      if (x.product_name)
        out.push(
          `${x.product_name}${x.price_cents != null ? ` · ${money(x.price_cents)}` : ''}${x.billing ? ` · ${billingLabel(x.billing)}` : ''}`
        );
      if (x.start) out.push(`Início ${fmtDateBR(x.start)}`);
      if (x.due_day) out.push(`Vence todo dia ${x.due_day}`);
      if (x.next_due_at) out.push(`1º vencimento ${fmtDateBR(x.next_due_at)}`);
      if (x.first_charge?.amount_cents != null)
        out.push(`1ª cobrança ${money(x.first_charge.amount_cents)} em ${fmtDateBR(x.first_charge.due_at)}`);
      break;
    case 'trial_started':
      if (x.days) out.push(`${x.days} dia${Number(x.days) === 1 ? '' : 's'} grátis`);
      if (x.ends_at) out.push(`até ${fmtDateBR(x.ends_at)}`);
      if (x.first_due_at) out.push(`1º vencimento ${fmtDateBR(x.first_due_at)}`);
      break;
    case 'activated':
      break;
    case 'paid':
      if (x.amount_cents != null) out.push(money(x.amount_cents));
      if (x.via) out.push(x.via === 'manual' ? 'marcado manualmente' : `via ${VIA[x.via] || String(x.via)}`);
      if (x.next_due_at) out.push(`próximo vencimento ${fmtDateBR(x.next_due_at)}`);
      break;
    case 'overdue':
      if (x.due_at) out.push(`venceu ${fmtDateBR(x.due_at)}`);
      if (x.days_late != null) out.push(`${x.days_late} dia${Number(x.days_late) === 1 ? '' : 's'} de atraso`);
      if (x.grace_days) out.push(`carência de ${x.grace_days} dia${Number(x.grace_days) === 1 ? '' : 's'}`);
      break;
    case 'paused':
      if (x.until) out.push(`até ${fmtDateBR(x.until)}`);
      if (x.days) out.push(`${x.days} dia${Number(x.days) === 1 ? '' : 's'}`);
      break;
    case 'resumed':
      if (x.paused_from && x.paused_until) out.push(`pausa de ${fmtDateBR(x.paused_from)} a ${fmtDateBR(x.paused_until)}`);
      if (x.next_due_at) out.push(`próximo vencimento ${fmtDateBR(x.next_due_at)}`);
      break;
    case 'plan_changed':
      if (x.from_product_name || x.to_product_name)
        out.push(
          `${x.from_product_name || '—'}${x.from_price_cents != null ? ` (${money(x.from_price_cents)})` : ''} → ${x.to_product_name || '—'}${x.to_price_cents != null ? ` (${money(x.to_price_cents)})` : ''}`
        );
      if (x.credit_cents) out.push(`crédito de ${money(x.credit_cents)} na próxima cobrança`);
      break;
    case 'canceled':
      if (x.policy) out.push(cancelPolicyLabel(x.policy));
      // fim do ciclo = { scheduled:true, effective_at }; imediato = { policy:'immediate', effective_at } (sem `effective`)
      if (x.scheduled && x.effective_at) out.push(`agendado para ${fmtDateBR(x.effective_at)}`);
      else if ((x.effective || x.policy === 'immediate') && x.effective_at) out.push(`encerrada em ${fmtDateBR(x.effective_at)}`);
      if (x.reason) out.push(`motivo: ${x.reason}`);
      break;
    case 'reactivated':
      if (x.undo_scheduled_cancel) out.push('cancelamento agendado desfeito');
      if (x.next_due_at) out.push(`próximo vencimento ${fmtDateBR(x.next_due_at)}`);
      break;
    case 'price_changed':
      if (x.from_cents != null || x.to_cents != null) out.push(`${money(x.from_cents)} → ${money(x.to_cents)}`);
      if (x.percent) out.push(`reajuste de ${fmtPercent(x.percent)}`);
      break;
    case 'coupon_applied':
      if (x.code) out.push(x.code);
      if (x.value != null) out.push(x.kind === 'percent' ? `${x.value}%` : money(x.value));
      if (x.discount_cents) out.push(`desconto de ${money(x.discount_cents)}`);
      if (x.discount_until) out.push(`até ${fmtDateBR(x.discount_until)}`);
      break;
    case 'manual_edit': {
      const fields = Array.isArray(x.fields) ? x.fields : [];
      for (const k of fields.slice(0, 6)) {
        const from = x.from && typeof x.from === 'object' ? x.from[k] : undefined;
        const to = x.to && typeof x.to === 'object' ? x.to[k] : undefined;
        out.push(`${FIELD_LABEL[k] || k}: ${showValue(k, from)} → ${showValue(k, to)}`);
      }
      if (fields.length > 6) out.push(`+${fields.length - 6} campo(s)`);
      break;
    }
    case 'paid_after_cancel':
      if (x.amount_cents != null) out.push(money(x.amount_cents));
      if (x.via) out.push(x.via === 'manual' ? 'marcado manualmente' : `via ${VIA[x.via] || String(x.via)}`);
      out.push('a assinatura já estava cancelada — confira se precisa devolver ou reativar');
      break;
    default:
      break;
  }
  return out;
}

export default function SubscriptionTimeline({ subscriptionId, reloadKey }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError('');
    get(`/whatsapp/subscriptions/${subscriptionId}/events`)
      .then((r) => alive && setItems(Array.isArray(r) ? r : []))
      .catch((e) => {
        if (!alive) return;
        setError(errMsg(e, 'Não foi possível carregar o histórico.'));
        setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [subscriptionId, reloadKey, tick]);

  if (items === null)
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1.5, px: 1 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Carregando o histórico…
        </Typography>
      </Stack>
    );
  if (error)
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1, px: 1 }}>
        <Typography variant="caption" sx={{ color: 'error.main', flex: 1 }}>
          {error}
        </Typography>
        <Button size="small" startIcon={<IconRefresh size={14} />} onClick={() => setTick((n) => n + 1)} sx={{ textTransform: 'none' }}>
          Tentar de novo
        </Button>
      </Stack>
    );
  if (!items.length)
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', py: 1, px: 1 }}>
        Nenhum evento registrado ainda (assinaturas antigas não têm histórico).
      </Typography>
    );

  // mais recente primeiro
  const list = [...items].reverse();
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, pl: 0.5, pt: 0.5 }}>
      {list.map((ev, i) => {
        const k = KINDS[ev.kind] || { label: ev.kind, icon: IconClock, token: 'info' };
        const Icon = k.icon;
        const lines = details(ev.kind, ev.data);
        const last = i === list.length - 1;
        return (
          <Box component="li" key={ev.id || i} sx={{ display: 'flex', gap: 1.25, minWidth: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  color: `${k.token}.main`,
                  bgcolor: (t) => tint(t, k.token, 0.14)
                }}
              >
                <Icon size={14} />
              </Box>
              {!last ? <Box sx={{ width: 2, flex: 1, minHeight: 10, bgcolor: 'divider', my: 0.25 }} /> : null}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, pb: last ? 0 : 1.25 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.35 }}>
                {k.label}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                {fmtBRT(ev.created_at)}
                {ev.source ? ` · ${SOURCE[ev.source] || ev.source}` : ''}
              </Typography>
              {lines.length ? (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}>
                  {lines.join(' · ')}
                </Typography>
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
