import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
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
import { IconCalendarOff, IconSearch } from '@tabler/icons-react';

import { get } from 'api/api';
import { TgCard, TgEmptyState, TgFilterBar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberChip } from '../waKit';
import { fmtPhone } from '../waShared';
import { WaNumberFilter, formatBRL, useSessionFilter, useXs } from '../crm/crmKit';
import { THIN_SCROLL } from '../chat/chatKit';
import ApptRow from './ApptRow';
import {
  API,
  APPT_STATUS,
  ApptStatusChip,
  addDaysIso,
  apptErr,
  brtParts,
  brtToday,
  dayEndIso,
  dayLabel,
  dayStartIso,
  timeOf
} from './agendaKit';

// ============================================================================
// Visão "Lista": filtros (período, recurso, serviço, situação, número, busca) +
// paginação. Tabela no computador, cartões no celular.
// ============================================================================

const PAGE_SIZE = 25;

export default function ListView({ resources, services, sessions, onOpen, reloadToken }) {
  const xs = useXs();
  const { value: sessionId, set: setSessionId, multi } = useSessionFilter(sessions);
  const [from, setFrom] = useState(() => brtToday());
  const [to, setTo] = useState(() => addDaysIso(brtToday(), 30));
  const [resourceId, setResourceId] = useState('');
  const [productId, setProductId] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [qd, setQd] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setQd(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(1);
  }, [from, to, resourceId, productId, status, qd, sessionId]);

  const load = useCallback(async () => {
    const s = ++seq.current;
    setLoading(true);
    try {
      const r = await get(`${API}/appointments`, {
        params: {
          from: from ? dayStartIso(from) : undefined,
          to: to ? dayEndIso(to) : undefined,
          resource_id: resourceId || undefined,
          product_id: productId || undefined,
          status: status || undefined,
          session_id: sessionId || undefined,
          q: qd || undefined,
          page,
          page_size: PAGE_SIZE
        }
      });
      if (s !== seq.current) return;
      setData({
        items: Array.isArray(r) ? r : r?.items || [],
        total: r?.total ?? (Array.isArray(r) ? r.length : 0),
        pages: r?.pages || Math.max(1, Math.ceil((r?.total || 0) / PAGE_SIZE))
      });
    } catch (e) {
      if (s !== seq.current) return;
      toast.error(apptErr(e, 'Não foi possível carregar os agendamentos.'));
      setData((d) => d || { items: [], total: 0, pages: 1 });
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, [from, to, resourceId, productId, status, sessionId, qd, page]);
  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const items = data?.items || [];
  return (
    <Box>
      <TgFilterBar>
        <TextField
          size="small"
          placeholder="Buscar cliente, telefone ou serviço"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={16} />
              </InputAdornment>
            )
          }}
          sx={{ minWidth: { md: 240 }, flex: { md: 1 } }}
        />
        <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
          <TextField
            size="small"
            type="date"
            label="De"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: 'calc(50% - 4px)', md: 150 } }}
          />
          <TextField
            size="small"
            type="date"
            label="Até"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: 'calc(50% - 4px)', md: 150 } }}
          />
        </Stack>
        <TextField
          select
          size="small"
          label="Recurso"
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          sx={{ minWidth: { md: 160 } }}
        >
          <MenuItem value="">Todos</MenuItem>
          {resources.map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Serviço"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          sx={{ minWidth: { md: 160 } }}
        >
          <MenuItem value="">Todos</MenuItem>
          {services.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Situação"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: { md: 170 } }}
        >
          <MenuItem value="">Todas</MenuItem>
          {Object.entries(APPT_STATUS).map(([k, v]) => (
            <MenuItem key={k} value={k}>
              {v.label}
            </MenuItem>
          ))}
        </TextField>
        <WaNumberFilter sessions={sessions} value={sessionId} onChange={setSessionId} />
      </TgFilterBar>

      {loading ? <LinearProgress color="success" sx={{ mb: 1, borderRadius: 1 }} /> : null}
      {!data ? (
        <TgCard hover={false} sx={{ p: 2 }}>
          <TgListSkeleton rows={6} />
        </TgCard>
      ) : !items.length ? (
        <TgEmptyState icon={IconCalendarOff} title="Nenhum agendamento" description="Nada encontrado com esses filtros no período." />
      ) : xs ? (
        <Stack spacing={0.75}>
          {items.map((a) => (
            <ApptRow key={a.id} a={a} onClick={() => onOpen(a)} showDay showSession={multi} />
          ))}
        </Stack>
      ) : (
        <TgCard hover={false} sx={{ p: 0, overflow: 'hidden' }}>
          <TableContainer sx={(t) => ({ ...THIN_SCROLL(t) })}>
            <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Quando</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Serviço</TableCell>
                  <TableCell>Recurso</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  {multi ? <TableCell>Número</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id} hover onClick={() => onOpen(a)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {dayLabel(brtParts(a.starts_at).day)} · {a.time_label || timeOf(a.starts_at)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {a.customer?.name || 'Contato sem cadastro'}
                      </Typography>
                      {a.customer?.phone ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {fmtPhone(a.customer.phone)}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Typography variant="body2" noWrap>
                        {a.service_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: a.resource?.color || '#2563EB' }} />
                        <Typography variant="body2">{a.resource?.name || '—'}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <ApptStatusChip status={a.status} />
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {a.price_label || formatBRL(a.price_cents)}
                    </TableCell>
                    {multi ? <TableCell>{a.session ? <WaNumberChip session={a.session} /> : '—'}</TableCell> : null}
                  </TableRow>
                ))}
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
