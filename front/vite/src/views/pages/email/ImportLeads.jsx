import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    LinearProgress,
    Stack,
    Typography
} from '@mui/material';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';

import { api } from '../../../api/api';

const monoFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

function prettyJSON(v) {
    try {
        return JSON.stringify(v ?? {}, null, 2);
    } catch {
        return String(v);
    }
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

export default function ImportLeads({ open, onClose, projectSelected, onImported }) {
    const fileInputRef = useRef(null);

    const projectId = projectSelected?.id || '';
    const projectName = projectSelected?.name || 'Projeto';

    const [file, setFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!open) return;
        setFile(null);
        setDragOver(false);
        setLoading(false);
        setErrorMsg('');
        setResult(null);
    }, [open, projectId]);

    const acceptLabel = useMemo(() => '.csv, .xlsx', []);
    const maxBytes = 10 * 1024 * 1024; // 10MB

    const validateFile = (f) => {
        if (!f) return 'Selecione um arquivo';
        const name = (f.name || '').toLowerCase();
        const okExt = name.endsWith('.csv') || name.endsWith('.xlsx');
        if (!okExt) return 'Formato inválido. Aceito apenas .csv ou .xlsx';
        if (f.size > maxBytes) return 'Arquivo muito grande. Tamanho máximo: 10MB';
        return '';
    };

    const handlePickFile = () => fileInputRef.current?.click();

    const handleFileChange = (e) => {
        const f = e?.target?.files?.[0] || null;
        if (!f) return;
        const err = validateFile(f);
        if (err) {
            setErrorMsg(err);
            setFile(null);
            return;
        }
        setErrorMsg('');
        setFile(f);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const f = e?.dataTransfer?.files?.[0] || null;
        if (!f) return;

        const err = validateFile(f);
        if (err) {
            setErrorMsg(err);
            setFile(null);
            return;
        }
        setErrorMsg('');
        setFile(f);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const submitImport = async (e) => {
        e?.preventDefault?.();
        if (loading) return;

        setErrorMsg('');
        setResult(null);

        const err = validateFile(file);
        if (err) {
            setErrorMsg(err);
            return;
        }
        if (!projectId) {
            setErrorMsg('ProjectId inválido.');
            return;
        }

        setLoading(true);

        try {
            const form = new FormData();
            form.append('file', file);

            const url = `/email/projects/${projectId}/import`;

            // IMPORTANTE: multipart/form-data -> usar `api` diretamente
            const { data } = await api.post(url, form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setResult(data ?? { ok: true });
            if (typeof onImported === 'function') onImported(data);
        } catch (err2) {
            const msg = err2?.response?.data?.message || err2?.response?.data?.error || err2?.message || 'Falha ao importar leads';
            setErrorMsg(msg);
        } finally {
            setLoading(false);
        }
    };

    const exampleCsv = `email,name,phone,origin,country
cliente@exemplo.com,Ana,5511999999999,site_institucional,BR
joao@exemplo.com,João,5511988887777,typeform,BR`;

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="lg">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        Importar Leads
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                        <Chip size="small" color="secondary" variant="outlined" label={projectName} />
                        {projectId ? <Chip size="small" variant="outlined" label={`Project ID: ${String(projectId).slice(0, 8)}…`} /> : null}
                    </Stack>
                </Stack>

                <IconButton onClick={onClose} disabled={loading} size="small">
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            {loading ? <LinearProgress /> : null}

            <Box component="form" onSubmit={submitImport}>
                <DialogContent sx={{ pt: 2 }}>
                    {errorMsg ? (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {errorMsg}
                        </Alert>
                    ) : null}

                    {result ? (
                        <Alert
                            severity="success"
                            sx={{ mb: 2 }}
                            action={
                                <Button
                                    size="small"
                                    color="inherit"
                                    startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                                    onClick={() => copyToClipboard(prettyJSON(result))}
                                >
                                    Copiar resultado
                                </Button>
                            }
                        >
                            Importação concluída.
                        </Alert>
                    ) : null}

                    <Stack spacing={2}>
                        <Box
                            onClick={handlePickFile}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            sx={{
                                borderRadius: 3,
                                border: '1px dashed',
                                borderColor: dragOver ? 'secondary.main' : 'divider',
                                bgcolor: dragOver ? 'action.hover' : 'background.paper',
                                p: { xs: 2, md: 2.5 },
                                cursor: 'pointer',
                                transition: 'all .15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 140
                            }}
                        >
                            <Stack spacing={0.75} alignItems="center" sx={{ textAlign: 'center' }}>
                                <UploadFileRoundedIcon color="secondary" />
                                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                    {file ? file.name : 'Clique ou arraste o arquivo aqui'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Aceita {acceptLabel} • Máximo 10MB
                                </Typography>
                            </Stack>
                        </Box>

                        <input ref={fileInputRef} type="file" hidden accept=".csv,.xlsx" onChange={handleFileChange} />

                        <Divider />

                        <Box
                            sx={{
                                borderRadius: 3,
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                p: 2
                            }}
                        >
                            <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
                                Layout esperado
                            </Typography>

                            <Stack spacing={1}>
                                <Typography variant="body2" color="text.secondary">
                                    <b>Obrigatório:</b> coluna <b>email</b> (variações aceitas: Email, EMAIL, e-mail, E-mail, E-mail Address)
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <b>Opcional:</b> coluna <b>name</b> (variações: Name, NOME, nome)
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <b>Extras:</b> qualquer outra coluna será salva automaticamente em <b>attributes</b> (JSON)
                                </Typography>

                                <Box
                                    sx={{
                                        mt: 1,
                                        borderRadius: 2.5,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.default',
                                        p: 1.5,
                                        overflow: 'auto'
                                    }}
                                >
                                    <Typography
                                        component="pre"
                                        sx={{
                                            m: 0,
                                            fontFamily: monoFont,
                                            fontSize: 12.5,
                                            lineHeight: 1.6,
                                            whiteSpace: 'pre'
                                        }}
                                    >
                                        {exampleCsv}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>

                        {result ? (
                            <Box
                                sx={{
                                    borderRadius: 3,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    p: 2
                                }}
                            >
                                <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
                                    Resultado da importação
                                </Typography>
                                <Box
                                    sx={{
                                        borderRadius: 2.5,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.default',
                                        p: 1.5,
                                        maxHeight: 260,
                                        overflow: 'auto'
                                    }}
                                >
                                    <Typography
                                        component="pre"
                                        sx={{
                                            m: 0,
                                            fontFamily: monoFont,
                                            fontSize: 12.5,
                                            lineHeight: 1.6,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }}
                                    >
                                        {prettyJSON(result)}
                                    </Typography>
                                </Box>
                            </Box>
                        ) : null}
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={onClose} disabled={loading} variant="outlined" sx={{ borderRadius: 2 }}>
                        Cancelar
                    </Button>

                    <Button type="submit" disabled={loading || !file} variant="contained" color="secondary" sx={{ borderRadius: 2, fontWeight: 900 }}>
                        Importar
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}
