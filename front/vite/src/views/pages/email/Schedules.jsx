// src/views/email-marketing/components/Schedules.jsx
import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Stack,
    Typography,
    Tabs,
    Tab,
    Button,
    IconButton,
    Tooltip,
    Alert,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Skeleton,
    InputAdornment,
    TextField
} from '@mui/material';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';

import useSchedules from '../../../hooks/useSchedules';
import { post, patch, remove } from '../../../api/api';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') =>
    err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

const hourOptions = Array.from({ length: 24 }).map((_, h) => h);

/**
 * HTML <input type="date"> retorna "YYYY-MM-DD"
 * Prisma DateTime precisa ISO completo.
 */
const toISODateTime = (yyyyMMdd) => {
    if (!yyyyMMdd) return null;
    const parts = yyyyMMdd.split('-').map((v) => Number(v));
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    if (!y || !m || !d) return null;
    // UTC 00:00:00 para evitar problemas de fuso horário
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString();
};

const formatDateForInput = (isoOrDate) => {
    if (!isoOrDate) return '';
    try {
        const d = new Date(isoOrDate);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate() + 1).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    } catch {
        return '';
    }
};

const formatHumanDateTime = (iso) => {
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

function SchedulesSkeleton({ rows = 5 }) {
    return (
        <Stack spacing={1}>
            {Array.from({ length: rows }).map((_, i) => (
                <Box
                    key={i}
                    sx={{
                        p: 1.5,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper'
                    }}
                >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        <Skeleton variant="rounded" width={110} height={26} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton variant="text" width="38%" />
                            <Skeleton variant="text" width="22%" />
                        </Box>
                        <Skeleton variant="rounded" width={88} height={32} />
                    </Stack>
                </Box>
            ))}
        </Stack>
    );
}

function ConfirmDialog({ open, title, description, loading, onClose, onConfirm }) {
    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary">
                    {description}
                </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button variant="outlined" onClick={onClose} disabled={loading} sx={{ borderRadius: 2 }}>
                    Cancelar
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    onClick={onConfirm}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <DeleteRoundedIcon fontSize="small" />}
                    sx={{ borderRadius: 2, fontWeight: 900 }}
                >
                    Apagar
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/**
 * Upsert agora suporta 3 tipos:
 * - dailyMode: "Todos os dias"         => payload: { daily: true, time, date: null, for_x_days: null }
 * - specific day: "Dias específicos"  => payload: { daily: false, time, date: ISO, for_x_days: null }
 * - interval: "A cada X dias"         => payload: { time, for_x_days }  (sem date)
 */
function UpsertDialog({ open, mode, scheduleType, loading, error, initial, onClose, onSubmit }) {
    // scheduleType: 'daily' | 'specific' | 'interval'
    const [time, setTime] = useState(10);
    const [date, setDate] = useState('');
    const [forXDays, setForXDays] = useState(7);

    useEffect(() => {
        if (!open) return;

        setTime(Number.isFinite(initial?.time) ? Number(initial.time) : 10);
        setDate(formatDateForInput(initial?.date) || '');

        const fx = Number(initial?.for_x_days);
        setForXDays(Number.isFinite(fx) && fx > 0 ? fx : 7);
    }, [open, initial]);

    const canSubmit = useMemo(() => {
        if (!Number.isFinite(Number(time))) return false;

        if (scheduleType === 'daily') return true;
        if (scheduleType === 'specific') return Boolean(date);
        if (scheduleType === 'interval') return Number.isFinite(Number(forXDays)) && Number(forXDays) > 0;

        return false;
    }, [time, date, forXDays, scheduleType]);

    const handleSubmit = (e) => {
        e?.preventDefault?.();
        if (!canSubmit || loading) return;

        // 🔥 payloads conforme o tipo
        if (scheduleType === 'interval') {
            const payload = {
                time: Number(time),
                for_x_days: Number(forXDays),
                daily: false,
                date: null
            };
            onSubmit(payload);
            return;
        }

        const dailyMode = scheduleType === 'daily';

        const payload = {
            daily: Boolean(dailyMode),
            time: Number(time),
            date: dailyMode ? null : toISODateTime(date),
            for_x_days: null
        };

        onSubmit(payload);
    };

    const onKeyDownSubmit = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const title =
        scheduleType === 'interval'
            ? mode === 'create'
                ? 'Novo agendamento (intervalo)'
                : 'Editar agendamento (intervalo)'
            : mode === 'create'
                ? 'Novo agendamento'
                : 'Editar agendamento';

    const infoText =
        scheduleType === 'daily'
            ? 'Este agendamento roda todos os dias no horário definido.'
            : scheduleType === 'specific'
                ? 'Este agendamento roda apenas na data definida, no horário escolhido.'
                : 'Este agendamento roda a cada X dias, no horário definido.';

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    {title}
                </Typography>
                <IconButton onClick={onClose} disabled={loading} size="small">
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <Box component="form" onSubmit={handleSubmit}>
                <DialogContent sx={{ pt: 1.5 }}>
                    {error ? (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    ) : null}

                    <Stack spacing={2}>
                        <Alert severity="info">{infoText}</Alert>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Hora (0-23)"
                                select
                                SelectProps={{ native: true }}
                                value={time}
                                onChange={(e) => setTime(Number(e.target.value))}
                                onKeyDown={onKeyDownSubmit}
                                fullWidth
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <ScheduleRoundedIcon fontSize="small" />
                                        </InputAdornment>
                                    )
                                }}
                            >
                                {hourOptions.map((h) => (
                                    <option key={h} value={h}>
                                        {String(h).padStart(2, '0')}:00
                                    </option>
                                ))}
                            </TextField>

                            {scheduleType === 'specific' ? (
                                <TextField
                                    label="Data"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    onKeyDown={onKeyDownSubmit}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EventRoundedIcon fontSize="small" />
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            ) : null}

                            {scheduleType === 'interval' ? (
                                <TextField
                                    label="A cada X dias"
                                    type="number"
                                    value={forXDays}
                                    onChange={(e) => setForXDays(Number(e.target.value))}
                                    onKeyDown={onKeyDownSubmit}
                                    fullWidth
                                    inputProps={{ min: 1, step: 1 }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <AutorenewRoundedIcon fontSize="small" />
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            ) : null}
                        </Stack>
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ p: 2 }}>
                    <Button variant="outlined" onClick={onClose} disabled={loading} sx={{ borderRadius: 2 }}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        color="secondary"
                        disabled={!canSubmit || loading}
                        startIcon={loading ? <CircularProgress size={16} /> : <SaveRoundedIcon fontSize="small" />}
                        sx={{ borderRadius: 2, fontWeight: 900 }}
                    >
                        Salvar
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}

function ScheduleCard({ schedule, onEdit, onDelete, disableActions }) {
    const isInterval = Number(schedule?.for_x_days) > 0;

    const badge = isInterval ? (
        <Chip
            size="small"
            variant="outlined"
            color="secondary"
            icon={<AutorenewRoundedIcon sx={{ fontSize: 16 }} />}
            label={`A cada ${schedule?.for_x_days} dias`}
            sx={{ borderRadius: 2 }}
        />
    ) : schedule?.daily ? (
        <Chip
            size="small"
            variant="outlined"
            color="secondary"
            icon={<TodayRoundedIcon sx={{ fontSize: 16 }} />}
            label="Todos os dias"
            sx={{ borderRadius: 2 }}
        />
    ) : (
        <Chip
            size="small"
            variant="outlined"
            icon={<EventRoundedIcon sx={{ fontSize: 16 }} />}
            label="Dia específico"
            sx={{ borderRadius: 2 }}
        />
    );

    let when = '';
    if (isInterval) {
        when = `Às ${String(schedule?.time ?? 0).padStart(2, '0')}:00 • A cada ${schedule?.for_x_days} dias`;
    } else {
        when = `Às ${String(schedule?.time ?? 0).padStart(2, '0')}:00 ${schedule?.daily ? 'Todo dia' : `em ${schedule?.date?.split('T')[0]?.split('-').reverse().join('/')}`
            }`;
    }

    const lastRun = schedule?.last_run ? formatHumanDateTime(schedule.last_run) : null;

    return (
        <Box
            sx={{
                p: 1.5,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
            }}
        >
            <Stack direction="row" spacing={1.25} alignItems="center">
                {badge}

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                        {when}
                    </Typography>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.25 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            ID: {schedule?.id}
                        </Typography>
                        {lastRun ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                Última execução: {lastRun}
                            </Typography>
                        ) : null}
                    </Stack>
                </Box>

                <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Editar">
                        <span>
                            <IconButton size="small" disabled={disableActions} onClick={() => onEdit(schedule)} sx={{ borderRadius: 2 }}>
                                <EditRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Apagar">
                        <span>
                            <IconButton size="small" color="error" disabled={disableActions} onClick={() => onDelete(schedule)} sx={{ borderRadius: 2 }}>
                                <DeleteRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>
        </Box>
    );
}

/**
 * Props:
 * - projectSelected: { id, name, ... }
 */
export default function Schedules({ projectSelected }) {
    const projectId = projectSelected?.id || null;

    const { schedules, isLoading, error, refresh, mutate } = useSchedules(projectId);

    const list = useMemo(() => {
        if (!schedules) return [];
        if (Array.isArray(schedules)) return schedules;
        if (Array.isArray(schedules?.items)) return schedules.items;
        return [];
    }, [schedules]);

    /**
     * subTab:
     * 0 = daily
     * 1 = specific
     * 2 = interval (A cada X dias)
     */
    const [subTab, setSubTab] = useState(0);

    const filtered = useMemo(() => {
        if (subTab === 2) {
            return list.filter((s) => Number(s?.for_x_days) > 0);
        }

        const wantDaily = subTab === 0;
        // no daily/specific, exclui intervalos
        return list.filter((s) => Number(s?.for_x_days) <= 0 && Boolean(s?.daily) === wantDaily);
    }, [list, subTab]);

    const scheduleType = useMemo(() => {
        if (subTab === 0) return 'daily';
        if (subTab === 1) return 'specific';
        return 'interval';
    }, [subTab]);

    const basePath = useMemo(() => (projectId ? `/email/projects/${projectId}/schedules` : null), [projectId]);

    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');

    const [upsertOpen, setUpsertOpen] = useState(false);
    const [upsertMode, setUpsertMode] = useState('create'); // create | edit
    const [editingSchedule, setEditingSchedule] = useState(null);

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);

    useEffect(() => {
        setSubTab(0);
        setActionLoading(false);
        setActionError('');
        setUpsertOpen(false);
        setEditingSchedule(null);
        setConfirmOpen(false);
        setPendingDelete(null);
    }, [projectId]);

    const openCreate = () => {
        setUpsertMode('create');
        setEditingSchedule(null);
        setUpsertOpen(true);
    };

    const openEdit = (schedule) => {
        setUpsertMode('edit');
        setEditingSchedule(schedule);

        // Detecta tipo ao editar
        if (Number(schedule?.for_x_days) > 0) {
            setSubTab(2);
        } else {
            setSubTab(schedule?.daily ? 0 : 1);
        }

        setUpsertOpen(true);
    };

    const closeUpsert = () => {
        if (actionLoading) return;
        setUpsertOpen(false);
        setEditingSchedule(null);
    };

    const askDelete = (schedule) => {
        setPendingDelete(schedule);
        setConfirmOpen(true);
    };

    const doDelete = async () => {
        if (!basePath || !pendingDelete?.id) return;
        setActionLoading(true);
        setActionError('');
        try {
            await remove(`${basePath}/${pendingDelete.id}`);
            await mutate();
            setConfirmOpen(false);
            setPendingDelete(null);
        } catch (e) {
            setActionError(getErrorMessage(e, 'Falha ao apagar agendamento'));
        } finally {
            setActionLoading(false);
        }
    };

    const submitUpsert = async (payload) => {
        if (!basePath) return;
        setActionLoading(true);
        setActionError('');

        try {
            if (upsertMode === 'create') {
                // ✅ para interval: payload já é { time, for_x_days }
                // ✅ para daily/specific: payload já tem daily/date/time
                await post(basePath, payload);
            } else {
                // PATCH: mantém comportamento — backend decide o que atualizar
                await patch(`${basePath}/${editingSchedule?.id}`, payload);
            }

            await mutate();
            setUpsertOpen(false);
            setEditingSchedule(null);
        } catch (e) {
            setActionError(getErrorMessage(e, upsertMode === 'create' ? 'Falha ao criar agendamento' : 'Falha ao atualizar agendamento'));
        } finally {
            setActionLoading(false);
        }
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
                    Agendamentos
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Selecione um projeto para visualizar os agendamentos.
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 2 }}
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <ScheduleRoundedIcon fontSize="small" />
                    <Box>
                        <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
                            Agendamentos
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {filtered.length} exibidos
                        </Typography>
                    </Box>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                    <Tooltip title="Atualizar">
                        <span>
                            <IconButton
                                onClick={refresh}
                                disabled={isLoading || actionLoading}
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

                    <Button
                        onClick={openCreate}
                        variant="contained"
                        color="secondary"
                        startIcon={<AddRoundedIcon />}
                        sx={{ borderRadius: 2, fontWeight: 900 }}
                        disabled={actionLoading}
                    >
                        Novo agendamento
                    </Button>
                </Stack>
            </Stack>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs
                    value={subTab}
                    onChange={(_, v) => setSubTab(v)}
                    textColor="secondary"
                    indicatorColor="secondary"
                    sx={{
                        minHeight: 44,
                        '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 800 }
                    }}
                >
                    <Tab label="Todos os dias" />
                    <Tab label="Dias específicos" />
                    <Tab label="A cada X dias" />
                </Tabs>
            </Box>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {getErrorMessage(error, 'Falha ao carregar agendamentos')}
                </Alert>
            ) : null}

            {actionError ? (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
                    {actionError}
                </Alert>
            ) : null}

            {isLoading ? (
                <SchedulesSkeleton rows={5} />
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
                        Nenhum agendamento
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {subTab === 0
                            ? 'Crie um agendamento diário para automatizar seus disparos.'
                            : subTab === 1
                                ? 'Crie um agendamento para uma data específica.'
                                : 'Crie um agendamento por intervalo para rodar automaticamente a cada X dias.'}
                    </Typography>

                    <Button
                        onClick={openCreate}
                        variant="contained"
                        color="secondary"
                        startIcon={<AddRoundedIcon />}
                        sx={{ borderRadius: 2, fontWeight: 900 }}
                        disabled={actionLoading}
                    >
                        Criar agendamento
                    </Button>
                </Box>
            ) : (
                <Stack spacing={1}>
                    {filtered.map((s) => (
                        <ScheduleCard key={s.id} schedule={s} onEdit={openEdit} onDelete={askDelete} disableActions={actionLoading} />
                    ))}
                </Stack>
            )}

            <UpsertDialog
                open={upsertOpen}
                mode={upsertMode}
                scheduleType={scheduleType}
                loading={actionLoading}
                error={actionError}
                initial={editingSchedule}
                onClose={closeUpsert}
                onSubmit={submitUpsert}
            />

            <ConfirmDialog
                open={confirmOpen}
                title="Apagar agendamento?"
                description="Tem certeza que deseja apagar este agendamento? Essa ação não pode ser desfeita."
                loading={actionLoading}
                onClose={() => (actionLoading ? null : setConfirmOpen(false))}
                onConfirm={doDelete}
            />
        </Box>
    );
}
