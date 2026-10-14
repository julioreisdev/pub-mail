import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconArrowRight } from '@tabler/icons-react';

import { WaNumberChip } from '../waKit';
import { fmtAgo, fmtPhone } from '../waShared';
import {
  DeliveryChip,
  OrderStatusChip,
  PaymentChip,
  actionLabel,
  forwardStatuses,
  orderPersonName,
  orderPersonPhone,
  orderStatusOf
} from './orderKit';

// ============================================================================
// Cartão do pedido (quadro, lista no celular e aba "Pedidos" do chat):
// código, cliente, itens, total, pagamento, entrega, idade e ação rápida
// (próximo status permitido). `draggable` liga o arrastar do quadro.
// ============================================================================

export default function OrderCard({ o, onClick, onMove, busy, showStatus, showSession, draggable, onDragStart, onDragEnd, dense }) {
  const person = orderPersonName(o);
  const phone = orderPersonPhone(o);
  const next = forwardStatuses(o)[0];
  const st = orderStatusOf(o.status);
  const stale = o.status === 'new' && o.created_at && Date.now() - new Date(o.created_at).getTime() > 30 * 60000;
  return (
    <Box
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      sx={(t) => ({
        p: dense ? 1 : 1.25,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `3px solid ${st.color}`,
        cursor: draggable ? 'grab' : 'pointer',
        userSelect: draggable ? 'none' : 'auto',
        minWidth: 0,
        transition: 'box-shadow .15s, transform .15s',
        '&:hover': { boxShadow: 3, transform: 'translateY(-1px)' },
        '&:active': draggable ? { cursor: 'grabbing' } : {},
        ...t.applyStyles('dark', { borderLeftColor: st.dark })
      })}
    >
      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
        <Typography
          sx={{ fontWeight: 800, fontSize: 14, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', flexShrink: 0 }}
        >
          {o.code}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap title={person || phone}>
          {person || fmtPhone(phone) || 'Sem contato'}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 800, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {o.total_label}
        </Typography>
      </Stack>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          mt: 0.25,
          overflowWrap: 'anywhere'
        }}
        title={o.items_text}
      >
        {o.items_count} {o.items_count === 1 ? 'item' : 'itens'} · {(o.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ')}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
        {showStatus ? <OrderStatusChip status={o.status} label={o.status_label} /> : null}
        <PaymentChip order={o} short />
        <DeliveryChip order={o} />
        {showSession && o.session ? <WaNumberChip session={o.session} /> : null}
        <Box sx={{ flex: 1 }} />
        <Typography
          variant="caption"
          sx={(t) => ({
            color: stale ? '#B45309' : 'text.secondary',
            fontWeight: stale ? 700 : 400,
            whiteSpace: 'nowrap',
            ...(stale ? t.applyStyles('dark', { color: '#FBBF24' }) : {})
          })}
          title={o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : ''}
        >
          {fmtAgo(o.created_at)}
        </Typography>
      </Stack>
      {onMove && next ? (
        <Button
          size="small"
          fullWidth
          variant="outlined"
          disabled={busy}
          endIcon={busy ? <CircularProgress size={13} /> : <IconArrowRight size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            onMove(o, next);
          }}
          sx={{ mt: 1, textTransform: 'none', fontWeight: 700, borderRadius: 1.5, py: 0.25 }}
        >
          {actionLabel(next, o)}
        </Button>
      ) : null}
    </Box>
  );
}
