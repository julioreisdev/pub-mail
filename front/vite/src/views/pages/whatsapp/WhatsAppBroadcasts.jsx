import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Pagination,
  Skeleton,
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
  IconPlayerPause,
  IconMessageReply,
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
  IconRefresh,
  IconBolt,
  IconGauge,
  IconShield,
  IconShieldCheck,
  IconAdjustments,
  IconArrowsSplit,
  IconCircleCheck,
  IconUsersGroup,
  IconAddressBook,
  IconTargetArrow,
  IconWorld,
  IconArrowsExchange,
  IconListCheck,
  IconMessageCircleCheck,
  IconMessageCircleOff,
  IconCalendarStats,
  IconRepeatOff,
  IconFilterMinus
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { get, post, put, remove } from 'api/api';
import { TgEmptyState, TgCard, TgStatusPill, TgFilterBar, TgConfirmDialog, TgGhostButton, TgListSkeleton } from 'views/pages/telegram/ui';
import { CrmModal } from './crm/crmKit';
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
  WA_DARK,
  WaNumberChip,
  WaNumberDot,
  WaNumberMultiSelect,
  WaNumberSelect,
  sessionLabel,
  fmtPhoneBR
} from './waKit';
import { TgAvatar } from 'views/pages/telegram/ui';

// ============================================================================
// WhatsApp → Broadcasts: disparos em massa para contatos e grupos com rotação
// de copies, horários diários (BRT), fila com ritmo e aquecimento por número.
//
// Multi-número: cada campanha escolhe 1..N números (`session_ids`) e, com 2+,
// a `distribution`: 'shared' = "Usar em conjunto" (audiência somada e dividida
// igualmente entre os números conectados) | 'own' = "Cada número dispara para
// seus contatos" (o contato sai pelo número de cuja agenda/conversa veio). Grupos saem
// pelo número da conversa do grupo. O ritmo (`pacing`) vem de presets do back
// (GET /whatsapp/broadcasts/presets) ou é personalizado.
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
const isReady = (s) => Boolean(s && (s.connected || s.status === 'ready'));

// resumo de audiência (linha + confirmação de disparo)
const audienceOf = (b) => {
  const contacts = b?.audience?.contacts || 0;
  const groups = b?.audience?.groups || 0;
  const total = b?.audience?.total ?? contacts + groups;
  const parts = [];
  if (contacts) parts.push(plural(contacts, 'contato', 'contatos'));
  if (groups) parts.push(plural(groups, 'grupo', 'grupos'));
  const by_session = Array.isArray(b?.audience?.by_session) ? b.audience.by_session : [];
  const warnings = Array.isArray(b?.audience?.warnings) ? b.audience.warnings : [];
  return { contacts, groups, total, parts, by_session, warnings };
};
const CONTACT_MODE_LABEL = { saved: 'contatos salvos', all: 'todos os contatos', none: 'sem contatos' };
// resumo curto da origem e dos filtros da audiência (linha da lista)
const audienceRulesOf = (b) => {
  const t = b?.targets || {};
  const out = [];
  if (t.contacts && t.contacts !== 'none') {
    if (t.source === 'sending') out.push('só dos números que enviam');
    else if (t.source === 'others') out.push('só de outros números');
    else if (t.source === 'custom') out.push(`de ${plural((t.source_session_ids || []).length, 'número escolhido', 'números escolhidos')}`);
    if (t.engagement === 'replied') out.push('já responderam');
    if (t.engagement === 'never') out.push('nunca responderam');
    if ((t.exclude_tags || []).length) out.push(`sem tags: ${t.exclude_tags.join(', ')}`);
    if (t.cooldown_hours) out.push(`sem repetir em ${t.cooldown_hours} h`);
  }
  if (b?.exclude_inactive_days) out.push(`responderam em ${b.exclude_inactive_days} d`);
  if ((t.groups || []).length && t.groups_mode === 'members') out.push('grupos: no privado dos membros');
  if ((t.groups || []).length && t.groups_mode === 'both') out.push('grupos: no grupo e no privado dos membros');
  return out;
};

// ---- ritmo de envio (presets anti-bloqueio) ----
const RISK_UI = {
  high: { token: 'error', label: 'Risco alto' },
  medium: { token: 'warning', label: 'Risco médio' },
  low: { token: 'success', label: 'Risco baixo' },
  minimal: { token: 'success', label: 'Risco mínimo' }
};
const PRESET_ICON = { fast: IconBolt, normal: IconGauge, safe: IconShield, very_safe: IconShieldCheck, custom: IconAdjustments };
// usado só se GET /whatsapp/broadcasts/presets falhar (mesmos valores do back)
const FALLBACK_PRESETS = {
  default: 'normal',
  items: [
    {
      key: 'fast',
      label: 'Rápido',
      risk: 'high',
      description: '3 s entre envios (±30 %), sem pausas e sem limite diário.',
      warning: 'Risco ALTO de restrição ou banimento do número. Use só em números aquecidos e audiências que já conversaram com você.',
      interval_ms: 3000,
      jitter_pct: 30,
      daily_limit: null,
      pause_every: 0,
      pause_minutes: 0,
      window: null
    },
    {
      key: 'normal',
      label: 'Normal',
      risk: 'medium',
      description: '8 s entre envios (±30 %), pausa de 10 min a cada 50 envios.',
      interval_ms: 8000,
      jitter_pct: 30,
      daily_limit: null,
      pause_every: 50,
      pause_minutes: 10,
      window: null
    },
    {
      key: 'safe',
      label: 'Seguro',
      risk: 'low',
      description: '20 s entre envios (±40 %), pausa de 15 min a cada 30, até 300 envios por dia por número.',
      interval_ms: 20000,
      jitter_pct: 40,
      daily_limit: 300,
      pause_every: 30,
      pause_minutes: 15,
      window: null
    },
    {
      key: 'very_safe',
      label: 'Muito seguro',
      risk: 'minimal',
      description: '45 s entre envios (±50 %), pausa de 20 min a cada 20, até 150 por dia por número, só das 08:00 às 20:00.',
      interval_ms: 45000,
      jitter_pct: 50,
      daily_limit: 150,
      pause_every: 20,
      pause_minutes: 20,
      window: { start: '08:00', end: '20:00' }
    },
    {
      key: 'custom',
      label: 'Personalizado',
      risk: 'medium',
      description: 'Você define intervalo, variação, limite diário, pausas e janela de horário.',
      interval_ms: 8000,
      jitter_pct: 30,
      daily_limit: null,
      pause_every: 0,
      pause_minutes: 0,
      window: null
    }
  ],
  limits: {
    interval_ms: { min: 1000, max: 120000 },
    jitter_pct: { min: 0, max: 80 },
    daily_limit: { min: 1, max: 5000 },
    pause_every: { min: 0, max: 1000 },
    pause_minutes: { min: 0, max: 240 }
  }
};
const presetOf = (presets, key) => (presets?.items || []).find((p) => p.key === key) || null;
const pacingLabel = (presets, pacing) =>
  presetOf(presets, pacing?.preset)?.label || presetOf(FALLBACK_PRESETS, pacing?.preset)?.label || 'Normal';
const pacingRisk = (presets, pacing) =>
  pacing?.preset === 'custom' || !pacing?.preset
    ? riskOfInterval(pacing?.interval_ms)
    : presetOf(presets, pacing?.preset)?.risk || presetOf(FALLBACK_PRESETS, pacing?.preset)?.risk || 'medium';
// frases curtas que descrevem um `pacing` normalizado
const pacingParts = (p) => {
  const out = [];
  if (!p) return out;
  out.push(`${fmtSec(p.interval_ms)} s entre envios${p.jitter_pct ? ` (±${p.jitter_pct} %)` : ''}`);
  if (p.pause_every && p.pause_minutes) out.push(`pausa de ${p.pause_minutes} min a cada ${p.pause_every} envios`);
  else out.push('sem pausas');
  out.push(p.daily_limit ? `até ${Number(p.daily_limit).toLocaleString('pt-BR')} envios/dia por número` : 'sem limite diário próprio');
  if (p.window?.start && p.window?.end) out.push(`só das ${p.window.start} às ${p.window.end}`);
  return out;
};

// ---- pílula de horário com status de HOJE ----
const TIME_STATUS = {
  sent: { color: 'success.main', tip: (t) => `Disparado hoje às ${t} — tudo certo` },
  sent_with_errors: { color: 'warning.main', tip: (t) => `Disparado hoje às ${t}, com algumas falhas` },
  failed: { color: 'error.main', tip: (t) => `Executou hoje (${t}) e falhou` },
  sending: { color: 'info.main', tip: () => 'Enviando agora…' },
  paused: { color: 'error.main', tip: () => 'Pausado (bloqueios ou pausa manual) — veja o aviso na campanha' },
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
// Opção: { value, label, name?, secondary?, photoPath?, kind?: 'contact'|'group' }. Com `name`
// a lista e os chips mostram a foto (ou inicial) e, em grupo, a etiqueta "Grupo".
const GroupTag = ({ sx }) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.35,
      px: 0.7,
      height: 18,
      borderRadius: 1,
      fontSize: 10.5,
      fontWeight: 800,
      letterSpacing: 0.2,
      textTransform: 'uppercase',
      color: '#7c3aed',
      bgcolor: 'rgba(124,58,237,0.12)',
      border: '1px solid rgba(124,58,237,0.35)',
      flexShrink: 0,
      ...sx
    }}
  >
    <IconUsersGroup size={11} /> Grupo
  </Box>
);
function MultiSelect({ label, options, value, onChange, placeholder, limitTags = 3 }) {
  const selected = options.filter((o) => (value || []).includes(o.value));
  const rich = options.some((o) => o && o.name !== undefined);
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
      {...(rich
        ? {
            renderOption: (props, o) => {
              const { key, ...rest } = props;
              const isGroup = o.kind === 'group';
              return (
                <li key={key} {...rest} style={{ ...(rest.style || {}), alignItems: 'center', gap: 10, paddingTop: 6, paddingBottom: 6 }}>
                  <TgAvatar name={o.name} photoPath={o.photoPath} size={34} kind={isGroup ? 'group' : 'contact'} icon={isGroup ? IconUsersGroup : undefined} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600, minWidth: 0 }}>
                        {o.name}
                      </Typography>
                      {isGroup ? <GroupTag /> : null}
                    </Stack>
                    {o.secondary ? (
                      <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
                        {o.secondary}
                      </Typography>
                    ) : null}
                  </Box>
                </li>
              );
            },
            renderTags: (vals, getTagProps) =>
              vals.map((o, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                const isGroup = o.kind === 'group';
                return (
                  <Chip
                    key={key}
                    {...tagProps}
                    size="small"
                    avatar={
                      <Box sx={{ display: 'inline-flex', ml: '2px !important' }}>
                        <TgAvatar name={o.name} photoPath={o.photoPath} size={22} kind={isGroup ? 'group' : 'contact'} icon={isGroup ? IconUsersGroup : undefined} />
                      </Box>
                    }
                    label={
                      <Stack direction="row" spacing={0.6} alignItems="center">
                        <span>{o.name}</span>
                        {isGroup ? <GroupTag sx={{ height: 16, fontSize: 9.5, px: 0.5 }} /> : null}
                      </Stack>
                    }
                    sx={{ borderRadius: 1.5, '& .MuiChip-avatar': { width: 22, height: 22 } }}
                  />
                );
              })
          }
        : {})}
    />
  );
}

// ---------------------------------------------------------------- aquecimento (por número)
// `warmup` de cada campanha = [pacing.summary por número] (sent_today/remaining ao vivo);
// sem campanha ainda, cai no `warmup_day`/`pacing_enabled` da própria sessão.
function warmupOfSession(list, s) {
  const w = list.flatMap((b) => (Array.isArray(b?.warmup) ? b.warmup : [])).find((x) => x?.session_id === s.id);
  if (w) return { ...w, source: 'broadcast' };
  const day = s.warmup_day || null;
  const warmed = (day || 0) >= 8;
  const idx = day && !warmed ? Math.min(day, 7) - 1 : null;
  return {
    session_id: s.id,
    day,
    warmed,
    daily_limit: warmed ? 1000 : idx != null ? WARMUP[idx] : null,
    cold_limit: warmed ? 100 : idx != null ? COLD[idx] : null,
    sent_today: null,
    remaining: null,
    pacing_enabled: s.pacing_enabled ?? true,
    source: 'session'
  };
}
const warmupItemsOf = (list, sessions) => sessions.map((s) => ({ session: s, warmup: warmupOfSession(list, s) }));
// quantos contatos este número ainda consegue enviar hoje (aquecimento ∧ limite da campanha)
const dailyCapOf = (warmup, pacing) => {
  const caps = [];
  if (warmup && warmup.pacing_enabled !== false && warmup.daily_limit) caps.push(warmup.daily_limit);
  if (pacing?.daily_limit) caps.push(pacing.daily_limit);
  return caps.length ? Math.min(...caps) : null;
};
const remainingOf = (warmup, pacing) => {
  const cap = dailyCapOf(warmup, pacing);
  if (cap == null) return null;
  return Math.max(0, cap - (warmup?.sent_today || 0));
};

function WarmupRow({ session, warmup, many }) {
  const hot = Boolean(warmup?.warmed) || (warmup?.day || 0) >= 8;
  const limit = warmup?.daily_limit;
  const sent = warmup?.sent_today;
  const pct = limit && sent != null ? Math.min(100, Math.round((sent / limit) * 100)) : null;
  const paced = warmup?.pacing_enabled !== false;
  const ready = isReady(session);
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={{ xs: 1, md: 2 }}
      alignItems={{ md: 'center' }}
      sx={{ opacity: ready ? 1 : 0.7 }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexShrink: 0, minWidth: { md: 300 }, maxWidth: { md: 360 } }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color: hot ? 'success.main' : 'warning.main',
            bgcolor: (t) => `rgba(${t.vars.palette[hot ? 'success' : 'warning'].mainChannel} / 0.14)`
          }}
        >
          <IconFlame size={20} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
            {many ? <WaNumberChip session={session} /> : null}
            <Typography sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.15, minWidth: 0 }}>
              {!ready
                ? 'Não conectado'
                : hot
                  ? 'Número aquecido'
                  : warmup?.day
                    ? `Aquecimento · dia ${warmup.day} de 7`
                    : 'Aquecimento · dia 1 de 7'}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
            {!ready
              ? 'Conecte o número nas Configurações para ele disparar.'
              : paced
                ? 'Ritmo automático ligado — o que passar do limite fica para o próximo dia.'
                : 'Ritmo automático desligado — responsabilidade assumida nas Configurações.'}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {limit ? (
          <>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
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
                height: 7,
                borderRadius: 4,
                bgcolor: 'action.selected',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  bgcolor: pct >= 100 ? 'error.main' : pct >= 80 ? 'warning.main' : session?.color || WA_GREEN
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
        {warmup?.cold_limit ? (
          <Tooltip title="Contatos que nunca falaram com o número. Acima disso, o envio para frios fica aguardando o próximo dia.">
            <Chip size="small" label={`Frios: até ${warmup.cold_limit}/dia`} variant="outlined" sx={{ fontWeight: 700, borderRadius: 1 }} />
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
  );
}

function WarmupStrip({ items }) {
  if (!items?.length) return null;
  const many = items.length > 1;
  return (
    <TgCard hover={false} sx={{ p: { xs: 1.5, sm: 2 }, mb: 2.5 }}>
      {many ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 1.25 }}>
          Aquecimento por número — cada número tem o próprio limite diário; os broadcasts dividem a audiência entre eles.
        </Typography>
      ) : null}
      <Stack spacing={1.5} divider={<Box sx={{ height: '1px', bgcolor: 'divider' }} />}>
        {items.map((it) => (
          <WarmupRow key={it.session.id} session={it.session} warmup={it.warmup} many={many} />
        ))}
      </Stack>
    </TgCard>
  );
}

// ---------------------------------------------------------------- copies
const VARS = [
  { token: '{{nome}}', label: 'nome', hint: 'Nome completo do contato (agenda ou nome do WhatsApp).' },
  { token: '{{primeiro_nome}}', label: 'primeiro nome', hint: 'Só o primeiro nome: "Ana Paula" → "Ana". Também aceita {{first_name}}.' },
  { token: '{{telefone}}', label: 'telefone', hint: 'Telefone do contato.' }
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
              <Tooltip key={v.token} title={`${v.hint || ''} Personaliza por contato — em grupos fica vazio.`}>
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
            sx={{ width: { xs: '100%', sm: 190 }, mt: 1.25 }}
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
    <CrmModal
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
    </CrmModal>
  );
}

// ---------------------------------------------------------------- modal de broadcast
const DEFAULT_PACING = {
  preset: 'custom',
  interval_ms: 300,
  jitter_pct: 20,
  daily_limit: null,
  pause_every: 0,
  pause_minutes: 0,
  window: null
};
// segundos com até 1 casa (0,3 s) para intervalos curtos
const fmtSec = (ms) => {
  const sec = (Number(ms) || 0) / 1000;
  return sec < 10 ? String(Math.round(sec * 10) / 10).replace('.', ',') : String(Math.round(sec));
};
const EMPTY = {
  name: 'Novo broadcast',
  session_ids: [],
  distribution: 'shared',
  targets: {
    contacts: 'saved',
    contact_ids: [],
    tags: [],
    exclude_tags: [],
    groups: [],
    groups_mode: 'group',
    source: 'all',
    source_session_ids: [],
    include_unlinked: true,
    outsiders: 'skip',
    engagement: 'any',
    cooldown_hours: null
  },
  times: [],
  mode: 'sequential',
  delete_used: false,
  randomize_copies: false,
  exclude_inactive_days: null,
  pacing: DEFAULT_PACING,
  active: true
};
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// como os CONTATOS são repartidos quando a campanha usa 2+ números
const DISTRIBUTIONS = [
  {
    key: 'shared',
    label: 'Usar em conjunto',
    short: 'em conjunto',
    Icon: IconUsersGroup,
    description:
      'Soma os contatos de todos os números e divide igualmente entre eles. Ex.: um número com 1.000 contatos e outro com 100 enviam 550 cada.'
  },
  {
    key: 'own',
    label: 'Cada número dispara para seus contatos',
    short: 'cada número os seus',
    Icon: IconAddressBook,
    description:
      'Cada contato recebe pelo número dele: o da agenda de onde veio ou o da conversa. Quem não é de nenhum dos números escolhidos fica de fora.'
  }
];
const distributionOf = (key) => DISTRIBUTIONS.find((d) => d.key === key) || DISTRIBUTIONS[0];

// cartões de escolha única (rádio) — divisão entre números, origem da audiência, histórico de resposta
function ChoiceCards({ options, value, onChange, ariaLabel, columns = 2, disabled = false }) {
  return (
    <Box
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      sx={{
        display: 'grid',
        gap: 1,
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          sm: `repeat(${Math.min(columns, 2)}, minmax(0, 1fr))`,
          md: `repeat(${columns}, minmax(0, 1fr))`
        },
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto'
      }}
    >
      {options.map((d) => {
        const selected = value === d.key;
        const tone = d.tone || WA_DARK;
        return (
          <Box
            key={d.key}
            role="radio"
            aria-checked={selected}
            tabIndex={disabled ? -1 : 0}
            onClick={() => onChange(d.key)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), onChange(d.key)) : null)}
            sx={{
              p: 1.5,
              borderRadius: 2.5,
              border: '2px solid',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              borderColor: selected ? tone : 'divider',
              bgcolor: selected ? `${WA_GREEN}14` : 'background.paper',
              transition: 'border-color .12s ease, background-color .12s ease',
              '&:hover': { borderColor: selected ? tone : `${WA_GREEN}99` },
              outline: 'none',
              '&:focus-visible': { boxShadow: `0 0 0 3px ${WA_GREEN}55` }
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  color: WA_DARK,
                  bgcolor: `${WA_GREEN}24`
                }}
              >
                <d.Icon size={17} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 13.5, flex: 1, minWidth: 0, lineHeight: 1.25 }}>{d.label}</Typography>
              <Radio
                size="small"
                checked={selected}
                onChange={() => onChange(d.key)}
                tabIndex={-1}
                sx={{ p: 0, color: WA_DARK, '&.Mui-checked': { color: WA_DARK } }}
              />
            </Stack>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35 }}>
              {d.description}
            </Typography>
            {d.extra ? <Box sx={{ mt: 'auto', pt: 1 }}>{d.extra}</Box> : null}
          </Box>
        );
      })}
    </Box>
  );
}

function DistributionPicker({ value, onChange }) {
  return <ChoiceCards options={DISTRIBUTIONS} value={value} onChange={onChange} ariaLabel="Como dividir os contatos entre os números" />;
}

// ---------------------------------------------------------------- origem da audiência
// De quais números vem a audiência — independe de quais números ENVIAM.
const SOURCES = [
  {
    key: 'sending',
    Icon: IconTargetArrow,
    label: (n) => (n > 1 ? 'Só destes números' : 'Só deste número'),
    description: (n) => `Quem está na agenda ou já conversou com ${n > 1 ? 'os números que enviam' : 'o número que envia'}.`
  },
  {
    key: 'all',
    Icon: IconWorld,
    label: (n) => (n > 1 ? 'Destes e dos outros' : 'Deste e dos outros'),
    description: () => 'Os contatos de todos os números da organização.'
  },
  {
    key: 'others',
    Icon: IconArrowsExchange,
    label: () => 'Só dos outros números',
    description: (n) => `Quem é dos outros números e ainda não é ${n > 1 ? 'destes' : 'deste'}. Bom para ampliar o alcance.`
  },
  {
    key: 'custom',
    Icon: IconListCheck,
    label: () => 'Escolher números',
    description: () => 'Você marca de quais números vem a audiência.'
  }
];
const effectiveOutsiders = (t) => (t.source === 'others' ? 'split' : t.outsiders || (t.source === 'custom' ? 'split' : 'skip'));

// chip de número que liga/desliga (origem personalizada), com quantos contatos ele traz
function SourceNumberToggle({ session, selected, count, sending, onClick }) {
  const color = session.color || WA_GREEN;
  return (
    <Box
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), onClick()) : null)}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.9,
        pl: 0.75,
        pr: 1.25,
        py: 0.6,
        borderRadius: 5,
        cursor: 'pointer',
        userSelect: 'none',
        border: '1.5px solid',
        borderColor: selected ? color : 'divider',
        bgcolor: selected ? `${color}1F` : 'background.paper',
        transition: 'all .12s ease',
        '&:hover': { borderColor: color },
        outline: 'none',
        '&:focus-visible': { boxShadow: `0 0 0 3px ${color}40` }
      }}
    >
      <Checkbox size="small" checked={selected} tabIndex={-1} sx={{ p: 0, color: 'text.disabled', '&.Mui-checked': { color } }} />
      <WaNumberDot session={session} size={8} />
      <Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{sessionLabel(session)}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
        {count != null ? count.toLocaleString('pt-BR') : '…'}
      </Typography>
      {sending ? (
        <Box
          component="span"
          sx={{
            fontSize: 10,
            fontWeight: 800,
            px: 0.6,
            py: 0.1,
            borderRadius: 1,
            color: WA_DARK,
            bgcolor: `${WA_GREEN}24`,
            letterSpacing: 0.2
          }}
        >
          ENVIA
        </Box>
      ) : null}
    </Box>
  );
}

function AudienceSourcePicker({ targets, setT, sendingIds, sessions, estimate, disabled }) {
  const n = Math.max(1, sendingIds.length);
  const counts = useMemo(() => new Map((estimate?.source_by_session || []).map((x) => [x.session_id, x.contacts || 0])), [estimate]);
  const source = targets.source || 'all';
  const options = SOURCES.map((o) => ({ key: o.key, Icon: o.Icon, label: o.label(n), description: o.description(n) }));
  const pick = (key) =>
    setT({
      source: key,
      include_unlinked: key === 'all',
      source_session_ids: key === 'custom' ? (targets.source_session_ids?.length ? targets.source_session_ids : sendingIds) : []
    });
  const custom = targets.source_session_ids || [];
  const toggle = (id) => setT({ source_session_ids: custom.includes(id) ? custom.filter((x) => x !== id) : [...custom, id] });
  const unlinked = estimate?.unlinked;
  const othersEmpty = source === 'others' && sessions.every((s) => sendingIds.includes(s.id));

  return (
    <Box>
      <ChoiceCards
        options={options}
        value={source}
        onChange={pick}
        columns={4}
        ariaLabel="De quais números vem a audiência"
        disabled={disabled}
      />
      {disabled ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          Escolha "Contatos salvos" ou "Todos os contatos" acima para definir de quais números vem a audiência.
        </Typography>
      ) : null}
      {!disabled && source === 'custom' ? (
        <Box sx={{ mt: 1.25, p: 1.5, borderRadius: 2.5, border: '1px dashed', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 1 }}>
            Contatos de quais números? O número ao lado é quantos contatos cada um traz (um contato pode ser de mais de um número).
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {sessions.map((s) => (
              <SourceNumberToggle
                key={s.id}
                session={s}
                selected={custom.includes(s.id)}
                count={estimate ? counts.get(s.id) || 0 : null}
                sending={sendingIds.includes(s.id)}
                onClick={() => toggle(s.id)}
              />
            ))}
          </Stack>
          {!custom.length ? (
            <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 1, fontWeight: 600 }}>
              Marque ao menos um número.
            </Typography>
          ) : null}
        </Box>
      ) : null}
      {!disabled && othersEmpty ? (
        <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.75, fontWeight: 600 }}>
          Todos os números da organização estão enviando: não sobram "outros números" para tirar a audiência.
        </Typography>
      ) : null}
      {!disabled ? (
        <FormControlLabel
          sx={{ mt: 1, ml: -0.75, alignItems: 'flex-start' }}
          control={
            <Checkbox
              size="small"
              checked={Boolean(targets.include_unlinked)}
              onChange={(e) => setT({ include_unlinked: e.target.checked })}
              sx={{ mt: -0.25, '&.Mui-checked': { color: WA_DARK } }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Incluir contatos sem número de origem
                {unlinked != null ? (
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75, fontWeight: 700 }}>
                    {plural(unlinked, 'contato', 'contatos')}
                  </Typography>
                ) : null}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Importados ou criados à mão, que ainda não estão na agenda nem conversaram com nenhum número.
              </Typography>
            </Box>
          }
        />
      ) : null}
    </Box>
  );
}

// ---------------------------------------------------------------- histórico de resposta
const ENGAGEMENTS = [
  { key: 'any', Icon: IconUsers, label: 'Todos', description: 'Não filtra pelo histórico de conversa.' },
  {
    key: 'replied',
    Icon: IconMessageCircleCheck,
    label: 'Já responderam',
    description: 'Só quem já mandou mensagem para algum dos números.'
  },
  {
    key: 'recent',
    Icon: IconCalendarStats,
    label: 'Responderam há pouco',
    description: 'Só quem mandou mensagem para o número nos últimos dias.'
  },
  {
    key: 'never',
    Icon: IconMessageCircleOff,
    label: 'Nunca responderam',
    description: 'Só quem nunca mandou mensagem. É o público de maior risco de bloqueio.'
  }
];

// card clicável de um preset de ritmo
function PresetCard({ preset, selected, onSelect }) {
  const risk = RISK_UI[preset.risk] || RISK_UI.medium;
  const Icon = PRESET_ICON[preset.key] || IconGauge;
  const parts = preset.key === 'custom' ? [] : pacingParts(preset);
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? onSelect() : null)}
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        border: '2px solid',
        cursor: 'pointer',
        height: '100%',
        borderColor: selected ? (t) => t.vars.palette[risk.token].main : 'divider',
        bgcolor: selected ? (t) => `rgba(${t.vars.palette[risk.token].mainChannel} / 0.08)` : 'background.paper',
        transition: 'border-color .12s ease, background-color .12s ease',
        '&:hover': { borderColor: (t) => `rgba(${t.vars.palette[risk.token].mainChannel} / 0.7)` },
        outline: 'none',
        '&:focus-visible': { boxShadow: (t) => `0 0 0 3px rgba(${t.vars.palette[risk.token].mainChannel} / 0.3)` }
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color: `${risk.token}.main`,
            bgcolor: (t) => `rgba(${t.vars.palette[risk.token].mainChannel} / 0.14)`
          }}
        >
          <Icon size={17} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 14, flex: 1 }} noWrap>
          {preset.label}
        </Typography>
        <Radio
          size="small"
          checked={selected}
          onChange={onSelect}
          tabIndex={-1}
          sx={{ p: 0, color: `${risk.token}.main`, '&.Mui-checked': { color: `${risk.token}.main` } }}
        />
      </Stack>
      <Chip
        size="small"
        label={risk.label}
        sx={{
          height: 18,
          fontSize: 10.5,
          fontWeight: 800,
          borderRadius: 1,
          mb: 0.75,
          color: `${risk.token}.main`,
          bgcolor: (t) => `rgba(${t.vars.palette[risk.token].mainChannel} / 0.14)`
        }}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35 }}>
        {preset.description}
      </Typography>
      {parts.length ? (
        <Stack component="ul" spacing={0.1} sx={{ m: 0, mt: 0.75, pl: 2, color: 'text.secondary', fontSize: 11.5 }}>
          {parts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}

// campos do ritmo personalizado
function CustomPacingFields({ pacing, limits, onChange }) {
  const lim = limits || FALLBACK_PRESETS.limits;
  const num = (v, min, max) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n)));
  };
  const win = pacing.window || { start: '', end: '' };
  const setWin = (p) => {
    const next = { ...win, ...p };
    onChange({ window: next.start || next.end ? next : null });
  };
  return (
    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2.5, border: '1px dashed', borderColor: 'divider', bgcolor: 'background.default' }}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
        <TextField
          type="number"
          size="small"
          label="Tempo entre envios (s)"
          value={(Number(pacing.interval_ms) || 0) / 1000}
          onChange={(e) => {
            const v = Number(String(e.target.value).replace(',', '.'));
            if (!Number.isFinite(v)) return;
            onChange({ interval_ms: Math.min(lim.interval_ms.max, Math.max(lim.interval_ms.min, Math.round(v * 1000))) });
          }}
          inputProps={{ min: lim.interval_ms.min / 1000, max: Math.round(lim.interval_ms.max / 1000), step: 0.1 }}
          helperText={`${lim.interval_ms.min / 1000}–${Math.round(lim.interval_ms.max / 1000)} s · 0,3 s ≈ 3 envios/s (10 mil/h)`}
        />
        <TextField
          type="number"
          size="small"
          label="Variação (%)"
          value={pacing.jitter_pct ?? 0}
          onChange={(e) => onChange({ jitter_pct: num(e.target.value, lim.jitter_pct.min, lim.jitter_pct.max) })}
          inputProps={{ min: lim.jitter_pct.min, max: lim.jitter_pct.max }}
          helperText="± sobre o intervalo"
        />
        <TextField
          type="number"
          size="small"
          label="Limite por dia (por número)"
          value={pacing.daily_limit ?? ''}
          onChange={(e) =>
            onChange({ daily_limit: e.target.value === '' ? null : num(e.target.value, lim.daily_limit.min, lim.daily_limit.max) })
          }
          inputProps={{ min: lim.daily_limit.min, max: lim.daily_limit.max }}
          helperText="Vazio = só o aquecimento"
        />
        <TextField
          type="number"
          size="small"
          label="Pausa a cada N envios"
          value={pacing.pause_every ?? 0}
          onChange={(e) => onChange({ pause_every: num(e.target.value, lim.pause_every.min, lim.pause_every.max) })}
          inputProps={{ min: lim.pause_every.min, max: lim.pause_every.max }}
          helperText="0 = sem pausa"
        />
        <TextField
          type="number"
          size="small"
          label="Pausa por M minutos"
          value={pacing.pause_minutes ?? 0}
          onChange={(e) => onChange({ pause_minutes: num(e.target.value, lim.pause_minutes.min, lim.pause_minutes.max) })}
          inputProps={{ min: lim.pause_minutes.min, max: lim.pause_minutes.max }}
          helperText={`até ${lim.pause_minutes.max} min`}
        />
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            type="time"
            size="small"
            label="Janela: início"
            value={win.start || ''}
            onChange={(e) => setWin({ start: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1 }}
          />
          <TextField
            type="time"
            size="small"
            label="fim"
            value={win.end || ''}
            onChange={(e) => setWin({ end: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1 }}
          />
        </Stack>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.75 }}>
        Janela de horário (Brasília): fora dela os envios esperam o próximo início. Deixe vazia para enviar a qualquer hora.
      </Typography>
    </Box>
  );
}

// estimativa de audiência ao vivo (total + divisão por número + avisos)
// texto do motivo "pela origem" conforme a opção escolhida em "De quais números vem a audiência"
const sourceExcludedLabel = (n, source) => {
  const who = plural(n, 'contato', 'contatos');
  if (source === 'others') return `${who} por já serem dos números que enviam (você escolheu "Só dos outros números")`;
  if (source === 'sending') return `${who} por não serem dos números que enviam`;
  if (source === 'custom') return `${who} por não serem dos números escolhidos na origem`;
  return `${who} pela origem`;
};
function EstimateBox({ estimate, loading, many, targets }) {
  if (!estimate && !loading) return null;
  const by = Array.isArray(estimate?.by_session) ? estimate.by_session : [];
  const warnings = Array.isArray(estimate?.warnings) ? estimate.warnings : [];
  const f = estimate?.filtered || {};
  const unlinkedOut = targets && targets.include_unlinked === false && targets.contacts !== 'none' ? Number(estimate?.unlinked || 0) : 0;
  const filteredParts = [
    f.source ? sourceExcludedLabel(f.source, targets?.source) : null,
    unlinkedOut ? `${plural(unlinkedOut, 'contato sem número de origem', 'contatos sem número de origem')} (caixa "Incluir contatos sem número de origem" desmarcada)` : null,
    f.tags ? `${plural(f.tags, 'contato', 'contatos')} pelas tags` : null,
    f.engagement ? `${plural(f.engagement, 'contato', 'contatos')} pelo histórico de resposta` : null,
    f.cooldown ? `${plural(f.cooldown, 'contato', 'contatos')} receberam broadcast há pouco` : null
  ].filter(Boolean);
  return (
    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ color: WA_DARK, display: 'inline-flex' }}>
          {loading ? <CircularProgress size={16} sx={{ color: WA_DARK }} /> : <IconUsers size={18} />}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Audiência ≈ {(estimate?.total || 0).toLocaleString('pt-BR')}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
        {[
          { n: estimate?.contacts || 0, label: plural(estimate?.contacts || 0, 'contato da audiência', 'contatos da audiência'), hint: 'Bloco "Contatos" acima (salvos/todos/escolhidos), depois da origem e dos filtros.' },
          estimate?.group_members ? { n: estimate.group_members, label: plural(estimate.group_members, 'membro de grupo, no privado', 'membros de grupo, no privado'), hint: 'Membros dos grupos escolhidos, cada um na própria conversa, enviados pelos números que enviam.' } : null,
          estimate?.groups ? { n: estimate.groups, label: plural(estimate.groups, 'post em grupo', 'posts em grupo'), hint: 'A mensagem postada no grupo, pelo número que participa dele.' } : null
        ]
          .filter(Boolean)
          .map((it) => (
            <Tooltip key={it.label} title={it.hint}>
              <Chip size="small" variant="outlined" label={`${Number(it.n).toLocaleString('pt-BR')} ${it.label}`} sx={{ borderRadius: 1.5, fontSize: 11.5 }} />
            </Tooltip>
          ))}
      </Stack>
      {many && by.length ? (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          {by.map((s) => (
            <Tooltip
              key={s.session_id}
              title={`Sai por este número: ${s.contacts || 0} no privado (contatos + membros de grupo) · ${s.groups || 0} posts em grupo${s.connected ? '' : ' · número não conectado'}`}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  pl: 0.5,
                  pr: 1,
                  py: 0.35,
                  borderRadius: 5,
                  border: '1px solid',
                  borderColor: `${s.color || WA_GREEN}66`,
                  bgcolor: 'background.paper',
                  opacity: s.connected ? 1 : 0.65
                }}
              >
                <WaNumberChip session={{ id: s.session_id, label: s.label, color: s.color, connected: s.connected }} />
                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                  {((s.contacts || 0) + (s.groups || 0)).toLocaleString('pt-BR')}
                </Typography>
              </Box>
            </Tooltip>
          ))}
        </Stack>
      ) : null}
      {many && by.length > 1 && estimate?.distribution ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          Contatos divididos <b>{distributionOf(estimate.distribution).short}</b>
          {(estimate?.groups || 0) > 0 ? '; grupos saem pelo número que está em cada grupo.' : '.'}
        </Typography>
      ) : null}
      {filteredParts.length ? (
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
            <IconFilterMinus size={14} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Ficaram de fora:
            </Typography>
          </Stack>
          {filteredParts.map((p) => (
            <Chip key={p} size="small" variant="outlined" label={p} sx={{ height: 20, fontSize: 11, borderRadius: 1, fontWeight: 600 }} />
          ))}
        </Stack>
      ) : null}
      {warnings.map((w) => (
        <Stack key={w} direction="row" spacing={0.5} alignItems="flex-start" sx={{ color: 'warning.main', mt: 0.5 }}>
          <IconAlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {w}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}

// aquecimento dos números escolhidos × audiência estimada
function ChosenWarmup({ sessionIds, byId, warmupBySession, estimate, pacing }) {
  const rows = (sessionIds || []).map((id) => byId.get(id)).filter(Boolean);
  if (!rows.length) return null;
  const by = new Map((estimate?.by_session || []).map((s) => [s.session_id, s]));
  return (
    <Stack spacing={0.75} sx={{ mt: 1.5 }}>
      {rows.map((s) => {
        const w = warmupBySession?.get(s.id) || null;
        const remaining = remainingOf(w, pacing);
        const want = by.get(s.id)?.contacts || 0;
        const over = remaining != null && want > remaining;
        const ready = isReady(s);
        return (
          <Stack key={s.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <WaNumberChip session={s} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {!ready
                ? 'não conectado — não dispara até reconectar'
                : w?.warmed || (w?.day || 0) >= 8
                  ? 'aquecido'
                  : `aquecimento dia ${w?.day || 1} de 7`}
              {ready && w?.pacing_enabled === false ? ' · sem limitador' : ''}
              {ready && remaining != null
                ? ` · hoje ainda pode enviar ${remaining.toLocaleString('pt-BR')}${w?.sent_today != null ? ` (já enviou ${w.sent_today})` : ''}`
                : ''}
            </Typography>
            {ready && over ? (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                icon={<IconHourglassHigh size={12} />}
                label={`${want.toLocaleString('pt-BR')} contatos — só ${remaining.toLocaleString('pt-BR')} saem hoje; o resto fica para amanhã`}
                sx={{ height: 20, fontSize: 10.5, fontWeight: 700, borderRadius: 1 }}
              />
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}

function BroadcastModal({ initial, open, onClose, groups, contacts, tags, sessions, presets, warmupBySession }) {
  const [form, setForm] = useState(EMPTY);
  const [riskAck, setRiskAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timeInput, setTimeInput] = useState('09:00');
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const estSeq = useRef(0);

  const byId = useMemo(() => new Map((sessions || []).map((s) => [s.id, s])), [sessions]);
  const many = (sessions || []).length > 1;
  const readyIds = useMemo(() => (sessions || []).filter(isReady).map((s) => s.id), [sessions]);
  const presetItems = useMemo(() => {
    const items = presets?.items?.length ? presets.items : FALLBACK_PRESETS.items;
    const order = ['fast', 'normal', 'safe', 'very_safe', 'custom'];
    return [...items].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }, [presets]);
  const limits = presets?.limits || FALLBACK_PRESETS.limits;

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        ...EMPTY,
        ...initial,
        session_ids: Array.isArray(initial.session_ids) ? initial.session_ids : [],
        distribution: initial.distribution === 'own' ? 'own' : 'shared',
        targets: { ...EMPTY.targets, ...(initial.targets || {}) },
        pacing: {
          ...DEFAULT_PACING,
          ...(initial.pacing || {}),
          preset: initial.pacing?.preset || 'custom'
        },
        randomize_copies: Boolean(initial.randomize_copies),
        exclude_inactive_days: initial.exclude_inactive_days ?? null
      });
      setRiskAck(Boolean(initial.risk_ack_at));
    } else {
      // novo: pré-seleciona todos os números conectados (ou todos, se nenhum estiver)
      const ids = readyIds.length ? readyIds : (sessions || []).map((s) => s.id);
      setForm({ ...EMPTY, session_ids: ids, pacing: { ...DEFAULT_PACING } });
      setRiskAck(false);
    }
    setEstimate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  // estimativa ao vivo (audiência + divisão por número)
  useEffect(() => {
    if (!open) return undefined;
    const seq = ++estSeq.current;
    setEstimating(true);
    const t = setTimeout(() => {
      post('/whatsapp/broadcasts/audience-estimate', {
        targets: form.targets,
        session_ids: form.session_ids,
        distribution: form.distribution,
        exclude_inactive_days: form.exclude_inactive_days || null
      })
        .then((r) => seq === estSeq.current && setEstimate(r))
        .catch(() => seq === estSeq.current && setEstimate(null))
        .finally(() => seq === estSeq.current && setEstimating(false));
    }, 400);
    return () => clearTimeout(t);
  }, [open, form.targets, form.session_ids, form.distribution, form.exclude_inactive_days]);

  const setF = (p) => setForm((f) => ({ ...f, ...p }));
  const setT = (p) => setForm((f) => ({ ...f, targets: { ...f.targets, ...p } }));
  const engagementValue = form.exclude_inactive_days ? 'recent' : form.targets.engagement || 'any';
  const pickEngagement = (key) =>
    setForm((f) =>
      key === 'recent'
        ? { ...f, exclude_inactive_days: f.exclude_inactive_days || 30, targets: { ...f.targets, engagement: 'any' } }
        : { ...f, exclude_inactive_days: null, targets: { ...f.targets, engagement: key } }
    );
  const setP = (p) => setForm((f) => ({ ...f, pacing: { ...f.pacing, ...p } }));
  const choosePreset = (key) => {
    const p = presetOf(presets, key) || presetOf(FALLBACK_PRESETS, key);
    if (!p) return;
    // trocar PARA "Rápido" exige confirmar o risco de novo (o back também exige `risk_ack`)
    if (key === 'fast' && form.pacing.preset !== 'fast') setRiskAck(false);
    if (key === 'custom') setP({ preset: 'custom' });
    else
      setP({
        preset: key,
        interval_ms: p.interval_ms,
        jitter_pct: p.jitter_pct,
        daily_limit: p.daily_limit,
        pause_every: p.pause_every,
        pause_minutes: p.pause_minutes,
        window: p.window ? { ...p.window } : null
      });
  };

  const addTime = () => {
    const min = hhmmToMin(timeInput);
    if (min == null) return;
    if (!form.times.includes(min)) setF({ times: [...form.times, min].sort((a, b) => a - b) });
  };

  const hasTargets = form.targets.contacts !== 'none' || form.targets.contact_ids.length > 0 || form.targets.groups.length > 0;
  const fastPreset = form.pacing.preset === 'fast';
  const fastWarning = presetOf(presets, 'fast')?.warning || presetOf(FALLBACK_PRESETS, 'fast')?.warning;
  const chosenReady = form.session_ids.filter((id) => readyIds.includes(id)).length;

  const save = async () => {
    if (!form.name.trim()) return toast.error('Dê um nome ao broadcast.');
    if ((sessions || []).length && !form.session_ids.length) return toast.error('Escolha ao menos um número para disparar.');
    if (!hasTargets) return toast.error('Escolha contatos e/ou grupos como destino.');
    if (form.targets.contacts !== 'none' && form.targets.source === 'custom' && !(form.targets.source_session_ids || []).length)
      return toast.error('Marque de quais números vem a audiência.');
    if (form.pacing.preset === 'custom') {
      const w = form.pacing.window;
      if (w && (w.start || w.end)) {
        if (!HHMM_RE.test(w.start || '') || !HHMM_RE.test(w.end || ''))
          return toast.error('Preencha início e fim da janela de horário (ou deixe os dois vazios).');
        if (w.start === w.end) return toast.error('A janela de horário precisa ter início e fim diferentes.');
      }
    }
    if (fastPreset && !riskAck) return toast.error('Marque “Entendo o risco de bloqueio” para usar o ritmo Rápido.');
    setSaving(true);
    try {
      const pacing = { ...form.pacing };
      if (pacing.window && !(pacing.window.start && pacing.window.end)) pacing.window = null;
      const payload = {
        name: form.name.trim(),
        session_ids: form.session_ids,
        distribution: form.distribution === 'own' ? 'own' : 'shared',
        targets: form.targets,
        pacing,
        times: form.times,
        mode: form.mode,
        delete_used: form.delete_used,
        randomize_copies: Boolean(form.randomize_copies),
        exclude_inactive_days: form.exclude_inactive_days ? Number(form.exclude_inactive_days) : null,
        active: form.active,
        risk_ack: Boolean(riskAck)
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
      contacts.map((c) => {
        const name = c.display_name || c.phone || c.id;
        return {
          value: c.id,
          label: `${name}${c.display_name && c.phone ? ` · ${c.phone}` : ''}`,
          name,
          secondary: c.display_name && c.phone ? fmtPhoneBR(c.phone) : '',
          photoPath: `/whatsapp/contacts/${c.id}/photo`,
          kind: 'contact'
        };
      }),
    [contacts]
  );
  const groupOptions = useMemo(
    () =>
      groups.map((g) => {
        const s = (g.session_id && byId.get(g.session_id)) || g.session || null;
        const count = g.participants_count || g.group_meta?.participants_count || 0;
        const name = g.name || g.jid || g.chat_id;
        const parts = [count ? plural(count, 'membro', 'membros') : null, many && s ? `via ${sessionLabel(s)}` : null].filter(Boolean);
        return {
          value: g.chat_id,
          label: `${name}${count ? ` (${count})` : ''}${many && s ? ` · ${sessionLabel(s)}` : ''}`,
          name,
          secondary: parts.join(' · '),
          photoPath: `/whatsapp/chats/${g.chat_id}/photo`,
          kind: 'group'
        };
      }),
    [groups, byId, many]
  );
  const groupsMode = form.targets.groups_mode || 'group';
  const hasGroups = (form.targets.groups || []).length > 0;

  return (
    <CrmModal
      open={open}
      onClose={() => !saving && onClose(false)}
      disableClose={saving}
      maxWidth="md"
      title={initial?.id ? 'Editar broadcast' : 'Novo broadcast'}
      footer={
        <>
          <FormControlLabel
            control={<Switch checked={form.active} onChange={(e) => setF({ active: e.target.checked })} />}
            label={form.active ? 'Ativo' : 'Inativo'}
            sx={{ mr: 'auto', flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
          />
          <Button color="inherit" onClick={() => onClose(false)} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={save}
            disabled={saving || (fastPreset && !riskAck)}
            startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <IconDeviceFloppy size={18} />}
            sx={waButtonSx}
          >
            Salvar
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        <TextField label="Nome" size="small" fullWidth value={form.name} onChange={(e) => setF({ name: e.target.value })} />

        {/* ---------- números que enviam ---------- */}
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.75 }}>Números que enviam</Typography>
          {many ? (
            <>
              <WaNumberMultiSelect sessions={sessions} value={form.session_ids} onChange={(ids) => setF({ session_ids: ids })} />
              {form.session_ids.length > 1 ? (
                <Box sx={{ mt: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.75 }}>Como dividir os contatos entre os números</Typography>
                  <DistributionPicker value={form.distribution} onChange={(v) => setF({ distribution: v })} />
                  <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 1, color: 'text.secondary' }}>
                    <IconArrowsSplit size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                    <Typography variant="caption">
                      {form.distribution === 'own'
                        ? 'Se o contato é de mais de um número, recebe uma vez só, pelo da conversa mais recente. '
                        : 'Cada número fica primeiro com os contatos dele; o que passar da parte dele vai para os outros, até igualar. Só os números conectados na hora do disparo entram na divisão. '}
                      Grupos saem sempre pelo número que está no grupo.
                    </Typography>
                  </Stack>
                  {form.distribution === 'own' && form.targets.contacts !== 'none' ? (
                    <Box sx={{ mt: 1.25, p: 1.5, borderRadius: 2.5, bgcolor: 'action.hover' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Contatos que não são de nenhum dos números que enviam
                      </Typography>
                      {form.targets.source === 'others' ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                          Como a audiência vem de outros números, esses contatos são divididos entre os números que enviam.
                        </Typography>
                      ) : (
                        <RadioGroup
                          row
                          value={effectiveOutsiders(form.targets)}
                          onChange={(e) => setT({ outsiders: e.target.value })}
                          sx={{ mt: 0.25 }}
                        >
                          <FormControlLabel
                            value="split"
                            control={<Radio size="small" sx={{ '&.Mui-checked': { color: WA_DARK } }} />}
                            label={<Typography variant="body2">Dividir entre eles</Typography>}
                          />
                          <FormControlLabel
                            value="skip"
                            control={<Radio size="small" sx={{ '&.Mui-checked': { color: WA_DARK } }} />}
                            label={<Typography variant="body2">Deixar de fora</Typography>}
                          />
                        </RadioGroup>
                      )}
                    </Box>
                  ) : null}
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                  Com um número só, todos os contatos saem por ele. Escolha dois ou mais para dividir o envio.
                </Typography>
              )}
              {form.session_ids.length && !chosenReady ? (
                <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.5, fontWeight: 600 }}>
                  Nenhum dos números escolhidos está conectado — a campanha só dispara quando um deles reconectar.
                </Typography>
              ) : null}
            </>
          ) : (sessions || []).length === 1 ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <WaNumberChip session={sessions[0]} showPhone size="medium" />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {isReady(sessions[0]) ? 'Único número da organização.' : 'Único número da organização — não conectado no momento.'}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="caption" sx={{ color: 'warning.main' }}>
              Nenhum número cadastrado. Conecte um número nas Configurações para disparar.
            </Typography>
          )}
        </Box>

        {/* ---------- contatos + origem da audiência ---------- */}
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Contatos</Typography>
          <RadioGroup value={form.targets.contacts} onChange={(e) => setT({ contacts: e.target.value })}>
            <FormControlLabel value="saved" control={<Radio size="small" />} label="Contatos salvos na organização" />
            <FormControlLabel
              value="all"
              control={<Radio size="small" />}
              label={many ? 'Todos os contatos' : 'Todos os contatos do WhatsApp conectado'}
            />
            <FormControlLabel value="none" control={<Radio size="small" />} label="Nenhum (só os escolhidos abaixo / grupos)" />
          </RadioGroup>

          {many ? (
            <Box sx={{ mt: 1.75 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.25 }}>De quais números vem a audiência</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                Independe de quais números enviam. Um contato é de um número quando está na agenda dele ou já conversou com ele.
              </Typography>
              <AudienceSourcePicker
                targets={form.targets}
                setT={setT}
                sendingIds={form.session_ids}
                sessions={sessions}
                estimate={estimate}
                disabled={form.targets.contacts === 'none'}
              />
            </Box>
          ) : null}

          {form.targets.contacts !== 'none' && tags.length ? (
            <Box
              sx={{
                mt: 1.75,
                display: 'grid',
                gap: 1.25,
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }
              }}
            >
              <MultiSelect
                label="Só quem tem as tags"
                value={form.targets.tags}
                onChange={(v) => setT({ tags: v })}
                options={tags.map((t) => ({ value: t, label: t }))}
                placeholder="Qualquer tag…"
                limitTags={2}
              />
              <MultiSelect
                label="Excluir quem tem as tags"
                value={form.targets.exclude_tags || []}
                onChange={(v) => setT({ exclude_tags: v })}
                options={tags.map((t) => ({ value: t, label: t }))}
                placeholder="Ex.: cliente, não perturbe…"
                limitTags={2}
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
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
              Os contatos escolhidos aqui sempre recebem, mesmo fora da origem e dos filtros.
            </Typography>
          </Box>
        </Box>

        {/* ---------- grupos + estimativa ---------- */}
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Grupos</Typography>
          <MultiSelect
            label="Grupos"
            value={form.targets.groups}
            onChange={(v) => setT({ groups: v })}
            options={groupOptions}
            placeholder="Escolher grupos…"
          />
          {many ? (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
              Cada grupo sai pelo número que participa dele, mesmo que esse número não esteja marcado acima.
            </Typography>
          ) : null}
          {hasGroups ? (
            <Box
              sx={{
                mt: 1.25,
                p: 1.25,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: groupsMode !== 'group' ? 'rgba(124,58,237,0.45)' : 'divider',
                bgcolor: groupsMode !== 'group' ? 'rgba(124,58,237,0.06)' : 'transparent',
                transition: 'all .15s'
              }}
            >
              <FormControlLabel
                sx={{ m: 0, alignItems: 'flex-start' }}
                control={
                  <Checkbox
                    size="small"
                    checked={groupsMode !== 'group'}
                    onChange={(e) => setT({ groups_mode: e.target.checked ? 'members' : 'group' })}
                    sx={{ mt: -0.5, color: '#7c3aed', '&.Mui-checked': { color: '#7c3aed' } }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Enviar no privado dos membros
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Em vez de postar no grupo, cada membro recebe a mensagem na conversa individual, enviada pelos <b>números que enviam</b>
                      (marcados no topo) e dividida entre eles como os contatos — não precisa ser o número que está no grupo.
                      Quem já está na audiência de contatos não recebe em dobro. Vale o ritmo e o limite diário de cada número — grupos grandes levam tempo.
                    </Typography>
                  </Box>
                }
              />
              {groupsMode !== 'group' ? (
                <FormControlLabel
                  sx={{ m: 0, mt: 0.5, ml: 3.5 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={groupsMode === 'both'}
                      onChange={(e) => setT({ groups_mode: e.target.checked ? 'both' : 'members' })}
                      sx={{ color: '#7c3aed', '&.Mui-checked': { color: '#7c3aed' } }}
                    />
                  }
                  label={<Typography variant="body2">Também postar a mensagem no grupo</Typography>}
                />
              ) : null}
            </Box>
          ) : null}
          <EstimateBox estimate={estimate} loading={estimating} many={many} targets={form.targets} />
        </Box>

        {/* ---------- horários ---------- */}
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 1 }}>Horários (todo dia, Brasília)</Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField type="time" size="small" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} sx={{ width: 130 }} />
            <Button
              variant="outlined"
              startIcon={<IconPlus size={15} />}
              onClick={addTime}
              sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.primary', textTransform: 'none', minHeight: 40 }}
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

        {/* ---------- modo ---------- */}
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Modo de envio</Typography>
          <RadioGroup value={form.mode} onChange={(e) => setF({ mode: e.target.value })}>
            <FormControlLabel value="sequential" control={<Radio size="small" />} label="Sequência (rotaciona; ao fim, volta ao início)" />
            <FormControlLabel value="random" control={<Radio size="small" />} label="Aleatório (sorteia uma copy a cada disparo)" />
          </RadioGroup>
          <FormControlLabel
            control={
              <Switch
                checked={form.delete_used}
                onChange={(e) => setF({ delete_used: e.target.checked })}
                disabled={form.randomize_copies}
              />
            }
            label="Apagar a copy depois de usar"
          />
          <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
            <FormControlLabel
              control={<Switch checked={Boolean(form.randomize_copies)} onChange={(e) => setF({ randomize_copies: e.target.checked })} />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Randomizar envio
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Usa TODAS as copies no mesmo disparo: cada contato recebe uma sorteada. Com 20 copies, 20 textos diferentes circulam ao
                    mesmo tempo (menos "texto igual em massa"). O modo acima e "apagar depois de usar" deixam de valer.
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
          </Box>
        </Box>

        {/* ---------- histórico de resposta + não repetir ---------- */}
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.25 }}>Histórico de resposta</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Quem já responde tem muito menos chance de denunciar o número. Vale para os contatos salvos/todos; grupos e escolhidos à mão
            sempre recebem. Veja quem respondeu em "Respostas", na lista.
          </Typography>
          <ChoiceCards
            options={ENGAGEMENTS.map((o) =>
              o.key === 'recent' && engagementValue === 'recent'
                ? {
                    ...o,
                    description: 'Só quem mandou mensagem para o número nos últimos',
                    extra: (
                      <TextField
                        type="number"
                        size="small"
                        value={form.exclude_inactive_days || ''}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        onChange={(e) => setF({ exclude_inactive_days: Math.min(365, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                        inputProps={{ min: 1, max: 365, 'aria-label': 'dias' }}
                        sx={{ width: '100%' }}
                        InputProps={{ endAdornment: <Typography variant="caption">dias</Typography> }}
                      />
                    )
                  }
                : o
            )}
            value={engagementValue}
            onChange={pickEngagement}
            columns={4}
            ariaLabel="Histórico de resposta"
            disabled={form.targets.contacts === 'none'}
          />
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
              <FormControlLabel
                sx={{ m: 0, flex: 1, alignItems: 'flex-start' }}
                control={
                  <Switch
                    checked={Boolean(form.targets.cooldown_hours)}
                    disabled={form.targets.contacts === 'none'}
                    onChange={(e) => setT({ cooldown_hours: e.target.checked ? form.targets.cooldown_hours || 24 : null })}
                  />
                }
                label={
                  <Box sx={{ pt: 0.25 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <IconRepeatOff size={16} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Não repetir para quem recebeu broadcast há pouco
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Pula quem recebeu qualquer broadcast da organização nesse período. Evita duas campanhas seguidas na mesma pessoa.
                    </Typography>
                  </Box>
                }
              />
              <TextField
                type="number"
                size="small"
                value={form.targets.cooldown_hours || ''}
                disabled={!form.targets.cooldown_hours}
                onChange={(e) => setT({ cooldown_hours: Math.min(720, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                inputProps={{ min: 1, max: 720, 'aria-label': 'horas' }}
                sx={{ width: 120, flexShrink: 0 }}
                InputProps={{ endAdornment: <Typography variant="caption">horas</Typography> }}
              />
            </Stack>
          </Box>
        </Box>

        {/* ---------- ritmo (anti-bloqueio) ---------- */}
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.25 }}>Ritmo de envio (anti-bloqueio)</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.25 }}>
            Padrão: 0,3 s entre envios (≈ 3 por segundo, 10 mil por hora). Campanhas no mesmo horário andam em paralelo, cada uma no seu
            ritmo. Intervalos maiores, pausas e limites diários reduzem o risco; o aquecimento de cada número continua valendo por cima. Se
            o número começar a ser bloqueado, o disparo <b>pausa sozinho</b> e você decide se continua.
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }
            }}
          >
            {presetItems.map((p0) => {
              const p = p0.key === 'custom' ? { ...p0, risk: riskOfInterval(form.pacing.interval_ms) } : p0;
              return <PresetCard key={p.key} preset={p} selected={form.pacing.preset === p.key} onSelect={() => choosePreset(p.key)} />;
            })}
          </Box>
          {form.pacing.preset === 'custom' ? <CustomPacingFields pacing={form.pacing} limits={limits} onChange={setP} /> : null}
          {fastPreset && fastWarning ? (
            <Alert
              severity="error"
              icon={<IconBolt size={18} />}
              sx={{ mt: 1.5, borderRadius: 2, '& .MuiAlert-message': { fontSize: 12.5 } }}
            >
              {fastWarning}
            </Alert>
          ) : null}
          <ChosenWarmup
            sessionIds={form.session_ids}
            byId={byId}
            warmupBySession={warmupBySession}
            estimate={estimate}
            pacing={form.pacing}
          />
        </Box>

        {/* ---------- responsabilidade (só o ritmo Rápido exige confirmar; os outros já têm pausas e limites) ---------- */}
        {fastPreset ? (
          <Box
            sx={{
              p: 1.75,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: (t) => `rgba(${t.vars.palette[fastPreset ? 'error' : 'warning'].mainChannel} / 0.5)`,
              bgcolor: (t) => `rgba(${t.vars.palette[fastPreset ? 'error' : 'warning'].mainChannel} / 0.08)`
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <Box sx={{ color: fastPreset ? 'error.main' : 'warning.main', mt: 0.25, flexShrink: 0 }}>
                <IconAlertTriangle size={22} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                  {fastPreset ? 'Atenção: ritmo Rápido = risco ALTO de bloqueio' : 'Atenção: risco de restrição do número'}
                </Typography>
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
                      sx={{ '&.Mui-checked': { color: fastPreset ? 'error.main' : WA_DARK } }}
                    />
                  }
                  label={
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>
                      {fastPreset ? 'Entendo o risco de bloqueio e assumo a responsabilidade' : 'Entendo e assumo a responsabilidade'}
                    </Typography>
                  }
                />
              </Box>
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </CrmModal>
  );
}

// ---------------------------------------------------------------- histórico
// aviso de disparo pausado (disjuntor/manual) com Retomar / Enviar mesmo assim — lista e histórico
function PausedBanner({ run, busy, onResume, onForce, compact }) {
  const auto = run.pause_reason && run.pause_reason !== 'Pausado manualmente';
  return (
    <Box
      sx={{
        mt: 1,
        p: 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.35)`,
        bgcolor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.06)`
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ color: 'error.main', display: 'inline-flex', mt: 0.25, flexShrink: 0 }}>
          <IconPlayerPause size={18} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 800, color: 'error.main', lineHeight: 1.3 }}>
            Disparo pausado{compact ? '' : ` · ${fmtDateBRT(run.run_at)}`}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.4 }}>
            {run.pause_reason || 'Pausa manual'}
            {auto ? '. O disjuntor parou o envio para proteger o número.' : '.'}
            {auto && run.total ? ` Enviados ${run.sent} de ${run.total}${run.blocked ? `, ${run.blocked} bloqueados` : ''}.` : ''}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1, pl: { xs: 0, sm: 3.5 } }} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          disabled={busy}
          onClick={onResume}
          sx={{ whiteSpace: 'nowrap', borderRadius: 2 }}
        >
          Retomar
        </Button>
        <Button
          size="small"
          variant="contained"
          color="error"
          disableElevation
          disabled={busy}
          onClick={onForce}
          sx={{ whiteSpace: 'nowrap', borderRadius: 2 }}
        >
          Enviar mesmo assim
        </Button>
      </Stack>
    </Box>
  );
}

// risco do ritmo PERSONALIZADO pelo intervalo (o back marca "custom" como alto; aqui vale o valor escolhido)
const riskOfInterval = (ms) => {
  const v = Number(ms) || 0;
  if (v <= 1000) return 'high';
  if (v <= 5000) return 'medium';
  if (v <= 20000) return 'low';
  return 'minimal';
};

function runOutcome(r) {
  if (r.status === 'paused') return { key: 'paused', color: 'error.main', label: 'Pausado', Icon: IconPlayerPause };
  if (r.status === 'running') return { key: 'sending', color: 'info.main', label: 'Enviando…', Icon: IconLoader2 };
  if ((r.sent || 0) === 0 && (r.total || 0) > 0 && (r.paced || 0) === 0)
    return { key: 'failed', color: 'error.main', label: 'Falhou', Icon: IconCircleXFilled };
  if ((r.failed || 0) > 0 || (r.blocked || 0) > 0)
    return { key: 'partial', color: 'warning.main', label: 'Concluído com falhas', Icon: IconAlertTriangleFilled };
  if ((r.paced || 0) > 0) return { key: 'paced', color: 'info.main', label: 'Parte aguardando limite do dia', Icon: IconHourglassHigh };
  return { key: 'clean', color: 'success.main', label: 'Concluído', Icon: IconCircleCheckFilled };
}
function RunBar({ r, height = 6, mt = 1 }) {
  const total = Math.max(1, r.total || 0);
  const seg = (n, token) => (n > 0 ? <Box sx={{ width: `${(n / total) * 100}%`, bgcolor: token }} /> : null);
  return (
    <Box sx={{ display: 'flex', height, borderRadius: 3, overflow: 'hidden', bgcolor: 'action.selected', mt }}>
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

// linha de um número dentro de um disparo (by_session)
function SessionRunRow({ bs, session, onSends }) {
  const s = session || bs.session || { id: bs.session_id, label: 'Número', color: null };
  const bits = [
    { n: bs.sent, label: 'enviados', color: 'success.main' },
    { n: bs.pending, label: 'na fila', color: 'text.secondary' },
    { n: bs.paced, label: 'aguardando o limite do dia', color: 'info.main' },
    { n: bs.blocked, label: 'bloqueados', color: 'warning.main' },
    { n: bs.failed, label: 'falhas', color: 'error.main' }
  ].filter((b) => (b.n || 0) > 0);
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      onClick={onSends}
      sx={{
        px: 1,
        py: 0.6,
        borderRadius: 1.5,
        cursor: onSends ? 'pointer' : 'default',
        '&:hover': onSends ? { bgcolor: 'action.hover' } : {}
      }}
    >
      <WaNumberChip session={s} sx={{ flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <RunBar r={bs} height={5} mt={0} />
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {(bs.total || 0).toLocaleString('pt-BR')}
      </Typography>
      <Stack direction="row" spacing={0.75} flexShrink={0} sx={{ display: { xs: 'none', sm: 'flex' } }}>
        {bits.map((b) => (
          <Typography key={b.label} variant="caption" sx={{ color: b.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {b.n} {b.label}
          </Typography>
        ))}
      </Stack>
    </Stack>
  );
}

const SEND_STATUS = {
  PENDING: { pill: 'pending', label: 'Na fila' },
  DONE: { pill: 'active', label: 'Enviado' },
  FAILED: { pill: 'error', label: 'Falhou' },
  BLOCKED: { pill: 'banned', label: 'Bloqueado' },
  PACED: { pill: 'flood', label: 'Aguardando limite do dia' },
  SKIPPED: { pill: 'inactive', label: 'Pulado' }
};

// gaveta "Ver envios" de uma run (filtra por status e por número)
function SendsDrawer({ broadcast, run, onClose, sessions = [], byId }) {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [sess, setSess] = useState('');
  const [page, setPage] = useState(1);
  const open = Boolean(run);
  const many = sessions.length > 1;
  const runSessions = useMemo(() => {
    const ids = (run?.by_session || []).map((x) => x.session_id);
    const list = ids.map((id) => byId?.get(id) || (run.by_session || []).find((x) => x.session_id === id)?.session).filter(Boolean);
    return list.length ? list : sessions;
  }, [run, sessions, byId]);

  // abriu a gaveta a partir da linha de um número → já filtra por ele
  useEffect(() => {
    setSess(run?._session || '');
    setStatus('all');
  }, [run]);
  useEffect(() => {
    setPage(1);
  }, [status, sess, run]);

  useEffect(() => {
    if (!open || !broadcast || !run) return;
    setLoading(true);
    get(`/whatsapp/broadcasts/${broadcast.id}/runs/${run.id}/sends`, {
      params: { page, page_size: 25, ...(status !== 'all' ? { status } : {}), ...(sess ? { session_id: sess } : {}) }
    })
      .then((d) => setData({ items: asList(d), total: d?.total ?? 0, page: d?.page ?? page, pages: d?.pages ?? 1 }))
      .catch((e) => {
        toast.error(errMsg(e, 'Falha ao carregar os envios.'));
        setData({ items: [], total: 0, page: 1, pages: 1 });
      })
      .finally(() => setLoading(false));
  }, [open, broadcast, run, status, sess, page]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 460 }, bgcolor: 'background.default' } } }}
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
          <FormControl size="small" fullWidth>
            <InputLabel id="wa-sends-status-label">Status</InputLabel>
            <Select labelId="wa-sends-status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="DONE">Enviados</MenuItem>
              <MenuItem value="PACED">Aguardando limite do dia</MenuItem>
              <MenuItem value="PENDING">Na fila</MenuItem>
              <MenuItem value="BLOCKED">Bloqueados</MenuItem>
              <MenuItem value="FAILED">Falhas</MenuItem>
              <MenuItem value="SKIPPED">Pulados (sem WhatsApp / bloqueou)</MenuItem>
            </Select>
          </FormControl>
          {many ? <WaNumberSelect sessions={runSessions} value={sess} onChange={(v) => setSess(v || '')} allowAll label="Número" /> : null}
        </Stack>
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
              const sessionOfSend = (s.session_id && byId?.get(s.session_id)) || s.session || null;
              return (
                <Box
                  key={`${s.id || s.chat_id || s.jid}-${i}`}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25, bgcolor: 'background.paper' }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                          {s.name || s.jid || s.chat_id}
                        </Typography>
                        {many && sessionOfSend ? <WaNumberChip session={sessionOfSend} /> : null}
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                        {s.name && s.jid ? s.jid : ''}
                        {s.sent_at ? `${s.name && s.jid ? ' · ' : ''}${fmtDateBRT(s.sent_at)}` : ''}
                        {s.attempts > 1 ? ` · ${s.attempts} tentativas` : ''}
                      </Typography>
                    </Box>
                    <TgStatusPill status={st.pill} label={st.label} />
                  </Stack>
                  {s.status === 'PACED' ? (
                    <Typography variant="caption" sx={{ color: 'info.main', display: 'block', mt: 0.5 }}>
                      Bateu o limite do dia deste número — sai amanhã automaticamente.
                    </Typography>
                  ) : null}
                  {s.status === 'SKIPPED' && s.skip_reason ? (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                      {s.skip_reason}
                    </Typography>
                  ) : null}
                  {s.replied_at ? (
                    <Typography variant="caption" sx={{ color: 'success.main', display: 'block', mt: 0.5, fontWeight: 600 }}>
                      Respondeu {fmtDateBRT(s.replied_at)}
                    </Typography>
                  ) : null}
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

function RunsModal({ broadcast, open, onClose, sessions = [], byId }) {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [actionBusy, setActionBusy] = useState(false);
  const runAction = async (r, what) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      if (what === 'pause') await post(`/whatsapp/broadcasts/${broadcast.id}/runs/${r.id}/pause`, {});
      else await post(`/whatsapp/broadcasts/${broadcast.id}/runs/${r.id}/resume`, { force: what === 'force' });
      toast.success(
        what === 'pause'
          ? 'Disparo pausado.'
          : what === 'force'
            ? 'Retomado — o disjuntor foi desligado neste disparo.'
            : 'Disparo retomado.'
      );
      setRefreshTick((x) => x + 1);
    } catch (e) {
      toast.error(errMsg(e, 'Não deu para alterar o disparo.'));
    } finally {
      setActionBusy(false);
    }
  };
  const [refreshTick, setRefreshTick] = useState(0);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(1);
  const [sendsFor, setSendsFor] = useState(null);
  const many = sessions.length > 1;

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
  }, [open, broadcast, status, period, page, refreshTick]);

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
    <CrmModal
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
        <FormControl size="small" sx={{ minWidth: 170, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
          <InputLabel id="wa-runs-status-label">Status</InputLabel>
          <Select labelId="wa-runs-status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="all">Todos os status</MenuItem>
            <MenuItem value="paused">Pausados</MenuItem>
            <MenuItem value="clean">Sucesso</MenuItem>
            <MenuItem value="errors">Com falhas</MenuItem>
            <MenuItem value="sending">Enviando</MenuItem>
            <MenuItem value="done">Concluídos</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150, flex: { xs: '1 1 calc(100% - 48px)', sm: '0 0 auto' } }}>
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
            const by = Array.isArray(r.by_session) ? r.by_session : [];
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
                    {(r.pending || 0) > 0 ? <StatPill label="Na fila" value={r.pending} /> : null}
                    {(r.paced || 0) > 0 ? <StatPill label="Aguard. limite" value={r.paced} color="info.main" /> : null}
                    {(r.blocked || 0) > 0 ? <StatPill label="Bloqueados" value={r.blocked} color="warning.main" /> : null}
                    {(r.failed || 0) > 0 ? <StatPill label="Falhas" value={r.failed} color="error.main" /> : null}
                    {(r.skipped || 0) > 0 ? <StatPill label="Pulados" value={r.skipped} /> : null}
                    {(r.replied || 0) > 0 ? <StatPill label="Responderam" value={r.replied} color="success.main" /> : null}
                  </Stack>
                  {r.status === 'running' ? (
                    <Tooltip title="Pausar este disparo">
                      <IconButton size="small" onClick={() => runAction(r, 'pause')}>
                        <IconPlayerPause size={18} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  <Tooltip title="Ver envios">
                    <IconButton size="small" onClick={() => setSendsFor(r)}>
                      <IconListDetails size={18} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <RunBar r={r} />
                {r.status === 'paused' ? (
                  <PausedBanner
                    run={r}
                    busy={actionBusy}
                    onResume={() => runAction(r, 'resume')}
                    onForce={() => runAction(r, 'force')}
                    compact
                  />
                ) : null}
                {r.forced_at && r.status === 'running' ? (
                  <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.5, fontWeight: 600 }}>
                    "Enviar mesmo assim" ligado: o disjuntor não pausa mais este disparo.
                  </Typography>
                ) : null}
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {rate}% entregues
                    {r.randomized ? ' · copies sorteadas' : ''}
                  </Typography>
                  {(r.paced || 0) > 0 ? (
                    <Typography variant="caption" sx={{ color: 'info.main', fontWeight: 600 }}>
                      · {r.paced} aguardando o limite do dia (saem amanhã)
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
                {(many || by.length > 1) && by.length ? (
                  <Box sx={{ mt: 1, pt: 0.75, borderTop: '1px dashed', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, px: 1 }}>
                      Por número
                    </Typography>
                    <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                      {by.map((bs) => (
                        <SessionRunRow
                          key={bs.session_id}
                          bs={bs}
                          session={byId?.get(bs.session_id) || bs.session}
                          onSends={() => setSendsFor({ ...r, _session: bs.session_id })}
                        />
                      ))}
                    </Stack>
                  </Box>
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

      <SendsDrawer broadcast={broadcast} run={sendsFor} onClose={() => setSendsFor(null)} sessions={sessions} byId={byId} />
    </CrmModal>
  );
}

// resultado de um "Disparar agora" (por número + avisos do back)
// quem respondeu aos disparos desta campanha nos últimos N dias
function RepliesModal({ broadcast, open, onClose, byId }) {
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!open || !broadcast) return undefined;
    let alive = true;
    setLoading(true);
    get(`/whatsapp/broadcasts/${broadcast.id}/replies`, { params: { days, page, page_size: 25 } })
      .then((r) => alive && setData(r))
      .catch((e) => alive && toast.error(errMsg(e, 'Não deu para carregar as respostas.')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, broadcast, days, page]);
  useEffect(() => {
    if (open) {
      setPage(1);
      setData(null);
    }
  }, [open, days]);
  const many = (byId?.size || 0) > 1;
  return (
    <CrmModal
      open={open}
      onClose={onClose}
      title={`Respostas · ${broadcast?.name || ''}`}
      subtitle="Quem respondeu depois de receber um disparo desta campanha."
      maxWidth="md"
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="wa-replies-days">Período</InputLabel>
          <Select labelId="wa-replies-days" label="Período" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 3, 7, 15, 30, 60, 90].map((d) => (
              <MenuItem key={d} value={d}>
                Últimos {d} {d === 1 ? 'dia' : 'dias'}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {data ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <StatPill label="Disparos" value={data.runs} />
            <StatPill label="Contatos" value={data.contacts} />
            <StatPill label="Responderam" value={data.replied} color="success.main" />
            <StatPill label="Não responderam" value={data.not_replied} color="warning.main" />
            <StatPill label="Taxa" value={`${data.rate}%`} color={data.rate >= 10 ? 'success.main' : 'text.secondary'} />
          </Stack>
        ) : null}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
        Para tirar quem não responde da audiência, edite a campanha e ligue "Excluir quem não respondeu nos últimos N dias".
      </Typography>
      {loading && !data ? (
        <Skeleton height={160} />
      ) : !data || !data.items.length ? (
        <TgEmptyState
          dense
          icon={IconMessageReply}
          title="Ninguém respondeu ainda"
          description="As respostas são contadas quando o contato manda mensagem depois de receber o disparo."
        />
      ) : (
        <Stack spacing={0.75}>
          {data.items.map((r) => (
            <Box
              key={`${r.contact_id || r.jid}-${r.replied_at}`}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25, bgcolor: 'background.paper' }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                      {r.name}
                    </Typography>
                    {many && r.session ? <WaNumberChip session={r.session} /> : null}
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                    {r.phone ? `+${String(r.phone).replace(/^\+/, '')} · ` : ''}enviado {fmtDateBRT(r.sent_at)} · respondeu{' '}
                    {fmtDateBRT(r.replied_at)}
                  </Typography>
                </Box>
                {r.chat_id ? (
                  <Button size="small" variant="outlined" onClick={() => navigate(`/whatsapp/chat?chat=${encodeURIComponent(r.chat_id)}`)}>
                    Abrir conversa
                  </Button>
                ) : null}
              </Stack>
            </Box>
          ))}
          {data.pages > 1 ? (
            <Stack direction="row" justifyContent="center" sx={{ pt: 1 }}>
              <Pagination count={data.pages} page={page} onChange={(_, p) => setPage(p)} size="small" />
            </Stack>
          ) : null}
        </Stack>
      )}
    </CrmModal>
  );
}

function FireResultModal({ result, onClose, onRuns, byId }) {
  const open = Boolean(result);
  const by = Array.isArray(result?.by_session) ? result.by_session : [];
  const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
  const firstAt = result?.first_at ? new Date(result.first_at) : null;
  const delayed = firstAt && firstAt.getTime() - Date.now() > 90_000;
  return (
    <CrmModal
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title="Disparo iniciado"
      subtitle={result?.b?.name || ''}
      footer={
        <>
          <TgGhostButton onClick={onClose} sx={{ textTransform: 'none' }}>
            Fechar
          </TgGhostButton>
          <Button variant="contained" disableElevation startIcon={<IconHistory size={17} />} onClick={onRuns} sx={waButtonSx}>
            Ver histórico
          </Button>
        </>
      }
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ color: 'success.main', display: 'inline-flex' }}>
            <IconCircleCheck size={22} />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>
            {(result?.total || 0).toLocaleString('pt-BR')} {result?.total === 1 ? 'destino na fila' : 'destinos na fila'}
          </Typography>
        </Stack>
        {by.length ? (
          <Stack spacing={0.5}>
            {by.map((s) => (
              <Stack key={s.session_id} direction="row" spacing={1} alignItems="center">
                <WaNumberChip session={byId?.get(s.session_id) || s.session || { id: s.session_id, label: 'Número' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {(s.total || 0).toLocaleString('pt-BR')} {s.total === 1 ? 'destino' : 'destinos'}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : null}
        {delayed ? (
          <Alert severity="info" sx={{ borderRadius: 2, py: 0, '& .MuiAlert-message': { fontSize: 12.5 } }}>
            Começa às {fmtDateBRT(result.first_at, { dateStyle: undefined, timeStyle: 'short' })} (janela de horário do ritmo).
          </Alert>
        ) : null}
        {warnings.map((w) => (
          <Alert key={w} severity="warning" sx={{ borderRadius: 2, py: 0, '& .MuiAlert-message': { fontSize: 12.5 } }}>
            {w}
          </Alert>
        ))}
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          Os envios seguem o ritmo e o aquecimento de cada número; o que passar do limite do dia fica para amanhã.
        </Typography>
      </Stack>
    </CrmModal>
  );
}

// ---------------------------------------------------------------- ações da linha
function RowActions({ b, compact, connected, onFire, onCopies, onEdit, onRuns, onReplies, onDelete, onToggle }) {
  const [anchor, setAnchor] = useState(null);
  const noCopies = (b.copies_count || 0) === 0;
  const fireTip = !connected ? 'Conecte o WhatsApp para disparar' : noCopies ? 'Cadastre uma copy antes de disparar' : 'Disparar agora';
  const secondary = [
    { key: 'edit', label: 'Editar', icon: <IconPencil size={17} />, run: () => onEdit(b) },
    { key: 'runs', label: 'Histórico', icon: <IconHistory size={17} />, run: () => onRuns(b) },
    { key: 'replies', label: 'Respostas', icon: <IconMessageReply size={17} />, run: () => onReplies(b) },
    { key: 'del', label: 'Excluir', icon: <IconTrash size={17} />, run: () => onDelete(b), danger: true }
  ];
  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      sx={{
        flexShrink: 0,
        width: { xs: '100%', md: 'auto' },
        pt: { xs: 1, md: 0 },
        borderTop: { xs: '1px dashed', md: 0 },
        borderColor: 'divider'
      }}
    >
      <Tooltip title={b.active ? 'Ativo — clique p/ pausar' : 'Inativo — clique p/ ativar'}>
        <Switch
          size="small"
          checked={b.active}
          onChange={() => onToggle(b)}
          sx={{
            '& .MuiSwitch-switchBase.Mui-checked': { color: WA_GREEN },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: WA_GREEN, opacity: 0.55 }
          }}
        />
      </Tooltip>
      <Tooltip title={fireTip}>
        <Box component="span" sx={{ flex: { xs: '1 1 auto', md: '0 0 auto' } }}>
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<IconPlayerPlay size={15} />}
            onClick={() => onFire(b)}
            disabled={noCopies || !connected}
            sx={{ ...waButtonSx, minHeight: 36, width: '100%' }}
          >
            Disparar
          </Button>
        </Box>
      </Tooltip>
      <Tooltip title="Copies">
        <IconButton size="small" onClick={() => onCopies(b)} sx={{ p: 1 }}>
          <IconMessage2 size={17} />
        </IconButton>
      </Tooltip>
      {compact ? (
        <>
          <Tooltip title="Mais ações">
            <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} sx={{ p: 1 }}>
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
  const { session, sessions, loading: sessionLoading, connected } = useWaSession();
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const many = sessions.length > 1;

  const [presets, setPresets] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [editing, setEditing] = useState(null);
  const [copiesFor, setCopiesFor] = useState(null);
  const [runsFor, setRunsFor] = useState(null);
  const [repliesFor, setRepliesFor] = useState(null);
  const [runBusy, setRunBusy] = useState(null);
  const [firingFor, setFiringFor] = useState(null);
  const [firing, setFiring] = useState(false);
  const [fireResult, setFireResult] = useState(null);
  const [deletingFor, setDeletingFor] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // filtros
  const [fName, setFName] = useState('');
  const [fTime, setFTime] = useState('all');
  const [fActive, setFActive] = useState('all');
  const [fSession, setFSession] = useState('');
  const [filterAnchor, setFilterAnchor] = useState(null);

  // presets de ritmo (uma vez; fallback local com os mesmos valores)
  useEffect(() => {
    let on = true;
    get('/whatsapp/broadcasts/presets')
      .then((r) => on && setPresets(r?.items?.length ? r : FALLBACK_PRESETS))
      .catch(() => on && setPresets(FALLBACK_PRESETS));
    return () => {
      on = false;
    };
  }, []);

  const reqRef = useRef(0);
  const resumeRun = async (b, force) => {
    const run = b.paused_run;
    if (!run) return;
    setRunBusy(run.id);
    try {
      await post(`/whatsapp/broadcasts/${b.id}/runs/${run.id}/resume`, { force });
      toast.success(force ? 'Retomado — o disjuntor foi desligado neste disparo.' : 'Disparo retomado.');
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Não deu para retomar.'));
    } finally {
      setRunBusy(null);
    }
  };
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
      const r = await post(`/whatsapp/broadcasts/${b.id}/fire`, {});
      toast.success('Disparo iniciado! Acompanhe no histórico.');
      setFiringFor(null);
      setFireResult({ b, ...(r || {}) });
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Falha ao disparar.'));
    } finally {
      setFiring(false);
    }
  };

  // números da campanha (brief do back + estado ao vivo da sessão)
  const sessionsOf = useCallback(
    (b) => {
      const briefs = Array.isArray(b?.sessions) && b.sessions.length ? b.sessions : (b?.session_ids || []).map((id) => ({ id }));
      return briefs.map((s) => byId.get(s.id) || (s.label ? s : null)).filter(Boolean);
    },
    [byId]
  );
  const warmupItems = useMemo(() => warmupItemsOf(list, sessions), [list, sessions]);
  const warmupBySession = useMemo(() => new Map(warmupItems.map((it) => [it.session.id, it.warmup])), [warmupItems]);
  const allTimes = useMemo(() => [...new Set(list.flatMap((b) => b.times || []))].sort((a, b) => a - b), [list]);
  const filtered = useMemo(
    () =>
      list.filter((b) => {
        if (fName && !(b.name || '').toLowerCase().includes(fName.toLowerCase())) return false;
        if (fTime !== 'all' && !(b.times || []).includes(Number(fTime))) return false;
        if (fActive !== 'all' && Boolean(b.active) !== (fActive === 'active')) return false;
        if (fSession && !(b.session_ids || []).includes(fSession)) return false;
        return true;
      }),
    [list, fName, fTime, fActive, fSession]
  );
  const activeFilterCount = (fTime !== 'all' ? 1 : 0) + (fActive !== 'all' ? 1 : 0) + (fSession ? 1 : 0);
  const filtersActive = !!fName || activeFilterCount > 0;
  const clearFilters = () => {
    setFName('');
    setFTime('all');
    setFActive('all');
    setFSession('');
  };

  const filterControls = (stacked) => (
    <>
      {many ? (
        <WaNumberSelect
          sessions={sessions}
          value={fSession}
          onChange={(v) => setFSession(v || '')}
          allowAll
          label="Número"
          fullWidth={stacked}
          sx={stacked ? { width: '100%' } : { flex: '1 1 190px', minWidth: 180 }}
        />
      ) : null}
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
  const fireSessions = firingFor ? sessionsOf(firingFor) : [];
  const firePacing = firingFor ? pacingParts(firingFor.pacing) : [];

  return (
    <Box>
      <WaPageHeader
        icon={IconSpeakerphone}
        title="Broadcasts"
        subtitle={
          many
            ? 'Disparos em massa por vários números — a audiência é dividida entre eles, com ritmo anti-bloqueio e aquecimento por número.'
            : 'Disparos em massa para contatos e grupos — com rotação de copies, agendamento e ritmo seguro.'
        }
        action={newBtn}
      />

      <WaSessionBanner session={session} loading={sessionLoading} connected={connected} what="disparar broadcasts" />
      <WarmupStrip items={warmupItems} />

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
              sx={{ flex: { xs: '0 0 auto', md: '1 1 220px' }, minWidth: { xs: 0, md: 180 }, width: { xs: '100%', md: 'auto' } }}
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
                  slotProps={{ paper: { sx: { borderRadius: 3, mt: 1, width: 'min(300px, calc(100vw - 32px))' } } }}
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
                const bSessions = sessionsOf(b);
                const bConnected = bSessions.length ? bSessions.some(isReady) : connected;
                const risk = RISK_UI[pacingRisk(presets, b.pacing)] || RISK_UI.medium;
                const warm = (Array.isArray(b.warmup) ? b.warmup : []).map((w) => ({ w, s: byId.get(w.session_id) })).filter((x) => x.s);
                return (
                  <TgCard
                    key={b.id}
                    accent={b.active ? WA_GREEN : 'divider'}
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      alignItems: { md: 'center' },
                      gap: { xs: 1.25, md: 2 },
                      p: { xs: 1.5, md: 2 }
                    }}
                  >
                    <WaBadge icon={IconSpeakerphone} sx={{ display: { xs: 'none', md: 'grid' } }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 15.5, minWidth: 0, maxWidth: '100%' }} noWrap>
                          {b.name}
                        </Typography>
                        <TgStatusPill status={b.active ? 'active' : 'inactive'} />
                        {bSessions.map((s) => (
                          <WaNumberChip key={s.id} session={s} />
                        ))}
                        {!bSessions.length && many ? (
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="sem número"
                            sx={{ height: 20, fontSize: 10.5, fontWeight: 700, borderRadius: 1 }}
                          />
                        ) : null}
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ color: 'text.secondary', mb: 0.75 }}
                      >
                        <IconUsers size={14} />
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          Audiência ≈ {aud.total.toLocaleString('pt-BR')}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 0, overflowWrap: 'anywhere' }}>
                          ({[...aud.parts, CONTACT_MODE_LABEL[mode], ...audienceRulesOf(b)].filter(Boolean).join(' · ')}
                          {(b.targets?.tags || []).length ? ` · tags: ${b.targets.tags.join(', ')}` : ''})
                        </Typography>
                        {many && aud.by_session.length > 1 ? (
                          <Tooltip
                            title={`${distributionOf(b.distribution).label} — ${aud.by_session
                              .map((s) => `${s.label}: ${(s.contacts || 0) + (s.groups || 0)}${s.connected ? '' : ' (não conectado)'}`)
                              .join(' · ')}`}
                          >
                            <Box sx={{ display: 'inline-flex', color: 'text.disabled', cursor: 'help' }}>
                              <IconArrowsSplit size={14} />
                            </Box>
                          </Tooltip>
                        ) : null}
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
                        <Tooltip title={`Ritmo ${pacingLabel(presets, b.pacing)} · ${pacingParts(b.pacing).join(' · ')}`}>
                          <Chip
                            size="small"
                            icon={<IconHourglassHigh size={12} />}
                            label={`${pacingLabel(presets, b.pacing)} · ${fmtSec(b.pacing?.interval_ms || b.interval_ms || 0)} s`}
                            variant="outlined"
                            sx={{
                              borderRadius: 1,
                              height: 22,
                              borderColor: (t) => `rgba(${t.vars.palette[risk.token].mainChannel} / 0.6)`,
                              color: `${risk.token}.main`,
                              '& .MuiChip-icon': { color: 'inherit' }
                            }}
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
                      {warm.length ? (
                        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                          {warm.map(({ w, s }) => {
                            const hot = w.warmed || (w.day || 0) >= 8;
                            const remaining = remainingOf(w, b.pacing);
                            return (
                              <Stack key={s.id} direction="row" spacing={0.5} alignItems="center">
                                {many ? <WaNumberDot session={s} size={8} /> : <IconFlame size={12} style={{ opacity: 0.7 }} />}
                                <Typography variant="caption" sx={{ color: hot ? 'text.secondary' : 'warning.main', fontWeight: 600 }}>
                                  {many ? `${sessionLabel(s)}: ` : ''}
                                  {!isReady(s) ? 'não conectado' : hot ? 'aquecido' : `dia ${w.day || 1}/7`}
                                  {isReady(s) && w.pacing_enabled === false
                                    ? ' · sem limitador'
                                    : isReady(s) && remaining != null
                                      ? ` · restam ${remaining.toLocaleString('pt-BR')} hoje`
                                      : ''}
                                </Typography>
                              </Stack>
                            );
                          })}
                        </Stack>
                      ) : null}
                      {noCopies ? (
                        <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.75 }}>
                          ⚠ Cadastre ao menos uma copy para disparar.
                        </Typography>
                      ) : null}
                      {b.paused_run ? (
                        <PausedBanner
                          run={b.paused_run}
                          busy={runBusy === b.paused_run.id}
                          onResume={() => resumeRun(b, false)}
                          onForce={() => resumeRun(b, true)}
                        />
                      ) : null}
                    </Box>
                    <RowActions
                      b={b}
                      compact={compact}
                      connected={bConnected}
                      onFire={setFiringFor}
                      onCopies={setCopiesFor}
                      onEdit={setEditing}
                      onRuns={setRunsFor}
                      onReplies={setRepliesFor}
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
        sessions={sessions}
        presets={presets}
        warmupBySession={warmupBySession}
      />
      <CopiesModal
        broadcast={copiesFor}
        open={!!copiesFor}
        onClose={(ok) => {
          setCopiesFor(null);
          if (ok) load();
        }}
      />
      <RepliesModal broadcast={repliesFor} open={Boolean(repliesFor)} onClose={() => setRepliesFor(null)} byId={byId} />
      <RunsModal broadcast={runsFor} open={!!runsFor} onClose={() => setRunsFor(null)} sessions={sessions} byId={byId} />
      <FireResultModal
        result={fireResult}
        onClose={() => setFireResult(null)}
        onRuns={() => {
          const b = fireResult?.b;
          setFireResult(null);
          if (b) setRunsFor(b);
        }}
        byId={byId}
      />

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
              {firingFor.mode === 'random' ? 'ordem aleatória' : 'sequência'}; ritmo <b>{pacingLabel(presets, firingFor.pacing)}</b>
              {firePacing.length ? ` (${firePacing.join(', ')})` : ''}. O que passar do limite do dia de cada número fica para amanhã.
              <Box component="span" sx={{ display: 'block', mt: 1.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  {fireSessions.length === 1 ? 'Sai pelo número' : `Sai pelos números · ${distributionOf(firingFor.distribution).short}`}
                </Typography>
                {/* só <span>: a mensagem do TgConfirmDialog vive dentro de um <p> */}
                <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                  {(fireAud.by_session.length ? fireAud.by_session : fireSessions.map((s) => ({ session_id: s.id }))).map((bs) => {
                    const s = byId.get(bs.session_id) ||
                      fireSessions.find((x) => x.id === bs.session_id) || {
                        id: bs.session_id,
                        label: bs.label,
                        color: bs.color,
                        connected: bs.connected
                      };
                    const n = (bs.contacts || 0) + (bs.groups || 0);
                    return (
                      <Box key={bs.session_id} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        <WaNumberDot session={s} size={9} />
                        <Typography component="span" variant="caption" sx={{ fontWeight: 800, color: 'text.primary' }}>
                          {sessionLabel(s)}
                        </Typography>
                        <Typography component="span" variant="caption" sx={{ color: isReady(s) ? 'text.secondary' : 'warning.main' }}>
                          {fireAud.by_session.length ? `≈ ${n.toLocaleString('pt-BR')}` : ''}
                          {isReady(s) ? '' : `${fireAud.by_session.length ? ' · ' : ''}não conectado — fica na fila até reconectar`}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
                {fireSessions.length && !fireSessions.some(isReady) ? (
                  <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5, fontWeight: 700 }}>
                    Nenhum dos números desta campanha está conectado — o disparo vai ser recusado.
                  </Typography>
                ) : null}
                {fireAud.warnings.map((w) => (
                  <Typography key={w} variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.5, fontWeight: 600 }}>
                    ⚠ {w}
                  </Typography>
                ))}
              </Box>
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
