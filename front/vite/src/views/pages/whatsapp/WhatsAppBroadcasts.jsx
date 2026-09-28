import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Popover,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  IconPlus,
  IconTrash,
  IconSpeakerphone,
  IconClock,
  IconDeviceFloppy,
  IconPencil,
  IconPlayerPlay,
  IconHistory,
  IconMessage2,
  IconChevronDown,
  IconUsers,
  IconSearch,
  IconFilter,
  IconFilterOff,
  IconDotsVertical,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconAlertTriangleFilled,
  IconAlertTriangle,
  IconLoader2,
  IconChevronLeft,
  IconChevronRight,
  IconFlame,
  IconHourglassHigh,
  IconListDetails,
  IconX,
  IconRefresh
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, post, put, remove } from 'api/api';
import {
  TgEmptyState,
  TgCard,
  TgStatusPill,
  TgFilterBar,
  TgModal,
  TgConfirmDialog,
  TgGhostButton,
  TgListSkeleton
} from 'views/pages/telegram/ui';
import WhatsAppMediaField from './WhatsAppMediaField';
import WhatsAppMessagesPreview from './WhatsAppMessagesPreview';
import {
  WaPageHeader,
  WaBadge,
  WaSessionBanner,
  useWaSession,
  uid,
  errMsg,
  asList,
  plural,
  fmtDateBRT,
  waButtonSx,
  WA_GREEN,
  WA_DARK
} from './waKit';

// ============================================================================
// WhatsApp → Broadcasts: disparos em massa para contatos e grupos com rotação
// de copies, horários diários (BRT), fila com ritmo e aquecimento do número.
// Espelho da página de Broadcasts do Telegram, sem seleção de bot.
// ============================================================================

const minToHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const hhmmToMin = (s) => {
  const [h, m] = String(s || '')
    .split(':')
    .map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};
const WARMUP = [20, 40, 80, 160, 320, 640, 1000];
const COLD = [5, 10, 20, 40, 60, 80, 100];
const RISK_TEXT =
  'Disparos para contatos que nunca falaram com você podem restringir ou banir o número. O WhatsApp decide isso sozinho e o Pub Mail não tem como reverter — a responsabilidade é sua.';

// resumo de audiência (linha + confirmação de disparo)
const audienceOf = (b) => {
  const contacts = b?.audience?.contacts || 0;
  const groups = b?.audience?.groups || 0;
  const total = b?.audience?.total ?? contacts + groups;
  const parts = [];
  if (contacts) parts.push(plural(contacts, 'contato', 'contatos'));
  if (groups) parts.push(plural(groups, 'grupo', 'grupos'));
  return { contacts, groups, total, parts };
};
const CONTACT_MODE_LABEL = { saved: 'contatos salvos', all: 'todos os contatos', none: 'sem contatos' };

// ---- pílula de horário com status de HOJE ----
const TIME_STATUS = {
  sent: { color: 'success.main', tip: (t) => `Disparado hoje às ${t} — tudo certo` },
  sent_with_errors: { color: 'warning.main', tip: (t) => `Disparado hoje às ${t}, com algumas falhas` },
  failed: { color: 'error.main', tip: (t) => `Executou hoje (${t}) e falhou` },
  sending: { color: 'info.main', tip: () => 'Enviando agora…' },
  pending: { color: 'warning.main', tip: (t) => `Aguardando o horário de hoje (${t})` },
  missed: { color: 'text.disabled', tip: (t) => `Agendado ${t} — não rodou hoje (roda no próximo dia)` }
};
function TimeChip({ minute, status }) {
  const hhmm = minToHHMM(minute);
  const st = TIME_STATUS[status] || TIME_STATUS.pending;
  const sending = status === 'sending';
  return (
    <Tooltip title={st.tip(hhmm)} arrow>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.6,
          pl: 0.8,
          pr: 1,
          py: 0.4,
          borderRadius: 5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          fontSize: 11.5,
          fontWeight: 700,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          cursor: 'default'
        }}
      >
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            flexShrink: 0,
            bgcolor: st.color,
            ...(sending
              ? {
                  animation: 'wapulse 1s ease-in-out infinite',
                  '@keyframes wapulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } }
                }
              : {})
          }}
        />
        {hhmm}
      </Box>
    </Tooltip>
  );
}

// ---- multi-select com busca ----
function MultiSelect({ label, options, value, onChange, placeholder, limitTags = 3 }) {
  const selected = options.filter((o) => (value || []).includes(o.value));
  return (
    <Autocomplete
      multiple
      limitTags={limitTags}
      options={options}
      value={selected}
      onChange={(_, vs) => onChange(vs.map((v) => v.value))}
      getOptionLabel={(o) => o?.label ?? ''}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      size="small"
      renderInput={(p) => <TextField {...p} label={label} placeholder={placeholder} />}
      slotProps={{ paper: { sx: { borderRadius: 2 } } }}
    />
  );
}

// ---------------------------------------------------------------- aquecimento
function warmupFrom(list, session) {
  const w = list.find((b) => b?.warmup)?.warmup;
  if (w) return { ...w, source: 'broadcast' };
  if (!session) return null;
  const day = session.warmup_day || null;
  const idx = day ? Math.min(day, 7) - 1 : null;
  return {
    day,
    daily_limit: idx != null ? WARMUP[idx] : null,
    cold_limit: idx != null ? COLD[idx] : null,
    sent_today: null,
    pacing_enabled: session.pacing_enabled ?? true,
    source: 'session'
  };
}
function WarmupStrip({ warmup }) {
  if (!warmup || (!warmup.day && warmup.daily_limit == null)) return null;
  const hot = (warmup.day || 0) >= 8;
  const limit = warmup.daily_limit;
  const sent = warmup.sent_today;
  const pct = limit && sent != null ? Math.min(100, Math.round((sent / limit) * 100)) : null;
  const paced = warmup.pacing_enabled !== false;
  return (
    <TgCard hover={false} sx={{ p: { xs: 1.5, sm: 2 }, mb: 2.5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              color: hot ? 'success.main' : 'warning.main',
              bgcolor: (t) => `rgba(${t.vars.palette[hot ? 'success' : 'warning'].mainChannel} / 0.14)`
            }}
          >
            <IconFlame size={22} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.15 }}>
              {hot ? 'Número aquecido' : `Aquecimento · dia ${warmup.day || 1} de 7`}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {paced
                ? 'Ritmo automático ligado — o que passar do limite fica aguardando o próximo dia.'
                : 'Ritmo automático desligado — responsabilidade assumida nas Configurações.'}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {limit ? (
            <>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Enviados hoje: {sent != null ? sent.toLocaleString('pt-BR') : '—'} / {limit.toLocaleString('pt-BR')}
                </Typography>
                {pct != null ? (
                  <Typography
                    variant="caption"
                    sx={{ color: pct >= 100 ? 'error.main' : pct >= 80 ? 'warning.main' : 'text.secondary', fontWeight: 700 }}
                  >
                    {pct}%
                  </Typography>
                ) : null}
              </Stack>
              <LinearProgress
                variant="determinate"
                value={pct ?? 0}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'action.selected',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    bgcolor: pct >= 100 ? 'error.main' : pct >= 80 ? 'warning.main' : WA_GREEN
                  }
                }}
              />
            </>
          ) : null}
        </Box>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
          {limit ? (
            <Chip
              size="small"
              label={`Limite de hoje: ${limit.toLocaleString('pt-BR')}`}
              variant="outlined"
              sx={{ fontWeight: 700, borderRadius: 1 }}
            />
          ) : null}
          {warmup.cold_limit ? (
            <Tooltip title="Contatos que nunca falaram com o número. Acima disso, o envio para frios fica aguardando o próximo dia.">
              <Chip
                size="small"
                label={`Frios: até ${warmup.cold_limit}/dia`}
                variant="outlined"
                sx={{ fontWeight: 700, borderRadius: 1 }}
              />
            </Tooltip>
          ) : null}
          <Chip
            size="small"
            label={paced ? 'Ritmo automático' : 'Sem limitador'}
            color={paced ? 'success' : 'warning'}
            variant="outlined"
            sx={{ fontWeight: 700, borderRadius: 1 }}
          />
        </Stack>
      </Stack>
    </TgCard>
  );
}

// ---------------------------------------------------------------- copies
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
              <IconButton size="small" color="error" onClick={() => onChange(list.filter((x) => x.id !== m.id))}>
                <IconTrash size={15} />
              </IconButton>
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

function CopiesModal({ broadcast, open, onClose }) {
  const [copies, setCopies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openOnMount, setOpenOnMount] = useState(null);

  useEffect(() => {
    if (!open || !broadcast) return;
    setLoading(true);
    get(`/whatsapp/broadcasts/${broadcast.id}/copies`)
      .then((r) => {
        const cs = asList(r);
        setCopies(
          cs.length
            ? cs.map((c) => ({
                ...c,
                messages: (c.messages || []).map((m) => ({ ...newMessage(), ...m, id: m.id || uid() })),
                _k: uid('c')
              }))
            : [{ _k: uid('c'), messages: [newMessage()] }]
        );
      })
      .catch((e) => toast.error(errMsg(e, 'Falha ao carregar copies.')))
      .finally(() => setLoading(false));
  }, [open, broadcast]);

  const setCopy = (k, messages) => setCopies((cs) => cs.map((c) => (c._k === k ? { ...c, messages } : c)));
  const addCopy = () => {
    const k = uid('c');
    setOpenOnMount(k);
    setCopies((cs) => [...cs, { _k: k, messages: [newMessage()] }]);
  };
  const removeCopy = (k) => setCopies((cs) => cs.filter((c) => c._k !== k));

  const save = async () => {
    const empty = copies.findIndex((c) => !(c.messages || []).some((m) => (m.text || '').trim() || m.media?.id));
    if (empty >= 0) return toast.error(`A copy ${empty + 1} está vazia — escreva um texto ou adicione uma mídia.`);
    setSaving(true);
    try {
      await put(`/whatsapp/broadcasts/${broadcast.id}/copies`, {
        copies: copies.map((c, i) => ({
          ...(c.id ? { id: c.id } : {}),
          position: i,
          messages: c.messages.map((m) => ({ id: m.id, text: m.text || '', media: m.media || null, delay_seconds: m.delay_seconds || 0 }))
        }))
      });
      toast.success('Copies salvas.');
      onClose(true);
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao salvar.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <TgModal
      open={open}
      onClose={() => !saving && onClose(false)}
      disableClose={saving}
      maxWidth="lg"
      title={`Copies — ${broadcast?.name || ''}`}
      subtitle={`Cada copy é um conjunto de mensagens enviadas juntas. A cada disparo, uma copy é escolhida (${broadcast?.mode === 'random' ? 'aleatória' : 'em sequência'}).`}
      footer={
        <>
          <Button color="inherit" onClick={() => onClose(false)} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={saving || loading}
            startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={18} />}
            sx={waButtonSx}
          >
            Salvar copies
          </Button>
        </>
      }
    >
      {loading ? (
        <TgListSkeleton rows={3} />
      ) : (
        <Stack spacing={1.5}>
          {copies.map((c, i) => {
            const msgCount = (c.messages || []).length;
            const firstText = (c.messages || []).map((m) => (m.text || '').trim()).find(Boolean) || '';
            return (
              <Accordion
                key={c._k}
                defaultExpanded={c._k === openOnMount || copies.length === 1}
                disableGutters
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: 'rgba(37,211,102,0.04)',
                  '&:before': { display: 'none' }
                }}
              >
                <AccordionSummary
                  expandIcon={<IconChevronDown size={18} />}
                  sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1, my: 1, minWidth: 0, overflow: 'hidden' } }}
                >
                  <Chip label={`Copy ${i + 1}`} size="small" sx={{ fontWeight: 700, flexShrink: 0, bgcolor: WA_GREEN, color: '#fff' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                    {msgCount === 1 ? '1 msg' : `${msgCount} msgs`}
                  </Typography>
                  {firstText ? (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.disabled',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        minWidth: 0,
                        pr: 1
                      }}
                    >
                      — {firstText}
                    </Typography>
                  ) : (
                    <Box sx={{ flex: 1 }} />
                  )}
                  {copies.length > 1 ? (
                    <Tooltip title="Remover copy">
                      <Box
                        component="span"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCopy(c._k);
                        }}
                        sx={{
                          display: 'inline-flex',
                          color: 'error.main',
                          cursor: 'pointer',
                          p: 0.5,
                          mr: 0.5,
                          borderRadius: 1,
                          '&:hover': { bgcolor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.12)` }
                        }}
                      >
                        <IconTrash size={16} />
                      </Box>
                    </Tooltip>
                  ) : null}
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 320px' } }}>
                    <MessagesEditor messages={c.messages} onChange={(msgs) => setCopy(c._k, msgs)} />
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        Preview
                      </Typography>
                      <WhatsAppMessagesPreview messages={c.messages} />
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}
          <Button
            startIcon={<IconPlus size={16} />}
            onClick={addCopy}
            sx={{ textTransform: 'none', alignSelf: 'flex-start', color: WA_DARK }}
          >
            Adicionar copy
          </Button>
        </Stack>
      )}
    </TgModal>
  );
}

// ---------------------------------------------------------------- modal de broadcast
const EMPTY = {
  name: 'Novo broadcast',
  targets: { contacts: 'saved', contact_ids: [], tags: [], groups: [] },
  times: [],
  mode: 'sequential',
  delete_used: false,
  interval_ms: 8000,
  active: true
};

function BroadcastModal({ initial, open, onClose, groups, contacts, tags }) {
  const [form, setForm] = useState(EMPTY);
  const [riskAck, setRiskAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timeInput, setTimeInput] = useState('09:00');
  const [estimate, setEstimate] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({ ...EMPTY, ...initial, targets: { ...EMPTY.targets, ...(initial.targets || {}) } });
      setRiskAck(Boolean(initial.risk_ack_at));
    } else {
      setForm(EMPTY);
      setRiskAck(false);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => {
      post('/whatsapp/broadcasts/audience-estimate', { targets: form.targets })
        .then(setEstimate)
        .catch(() => setEstimate(null));
    }, 400);
    return () => clearTimeout(t);
  }, [open, form.targets]);

  const setF = (p) => setForm((f) => ({ ...f, ...p }));
  const setT = (p) => setForm((f) => ({ ...f, targets: { ...f.targets, ...p } }));

  const addTime = () => {
    const min = hhmmToMin(timeInput);
    if (min == null) return;
    if (!form.times.includes(min)) setF({ times: [...form.times, min].sort((a, b) => a - b) });
  };

  const hasTargets = form.targets.contacts !== 'none' || form.targets.contact_ids.length > 0 || form.targets.groups.length > 0;

  const save = async () => {
    if (!form.name.trim()) return toast.error('Dê um nome ao broadcast.');
    if (!hasTargets) return toast.error('Escolha contatos e/ou grupos como destino.');
    if (!riskAck) return toast.error('Marque “Entendo e assumo a responsabilidade” para salvar.');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        targets: form.targets,
        times: form.times,
        mode: form.mode,
        delete_used: form.delete_used,
        interval_ms: Math.max(1000, Number(form.interval_ms) || 8000),
        active: form.active,
        risk_ack: true
      };
      if (initial?.id) await put(`/whatsapp/broadcasts/${initial.id}`, payload);
      else await post('/whatsapp/broadcasts', payload);
      toast.success('Broadcast salvo.');
      onClose(true);
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao salvar.'));
    } finally {
      setSaving(false);
    }
  };

  const contactOptions = useMemo(
    () =>
      contacts.map((c) => ({
        value: c.id,
        label: `${c.display_name || c.phone || c.id}${c.display_name && c.phone ? ` · ${c.phone}` : ''}`
      })),
    [contacts]
  );
  const intervalSec = Math.round((Number(form.interval_ms) || 0) / 1000);

  return (
    <TgModal
      open={open}
      onClose={() => !saving && onClose(false)}
      disableClose={saving}
      maxWidth="sm"
      title={initial?.id ? 'Editar broadcast' : 'Novo broadcast'}
      footer={
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
          <FormControlLabel
            control={<Switch checked={form.active} onChange={(e) => setF({ active: e.target.checked })} />}
            label={form.active ? 'Ativo' : 'Inativo'}
          />
          <Stack direction="row" spacing={1}>
            <Button color="inherit" onClick={() => onClose(false)} disabled={saving} sx={{ textTransform: 'none' }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={save}
              disabled={saving || !riskAck}
              startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={18} />}
              sx={waButtonSx}
            >
              Salvar
            </Button>
          </Stack>
        </Stack>
      }
    >
      <Stack spacing={2.5}>
        <TextField label="Nome" size="small" fullWidth value={form.name} onChange={(e) => setF({ name: e.target.value })} />

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Contatos</Typography>
          <RadioGroup value={form.targets.contacts} onChange={(e) => setT({ contacts: e.target.value })}>
            <FormControlLabel value="saved" control={<Radio size="small" />} label="Contatos salvos na organização" />
            <FormControlLabel value="all" control={<Radio size="small" />} label="Todos os contatos do WhatsApp conectado" />
            <FormControlLabel value="none" control={<Radio size="small" />} label="Nenhum (só os escolhidos abaixo / grupos)" />
          </RadioGroup>
          {form.targets.contacts !== 'none' && tags.length ? (
            <Box sx={{ mt: 1 }}>
              <MultiSelect
                label="Filtrar por tags"
                value={form.targets.tags}
                onChange={(v) => setT({ tags: v })}
                options={tags.map((t) => ({ value: t, label: t }))}
                placeholder="Só quem tem estas tags…"
              />
            </Box>
          ) : null}
          <Box sx={{ mt: 1.5 }}>
            <MultiSelect
              label="Contatos específicos"
              value={form.targets.contact_ids}
              onChange={(v) => setT({ contact_ids: v })}
              options={contactOptions}
              placeholder="Adicionar contatos…"
              limitTags={2}
            />
          </Box>
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Grupos</Typography>
          <MultiSelect
            label="Grupos"
            value={form.targets.groups}
            onChange={(v) => setT({ groups: v })}
            options={groups.map((g) => ({
              value: g.chat_id,
              label: `${g.name || g.chat_id}${g.participants_count ? ` (${g.participants_count})` : ''}`
            }))}
            placeholder="Escolher grupos…"
          />
          {estimate ? (
            <Alert
              severity="info"
              icon={<IconUsers size={18} />}
              sx={{ mt: 1.5, borderRadius: 2, py: 0, '& .MuiAlert-message': { fontSize: 12.5 } }}
            >
              Audiência ≈ <b>{(estimate.total || 0).toLocaleString('pt-BR')}</b> ({estimate.contacts || 0} contatos · {estimate.groups || 0}{' '}
              grupos).
            </Alert>
          ) : null}
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Horários (todo dia, Brasília)</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField type="time" size="small" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} sx={{ width: 130 }} />
            <Button
              variant="outlined"
              startIcon={<IconPlus size={15} />}
              onClick={addTime}
              sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.primary', textTransform: 'none' }}
            >
              Adicionar
            </Button>
          </Stack>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {form.times.length === 0 ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Nenhum horário — só disparo manual. Ex.: 11:20, 15:00…
              </Typography>
            ) : null}
            {form.times.map((t) => (
              <Chip
                key={t}
                icon={<IconClock size={13} />}
                label={minToHHMM(t)}
                onDelete={() => setF({ times: form.times.filter((x) => x !== t) })}
                sx={{ borderRadius: 1.5, fontWeight: 700 }}
              />
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Modo de envio</Typography>
          <RadioGroup value={form.mode} onChange={(e) => setF({ mode: e.target.value })}>
            <FormControlLabel value="sequential" control={<Radio size="small" />} label="Sequência (rotaciona; ao fim, volta ao início)" />
            <FormControlLabel value="random" control={<Radio size="small" />} label="Aleatório (sorteia uma copy a cada disparo)" />
          </RadioGroup>
          <FormControlLabel
            control={<Switch checked={form.delete_used} onChange={(e) => setF({ delete_used: e.target.checked })} />}
            label="Apagar a copy depois de usar"
          />
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Ritmo</Typography>
          <TextField
            type="number"
            size="small"
            label="Intervalo entre envios (segundos)"
            value={intervalSec}
            onChange={(e) => setF({ interval_ms: Math.min(600, Math.max(1, Number(e.target.value) || 1)) * 1000 })}
            inputProps={{ min: 1, max: 600 }}
            sx={{ width: 260 }}
            helperText="Intervalos maiores parecem mais humanos e reduzem o risco de restrição. Sugestão: 8 s ou mais."
          />
        </Box>

        <Box
          sx={{
            p: 1.75,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: (t) => `rgba(${t.vars.palette.warning.mainChannel} / 0.5)`,
            bgcolor: (t) => `rgba(${t.vars.palette.warning.mainChannel} / 0.08)`
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={{ color: 'warning.main', mt: 0.25, flexShrink: 0 }}>
              <IconAlertTriangle size={22} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 14 }}>Atenção: risco de restrição do número</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                {RISK_TEXT}
              </Typography>
              <FormControlLabel
                sx={{ mt: 0.75, ml: -0.75 }}
                control={
                  <Checkbox
                    size="small"
                    checked={riskAck}
                    onChange={(e) => setRiskAck(e.target.checked)}
                    sx={{ '&.Mui-checked': { color: WA_DARK } }}
                  />
                }
                label={<Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>Entendo e assumo a responsabilidade</Typography>}
              />
            </Box>
          </Stack>
        </Box>
      </Stack>
    </TgModal>
  );
}

// ---------------------------------------------------------------- histórico
function runOutcome(r) {
  if (r.status === 'running') return { key: 'sending', color: 'info.main', label: 'Enviando…', Icon: IconLoader2 };
  if ((r.sent || 0) === 0 && (r.total || 0) > 0 && (r.paced || 0) === 0)
    return { key: 'failed', color: 'error.main', label: 'Falhou', Icon: IconCircleXFilled };
  if ((r.failed || 0) > 0 || (r.blocked || 0) > 0)
    return { key: 'partial', color: 'warning.main', label: 'Concluído com falhas', Icon: IconAlertTriangleFilled };
  if ((r.paced || 0) > 0) return { key: 'paced', color: 'info.main', label: 'Parte aguardando limite do dia', Icon: IconHourglassHigh };
  return { key: 'clean', color: 'success.main', label: 'Concluído', Icon: IconCircleCheckFilled };
}
function RunBar({ r }) {
  const total = Math.max(1, r.total || 0);
  const seg = (n, token) => (n > 0 ? <Box sx={{ width: `${(n / total) * 100}%`, bgcolor: token }} /> : null);
  return (
    <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', bgcolor: 'action.selected', mt: 1 }}>
      {seg(r.sent || 0, 'success.main')}
      {seg(r.paced || 0, 'info.main')}
      {seg(r.blocked || 0, 'warning.main')}
      {seg(r.failed || 0, 'error.main')}
    </Box>
  );
}
function StatPill({ label, value, color = 'text.secondary' }) {
  return (
    <Box sx={{ textAlign: 'center', px: 1, py: 0.25, borderRadius: 1.5, bgcolor: 'action.hover', minWidth: 56 }}>
      <Typography variant="caption" sx={{ display: 'block', color, fontWeight: 800, lineHeight: 1.1 }}>
        {(value || 0).toLocaleString('pt-BR')}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontSize: 10, whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Box>
  );
}

const SEND_STATUS = {
  PENDING: { pill: 'pending', label: 'Na fila' },
  DONE: { pill: 'active', label: 'Enviado' },
  FAILED: { pill: 'error', label: 'Falhou' },
  BLOCKED: { pill: 'banned', label: 'Bloqueado' },
  PACED: { pill: 'flood', label: 'Aguardando limite do dia' }
};

// gaveta "Ver envios" de uma run
function SendsDrawer({ broadcast, run, onClose }) {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const open = Boolean(run);

  useEffect(() => {
    setPage(1);
  }, [status, run]);

  useEffect(() => {
    if (!open || !broadcast || !run) return;
    setLoading(true);
    get(`/whatsapp/broadcasts/${broadcast.id}/runs/${run.id}/sends`, {
      params: { page, page_size: 25, ...(status !== 'all' ? { status } : {}) }
    })
      .then((d) => setData({ items: asList(d), total: d?.total ?? 0, page: d?.page ?? page, pages: d?.pages ?? 1 }))
      .catch((e) => {
        toast.error(errMsg(e, 'Falha ao carregar os envios.'));
        setData({ items: [], total: 0, page: 1, pages: 1 });
      })
      .finally(() => setLoading(false));
  }, [open, broadcast, run, status, page]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 440 }, bgcolor: 'background.default' } } }}
    >
      <Box
        sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', position: 'sticky', top: 0, zIndex: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconListDetails size={20} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800 }} noWrap>
              Envios do disparo
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {run ? fmtDateBRT(run.run_at) : ''} · {data.total} {data.total === 1 ? 'destino' : 'destinos'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <IconX size={18} />
          </IconButton>
        </Stack>
        <FormControl size="small" fullWidth sx={{ mt: 1.5 }}>
          <InputLabel id="wa-sends-status-label">Status</InputLabel>
          <Select labelId="wa-sends-status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="DONE">Enviados</MenuItem>
            <MenuItem value="PACED">Aguardando limite do dia</MenuItem>
            <MenuItem value="PENDING">Na fila</MenuItem>
            <MenuItem value="BLOCKED">Bloqueados</MenuItem>
            <MenuItem value="FAILED">Falhas</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ p: 2 }}>
        {loading ? (
          <TgListSkeleton rows={5} />
        ) : data.items.length === 0 ? (
          <TgEmptyState dense icon={IconListDetails} title="Nenhum envio" description="Nenhum destino com esse filtro." />
        ) : (
          <Stack spacing={0.75}>
            {data.items.map((s, i) => {
              const st = SEND_STATUS[s.status] || SEND_STATUS.PENDING;
              return (
                <Box
                  key={`${s.chat_id}-${i}`}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25, bgcolor: 'background.paper' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {s.name || s.chat_id}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                        {s.name ? s.chat_id : ''}
                        {s.sent_at ? `${s.name ? ' · ' : ''}${fmtDateBRT(s.sent_at)}` : ''}
                        {s.attempts > 1 ? ` · ${s.attempts} tentativas` : ''}
                      </Typography>
                    </Box>
                    <TgStatusPill status={st.pill} label={st.label} />
                  </Stack>
                  {s.last_error ? (
                    <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }} noWrap>
                      {s.last_error}
                    </Typography>
                  ) : null}
                </Box>
              );
            })}
            {data.pages > 1 ? (
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ pt: 1 }}>
                <IconButton size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  <IconChevronLeft size={18} />
                </IconButton>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Página {data.page} de {data.pages}
                </Typography>
                <IconButton size="small" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages}>
                  <IconChevronRight size={18} />
                </IconButton>
              </Stack>
            ) : null}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}

function RunsModal({ broadcast, open, onClose }) {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(1);
  const [sendsFor, setSendsFor] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [status, period, open]);

  const load = useCallback(() => {
    if (!open || !broadcast) return;
    setLoading(true);
    const params = { page, page_size: 8, status };
    if (period !== 'all') {
      const d = new Date();
      if (period === 'today') d.setHours(0, 0, 0, 0);
      else if (period === '7d') d.setDate(d.getDate() - 7);
      else if (period === '30d') d.setDate(d.getDate() - 30);
      params.from = d.toISOString();
    }
    get(`/whatsapp/broadcasts/${broadcast.id}/runs`, { params })
      .then((d) => setData({ items: asList(d), total: d?.total ?? 0, page: d?.page ?? page, pages: d?.pages ?? 1 }))
      .catch(() => setData({ items: [], total: 0, page: 1, pages: 1 }))
      .finally(() => setLoading(false));
  }, [open, broadcast, status, period, page]);

  useEffect(() => {
    load();
  }, [load]);

  // enquanto há run em andamento, atualiza sozinho
  const running = data.items.some((r) => r.status === 'running');
  useEffect(() => {
    if (!open || !running) return undefined;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [open, running, load]);

  return (
    <TgModal
      open={open}
      onClose={onClose}
      maxWidth="md"
      title={`Histórico — ${broadcast?.name || ''}`}
      subtitle={`${data.total} disparo${data.total === 1 ? '' : 's'} registrado${data.total === 1 ? '' : 's'}.`}
      footer={
        <TgGhostButton onClick={onClose} sx={{ textTransform: 'none' }}>
          Fechar
        </TgGhostButton>
      }
    >
      <Stack direction="row" spacing={1.25} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap alignItems="center">
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="wa-runs-status-label">Status</InputLabel>
          <Select labelId="wa-runs-status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="all">Todos os status</MenuItem>
            <MenuItem value="clean">Sucesso</MenuItem>
            <MenuItem value="errors">Com falhas</MenuItem>
            <MenuItem value="sending">Enviando</MenuItem>
            <MenuItem value="done">Concluídos</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="wa-runs-period-label">Período</InputLabel>
          <Select labelId="wa-runs-period-label" label="Período" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <MenuItem value="all">Todo o período</MenuItem>
            <MenuItem value="today">Hoje</MenuItem>
            <MenuItem value="7d">Últimos 7 dias</MenuItem>
            <MenuItem value="30d">Últimos 30 dias</MenuItem>
          </Select>
        </FormControl>
        <Tooltip title="Atualizar">
          <IconButton size="small" onClick={load}>
            <IconRefresh size={17} />
          </IconButton>
        </Tooltip>
      </Stack>

      {loading && data.items.length === 0 ? (
        <TgListSkeleton rows={4} />
      ) : data.items.length === 0 ? (
        <TgEmptyState dense icon={IconHistory} title="Nenhum disparo" description="Nenhum disparo com esses filtros." />
      ) : (
        <Stack spacing={1}>
          {data.items.map((r) => {
            const oc = runOutcome(r);
            const OcIcon = oc.Icon;
            const rate = (r.total || 0) > 0 ? Math.round(((r.sent || 0) / r.total) * 100) : 0;
            return (
              <Box key={r.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, bgcolor: 'background.paper' }}>
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <Box
                    sx={{
                      color: oc.color,
                      display: 'inline-flex',
                      ...(oc.key === 'sending'
                        ? { animation: 'waspin 0.9s linear infinite', '@keyframes waspin': { to: { transform: 'rotate(360deg)' } } }
                        : {})
                    }}
                  >
                    <OcIcon size={22} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {fmtDateBRT(r.run_at)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: oc.color, fontWeight: 600 }}>
                      {oc.label}
                      {r.finished_at ? ` · terminou ${fmtDateBRT(r.finished_at, { dateStyle: undefined, timeStyle: 'short' })}` : ''}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexShrink={0} sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    <StatPill label="Total" value={r.total} />
                    <StatPill label="Enviados" value={r.sent} color="success.main" />
                    {(r.paced || 0) > 0 ? <StatPill label="Aguard. limite" value={r.paced} color="info.main" /> : null}
                    {(r.blocked || 0) > 0 ? <StatPill label="Bloqueados" value={r.blocked} color="warning.main" /> : null}
                    {(r.failed || 0) > 0 ? <StatPill label="Falhas" value={r.failed} color="error.main" /> : null}
                  </Stack>
                  <Tooltip title="Ver envios">
                    <IconButton size="small" onClick={() => setSendsFor(r)}>
                      <IconListDetails size={18} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <RunBar r={r} />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {rate}% entregues
                  </Typography>
                  {(r.paced || 0) > 0 ? (
                    <Typography variant="caption" sx={{ color: 'info.main', fontWeight: 600 }}>
                      · {r.paced} aguardando limite do dia
                    </Typography>
                  ) : null}
                  {(r.blocked || 0) > 0 ? (
                    <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
                      · {r.blocked} bloqueados
                    </Typography>
                  ) : null}
                  {(r.failed || 0) > 0 ? (
                    <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                      · {r.failed} falhas
                    </Typography>
                  ) : null}
                </Stack>
              </Box>
            );
          })}

          {data.pages > 1 ? (
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ pt: 1 }}>
              <IconButton size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <IconChevronLeft size={18} />
              </IconButton>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Página {data.page} de {data.pages}
              </Typography>
              <IconButton size="small" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page >= data.pages}>
                <IconChevronRight size={18} />
              </IconButton>
            </Stack>
          ) : null}
        </Stack>
      )}

      <SendsDrawer broadcast={broadcast} run={sendsFor} onClose={() => setSendsFor(null)} />
    </TgModal>
  );
}

// ---------------------------------------------------------------- ações da linha
function RowActions({ b, compact, connected, onFire, onCopies, onEdit, onRuns, onDelete, onToggle }) {
  const [anchor, setAnchor] = useState(null);
  const noCopies = (b.copies_count || 0) === 0;
  const fireTip = !connected ? 'Conecte o WhatsApp para disparar' : noCopies ? 'Cadastre uma copy antes de disparar' : 'Disparar agora';
  const secondary = [
    { key: 'edit', label: 'Editar', icon: <IconPencil size={17} />, run: () => onEdit(b) },
    { key: 'runs', label: 'Histórico', icon: <IconHistory size={17} />, run: () => onRuns(b) },
    { key: 'del', label: 'Excluir', icon: <IconTrash size={17} />, run: () => onDelete(b), danger: true }
  ];
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
      <Tooltip title={b.active ? 'Ativo — clique p/ pausar' : 'Inativo — clique p/ ativar'}>
        <Switch
          size="small"
          checked={b.active}
          onChange={() => onToggle(b)}
          sx={{ '& .Mui-checked': { color: WA_GREEN }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${WA_GREEN} !important` } }}
        />
      </Tooltip>
      <Tooltip title={fireTip}>
        <span>
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<IconPlayerPlay size={15} />}
            onClick={() => onFire(b)}
            disabled={noCopies || !connected}
            sx={waButtonSx}
          >
            Disparar
          </Button>
        </span>
      </Tooltip>
      <Tooltip title="Copies">
        <IconButton size="small" onClick={() => onCopies(b)}>
          <IconMessage2 size={17} />
        </IconButton>
      </Tooltip>
      {compact ? (
        <>
          <Tooltip title="Mais ações">
            <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
              <IconDotsVertical size={17} />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchor}
            open={!!anchor}
            onClose={() => setAnchor(null)}
            slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 160 } } }}
          >
            {secondary.map((a) => (
              <MenuItem
                key={a.key}
                onClick={() => {
                  setAnchor(null);
                  a.run();
                }}
                sx={{ gap: 1, fontSize: 14, ...(a.danger ? { color: 'error.main' } : {}) }}
              >
                {a.icon}
                {a.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      ) : (
        secondary.map((a) => (
          <Tooltip key={a.key} title={a.label}>
            <IconButton size="small" color={a.danger ? 'error' : 'default'} onClick={a.run}>
              {a.icon}
            </IconButton>
          </Tooltip>
        ))
      )}
    </Stack>
  );
}

// =================== PÁGINA ===================
export default function WhatsAppBroadcasts() {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const { session, loading: sessionLoading, connected } = useWaSession();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [editing, setEditing] = useState(null);
  const [copiesFor, setCopiesFor] = useState(null);
  const [runsFor, setRunsFor] = useState(null);
  const [firingFor, setFiringFor] = useState(null);
  const [firing, setFiring] = useState(false);
  const [deletingFor, setDeletingFor] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // filtros
  const [fName, setFName] = useState('');
  const [fTime, setFTime] = useState('all');
  const [fActive, setFActive] = useState('all');
  const [filterAnchor, setFilterAnchor] = useState(null);

  const reqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++reqRef.current;
    setLoading(true);
    try {
      const [bc, g, c, t] = await Promise.all([
        get('/whatsapp/broadcasts'),
        get('/whatsapp/groups').catch(() => []),
        get('/whatsapp/contacts', { params: { saved: 1, page_size: 500 } }).catch(() => []),
        get('/whatsapp/contacts/tags').catch(() => [])
      ]);
      if (seq !== reqRef.current) return;
      setList(asList(bc));
      setGroups(asList(g));
      setContacts(asList(c));
      setTags(
        asList(t)
          .map((x) => (typeof x === 'string' ? x : x?.tag || x?.name))
          .filter(Boolean)
      );
    } catch (e) {
      if (seq !== reqRef.current) return;
      toast.error(errMsg(e, 'Falha ao carregar broadcasts.'));
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // status por horário muda ao longo do dia → atualização leve
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden' && !editing && !copiesFor) load();
    }, 60000);
    return () => clearInterval(id);
  }, [load, editing, copiesFor]);

  const toggleActive = async (b) => {
    try {
      await put(`/whatsapp/broadcasts/${b.id}`, { active: !b.active, ...(b.risk_ack_at ? { risk_ack: true } : {}) });
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao atualizar.'));
    }
  };
  const doDelete = async () => {
    const b = deletingFor;
    setDeleting(true);
    try {
      await remove(`/whatsapp/broadcasts/${b.id}`);
      toast.success('Broadcast excluído.');
      setDeletingFor(null);
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao excluir.'));
    } finally {
      setDeleting(false);
    }
  };
  const doFire = async () => {
    const b = firingFor;
    setFiring(true);
    try {
      await post(`/whatsapp/broadcasts/${b.id}/fire`, {});
      toast.success('Disparo iniciado! Acompanhe no histórico.');
      setFiringFor(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao disparar.'));
    } finally {
      setFiring(false);
    }
  };

  const warmup = useMemo(() => warmupFrom(list, session), [list, session]);
  const allTimes = useMemo(() => [...new Set(list.flatMap((b) => b.times || []))].sort((a, b) => a - b), [list]);
  const filtered = useMemo(
    () =>
      list.filter((b) => {
        if (fName && !(b.name || '').toLowerCase().includes(fName.toLowerCase())) return false;
        if (fTime !== 'all' && !(b.times || []).includes(Number(fTime))) return false;
        if (fActive !== 'all' && Boolean(b.active) !== (fActive === 'active')) return false;
        return true;
      }),
    [list, fName, fTime, fActive]
  );
  const activeFilterCount = (fTime !== 'all' ? 1 : 0) + (fActive !== 'all' ? 1 : 0);
  const filtersActive = !!fName || activeFilterCount > 0;
  const clearFilters = () => {
    setFName('');
    setFTime('all');
    setFActive('all');
  };

  const filterControls = (stacked) => (
    <>
      <FormControl size="small" sx={stacked ? { width: '100%' } : { flex: '1 1 150px', minWidth: 140 }}>
        <InputLabel id="wa-bc-time-filter-label">Horário</InputLabel>
        <Select labelId="wa-bc-time-filter-label" label="Horário" value={fTime} onChange={(e) => setFTime(e.target.value)}>
          <MenuItem value="all">Todos horários</MenuItem>
          {allTimes.map((t) => (
            <MenuItem key={t} value={t}>
              {minToHHMM(t)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={stacked ? { width: '100%' } : { flex: '1 1 150px', minWidth: 140 }}>
        <InputLabel id="wa-bc-active-filter-label">Situação</InputLabel>
        <Select labelId="wa-bc-active-filter-label" label="Situação" value={fActive} onChange={(e) => setFActive(e.target.value)}>
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="active">Ativos</MenuItem>
          <MenuItem value="inactive">Inativos</MenuItem>
        </Select>
      </FormControl>
    </>
  );

  const newBtn = (
    <Button variant="contained" disableElevation startIcon={<IconPlus size={18} />} onClick={() => setEditing({})} sx={waButtonSx}>
      Novo broadcast
    </Button>
  );

  const fireAud = firingFor ? audienceOf(firingFor) : null;

  return (
    <Box>
      <WaPageHeader
        icon={IconSpeakerphone}
        title="Broadcasts"
        subtitle="Disparos em massa para contatos e grupos — com rotação de copies, agendamento e ritmo seguro."
        action={newBtn}
      />

      <WaSessionBanner session={session} loading={sessionLoading} connected={connected} what="disparar broadcasts" />
      <WarmupStrip warmup={warmup} />

      {loading && list.length === 0 ? (
        <TgListSkeleton rows={4} />
      ) : list.length === 0 ? (
        <TgEmptyState
          icon={IconSpeakerphone}
          title="Nenhum broadcast"
          description="Crie um broadcast, cadastre as copies e escolha os horários."
          action={newBtn}
        />
      ) : (
        <>
          <TgFilterBar>
            <TextField
              size="small"
              placeholder="Buscar por nome…"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              InputProps={{ startAdornment: <IconSearch size={16} style={{ marginRight: 6, opacity: 0.6 }} /> }}
              sx={{ flex: '1 1 220px', minWidth: 180 }}
            />
            {compact ? (
              <>
                <TgGhostButton startIcon={<IconFilter size={16} />} onClick={(e) => setFilterAnchor(e.currentTarget)}>
                  Filtros{activeFilterCount ? ` · ${activeFilterCount}` : ''}
                </TgGhostButton>
                {filtersActive ? (
                  <TgGhostButton startIcon={<IconFilterOff size={16} />} onClick={clearFilters}>
                    Limpar
                  </TgGhostButton>
                ) : null}
                <Popover
                  open={!!filterAnchor}
                  anchorEl={filterAnchor}
                  onClose={() => setFilterAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  slotProps={{ paper: { sx: { borderRadius: 3, mt: 1, width: 300 } } }}
                >
                  <Stack spacing={1.5} sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Filtros
                    </Typography>
                    {filterControls(true)}
                    {filtersActive ? (
                      <Button
                        color="inherit"
                        startIcon={<IconFilterOff size={16} />}
                        onClick={clearFilters}
                        sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
                      >
                        Limpar filtros
                      </Button>
                    ) : null}
                  </Stack>
                </Popover>
              </>
            ) : (
              <>
                {filterControls(false)}
                {filtersActive ? (
                  <Button
                    color="inherit"
                    startIcon={<IconFilterOff size={16} />}
                    onClick={clearFilters}
                    sx={{ textTransform: 'none', flexShrink: 0 }}
                  >
                    Limpar
                  </Button>
                ) : null}
              </>
            )}
          </TgFilterBar>

          {filtered.length === 0 ? (
            <TgEmptyState
              dense
              icon={IconSpeakerphone}
              title="Nenhum resultado"
              description="Nenhum broadcast com esses filtros."
              action={
                filtersActive ? (
                  <TgGhostButton startIcon={<IconFilterOff size={16} />} onClick={clearFilters}>
                    Limpar filtros
                  </TgGhostButton>
                ) : null
              }
            />
          ) : (
            <Stack spacing={1.25}>
              {filtered.map((b) => {
                const aud = audienceOf(b);
                const noCopies = (b.copies_count || 0) === 0;
                const noTimes = (b.times || []).length === 0;
                const mode = b.targets?.contacts || 'saved';
                return (
                  <TgCard
                    key={b.id}
                    accent={b.active ? WA_GREEN : 'divider'}
                    sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, gap: 2, p: 2 }}
                  >
                    <WaBadge icon={IconSpeakerphone} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 15.5 }} noWrap>
                          {b.name}
                        </Typography>
                        <TgStatusPill status={b.active ? 'active' : 'inactive'} />
                      </Stack>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary', mb: 0.75 }}>
                        <IconUsers size={14} />
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          Audiência ≈ {aud.total.toLocaleString('pt-BR')}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }} noWrap>
                          ({[...aud.parts, CONTACT_MODE_LABEL[mode]].filter(Boolean).join(' · ')}
                          {(b.targets?.tags || []).length ? ` · tags: ${b.targets.tags.join(', ')}` : ''})
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} rowGap={1.25} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mt: 0.75 }}>
                        <Chip
                          size="small"
                          label={b.mode === 'random' ? 'aleatório' : 'sequência'}
                          variant="outlined"
                          sx={{ borderRadius: 1, height: 22 }}
                        />
                        <Chip
                          size="small"
                          label={`${b.copies_count || 0} copies`}
                          color={noCopies ? 'warning' : 'default'}
                          variant="outlined"
                          sx={{ borderRadius: 1, height: 22 }}
                        />
                        <Tooltip title="Intervalo entre envios">
                          <Chip
                            size="small"
                            icon={<IconHourglassHigh size={12} />}
                            label={`${Math.round((b.interval_ms || 0) / 1000)} s`}
                            variant="outlined"
                            sx={{ borderRadius: 1, height: 22 }}
                          />
                        </Tooltip>
                        {noTimes ? (
                          <Chip
                            size="small"
                            icon={<IconClock size={12} />}
                            label="Sem horários"
                            color="warning"
                            variant="outlined"
                            sx={{ borderRadius: 1, height: 22, fontSize: 11 }}
                          />
                        ) : (
                          (b.times || []).map((t) => (
                            <TimeChip key={t} minute={t} status={b.time_status?.[t] ?? b.time_status?.[String(t)]} />
                          ))
                        )}
                      </Stack>
                      {noCopies ? (
                        <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.75 }}>
                          ⚠ Cadastre ao menos uma copy para disparar.
                        </Typography>
                      ) : null}
                    </Box>
                    <RowActions
                      b={b}
                      compact={compact}
                      connected={connected}
                      onFire={setFiringFor}
                      onCopies={setCopiesFor}
                      onEdit={setEditing}
                      onRuns={setRunsFor}
                      onDelete={setDeletingFor}
                      onToggle={toggleActive}
                    />
                  </TgCard>
                );
              })}
            </Stack>
          )}
        </>
      )}

      <BroadcastModal
        initial={editing && editing.id ? editing : null}
        open={!!editing}
        onClose={(ok) => {
          setEditing(null);
          if (ok) load();
        }}
        groups={groups}
        contacts={contacts}
        tags={tags}
      />
      <CopiesModal
        broadcast={copiesFor}
        open={!!copiesFor}
        onClose={(ok) => {
          setCopiesFor(null);
          if (ok) load();
        }}
      />
      <RunsModal broadcast={runsFor} open={!!runsFor} onClose={() => setRunsFor(null)} />

      <TgConfirmDialog
        open={!!firingFor}
        onClose={() => setFiringFor(null)}
        onConfirm={doFire}
        loading={firing}
        icon={IconPlayerPlay}
        title="Disparar agora?"
        confirmLabel="Disparar agora"
        message={
          firingFor ? (
            <>
              “{firingFor.name}” será disparado agora para ≈ <b>{fireAud.total.toLocaleString('pt-BR')}</b>{' '}
              {fireAud.total === 1 ? 'destino' : 'destinos'}
              {fireAud.parts.length ? ` (${fireAud.parts.join(' · ')})` : ''}. A copy é escolhida em{' '}
              {firingFor.mode === 'random' ? 'ordem aleatória' : 'sequência'}
              {warmup?.daily_limit
                ? `; o que passar do limite de hoje (${warmup.daily_limit.toLocaleString('pt-BR')}) fica aguardando o próximo dia`
                : ''}
              .
              <Box component="span" sx={{ display: 'block', mt: 1.25, color: 'warning.main', fontWeight: 600 }}>
                {RISK_TEXT}
              </Box>
            </>
          ) : (
            ''
          )
        }
      />
      <TgConfirmDialog
        open={!!deletingFor}
        onClose={() => setDeletingFor(null)}
        onConfirm={doDelete}
        loading={deleting}
        danger
        icon={IconTrash}
        title="Excluir broadcast?"
        confirmLabel="Excluir"
        message={
          deletingFor ? `As copies e todo o histórico de "${deletingFor.name}" serão removidos. Esta ação não pode ser desfeita.` : ''
        }
      />
    </Box>
  );
}
