import { Box, Stack, Typography } from '@mui/material';
import { IconChecks, IconFile, IconPlayerPlay, IconMicrophone } from '@tabler/icons-react';

import { mediaKind } from './waKit';

// ============================================================================
// Preview de mensagens como balões ENVIADOS do WhatsApp. Cores reais do
// WhatsApp (o chat não segue o tema do app) — light + override dark via
// t.applyStyles('dark', …), nunca t.palette.mode dentro de sx.
// ============================================================================
const WA = {
  light: {
    wallpaper: '#efeae2',
    bubble: '#d9fdd3',
    text: '#111b21',
    meta: 'rgba(17,27,33,0.45)',
    tick: '#53bdeb',
    muted: 'rgba(17,27,33,0.55)'
  },
  dark: {
    wallpaper: '#0b141a',
    bubble: '#005c4b',
    text: '#e9edef',
    meta: 'rgba(233,237,239,0.6)',
    tick: '#53bdeb',
    muted: 'rgba(233,237,239,0.55)'
  }
};
const dual = (prop, key) => (t) => ({ [prop]: WA.light[key], ...t.applyStyles('dark', { [prop]: WA.dark[key] }) });

// padrão de fundo bem sutil (pontos) por cima do wallpaper
const DOTS = 'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)';

const SAMPLE = { '{{nome}}': 'Maria', '{{telefone}}': '+55 11 99999-0000' };
const fill = (text, sample) =>
  String(text || '').replace(/\{\{\s*(nome|telefone)\s*\}\}/gi, (m, k) => sample[`{{${k.toLowerCase()}}}`] ?? '');

function TypingDots() {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        '@keyframes waTyping': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: 0.35 },
          '40%': { transform: 'translateY(-3px)', opacity: 1 }
        }
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          component="span"
          sx={(t) => ({
            width: 4,
            height: 4,
            borderRadius: '50%',
            ...dual('bgcolor', 'meta')(t),
            animation: 'waTyping 1.2s infinite ease-in-out',
            animationDelay: `${i * 0.16}s`
          })}
        />
      ))}
    </Box>
  );
}

const now = () => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());

export default function WhatsAppMessagesPreview({ messages = [], sample = SAMPLE, minHeight = 120 }) {
  const valid = (messages || []).filter((m) => (m?.text || '').trim() || m?.media?.url);
  const time = now();
  return (
    <Box
      sx={(t) => ({
        borderRadius: 3,
        p: 1.5,
        minHeight,
        backgroundImage: DOTS,
        backgroundSize: '14px 14px',
        ...dual('bgcolor', 'wallpaper')(t)
      })}
    >
      {valid.length === 0 ? (
        <Typography variant="caption" sx={dual('color', 'muted')}>
          Sem conteúdo ainda.
        </Typography>
      ) : (
        <Stack spacing={0.75} alignItems="flex-end">
          {valid.map((m, i) => {
            const kind = mediaKind(m.media);
            const text = fill(m.text, sample);
            return (
              <Box key={m.id || i} sx={{ maxWidth: '88%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {m.delay_seconds ? (
                  <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mb: 0.4, mr: 0.5 }}>
                    <TypingDots />
                    <Typography variant="caption" sx={(t) => ({ fontSize: 10.5, ...dual('color', 'meta')(t) })}>
                      {m.delay_seconds}s antes
                    </Typography>
                  </Stack>
                ) : null}
                <Box
                  sx={(t) => ({
                    position: 'relative',
                    borderRadius: 2,
                    borderTopRightRadius: 2,
                    px: 1,
                    pt: 0.75,
                    pb: 0.5,
                    boxShadow: '0 1px 1px rgba(0,0,0,0.13)',
                    ...dual('bgcolor', 'bubble')(t),
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
                  {kind === 'image' && m.media?.url ? (
                    <img
                      src={m.media.url}
                      alt=""
                      style={{ maxWidth: 230, width: '100%', borderRadius: 8, display: 'block', marginBottom: text ? 6 : 2 }}
                    />
                  ) : kind === 'video' && m.media?.url ? (
                    <Box sx={{ position: 'relative', mb: text ? 0.75 : 0.25 }}>
                      <video
                        src={m.media.url}
                        style={{ maxWidth: 230, width: '100%', borderRadius: 8, display: 'block', background: '#000' }}
                      />
                      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            bgcolor: 'rgba(0,0,0,0.45)',
                            display: 'grid',
                            placeItems: 'center'
                          }}
                        >
                          <IconPlayerPlay size={20} />
                        </Box>
                      </Box>
                    </Box>
                  ) : kind === 'voice' && m.media?.url ? (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: text ? 0.75 : 0.25, minWidth: 200 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          bgcolor: 'rgba(0,0,0,0.12)',
                          display: 'grid',
                          placeItems: 'center'
                        }}
                      >
                        <IconMicrophone size={16} />
                      </Box>
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', height: 22 }}>
                        {Array.from({ length: 28 }).map((_, k) => (
                          <Box
                            key={k}
                            sx={(t) => ({
                              width: 3,
                              borderRadius: 2,
                              height: 4 + ((k * 7) % 14),
                              ...dual('bgcolor', 'meta')(t)
                            })}
                          />
                        ))}
                      </Box>
                    </Stack>
                  ) : kind === 'document' && m.media?.url ? (
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ mb: text ? 0.75 : 0.25, p: 0.75, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.08)', minWidth: 180 }}
                    >
                      <IconFile size={22} />
                      <Typography variant="caption" noWrap sx={(t) => ({ fontWeight: 600, maxWidth: 170, ...dual('color', 'text')(t) })}>
                        {m.media.filename || 'Documento'}
                      </Typography>
                    </Stack>
                  ) : null}
                  {text ? (
                    <Typography
                      variant="body2"
                      sx={(t) => ({
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 13.5,
                        lineHeight: 1.35,
                        ...dual('color', 'text')(t)
                      })}
                    >
                      {text}
                    </Typography>
                  ) : null}
                  <Stack direction="row" spacing={0.4} alignItems="center" justifyContent="flex-end" sx={{ mt: 0.25 }}>
                    <Typography variant="caption" sx={(t) => ({ fontSize: 10.5, ...dual('color', 'meta')(t) })}>
                      {time}
                    </Typography>
                    <Box component="span" sx={{ display: 'inline-flex', color: WA.light.tick }}>
                      <IconChecks size={14} />
                    </Box>
                  </Stack>
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
