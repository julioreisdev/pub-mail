import { Fragment } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { IconChecks, IconFile, IconLock, IconMicrophone, IconPlayerPlay } from '@tabler/icons-react';

import { mediaKind } from '../waKit';

// ============================================================================
// Kit dos cards novos de WhatsApp → Configurações (atendimento, etiquetas,
// respostas rápidas, diagnóstico). Cores do WhatsApp nos balões seguem o app
// real (light + override dark via t.applyStyles), o resto usa tokens do tema.
// ============================================================================

export const WA_GREEN = '#25D366';
export const WA_DARK = '#128C7E';

export const cardSx = { p: { xs: 2, sm: 3 }, height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column' };

// texto de alerta legível nos dois temas (o warning do tema é amarelo-claro demais no light)
export const warnTextSx = (t) => ({ color: '#b45309', ...t.applyStyles('dark', { color: '#fbbf24' }) });

export const errText = (e, fb) => {
  const status = e?.response?.status;
  const m = e?.response?.data?.message ?? e?.message;
  if (status === 503) return 'O gateway do WhatsApp está indisponível no momento. Tente de novo em instantes.';
  if (status === 403) return 'Só o dono ou um admin da organização pode fazer isso.';
  if (Array.isArray(m)) return m.join(' | ');
  return String(m || fb || 'Falha na operação.');
};

export const plural = (n, one, many) => `${(Number(n) || 0).toLocaleString('pt-BR')} ${Number(n) === 1 ? one : many}`;

// ----------------------------------------------------------------------------
// Cabeçalho padrão dos cards (mesmo desenho do "Motor de conexão")
// ----------------------------------------------------------------------------
// `stackAction`: no celular a ação (botão) desce para a linha de baixo, alinhada ao título.
export function SettingsCardHeader({ icon: Icon, title, subtitle, action, stackAction, sx }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{ mb: 2, columnGap: 1.25, rowGap: 1, flexWrap: stackAction ? { xs: 'wrap', sm: 'nowrap' } : 'nowrap', ...sx }}
    >
      <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', flexShrink: 0 }}>
        <Icon size={20} />
      </Box>
      <Box sx={{ flex: 1, minWidth: stackAction ? { xs: 'calc(100% - 46px)', sm: 0 } : 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>{title}</Typography>
        {subtitle ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action ? <Box sx={{ flexShrink: 0, ml: stackAction ? { xs: '46px', sm: 0 } : 0 }}>{action}</Box> : null}
    </Stack>
  );
}

export function ReadOnlyChip({ label = 'Somente leitura' }) {
  return (
    <Chip
      size="small"
      icon={<IconLock size={13} />}
      label={label}
      variant="outlined"
      sx={{ fontWeight: 700, color: 'text.secondary', '& .MuiChip-icon': { color: 'text.secondary' } }}
    />
  );
}

// ----------------------------------------------------------------------------
// Formatação do WhatsApp (*negrito*, _itálico_, ~riscado~, ```mono```) → nós React
// ----------------------------------------------------------------------------
const WA_FMT = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

export function formatWa(text) {
  const src = String(text || '');
  const parts = src.split(WA_FMT);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('```') && part.endsWith('```') && part.length > 6) {
      return (
        <Box key={i} component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.92em' }}>
          {part.slice(3, -3)}
        </Box>
      );
    }
    const mark = part[0];
    if (part.length > 2 && part.endsWith(mark) && ['*', '_', '~'].includes(mark)) {
      const inner = formatWa(part.slice(1, -1));
      if (mark === '*') return <strong key={i}>{inner}</strong>;
      if (mark === '_') return <em key={i}>{inner}</em>;
      return <s key={i}>{inner}</s>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

// ----------------------------------------------------------------------------
// Balão enviado do WhatsApp (preview). Cores reais do WhatsApp nos dois temas.
// ----------------------------------------------------------------------------
const WA = {
  light: { wallpaper: '#efeae2', bubble: '#d9fdd3', text: '#111b21', meta: 'rgba(17,27,33,0.45)', soft: 'rgba(0,0,0,0.07)' },
  dark: { wallpaper: '#0b141a', bubble: '#005c4b', text: '#e9edef', meta: 'rgba(233,237,239,0.6)', soft: 'rgba(255,255,255,0.08)' }
};
const waDual = (prop, key) => (t) => ({ [prop]: WA.light[key], ...t.applyStyles('dark', { [prop]: WA.dark[key] }) });
const DOTS = 'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)';
const nowHHMM = () => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());

export function WaWallpaper({ children, minHeight = 0, sx }) {
  return (
    <Box
      sx={[
        (t) => ({
          borderRadius: 2.5,
          p: 1.5,
          minHeight,
          backgroundImage: DOTS,
          backgroundSize: '14px 14px',
          ...waDual('bgcolor', 'wallpaper')(t)
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
    >
      {children}
    </Box>
  );
}

function BubbleMedia({ media, hasText }) {
  const kind = mediaKind(media);
  const mb = hasText ? 0.75 : 0.25;
  if (kind === 'image' && media?.url) {
    return (
      <Box
        component="img"
        src={media.url}
        alt=""
        sx={{ maxWidth: 230, width: '100%', borderRadius: 1.5, display: 'block', mb, objectFit: 'cover', maxHeight: 180 }}
      />
    );
  }
  if (kind === 'video' && media?.url) {
    return (
      <Box sx={{ position: 'relative', mb, maxWidth: 230 }}>
        <Box
          component="video"
          src={media.url}
          muted
          preload="metadata"
          sx={{ width: '100%', borderRadius: 1.5, display: 'block', bgcolor: '#000', maxHeight: 180 }}
        />
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center' }}>
            <IconPlayerPlay size={20} />
          </Box>
        </Box>
      </Box>
    );
  }
  if (kind === 'voice') {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb, minWidth: 190 }}>
        <Box
          sx={(t) => ({
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            ...waDual('bgcolor', 'soft')(t)
          })}
        >
          <IconMicrophone size={16} />
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', height: 22 }}>
          {Array.from({ length: 26 }).map((_, k) => (
            <Box key={k} sx={(t) => ({ width: 3, borderRadius: 2, height: 4 + ((k * 7) % 14), ...waDual('bgcolor', 'meta')(t) })} />
          ))}
        </Box>
      </Stack>
    );
  }
  if (media) {
    return (
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={(t) => ({ mb, p: 0.75, borderRadius: 1.5, minWidth: 170, ...waDual('bgcolor', 'soft')(t) })}
      >
        <IconFile size={22} />
        <Typography variant="caption" noWrap sx={{ fontWeight: 600, maxWidth: 170, color: 'inherit' }}>
          {media.filename || 'Documento'}
        </Typography>
      </Stack>
    );
  }
  return null;
}

/** Balão "enviado" com formatação do WhatsApp. `text` já vem com variáveis resolvidas. */
export function WaBubble({ text, media, time, maxWidth = '88%' }) {
  const hasText = Boolean(String(text || '').trim());
  return (
    <Box
      sx={(t) => ({
        position: 'relative',
        alignSelf: 'flex-end',
        maxWidth,
        borderRadius: 2,
        borderTopRightRadius: 2,
        px: 1,
        pt: 0.75,
        pb: 0.5,
        boxShadow: '0 1px 1px rgba(0,0,0,0.13)',
        // uma única chamada de applyStyles: duas espalhadas no mesmo objeto colidem na mesma chave (seletor dark)
        bgcolor: WA.light.bubble,
        color: WA.light.text,
        ...t.applyStyles('dark', { bgcolor: WA.dark.bubble, color: WA.dark.text }),
        '&:after': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: -7,
          width: 0,
          height: 0,
          borderTop: '8px solid',
          borderTopColor: WA.light.bubble,
          borderRight: '8px solid transparent',
          ...t.applyStyles('dark', { borderTopColor: WA.dark.bubble })
        }
      })}
    >
      <BubbleMedia media={media} hasText={hasText} />
      {hasText ? (
        <Typography
          component="div"
          variant="body2"
          sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13.5, lineHeight: 1.4, color: 'inherit' }}
        >
          {formatWa(text)}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={0.4} alignItems="center" justifyContent="flex-end" sx={{ mt: 0.25 }}>
        <Typography variant="caption" sx={(t) => ({ fontSize: 10.5, ...waDual('color', 'meta')(t) })}>
          {time || nowHHMM()}
        </Typography>
        <Box component="span" sx={{ display: 'inline-flex', color: '#53bdeb' }}>
          <IconChecks size={14} />
        </Box>
      </Stack>
    </Box>
  );
}

// ----------------------------------------------------------------------------
// Inserir texto no cursor de um <input>/<textarea> controlado
// ----------------------------------------------------------------------------
export function insertAtCursor(inputEl, current, snippet, max = Infinity) {
  const value = String(current || '');
  const start = inputEl?.selectionStart ?? value.length;
  const end = inputEl?.selectionEnd ?? value.length;
  const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`.slice(0, max);
  const caret = Math.min(start + snippet.length, next.length);
  window.requestAnimationFrame(() => {
    if (!inputEl) return;
    inputEl.focus();
    try {
      inputEl.setSelectionRange(caret, caret);
    } catch {
      /* input sem seleção */
    }
  });
  return next;
}
