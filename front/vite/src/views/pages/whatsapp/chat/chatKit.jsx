import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { IconCircleCheck, IconDeviceMobile, IconHourglassHigh, IconRobot, IconUser } from '@tabler/icons-react';

import { dual } from '../waShared';

// ============================================================================
// Chat do WhatsApp — peças visuais compartilhadas (scrollbars, etiquetas,
// etiqueta automática de atendimento). Dark-mode só via tokens / dual().
// ============================================================================

// Scrollbar fina (6 px) e discreta. No Chrome ≥ 121, `scrollbar-width` desliga os
// pseudo-elementos ::-webkit-scrollbar — por isso ele fica restrito ao Firefox.
export const THIN_SCROLL = (t) => ({
  '&::-webkit-scrollbar': { width: 6, height: 6 },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,.2)', borderRadius: 6 },
  '&::-webkit-scrollbar-thumb:hover': { backgroundColor: 'rgba(0,0,0,.34)' },
  '@supports (-moz-appearance: none)': { scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,.25) transparent' },
  ...t.applyStyles('dark', {
    '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,.16)' },
    '&::-webkit-scrollbar-thumb:hover': { backgroundColor: 'rgba(255,255,255,.28)' },
    '@supports (-moz-appearance: none)': { scrollbarColor: 'rgba(255,255,255,.2) transparent' }
  })
});

// sem scrollbar nenhuma (linha de chips rola por arrasto, roda do mouse e setas)
export const HIDE_SCROLL = { scrollbarWidth: 'none', msOverflowStyle: 'none', '&::-webkit-scrollbar': { display: 'none' } };

// paleta sugerida ao criar etiqueta (a mesma do back)
export const TAG_COLORS = ['#25D366', '#128C7E', '#34B7F1', '#7C3AED', '#F59E0B', '#EF4444', '#EC4899', '#64748B'];
export const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c) : '#64748B');

// busca sem acento/maiúscula
const DIACRITICS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');
export const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase();

export const firstName = (name) => {
  const s = String(name || '').trim();
  return s ? s.split(/\s+/)[0] : '';
};

// "12 min" / "2 h" / "3 d" (aguardando resposta)
export const fmtWait = (ms) => {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
};

export const fmtCount = (n) => {
  const v = Number(n) || 0;
  if (v > 999) return `${Math.floor(v / 1000)} mil`;
  return String(v);
};

// ----------------------------------------------------------------------------
// Etiqueta (chip com bolinha de cor) — lista e cabeçalho
// ----------------------------------------------------------------------------
export function TagChip({ tag, size = 'sm', onClick, sx }) {
  const color = safeColor(tag?.color);
  const sm = size === 'sm';
  return (
    <Box
      component="span"
      onClick={onClick}
      title={tag?.name}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        height: sm ? 18 : 22,
        px: sm ? 0.75 : 0.9,
        borderRadius: 10,
        fontSize: sm ? 10.5 : 11.5,
        fontWeight: 700,
        lineHeight: 1,
        maxWidth: sm ? 110 : 150,
        flexShrink: 0,
        color: 'text.primary',
        bgcolor: `${color}1f`,
        border: '1px solid',
        borderColor: `${color}40`,
        cursor: onClick ? 'pointer' : 'inherit',
        ...sx
      }}
    >
      <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {tag?.name || 'Etiqueta'}
      </Box>
    </Box>
  );
}

export function MoreChip({ n, title }) {
  if (!n) return null;
  return (
    <Tooltip title={title || ''} disableInteractive>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 18,
          px: 0.6,
          borderRadius: 10,
          fontSize: 10.5,
          fontWeight: 800,
          color: 'text.secondary',
          bgcolor: 'action.hover',
          flexShrink: 0
        }}
      >
        +{n}
      </Box>
    </Tooltip>
  );
}

// ----------------------------------------------------------------------------
// Estado do atendimento → etiqueta automática
// ----------------------------------------------------------------------------
const TONES = {
  bot: dual({ bgcolor: 'rgba(124,58,237,.12)', color: '#6D28D9' }, { bgcolor: 'rgba(167,139,250,.18)', color: '#C4B5FD' }),
  waiting: dual({ bgcolor: 'rgba(245,158,11,.15)', color: '#B45309' }, { bgcolor: 'rgba(251,191,36,.16)', color: '#FCD34D' }),
  human: dual({ bgcolor: 'rgba(37,99,235,.1)', color: '#1D4ED8' }, { bgcolor: 'rgba(96,165,250,.16)', color: '#93C5FD' }),
  gray: dual({ bgcolor: 'rgba(100,116,139,.13)', color: '#475569' }, { bgcolor: 'rgba(148,163,184,.14)', color: '#CBD5E1' })
};
export const WAIT_TONE = dual({ color: '#B45309' }, { color: '#FCD34D' });
// texto de chip/botão selecionado: verde-escuro no claro, verde WhatsApp no escuro (contraste)
export const ACTIVE_FG = dual({ color: '#128C7E' }, { color: '#25D366' });

/**
 * Descreve o atendimento de uma conversa individual.
 * compact = rótulo curto (lista/celular); senão rótulo completo (cabeçalho).
 * showClosed = mostra "Encerrado" (padrão: só no rótulo completo).
 */
export function serviceInfo(service, { myId, compact, showClosed } = {}) {
  const st = service?.status || 'none';
  const who = service?.assigned_user;
  if (st === 'bot') return { key: 'bot', label: 'Bot', tip: 'O bot está conduzindo esta conversa', icon: IconRobot, tone: TONES.bot };
  if (st === 'waiting')
    return { key: 'waiting', label: 'Na fila', tip: 'Aguardando um atendente assumir', icon: IconHourglassHigh, tone: TONES.waiting };
  if (st === 'human' && who) {
    const mine = myId && who.id === myId;
    const fn = firstName(who.name) || 'Atendente';
    return {
      key: 'human',
      label: compact ? fn : mine ? 'Em atendimento · você' : `Em atendimento · ${fn}`,
      tip: mine ? 'Em atendimento com você' : `Em atendimento com ${who.name || fn}`,
      icon: IconUser,
      tone: TONES.human
    };
  }
  if (st === 'human')
    return {
      key: 'phone',
      label: compact ? 'Celular' : 'Atendido pelo celular',
      tip: 'Respondido direto pelo celular, sem atendente no painel',
      icon: IconDeviceMobile,
      tone: TONES.gray
    };
  if (st === 'closed' && (showClosed ?? !compact))
    return { key: 'closed', label: 'Encerrado', tip: 'Atendimento encerrado', icon: IconCircleCheck, tone: TONES.gray };
  return null;
}

export function ServiceTag({ info, size = 'sm', sx }) {
  if (!info) return null;
  const Icon = info.icon;
  const sm = size === 'sm';
  return (
    <Tooltip title={info.tip} disableInteractive>
      <Box
        component="span"
        sx={[
          info.tone,
          {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.4,
            height: sm ? 18 : 22,
            px: sm ? 0.7 : 0.9,
            borderRadius: 10,
            fontSize: sm ? 10.5 : 11.5,
            fontWeight: 800,
            lineHeight: 1,
            flexShrink: 0,
            maxWidth: sm ? 110 : 220,
            whiteSpace: 'nowrap'
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
        ]}
      >
        <Icon size={sm ? 11 : 13} stroke={2.2} style={{ flexShrink: 0 }} />
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {info.label}
        </Box>
      </Box>
    </Tooltip>
  );
}
