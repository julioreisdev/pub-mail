import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconClockHour4,
  IconGauge,
  IconListDetails,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconSearch,
  IconSend,
  IconStack2,
  IconX
} from '@tabler/icons-react';

import { get, post, put } from 'api/api';
import { useRealtimeEvent } from 'realtime/useRealtime';
import { TgCard, TgConfirmDialog } from 'views/pages/telegram/ui';
import { CrmModal, StatusChip, chatUrl, useXs } from '../crm/crmKit';
import { WaNumberDot, WaNumberSelect, fmtPhoneBR, relTime } from '../waKit';
import { fmtAgo, fmtDateTime } from '../waShared';
import { ReadOnlyChip, SettingsCardHeader, cardSx, errText, warnTextSx } from './settingsKit';

// ============================================================================
// Card "Fila de envios" (Fase 8, §12.1): avisos automáticos (cobranças,
// lembretes, assinaturas, agendamentos, chamados, pedidos, API) saem por uma
// fila com ritmo POR NÚMERO. Aqui: totais, situação de cada número (pausar,
// retomar, ritmo próprio, previsão para esvaziar), ritmo padrão da organização
// e a lista completa ("Ver fila") com ações por envio e em massa.
// GET /whatsapp/outbox/summary · GET /whatsapp/outbox · tempo real `wa:outbox`.
// ============================================================================

const POLL_MS = 30_000;
const n = (v) => (Number(v) || 0).toLocaleString('pt-BR');

export const OUTBOX_STATUS = {
  pending: { label: 'Na fila', token: 'info', color: '#2563EB', dark: '#60A5FA' },
  sending: { label: 'Enviando', token: 'info', color: '#0E7490', dark: '#22D3EE' },
  sent: { label: 'Enviada', token: 'success', color: '#128C7E', dark: '#25D366' },
  failed: { label: 'Falhou', token: 'error', color: '#B91C1C', dark: '#F87171' },
  canceled: { label: 'Cancelada', token: 'info', color: '#64748B', dark: '#94A3B8' },
  none: { label: '—', token: 'info', color: '#64748B', dark: '#94A3B8' }
};

const STATUS_FILTERS = [
  { value: '', label: 'Todas as situações' },
  { value: 'pending', label: 'Na fila' },
  { value: 'sending', label: 'Enviando' },
  { value: 'failed', label: 'Com falha' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'canceled', label: 'Canceladas' }
];

/** "~12 min" / "~2 h 10 min" / "~3 dias". */
export function fmtEta(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m < 1) return 'menos de 1 min';
  if (m < 60) return `~${m} min`;
  if (m < 60 * 24) return `~${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
  const d = Math.round(m / (60 * 24));
  return `~${d} ${d === 1 ? 'dia' : 'dias'}`;
}

/** Linha do resumo (`by_session`) → formato de sessão dos componentes de número (bolinha, select). */
const asSession = (s) => ({
  id: s.session_id,
  label: s.label,
  display_label: s.label,
  color: s.color,
  phone: s.phone,
  status: s.status,
  connected: s.connected
});

// ----------------------------------------------------------------------------
// Pequenos blocos visuais
// ----------------------------------------------------------------------------
function Total({ label, value, token }) {
  return (
    <Box
      sx={(t) => ({
        px: 1.5,
        py: 1.1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        minWidth: 0,
        bgcolor: token ? `rgba(${t.vars.palette[token].mainChannel} / 0.06)` : 'transparent'
      })}
    >
      <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }} noWrap>
        {n(value)}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.25 }}>
        {label}
      </Typography>
    </Box>
  );
}

function Stat({ label, value, tone }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={[
          { fontWeight: 800, fontSize: 15, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' },
          tone === 'error' && ((t) => ({ color: '#B91C1C', ...t.applyStyles('dark', { color: '#F87171' }) })),
          tone === 'warn' && warnTextSx
        ]}
        noWrap
      >
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.2 }} noWrap>
        {label}
      </Typography>
    </Box>
  );
}

// ----------------------------------------------------------------------------
// Ritmo (campo numérico + salvar) — usado no padrão da org e por número
// ----------------------------------------------------------------------------
function RateField({ value, placeholder, max, onSave, allowEmpty, disabled, label = 'msg/min' }) {
  const [v, setV] = useState(value == null ? '' : String(value));
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(value == null ? '' : String(value)), [value]);
  const dirty = (v === '' ? null : Number(v)) !== (value == null ? null : Number(value));
  const invalid = v !== '' && (!Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > max);
  const save = async () => {
    if (!dirty || invalid || (!allowEmpty && v === '')) return;
    setBusy(true);
    try {
      await onSave(v === '' ? null : Number(v));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <TextField
        size="small"
        type="number"
        value={v}
        placeholder={placeholder}
        disabled={disabled || busy}
        onChange={(e) => setV(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
        }}
        error={invalid}
        inputProps={{ min: 1, max, inputMode: 'numeric', 'aria-label': 'Mensagens por minuto' }}
        InputProps={{ endAdornment: <InputAdornment position="end">{label}</InputAdornment> }}
        sx={{ width: 150, flexShrink: 0 }}
      />
      {dirty ? (
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={save}
          disabled={invalid || busy || (!allowEmpty && v === '')}
          sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, minWidth: 0 }}
        >
          {busy ? <CircularProgress size={14} color="inherit" /> : 'Salvar'}
        </Button>
      ) : null}
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// Um número da fila
// ----------------------------------------------------------------------------
function NumberRow({ s, orgRate, limits, canEdit, onPause, onResume, onRate, onOpen }) {
  const session = asSession(s);
  const paused = Boolean(s.paused_at);
  const custom = s.per_minute != null;
  let situation;
  if (paused) situation = { label: 'Pausado', map: 'failed' };
  else if (!s.connected) situation = { label: 'Desconectado', map: 'canceled' };
  else if (s.sending) situation = { label: 'Enviando', map: 'sending' };
  else if (s.pending) situation = { label: 'Com fila', map: 'pending' };
  else situation = { label: 'Em dia', map: 'sent' };

  let forecast = 'Fila vazia';
  if (s.pending) {
    if (paused) forecast = 'Parada (pausado)';
    else if (!s.connected) forecast = 'Parada (desconectado)';
    else forecast = s.eta_minutes == null ? 'Sem previsão' : `Esvazia em ${fmtEta(s.eta_minutes)}`;
  }

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
        <WaNumberDot session={session} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>
            {s.label}
          </Typography>
          {s.phone ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
              {fmtPhoneBR(s.phone)}
            </Typography>
          ) : null}
        </Box>
        <StatusChip map={OUTBOX_STATUS} status={situation.map} label={situation.label} />
        <Tooltip title="Ver a fila deste número">
          <IconButton size="small" onClick={() => onOpen(s.session_id)} aria-label="Ver a fila deste número">
            <IconListDetails size={18} />
          </IconButton>
        </Tooltip>
      </Stack>

      {paused ? (
        <Alert severity="warning" icon={<IconPlayerPause size={18} />} sx={{ mt: 1.25, py: 0.25, borderRadius: 2 }}>
          {s.pause_reason || 'Pausado'}
          {s.paused_at ? ` · ${fmtAgo(s.paused_at)}` : ''}. As mensagens ficam guardadas e saem quando retomar.
        </Alert>
      ) : null}

      <Box
        sx={{
          mt: 1.25,
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }
        }}
      >
        <Stat label="Na fila" value={n(s.pending + (s.sending || 0))} />
        <Stat label="Enviadas (24 h)" value={n(s.sent_24h)} />
        <Stat label="Falhas (24 h)" value={n(s.failed_24h)} tone={s.failed_24h ? 'error' : undefined} />
        <Stat
          label={custom ? 'Ritmo próprio' : 'Ritmo (padrão)'}
          value={
            s.real_per_minute != null && s.real_per_minute < s.effective_per_minute
              ? `${n(Math.round(s.real_per_minute))}/min de ${n(s.effective_per_minute)}`
              : `${n(s.effective_per_minute)}/min`
          }
        />
      </Box>

      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1, color: 'text.secondary' }}>
        <IconClockHour4 size={15} />
        <Typography variant="caption" sx={[{ fontWeight: 600 }, s.pending && (paused || !s.connected) ? warnTextSx : null]}>
          {forecast}
          {s.pending && !paused && s.connected && s.next_run_at && new Date(s.next_run_at).getTime() > Date.now()
            ? ` · próximo envio ${relTime(s.next_run_at)}`
            : ''}
        </Typography>
      </Stack>
      {s.pending && s.eta_note && !paused && s.connected ? (
        <Typography variant="caption" sx={[{ display: 'block', mt: 0.5 }, warnTextSx]}>
          {s.eta_note}
        </Typography>
      ) : null}

      {canEdit ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={1}
          sx={{ mt: 1.25, pt: 1.25, borderTop: '1px dashed', borderColor: 'divider' }}
        >
          {paused ? (
            <Button
              size="small"
              variant="contained"
              disableElevation
              color="success"
              startIcon={<IconPlayerPlay size={16} />}
              onClick={() => onResume(s)}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2 }}
            >
              Retomar
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              startIcon={<IconPlayerPause size={16} />}
              onClick={() => onPause(s)}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2 }}
            >
              Pausar
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
              Ritmo do número
            </Typography>
            <RateField
              value={s.per_minute}
              placeholder={`padrão ${orgRate}`}
              max={limits?.session_max || 60}
              allowEmpty
              onSave={(v) => onRate(s, v)}
            />
          </Stack>
        </Stack>
      ) : null}
    </Box>
  );
}

// ----------------------------------------------------------------------------
// Lista completa ("Ver fila")
// ----------------------------------------------------------------------------
function QueueDialog({ open, onClose, sessions, initialSession, canEdit, version, onChanged }) {
  const xs = useXs();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [kind, setKind] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rowBusy, setRowBusy] = useState('');
  const [bulk, setBulk] = useState(null); // 'retry' | 'cancel'
  const [bulkBusy, setBulkBusy] = useState(false);
  const seq = useRef(0);

  // ao abrir: filtro do número que abriu (ou todos)
  useEffect(() => {
    if (!open) return;
    setSessionId(initialSession || '');
    setStatus('');
    setKind('');
    setQInput('');
    setQ('');
    setPage(1);
  }, [open, initialSession]);

  // busca com atraso
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(
    async (quiet) => {
      const s = ++seq.current;
      if (!quiet) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (sessionId) params.set('session_id', sessionId);
        if (kind) params.set('kind', kind);
        if (q) params.set('q', q);
        params.set('page', String(page));
        params.set('page_size', '20');
        const r = await get(`/whatsapp/outbox?${params.toString()}`);
        if (s !== seq.current) return;
        setData(r || null);
        setError('');
      } catch (e) {
        if (s === seq.current) setError(errText(e, 'Não foi possível carregar a fila.'));
      } finally {
        if (s === seq.current) setLoading(false);
      }
    },
    [status, sessionId, kind, q, page]
  );

  useEffect(() => {
    if (open) load(false);
  }, [open, load]);

  // o resumo mudou (tempo real/polling do card) → atualiza a lista em silêncio
  useEffect(() => {
    if (open && version) load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const kindGroups = Array.isArray(data?.kind_groups) ? data.kind_groups : [];
  const pages = data?.pages || 0;
  const sessionName = sessionId ? sessions.find((s) => s.id === sessionId)?.label || 'este número' : '';

  const rowAction = async (row, action) => {
    setRowBusy(row.id);
    try {
      await post(`/whatsapp/outbox/${row.id}/${action}`, {});
      toast.success(action === 'retry' ? 'Envio de volta na fila.' : 'Envio cancelado.');
      await load(true);
      onChanged?.();
    } catch (e) {
      toast.error(errText(e, 'Não foi possível concluir.'));
    } finally {
      setRowBusy('');
    }
  };

  const runBulk = async () => {
    setBulkBusy(true);
    try {
      let r;
      if (bulk === 'retry') r = await post('/whatsapp/outbox/retry-failed', sessionId ? { session_id: sessionId } : {});
      else
        r = await post('/whatsapp/outbox/cancel-pending', { ...(sessionId ? { session_id: sessionId } : {}), ...(kind ? { kind } : {}) });
      const c = Number(r?.count) || 0;
      const skipped = Number(r?.canceled) || 0; // falhas cuja cobrança já foi paga / PIX trocado / agendamento cancelado
      if (bulk === 'retry')
        toast.success(
          (c ? `${n(c)} envio(s) de volta na fila.` : 'Nenhuma falha recente para reenviar.') +
            (skipped ? ` ${n(skipped)} não voltaram (o conteúdo ficou desatualizado) e foram canceladas.` : '')
        );
      else toast.success(c ? `${n(c)} envio(s) cancelado(s).` : 'Nada pendente para cancelar.');
      setBulk(null);
      setPage(1);
      await load(true);
      onChanged?.();
    } catch (e) {
      toast.error(errText(e, 'Não foi possível concluir.'));
    } finally {
      setBulkBusy(false);
    }
  };

  const whenOf = (r) => {
    if (r.status === 'sent') return { main: fmtDateTime(r.sent_at), sub: 'enviada' };
    if (r.status === 'failed') return { main: fmtDateTime(r.run_at), sub: 'falhou' };
    if (r.status === 'canceled') return { main: fmtDateTime(r.created_at), sub: 'criada' };
    if (r.status === 'sending') return { main: 'agora', sub: 'saindo' };
    const due = new Date(r.run_at).getTime() <= Date.now();
    return { main: due ? 'assim que der' : fmtDateTime(r.run_at), sub: due ? 'no ritmo do número' : relTime(r.run_at) };
  };

  const destination = (r) => {
    const name = r.destination?.name || (r.destination?.phone ? fmtPhoneBR(r.destination.phone) : r.jid);
    const phone = r.destination?.name && r.destination?.phone ? fmtPhoneBR(r.destination.phone) : '';
    return (
      <Box sx={{ minWidth: 0 }}>
        {r.chat_id ? (
          <Typography
            component="button"
            type="button"
            onClick={() => navigate(chatUrl(r.chat_id))}
            sx={{
              p: 0,
              border: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              font: 'inherit',
              fontWeight: 700,
              fontSize: 13.5,
              color: 'text.primary',
              textAlign: 'left',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              '&:hover': { textDecoration: 'underline' }
            }}
            title="Abrir a conversa"
          >
            {name}
          </Typography>
        ) : (
          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>
            {name}
          </Typography>
        )}
        {phone ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
            {phone}
          </Typography>
        ) : null}
      </Box>
    );
  };

  const actions = (r) =>
    canEdit ? (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        {r.status === 'failed' || r.status === 'canceled' ? (
          <Tooltip title="Enviar de novo">
            <span>
              <IconButton size="small" onClick={() => rowAction(r, 'retry')} disabled={rowBusy === r.id} aria-label="Enviar de novo">
                {rowBusy === r.id ? <CircularProgress size={16} /> : <IconArrowBackUp size={18} />}
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {r.status === 'pending' ? (
          <Tooltip title="Cancelar este envio">
            <span>
              <IconButton size="small" onClick={() => rowAction(r, 'cancel')} disabled={rowBusy === r.id} aria-label="Cancelar este envio">
                {rowBusy === r.id ? <CircularProgress size={16} /> : <IconX size={18} />}
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Stack>
    ) : null;

  const sessionOf = (r) => sessions.find((s) => s.id === r.session_id) || r.session;

  const errorLine = (r) =>
    r.last_error && r.status !== 'sent' ? (
      <Typography
        variant="caption"
        sx={[{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }, r.status === 'failed' ? { color: 'error.main' } : warnTextSx]}
      >
        {r.last_error}
        {r.attempts ? ` · ${r.attempts} tentativa${r.attempts === 1 ? '' : 's'}` : ''}
      </Typography>
    ) : null;

  const bulkMsg =
    bulk === 'retry'
      ? `Os envios que falharam nas últimas 72 h${sessionName ? ` em ${sessionName}` : ''} voltam para a fila e saem no ritmo de cada número (até 5.000).`
      : `Todos os envios pendentes${sessionName ? ` de ${sessionName}` : ''}${kind ? ` do tipo "${kindGroups.find((k) => k.value === kind)?.label || kind}"` : ''} serão cancelados e não sairão. Isso não desfaz cobranças nem agendamentos, só os avisos.`;

  return (
    <>
      <CrmModal
        open={open}
        onClose={onClose}
        maxWidth="lg"
        title="Fila de envios"
        subtitle={
          data
            ? `${n(data.total)} envio${data.total === 1 ? '' : 's'} com estes filtros`
            : 'Avisos automáticos que saem no ritmo de cada número'
        }
        footer={
          canEdit ? (
            <>
              <Button
                onClick={() => setBulk('retry')}
                startIcon={<IconRefresh size={16} />}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2 }}
              >
                {xs ? 'Reenviar falhas' : 'Reenviar falhas (72 h)'}
              </Button>
              <Button
                color="error"
                onClick={() => setBulk('cancel')}
                startIcon={<IconX size={16} />}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2 }}
              >
                Cancelar pendentes
              </Button>
            </>
          ) : null
        }
      >
        <Box
          sx={{
            display: 'grid',
            gap: 1.25,
            mb: 2,
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }
          }}
        >
          <TextField
            size="small"
            placeholder="Buscar nome ou telefone"
            value={qInput}
            onChange={(e) => setQInput(e.target.value.slice(0, 80))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconSearch size={16} />
                </InputAdornment>
              )
            }}
          />
          <TextField
            select
            size="small"
            label="Situação"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map((o) => (
              <MenuItem key={o.value || 'all'} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <WaNumberSelect
            sessions={sessions}
            value={sessionId}
            allowAll
            onChange={(v) => {
              setSessionId(v);
              setPage(1);
            }}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Todos os tipos</MenuItem>
            {kindGroups.map((k) => (
              <MenuItem key={k.value} value={k.value}>
                {k.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {error ? (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        ) : null}

        {loading && !data ? (
          <Stack spacing={1}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={52} />
            ))}
          </Stack>
        ) : !items.length ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <IconStack2 size={32} style={{ opacity: 0.5 }} />
            <Typography sx={{ mt: 1, fontWeight: 700 }}>Nada por aqui</Typography>
            <Typography variant="body2">Nenhum envio com estes filtros.</Typography>
          </Box>
        ) : xs ? (
          <Stack spacing={1}>
            {items.map((r) => {
              const w = whenOf(r);
              const sess = sessionOf(r);
              return (
                <Box key={r.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ flex: 1, minWidth: 0 }}>{destination(r)}</Box>
                    <StatusChip map={OUTBOX_STATUS} status={r.status} />
                  </Stack>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75, minWidth: 0 }}>
                    {sess ? <WaNumberDot session={sess} size={8} /> : null}
                    <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>
                      {r.kind_label}
                    </Typography>
                  </Stack>
                  {r.preview ? (
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', overflowWrap: 'anywhere' }}>
                      {r.preview}
                    </Typography>
                  ) : null}
                  {errorLine(r)}
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1, minWidth: 0 }} noWrap>
                      {w.main} · {w.sub}
                    </Typography>
                    {actions(r)}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 760, '& td, & th': { borderColor: 'divider' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '22%', fontWeight: 700 }}>Destino</TableCell>
                  <TableCell sx={{ width: '20%', fontWeight: 700 }}>Tipo / número</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Mensagem</TableCell>
                  <TableCell sx={{ width: 110, fontWeight: 700 }}>Situação</TableCell>
                  <TableCell sx={{ width: 140, fontWeight: 700 }}>Quando</TableCell>
                  {canEdit ? <TableCell sx={{ width: 72 }} /> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((r) => {
                  const w = whenOf(r);
                  const sess = sessionOf(r);
                  return (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ verticalAlign: 'top' }}>{destination(r)}</TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap title={r.kind_label}>
                          {r.kind_label}
                        </Typography>
                        {sess ? (
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                            <WaNumberDot session={sess} size={8} />
                            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                              {sess.label || sess.display_label}
                            </Typography>
                          </Stack>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                          {r.preview || '—'}
                          {r.messages_count > 1 ? ` (+${r.messages_count - 1})` : ''}
                        </Typography>
                        {errorLine(r)}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <StatusChip map={OUTBOX_STATUS} status={r.status} />
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap>
                          {w.main}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                          {w.sub}
                        </Typography>
                      </TableCell>
                      {canEdit ? <TableCell sx={{ verticalAlign: 'top' }}>{actions(r)}</TableCell> : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {pages > 1 ? (
          <Stack alignItems="center" sx={{ mt: 2 }}>
            <Pagination
              count={pages}
              page={page}
              onChange={(_, p) => setPage(p)}
              size={xs ? 'small' : 'medium'}
              siblingCount={xs ? 0 : 1}
            />
          </Stack>
        ) : null}
      </CrmModal>

      <TgConfirmDialog
        open={Boolean(bulk)}
        onClose={() => !bulkBusy && setBulk(null)}
        onConfirm={runBulk}
        loading={bulkBusy}
        danger={bulk === 'cancel'}
        title={bulk === 'retry' ? 'Reenviar as falhas?' : 'Cancelar os envios pendentes?'}
        message={bulkMsg}
        confirmLabel={bulk === 'retry' ? 'Reenviar' : 'Cancelar envios'}
        icon={bulk === 'retry' ? IconRefresh : IconAlertTriangle}
      />
    </>
  );
}

// ----------------------------------------------------------------------------
// Card
// ----------------------------------------------------------------------------
export default function OutboxCard({ canEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [queue, setQueue] = useState({ open: false, session: '' });
  const [pauseOf, setPauseOf] = useState(null);
  const [pauseBusy, setPauseBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const s = ++seq.current;
    try {
      const r = await get('/whatsapp/outbox/summary');
      if (s !== seq.current) return;
      setData(r || null);
      setError('');
      setVersion((v) => v + 1);
    } catch (e) {
      if (s === seq.current) setError(errText(e, 'Não foi possível carregar a fila de envios.'));
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // o evento vem com o resumo da org inteira: dono/admin vê todos os números e usa direto;
  // quem só vê alguns números busca o próprio resumo (filtrado pelo acesso)
  useRealtimeEvent('wa:outbox', (payload) => {
    if (canEdit && payload && Array.isArray(payload.by_session)) {
      seq.current += 1;
      setData(payload);
      setVersion((v) => v + 1);
    } else load();
  });

  const bySession = useMemo(() => (Array.isArray(data?.by_session) ? data.by_session : []), [data]);
  const sessions = useMemo(() => bySession.map(asSession), [bySession]);
  const totals = data?.totals || {};
  const orgRate = data?.org_per_minute || 20;
  const limits = data?.limits || { session_max: 60, org_max: 60 };
  const pausedCount = bySession.filter((s) => s.paused_at).length;

  const patchSession = (row) => {
    if (!row?.session_id) return;
    setData((d) => (d ? { ...d, by_session: d.by_session.map((s) => (s.session_id === row.session_id ? row : s)) } : d));
  };

  const doPause = async () => {
    if (!pauseOf) return;
    setPauseBusy(true);
    try {
      patchSession(await post(`/whatsapp/outbox/sessions/${pauseOf.session_id}/pause`, {}));
      toast.success('Fila do número pausada.');
      setPauseOf(null);
    } catch (e) {
      toast.error(errText(e, 'Não foi possível pausar.'));
    } finally {
      setPauseBusy(false);
    }
  };

  const doResume = async (s) => {
    try {
      patchSession(await post(`/whatsapp/outbox/sessions/${s.session_id}/resume`, {}));
      toast.success('Fila do número retomada.');
    } catch (e) {
      toast.error(errText(e, 'Não foi possível retomar.'));
    }
  };

  const saveSessionRate = async (s, v) => {
    try {
      patchSession(await put(`/whatsapp/outbox/sessions/${s.session_id}/rate`, { per_minute: v }));
      toast.success(v == null ? 'O número voltou ao ritmo padrão.' : 'Ritmo do número salvo.');
    } catch (e) {
      toast.error(errText(e, 'Não foi possível salvar o ritmo.'));
    }
  };

  const saveOrgRate = async (v) => {
    try {
      const r = await put('/whatsapp/outbox/rate', { per_minute: v });
      if (r?.by_session) setData(r);
      else load();
      toast.success('Ritmo padrão salvo.');
    } catch (e) {
      toast.error(errText(e, 'Não foi possível salvar o ritmo.'));
    }
  };

  return (
    <TgCard hover={false} sx={cardSx}>
      <SettingsCardHeader
        icon={IconSend}
        title="Fila de envios"
        subtitle="Avisos automáticos (cobranças, lembretes, assinaturas, agendamentos…) saem por aqui, no ritmo de cada número."
        stackAction
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {!canEdit ? <ReadOnlyChip /> : null}
            <Button
              size="small"
              variant="outlined"
              startIcon={<IconListDetails size={16} />}
              onClick={() => setQueue({ open: true, session: '' })}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2 }}
            >
              Ver fila
            </Button>
          </Stack>
        }
      />

      {error ? (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={load}>
              Tentar de novo
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {loading && !data ? (
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={58} />
          <Skeleton variant="rounded" height={140} />
        </Stack>
      ) : data ? (
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(5, minmax(0, 1fr))' } }}>
            <Total label="Na fila" value={totals.pending} token="info" />
            <Total label="Enviando" value={totals.sending} />
            <Total label={`Enviadas (${data.totals_window_days || 30} d)`} value={totals.sent} token="success" />
            <Total label={`Com falha (${data.totals_window_days || 30} d)`} value={totals.failed} token={totals.failed ? 'error' : undefined} />
            <Total label={`Canceladas (${data.totals_window_days || 30} d)`} value={totals.canceled} />
          </Box>

          {pausedCount ? (
            <Alert severity="warning" icon={<IconPlayerPause size={18} />} sx={{ borderRadius: 2 }}>
              {pausedCount === 1 ? '1 número está com a fila pausada.' : `${pausedCount} números estão com a fila pausada.`} Nada sai dele
              até retomar.
            </Alert>
          ) : null}

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={1.25}
            sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', minWidth: 0 }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
              <IconGauge size={20} style={{ flexShrink: 0, opacity: 0.8 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Ritmo padrão</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Mensagens por minuto em cada número (espaçadas, nunca em rajada). Um número pode ter ritmo próprio.
                </Typography>
              </Box>
            </Stack>
            {canEdit ? (
              <RateField value={orgRate} max={limits.org_max || 60} onSave={saveOrgRate} />
            ) : (
              <Chip label={`${n(orgRate)} msg/min`} sx={{ fontWeight: 700 }} />
            )}
          </Stack>

          {bySession.length ? (
            <Stack spacing={1.25}>
              {bySession.map((s) => (
                <NumberRow
                  key={s.session_id}
                  s={s}
                  orgRate={orgRate}
                  limits={limits}
                  canEdit={canEdit}
                  onPause={setPauseOf}
                  onResume={doResume}
                  onRate={saveSessionRate}
                  onOpen={(id) => setQueue({ open: true, session: id })}
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Nenhum número cadastrado.
            </Typography>
          )}
        </Stack>
      ) : null}

      <QueueDialog
        open={queue.open}
        initialSession={queue.session}
        onClose={() => setQueue({ open: false, session: '' })}
        sessions={sessions}
        canEdit={canEdit}
        version={version}
        onChanged={load}
      />

      <TgConfirmDialog
        open={Boolean(pauseOf)}
        onClose={() => !pauseBusy && setPauseOf(null)}
        onConfirm={doPause}
        loading={pauseBusy}
        title="Pausar a fila deste número?"
        message={`Nenhum aviso automático sai de ${pauseOf?.label || 'este número'} até você retomar. As mensagens ficam guardadas (avisos com mais de 7 dias na fila expiram; cobranças, 10).`}
        confirmLabel="Pausar"
        icon={IconPlayerPause}
      />
    </TgCard>
  );
}
