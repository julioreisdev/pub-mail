import { useMemo, useState } from 'react';
import {
    Button,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Stack,
    Typography,
    IconButton,
    Radio,
    RadioGroup,
    FormControlLabel,
    Box,
    Alert,
    TextField,
    InputAdornment
} from '@mui/material';
import toast from 'react-hot-toast';
import { RocketLaunchRoundedIcon as RocketLaunchRoundedIcon } from 'ui-component/icons';
import { CloseRoundedIcon as CloseRoundedIcon } from 'ui-component/icons';
import { ShuffleRoundedIcon as ShuffleRoundedIcon } from 'ui-component/icons';
import { SearchRoundedIcon as SearchRoundedIcon } from 'ui-component/icons';

import { post } from '../../../api/api';
import useTemplatesPerProject from '../../../hooks/useTemplatesPerProject';

const getErrorMessage = (err, fallback = 'Ocorreu um erro') =>
    err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

const toList = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);

export function DispatchNowButton({ projectId, onDone }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [choice, setChoice] = useState('__random__'); // '__random__' | <templateId>
    const [query, setQuery] = useState('');

    const { templates, isLoading } = useTemplatesPerProject(open ? projectId : null, { recycle: false });
    const templateList = useMemo(() => toList(templates), [templates]);

    const filteredTemplates = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return templateList;
        return templateList.filter(
            (t) => `${t.name || ''} ${t.subject || ''}`.toLowerCase().includes(q)
        );
    }, [templateList, query]);

    const showSearch = templateList.length > 6;

    const handleOpen = () => {
        setChoice('__random__');
        setQuery('');
        setOpen(true);
    };

    const handleConfirm = async () => {
        if (!projectId || loading) return;
        setLoading(true);
        try {
            const body = choice === '__random__' ? {} : { template_id: choice };
            await post(`/email/projects/${projectId}/dispatch-now`, body);
            toast.success('Envio disparado com sucesso!');
            setOpen(false);
            onDone?.();
        } catch (e) {
            toast.error(getErrorMessage(e, 'Falha ao disparar envio agora'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                onClick={handleOpen}
                disabled={!projectId}
                variant="contained"
                color="secondary"
                startIcon={<RocketLaunchRoundedIcon fontSize="small" />}
                sx={{ borderRadius: 2 }}
            >
                Disparar Envio Agora!
            </Button>

            <Dialog open={open} onClose={loading ? undefined : () => setOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>Disparar envio agora</Typography>
                    <IconButton onClick={() => setOpen(false)} disabled={loading} size="small"><CloseRoundedIcon fontSize="small" /></IconButton>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Escolha o template para este disparo imediato aos leads inscritos.
                    </Typography>

                    {isLoading ? (
                        <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={22} /></Stack>
                    ) : (
                        <RadioGroup value={choice} onChange={(e) => setChoice(e.target.value)}>
                            <Box sx={{ border: '1px solid', borderColor: choice === '__random__' ? 'secondary.main' : 'divider', borderRadius: 2, px: 1.5, py: 0.5, mb: 1 }}>
                                <FormControlLabel
                                    value="__random__"
                                    control={<Radio size="small" color="secondary" />}
                                    label={
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <ShuffleRoundedIcon fontSize="small" color="secondary" />
                                            <Box>
                                                <Typography sx={{ fontWeight: 800 }}>Template aleatório</Typography>
                                                <Typography variant="caption" color="text.secondary">Sorteia entre os templates do projeto.</Typography>
                                            </Box>
                                        </Stack>
                                    }
                                />
                            </Box>

                            {templateList.length === 0 ? (
                                <Alert severity="warning" sx={{ borderRadius: 2 }}>Nenhum template neste projeto.</Alert>
                            ) : (
                                <Stack spacing={0.5}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mt: 0.5 }}>Ou um template específico:</Typography>
                                    {showSearch ? (
                                        <TextField
                                            size="small"
                                            fullWidth
                                            placeholder="Buscar template por nome ou assunto…"
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            sx={{ mb: 0.5 }}
                                            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
                                        />
                                    ) : null}
                                    {filteredTemplates.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>Nenhum template encontrado.</Typography>
                                    ) : null}
                                    <Box sx={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5, pr: 0.5 }}>
                                    {filteredTemplates.map((t) => (
                                        <Box key={t.id} sx={{ border: '1px solid', borderColor: choice === t.id ? 'secondary.main' : 'divider', borderRadius: 2, px: 1.5 }}>
                                            <FormControlLabel
                                                value={t.id}
                                                control={<Radio size="small" color="secondary" />}
                                                label={
                                                    <Box sx={{ py: 0.25 }}>
                                                        <Typography sx={{ fontWeight: 700 }} noWrap>{t.name}</Typography>
                                                        <Typography variant="caption" color="text.secondary" noWrap>{t.subject}</Typography>
                                                    </Box>
                                                }
                                                sx={{ width: '100%' }}
                                            />
                                        </Box>
                                    ))}
                                    </Box>
                                </Stack>
                            )}
                        </RadioGroup>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button variant="outlined" onClick={() => setOpen(false)} disabled={loading} sx={{ borderRadius: 2 }}>Cancelar</Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading || (choice === '__random__' && templateList.length === 0)}
                        variant="contained"
                        color="secondary"
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchRoundedIcon fontSize="small" />}
                        sx={{ borderRadius: 2, fontWeight: 900 }}
                    >
                        {loading ? 'Disparando…' : 'Disparar'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
