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
import { IconFilterOff, IconSearch, IconTicketOff } from '@tabler/icons-react';

import { get } from 'api/api';
import { TgCard, TgEmptyState, TgFilterBar, TgListSkeleton } from 'views/pages/telegram/ui';
import { WaNumberChip, useNow } from '../waKit';
import { fmtAgo, fmtPhone } from '../waShared';
import { WaNumberFilter, useXs } from '../crm/crmKit';
import { HIDE_SCROLL, THIN_SCROLL } from '../chat/chatKit';
import TicketCard from './TicketCard';
import {
  API,
  AssigneeBadge,
  PRIORITY,
  PRIORITY_KEYS,
  PriorityChip,
  ProtocolText,
  SlaChip,
  TicketStatusChip,
  ticketErr,
  ticketPersonName,
  ticketPersonPhone
} from './ticketKit';

// ============================================================================
// Fila de chamados: busca (protocolo, assunto, nome/telefone), situação (chips),
// categoria, prioridade, responsável, prazo, número, ordenação + paginação.
// Tabela no computador, cartões no celular. Os filtros vivem na página (os KPIs
// do topo aplicam filtros); o número fica em `?session=`.
// ============================================================================

const PAGE_SIZE = 25;

export const DEFAULT_FILTERS = { status: 'active', category: '', priority: '', assigned: '', sla: '', order: 'sla', q: '' };

const STATUS_CHIPS = [
  ['active', 'Ativos'],
  ['open', 'Aberto'],
  ['pending', 'Aguardando cliente'],
  ['resolved', 'Resolvido'],
  ['closed', 'Encerrado'],
  ['all', 'Todos']
];
const ORDERS = [
  ['sla', 'Prazo (vence antes)'],
  ['recent', 'Atividade recente'],
  ['newest', 'Mais recentes'],
  ['oldest', 'Mais antigos']
];

export default function TicketQueue({
  filters,
  setFilters,
  sessions,
  sessionId,
  setSessionId,
  multi,
  categories,
  assignees,
  onOpen,
  reloadToken
}) {
  const xs = useXs();
  const now = useNow(60000);
  const [q, setQ] = useState(filters.q || '');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const pushedQ = useRef(filters.q || '');
  // busca com atraso (só grava no filtro depois de parar de digitar)
  useEffect(() => {
    const t = window.setTimeout(() => {
      const v = q.trim();
      pushedQ.current = v;
      setFilters((f) => (f.q === v ? f : { ...f, q: v }));
    }, 350);
    return () => window.clearTimeout(t);
  }, [q, setFilters]);
  // KPI/limpar mudou a busca por fora → acompanha o campo (o que nós mesmos gravamos não volta)
  useEffect(() => {
    const ext = filters.q || '';
    if (ext !== pushedQ.current) {
      pushedQ.current = ext;
      setQ(ext);
    }
  }, [filters.q]);

  const { status, category, priority, assigned, sla, order, q: qd } = filters;
  useEffect(() => {
    setPage(1);
  }, [status, category, priority, assigned, sla, order, qd, sessionId]);

  const load = useCallback(async () => {
    const s = ++seq.current;
    setLoading(true);
    try {
      const r = await get(API, {
        params: {
          status: status === 'all' ? undefined : status,
          category: category || undefined,
          priority: priority || undefined,
          assigned: assigned || undefined,
          sla: sla || undefined,
          order,
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
      toast.error(ticketErr(e, 'Não foi possível carregar os chamados.'));
      setData((d) => d || { items: [], total: 0, pages: 1 });
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, [status, category, priority, assigned, sla, order, qd, sessionId, page]);
  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const filtered =
    status !== DEFAULT_FILTERS.status || category || priority || assigned || sla || qd || order !== DEFAULT_FILTERS.order || sessionId;
  const items = data?.items || [];

  return (
    <Box>
      {/* Situação (chips) */}
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ mb: 1.5, overflowX: 'auto', pb: 0.25, ...HIDE_SCROLL }}
        role="tablist"
        aria-label="Situação dos chamados"
      >
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
          placeholder="Protocolo, assunto, nome ou telefone"
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 80))}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch size={16} />
              </InputAdornment>
            )
          }}
          sx={{ minWidth: { md: 240 }, flex: { md: 1 } }}
        />
        <TextField
          select
          size="small"
          label="Categoria"
          value={category}
          onChange={(e) => setF('category', e.target.value)}
          sx={{ minWidth: { md: 160 } }}
        >
          <MenuItem value="">Todas</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.key} value={c.key}>
              {c.label}
              {c.active === false ? ' (desativada)' : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Prioridade"
          value={priority}
          onChange={(e) => setF('priority', e.target.value)}
          sx={{ minWidth: { md: 130 } }}
        >
          <MenuItem value="">Todas</MenuItem>
          {PRIORITY_KEYS.map((k) => (
            <MenuItem key={k} value={k}>
              {PRIORITY[k].label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Responsável"
          value={assigned}
          onChange={(e) => setF('assigned', e.target.value)}
          sx={{ minWidth: { md: 170 } }}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="me">Meus</MenuItem>
          <MenuItem value="none">Sem responsável</MenuItem>
          {assignees.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.name || u.email}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Prazo"
          value={sla}
          onChange={(e) => setF('sla', e.target.value)}
          sx={{ minWidth: { md: 150 } }}
        >
          <MenuItem value="">Qualquer</MenuItem>
          <MenuItem value="overdue">Vencidos</MenuItem>
          <MenuItem value="due_soon">Vencem em breve</MenuItem>
        </TextField>
        <WaNumberFilter sessions={sessions} value={sessionId} onChange={setSessionId} />
        <TextField
          select
          size="small"
          label="Ordenar por"
          value={order}
          onChange={(e) => setF('order', e.target.value)}
          sx={{ minWidth: { md: 180 } }}
        >
          {ORDERS.map(([k, label]) => (
            <MenuItem key={k} value={k}>
              {label}
            </MenuItem>
          ))}
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
          icon={IconTicketOff}
          title={filtered ? 'Nenhum chamado com esses filtros' : 'Nenhum chamado em aberto'}
          description={
            filtered
              ? 'Tente outra situação ou limpe os filtros.'
              : 'Os chamados abertos pelo bot, pelo painel ou pela API aparecem aqui, ordenados pelo prazo.'
          }
        />
      ) : xs ? (
        <Stack spacing={0.75}>
          {items.map((t) => (
            <TicketCard key={t.id} t={t} now={now} onClick={() => onOpen(t)} showSession={multi} />
          ))}
        </Stack>
      ) : (
        <TgCard hover={false} sx={{ p: 0, overflow: 'hidden' }}>
          <TableContainer sx={(th) => ({ ...THIN_SCROLL(th) })}>
            <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Protocolo · assunto</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Prioridade</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell>Prazo</TableCell>
                  <TableCell>Responsável</TableCell>
                  {multi ? <TableCell>Número</TableCell> : null}
                  <TableCell align="right">Atividade</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((t) => {
                  const person = ticketPersonName(t);
                  const phone = ticketPersonPhone(t);
                  return (
                    <TableRow key={t.id} hover onClick={() => onOpen(t)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ maxWidth: 340 }}>
                        <ProtocolText protocol={t.protocol} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap title={t.subject}>
                          {t.subject}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                          {t.category_label}
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
                      <TableCell>
                        <PriorityChip priority={t.priority} />
                      </TableCell>
                      <TableCell>
                        <TicketStatusChip status={t.status} />
                      </TableCell>
                      <TableCell>{t.sla_due_at ? <SlaChip ticket={t} now={now} /> : '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 180 }}>
                        <AssigneeBadge assigned={t.assigned} />
                      </TableCell>
                      {multi ? <TableCell>{t.session ? <WaNumberChip session={t.session} /> : '—'}</TableCell> : null}
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {fmtAgo(t.last_event_at || t.updated_at || t.created_at)}
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
