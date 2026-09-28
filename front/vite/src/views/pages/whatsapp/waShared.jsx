import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconBrandWhatsapp, IconPlugConnected } from '@tabler/icons-react';

import { get } from 'api/api';
import { TgEmptyState } from 'views/pages/telegram/ui';

// ============================================================================
// Módulo WhatsApp — helpers compartilhados entre Chat e Contatos.
// Cores oficiais + formatadores + sessão (hook) + estado "não conectado".
// ============================================================================

export const WA_GREEN = '#25D366';
export const WA_DARK = '#128C7E';
export const WA_TEAL = '#075E54';
export const WA_TICK_BLUE = '#53BDEB';
export const WA_GRADIENT = `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK})`;

// tint theme-aware (troca no dark). NUNCA alpha(theme.palette…) em callback sx.
export const tint = (t, token, a) => `rgba(${t.vars.palette[token].mainChannel} / ${a})`;

// valor light + override dark (via applyStyles) — para cores fixas do WhatsApp
export const dual = (light, dark) => (t) => ({ ...light, ...t.applyStyles('dark', dark) });

export const errMsg = (e, fb) => {
  const status = e?.response?.status;
  const m = e?.response?.data?.message ?? e?.message;
  if (status === 503) return 'O gateway do WhatsApp está indisponível no momento. Tente de novo em instantes.';
  if (Array.isArray(m)) return m.join(' | ');
  return String(m || fb || 'Falha na operação.');
};

export const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

export const fmtPhone = (p) => {
  const d = onlyDigits(p);
  if (!d) return '';
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    return `+55 (${ddd}) ${rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : `${rest.slice(0, 4)}-${rest.slice(4)}`}`;
  }
  return `+${d}`;
};

export const fmtTime = (v) => {
  if (!v) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(v));
  } catch {
    return '';
  }
};

export const fmtDateTime = (v) => {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
  } catch {
    return '—';
  }
};

export const startOfDay = (v) => {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dayDiff = (v) => {
  const today = startOfDay(new Date());
  const that = startOfDay(v);
  return Math.round((today.getTime() - that.getTime()) / 86400000);
};

// separador de data no chat: Hoje / Ontem / 12 de março
export const dateLabel = (v) => {
  if (!v) return '';
  try {
    const diff = dayDiff(v);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    const d = new Date(v);
    const opts = { day: '2-digit', month: 'long' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return new Intl.DateTimeFormat('pt-BR', opts).format(d);
  } catch {
    return '';
  }
};

// hora na lista de conversas: HH:MM hoje / Ontem / dd/mm/aa
export const fmtListTime = (v) => {
  if (!v) return '';
  try {
    const diff = dayDiff(v);
    if (diff === 0) return fmtTime(v);
    if (diff === 1) return 'Ontem';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(v));
  } catch {
    return '';
  }
};

// "há 5 min" / "há 2 h" / "há 3 dias"
export const fmtAgo = (v) => {
  if (!v) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(v).getTime()) / 1000));
  if (s < 60) return 'agora';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d === 1 ? '' : 's'}`;
};

export const fmtBytes = (n) => {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

// URL assinada de mídia + flag de download
export const dlUrl = (url) => (url ? `${url}${url.includes('?') ? '&' : '?'}dl=1` : '');

export const EMOJIS = (
  '😀 😁 😂 🤣 😊 😍 😘 😎 🤩 🥳 😇 🙂 😉 😌 😢 😭 😤 😠 😡 🤔 🤨 😳 🥺 😴 🤤 😷 🤒 🤕 🤯 😱 ' +
  '👍 👎 👏 🙌 🙏 💪 🤝 👋 ✌️ 🤟 🤙 👌 ✋ 🫶 💅 🫡 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❤️‍🔥 💯 🔥 ✨ ⭐ ' +
  '🎉 🎊 🥂 🍾 🎁 🏆 🥇 💰 💸 💵 📈 📉 ✅ ❌ ⚠️ ❗ ❓ 💡 📌 📍 🔔 📣 📢 ⏰ ⏳ 🕐 🚀 🛒 🎯 🤖 ' +
  '👀 🙈 🫣 😅 😏 😜 🤪 😋 🤗 🤠 🥰 😻 💬 📝 📎 📷 🎬 🎵 🎤 🔗 🌐 ☀️ 🌙 ⚡ 🌈 🍀 🐶 🐱 ⚽'
)
  .split(' ')
  .filter(Boolean);

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const EMOJI_CELL = 36; // altura fixa da célula (grid gap 0) → maxHeight = múltiplo dela

// ----------------------------------------------------------------------------
// EmojiPicker — Popper + ClickAwayListener (sem backdrop: o 1º clique fora
// fecha o picker E chega no alvo). Reuso do padrão das DMs do Telegram.
// ----------------------------------------------------------------------------
export function EmojiPicker({ anchorEl, onClose, onPick, recent = [], placement = 'top-start' }) {
  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement={placement}
      modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
      sx={{ zIndex: (t) => t.zIndex.modal + 1 }}
    >
      <ClickAwayListener onClickAway={onClose}>
        <Paper elevation={8} sx={{ p: 1, borderRadius: 2, maxWidth: 312 }}>
          {recent.length ? (
            <Box sx={{ mb: 0.75 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', px: 0.5, fontWeight: 700 }}>
                Recentes
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0 }}>
                {recent.map((em, i) => (
                  <Box
                    key={`r-${em}-${i}`}
                    onClick={() => onPick(em)}
                    sx={{
                      fontSize: 20,
                      height: EMOJI_CELL,
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    {em}
                  </Box>
                ))}
              </Box>
              <Box sx={{ height: '1px', bgcolor: 'divider', my: 0.75 }} />
            </Box>
          ) : null}
          <Box
            sx={{
              maxHeight: EMOJI_CELL * 6,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 0
            }}
          >
            {EMOJIS.map((em, i) => (
              <Box
                key={`${em}-${i}`}
                onClick={() => onPick(em)}
                sx={{
                  fontSize: 20,
                  height: EMOJI_CELL,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                {em}
              </Box>
            ))}
          </Box>
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
}

// ----------------------------------------------------------------------------
// useWaSession — estado da sessão da org (polling leve; pausa em aba oculta)
// ----------------------------------------------------------------------------
export function useWaSession(pollMs = 15000) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const s = await get('/whatsapp/session');
      if (seq === seqRef.current) setSession(s || { status: 'none', connected: false });
    } catch (e) {
      if (seq === seqRef.current) setSession((prev) => prev || { status: 'none', connected: false, gateway_error: errMsg(e) });
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      reload();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [reload, pollMs]);

  const connected = Boolean(session?.connected) || session?.status === 'ready';
  return { session, loading, connected, reload };
}

// ----------------------------------------------------------------------------
// WaNotConnected — estado vazio amigável com CTA para /whatsapp/settings
// ----------------------------------------------------------------------------
const STATUS_HINT = {
  none: 'Nenhum número está conectado a esta organização.',
  created: 'A sessão está sendo preparada. Finalize a conexão em Configurações.',
  initializing: 'A sessão está iniciando. Finalize a conexão em Configurações.',
  qr_ready: 'Há um QR Code aguardando leitura em Configurações.',
  authenticating: 'O WhatsApp está autenticando o dispositivo. Aguarde alguns segundos.',
  disconnected: 'A sessão caiu. Reconecte em Configurações para continuar.',
  action_required: 'O WhatsApp pediu uma ação no celular. Confira em Configurações.',
  failed: 'A última tentativa de conexão falhou. Tente novamente em Configurações.'
};

export function WaNotConnected({ session, title = 'WhatsApp não conectado', sx }) {
  const navigate = useNavigate();
  const st = session?.status || 'none';
  return (
    <Box sx={{ py: { xs: 4, md: 8 }, ...sx }}>
      <TgEmptyState
        icon={IconBrandWhatsapp}
        title={title}
        description={STATUS_HINT[st] || STATUS_HINT.none}
        action={
          <Stack spacing={1} alignItems="center">
            <Button
              variant="contained"
              disableElevation
              size="large"
              startIcon={<IconPlugConnected size={20} />}
              onClick={() => navigate('/whatsapp/settings')}
              sx={{ fontWeight: 700, borderRadius: 2.5, px: 3, bgcolor: WA_GREEN, '&:hover': { bgcolor: WA_DARK } }}
            >
              Conectar WhatsApp
            </Button>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Leva menos de um minuto: basta escanear o QR Code com o celular.
            </Typography>
          </Stack>
        }
        sx={{
          maxWidth: 640,
          mx: 'auto',
          bgcolor: 'background.paper',
          borderStyle: 'solid',
          // círculo do ícone em verde WhatsApp (o kit usa primary por padrão)
          '& > .MuiStack-root > .MuiBox-root:first-of-type': { color: WA_DARK, bgcolor: 'rgba(37,211,102,.14)' }
        }}
      />
    </Box>
  );
}
