// =============================================================================
// Telegram UI kit — átomos compartilhados por TODAS as páginas/modais do módulo.
// Objetivo: uma só linguagem visual (nível Typebot). Dark-mode correto via
// theme.vars (NUNCA theme.palette em callback sx — congela no light).
// =============================================================================
import { forwardRef } from 'react';
import {
    Avatar,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    IconButton,
    Skeleton,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import { IconX, IconAlertTriangle, IconBrandTelegram } from '@tabler/icons-react';

import AuthImage from '../AuthImage';

// gradiente oficial do Telegram (usado em badges/avatars de marca)
export const TG_GRADIENT = 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)';

// tint theme-aware (troca no dark). token = 'primary' | 'success' | ...
const tint = (theme, token, a) => `rgba(${theme.vars.palette[token].mainChannel} / ${a})`;

// -----------------------------------------------------------------------------
// TgPageHeader — cabeçalho padrão de página (badge + título + subtítulo + ação)
// -----------------------------------------------------------------------------
export function TgPageHeader({ icon: Icon = IconBrandTelegram, title, subtitle, action, sx }) {
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
                    background: TG_GRADIENT,
                    boxShadow: (t) => `0 8px 20px ${tint(t, 'primary', 0.28)}`
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

// -----------------------------------------------------------------------------
// TgEmptyState — estado vazio rico (círculo tintado + título + subtexto + CTA)
// -----------------------------------------------------------------------------
export function TgEmptyState({ icon: Icon = IconBrandTelegram, title, description, action, dense, sx }) {
    return (
        <Box
            sx={{
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 3,
                py: dense ? 4 : 6,
                px: 3,
                textAlign: 'center',
                ...sx
            }}
        >
            <Stack spacing={dense ? 1.25 : 2} alignItems="center">
                <Box
                    sx={{
                        width: dense ? 56 : 72,
                        height: dense ? 56 : 72,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'primary.main',
                        bgcolor: (t) => tint(t, 'primary', 0.12)
                    }}
                >
                    <Icon size={dense ? 26 : 34} stroke={1.7} />
                </Box>
                <Stack spacing={0.5} alignItems="center">
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {title}
                    </Typography>
                    {description ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420 }}>
                            {description}
                        </Typography>
                    ) : null}
                </Stack>
                {action || null}
            </Stack>
        </Box>
    );
}

// -----------------------------------------------------------------------------
// TgCard — card base (borda sutil, sombra suave, hover) + accent opcional
// -----------------------------------------------------------------------------
export const TgCard = forwardRef(function TgCard({ accent, hover = true, onClick, children, sx }, ref) {
    return (
        <Box
            ref={ref}
            onClick={onClick}
            sx={{
                position: 'relative',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
                boxShadow: (t) => `0 1px 2px ${tint(t, 'primary', 0.04)}`,
                transition: 'box-shadow .16s ease, border-color .16s ease, transform .16s ease',
                ...(accent ? { borderLeft: '4px solid', borderLeftColor: accent } : {}),
                ...(onClick ? { cursor: 'pointer' } : {}),
                ...(hover
                    ? {
                          '&:hover': {
                              boxShadow: (t) => `0 6px 22px ${tint(t, 'primary', 0.12)}`,
                              borderColor: (t) => tint(t, 'primary', 0.35)
                          }
                      }
                    : {}),
                ...sx
            }}
        >
            {children}
        </Box>
    );
});

// -----------------------------------------------------------------------------
// TgStatusPill — pill de status com bolinha colorida
// -----------------------------------------------------------------------------
const STATUS_MAP = {
    active: { token: 'success', label: 'Ativo' },
    ok: { token: 'success', label: 'OK' },
    online: { token: 'success', label: 'Online' },
    inactive: { token: 'grey', label: 'Inativo' },
    paused: { token: 'grey', label: 'Pausado' },
    pending: { token: 'warning', label: 'Pendente' },
    flood: { token: 'warning', label: 'Em pausa' },
    banned: { token: 'error', label: 'Banido' },
    error: { token: 'error', label: 'Erro' }
};
export function TgStatusPill({ status = 'inactive', label, size = 'sm', sx }) {
    const cfg = STATUS_MAP[status] || STATUS_MAP.inactive;
    const token = cfg.token;
    const isGrey = token === 'grey';
    const dot = isGrey ? 'text.disabled' : `${token}.main`;
    const fg = isGrey ? 'text.secondary' : `${token}.main`;
    const small = size === 'sm';
    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                pl: small ? 0.85 : 1.1,
                pr: small ? 1.1 : 1.35,
                py: small ? 0.3 : 0.45,
                borderRadius: 5,
                bgcolor: (t) => (isGrey ? t.vars.palette.action.selected : tint(t, token, 0.14)),
                color: fg,
                fontSize: small ? 11 : 12.5,
                fontWeight: 700,
                lineHeight: 1,
                ...sx
            }}
        >
            <Box sx={{ width: small ? 6 : 7, height: small ? 6 : 7, borderRadius: '50%', bgcolor: dot }} />
            {label || cfg.label}
        </Box>
    );
}

// -----------------------------------------------------------------------------
// TgAvatar — avatar com foto (AuthImage) + fallback gradiente por tipo
// -----------------------------------------------------------------------------
const KIND_GRADIENT = {
    bot: 'linear-gradient(135deg, #2AABEE, #229ED9)',
    channel: 'linear-gradient(135deg, #2AABEE, #1E88E5)',
    group: 'linear-gradient(135deg, #7E57C2, #5E35B1)',
    contact: 'linear-gradient(135deg, #26A69A, #00897B)'
};
export function TgAvatar({ name, photoPath, size = 48, kind = 'contact', icon: Icon, sx }) {
    const initial = (name || '?').trim().charAt(0).toUpperCase();
    const fallback = (
        <Avatar
            sx={{
                width: size,
                height: size,
                background: KIND_GRADIENT[kind] || KIND_GRADIENT.contact,
                color: '#fff',
                fontWeight: 700,
                fontSize: size * 0.4,
                ...sx
            }}
        >
            {name ? initial : Icon ? <Icon size={size * 0.5} /> : initial}
        </Avatar>
    );
    if (!photoPath) return fallback;
    return <AuthImage path={photoPath} alt={name} size={size} fallback={fallback} />;
}

// -----------------------------------------------------------------------------
// TgFilterBar — barra de filtros "boxed" consistente
// -----------------------------------------------------------------------------
export function TgFilterBar({ children, sx }) {
    return (
        <Box
            sx={{
                mb: 2.5,
                p: 1.25,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
                ...sx
            }}
        >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }} flexWrap="wrap" useFlexGap>
                {children}
            </Stack>
        </Box>
    );
}

// -----------------------------------------------------------------------------
// TgGhostButton — botão-fantasma padrão (outlined discreto)
// -----------------------------------------------------------------------------
export const TgGhostButton = forwardRef(function TgGhostButton(props, ref) {
    const { sx, ...rest } = props;
    return (
        <Button
            ref={ref}
            variant="outlined"
            size="small"
            {...rest}
            sx={{ borderColor: 'divider', color: 'text.primary', textTransform: 'none', fontWeight: 600, borderRadius: 2, ...sx }}
        />
    );
});

// -----------------------------------------------------------------------------
// TgModal — shell de dialog com header sticky (título/subtítulo/tabs/X) e footer sticky
// -----------------------------------------------------------------------------
export function TgModal({ open, onClose, title, subtitle, tabs, footer, maxWidth = 'sm', children, disableClose }) {
    return (
        <Dialog
            open={open}
            onClose={() => !disableClose && onClose?.()}
            maxWidth={maxWidth}
            fullWidth
            PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
        >
            <Box
                sx={{
                    px: 3,
                    pt: 2.25,
                    pb: tabs ? 0 : 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    bgcolor: 'background.paper'
                }}
            >
                <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700 }} noWrap>
                            {title}
                        </Typography>
                        {subtitle ? (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                                {subtitle}
                            </Typography>
                        ) : null}
                    </Box>
                    <IconButton size="small" onClick={() => onClose?.()} disabled={disableClose} sx={{ mt: -0.5, mr: -0.5 }}>
                        <IconX size={18} />
                    </IconButton>
                </Stack>
                {tabs ? <Box sx={{ mt: 1 }}>{tabs}</Box> : null}
            </Box>

            <DialogContent sx={{ px: 3, py: 2.5 }}>{children}</DialogContent>

            {footer ? (
                <DialogActions sx={{ px: 3, py: 1.75, borderTop: '1px solid', borderColor: 'divider', position: 'sticky', bottom: 0, bgcolor: 'background.paper' }}>
                    {footer}
                </DialogActions>
            ) : null}
        </Dialog>
    );
}

// -----------------------------------------------------------------------------
// TgConfirmDialog — confirmação padrão (substitui window.confirm)
// -----------------------------------------------------------------------------
export function TgConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', danger, loading, icon: Icon = IconAlertTriangle }) {
    const token = danger ? 'error' : 'primary';
    return (
        <Dialog open={open} onClose={() => !loading && onClose?.()} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogContent sx={{ pt: 3, textAlign: 'center' }}>
                <Box
                    sx={{
                        width: 56,
                        height: 56,
                        mx: 'auto',
                        mb: 1.5,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        color: `${token}.main`,
                        bgcolor: (t) => tint(t, token, 0.14)
                    }}
                >
                    <Icon size={28} stroke={1.8} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.75 }}>
                    {title}
                </Typography>
                {message ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {message}
                    </Typography>
                ) : null}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'center', gap: 1 }}>
                <Button color="inherit" onClick={() => onClose?.()} disabled={loading} sx={{ textTransform: 'none' }}>
                    Cancelar
                </Button>
                <Button
                    variant="contained"
                    color={danger ? 'error' : 'primary'}
                    onClick={onConfirm}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={15} color="inherit" /> : null}
                    sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', minWidth: 120 }}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// -----------------------------------------------------------------------------
// Skeletons — no lugar de spinner nu no carregamento inicial
// -----------------------------------------------------------------------------
export function TgCardGridSkeleton({ count = 6, height = 150, columns = { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }) {
    return (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: columns }}>
            {Array.from({ length: count }).map((_, i) => (
                <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2, bgcolor: 'background.paper' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                        <Skeleton variant="circular" width={48} height={48} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton width="60%" height={20} />
                            <Skeleton width="40%" height={16} />
                        </Box>
                    </Stack>
                    <Skeleton variant="rounded" height={height - 96} />
                </Box>
            ))}
        </Box>
    );
}

export function TgListSkeleton({ rows = 6 }) {
    return (
        <Stack spacing={1.25}>
            {Array.from({ length: rows }).map((_, i) => (
                <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2, bgcolor: 'background.paper' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Skeleton variant="rounded" width={46} height={46} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton width="35%" height={20} />
                            <Skeleton width="55%" height={16} />
                        </Box>
                        <Skeleton variant="rounded" width={90} height={32} />
                    </Stack>
                </Box>
            ))}
        </Stack>
    );
}
