// =============================================================================
// WhatsApp — kit das páginas Status e Broadcasts (cores de marca, cabeçalho,
// sessão, fuso de Brasília, mídia). Dark-mode via theme.vars/tokens.
// (arquivo próprio destas páginas; `waShared.jsx` pertence ao Chat/Contatos)
// =============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, MenuItem, Stack, TextField, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { IconBrandWhatsapp, IconPlugConnectedX, IconSettings } from '@tabler/icons-react';
import { useAuth } from 'contexts/AuthContext';

import { get } from 'api/api';
import { TgCard } from 'views/pages/telegram/ui';
import { useRealtimeEvent } from 'realtime/useRealtime';

export const WA_GREEN = '#25D366';
export const WA_DARK = '#128C7E';
export const WA_TEAL = '#075E54';
export const WA_GRADIENT = `linear-gradient(135deg, ${WA_GREEN} 0%, ${WA_DARK} 100%)`;

export const uid = (p = 'm') => `${p}-${Math.random().toString(36).slice(2, 9)}`;
export const errMsg = (e, fb) => {
  const m = e?.response?.data?.message ?? e?.message;
  return Array.isArray(m) ? m.join(' | ') : String(m || fb);
};
export const asList = (r) => (Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : []);
export const plural = (n, s, p) => `${(n || 0).toLocaleString('pt-BR')} ${n === 1 ? s : p}`;

// ----------------------------------------------------------------------------
// Fuso: o usuário escolhe horários em Brasília, o servidor fala ISO/UTC.
// ----------------------------------------------------------------------------
export const BRT = 'America/Sao_Paulo';
const partsIn = (date, tz) => {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const o = {};
  f.formatToParts(date).forEach((p) => {
    if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10);
  });
  return o;
};
const tzOffsetMs = (date, tz) => {
  const p = partsIn(date, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - date.getTime();
};
// 'YYYY-MM-DDTHH:mm' (Brasília) → ISO UTC
export const brtLocalToIso = (local) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local || '');
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = guess - tzOffsetMs(new Date(guess), BRT);
  ts = guess - tzOffsetMs(new Date(ts), BRT);
  return new Date(ts).toISOString();
};
// ISO → 'YYYY-MM-DDTHH:mm' em Brasília (p/ <input type="datetime-local">)
export const isoToBrtLocal = (iso) => {
  if (!iso) return '';
  const p = partsIn(new Date(iso), BRT);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour % 24)}:${pad(p.minute)}`;
};
export const brtLocalNow = (plusMinutes = 0) => isoToBrtLocal(new Date(Date.now() + plusMinutes * 60000).toISOString());
export const fmtDateBRT = (iso, opts) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: BRT, dateStyle: 'short', timeStyle: 'short', ...opts }).format(new Date(iso));
  } catch {
    return '—';
  }
};
// "em 2 h 15 min" / "em 3 dias" / "atrasado 5 min"
export const relTime = (iso, now = Date.now()) => {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  let s;
  if (min < 1) s = 'menos de 1 min';
  else if (min < 60) s = `${min} min`;
  else if (min < 60 * 24) s = `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
  else {
    const d = Math.floor(min / (60 * 24));
    s = `${d} ${d === 1 ? 'dia' : 'dias'}`;
  }
  return diff >= 0 ? `em ${s}` : `atrasado ${s}`;
};

// relógio compartilhado (countdowns) — re-renderiza a cada `ms`
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// ----------------------------------------------------------------------------
// Mídia: normaliza o objeto devolvido por POST /whatsapp/media
// ----------------------------------------------------------------------------
export const mediaKind = (m) => {
  if (!m) return null;
  const k = String(m.kind || '').toLowerCase();
  if (['image', 'video', 'voice', 'audio', 'document'].includes(k)) return k === 'audio' ? 'voice' : k;
  const mime = String(m.mime || '');
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'voice';
  return 'document';
};
export const fmtBytes = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

// ----------------------------------------------------------------------------
// WaPageHeader — igual ao TgPageHeader, com o selo verde do WhatsApp.
// Celular (< sm): empilha — linha 1 = selo + título (pode quebrar em 2 linhas),
// linha 2 = descrição em largura total, linha 3 = ações em largura total (quebram
// linha; botões principais crescem para ocupar o espaço). Desktop: layout de sempre.
// ----------------------------------------------------------------------------
export function WaPageHeader({ icon: Icon = IconBrandWhatsapp, title, subtitle, action, sx }) {
  const theme = useTheme();
  const xs = useMediaQuery(theme.breakpoints.down('sm'));
  const badge = (
    <Box
      sx={{
        width: 46,
        height: 46,
        flexShrink: 0,
        borderRadius: 3,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        background: WA_GRADIENT,
        boxShadow: '0 8px 20px rgba(37, 211, 102, 0.28)'
      }}
    >
      <Icon size={24} stroke={1.8} />
    </Box>
  );
  if (xs) {
    return (
      <Box sx={{ mb: 3, minWidth: 0, maxWidth: '100%', ...sx }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          {badge}
          <Typography
            variant="h3"
            sx={{ fontWeight: 700, lineHeight: 1.2, flex: 1, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {title}
          </Typography>
        </Stack>
        {subtitle ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
            {subtitle}
          </Typography>
        ) : null}
        {action ? (
          <Box
            sx={{
              mt: 1.5,
              minWidth: 0,
              maxWidth: '100%',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1,
              // ações vindas das páginas (normalmente um <Stack direction="row">): quebram linha
              // e os botões "cheios" crescem para preencher a largura; ícones ficam do tamanho normal
              '& > .MuiStack-root': { flex: '1 1 100%', flexWrap: 'wrap', rowGap: 1, minWidth: 0, maxWidth: '100%' },
              '& .MuiButton-root': { flex: '1 1 auto', minWidth: 0 },
              '& .MuiFormControl-root': { flex: '1 1 160px', minWidth: 0 },
              '& .MuiIconButton-root': { flex: '0 0 auto' }
            }}
          >
            {action}
          </Box>
        ) : null}
      </Box>
    );
  }
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3, ...sx }}>
      {badge}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
    </Stack>
  );
}

// selo verde pequeno (linhas de lista)
export function WaBadge({ icon: Icon = IconBrandWhatsapp, size = 46, sx }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 2.5,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        background: WA_GRADIENT,
        ...sx
      }}
    >
      <Icon size={Math.round(size * 0.48)} />
    </Box>
  );
}

// botão primário verde WhatsApp
export const waButtonSx = {
  borderRadius: 2,
  fontWeight: 700,
  textTransform: 'none',
  bgcolor: WA_GREEN,
  color: '#fff',
  '&:hover': { bgcolor: WA_DARK },
  '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' }
};

// ----------------------------------------------------------------------------
// NÚMEROS da organização: GET /whatsapp/sessions (só os que o usuário pode ver).
// `useWaSessions()` é a fonte única para todas as telas (polling leve + tempo real).
// ----------------------------------------------------------------------------
const SESSION_LABEL = {
  none: 'Nenhum número do WhatsApp foi conectado ainda.',
  created: 'A sessão está sendo preparada.',
  initializing: 'A sessão está iniciando.',
  qr_ready: 'Há um QR Code aguardando leitura nas Configurações.',
  authenticating: 'A sessão está autenticando.',
  disconnected: 'A conexão caiu. Reconecte nas Configurações.',
  action_required: 'O WhatsApp pediu uma ação no celular.',
  failed: 'A última tentativa de conexão falhou.'
};

export const SESSION_STATUS_UI = {
  none: { pill: 'inactive', label: 'Não conectado' },
  created: { pill: 'pending', label: 'Preparando…' },
  initializing: { pill: 'pending', label: 'Iniciando…' },
  qr_ready: { pill: 'pending', label: 'Aguardando QR' },
  authenticating: { pill: 'pending', label: 'Autenticando…' },
  ready: { pill: 'active', label: 'Conectado' },
  disconnected: { pill: 'error', label: 'Desconectado' },
  action_required: { pill: 'flood', label: 'Ação necessária' },
  failed: { pill: 'error', label: 'Falhou' }
};

export const fmtPhoneBR = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    return `+55 (${ddd}) ${rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : `${rest.slice(0, 4)}-${rest.slice(4)}`}`;
  }
  return `+${d}`;
};
export const sessionLabel = (s) => s?.display_label || s?.label || fmtPhoneBR(s?.phone) || 'Número';

/**
 * Lista de números (sessões) da organização visíveis ao usuário.
 * Devolve: sessions (array), byId (Map), connected (algum pronto), loading, reload, canManage (dono/admin).
 */
export function useWaSessions(pollMs = 20000) {
  const { user } = useAuth();
  const role = user?.user?.role;
  const canManage = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const s = ++seq.current;
    try {
      const r = await get('/whatsapp/sessions');
      if (s === seq.current) setData(r || { items: [] });
    } catch (e) {
      if (s === seq.current) setData((p) => p || { items: [], gateway_error: errMsg(e, 'Falha ao consultar os números.') });
    } finally {
      if (s === seq.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
    if (!pollMs) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') reload();
    }, pollMs);
    return () => clearInterval(id);
  }, [reload, pollMs]);
  // conexão de um número mudou / número criado ou removido → atualiza na hora
  useRealtimeEvent('wa:session', () => reload());
  useRealtimeEvent('wa:sessions', () => reload());
  const sessions = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const connected = sessions.some((s) => s.connected || s.status === 'ready');
  return {
    sessions,
    byId,
    connected,
    loading,
    reload,
    canManage,
    max: data?.max || 20,
    configured: data?.configured !== false,
    gateway_error: data?.gateway_error || null
  };
}

/**
 * Compat: "a sessão" agregada da org (telas antigas). `session.status` = ready se algum número está
 * conectado, senão o pior status; `session.sessions` traz todos. Prefira `useWaSessions`.
 */
export function useWaSession(pollMs = 20000) {
  const all = useWaSessions(pollMs);
  const session = useMemo(() => {
    const list = all.sessions;
    const ready = list.find((s) => s.connected || s.status === 'ready');
    const first = ready || list[0] || null;
    return {
      ...(first || { status: 'none', connected: false }),
      status: ready ? 'ready' : first?.status || 'none',
      connected: Boolean(ready),
      sessions: list,
      gateway_error: all.gateway_error || first?.gateway_error || null
    };
  }, [all.sessions, all.gateway_error]);
  return { session, loading: all.loading, connected: all.connected, reload: all.reload, sessions: all.sessions };
}

// ----------------------------------------------------------------------------
// Identidade visual do número: bolinha/chip com a cor e o nome interno
// ----------------------------------------------------------------------------
export function WaNumberDot({ session, size = 10, sx }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        bgcolor: session?.color || WA_GREEN,
        boxShadow: session?.connected ? `0 0 0 2px rgba(255,255,255,.9), 0 0 0 3px ${session?.color || WA_GREEN}55` : 'none',
        opacity: session?.connected || session?.status === 'ready' ? 1 : 0.55,
        ...sx
      }}
    />
  );
}

/** Chip pequeno do número (cor + nome interno). `session` pode ser o brief {id,label,color,phone,status,connected}. */
export function WaNumberChip({ session, size = 'small', showPhone = false, onClick, sx, variant = 'soft' }) {
  if (!session) return null;
  const label = sessionLabel(session);
  const color = session.color || WA_GREEN;
  const title = `${label}${session.phone ? ` · ${fmtPhoneBR(session.phone)}` : ''}${session.connected || session.status === 'ready' ? '' : ' · não conectado'}`;
  return (
    <Tooltip title={title}>
      <Chip
        size={size}
        onClick={onClick}
        icon={<WaNumberDot session={session} size={8} sx={{ ml: 0.75 }} />}
        label={showPhone && session.phone ? `${label} · ${fmtPhoneBR(session.phone)}` : label}
        sx={{
          height: size === 'small' ? 20 : 26,
          maxWidth: 180,
          fontWeight: 700,
          fontSize: size === 'small' ? 11 : 12.5,
          color: variant === 'solid' ? '#fff' : 'text.primary',
          bgcolor: variant === 'solid' ? color : `${color}1F`,
          border: '1px solid',
          borderColor: `${color}66`,
          '& .MuiChip-label': { px: 0.75 },
          '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
          ...sx
        }}
      />
    </Tooltip>
  );
}

/** Select de número (um). `allowAll` acrescenta a opção "Todos os números" (valor ''). */
export function WaNumberSelect({
  sessions = [],
  value,
  onChange,
  allowAll = false,
  allLabel = 'Todos os números',
  label = 'Número',
  size = 'small',
  disabled,
  onlyConnected = false,
  sx,
  fullWidth = true,
  helperText
}) {
  const list = onlyConnected ? sessions.filter((s) => s.connected || s.status === 'ready') : sessions;
  return (
    <TextField
      select
      size={size}
      label={label}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      fullWidth={fullWidth}
      helperText={helperText}
      sx={sx}
    >
      {allowAll ? (
        <MenuItem value="">
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ display: 'inline-flex', gap: '2px' }}>
              {sessions.slice(0, 3).map((s) => (
                <WaNumberDot key={s.id} session={s} size={8} />
              ))}
            </Box>
            <span>{allLabel}</span>
          </Stack>
        </MenuItem>
      ) : null}
      {list.map((s) => (
        <MenuItem key={s.id} value={s.id}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <WaNumberDot session={s} />
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
              {sessionLabel(s)}
            </Typography>
            {s.phone ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                {fmtPhoneBR(s.phone)}
              </Typography>
            ) : null}
            {!(s.connected || s.status === 'ready') ? (
              <Typography variant="caption" sx={{ color: 'warning.main' }}>
                · {SESSION_STATUS_UI[s.status]?.label || 'não conectado'}
              </Typography>
            ) : null}
          </Stack>
        </MenuItem>
      ))}
      {!list.length ? (
        <MenuItem value="__none" disabled>
          {onlyConnected ? 'Nenhum número conectado' : 'Nenhum número cadastrado'}
        </MenuItem>
      ) : null}
    </TextField>
  );
}

/** Seleção de VÁRIOS números (chips clicáveis). `value` = array de ids. */
export function WaNumberMultiSelect({ sessions = [], value = [], onChange, onlyConnected = false, size = 'medium', sx }) {
  const list = onlyConnected ? sessions.filter((s) => s.connected || s.status === 'ready') : sessions;
  const set = new Set(value);
  const toggle = (id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange?.(list.filter((s) => next.has(s.id)).map((s) => s.id));
  };
  if (!list.length)
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', ...sx }}>
        {onlyConnected ? 'Nenhum número conectado.' : 'Nenhum número cadastrado.'}
      </Typography>
    );
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={sx}>
      {list.map((s) => {
        const on = set.has(s.id);
        return (
          <Chip
            key={s.id}
            size={size === 'small' ? 'small' : 'medium'}
            clickable
            onClick={() => toggle(s.id)}
            icon={<WaNumberDot session={s} size={9} sx={{ ml: 1 }} />}
            label={sessionLabel(s)}
            variant={on ? 'filled' : 'outlined'}
            sx={{
              fontWeight: 700,
              borderColor: on ? s.color || WA_GREEN : 'divider',
              bgcolor: on ? `${s.color || WA_GREEN}26` : 'transparent',
              '&:hover': { bgcolor: `${s.color || WA_GREEN}33` }
            }}
          />
        );
      })}
      {list.length > 1 ? (
        <Button
          size="small"
          onClick={() => onChange?.(set.size === list.length ? [] : list.map((s) => s.id))}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {set.size === list.length ? 'Limpar' : 'Todos'}
        </Button>
      ) : null}
    </Stack>
  );
}

// Faixa amigável quando não há sessão conectada (a página continua utilizável).
export function WaSessionBanner({ session, loading, connected, what = 'usar este recurso' }) {
  const navigate = useNavigate();
  if (loading || connected) return null;
  const st = session?.status || 'none';
  const many = Array.isArray(session?.sessions) && session.sessions.length > 1;
  return (
    <TgCard
      hover={false}
      sx={{
        mb: 2.5,
        p: { xs: 2, sm: 2.5 },
        borderColor: (t) => `rgba(${t.vars.palette.warning.mainChannel} / 0.45)`,
        bgcolor: (t) => `rgba(${t.vars.palette.warning.mainChannel} / 0.06)`
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: 'warning.main',
            bgcolor: (t) => `rgba(${t.vars.palette.warning.mainChannel} / 0.14)`
          }}
        >
          <IconPlugConnectedX size={26} stroke={1.8} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{many ? 'Nenhum número conectado' : 'WhatsApp não conectado'}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {SESSION_LABEL[st] || SESSION_LABEL.none} Conecte o número para {what}. Você ainda pode ver e organizar o que está agendado.
          </Typography>
          {session?.gateway_error ? (
            <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.5 }}>
              {session.gateway_error}
            </Typography>
          ) : null}
        </Box>
        <Button
          variant="contained"
          disableElevation
          startIcon={<IconSettings size={18} />}
          onClick={() => navigate('/whatsapp/settings')}
          sx={{ ...waButtonSx, flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          Ir para Configurações
        </Button>
      </Stack>
    </TgCard>
  );
}
