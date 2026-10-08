import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
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
  IconArrowsSplit,
  IconCalendarClock,
  IconCalendarTime,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCopy,
  IconDeviceMobile,
  IconHistory,
  IconPencil,
  IconPhone,
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
  WaNumberChip,
  WaNumberMultiSelect,
  WaNumberSelect,
  useWaSessions,
  useNow,
  errMsg,
  fmtDateBRT,
  fmtPhoneBR,
  relTime,
  brtLocalToIso,
  isoToBrtLocal,
  brtLocalNow,
  mediaKind,
  sessionLabel,
  waButtonSx,
  uid,
  WA_GREEN,
  WA_DARK
} from './waKit';
import { tint } from './waShared';

// ============================================================================
// WhatsApp → Agendamentos (multi-número): mensagens pontuais para contatos e
// grupos em dia e hora marcados (Brasília), enviadas por 1..N números.
//  POST /whatsapp/schedules { session_ids, mode:'all'|'split', targets, messages, schedule_at }
//    → cria UMA LINHA POR NÚMERO (mesmo `batch_id`) + `warnings[]`.
//    mode 'all'   = cada alvo sai por CADA número escolhido;
//    mode 'split' = alvos repartidos entre os números (round-robin).
//    Alvo que é uma conversa (uuid) SEMPRE sai pelo número daquela conversa; telefone avulso é distribuído.
//  GET /whatsapp/schedules?status=pending|history&only=&session_id=&page=   (itens com session/batch_id)
//  PATCH /whatsapp/schedules/:id (UMA linha pendente; `apply_to_batch` replica mensagens/horário no lote)
//  DELETE /whatsapp/schedules/:id (cancela a linha) · POST /whatsapp/schedules/:id/send-now (a linha)
// ============================================================================

const enc = (v) => encodeURIComponent(String(v));
const PENDING = new Set(['pending', 'sending']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isReady = (s) => Boolean(s && (s.connected || s.status === 'ready'));

const STATUS_UI = {
  pending: { label: 'Agendado', pill: 'pending' },
  sending: { label: 'Enviando…', pill: 'active' },
  sent: { label: 'Enviado', pill: 'active' },
  failed: { label: 'Falhou', pill: 'error' },
  canceled: { label: 'Cancelado', pill: 'inactive' }
};
const MODE_UI = {
  all: { label: 'Cada número envia para todos', short: 'todos por todos', icon: IconCopy },
  split: { label: 'Alvos divididos entre os números', short: 'dividido', icon: IconArrowsSplit }
};

// sem emoji: o texto é renderizado com ícone profissional via <PreviewText type=…> (chat/mediaIcons)
const MEDIA_LABEL = { image: 'Foto', video: 'Vídeo', voice: 'Áudio', document: 'Documento' };

// chave local de um alvo (uuid da conversa | jid | telefone)
const targetKey = (t) => t?.chat_id || t?.jid || t?.phone || '';
const targetName = (t) => t?.name || (t?.phone ? fmtPhoneBR(t.phone) : '') || t?.jid || t?.chat_id || '—';
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
  if (text) return kind ? `${MEDIA_LABEL[kind] || 'Mídia'} · ${text}` : text;
  if (kind) return MEDIA_LABEL[kind] || 'Mídia';
  return 'Sem mensagem';
};

// linhas do mesmo lote (`batch_id`) viram um grupo; sem lote, cada linha é um grupo
const groupByBatch = (items) => {
  const map = new Map();
  const out = [];
  (items || []).forEach((it) => {
    const k = it.batch_id || it.id;
    let g = map.get(k);
    if (!g) {
      g = { key: k, batch_id: it.batch_id || null, items: [] };
      map.set(k, g);
      out.push(g);
    }
    g.items.push(it);
  });
  return out;
};
// destinatários do lote inteiro (sem repetir o mesmo contato que vai por 2 números)
const unionTargets = (items) => {
  const seen = new Set();
  const out = [];
  (items || []).forEach((it) =>
    (it.targets || []).forEach((t) => {
      const k = t.jid || t.chat_id;
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(t);
    })
  );
  return out;
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
          key={targetKey(t) || i}
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
            photoPath={t.chat_id && UUID_RE.test(t.chat_id) ? `/whatsapp/chats/${enc(t.chat_id)}/photo` : undefined}
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

// seletor de modo (quando há 2+ números)
function ModePicker({ value, onChange }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      {Object.entries(MODE_UI).map(([key, m]) => {
        const on = value === key;
        const Icon = m.icon;
        return (
          <Box
            key={key}
            role="button"
            onClick={() => onChange(key)}
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              p: 1.25,
              borderRadius: 2,
              border: '2px solid',
              borderColor: on ? WA_GREEN : 'divider',
              bgcolor: on ? 'rgba(37,211,102,0.10)' : 'transparent',
              cursor: 'pointer',
              transition: 'border-color .12s ease, background-color .12s ease'
            }}
          >
            <Box sx={{ color: on ? WA_DARK : 'text.secondary', mt: 0.25 }}>
              <Icon size={18} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: on ? WA_DARK : 'text.primary' }}>{m.label}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
                {key === 'all'
                  ? 'Cada destinatário recebe uma vez por número escolhido (bom para garantir entrega).'
                  : 'Os destinatários são repartidos entre os números (bom para dividir o volume).'}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

const toEditorMessages = (messages) =>
  (messages || []).length
    ? messages.map((m) => ({ id: m.id || uid(), text: m.text || '', media: m.media || null, delay_seconds: m.delay_seconds || 0 }))
    : [newMessage()];

// alvo guardado no servidor → alvo do editor (fixa o número da linha para o reenvio sair pelo mesmo número)
const fromStored = (t, sessionId) => ({
  chat_id: t.chat_id && UUID_RE.test(t.chat_id) ? t.chat_id : null,
  jid: t.jid || (t.chat_id && !UUID_RE.test(t.chat_id) ? t.chat_id : null),
  name: t.name,
  kind: t.kind || 'individual',
  phone: t.phone,
  session_id: sessionId || t.session_id || null
});
// alvo do editor → payload aceito pelo back (uuid | telefone | {jid, session_id})
const toPayload = (t) => {
  const cid = String(t.chat_id || '');
  if (UUID_RE.test(cid)) return cid;
  // compat: picker antigo devolvia o jid em `chat_id`
  const jid = t.jid || (cid.includes('@') ? cid : null);
  if (jid) return t.session_id ? { jid, session_id: t.session_id } : { jid };
  return String(t.phone || '').replace(/\D/g, '');
};

/**
 * `initial`: null (novo) | linha com `id` (editar UMA linha) | sem `id` (reagendar: `session_ids`, `mode`, `targets`, `messages`)
 * `initial.batch_size` (editar) = quantas linhas pendentes o lote tem → mostra "Aplicar aos outros números".
 */
function ScheduleModal({ open, initial, sessions, byId, onClose }) {
  const [sessionIds, setSessionIds] = useState([]);
  const [mode, setMode] = useState('all');
  const [targets, setTargets] = useState([]);
  const [messages, setMessages] = useState([newMessage()]);
  const [when, setWhen] = useState('');
  const [applyToBatch, setApplyToBatch] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial?.id);
  const single = sessions.length <= 1;
  const connectedIds = useMemo(() => sessions.filter(isReady).map((s) => s.id), [sessions]);

  useEffect(() => {
    if (!open) return;
    const known = (ids) => (Array.isArray(ids) ? ids.filter((id) => byId.has(id)) : []);
    if (editing) {
      setSessionIds([initial.session_id]);
      setMode(initial.mode === 'split' ? 'split' : 'all');
      setTargets((initial.targets || []).map((t) => fromStored(t, initial.session_id)));
    } else {
      const wanted = known(initial?.session_ids);
      setSessionIds(wanted.length ? wanted : connectedIds.length ? connectedIds : sessions.map((s) => s.id));
      setMode(initial?.mode === 'split' ? 'split' : 'all');
      setTargets((initial?.targets || []).map((t) => fromStored(t, t.session_id)));
    }
    setMessages(toEditorMessages(initial?.messages));
    setWhen(initial?.schedule_at ? isoToBrtLocal(initial.schedule_at) : brtLocalNow(60));
    setApplyToBatch(true);
    setPhoneInput('');
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, editing]);

  const minLocal = brtLocalNow(1);
  const whenIso = brtLocalToIso(when);
  const whenValid = Boolean(whenIso) && new Date(whenIso).getTime() >= Date.now() + 60 * 1000;
  const connected = sessionIds.some((id) => isReady(byId.get(id)));
  const multi = !editing && sessionIds.length >= 2;
  const pickerSessionId = editing ? initial.session_id : sessionIds.length === 1 ? sessionIds[0] : undefined;
  const batchSize = Number(initial?.batch_size || 1);

  // telefone avulso (sem conversa): o back distribui entre os números (ou fixa no único)
  const addPhone = () => {
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 8) return toast.error('Digite um telefone com DDI e DDD (ex.: 55 11 99999-9999).');
    const full = digits.length <= 11 ? `55${digits}` : digits;
    if (targets.some((t) => (t.phone && t.phone === full) || (t.jid && t.jid.startsWith(`${full}@`)))) {
      toast('Esse telefone já está na lista.', { icon: 'ℹ️' });
      setPhoneInput('');
      return undefined;
    }
    setTargets((list) => [...list, { phone: full, name: fmtPhoneBR(full), kind: 'individual', session_id: pickerSessionId || null }]);
    setPhoneInput('');
    return undefined;
  };
  const removeTarget = (key) => setTargets((list) => list.filter((t) => targetKey(t) !== key));

  const submit = async () => {
    if (!editing && !sessionIds.length) return toast.error('Escolha pelo menos um número para enviar.');
    if (!targets.length) return toast.error('Escolha pelo menos um destinatário.');
    const valid = messages.filter((m) => (m.text || '').trim() || m.media?.id || m.media?.url);
    if (!valid.length) return toast.error('Escreva ao menos uma mensagem (texto ou mídia).');
    if (!whenIso) return toast.error('Informe dia e hora do envio.');
    if (!whenValid) return toast.error('O horário precisa ser pelo menos 1 minuto no futuro (Brasília).');
    setSaving(true);
    try {
      const body = {
        targets: targets.map(toPayload),
        messages: valid.map((m) => ({
          text: m.text || '',
          media_id: m.media?.id || undefined,
          delay_seconds: Math.min(30, Math.max(0, Number(m.delay_seconds) || 0))
        })),
        schedule_at: whenIso
      };
      if (editing) {
        if (batchSize > 1) body.apply_to_batch = applyToBatch;
        await patch(`/whatsapp/schedules/${enc(initial.id)}`, body);
        toast.success(batchSize > 1 && applyToBatch ? 'Agendamento atualizado em todos os números do lote.' : 'Agendamento atualizado.');
      } else {
        const r = await post('/whatsapp/schedules', { ...body, session_ids: sessionIds, mode: multi ? mode : 'all' });
        const n = Array.isArray(r?.items) ? r.items.length : 1;
        toast.success(`Agendado para ${fmtDateBRT(whenIso)}${n > 1 ? ` em ${n} números` : ''}.`);
        (Array.isArray(r?.warnings) ? r.warnings : []).slice(0, 3).forEach((w) => toast(w, { icon: '⚠️', duration: 7000 }));
      }
      onClose?.(true);
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível salvar o agendamento.'));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  let step = 1;
  const next = () => step++;

  return (
    <TgModal
      open={open}
      onClose={() => !saving && onClose?.(false)}
      title={editing ? 'Editar agendamento' : initial ? 'Reagendar envio' : 'Novo agendamento'}
      subtitle={
        editing
          ? `Edita a linha do número ${sessionLabel(initial.session || byId.get(initial.session_id))}. Escolha quem recebe, o que enviar e quando (Brasília).`
          : 'Escolha por quais números enviar, quem recebe, o que enviar e quando (horário de Brasília).'
      }
      maxWidth="md"
      disableClose={saving}
      footer={
        // um único filho: no celular o aviso ocupa a linha de cima e os botões a de baixo
        <Box sx={{ width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 0' }, minWidth: 0 }}>
            {!connected ? (
              <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600, display: 'block' }}>
                {single || editing ? 'Número desconectado' : 'Nenhum número escolhido está conectado'}: o envio só acontece com o número
                ativo no horário.
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ ml: 'auto' }}>
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
          </Stack>
        </Box>
      }
    >
      <Stack spacing={3}>
        {/* ---------- números ---------- */}
        {editing ? null : single ? (
          sessions[0] ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>Enviar pelo número:</Typography>
              <WaNumberChip session={sessions[0]} showPhone size="medium" />
            </Stack>
          ) : null
        ) : (
          <Box>
            <SectionTitle
              n={next()}
              hint={sessionIds.length ? `${sessionIds.length} ${sessionIds.length === 1 ? 'número' : 'números'}` : ''}
            >
              Enviar pelo(s) número(s)
            </SectionTitle>
            <WaNumberMultiSelect sessions={sessions} value={sessionIds} onChange={setSessionIds} size="small" />
            {!connectedIds.length ? (
              <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.75 }}>
                Nenhum número conectado agora — o envio sai no horário se o número estiver ativo.
              </Typography>
            ) : null}
            {multi ? (
              <Box sx={{ mt: 1.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13.5, mb: 0.75 }}>Como dividir o envio</Typography>
                <ModePicker value={mode} onChange={setMode} />
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                  Uma conversa escolhida na lista sempre sai pelo número dela. Telefones avulsos seguem a regra acima.
                </Typography>
              </Box>
            ) : null}
          </Box>
        )}

        {/* ---------- destinatários ---------- */}
        <Box>
          <SectionTitle
            n={next()}
            hint={targets.length ? `${targets.length} ${targets.length === 1 ? 'destinatário' : 'destinatários'}` : ''}
          >
            Destinatários
          </SectionTitle>
          {/* selecionados (com o chip do número de cada conversa) */}
          <Box
            sx={{
              border: '1px dashed',
              borderColor: targets.length ? (t) => `rgba(${t.vars.palette.success.mainChannel} / 0.5)` : 'divider',
              borderRadius: 2,
              p: 1,
              mb: 1.25,
              minHeight: 52,
              bgcolor: targets.length ? (t) => tint(t, 'success', 0.05) : 'transparent'
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: targets.length ? 0.75 : 0 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: targets.length ? WA_DARK : 'text.secondary' }}>
                {targets.length ? `${targets.length} ${targets.length === 1 ? 'selecionado' : 'selecionados'}` : 'Nenhum selecionado ainda'}
              </Typography>
              {targets.length ? (
                <Typography
                  variant="caption"
                  onClick={() => setTargets([])}
                  sx={{ color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'error.main' } }}
                >
                  limpar
                </Typography>
              ) : null}
            </Stack>
            {targets.length ? (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {targets.map((t) => {
                  const s = t.session || byId.get(t.session_id) || null;
                  const showNum = !single && !editing && s;
                  return (
                    <Chip
                      key={targetKey(t)}
                      size="small"
                      label={
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                          {showNum ? <WaNumberChip session={s} sx={{ height: 16, fontSize: 10, maxWidth: 110 }} /> : null}
                          <Typography component="span" variant="caption" noWrap sx={{ fontWeight: 600 }}>
                            {targetName(t)}
                          </Typography>
                        </Stack>
                      }
                      icon={t.kind === 'group' ? <IconUsersGroup size={13} /> : t.phone && !t.chat_id ? <IconPhone size={13} /> : undefined}
                      onDelete={() => removeTarget(targetKey(t))}
                      sx={{
                        fontWeight: 600,
                        borderRadius: 1.5,
                        maxWidth: 300,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    />
                  );
                })}
              </Stack>
            ) : null}
          </Box>
          <WaChatPicker
            value={targets}
            onChange={setTargets}
            connected={connected}
            listHeight={240}
            hideSelected
            sessionId={pickerSessionId}
          />
          {/* telefone avulso */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mt: 1.25 }}>
            <TextField
              size="small"
              label="Telefone avulso (DDI + DDD + número)"
              placeholder="5511999999999"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPhone();
                }
              }}
              sx={{ flex: 1, maxWidth: { sm: 360 } }}
              slotProps={{ input: { startAdornment: <IconPhone size={16} style={{ marginRight: 6, opacity: 0.6 }} /> } }}
            />
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={addPhone}
              disabled={phoneInput.replace(/\D/g, '').length < 8}
              startIcon={<IconPlus size={15} />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                borderColor: 'divider',
                alignSelf: { xs: 'flex-start', sm: 'auto' }
              }}
            >
              Adicionar
            </Button>
          </Stack>
          {multi ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              Telefone avulso: {mode === 'all' ? 'recebe por cada número escolhido' : 'é distribuído entre os números'}.
            </Typography>
          ) : null}
        </Box>

        {/* ---------- mensagens ---------- */}
        <Box>
          <SectionTitle n={next()} hint="enviadas em sequência, na ordem">
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

        {/* ---------- quando ---------- */}
        <Box>
          <SectionTitle n={next()}>Quando</SectionTitle>
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
          {editing && batchSize > 1 ? (
            <FormControlLabel
              control={
                <Checkbox
                  checked={applyToBatch}
                  onChange={(e) => setApplyToBatch(e.target.checked)}
                  sx={{ '&.Mui-checked': { color: WA_GREEN } }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Aplicar aos outros números do lote ({batchSize - 1} {batchSize - 1 === 1 ? 'linha' : 'linhas'})
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Replica as mensagens e o horário. Os destinatários continuam por número.
                  </Typography>
                </Box>
              }
              sx={{ mt: 0.5, alignItems: 'flex-start', '& .MuiCheckbox-root': { pt: 0.25 } }}
            />
          ) : null}
        </Box>
      </Stack>
    </TgModal>
  );
}

// ---------------------------------------------------------------- linha de um número dentro do lote
function BatchLine({ item, byId, showNumber, now, children }) {
  const sending = item.status === 'sending';
  const late = PENDING.has(item.status) && !sending && new Date(item.schedule_at || 0).getTime() < now;
  const st = STATUS_UI[item.status] || STATUS_UI.pending;
  const n = (item.targets || []).length;
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
      {showNumber ? <WaNumberChip session={item.session || byId.get(item.session_id) || { id: item.session_id, label: 'Número' }} /> : null}
      <TgStatusPill status={late ? 'pending' : st.pill} label={sending ? 'Enviando…' : late ? 'Aguardando envio' : st.label} />
      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
        {n} {n === 1 ? 'destinatário' : 'destinatários'}
      </Typography>
      <Box sx={{ flex: 1 }} />
      {children}
    </Stack>
  );
}

// ---------------------------------------------------------------- card "Próximos" (lote)
function UpcomingCard({ group, now, byId, showNumber, onSendNow, onEdit, onCancel }) {
  const items = group.items;
  const first = items[0];
  const many = items.length > 1;
  const targets = unionTargets(items);
  const n = targets.length;
  const msgs = (first.messages || []).length;
  const sendingAny = items.some((x) => x.status === 'sending');
  const earliest = items.reduce((a, b) => (new Date(a.schedule_at || 0) <= new Date(b.schedule_at || 0) ? a : b));
  const late = !sendingAny && new Date(earliest.schedule_at || 0).getTime() < now;
  const Mode = MODE_UI[first.mode === 'split' ? 'split' : 'all'];
  return (
    <TgCard sx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <TargetAvatars targets={targets} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14.5 }} noWrap>
            {targetsSummary(targets)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {n} {n === 1 ? 'destinatário' : 'destinatários'} · {msgs} {msgs === 1 ? 'mensagem' : 'mensagens'}
          </Typography>
        </Box>
        {many ? (
          <Tooltip title={Mode.label}>
            <Chip
              size="small"
              icon={<IconDeviceMobile size={13} />}
              label={`lote em ${items.length} números`}
              sx={{ height: 22, borderRadius: 1, fontWeight: 700, bgcolor: 'action.selected', flexShrink: 0 }}
            />
          </Tooltip>
        ) : (
          <TgStatusPill
            status={late ? 'pending' : (STATUS_UI[first.status] || STATUS_UI.pending).pill}
            label={sendingAny ? 'Enviando…' : late ? 'Aguardando envio' : (STATUS_UI[first.status] || STATUS_UI.pending).label}
          />
        )}
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
        {firstMessagePreview(first.messages)}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: 'text.secondary' }}>
        <IconClock size={14} />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {fmtDateBRT(earliest.schedule_at)}
        </Typography>
        <Typography variant="caption" sx={{ color: sendingAny ? 'info.main' : late ? 'warning.main' : WA_DARK, fontWeight: 700 }} noWrap>
          · {sendingAny ? 'enviando agora' : relTime(earliest.schedule_at, now)}
        </Typography>
        {many ? (
          <>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" sx={{ color: 'text.disabled' }} noWrap>
              {Mode.short}
            </Typography>
          </>
        ) : null}
      </Stack>

      {/* uma linha por número: status + ações (enviar agora / editar / cancelar são por linha) */}
      <Stack spacing={0.5}>
        {items.map((item) => {
          const sending = item.status === 'sending';
          const ready = isReady(item.session || byId.get(item.session_id));
          return (
            <BatchLine key={item.id} item={item} byId={byId} showNumber={showNumber || many} now={now}>
              {many && item.schedule_at !== earliest.schedule_at ? (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {fmtDateBRT(item.schedule_at)}
                </Typography>
              ) : null}
              <Tooltip title={ready ? (many ? 'Enviar agora por este número' : 'Enviar agora') : 'Conecte o número para enviar agora'}>
                <span>
                  <IconButton size="small" onClick={() => onSendNow(item)} disabled={sending || !ready} sx={{ color: WA_DARK }}>
                    <IconSend size={17} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={many ? 'Editar esta linha' : 'Editar'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => onEdit({ ...item, batch_size: items.filter((x) => x.status === 'pending').length })}
                    disabled={sending}
                  >
                    <IconPencil size={17} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={many ? 'Cancelar só neste número' : 'Cancelar agendamento'}>
                <span>
                  <IconButton size="small" color="error" onClick={() => onCancel(item)} disabled={sending}>
                    <IconX size={17} />
                  </IconButton>
                </span>
              </Tooltip>
            </BatchLine>
          );
        })}
      </Stack>
    </TgCard>
  );
}

// ---------------------------------------------------------------- linha do histórico (lote)
function ResultChip({ r }) {
  const ok = r.status === 'sent';
  const skipped = r.status === 'skipped';
  const chip = (
    <Chip
      size="small"
      icon={ok ? <IconCheck size={13} /> : skipped ? <IconAlertTriangle size={13} /> : <IconX size={13} />}
      label={r.name || r.chat_id || r.error}
      sx={{
        height: 22,
        maxWidth: 220,
        borderRadius: 1,
        fontWeight: 600,
        fontSize: 11.5,
        color: ok ? WA_DARK : skipped ? 'warning.main' : 'error.main',
        bgcolor: (t) => tint(t, ok ? 'success' : skipped ? 'warning' : 'error', 0.12),
        '& .MuiChip-icon': { color: 'inherit' }
      }}
    />
  );
  const tip = ok ? (r.sent_at ? `Enviado em ${fmtDateBRT(r.sent_at)}` : 'Enviado') : r.error || (skipped ? 'Pulado' : 'Falha no envio');
  return <Tooltip title={tip}>{chip}</Tooltip>;
}

function HistoryRow({ group, byId, showNumber, onReschedule }) {
  const items = group.items;
  const first = items[0];
  const many = items.length > 1;
  const targets = unionTargets(items);
  const allCanceled = items.every((x) => x.status === 'canceled');
  const when = first.sent_at || first.schedule_at || first.created_at;
  const Mode = MODE_UI[first.mode === 'split' ? 'split' : 'all'];
  return (
    <TgCard
      hover={false}
      sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start', opacity: allCanceled ? 0.75 : 1 }}
    >
      <TargetAvatars targets={targets} size={30} max={3} />
      <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.25 }}>
          {many ? (
            <Tooltip title={Mode.label}>
              <Chip
                size="small"
                icon={<IconDeviceMobile size={13} />}
                label={`lote em ${items.length} números · ${Mode.short}`}
                sx={{ height: 22, borderRadius: 1, fontWeight: 700, bgcolor: 'action.selected' }}
              />
            </Tooltip>
          ) : (
            <TgStatusPill
              status={(STATUS_UI[first.status] || STATUS_UI.sent).pill}
              label={(STATUS_UI[first.status] || STATUS_UI.sent).label}
            />
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {!many && first.status === 'sent' ? 'enviado em ' : !many && first.status === 'canceled' ? 'era para ' : ''}
            {fmtDateBRT(when)}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {targetsSummary(targets, 3)}
        </Typography>
        <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
          {firstMessagePreview(first.messages)}
        </Typography>
        <Stack spacing={0.75} sx={{ mt: 0.75 }}>
          {items.map((item) => {
            const results = item.results || [];
            const attempted = results.filter((r) => r.chat_id && r.status !== 'skipped');
            const okCount = attempted.filter((r) => r.status === 'sent').length;
            const failCount = attempted.filter((r) => r.status === 'failed').length;
            const st = STATUS_UI[item.status] || STATUS_UI.sent;
            return (
              <Box key={item.id} sx={{ minWidth: 0 }}>
                {many || showNumber ? (
                  <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.4 }}>
                    <WaNumberChip session={item.session || byId.get(item.session_id) || { id: item.session_id, label: 'Número' }} />
                    {many ? <TgStatusPill status={st.pill} label={st.label} /> : null}
                    {many && item.sent_at ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {fmtDateBRT(item.sent_at)}
                      </Typography>
                    ) : null}
                    {attempted.length ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        · {okCount}/{attempted.length} {okCount === 1 ? 'entregue' : 'entregues'}
                        {failCount ? `, ${failCount} ${failCount === 1 ? 'falha' : 'falhas'}` : ''}
                      </Typography>
                    ) : null}
                  </Stack>
                ) : attempted.length ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.4 }}>
                    {okCount}/{attempted.length} {okCount === 1 ? 'entregue' : 'entregues'}
                    {failCount ? `, ${failCount} ${failCount === 1 ? 'falha' : 'falhas'}` : ''}
                  </Typography>
                ) : null}
                {results.length ? (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {results.slice(0, 12).map((r, i) => (
                      <ResultChip key={`${r.chat_id || i}`} r={r} />
                    ))}
                    {results.length > 12 ? (
                      <Chip size="small" label={`+${results.length - 12}`} sx={{ height: 22, borderRadius: 1, fontWeight: 700 }} />
                    ) : null}
                  </Stack>
                ) : null}
                {item.status === 'failed' && item.error ? (
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'error.main', mt: 0.4 }}>
                    <IconAlertTriangle size={13} />
                    <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>
                      {item.error}
                    </Typography>
                  </Stack>
                ) : null}
              </Box>
            );
          })}
        </Stack>
      </Box>
      <Tooltip title="Reagendar (cria um novo agendamento com os mesmos números, destinatários e mensagens)">
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<IconRefresh size={15} />}
          onClick={() => onReschedule(group)}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            flexShrink: 0,
            borderColor: 'divider',
            // celular: desce para uma linha própria, em largura total (o conteúdo fica com a largura toda)
            flex: { xs: '1 1 100%', sm: '0 0 auto' }
          }}
        >
          Reagendar
        </Button>
      </Tooltip>
    </TgCard>
  );
}

// =================== PÁGINA ===================
export default function WhatsAppSchedules() {
  const { sessions, byId, connected, loading: sessionLoading, gateway_error } = useWaSessions();
  const now = useNow(30000);
  const many = sessions.length > 1;
  const bannerSession = useMemo(
    () => ({ status: connected ? 'ready' : sessions[0]?.status || 'none', sessions, gateway_error }),
    [connected, sessions, gateway_error]
  );

  const [sessionFilter, setSessionFilter] = useState(''); // '' = todos os números
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

  const listParams = (extra) => ({ ...extra, ...(sessionFilter ? { session_id: sessionFilter } : {}) });

  const upSeq = useRef(0);
  const loadUpcoming = useCallback(async () => {
    const s = ++upSeq.current;
    try {
      const r = await get('/whatsapp/schedules', { params: listParams({ status: 'pending', page: 1, page_size: 100 }) });
      if (s !== upSeq.current) return;
      const items = (Array.isArray(r) ? r : r?.items || []).filter((x) => PENDING.has(x.status));
      items.sort((a, b) => new Date(a.schedule_at || 0) - new Date(b.schedule_at || 0));
      setUpcoming(items);
    } catch (e) {
      if (s === upSeq.current) toast.error(errMsg(e, 'Falha ao carregar os agendamentos.'));
    } finally {
      if (s === upSeq.current) setLoadingUp(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionFilter]);

  const histSeq = useRef(0);
  const loadHistory = useCallback(async () => {
    const s = ++histSeq.current;
    setLoadingHist(true);
    try {
      const r = await get('/whatsapp/schedules', {
        params: listParams({ status: 'history', only: histStatus !== 'all' ? histStatus : undefined, page: histPage, page_size: 20 })
      });
      if (s !== histSeq.current) return;
      const items = (Array.isArray(r) ? r : r?.items || []).filter((x) => !PENDING.has(x.status));
      setHistory({ items, total: r?.total ?? items.length, page: r?.page ?? histPage, pages: r?.pages ?? 1 });
    } catch (e) {
      if (s === histSeq.current) toast.error(errMsg(e, 'Falha ao carregar o histórico.'));
    } finally {
      if (s === histSeq.current) setLoadingHist(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histPage, histStatus, sessionFilter]);

  useEffect(() => {
    loadUpcoming();
  }, [loadUpcoming]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);
  useEffect(() => {
    setHistPage(1);
  }, [histStatus, sessionFilter]);

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

  // reagendar = novo agendamento pré-preenchido com os números/modo/alvos do lote (sem id ⇒ POST)
  const reschedule = (group) => {
    const items = group.items;
    setModal({
      initial: {
        session_ids: [...new Set(items.map((x) => x.session_id).filter(Boolean))],
        mode: items[0]?.mode === 'split' ? 'split' : 'all',
        // cada alvo fica preso ao número da linha de origem (reenvio fiel)
        targets: items.flatMap((x) => (x.targets || []).map((t) => ({ ...t, session_id: x.session_id }))),
        messages: items[0]?.messages,
        schedule_at: null
      }
    });
  };

  const upcomingGroups = useMemo(() => groupByBatch(upcoming), [upcoming]);
  const historyGroups = useMemo(() => groupByBatch(history.items), [history.items]);

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
  const batchSizeOf = (item) => upcoming.filter((x) => x.batch_id && x.batch_id === item.batch_id && x.status === 'pending').length;

  return (
    <Box>
      <WaPageHeader
        icon={IconCalendarClock}
        title="Agendamentos"
        subtitle={
          many
            ? 'Mensagens pontuais para contatos e grupos em dia e hora marcados, por um ou vários números. Depois de enviada, sai da lista.'
            : 'Mensagens pontuais para contatos e grupos em dia e hora marcados. Depois de enviada, sai da lista.'
        }
        action={
          // celular: o WaPageHeader põe isto numa linha própria; o select e o botão crescem, o ícone não
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {many ? (
              <WaNumberSelect
                sessions={sessions}
                value={sessionFilter}
                onChange={setSessionFilter}
                allowAll
                label="Número"
                sx={{ minWidth: { xs: 0, sm: 190 } }}
                fullWidth={false}
              />
            ) : null}
            <Tooltip title="Atualizar">
              <IconButton onClick={reloadAll}>
                <IconRefresh size={20} />
              </IconButton>
            </Tooltip>
            {newBtn}
          </Stack>
        }
      />

      <WaSessionBanner session={bannerSession} loading={sessionLoading} connected={connected} what="enviar as mensagens agendadas" />

      {/* ---------- próximos ---------- */}
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        <IconCalendarTime size={18} />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Próximos
        </Typography>
        <Chip size="small" label={upcomingGroups.length} sx={{ fontWeight: 700, height: 22 }} />
        {nextUp ? (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            · próximo {relTime(nextUp.schedule_at, now)}
          </Typography>
        ) : null}
      </Stack>
      {loadingUp ? (
        <TgListSkeleton rows={2} />
      ) : upcomingGroups.length === 0 ? (
        <TgEmptyState
          dense
          icon={IconCalendarClock}
          title={sessionFilter ? 'Nada agendado neste número' : 'Nada agendado'}
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
          {upcomingGroups.map((g) => (
            <UpcomingCard
              key={g.key}
              group={g}
              now={now}
              byId={byId}
              showNumber={many}
              onSendNow={setSendFor}
              onEdit={(it) => setModal({ initial: { ...it, batch_size: batchSizeOf(it) } })}
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
      ) : historyGroups.length === 0 ? (
        <TgEmptyState
          dense
          icon={IconHistory}
          title={histStatus !== 'all' || sessionFilter ? 'Nada com esse filtro' : 'Nenhum envio ainda'}
          description={
            histStatus !== 'all' || sessionFilter
              ? 'Troque o filtro ou o número.'
              : 'Os agendamentos enviados, com falha ou cancelados aparecem aqui.'
          }
        />
      ) : (
        <Stack spacing={1}>
          {historyGroups.map((g) => (
            <HistoryRow key={g.key} group={g} byId={byId} showNumber={many} onReschedule={reschedule} />
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
        sessions={sessions}
        byId={byId}
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
        message={
          cancelFor
            ? `As mensagens marcadas para ${fmtDateBRT(cancelFor.schedule_at)}${many ? ` pelo número ${sessionLabel(cancelFor.session || byId.get(cancelFor.session_id))}` : ''} não serão enviadas.${batchSizeOf(cancelFor) > 1 ? ' As outras linhas do lote continuam agendadas.' : ''}`
            : ''
        }
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
            ? `As mensagens vão para ${targetsSummary(sendFor.targets, 3)}${many ? ` pelo número ${sessionLabel(sendFor.session || byId.get(sendFor.session_id))}` : ''} imediatamente, em vez de ${fmtDateBRT(sendFor.schedule_at)}.${batchSizeOf(sendFor) > 1 ? ' As outras linhas do lote continuam no horário.' : ''}`
            : ''
        }
      />
    </Box>
  );
}
