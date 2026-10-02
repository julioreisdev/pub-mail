// =============================================================================
// WhatsApp — kit das páginas Status e Broadcasts (cores de marca, cabeçalho,
// sessão, fuso de Brasília, mídia). Dark-mode via theme.vars/tokens.
// (arquivo próprio destas páginas; `waShared.jsx` pertence ao Chat/Contatos)
// =============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import { IconBrandWhatsapp, IconPlugConnectedX, IconSettings } from '@tabler/icons-react';

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
// WaPageHeader — igual ao TgPageHeader, com o selo verde do WhatsApp
// ----------------------------------------------------------------------------
export function WaPageHeader({ icon: Icon = IconBrandWhatsapp, title, subtitle, action, sx }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3, ...sx }}>
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
// Sessão: GET /whatsapp/session (polling leve). `connected` = status 'ready'.
// ----------------------------------------------------------------------------
const SESSION_LABEL = {
  none: 'O WhatsApp da organização ainda não foi conectado.',
  created: 'A sessão está sendo preparada.',
  initializing: 'A sessão está iniciando.',
  qr_ready: 'Há um QR Code aguardando leitura nas Configurações.',
  authenticating: 'A sessão está autenticando.',
  disconnected: 'A sessão caiu. Reconecte nas Configurações.',
  action_required: 'O WhatsApp pediu uma ação no celular.',
  failed: 'A última tentativa de conexão falhou.'
};

export function useWaSession(pollMs = 20000) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const s = ++seq.current;
    try {
      const r = await get('/whatsapp/session');
      if (s === seq.current) setSession(r);
    } catch (e) {
      if (s === seq.current)
        setSession((p) => p || { status: 'none', connected: false, gateway_error: errMsg(e, 'Falha ao consultar a sessão.') });
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
  // conexão mudou (conectou, caiu, QR novo) → atualiza na hora
  useRealtimeEvent('wa:session', () => reload());
  const connected = Boolean(session?.connected ?? session?.status === 'ready');
  return { session, loading, connected, reload };
}

// Faixa amigável quando não há sessão conectada (a página continua utilizável).
export function WaSessionBanner({ session, loading, connected, what = 'usar este recurso' }) {
  const navigate = useNavigate();
  if (loading || connected) return null;
  const st = session?.status || 'none';
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
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>WhatsApp não conectado</Typography>
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
