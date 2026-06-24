import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Stack,
    TextField,
    Typography
} from '@mui/material';
import toast from 'react-hot-toast';

import { get, put } from '../../../api/api';

function getErrorMessage(error, fallback = 'Não foi possível carregar as credenciais.') {
    const message = error?.response?.data?.message ?? error?.message;
    if (Array.isArray(message)) return message.join(' | ');
    return String(message || fallback);
}

function formatDateTime(value) {
    if (!value) return '-';
    try {
        return new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(new Date(value));
    } catch {
        return String(value);
    }
}

export default function SocialApiKeysManager() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState('');

    const [clientKey, setClientKey] = useState('');
    const [clientSecret, setClientSecret] = useState('');

    const [hasCustomCredentials, setHasCustomCredentials] = useState(false);
    const [hasClientSecret, setHasClientSecret] = useState(false);
    const [secretMasked, setSecretMasked] = useState('');
    const [updatedAt, setUpdatedAt] = useState('');

    const loadCredentials = useCallback(async () => {
        setIsLoading(true);
        setError('');

        try {
            const response = await get('/social-accounts/app-credentials/tiktok');
            const hasCustom = Boolean(response?.has_custom_credentials);
            setClientKey(response?.client_key || '');
            setClientSecret(hasCustom ? response?.client_secret_masked || '' : '');
            setHasCustomCredentials(hasCustom);
            setHasClientSecret(Boolean(response?.has_client_secret));
            setSecretMasked(response?.client_secret_masked || '');
            setUpdatedAt(response?.updated_at || '');
            setIsEditing(!hasCustom);
        } catch (e) {
            const message = getErrorMessage(e, 'Não foi possível carregar as credenciais de API.');
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCredentials();
    }, [loadCredentials]);

    const canSave = useMemo(() => {
        return clientKey.trim().length > 0 && clientSecret.trim().length > 0;
    }, [clientKey, clientSecret]);

    const isReadonly = hasCustomCredentials && !isEditing;

    const startEditing = () => {
        if (isSaving) return;
        setIsEditing(true);
        setClientSecret('');
        setError('');
    };

    const saveCredentials = async () => {
        if (isSaving || !canSave) return;

        setIsSaving(true);
        setError('');

        try {
            await put('/social-accounts/app-credentials/tiktok', {
                client_key: clientKey.trim(),
                client_secret: clientSecret.trim()
            });

            toast.success('Credenciais do TikTok salvas com sucesso.');
            await loadCredentials();
        } catch (e) {
            const message = getErrorMessage(e, 'Não foi possível salvar as credenciais.');
            setError(message);
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    return (
        <Stack spacing={2}>
            {error ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {error}
                </Alert>
            ) : null}

            <Box
                sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper'
                }}
            >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', md: 'center' }}>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        TikTok
                    </Typography>

                    <Box sx={{ flex: 1 }} />

                    <Chip
                        size="small"
                        color={hasCustomCredentials ? 'success' : 'info'}
                        label={hasCustomCredentials ? 'App ativo' : 'Usando APP Pub Mail'}
                        sx={{ borderRadius: 2, fontWeight: 800 }}
                    />
                </Stack>

                {!isReadonly ? (
                    <Alert severity="info" sx={{ mt: 1.8, borderRadius: 2 }}>
                        Para salvar, preencha obrigatoriamente os dois campos: <strong>Client Key</strong> e <strong>Client Secret</strong>.
                    </Alert>
                ) : null}

                <Stack spacing={1.5} sx={{ mt: 1.8 }}>
                    <TextField
                        fullWidth
                        label="TikTok Client Key"
                        value={clientKey}
                        disabled={isReadonly || isSaving}
                        onChange={(event) => setClientKey(event.target.value)}
                        autoComplete="off"
                    />

                    <TextField
                        fullWidth
                        type="password"
                        label="TikTok Client Secret"
                        value={isReadonly ? secretMasked || '********' : clientSecret}
                        disabled={isReadonly || isSaving}
                        onChange={(event) => setClientSecret(event.target.value)}
                        autoComplete="new-password"
                    />
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mt: 1.8 }}>
                    <Chip
                        size="small"
                        variant="outlined"
                        label={hasClientSecret ? `Secret salvo: ${secretMasked || 'Sim'}` : 'Secret salvo: Não'}
                        sx={{ borderRadius: 2, fontWeight: 700 }}
                    />
                    <Chip
                        size="small"
                        variant="outlined"
                        label={`Última atualização: ${formatDateTime(updatedAt)}`}
                        sx={{ borderRadius: 2, fontWeight: 700 }}
                    />
                </Stack>

                {isReadonly ? (
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={startEditing}
                        disabled={isSaving}
                        sx={{ mt: 2, borderRadius: 2, fontWeight: 800, textTransform: 'none', px: 2.2 }}
                    >
                        Editar credenciais
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={saveCredentials}
                        disabled={!canSave || isSaving}
                        sx={{ mt: 2, borderRadius: 2, fontWeight: 800, textTransform: 'none', px: 2.2 }}
                    >
                        {isSaving ? 'Salvando...' : 'Salvar credenciais'}
                    </Button>
                )}
            </Box>
        </Stack>
    );
}
