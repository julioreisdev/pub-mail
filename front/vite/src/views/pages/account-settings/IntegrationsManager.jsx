import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import toast from 'react-hot-toast';

import { get, patch } from '../../../api/api';

function getErrorMessage(error, fallback) {
    const message = error?.response?.data?.message ?? error?.message;
    if (Array.isArray(message)) return message.join(' | ');
    return String(message || fallback);
}

function formatDateTime(value) {
    if (!value) return '';
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
    } catch {
        return String(value);
    }
}

const AI_PROVIDERS = [
    {
        key: 'groq',
        label: 'Groq',
        model: 'llama-3.3-70b-versatile',
        description: 'Mais rápido (~250 tok/s). 1k req/dia/conta no free tier.',
        placeholder: 'gsk_xxx, gsk_yyy'
    },
    {
        key: 'cerebras',
        label: 'Cerebras Cloud',
        model: 'llama-3.3-70b',
        description: 'Mais rápido que Groq (~450 tok/s). 1M tokens/dia/conta no free.',
        placeholder: 'csk-xxx, csk-yyy'
    },
    {
        key: 'mistral',
        label: 'Mistral La Plateforme',
        model: 'mistral-small-latest',
        description: 'Cota free generosa (~1B tokens/mês). 1 req/s.',
        placeholder: 'mst_xxx, mst_yyy'
    },
    {
        key: 'openrouter',
        label: 'OpenRouter',
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        description: 'Agregador de modelos. ~50 req/dia por modelo grátis.',
        placeholder: 'sk-or-v1-xxx'
    },
    {
        key: 'gemini',
        label: 'Google Gemini',
        model: 'gemini-2.0-flash',
        description: 'Excelente em multilíngue. 1.500 req/dia/conta no free.',
        placeholder: 'AIzaSy...'
    },
    {
        key: 'sambanova',
        label: 'SambaNova Cloud',
        model: 'Llama-3.3-70B-Instruct',
        description: 'Free tier limitado (~10 req/min). Bom como reserva.',
        placeholder: 'sn_xxx, sn_yyy'
    }
];

export default function IntegrationsManager() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState(null);

    // AI providers — todas são CSV de chaves
    const [providerInputs, setProviderInputs] = useState({
        groq: '',
        cerebras: '',
        mistral: '',
        openrouter: '',
        gemini: '',
        sambanova: ''
    });
    const [providerCounts, setProviderCounts] = useState({
        groq: 0,
        cerebras: 0,
        mistral: 0,
        openrouter: 0,
        gemini: 0,
        sambanova: 0
    });

    const [resendInput, setResendInput] = useState('');
    const [edgeIpInput, setEdgeIpInput] = useState('');
    const [certbotEmailInput, setCertbotEmailInput] = useState('');

    const applyServerData = useCallback((data) => {
        setProviderInputs({
            groq: data?.groq_api_keys || '',
            cerebras: data?.cerebras_api_keys || '',
            mistral: data?.mistral_api_keys || '',
            openrouter: data?.openrouter_api_keys || '',
            gemini: data?.gemini_api_keys || '',
            sambanova: data?.sambanova_api_keys || ''
        });
        setProviderCounts({
            groq: Number(data?.groq_api_keys_count || 0),
            cerebras: Number(data?.cerebras_api_keys_count || 0),
            mistral: Number(data?.mistral_api_keys_count || 0),
            openrouter: Number(data?.openrouter_api_keys_count || 0),
            gemini: Number(data?.gemini_api_keys_count || 0),
            sambanova: Number(data?.sambanova_api_keys_count || 0)
        });
        setResendInput(data?.resend_api_key || '');
        setEdgeIpInput(data?.webchat_edge_ip || '');
        setCertbotEmailInput(data?.certbot_email || '');
        setUpdatedAt(data?.updated_at || null);
    }, []);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await get('/system-settings');
            applyServerData(data);
        } catch (e) {
            setError(getErrorMessage(e, 'Não foi possível carregar as integrações.'));
        } finally {
            setIsLoading(false);
        }
    }, [applyServerData]);

    useEffect(() => {
        load();
    }, [load]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                groq_api_keys: providerInputs.groq,
                cerebras_api_keys: providerInputs.cerebras,
                mistral_api_keys: providerInputs.mistral,
                openrouter_api_keys: providerInputs.openrouter,
                gemini_api_keys: providerInputs.gemini,
                sambanova_api_keys: providerInputs.sambanova,
                resend_api_key: resendInput,
                webchat_edge_ip: edgeIpInput,
                certbot_email: certbotEmailInput
            };
            const data = await patch('/system-settings', payload);
            applyServerData(data);
            toast.success('Integrações atualizadas com sucesso.');
        } catch (e) {
            toast.error(getErrorMessage(e, 'Falha ao salvar.'));
        } finally {
            setIsSaving(false);
        }
    };

    const totalAiKeys = Object.values(providerCounts).reduce((sum, n) => sum + n, 0);

    if (isLoading) {
        return (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Stack spacing={2.5}>
            <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
                    Integrações
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Configure aqui as chaves de API e parâmetros de infraestrutura usados pela plataforma. Todos os campos são opcionais — deixe em
                    branco para limpar.
                </Typography>
            </Box>

            {error ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {error}
                </Alert>
            ) : null}

            <Box
                sx={{
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    p: 2
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                        IA — Provedores
                    </Typography>
                    <Chip
                        size="small"
                        label={`${totalAiKeys} chave(s) ativa(s)`}
                        color={totalAiKeys > 0 ? 'success' : 'default'}
                        sx={{ borderRadius: 2, fontWeight: 700 }}
                    />
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    O sistema usa rotação inteligente entre todas as chaves saudáveis. Múltiplas chaves por provedor são permitidas (separe por
                    vírgula ou linha). Veja a aba <strong>Tutorial APIs IA</strong> para passo-a-passo de como conseguir cada uma.
                </Typography>

                <Stack spacing={2}>
                    {AI_PROVIDERS.map((provider) => (
                        <Box
                            key={provider.key}
                            sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 2,
                                p: 1.5,
                                bgcolor: providerCounts[provider.key] > 0 ? 'rgba(76, 175, 80, 0.04)' : 'transparent'
                            }}
                        >
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                <Typography sx={{ fontWeight: 800 }}>{provider.label}</Typography>
                                <Chip
                                    size="small"
                                    label={provider.model}
                                    variant="outlined"
                                    sx={{ borderRadius: 1, fontSize: 11, height: 20 }}
                                />
                                {providerCounts[provider.key] > 0 ? (
                                    <Chip
                                        size="small"
                                        label={`${providerCounts[provider.key]} chave(s)`}
                                        color="success"
                                        sx={{ borderRadius: 1, height: 20, fontSize: 11 }}
                                    />
                                ) : null}
                            </Stack>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                                {provider.description}
                            </Typography>
                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                size="small"
                                placeholder={provider.placeholder}
                                value={providerInputs[provider.key]}
                                onChange={(e) =>
                                    setProviderInputs((prev) => ({ ...prev, [provider.key]: e.target.value }))
                                }
                            />
                        </Box>
                    ))}
                </Stack>
            </Box>

            <Box
                sx={{
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    p: 2
                }}
            >
                <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
                    Envio de e-mails — Resend
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                    Chave usada tanto para validar domínios quanto para o disparo em massa.
                </Typography>
                <TextField
                    fullWidth
                    label="Resend API Key"
                    placeholder="re_xxxxxxxxxxxx"
                    value={resendInput}
                    onChange={(e) => setResendInput(e.target.value)}
                />
            </Box>

            <Box
                sx={{
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    p: 2
                }}
            >
                <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
                    Webchat — Edge / SSL
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                    IPv4 público para o qual os domínios de webchat devem apontar (registro A) e e-mail registrado no Let’s Encrypt.
                </Typography>
                <Stack spacing={2}>
                    <TextField
                        fullWidth
                        label="Webchat Edge IP (IPv4)"
                        placeholder="203.0.113.10"
                        value={edgeIpInput}
                        onChange={(e) => setEdgeIpInput(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        type="email"
                        label="Certbot Email"
                        placeholder="admin@suaempresa.com"
                        value={certbotEmailInput}
                        onChange={(e) => setCertbotEmailInput(e.target.value)}
                    />
                </Stack>
            </Box>

            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                {updatedAt ? (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Última atualização: {formatDateTime(updatedAt)}
                    </Typography>
                ) : (
                    <Box />
                )}
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    variant="contained"
                    sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none', px: 3 }}
                    startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
                >
                    Salvar
                </Button>
            </Stack>
        </Stack>
    );
}
