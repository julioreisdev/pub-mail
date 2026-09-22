import { Box, Stack, Typography } from '@mui/material';

// Cores REAIS do Telegram (chat não segue o tema do app — é sempre igual).
// Fix do bug: antes usava t.palette.mode dentro de sx (congela no light no dark).
// Aqui usamos t.applyStyles('dark', …) sobre estas constantes.
const TG = {
    light: {
        wallpaper: '#c6d3e1',
        bubble: '#ffffff',
        text: '#1a1a1a',
        muted: 'rgba(0,0,0,0.5)',
        meta: 'rgba(0,0,0,0.45)',
        btnBg: 'rgba(0,0,0,0.05)',
        btnFg: '#2b7de0'
    },
    dark: {
        wallpaper: '#0e1621',
        bubble: '#182533',
        text: '#e6eef7',
        muted: 'rgba(255,255,255,0.5)',
        meta: 'rgba(255,255,255,0.42)',
        btnBg: 'rgba(255,255,255,0.08)',
        btnFg: '#8cc8ff'
    }
};

// helper: valor light + override dark (via applyStyles) para uma única propriedade
const dual = (prop, key) => (t) => ({ [prop]: TG.light[key], ...t.applyStyles('dark', { [prop]: TG.dark[key] }) });

// três bolinhas "digitando" (bounce) — indica a espera antes de enviar a mensagem
function TypingDots() {
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                '@keyframes tgTyping': {
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
                        bgcolor: TG.light.meta,
                        ...t.applyStyles('dark', { bgcolor: TG.dark.meta }),
                        animation: 'tgTyping 1.2s infinite ease-in-out',
                        animationDelay: `${i * 0.16}s`
                    })}
                />
            ))}
        </Box>
    );
}

// Preview de uma sequência de mensagens como balões do Telegram.
export default function TelegramMessagesPreview({ messages = [] }) {
    const valid = (messages || []).filter(
        (m) => (m?.text || '').trim() || m?.media?.url || (Array.isArray(m?.buttons) && m.buttons.some((b) => b?.label || b?.url))
    );
    return (
        <Box sx={(t) => ({ borderRadius: 3, p: 1.5, minHeight: 120, ...dual('bgcolor', 'wallpaper')(t) })}>
            {valid.length === 0 ? (
                <Typography variant="caption" sx={dual('color', 'muted')}>
                    Sem conteúdo ainda.
                </Typography>
            ) : (
                <Stack spacing={0.75} alignItems="flex-start">
                    {valid.map((m, i) => (
                        <Box
                            key={m.id || i}
                            sx={(t) => ({
                                maxWidth: '85%',
                                borderRadius: 2,
                                borderTopLeftRadius: 6,
                                px: 1.25,
                                py: 0.9,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                ...dual('bgcolor', 'bubble')(t)
                            })}
                        >
                            {m.media?.type === 'photo' && m.media.url ? (
                                <img src={m.media.url} alt="" style={{ maxWidth: 220, borderRadius: 8, display: 'block', marginBottom: m.text ? 6 : 0 }} />
                            ) : m.media?.type === 'video' && m.media.url ? (
                                <video src={m.media.url} controls style={{ maxWidth: 220, borderRadius: 8, display: 'block', marginBottom: m.text ? 6 : 0 }} />
                            ) : m.media?.type === 'voice' && m.media.url ? (
                                <audio src={m.media.url} controls style={{ height: 34, marginBottom: m.text ? 6 : 0 }} />
                            ) : m.media?.type ? (
                                <Box component="span" sx={(t) => ({ fontSize: 13, ...dual('color', 'meta')(t) })}>
                                    {{ document: '📎 Arquivo' }[m.media.type] || '📎 Mídia'}
                                </Box>
                            ) : null}
                            {m.text ? (
                                <Typography variant="body2" sx={(t) => ({ whiteSpace: 'pre-wrap', ...dual('color', 'text')(t) })}>
                                    {m.text}
                                </Typography>
                            ) : null}
                            {Array.isArray(m.buttons) && m.buttons.some((b) => b?.label || b?.url) ? (
                                <Stack spacing={0.4} sx={{ mt: 0.6 }}>
                                    {m.buttons
                                        .filter((b) => b?.label || b?.url)
                                        .map((b, bi) => (
                                            <Box
                                                key={b.id || bi}
                                                sx={(t) => ({
                                                    textAlign: 'center',
                                                    borderRadius: 1,
                                                    py: 0.5,
                                                    px: 1,
                                                    fontSize: 12.5,
                                                    fontWeight: 600,
                                                    ...dual('bgcolor', 'btnBg')(t),
                                                    ...dual('color', 'btnFg')(t)
                                                })}
                                            >
                                                {b.label || b.url}
                                            </Box>
                                        ))}
                                </Stack>
                            ) : null}
                            {m.delay_seconds ? (
                                <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.4 }}>
                                    <TypingDots />
                                    <Typography variant="caption" sx={dual('color', 'meta')}>
                                        {m.delay_seconds}s antes
                                    </Typography>
                                </Stack>
                            ) : null}
                        </Box>
                    ))}
                </Stack>
            )}
        </Box>
    );
}
