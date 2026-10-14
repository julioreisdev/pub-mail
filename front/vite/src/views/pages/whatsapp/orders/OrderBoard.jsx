import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconLayoutKanban } from '@tabler/icons-react';

import { get } from 'api/api';
import { TgCard, TgEmptyState, TgListSkeleton } from 'views/pages/telegram/ui';
import { useNow } from '../waKit';
import { formatBRL } from '../crm/crmKit';
import { THIN_SCROLL } from '../chat/chatKit';
import OrderCard from './OrderCard';
import CancelOrderDialog from './CancelOrderDialog';
import { API, OPEN_STATUSES, moveOrder, orderErr, orderStatusOf } from './orderKit';

// ============================================================================
// Quadro de pedidos: uma coluna por status (GET /whatsapp/orders/board). Abertos
// todos; entregues/cancelados só dos últimos 2 dias. Arrastar só para um status
// permitido (`next_statuses` do pedido); soltar em "Cancelado" pede o motivo.
// Cartões com ação rápida (próximo status). Celular: colunas de 85vw com encaixe.
// ============================================================================

export default function OrderBoard({ sessionId, unitId, reloadToken, onOpen, onChanged, multi }) {
  useNow(60000); // idade dos cartões anda sozinha
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [over, setOver] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [cancel, setCancel] = useState(null);
  const [drag, setDrag] = useState(null); // pedido sendo arrastado (realça as colunas permitidas)
  const dragging = useRef(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const s = ++seq.current;
    setLoading(true);
    try {
      const r = await get(`${API}/board`, { params: { session_id: sessionId || undefined, unit_id: unitId || undefined } });
      if (s === seq.current) setBoard(r?.columns || []);
    } catch (e) {
      if (s === seq.current) {
        toast.error(orderErr(e, 'Não foi possível carregar o quadro.'));
        setBoard((b) => b || []);
      }
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, [sessionId, unitId]);
  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const move = async (o, to) => {
    if (to === 'canceled') {
      setCancel(o);
      return;
    }
    setBusyId(o.id);
    // otimista: muda de coluna na hora
    setBoard((cols) =>
      (cols || []).map((c) => ({
        ...c,
        items: c.status === to ? [{ ...o, status: to }, ...c.items.filter((x) => x.id !== o.id)] : c.items.filter((x) => x.id !== o.id)
      }))
    );
    try {
      await moveOrder(o.id, to);
      toast.success(`${o.code}: ${orderStatusOf(to).label.toLowerCase()}.`);
      onChanged?.();
    } catch (e) {
      toast.error(orderErr(e, 'Não foi possível mudar o status.'));
    } finally {
      setBusyId('');
      load();
    }
  };

  const onDrop = (e, status) => {
    e.preventDefault();
    setOver(null);
    const o = dragging.current;
    dragging.current = null;
    setDrag(null);
    if (!o || o.status === status) return;
    if (!(o.next_statuses || []).includes(status)) {
      toast.error(`${o.code} não pode ir de "${orderStatusOf(o.status).label}" para "${orderStatusOf(status).label}".`);
      return;
    }
    move(o, status);
  };

  if (!board) {
    return (
      <TgCard hover={false} sx={{ p: 2 }}>
        <TgListSkeleton rows={5} />
      </TgCard>
    );
  }
  if (!board.length) {
    return <TgEmptyState icon={IconLayoutKanban} title="Quadro vazio" description="Nenhum pedido para os filtros escolhidos." />;
  }

  return (
    <>
      <Box
        sx={(t) => ({
          ...THIN_SCROLL(t),
          display: 'flex',
          gap: 1.5,
          width: '100%',
          maxWidth: '100%',
          overflowX: 'auto',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch',
          pb: 2,
          alignItems: 'flex-start',
          scrollSnapType: { xs: 'x mandatory', md: 'none' },
          opacity: loading && !busyId ? 0.85 : 1,
          transition: 'opacity .2s'
        })}
      >
        {board.map((col) => {
          const st = orderStatusOf(col.status);
          const allowed = drag ? (drag.next_statuses || []).includes(col.status) : false;
          const isOver = over === col.status;
          const sum = col.items.reduce((a, o) => a + (o.total_cents || 0), 0);
          const closed = !OPEN_STATUSES.includes(col.status);
          return (
            <Box
              key={col.status}
              onDragOver={(e) => {
                const d = dragging.current;
                if (!d || !(d.next_statuses || []).includes(col.status)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (over !== col.status) setOver(col.status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setOver((x) => (x === col.status ? null : x));
              }}
              onDrop={(e) => onDrop(e, col.status)}
              sx={(t) => ({
                width: { xs: '85vw', sm: 284 },
                minWidth: { xs: '85vw', sm: 284 },
                maxWidth: { xs: 360, sm: 'none' },
                scrollSnapAlign: 'start',
                flexShrink: 0,
                borderRadius: 3,
                border: '1px solid',
                borderColor: isOver ? st.color : 'divider',
                bgcolor: isOver ? `${st.color}14` : 'action.hover',
                outline: drag && allowed && !isOver ? `2px dashed ${st.color}66` : 'none',
                outlineOffset: -2,
                transition: 'border-color .15s, background-color .15s',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: { xs: '70dvh', md: 'calc(100dvh - 330px)' },
                minHeight: 220,
                ...t.applyStyles('dark', isOver ? { borderColor: st.dark, bgcolor: `${st.dark}1A` } : {})
              })}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={(t) => ({
                  px: 1.5,
                  py: 1.25,
                  borderBottom: '3px solid',
                  borderColor: st.color,
                  ...t.applyStyles('dark', { borderColor: st.dark })
                })}
              >
                <Box sx={(t) => ({ color: st.color, display: 'flex', ...t.applyStyles('dark', { color: st.dark }) })}>
                  <st.icon size={17} />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, flex: 1, minWidth: 0 }} noWrap>
                  {col.label || st.label}
                </Typography>
                <Chip size="small" label={col.items.length} sx={{ height: 20, fontWeight: 800, fontSize: 11 }} />
              </Stack>
              {col.items.length ? (
                <Typography variant="caption" sx={{ px: 1.5, pt: 0.75, color: 'text.secondary', fontWeight: 700 }}>
                  {formatBRL(sum)}
                  {closed ? ' · últimos 2 dias' : ''}
                </Typography>
              ) : null}
              <Stack spacing={1} sx={(t) => ({ ...THIN_SCROLL(t), p: 1, overflowY: 'auto', flex: 1 })}>
                {col.items.map((o) => (
                  <OrderCard
                    key={o.id}
                    o={o}
                    onClick={() => onOpen(o)}
                    onMove={OPEN_STATUSES.includes(o.status) ? move : undefined}
                    busy={busyId === o.id}
                    showSession={multi}
                    draggable={(o.next_statuses || []).length > 0}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/wa-order', o.id);
                      e.dataTransfer.effectAllowed = 'move';
                      dragging.current = o;
                      setDrag(o);
                      setOver(null);
                    }}
                    onDragEnd={() => {
                      dragging.current = null;
                      setDrag(null);
                      setOver(null);
                    }}
                  />
                ))}
                {!col.items.length ? (
                  <Box
                    sx={{
                      py: 3,
                      px: 1,
                      textAlign: 'center',
                      color: 'text.disabled',
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="caption">
                      {closed ? 'Nada nos últimos 2 dias' : drag && allowed ? 'Solte aqui' : 'Nenhum pedido'}
                    </Typography>
                  </Box>
                ) : null}
              </Stack>
            </Box>
          );
        })}
      </Box>
      <CancelOrderDialog
        order={cancel}
        onClose={() => setCancel(null)}
        onDone={() => {
          onChanged?.();
          load();
        }}
      />
    </>
  );
}
