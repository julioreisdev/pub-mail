// src/views/email-marketing/components/Sents.jsx
import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Stack,
    Typography,
    IconButton,
    Tooltip,
    Alert,
    Chip,
    Skeleton,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Snackbar,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';

import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SubjectRoundedIcon from '@mui/icons-material/SubjectRounded';
import TextSnippetRoundedIcon from '@mui/icons-material/TextSnippetRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';

import useSchedulesSents from '../../../hooks/useSchedulesSents';
import { DispatchNowButton } from './DispatchNowButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import OpenRateMini from './OpenRateMini';

const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') =>
    err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

const pad2 = (n) => String(n).padStart(2, '0');

const formatDateTime = (iso) => {
    if (!iso) return '-';
    try {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(iso));
    } catch {
        return '-';
    }
};

// ✅ Para datas "de dia" vindas como ISO com UTC (ex: 2026-02-19T00:00:00.000Z)
// usamos o "YYYY-MM-DD" do início do ISO para não converter timezone e cair um dia antes.
const formatIsoDateOnlyFromString = (iso) => {
    if (!iso) return null;
    const s = String(iso);
    const ymd = s.includes('T') ? s.split('T')[0] : s;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
};

const isSameLocalDate = (iso, y, m, d) => {
    if (!iso) return false;
    const dt = new Date(iso);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
};

function SentsSkeleton({ rows = 6 }) {
    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.25
            }}
        >
            {Array.from({ length: rows }).map((_, i) => (
                <Box
                    key={i}
                    sx={{
                        flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 10px)', lg: '1 1 calc(33.333% - 10px)' },
                        maxWidth: { xs: '100%', sm: 'calc(50% - 10px)', lg: 'calc(33.333% - 10px)' },
                        p: 1.75,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        minHeight: 210
                    }}
                >
                    <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Skeleton variant="rounded" width={110} height={26} />
                            <Skeleton variant="rounded" width={90} height={26} />
                        </Stack>
                        <Skeleton variant="text" width="70%" />
                        <Skeleton variant="text" width="45%" />
                        <Skeleton variant="text" width="90%" />
                    </Stack>
                </Box>
            ))}
        </Box>
    );
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch {
            return false;
        }
    }
}

function ContentDialog({ open, onClose, title, content }) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    {title}
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 1 }}>
                <Box
                    sx={{
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        p: 1.5,
                        maxHeight: 520,
                        overflow: 'auto'
                    }}
                >
                    <Typography component="pre" sx={{ m: 0, fontFamily: monoFont, fontSize: 12.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {content || ''}
                    </Typography>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} variant="contained" color="secondary" sx={{ borderRadius: 2, fontWeight: 900 }}>
                    Fechar
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function getScheduleType(sentItem) {
    if (!sentItem?.schedule_id && !sentItem?.schedule_date && !sentItem?.schedule_time) return 'Manual';
    if (sentItem?.schedule_daily) return 'Diário';
    if (sentItem?.schedule_date && sentItem?.schedule_time) return 'Dia específico';
    return 'Intervalo';
}

function getScheduleChip(sentItem) {
    const type = getScheduleType(sentItem);

    if (type === 'Diário') {
        return { label: 'Diário', icon: <TodayRoundedIcon sx={{ fontSize: 16 }} />, color: 'secondary' };
    }

    if (type === 'Manual') {
        return { label: 'Manual', icon: <PlayArrowIcon sx={{ fontSize: 16 }} />, color: 'default' };
    }
    if (type === 'Dia específico') {
        return { label: 'Dia específico', icon: <EventRoundedIcon sx={{ fontSize: 16 }} />, color: 'default' };
    }
    return { label: 'Intervalo', icon: <AutorenewRoundedIcon sx={{ fontSize: 16 }} />, color: 'default' };
}

function SentCard({ sentItem, onOpenBody, onCopy, disableActions }) {
    const statusSent = sentItem?.status;

    const statusMeta =
        statusSent === 'COMPLETED'
            ? { label: 'Concluído', icon: <MarkEmailReadRoundedIcon sx={{ fontSize: 16 }} />, color: 'secondary' }
            : statusSent === 'PROCESSING' && sentItem?.subject
                ? { label: 'Processando', icon: <ScheduleRoundedIcon sx={{ fontSize: 16 }} />, color: 'default' }
                : statusSent === 'PARTIAL'
                    ? { label: 'Parcial', icon: <MarkEmailReadRoundedIcon sx={{ fontSize: 16 }} />, color: 'warning' }
                    : statusSent === 'FAILED' || !sentItem?.subject
                        ? { label: 'Falhou', icon: <ErrorOutlineRoundedIcon sx={{ fontSize: 16 }} />, color: 'error' }
                        : { label: 'Desconhecido', icon: <ErrorOutlineRoundedIcon sx={{ fontSize: 16 }} />, color: 'default' };

    const scheduleMeta = getScheduleChip(sentItem);

    const scheduleTime =
        Number.isFinite(Number(sentItem?.schedule_time)) && sentItem?.schedule_time !== null ? Number(sentItem.schedule_time) : null;

    const when = (() => {
        const type = getScheduleType(sentItem);
        const day = type === 'Dia específico' ? formatIsoDateOnlyFromString(sentItem?.schedule_date) : null;
        const hour = scheduleTime !== null ? `${pad2(scheduleTime)}:00` : null;

        if (type === 'Diário' && hour) return `Diário • ${hour}`;
        if (type === 'Dia específico' && day && hour) return `Dia específico • ${day} • ${hour}`;
        if (type === 'Dia específico' && day) return `Dia específico • ${day}`;
        if (type === 'Intervalo' && hour) return `Intervalo • ${hour}`;
        return `${type}`;
    })();

    const runAt = sentItem?.run_at || sentItem?.created_at || null;
    const runAtLabel = formatDateTime(runAt);

    const title = sentItem?.subject ? String(sentItem.subject) : 'Disparo não concluído';

    const totals =
        Number.isFinite(Number(sentItem?.total_leads)) || Number.isFinite(Number(sentItem?.sent_for_leads))
            ? `${sentItem?.sent_for_leads ?? 0}/${sentItem?.total_leads ?? 0} leads`
            : null;

    const hasHtml = Boolean(sentItem?.body_html);
    const hasText = Boolean(sentItem?.body_text);
    const errorMsg = sentItem?.error_message ? String(sentItem.error_message) : null;

    return (
        <Box
            sx={{
                p: 1.75,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                minHeight: 210, // ✅ tamanho fixo
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* ✅ Destaque primeiro: tipo + dia + hora */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', mb: 1 }}>
                <Chip
                    size="small"
                    variant="outlined"
                    color={scheduleMeta.color === 'secondary' ? 'secondary' : 'default'}
                    icon={scheduleMeta.icon}
                    label={scheduleMeta.label}
                    sx={{ borderRadius: 2, fontWeight: 900 }}
                />
                <Chip
                    size="small"
                    color={statusMeta.color}
                    variant="filled"
                    icon={statusMeta.icon}
                    label={statusMeta.label}
                    sx={{ borderRadius: 2, fontWeight: 900 }}
                />
                {totals ? <Chip size="small" variant="outlined" label={totals} sx={{ borderRadius: 2, fontWeight: 800 }} /> : null}
            </Stack>
            <Typography variant="subtitle1" sx={{ fontWeight: 950, lineHeight: 1.15 }} noWrap title={title}>
                {title}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 900, mt: 0.35 }}>
                {when}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <AccessTimeRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                        {runAtLabel}
                    </Typography>
                </Stack>

                <Typography variant="caption" color="text.secondary">
                    •
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                    ID: {sentItem?.id}
                </Typography>
            </Stack>
            <Box sx={{ flex: 1 }} />
            {errorMsg ? (
                <Box sx={{ mt: 1 }}>
                    <Alert
                        severity="error"
                        variant="outlined"
                        sx={{
                            borderRadius: 2,
                            py: 0.75,
                            '& .MuiAlert-message': { width: '100%' }
                        }}
                    >
                        <Typography variant="caption" sx={{ fontWeight: 900, display: 'block' }}>
                            Erro
                        </Typography>
                        <Typography variant="caption">{errorMsg}</Typography>
                    </Alert>
                </Box>
            ) : null}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <OpenRateMini total={sentItem?.total_leads || 0} open={sentItem?.open_count || 0} />
                <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                    {hasHtml ? (
                        <Tooltip title="Ver HTML">
                            <span>
                                <IconButton
                                    size="small"
                                    disabled={disableActions}
                                    onClick={() => onOpenBody({ type: 'HTML', content: sentItem?.body_html || '' })}
                                    sx={{ borderRadius: 2 }}
                                >
                                    <CodeRoundedIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    ) : null}

                    {hasText ? (
                        <Tooltip title="Ver Texto">
                            <span>
                                <IconButton
                                    size="small"
                                    disabled={disableActions}
                                    onClick={() => onOpenBody({ type: 'Texto', content: sentItem?.body_text || '' })}
                                    sx={{ borderRadius: 2 }}
                                >
                                    <TextSnippetRoundedIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    ) : null}

                    <Tooltip title="Copiar assunto">
                        <span>
                            <IconButton size="small" disabled={disableActions} onClick={() => onCopy(title, 'Assunto')} sx={{ borderRadius: 2 }}>
                                <SubjectRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>

                    <Tooltip title="Copiar conteúdo (melhor esforço)">
                        <span>
                            <IconButton
                                size="small"
                                disabled={disableActions || (!hasHtml && !hasText)}
                                onClick={() => onCopy(sentItem?.body_html || sentItem?.body_text || '', 'Conteúdo')}
                                sx={{ borderRadius: 2 }}
                            >
                                <ContentCopyRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </Box>
            <Typography color="primary" variant="caption" sx={{ fontWeight: 900, display: 'block' }}>
                Cliques em CTAs: {sentItem?.click_cta_count || 0}
            </Typography>
        </Box>
    );
}

/**
 * Props:
 * - projectSelected: { id, name, ... }
 *
 * Uso:
 * <Sents projectSelected={project} />
 *
 * Hook:
 * const { sents, isLoading, error, refresh } = useSchedulesSents(projectId);
 */
export default function Sents({ projectSelected }) {
    const projectId = projectSelected?.id || null;
    const { sents, isLoading, error, refresh } = useSchedulesSents(projectId);

    const list = useMemo(() => {
        if (!sents) return [];
        if (Array.isArray(sents)) return sents;
        if (Array.isArray(sents?.items)) return sents.items;
        return [];
    }, [sents]);

    const last10 = useMemo(() => {
        const copy = [...list];
        copy.sort((a, b) => {
            const da = new Date(a?.run_at || a?.created_at || 0).getTime();
            const db = new Date(b?.run_at || b?.created_at || 0).getTime();
            return db - da;
        });
        return copy.slice(0, 10);
    }, [list]);

    const [filter, setFilter] = useState('all');

    useEffect(() => {
        setFilter('all');
    }, [projectId]);

    const filtered = useMemo(() => {
        if (!last10.length) return [];

        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = now.getDate();

        const yest = new Date(now);
        yest.setDate(d - 1);

        const yy = yest.getFullYear();
        const ym = yest.getMonth();
        const yd = yest.getDate();

        return last10.filter((it) => {
            const ts = it?.run_at || it?.created_at || null;

            if (filter === 'failed') return !it?.sent;
            if (filter === 'today') return isSameLocalDate(ts, y, m, d);
            if (filter === 'yesterday') return isSameLocalDate(ts, yy, ym, yd);
            return true;
        });
    }, [last10, filter]);

    const [contentDialog, setContentDialog] = useState({ open: false, title: '', content: '' });
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    useEffect(() => {
        if (!projectId) {
            setContentDialog({ open: false, title: '', content: '' });
        }
    }, [projectId]);

    const handleOpenBody = ({ type, content }) => {
        setContentDialog({
            open: true,
            title: `Conteúdo do envio (${type})`,
            content: content || ''
        });
    };

    const handleCopy = async (text, label) => {
        const ok = await copyToClipboard(text || '');
        setSnack({
            open: true,
            msg: ok ? `${label} copiado!` : `Não foi possível copiar ${label}.`,
            severity: ok ? 'success' : 'error'
        });
    };

    if (!projectId) {
        return (
            <Box
                sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px dashed',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    textAlign: 'center'
                }}
            >
                <Typography variant="h6" sx={{ mb: 0.5 }}>
                    Envios
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Selecione um projeto para visualizar os envios.
                </Typography>
            </Box>
        );
    }

    return (
        <>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 2 }}
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <MarkEmailReadRoundedIcon fontSize="small" />
                    <Box>
                        <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
                            Envios
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {isLoading ? 'Carregando...' : `Últimos ${last10.length} envios`}
                        </Typography>
                    </Box>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                    <DispatchNowButton projectId={projectId} onDone={() => refresh()} />
                    <FormControl size="small" sx={{ minWidth: 210 }}>
                        <InputLabel id="sents-filter-label">Filtro</InputLabel>
                        <Select
                            labelId="sents-filter-label"
                            value={filter}
                            label="Filtro"
                            onChange={(e) => setFilter(e.target.value)}
                            sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
                        >
                            <MenuItem value="all">Últimos 10</MenuItem>
                            <MenuItem value="failed">Envios que falharam</MenuItem>
                            <MenuItem value="today">Envios hoje</MenuItem>
                            <MenuItem value="yesterday">Envios ontem</MenuItem>
                        </Select>
                    </FormControl>

                    <Tooltip title="Atualizar">
                        <span>
                            <IconButton
                                onClick={refresh}
                                disabled={isLoading}
                                size="small"
                                sx={{
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper'
                                }}
                            >
                                <RefreshRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {getErrorMessage(error, 'Falha ao carregar envios')}
                </Alert>
            ) : null}

            {isLoading ? (
                <SentsSkeleton rows={6} />
            ) : filtered.length === 0 ? (
                <Box
                    sx={{
                        p: 3,
                        borderRadius: 3,
                        border: '1px dashed',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        textAlign: 'center'
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 0.5 }}>
                        Nenhum envio encontrado
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {filter === 'failed'
                            ? 'Nenhum envio falhou nos últimos 10 registros.'
                            : filter === 'today'
                                ? 'Nenhum envio hoje nos últimos 10 registros.'
                                : filter === 'yesterday'
                                    ? 'Nenhum envio ontem nos últimos 10 registros.'
                                    : 'Quando houver disparos (agendamentos), os envios aparecerão aqui.'}
                    </Typography>
                </Box>
            ) : (
                <Box
                    sx={{
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        p: 1.5,
                        maxHeight: 640,
                        overflow: 'auto'
                    }}
                >
                    {/* ✅ Flex + space-between: 3 por linha (lg), 2 (sm/md), 1 (xs) */}
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 1.25
                        }}
                    >
                        {filtered.map((s) => (
                            <Box
                                key={s.id}
                                sx={{
                                    flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 10px)', lg: '1 1 calc(33.333% - 10px)' },
                                    maxWidth: { xs: '100%', sm: 'calc(50% - 10px)', lg: 'calc(33.333% - 10px)' }
                                }}
                            >
                                <SentCard sentItem={s} onOpenBody={handleOpenBody} onCopy={handleCopy} disableActions={isLoading} />
                            </Box>
                        ))}
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Typography variant="caption" color="text.secondary">
                        Exibindo somente os 10 envios mais recentes.
                    </Typography>
                </Box>
            )}

            <ContentDialog
                open={contentDialog.open}
                title={contentDialog.title}
                content={contentDialog.content}
                onClose={() => setContentDialog({ open: false, title: '', content: '' })}
            />

            <Snackbar open={snack.open} autoHideDuration={2200} onClose={() => setSnack((s) => ({ ...s, open: false }))} message={snack.msg} />
        </>
    );
}
