// src/views/email-marketing/components/ShareLeadsInterProjects.jsx
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import toast from 'react-hot-toast';

import useEmailProjects from '../../../hooks/useEmailProjects';
import { get } from '../../../api/api';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') => {
    return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
};

export default function ShareLeadsInterProjects() {
    const { emailProjects, isLoading, error, refresh } = useEmailProjects();

    const projects = useMemo(() => {
        if (!emailProjects) return [];
        if (Array.isArray(emailProjects)) return emailProjects;
        if (Array.isArray(emailProjects?.items)) return emailProjects.items;
        return [];
    }, [emailProjects]);

    const [open, setOpen] = useState(false);
    const [fromProjectId, setFromProjectId] = useState('');
    const [toProjectId, setToProjectId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) {
            setFromProjectId('');
            setToProjectId('');
            setLoading(false);
        }
    }, [open]);

    const canShare = !!fromProjectId && !!toProjectId && fromProjectId !== toProjectId && !loading && !isLoading && projects.length > 0;

    const handleOpen = () => {
        setOpen(true);
        refresh?.();
    };

    const handleClose = () => {
        if (loading) return;
        setOpen(false);
    };

    const handleShare = async () => {
        if (!canShare) return;

        setLoading(true);
        const toastId = 'share-leads-inter-projects';

        toast.loading('Compartilhando leads...', { id: toastId });

        try {
            await get(`/email/leads/share/${fromProjectId}/${toProjectId}`);

            toast.success('Leads compartilhados com sucesso!', { id: toastId });
            setOpen(false);
        } catch (e) {
            console.error(e);
            toast.error(getErrorMessage(e, 'Falha ao compartilhar leads'), { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const fromOptions = projects;
    const toOptions = useMemo(() => projects.filter((p) => p?.id !== fromProjectId), [projects, fromProjectId]);

    return (
        <>
            <Button
                onClick={handleOpen}
                variant="contained"
                size="small"
                color="inherit"
                startIcon={<ShareRoundedIcon fontSize="small" />}
                sx={{ borderRadius: 2 }}
                disabled={isLoading}
            >
                Compartilhar leads
            </Button>

            <Dialog open={open} onClose={loading ? undefined : handleClose} fullWidth maxWidth="sm">
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.15 }}>
                            Compartilhar leads
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Selecione o projeto de origem e o projeto de destino
                        </Typography>
                    </Box>

                    <Tooltip title="Fechar">
                        <span>
                            <IconButton onClick={handleClose} disabled={loading} size="small">
                                <CloseRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </DialogTitle>

                <DialogContent sx={{ pt: 2 }}>
                    {error ? (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {getErrorMessage(error, 'Falha ao carregar projetos')}
                        </Alert>
                    ) : null}

                    {projects.length < 2 && !isLoading ? (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Você precisa ter pelo menos <b>2 projetos</b> para compartilhar leads entre eles.
                        </Alert>
                    ) : null}

                    <Stack spacing={2}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                Projetos ({projects.length})
                            </Typography>
                            <Button onClick={refresh} disabled={isLoading || loading} size="small" variant="outlined" sx={{ borderRadius: 2 }}>
                                Atualizar
                            </Button>
                        </Stack>

                        <FormControl fullWidth disabled={isLoading || loading || projects.length === 0}>
                            <InputLabel id="from-project-label">Projeto de origem</InputLabel>
                            <Select
                                labelId="from-project-label"
                                label="Projeto de origem"
                                value={fromProjectId}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setFromProjectId(next);
                                    // se escolheram o mesmo, limpa o destino
                                    if (toProjectId === next) setToProjectId('');
                                }}
                            >
                                {fromOptions.map((p) => (
                                    <MenuItem key={p.id} value={p.id}>
                                        {p?.name || p.id}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth disabled={isLoading || loading || projects.length === 0 || !fromProjectId}>
                            <InputLabel id="to-project-label">Projeto de destino</InputLabel>
                            <Select
                                labelId="to-project-label"
                                label="Projeto de destino"
                                value={toProjectId}
                                onChange={(e) => setToProjectId(e.target.value)}
                            >
                                {toOptions.map((p) => (
                                    <MenuItem key={p.id} value={p.id}>
                                        {p?.name || p.id}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {fromProjectId && toProjectId && fromProjectId === toProjectId ? (
                            <Alert severity="warning">O projeto de origem e destino não podem ser o mesmo.</Alert>
                        ) : null}
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={handleClose} disabled={loading} variant="outlined">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleShare}
                        disabled={!canShare}
                        variant="contained"
                        color="secondary"
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ShareRoundedIcon fontSize="small" />}
                        sx={{ borderRadius: 2 }}
                    >
                        Compartilhar
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
