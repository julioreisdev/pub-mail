import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconRefresh, IconSend, IconTruckDelivery } from '@tabler/icons-react';

import { get, post } from 'api/api';
import { TgEmptyState, TgListSkeleton, TgStatusPill } from 'views/pages/telegram/ui';
import { CrmModal } from 'views/pages/whatsapp/crm/crmKit';
import { CodeBlock, asPage, errMsg, eventLabel, fmtDT, monoSx } from './apiKit';

// ============================================================================
// Entregas de um webhook: GET /org/webhooks/:id/deliveries?status&page (lista sem o corpo),
// GET /org/webhooks/deliveries/:id (com o corpo), POST /org/webhooks/deliveries/:id/retry.
// ============================================================================

const STATUS = {
  delivered: { pill: 'ok', label: 'Entregue' },
  pending: { pill: 'pending', label: 'Na fila' },
  sending: { pill: 'pending', label: 'Enviando' },
  failed: { pill: 'error', label: 'Falhou' }
};
const statusPill = (s) => STATUS[s] || { pill: 'inactive', label: s || '—' };
const httpText = (d) => {
  const parts = [];
  if (d.last_status) parts.push(`HTTP ${d.last_status}`);
  if (d.duration_ms != null) parts.push(`${d.duration_ms} ms`);
  return parts.join(' · ');
};
const prettyPayload = (p) => {
  if (p == null) return '';
  if (typeof p === 'string') {
    try {
      return JSON.stringify(JSON.parse(p), null, 2);
    } catch {
      return p;
    }
  }
  try {
    return JSON.stringify(p, null, 2);
  } catch {
    return String(p);
  }
};

function DeliveryDetail({ id, onBack, onRetried }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setD(await get(`/org/webhooks/deliveries/${id}`));
      setError('');
    } catch (e) {
      setError(errMsg(e, 'Não foi possível abrir a entrega.'));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const retry = async () => {
    setBusy(true);
    try {
      await post(`/org/webhooks/deliveries/${id}/retry`, {});
      toast.success('Entrega colocada na fila de novo.');
      onRetried?.();
      setTimeout(load, 2500);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível reenviar.'));
    } finally {
      setBusy(false);
    }
  };

  const st = statusPill(d?.status);
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button size="small" startIcon={<IconArrowLeft size={15} />} onClick={onBack} sx={{ textTransform: 'none' }}>
          Voltar às entregas
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          onClick={retry}
          disabled={busy || !d || d.status === 'pending' || d.status === 'sending'}
          startIcon={busy ? <CircularProgress size={13} /> : <IconSend size={15} />}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Reenviar
        </Button>
      </Stack>
      {error ? (
        <Typography variant="body2" sx={{ color: 'error.main' }}>
          {error}
        </Typography>
      ) : !d ? (
        <TgListSkeleton rows={2} />
      ) : (
        <>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            <Meta label="Evento" value={eventLabel(d.event)} sub={d.event} />
            <Meta label="Situação" value={<TgStatusPill status={st.pill} label={st.label} />} />
            <Meta label="Tentativas" value={String(d.attempts ?? 0)} sub={httpText(d)} />
            <Meta
              label="Criada"
              value={fmtDT(d.created_at)}
              sub={d.delivered_at ? `entregue ${fmtDT(d.delivered_at)}` : d.next_try_at ? `próxima tentativa ${fmtDT(d.next_try_at)}` : ''}
            />
            <Meta label="ID da entrega (X-PubMail-Delivery)" value={d.id} mono />
          </Box>
          {d.last_error ? (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Último erro
              </Typography>
              <Typography variant="body2" sx={{ color: 'error.main', overflowWrap: 'anywhere' }}>
                {d.last_error}
              </Typography>
            </Box>
          ) : null}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
              Corpo enviado
            </Typography>
            <CodeBlock code={prettyPayload(d.payload ?? d.body) || '(vazio)'} maxHeight={420} />
          </Box>
          {d.response_body ? (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Resposta do seu servidor
              </Typography>
              <CodeBlock code={prettyPayload(d.response_body)} maxHeight={200} />
            </Box>
          ) : null}
        </>
      )}
    </Stack>
  );
}

function Meta({ label, value, sub, mono }) {
  return (
    <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>
        {label}
      </Typography>
      {typeof value === 'string' ? (
        <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere', ...(mono ? monoSx : {}) }}>
          {value}
        </Typography>
      ) : (
        <Box sx={{ mt: 0.25 }}>{value}</Box>
      )}
      {sub ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', overflowWrap: 'anywhere' }}>
          {sub}
        </Typography>
      ) : null}
    </Box>
  );
}

export default function DeliveriesDialog({ webhook, onClose }) {
  const open = Boolean(webhook);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!webhook?.id) return;
    const s = ++seq.current;
    try {
      const q = new URLSearchParams({ page: String(page) });
      if (status !== 'all') q.set('status', status);
      const r = await get(`/org/webhooks/${webhook.id}/deliveries?${q.toString()}`);
      if (s !== seq.current) return;
      setData(asPage(r));
      setError('');
    } catch (e) {
      if (s !== seq.current) return;
      setError(errMsg(e, 'Não foi possível carregar as entregas.'));
      setData((p) => p || { items: [], total: 0, page: 1, pages: 1 });
    }
  }, [webhook?.id, status, page]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);
  useEffect(() => {
    if (!open) {
      setSelected(null);
      setData(null);
      setStatus('all');
      setPage(1);
    }
  }, [open]);

  return (
    <CrmModal
      open={open}
      onClose={onClose}
      title="Entregas"
      subtitle={webhook ? `${webhook.name} · ${webhook.url}` : ''}
      maxWidth="md"
      footer={
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Fechar
        </Button>
      }
    >
      {selected ? (
        <DeliveryDetail id={selected} onBack={() => setSelected(null)} onRetried={load} />
      ) : (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              size="small"
              label="Situação"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">Todas</MenuItem>
              <MenuItem value="delivered">Entregues</MenuItem>
              <MenuItem value="pending">Na fila</MenuItem>
              <MenuItem value="failed">Falharam</MenuItem>
            </TextField>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Atualizar">
              <IconButton onClick={load} aria-label="Atualizar entregas">
                <IconRefresh size={18} />
              </IconButton>
            </Tooltip>
          </Stack>
          {error ? (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          ) : null}
          {data === null ? (
            <TgListSkeleton rows={4} />
          ) : !data.items.length ? (
            <TgEmptyState
              icon={IconTruckDelivery}
              title="Nenhuma entrega"
              description={status === 'all' ? 'Quando um evento acontecer, a entrega aparece aqui.' : 'Nenhuma entrega com essa situação.'}
              dense
            />
          ) : (
            <Stack spacing={0.75}>
              {data.items.map((d) => {
                const st = statusPill(d.status);
                return (
                  <ButtonBase
                    key={d.id}
                    onClick={() => setSelected(d.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      p: 1.1,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      textAlign: 'left',
                      minWidth: 0,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {eventLabel(d.event)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                        <Box component="span" sx={monoSx}>
                          {d.event}
                        </Box>
                        {` · ${fmtDT(d.created_at)}`}
                        {d.delivered_at ? ` · entregue ${fmtDT(d.delivered_at)}` : ''}
                      </Typography>
                      {d.last_error && d.status !== 'delivered' ? (
                        <Typography variant="caption" sx={{ color: 'error.main', display: 'block' }} noWrap title={d.last_error}>
                          {d.last_error}
                        </Typography>
                      ) : null}
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <TgStatusPill status={st.pill} label={st.label} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                        {d.attempts ? `${d.attempts} tentativa${d.attempts === 1 ? '' : 's'}` : ''}
                        {httpText(d) ? `${d.attempts ? ' · ' : ''}${httpText(d)}` : ''}
                      </Typography>
                    </Box>
                  </ButtonBase>
                );
              })}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {data.total} entrega{data.total === 1 ? '' : 's'} · clique para ver o corpo
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <IconButton
                    size="small"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    aria-label="Página anterior"
                  >
                    <IconChevronLeft size={18} />
                  </IconButton>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    {data.page} de {data.pages}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                    disabled={page >= data.pages}
                    aria-label="Próxima página"
                  >
                    <IconChevronRight size={18} />
                  </IconButton>
                </Stack>
              </Stack>
            </Stack>
          )}
        </Stack>
      )}
    </CrmModal>
  );
}
