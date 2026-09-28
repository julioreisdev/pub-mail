import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  IconAlertTriangle,
  IconCalendarClock,
  IconCalendarTime,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconHistory,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSend,
  IconTrash,
  IconUsersGroup,
  IconX
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post, patch, remove } from 'api/api';
import { TgCard, TgStatusPill, TgModal, TgConfirmDialog, TgEmptyState, TgListSkeleton, TgAvatar } from 'views/pages/telegram/ui';
import WhatsAppMediaField from './WhatsAppMediaField';
import WhatsAppMessagesPreview from './WhatsAppMessagesPreview';
import WaChatPicker from './WaChatPicker';
import {
  WaPageHeader,
  WaSessionBanner,
  useWaSession,
  useNow,
  errMsg,
  fmtDateBRT,
  relTime,
  brtLocalToIso,
  isoToBrtLocal,
  brtLocalNow,
  mediaKind,
  waButtonSx,
  uid,
  WA_GREEN,
  WA_DARK
} from './waKit';
import { tint } from './waShared';

// ============================================================================
// WhatsApp → Agendamentos: mensagens pontuais para contatos e grupos em dia e
// hora marcados (Brasília). Depois de enviada, sai da lista "Próximos" e vai
// para o Histórico.
// Contrato: GET /whatsapp/schedules?status=pending|history&page&page_size
//           POST /whatsapp/schedules { targets:[chat_id], messages:[{text,media_id?,delay_seconds?}], schedule_at }
//           PATCH /whatsapp/schedules/:id (pendente) | DELETE /whatsapp/schedules/:id (cancela)
//           POST /whatsapp/schedules/:id/send-now
// ============================================================================

const enc = (v) => encodeURIComponent(String(v));
const PENDING = new Set(['pending', 'sending']);

const STATUS_UI = {
  pending: { label: 'Agendado', pill: 'pending' },
  sending: { label: 'Enviando…', pill: 'active' },
  sent: { label: 'Enviado', pill: 'active' },
  failed: { label: 'Falhou', pill: 'error' },
  canceled: { label: 'Cancelado', pill: 'inactive' }
};

const MEDIA_LABEL = { image: '📷 Foto', video: '🎬 Vídeo', voice: '🎤 Áudio', document: '📄 Documento' };

const targetName = (t) => t?.name || t?.chat_id || '—';
const targetsSummary = (targets, max = 2) => {
  const names = (targets || []).map(targetName);
  if (!names.length) return 'Sem destinatários';
  const shown = names.slice(0, max).join(', ');
  const rest = names.length - max;
  return rest > 0 ? `${shown} +${rest}` : shown;
};
const firstMessagePreview = (messages) => {
  const m = (messages || [])[0];
  if (!m) return 'Sem mensagem';
  const kind = mediaKind(m.media);
  const text = (m.text || '').trim();
  if (text) return kind ? `${MEDIA_LABEL[kind] || '📎 Mídia'} · ${text}` : text;
  if (kind) return MEDIA_LABEL[kind] || '📎 Mídia';
  return 'Sem mensagem';
};

// ---------------------------------------------------------------- avatares empilhados
function TargetAvatars({ targets, size = 34, max = 4 }) {
  const list = targets || [];
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  return (
    <Stack direction="row" sx={{ flexShrink: 0 }}>
      {shown.map((t, i) => (
        <Box
          key={t.chat_id || i}
          sx={{
            ml: i ? `-${Math.round(size * 0.32)}px` : 0,
            borderRadius: '50%',
            border: '2px solid',
            borderColor: 'background.paper',
            zIndex: shown.length - i,
            lineHeight: 0
          }}
        >
          <TgAvatar
            name={targetName(t)}
            photoPath={t.chat_id ? `/whatsapp/chats/${enc(t.chat_id)}/photo` : undefined}
            size={size}
            kind={t.kind === 'group' ? 'group' : 'contact'}
            icon={t.kind === 'group' ? IconUsersGroup : undefined}
          />
        </Box>
      ))}
      {rest > 0 ? (
        <Box
          sx={{
            ml: `-${Math.round(size * 0.32)}px`,
            width: size,
            height: size,
            borderRadius: '50%',
            border: '2px solid',
            borderColor: 'background.paper',
            bgcolor: 'action.selected',
            color: 'text.secondary',
            display: 'grid',
            placeItems: 'center',
            fontSize: size * 0.34,
            fontWeight: 800,
            flexShrink: 0
          }}
        >
          +{rest}
        </Box>
      ) : null}
    </Stack>
  );
}

// ---------------------------------------------------------------- editor de mensagens
const VARS = [
  { token: '{{nome}}', label: 'nome' },
  { token: '{{telefone}}', label: 'telefone' }
];
const newMessage = () => ({ id: uid(), text: '', media: null, delay_seconds: 0 });

function MessagesEditor({ messages, onChange }) {
  const list = messages || [];
  const refs = useRef(new Map());
  const setMsg = (id, patchObj) => onChange(list.map((m) => (m.id === id ? { ...m, ...patchObj } : m)));

  const insertVar = (m, token) => {
    const el = refs.current.get(m.id);
    const cur = m.text || '';
    const start = el && el.selectionStart != null ? el.selectionStart : cur.length;
    const end = el && el.selectionEnd != null ? el.selectionEnd : cur.length;
    setMsg(m.id, { text: cur.slice(0, start) + token + cur.slice(end) });
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const pos = start + token.length;
        try {
          el.setSelectionRange(pos, pos);
        } catch {
          /* noop */
        }
      }
    });
  };

  return (
    <Stack spacing={1.25}>
      {list.map((m, i) => (
        <Box key={m.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Chip size="small" label={`Mensagem ${i + 1}`} sx={{ fontWeight: 700 }} />
            {list.length > 1 ? (
              <Tooltip title="Remover mensagem">
                <IconButton size="small" color="error" onClick={() => onChange(list.filter((x) => x.id !== m.id))}>
                  <IconTrash size={15} />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={m.text || ''}
            onChange={(e) => setMsg(m.id, { text: e.target.value })}
            inputRef={(el) => refs.current.set(m.id, el)}
            placeholder="Texto (vira legenda se houver mídia)."
            sx={{ mb: 0.75 }}
          />
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.25 }}>
              Inserir variável:
            </Typography>
            {VARS.map((v) => (
              <Tooltip key={v.token} title="Personaliza por contato — em grupos fica vazio.">
                <Chip
                  size="small"
                  label={v.label}
                  onClick={() => insertVar(m, v.token)}
                  sx={{
                    height: 22,
                    cursor: 'pointer',
                    borderRadius: 1,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: WA_DARK,
                    border: '1px solid rgba(37,211,102,0.4)',
                    bgcolor: 'rgba(37,211,102,0.12)',
                    '& .MuiChip-label': { px: 0.9 },
                    '&:hover': { bgcolor: 'rgba(37,211,102,0.22)' }
                  }}
                />
              </Tooltip>
            ))}
            <Tooltip title="As variáveis só personalizam em contatos; em grupos ficam vazias.">
              <Typography variant="caption" sx={{ color: 'text.disabled', cursor: 'help' }}>
                ⓘ só contatos
              </Typography>
            </Tooltip>
          </Stack>

          <WhatsAppMediaField value={m.media} onChange={(media) => setMsg(m.id, { media })} />

          <TextField
            size="small"
            type="number"
            label="Atraso antes desta (s)"
            value={m.delay_seconds || 0}
            onChange={(e) => setMsg(m.id, { delay_seconds: Math.min(30, Math.max(0, Number(e.target.value) || 0)) })}
            sx={{ width: 190, mt: 1.25 }}
            inputProps={{ min: 0, max: 30 }}
            helperText="Mostra “digitando…”."
          />
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<IconPlus size={15} />}
        onClick={() => onChange([...list, newMessage()])}
        sx={{ textTransform: 'none', alignSelf: 'flex-start', color: WA_DARK }}
      >
        Adicionar mensagem
      </Button>
    </Stack>
  );
}

// ---------------------------------------------------------------- modal (novo / editar / reagendar)
function SectionTitle({ n, children, hint }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 800,
          color: '#fff',
          bgcolor: WA_DARK,
          flexShrink: 0
        }}
      >
        {n}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{children}</Typography>
      {hint ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {hint}
        </Typography>
      ) : null}
    </Stack>
  );
}

const toEditorMessages = (messages) =>
  (messages || []).length
    ? messages.map((m) => ({ id: m.id || uid(), text: m.text || '', media: m.media || null, delay_seconds: m.delay_seconds || 0 }))
    : [newMessage()];

function ScheduleModal({ open, initial, connected, onClose }) {
  const [targets, setTargets] = useState([]);
  const [messages, setMessages] = useState([newMessage()]);
  const [when, setWhen] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    setTargets((initial?.targets || []).map((t) => ({ chat_id: t.chat_id, name: t.name, kind: t.kind })));
    setMessages(toEditorMessages(initial?.messages));
    setWhen(initial?.schedule_at ? isoToBrtLocal(initial.schedule_at) : brtLocalNow(60));
    setSaving(false);
  }, [open, initial]);

  const minLocal = brtLocalNow(1);
  const whenIso = brtLocalToIso(when);
  const whenValid = Boolean(whenIso) && new Date(whenIso).getTime() >= Date.now() + 60 * 1000;

  const submit = async () => {
    if (!targets.length) return toast.error('Escolha pelo menos um destinatário.');
    const valid = messages.filter((m) => (m.text || '').trim() || m.media?.id || m.media?.url);
    if (!valid.length) return toast.error('Escreva ao menos uma mensagem (texto ou mídia).');
    if (!whenIso) return toast.error('Informe dia e hora do envio.');
    if (!whenValid) return toast.error('O horário precisa ser pelo menos 1 minuto no futuro (Brasília).');
    setSaving(true);
    try {
      const body = {
        targets: targets.map((t) => t.chat_id),
        messages: valid.map((m) => ({
          text: m.text || '',
          media_id: m.media?.id || undefined,
          delay_seconds: Math.min(30, Math.max(0, Number(m.delay_seconds) || 0))
        })),
        schedule_at: whenIso
      };
      if (editing) await patch(`/whatsapp/schedules/${enc(initial.id)}`, body);
      else await post('/whatsapp/schedules', body);
      toast.success(editing ? 'Agendamento atualizado.' : `Agendado para ${fmtDateBRT(whenIso)}.`);
      onClose?.(true);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar o agendamento.'));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <TgModal
      open={open}
      onClose={() => !saving && onClose?.(false)}
      title={editing ? 'Editar agendamento' : initial ? 'Reagendar envio' : 'Novo agendamento'}
      subtitle="Escolha quem recebe, o que enviar e quando (horário de Brasília)."
      maxWidth="md"
      disableClose={saving}
      footer={
        <>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {!connected ? (
              <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
                WhatsApp desconectado: o envio só acontece com a sessão ativa no horário.
              </Typography>
            ) : null}
          </Box>
          <Button color="inherit" onClick={() => onClose?.(false)} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={submit}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconCalendarClock size={17} />}
            sx={waButtonSx}
          >
            {editing ? 'Salvar' : 'Agendar'}
          </Button>
        </>
      }
    >
      <Stack spacing={3}>
        <Box>
          <SectionTitle n={1} hint={targets.length ? `${targets.length} ${targets.length === 1 ? 'destinatário' : 'destinatários'}` : ''}>
            Destinatários
          </SectionTitle>
          <WaChatPicker value={targets} onChange={setTargets} connected={connected} listHeight={240} />
        </Box>

        <Box>
          <SectionTitle n={2} hint="enviadas em sequência, na ordem">
            Mensagens
          </SectionTitle>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' } }}>
            <MessagesEditor messages={messages} onChange={setMessages} />
            <Box sx={{ position: { md: 'sticky' }, top: { md: 8 }, alignSelf: 'start' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
                Preview
              </Typography>
              <WhatsAppMessagesPreview messages={messages} />
            </Box>
          </Box>
        </Box>

        <Box>
          <SectionTitle n={3}>Quando</SectionTitle>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <TextField
              size="small"
              type="datetime-local"
              label="Dia e hora (Brasília)"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              inputProps={{ min: minLocal, step: 60 }}
              InputLabelProps={{ shrink: true }}
              error={Boolean(when) && !whenValid}
              helperText={when && !whenValid ? 'Escolha um horário pelo menos 1 minuto à frente.' : ' '}
              sx={{ minWidth: 250 }}
            />
            {whenValid ? (
              <Chip
                size="small"
                icon={<IconClock size={14} />}
                label={`${fmtDateBRT(whenIso)} · ${relTime(whenIso)}`}
                sx={{
                  fontWeight: 700,
                  borderRadius: 1.5,
                  color: WA_DARK,
                  bgcolor: (t) => tint(t, 'success', 0.12),
                  '& .MuiChip-icon': { color: 'inherit' },
                  alignSelf: { xs: 'flex-start', sm: 'center' },
                  mb: { sm: 2.5 }
                }}
              />
            ) : null}
          </Stack>
        </Box>
      </Stack>
    </TgModal>
  );
}

// ---------------------------------------------------------------- card "Próximos"
function UpcomingCard({ item, now, connected, onSendNow, onEdit, onCancel }) {
  const sending = item.status === 'sending';
  const late = !sending && new Date(item.schedule_at || 0).getTime() < now;
  const st = STATUS_UI[item.status] || STATUS_UI.pending;
  const n = (item.targets || []).length;
  const msgs = (item.messages || []).length;
  return (
    <TgCard sx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <TargetAvatars targets={item.targets} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14.5 }} noWrap>
            {targetsSummary(item.targets)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {n} {n === 1 ? 'destinatário' : 'destinatários'} · {msgs} {msgs === 1 ? 'mensagem' : 'mensagens'}
          </Typography>
        </Box>
        <TgStatusPill
          status={late && !sending ? 'pending' : st.pill}
          label={sending ? 'Enviando…' : late ? 'Aguardando envio' : st.label}
        />
      </Stack>

      <Typography
        variant="body2"
        sx={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          color: 'text.primary',
          px: 1.25,
          py: 0.9,
          borderRadius: 2,
          bgcolor: 'action.hover',
          borderLeft: '3px solid',
          borderLeftColor: WA_GREEN
        }}
      >
        {firstMessagePreview(item.messages)}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: 'text.secondary' }}>
        <IconClock size={14} />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {fmtDateBRT(item.schedule_at)}
        </Typography>
        <Typography variant="caption" sx={{ color: sending ? 'info.main' : late ? 'warning.main' : WA_DARK, fontWeight: 700 }} noWrap>
          · {sending ? 'enviando agora' : relTime(item.schedule_at, now)}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={connected ? 'Enviar agora' : 'Conecte o WhatsApp para enviar agora'}>
          <span>
            <IconButton size="small" onClick={() => onSendNow(item)} disabled={sending || !connected} sx={{ color: WA_DARK }}>
              <IconSend size={17} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Editar">
          <span>
            <IconButton size="small" onClick={() => onEdit(item)} disabled={sending}>
              <IconPencil size={17} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Cancelar agendamento">
          <span>
            <IconButton size="small" color="error" onClick={() => onCancel(item)} disabled={sending}>
              <IconX size={17} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </TgCard>
  );
}

// ---------------------------------------------------------------- linha do histórico
function ResultChip({ r }) {
  const ok = r.status === 'sent';
  const chip = (
    <Chip
      size="small"
      icon={ok ? <IconCheck size={13} /> : <IconX size={13} />}
      label={r.name || r.chat_id}
      sx={{
        height: 22,
        maxWidth: 200,
        borderRadius: 1,
        fontWeight: 600,
        fontSize: 11.5,
        color: ok ? WA_DARK : 'error.main',
        bgcolor: (t) => tint(t, ok ? 'success' : 'error', 0.12),
        '& .MuiChip-icon': { color: 'inherit' }
      }}
    />
  );
  const tip = ok ? (r.sent_at ? `Enviado em ${fmtDateBRT(r.sent_at)}` : 'Enviado') : r.error || 'Falha no envio';
  return <Tooltip title={tip}>{chip}</Tooltip>;
}

function HistoryRow({ item, onReschedule }) {
  const st = STATUS_UI[item.status] || STATUS_UI.sent;
  const when = item.sent_at || item.schedule_at || item.created_at;
  const results = item.results || [];
  const okCount = results.filter((r) => r.status === 'sent').length;
  const failCount = results.filter((r) => r.status === 'failed').length;
  return (
    <TgCard
      hover={false}
      sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'flex-start', opacity: item.status === 'canceled' ? 0.75 : 1 }}
    >
      <TargetAvatars targets={item.targets} size={30} max={3} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.25 }}>
          <TgStatusPill status={st.pill} label={st.label} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {item.status === 'sent' ? 'enviado em ' : item.status === 'canceled' ? 'era para ' : ''}
            {fmtDateBRT(when)}
          </Typography>
          {results.length ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              · {okCount}/{results.length} {okCount === 1 ? 'entregue' : 'entregues'}
              {failCount ? `, ${failCount} ${failCount === 1 ? 'falha' : 'falhas'}` : ''}
            </Typography>
          ) : null}
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {targetsSummary(item.targets, 3)}
        </Typography>
        <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
          {firstMessagePreview(item.messages)}
        </Typography>
        {results.length ? (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
            {results.slice(0, 12).map((r, i) => (
              <ResultChip key={`${r.chat_id || i}`} r={r} />
            ))}
            {results.length > 12 ? (
              <Chip size="small" label={`+${results.length - 12}`} sx={{ height: 22, borderRadius: 1, fontWeight: 700 }} />
            ) : null}
          </Stack>
        ) : null}
        {item.status === 'failed' && item.error ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'error.main', mt: 0.5 }}>
            <IconAlertTriangle size={13} />
            <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>
              {item.error}
            </Typography>
          </Stack>
        ) : null}
      </Box>
      <Tooltip title="Reagendar (cria um novo agendamento com os mesmos destinatários e mensagens)">
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<IconRefresh size={15} />}
          onClick={() => onReschedule(item)}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, flexShrink: 0, borderColor: 'divider' }}
        >
          Reagendar
        </Button>
      </Tooltip>
    </TgCard>
  );
}

// =================== PÁGINA ===================
export default function WhatsAppSchedules() {
  const { session, loading: sessionLoading, connected } = useWaSession();
  const now = useNow(30000);

  const [upcoming, setUpcoming] = useState([]);
  const [loadingUp, setLoadingUp] = useState(true);
  const [history, setHistory] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loadingHist, setLoadingHist] = useState(true);
  const [histStatus, setHistStatus] = useState('all');
  const [histPage, setHistPage] = useState(1);

  const [modal, setModal] = useState(null); // { initial } | null
  const [cancelFor, setCancelFor] = useState(null);
  const [sendFor, setSendFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const upSeq = useRef(0);
  const loadUpcoming = useCallback(async () => {
    const s = ++upSeq.current;
    try {
      const r = await get('/whatsapp/schedules', { params: { status: 'pending', page: 1, page_size: 100 } });
      if (s !== upSeq.current) return;
      const items = (Array.isArray(r) ? r : r?.items || []).filter((x) => PENDING.has(x.status));
      items.sort((a, b) => new Date(a.schedule_at || 0) - new Date(b.schedule_at || 0));
      setUpcoming(items);
    } catch (e) {
      if (s === upSeq.current) toast.error(errMsg(e, 'Falha ao carregar os agendamentos.'));
    } finally {
      if (s === upSeq.current) setLoadingUp(false);
    }
  }, []);

  const histSeq = useRef(0);
  const loadHistory = useCallback(async () => {
    const s = ++histSeq.current;
    setLoadingHist(true);
    try {
      // o servidor lista o histórico inteiro (sent/failed/canceled); o recorte por resultado é local
      const r = await get('/whatsapp/schedules', { params: { status: 'history', page: histPage, page_size: 12 } });
      if (s !== histSeq.current) return;
      const items = (Array.isArray(r) ? r : r?.items || []).filter((x) => !PENDING.has(x.status));
      setHistory({ items, total: r?.total ?? items.length, page: r?.page ?? histPage, pages: r?.pages ?? 1 });
    } catch (e) {
      if (s === histSeq.current) toast.error(errMsg(e, 'Falha ao carregar o histórico.'));
    } finally {
      if (s === histSeq.current) setLoadingHist(false);
    }
  }, [histPage]);

  useEffect(() => {
    loadUpcoming();
  }, [loadUpcoming]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);
  useEffect(() => {
    setHistPage(1);
  }, [histStatus]);

  // o cron envia sozinho → polling leve (30 s); se algo já venceu/está enviando, o histórico também muda
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadUpcoming();
      if (upcoming.some((x) => x.status === 'sending' || new Date(x.schedule_at || 0).getTime() < Date.now())) loadHistory();
    }, 30000);
    return () => clearInterval(id);
  }, [loadUpcoming, loadHistory, upcoming]);

  const reloadAll = () => {
    loadUpcoming();
    loadHistory();
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      await remove(`/whatsapp/schedules/${enc(cancelFor.id)}`);
      toast.success('Agendamento cancelado.');
      setCancelFor(null);
      reloadAll();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível cancelar.'));
    } finally {
      setBusy(false);
    }
  };
  const doSendNow = async () => {
    setBusy(true);
    try {
      await post(`/whatsapp/schedules/${enc(sendFor.id)}/send-now`);
      toast.success('Envio iniciado.');
      setSendFor(null);
      reloadAll();
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível enviar agora.'));
    } finally {
      setBusy(false);
    }
  };

  // reagendar = novo agendamento pré-preenchido (sem id ⇒ POST)
  const reschedule = (item) => setModal({ initial: { targets: item.targets, messages: item.messages, schedule_at: null } });

  const visibleHistory = useMemo(
    () => (histStatus === 'all' ? history.items : history.items.filter((x) => x.status === histStatus)),
    [history.items, histStatus]
  );

  const newBtn = (
    <Button
      variant="contained"
      disableElevation
      startIcon={<IconPlus size={18} />}
      onClick={() => setModal({ initial: null })}
      sx={waButtonSx}
    >
      Novo agendamento
    </Button>
  );

  const nextUp = useMemo(() => upcoming.find((x) => x.status === 'pending'), [upcoming]);

  return (
    <Box>
      <WaPageHeader
        icon={IconCalendarClock}
        title="Agendamentos"
        subtitle="Mensagens pontuais para contatos e grupos em dia e hora marcados. Depois de enviada, sai da lista."
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Atualizar">
              <IconButton onClick={reloadAll}>
                <IconRefresh size={20} />
              </IconButton>
            </Tooltip>
            {newBtn}
          </Stack>
        }
      />

      <WaSessionBanner session={session} loading={sessionLoading} connected={connected} what="enviar as mensagens agendadas" />

      {/* ---------- próximos ---------- */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <IconCalendarTime size={18} />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Próximos
        </Typography>
        <Chip size="small" label={upcoming.length} sx={{ fontWeight: 700, height: 22 }} />
        {nextUp ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            · próximo {relTime(nextUp.schedule_at, now)}
          </Typography>
        ) : null}
      </Stack>
      {loadingUp ? (
        <TgListSkeleton rows={2} />
      ) : upcoming.length === 0 ? (
        <TgEmptyState
          dense
          icon={IconCalendarClock}
          title="Nada agendado"
          description="Crie um agendamento para enviar mensagens a contatos ou grupos em um dia e hora específicos (Brasília)."
          action={newBtn}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }
          }}
        >
          {upcoming.map((item) => (
            <UpcomingCard
              key={item.id}
              item={item}
              now={now}
              connected={connected}
              onSendNow={setSendFor}
              onEdit={(it) => setModal({ initial: it })}
              onCancel={setCancelFor}
            />
          ))}
        </Box>
      )}

      {/* ---------- histórico ---------- */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1} sx={{ mt: 4, mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
          <IconHistory size={18} />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Histórico
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {history.total ? `${history.total} ${history.total === 1 ? 'registro' : 'registros'}` : ''}
          </Typography>
        </Stack>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="wa-sched-hist-label">Mostrar</InputLabel>
          <Select labelId="wa-sched-hist-label" label="Mostrar" value={histStatus} onChange={(e) => setHistStatus(e.target.value)}>
            <MenuItem value="all">Tudo</MenuItem>
            <MenuItem value="sent">Enviados</MenuItem>
            <MenuItem value="failed">Falhas</MenuItem>
            <MenuItem value="canceled">Cancelados</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {loadingHist ? (
        <TgListSkeleton rows={3} />
      ) : visibleHistory.length === 0 ? (
        <TgEmptyState
          dense
          icon={IconHistory}
          title={history.items.length ? 'Nada nesta página com esse filtro' : 'Nenhum envio ainda'}
          description={
            history.items.length
              ? 'Troque o filtro ou avance a página.'
              : 'Os agendamentos enviados, com falha ou cancelados aparecem aqui.'
          }
        />
      ) : (
        <Stack spacing={1}>
          {visibleHistory.map((item) => (
            <HistoryRow key={item.id} item={item} onReschedule={reschedule} />
          ))}
        </Stack>
      )}
      {!loadingHist && history.pages > 1 ? (
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ pt: 1.5 }}>
          <IconButton size="small" onClick={() => setHistPage((p) => Math.max(1, p - 1))} disabled={histPage <= 1}>
            <IconChevronLeft size={18} />
          </IconButton>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Página {history.page} de {history.pages}
          </Typography>
          <IconButton size="small" onClick={() => setHistPage((p) => Math.min(history.pages, p + 1))} disabled={histPage >= history.pages}>
            <IconChevronRight size={18} />
          </IconButton>
        </Stack>
      ) : null}

      <ScheduleModal
        open={!!modal}
        initial={modal?.initial || null}
        connected={connected}
        onClose={(ok) => {
          setModal(null);
          if (ok) reloadAll();
        }}
      />
      <TgConfirmDialog
        open={!!cancelFor}
        onClose={() => setCancelFor(null)}
        onConfirm={doCancel}
        loading={busy}
        danger
        icon={IconX}
        title="Cancelar agendamento?"
        confirmLabel="Cancelar agendamento"
        message={cancelFor ? `As mensagens marcadas para ${fmtDateBRT(cancelFor.schedule_at)} não serão enviadas.` : ''}
      />
      <TgConfirmDialog
        open={!!sendFor}
        onClose={() => setSendFor(null)}
        onConfirm={doSendNow}
        loading={busy}
        icon={IconSend}
        title="Enviar agora?"
        confirmLabel="Enviar agora"
        message={
          sendFor
            ? `As mensagens vão para ${targetsSummary(sendFor.targets, 3)} imediatamente, em vez de ${fmtDateBRT(sendFor.schedule_at)}.`
            : ''
        }
      />
    </Box>
  );
}
