import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { IconPlus, IconKey } from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, patch, post, remove } from '../../../api/api';

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
    { key: 'groq', label: 'Groq', model: 'llama-3.3-70b-versatile', description: 'Mais rápido (~250 tok/s). 1k req/dia/conta no free tier.', placeholder: 'gsk_xxx' },
    { key: 'cerebras', label: 'Cerebras Cloud', model: 'llama-3.3-70b', description: 'Mais rápido que Groq (~450 tok/s). 1M tokens/dia/conta no free.', placeholder: 'csk-xxx' },
    { key: 'mistral', label: 'Mistral La Plateforme', model: 'mistral-small-latest', description: 'Cota free generosa (~1B tokens/mês). 1 req/s.', placeholder: 'mst_xxx' },
    { key: 'openrouter', label: 'OpenRouter', model: 'meta-llama/llama-3.3-70b-instruct:free', description: 'Agregador de modelos. ~50 req/dia por modelo grátis.', placeholder: 'sk-or-v1-xxx' },
    { key: 'gemini', label: 'Google Gemini', model: 'gemini-2.0-flash', description: 'Excelente em multilíngue. 1.500 req/dia/conta no free.', placeholder: 'AIzaSy...' },
    { key: 'sambanova', label: 'SambaNova Cloud', model: 'Llama-3.3-70B-Instruct', description: 'Free tier limitado (~10 req/min). Bom como reserva.', placeholder: 'sn_xxx' }
];

const EMPTY = Object.fromEntries(AI_PROVIDERS.map((p) => [p.key, { masked: [], count: 0 }]));

export default function IntegrationsManager() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState(null);

    const [providers, setProviders] = useState(EMPTY);
    const [addInputs, setAddInputs] = useState({});
    const [busy, setBusy] = useState(''); // marca provider/ação em andamento

    const [resendInput, setResendInput] = useState('');
    const [webhookSecretInput, setWebhookSecretInput] = useState('');
    const [edgeIpInput, setEdgeIpInput] = useState('');
    const [certbotEmailInput, setCertbotEmailInput] = useState('');

    const webhookUrl = `${import.meta.env.VITE_API_URL || ''}/webhooks/resend`;

    const applyServerData = useCallback((data) => {
        setProviders(
            Object.fromEntries(
                AI_PROVIDERS.map((p) => [
                    p.key,
                    { masked: data?.[`${p.key}_api_keys_masked`] || [], count: Number(data?.[`${p.key}_api_keys_count`] || 0) }
                ])
            )
        );
        setResendInput(data?.resend_api_key || '');
        setWebhookSecretInput(data?.resend_webhook_secret || '');
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

    const handleAddKeys = async (provider) => {
        const keys = (addInputs[provider] || '').trim();
        if (!keys) return;
        setBusy(`${provider}-add`);
        try {
            const data = await post('/system-settings/ai-keys', { provider, keys });
            applyServerData(data);
            setAddInputs((prev) => ({ ...prev, [provider]: '' }));
            toast.success('Chave(s) adicionada(s).');
        } catch (e) {
            toast.error(getErrorMessage(e, 'Falha ao adicionar chave.'));
        } finally {
            setBusy('');
        }
    };

    const handleRemoveKey = async (provider, index) => {
        setBusy(`${provider}-${index}`);
        try {
            const data = await remove('/system-settings/ai-keys', { data: { provider, index } });
            applyServerData(data);
            toast.success('Chave removida.');
        } catch (e) {
            toast.error(getErrorMessage(e, 'Falha ao remover chave.'));
        } finally {
            setBusy('');
        }
    };

    const handleSaveInfra = async () => {
        setIsSaving(true);
        try {
            // chaves de IA são gerenciadas pelos botões (add/remove); aqui só a infra.
            const payload = {
                resend_api_key: resendInput,
                resend_webhook_secret: webhookSecretInput,
                webchat_edge_ip: edgeIpInput,
                certbot_email: certbotEmailInput
            };
            const data = await patch('/system-settings', payload);
            applyServerData(data);
            toast.success('Configurações salvas.');
        } catch (e) {
            toast.error(getErrorMessage(e, 'Falha ao salvar.'));
        } finally {
            setIsSaving(false);
        }
    };

    const totalAiKeys = AI_PROVIDERS.reduce((sum, p) => sum + (providers[p.key]?.count || 0), 0);

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
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Integrações</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Chaves de API e parâmetros de infraestrutura usados pela plataforma.
                </Typography>
            </Box>

            {error ? <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert> : null}

            {/* ---- Provedores de IA ---- */}
            <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', p: { xs: 2, md: 2.5 } }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>IA — Provedores</Typography>
                    <Chip size="small" label={`${totalAiKeys} chave${totalAiKeys === 1 ? '' : 's'} ativa${totalAiKeys === 1 ? '' : 's'}`} color={totalAiKeys > 0 ? 'success' : 'default'} sx={{ fontWeight: 700 }} />
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    O sistema faz rotação inteligente entre todas as chaves saudáveis. Adicione várias por provedor para escalar. Veja a aba{' '}
                    <strong>Tutorial de IA</strong> para conseguir cada uma.
                </Typography>

                <Stack spacing={1.5}>
                    {AI_PROVIDERS.map((provider) => {
                        const st = providers[provider.key] || { masked: [], count: 0 };
                        const active = st.count > 0;
                        return (
                            <Box
                                key={provider.key}
                                sx={{
                                    border: '1px solid',
                                    borderColor: active ? (t) => alpha(t.palette.success.main, 0.5) : 'divider',
                                    borderRadius: 2.5,
                                    p: 1.75,
                                    bgcolor: active ? (t) => alpha(t.palette.success.main, 0.06) : 'transparent'
                                }}
                            >
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                                    <Typography sx={{ fontWeight: 700 }}>{provider.label}</Typography>
                                    <Chip size="small" label={provider.model} variant="outlined" sx={{ borderRadius: 1, fontSize: 11, height: 20 }} />
                                    <Chip size="small" label={active ? `${st.count} chave${st.count === 1 ? '' : 's'}` : 'sem chave'} color={active ? 'success' : 'default'} variant={active ? 'filled' : 'outlined'} sx={{ borderRadius: 1, height: 20, fontSize: 11, fontWeight: 600 }} />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: st.masked.length ? 1 : 1.25 }}>
                                    {provider.description}
                                </Typography>

                                {/* chaves cadastradas (mascaradas, removíveis) */}
                                {st.masked.length > 0 ? (
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.25 }}>
                                        {st.masked.map((mk, i) => (
                                            <Chip
                                                key={i}
                                                icon={<IconKey size={13} />}
                                                label={mk}
                                                onDelete={busy === `${provider.key}-${i}` ? undefined : () => handleRemoveKey(provider.key, i)}
                                                disabled={busy === `${provider.key}-${i}`}
                                                variant="outlined"
                                                sx={{ borderRadius: 1.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, '& .MuiChip-icon': { color: 'text.secondary' } }}
                                            />
                                        ))}
                                    </Stack>
                                ) : null}

                                {/* adicionar chave(s) */}
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        placeholder={`Adicionar chave (${provider.placeholder}) — separe várias por vírgula`}
                                        value={addInputs[provider.key] || ''}
                                        onChange={(e) => setAddInputs((prev) => ({ ...prev, [provider.key]: e.target.value }))}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeys(provider.key); } }}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="medium"
                                        onClick={() => handleAddKeys(provider.key)}
                                        disabled={busy === `${provider.key}-add` || !(addInputs[provider.key] || '').trim()}
                                        startIcon={busy === `${provider.key}-add` ? <CircularProgress size={14} /> : <IconPlus size={16} />}
                                        sx={{ borderRadius: 2, borderColor: 'divider', color: 'text.primary', flexShrink: 0, minWidth: 120 }}
                                    >
                                        Adicionar
                                    </Button>
                                </Stack>
                            </Box>
                        );
                    })}
                </Stack>
            </Box>

            {/* ---- Resend ---- */}
            <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', p: { xs: 2, md: 2.5 } }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Envio de e-mails — Resend</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>Chave usada para validar domínios e para o disparo em massa.</Typography>
                <Stack spacing={2}>
                    <TextField fullWidth label="Resend API Key" placeholder="re_xxxxxxxxxxxx" value={resendInput} onChange={(e) => setResendInput(e.target.value)} />
                    <Box sx={{ borderTop: '1px dashed', borderColor: 'divider', pt: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Webhook de entrega / bounce</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                            No Resend (<b>Webhooks → Add Endpoint</b>), cadastre a URL abaixo e assine <b>email.delivered</b>, <b>email.bounced</b> e{' '}
                            <b>email.complained</b>. Cole aqui o <i>Signing Secret</i>. Hard-bounces e spam <b>suprimem o lead automaticamente</b>.
                        </Typography>
                        <TextField fullWidth size="small" label="URL do webhook (cole no Resend)" value={webhookUrl} InputProps={{ readOnly: true }} onFocus={(e) => e.target.select()} sx={{ mb: 1.5 }} />
                        <TextField fullWidth label="Resend Webhook Signing Secret" placeholder="whsec_xxxxxxxxxxxx" value={webhookSecretInput} onChange={(e) => setWebhookSecretInput(e.target.value)} />
                    </Box>
                </Stack>
            </Box>

            {/* ---- Webchat Edge / SSL ---- */}
            <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', p: { xs: 2, md: 2.5 } }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Webchat — Edge / SSL</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                    IPv4 público para os domínios de webchat apontarem (registro A) e e-mail do Let’s Encrypt.
                </Typography>
                <Stack spacing={2}>
                    <TextField fullWidth label="Webchat Edge IP (IPv4)" placeholder="203.0.113.10" value={edgeIpInput} onChange={(e) => setEdgeIpInput(e.target.value)} />
                    <TextField fullWidth type="email" label="Certbot Email" placeholder="admin@suaempresa.com" value={certbotEmailInput} onChange={(e) => setCertbotEmailInput(e.target.value)} />
                </Stack>
            </Box>

            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                {updatedAt ? (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Última atualização: {formatDateTime(updatedAt)}</Typography>
                ) : (
                    <Box />
                )}
                <Button onClick={handleSaveInfra} disabled={isSaving} variant="contained" sx={{ borderRadius: 2, fontWeight: 700, px: 3 }} startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}>
                    Salvar
                </Button>
            </Stack>
        </Stack>
    );
}
