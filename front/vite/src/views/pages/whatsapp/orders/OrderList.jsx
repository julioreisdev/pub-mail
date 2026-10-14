import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { IconFilterOff, IconSearch, IconShoppingCartOff } from '@tabler/icons-react';

import { get } from 'api/api';
import { TgCard, TgEmptyState, TgFilterBar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberChip, useNow } from '../waKit';
import { fmtAgo, fmtDateTime, fmtPhone } from '../waShared';
import { WaNumberFilter, useXs } from '../crm/crmKit';
import { HIDE_SCROLL, THIN_SCROLL } from '../chat/chatKit';
import OrderCard from './OrderCard';
import {
  API,
  DeliveryChip,
  ORDER_STATUS,
  ORDER_STATUS_KEYS,
  OrderStatusChip,
  PAYMENT_STATUS,
  PaymentChip,
  orderErr,
  orderPersonName,
  orderPersonPhone
} from './orderKit';

// ============================================================================
// Lista de pedidos: situação (chips), pagamento, unidade, número, período, busca
// (#número, nome ou telefone), ordem e paginação. Tabela no computador, cartões no
// celular. Os filtros vivem na página (os KPIs do topo aplicam filtros).
// ============================================================================

const PAGE_SIZE = 25;
export const DEFAULT_FILTERS = { status: 'open', payment_status: '', unit_id: '', q: '', from: '', to: '', order: 'newest' };

const STATUS_CHIPS = [['open', 'Em aberto'], ...ORDER_STATUS_KEYS.map((k) => [k, ORDER_STATUS[k].label]), ['all', 'Todos']];

/** `YYYY-MM-DD` (dia em Brasília) → ISO do início do dia; `next` = início do dia seguinte. */
const brtDayIso = (day, next = false) => {
  if (!day) return undefined;
  const d = new Date(`${day}T00:00:00-03:00`);
  if (next) d.setTime(d.getTime() + 86400000);
  return d.toISOString();
};

export default function OrderList({ filters, setFilters, sessions, sessionId, setSessionId, multi, units = [], onOpen, reloadToken }) {
  const xs = useXs();
  useNow(60000);
  const [q, setQ] = useState(filters.q || '');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const pushedQ = useRef(filters.q || '');

  // busca com atraso
  useEffect(() => {
    const t = window.setTimeout(() => {
      const v = q.trim();
      pushedQ.current = v;
      setFilters((f) => (f.q === v ? f : { ...f, q: v }));
    }, 350);
    return () => window.clearTimeout(t);
  }, [q, setFilters]);
  useEffect(() => {
    const ext = filters.q || '';
    if (ext !== pushedQ.current) {
      pushedQ.current = ext;
      setQ(ext);
    }
  }, [filters.q]);

  const { status, payment_status: payment, unit_id: unitId, from, to, order, q: qd } = filters;
  useEffect(() => {
    setPage(1);
  }, [status, payment, unitId, from, to, order, qd, sessionId]);

  const load = useCallback(async () => {
    const s = ++seq.current;
    setLoading(true);
    try {
      const r = await get(API, {
        params: {
          status: status === 'all' ? undefined : status,
          payment_status: payment || undefined,
          unit_id: unitId || undefined,
          from: brtDayIso(from),
          to: brtDayIso(to, true),
          order: order === 'oldest' ? 'oldest' : undefined,
          q: qd || undefined,
          session_id: sessionId || undefined,
          page,
          page_size: PAGE_SIZE
        }
      });
      if (s !== seq.current) return;
      setData({ items: r?.items || [], total: r?.total || 0, pages: r?.pages || 1 });
    } catch (e) {
      if (s !== seq.current) return;
      toast.error(orderErr(e, 'Não foi possível carregar os pedidos.'));
      setData((d) => d || { items: [], total: 0, pages: 1 });
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, [status, payment, unitId, from, to, order, qd, sessionId, page]);
  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const filtered =
    status !== DEFAULT_FILTERS.status || payment || unitId || from || to || qd || order !== DEFAULT_FILTERS.order || sessionId;
  const items = data?.items || [];

  return (
    <Box>
      <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, overflowX: 'auto', pb: 0.25, ...HIDE_SCROLL }} aria-label="Situação dos pedidos">
        {STATUS_CHIPS.map(([k, label]) => {
          const on = status === k;
          return (
            <Chip
              key={k}
              label={label}
              clickable
              onClick={() => setF('status', k)}
              color={on ? 'primary' : 'default'}
              variant={on ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, flexShrink: 0 }}
            />
          );
        })}
      </Stack>

      <TgFilterBar>
        <TextField
          size="small"
          placeholder="#número, nome ou telefone"
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 80))}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={16} />
              </InputAdornment>
            )
          }}
          sx={{ minWidth: { md: 220 }, flex: { md: 1 } }}
        />
        <TextField
          select
          size="small"
          label="Pagamento"
          value={payment}
          onChange={(e) => setF('payment_status', e.target.value)}
          sx={{ minWidth: { md: 190 } }}
        >
          <MenuItem value="">Todos</MenuItem>
          {Object.entries(PAYMENT_STATUS).map(([k, p]) => (
            <MenuItem key={k} value={k}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
        {units.length ? (
          <TextField
            select
            size="small"
            label="Unidade"
            value={unitId}
            onChange={(e) => setF('unit_id', e.target.value)}
            sx={{ minWidth: { md: 160 } }}
          >
            <MenuItem value="">Todas</MenuItem>
            {units.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <WaNumberFilter sessions={sessions} value={sessionId} onChange={setSessionId} />
        <TextField
          size="small"
          type="date"
          label="De"
          value={from}
          onChange={(e) => setF('from', e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: { md: 150 } }}
        />
        <TextField
          size="small"
          type="date"
          label="Até"
          value={to}
          onChange={(e) => setF('to', e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: { md: 150 } }}
        />
        <TextField
          select
          size="small"
          label="Ordem"
          value={order}
          onChange={(e) => setF('order', e.target.value)}
          sx={{ minWidth: { md: 150 } }}
        >
          <MenuItem value="newest">Mais recentes</MenuItem>
          <MenuItem value="oldest">Mais antigos</MenuItem>
        </TextField>
        {filtered ? (
          <Button
            size="small"
            startIcon={<IconFilterOff size={15} />}
            onClick={() => {
              setQ('');
              setFilters(DEFAULT_FILTERS);
              if (sessionId) setSessionId('');
            }}
            sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { xs: 'flex-start', md: 'center' } }}
          >
            Limpar
          </Button>
        ) : null}
      </TgFilterBar>

      {loading ? <LinearProgress color="success" sx={{ mb: 1, borderRadius: 1 }} /> : null}
      {!data ? (
        <TgCard hover={false} sx={{ p: 2 }}>
          <TgListSkeleton rows={6} />
        </TgCard>
      ) : !items.length ? (
        <TgEmptyState
          icon={IconShoppingCartOff}
          title={filtered ? 'Nenhum pedido com esses filtros' : 'Nenhum pedido em aberto'}
          description={
            filtered
              ? 'Tente outra situação ou limpe os filtros.'
              : 'Os pedidos feitos pelo bot ("Fazer pedido"), pelo painel ou pela API aparecem aqui.'
          }
        />
      ) : xs ? (
        <Stack spacing={0.75}>
          {items.map((o) => (
            <OrderCard key={o.id} o={o} onClick={() => onOpen(o)} showStatus showSession={multi} />
          ))}
        </Stack>
      ) : (
        <TgCard hover={false} sx={{ p: 0, overflow: 'hidden' }}>
          <TableContainer sx={(th) => ({ ...THIN_SCROLL(th) })}>
            <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Pedido</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Itens</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell>Pagamento</TableCell>
                  <TableCell>Entrega</TableCell>
                  {units.length ? <TableCell>Unidade</TableCell> : null}
                  {multi ? <TableCell>Número</TableCell> : null}
                  <TableCell align="right">Criado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((o) => {
                  const person = orderPersonName(o);
                  const phone = orderPersonPhone(o);
                  return (
                    <TableRow key={o.id} hover onClick={() => onOpen(o)} sx={{ cursor: 'pointer' }}>
                      <TableCell>
                        <Typography
                          sx={{ fontWeight: 800, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 13 }}
                        >
                          {o.code}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {person || fmtPhone(phone) || 'Sem contato'}
                        </Typography>
                        {person && phone ? (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {fmtPhone(phone)}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Typography variant="body2" noWrap title={o.items_text}>
                          {(o.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                          {o.total_label}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <OrderStatusChip status={o.status} label={o.status_label} />
                      </TableCell>
                      <TableCell>
                        <PaymentChip order={o} short />
                      </TableCell>
                      <TableCell>
                        <DeliveryChip order={o} />
                      </TableCell>
                      {units.length ? <TableCell>{o.unit?.name || '—'}</TableCell> : null}
                      {multi ? <TableCell>{o.session ? <WaNumberChip session={o.session} /> : '—'}</TableCell> : null}
                      <TableCell align="right" title={fmtDateTime(o.created_at)}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {fmtAgo(o.created_at)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </TgCard>
      )}
      {data && data.total > 0 ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} de {data.total.toLocaleString('pt-BR')}
          </Typography>
          <Pagination size="small" page={page} count={data.pages} onChange={(_, p) => setPage(p)} />
        </Stack>
      ) : null}
    </Box>
  );
}
