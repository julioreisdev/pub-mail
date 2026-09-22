import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    LinearProgress,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import { RefreshRoundedIcon as RefreshRoundedIcon } from 'ui-component/icons';
import { CheckCircleRoundedIcon as CheckCircleRoundedIcon } from 'ui-component/icons';
import { HourglassBottomRoundedIcon as HourglassBottomRoundedIcon } from 'ui-component/icons';
import { EventBusyRoundedIcon as EventBusyRoundedIcon } from 'ui-component/icons';
import { BlockRoundedIcon as BlockRoundedIcon } from 'ui-component/icons';
import { HelpOutlineRoundedIcon as HelpOutlineRoundedIcon } from 'ui-component/icons';
import { ContentCopyRoundedIcon as ContentCopyRoundedIcon } from 'ui-component/icons';
import { CheckRoundedIcon as CheckRoundedIcon } from 'ui-component/icons';
import toast from 'react-hot-toast';

import { get } from '../../../api/api';

const PROVIDER_LABELS = {
    groq: 'Groq',
    cerebras: 'Cerebras Cloud',
    mistral: 'Mistral La Plateforme',
    openrouter: 'OpenRouter',
    gemini: 'Google Gemini',
    sambanova: 'SambaNova Cloud'
};

const STATUS_META = {
    healthy: {
        label: 'Saudável',
        color: 'success',
        Icon: CheckCircleRoundedIcon,
        description: 'Pronta para uso. Sem cooldown ativo.'
    },
    rate_limited: {
        label: 'Em cooldown',
        color: 'warning',
        Icon: HourglassBottomRoundedIcon,
        description: 'Provider devolveu 429. Aguardando o tempo de retry indicado.'
    },
    daily_exhausted: {
        label: 'Cota diária esgotada',
        color: 'error',
        Icon: EventBusyRoundedIcon,
        description: 'Quota diária consumida. Reseta no início do próximo dia (UTC).'
    },
    invalid: {
        label: 'Inválida',
        color: 'error',
        Icon: BlockRoundedIcon,
        description: 'Provider rejeitou a chave (401/403). Verifique se ainda está ativa no painel.'
    }
};

function getStatusMeta(status) {
    return STATUS_META[status] || { label: status || 'desconhecido', color: 'default', Icon: HelpOutlineRoundedIcon, description: '' };
}

function formatAbsolute(ms) {
    if (!ms) return '—';
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(ms));
    } catch {
        return String(ms);
    }
}

function formatRelative(ms, now = Date.now()) {
    if (!ms) return '—';
    const diffSec = Math.round((ms - now) / 1000);
    const abs = Math.abs(diffSec);
    const past = diffSec < 0;

    let text;
    if (abs < 60) text = `${abs}s`;
    else if (abs < 3600) text = `${Math.round(abs / 60)}min`;
    else if (abs < 86400) text = `${Math.round(abs / 3600)}h`;
    else text = `${Math.round(abs / 86400)}d`;

    return past ? `há ${text}` : `em ${text}`;
}

function formatNumber(n) {
    return new Intl.NumberFormat('pt-BR').format(Number(n) || 0);
}

function getErrorMessage(error, fallback) {
    const message = error?.response?.data?.message ?? error?.message;
    if (Array.isArray(message)) return message.join(' | ');
    return String(message || fallback);
}

function CopyKeyButton({ apiKey }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.stopPropagation();
        if (!apiKey) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(apiKey);
            } else {
                const ta = document.createElement('textarea');
                ta.value = apiKey;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopied(true);
            toast.success('Chave copiada.');
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error('Não foi possível copiar.');
        }
    };

    return (
        <Tooltip title={copied ? 'Copiada!' : 'Copiar chave'} arrow placement="top">
            <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                    width: 28,
                    height: 28,
                    color: copied ? 'success.main' : 'text.secondary',
                    '&:hover': { color: 'primary.main', bgcolor: 'action.hover' }
                }}
            >
                {copied ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
            </IconButton>
        </Tooltip>
    );
}

function StatusBadge({ status }) {
    const meta = getStatusMeta(status);
    const Icon = meta.Icon;
    return (
        <Tooltip title={meta.description} arrow placement="top">
            <Chip
                size="small"
                color={meta.color}
                icon={<Icon sx={{ fontSize: 16 }} />}
                label={meta.label}
                sx={{ fontWeight: 800, borderRadius: 1.5 }}
            />
        </Tooltip>
    );
}

function MetricCell({ label, value, hint }) {
    return (
        <Box sx={{ minWidth: 110 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
                {label}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: 'text.primary' }}>{value}</Typography>
            {hint ? (
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{hint}</Typography>
            ) : null}
        </Box>
    );
}

function KeyRow({ keyData, now }) {
    const meta = getStatusMeta(keyData.status);
    const inCooldown = keyData.status === 'rate_limited' && keyData.cooldown_until > now;
    const inDailyReset = keyData.status === 'daily_exhausted' && keyData.daily_reset_at > now;

    const cooldownTarget = inCooldown ? keyData.cooldown_until : inDailyReset ? keyData.daily_reset_at : 0;
    const cooldownLabel = inCooldown ? 'Volta a operar' : inDailyReset ? 'Reset da quota' : null;

    return (
        <Box
            sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: meta.color === 'success' ? 'success.light' : meta.color === 'warning' ? 'warning.light' : meta.color === 'error' ? 'error.light' : 'divider',
                bgcolor: meta.color === 'success' ? 'rgba(46, 125, 50, 0.04)' : meta.color === 'warning' ? 'rgba(237, 108, 2, 0.05)' : meta.color === 'error' ? 'rgba(211, 47, 47, 0.04)' : 'background.paper'
            }}
        >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ minWidth: 0, flex: 1 }}>
                    <StatusBadge status={keyData.status} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                            <Tooltip title={keyData.api_key || ''} arrow placement="top">
                                <Typography
                                    sx={{
                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                        fontSize: 13,
                                        fontWeight: 800,
                                        color: 'text.primary',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        minWidth: 0,
                                        flex: 1
                                    }}
                                >
                                    {keyData.api_key || '—'}
                                </Typography>
                            </Tooltip>
                            <CopyKeyButton apiKey={keyData.api_key} />
                        </Stack>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                            {keyData.length ? `${keyData.length} chars` : ''} {keyData.length ? '·' : ''} id {keyData.id?.split(':')?.[1]?.slice(0, 8) || '—'}
                        </Typography>
                    </Box>
                </Stack>

                <Stack
                    direction="row"
                    spacing={2.5}
                    flexWrap="wrap"
                    sx={{ rowGap: 1.5, columnGap: 2.5 }}
                    justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                >
                    <MetricCell
                        label="Último uso"
                        value={keyData.last_used_at ? formatRelative(keyData.last_used_at, now) : '—'}
                        hint={keyData.last_used_at ? formatAbsolute(keyData.last_used_at) : ''}
                    />
                </Stack>
            </Stack>

            {cooldownTarget ? (
                <Box sx={{ mt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>{cooldownLabel}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: meta.color === 'warning' ? 'warning.main' : 'error.main' }}>
                            {formatRelative(cooldownTarget, now)} · {formatAbsolute(cooldownTarget)}
                        </Typography>
                    </Stack>
                    <LinearProgress
                        variant="determinate"
                        color={meta.color === 'warning' ? 'warning' : 'error'}
                        value={Math.max(0, Math.min(100, 100 - ((cooldownTarget - now) / Math.max(1, cooldownTarget - (keyData.last_used_at || now - 60000))) * 100))}
                        sx={{ height: 6, borderRadius: 999 }}
                    />
                </Box>
            ) : null}

            {keyData.last_error ? (
                <Tooltip title={keyData.last_error} arrow placement="top">
                    <Box
                        sx={{
                            mt: 1.5,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: 'rgba(0,0,0,0.03)',
                            border: '1px dashed',
                            borderColor: 'divider'
                        }}
                    >
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>
                            Último erro
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: 12,
                                color: 'text.secondary',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {keyData.last_error}
                        </Typography>
                    </Box>
                </Tooltip>
            ) : null}
        </Box>
    );
}

function ProviderSection({ provider, now }) {
    const label = PROVIDER_LABELS[provider.provider] || provider.provider;
    const totalKeys = provider.keys.length;
    const healthyCount = provider.keys.filter((k) => k.status === 'healthy').length;
    const pTotals = provider.provider_totals || {};
    const totalCapacity = Number(pTotals.reqs_capacity_today) || 0;

    return (
        <Box
            sx={{
                p: 2.5,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
            }}
        >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Chip
                        size="small"
                        label={`#${provider.priority}`}
                        sx={{ fontWeight: 900, borderRadius: 1, bgcolor: 'primary.main', color: 'primary.contrastText' }}
                    />
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                            {label}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                            {provider.default_model}
                            {provider.fallback_model ? ` · fallback: ${provider.fallback_model}` : ''}
                        </Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
                    <Chip
                        size="small"
                        label={`${totalKeys} chave${totalKeys === 1 ? '' : 's'}`}
                        variant="outlined"
                        sx={{ fontWeight: 700, borderRadius: 1 }}
                    />
                    <Chip
                        size="small"
                        color={healthyCount === totalKeys && totalKeys > 0 ? 'success' : healthyCount === 0 ? 'error' : 'warning'}
                        label={`${healthyCount}/${totalKeys} saudáveis`}
                        sx={{ fontWeight: 700, borderRadius: 1 }}
                    />
                    {totalCapacity > 0 ? (
                        <Tooltip
                            title={`Capacidade aproximada deste provedor: ${healthyCount} chave(s) saudável(is) × ~${formatNumber(provider.capacity_per_key || 0)} mensagens/chave/dia. Free tier: ${
                                provider.free_quota?.reqs_per_day != null
                                    ? `${formatNumber(provider.free_quota.reqs_per_day)} req/dia/chave`
                                    : `${formatNumber(provider.free_quota?.tokens_per_day || 0)} tokens/dia/chave`
                            }, ~${formatNumber(provider.free_quota?.estimated_tokens_per_request || 4000)} tokens por mensagem.`}
                            arrow
                            placement="top"
                        >
                            <Chip
                                size="small"
                                color="primary"
                                label={`~${formatNumber(totalCapacity)} mensagens/dia`}
                                sx={{ fontWeight: 700, borderRadius: 1 }}
                            />
                        </Tooltip>
                    ) : null}
                </Stack>
            </Stack>

            {totalKeys === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Nenhuma chave configurada para este provedor. Adicione na aba <strong>Integrações</strong>.
                </Alert>
            ) : (
                <Stack spacing={1.25}>
                    {provider.keys.map((k) => (
                        <KeyRow key={k.id} keyData={k} now={now} />
                    ))}
                </Stack>
            )}
        </Box>
    );
}

const REFRESH_INTERVAL_MS = 15000;

export default function ApiStatus() {
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [lastFetchAt, setLastFetchAt] = useState(0);
    const intervalRef = useRef(null);

    const load = useCallback(async (silent = false) => {
        if (silent) setIsRefreshing(true);
        else setIsLoading(true);
        setError('');
        try {
            const result = await get('/system-settings/ai-keys-status');
            setData(result);
            setLastFetchAt(Date.now());
        } catch (e) {
            setError(getErrorMessage(e, 'Não foi possível carregar o status das chaves.'));
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        load(false);
    }, [load]);

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            load(true);
        }, REFRESH_INTERVAL_MS);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [load]);

    // Tick a cada 1s só para os timers visuais (cooldown countdown), sem bater no servidor.
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const totals = data?.totals || {
        keys: 0, healthy: 0, rate_limited: 0, daily_exhausted: 0, invalid: 0,
        reqs_used_today: 0, reqs_capacity_today: 0, reqs_remaining_today: 0,
    };
    const providers = data?.providers || [];

    // Total de mensagens vem direto do contador GLOBAL no Redis (não somamos
    // chave-por-chave). Capacidade total = soma das chaves usáveis × cap_per_key
    // de cada provider. Restante = capacidade - usado.
    const totalMessagesToday = Number(totals.reqs_used_today) || 0;
    const dailyCapacity = Number(totals.reqs_capacity_today) || 0;
    const dailyRemaining = Number(totals.reqs_remaining_today) || 0;

    // Breakdown por provider (apenas pra visualização da composição da capacidade).
    const providerBreakdown = useMemo(
        () =>
            providers
                .filter((p) => (p.keys || []).length > 0)
                .map((p) => ({
                    provider: p.provider,
                    keys: (p.keys || []).length,
                    healthy_keys: p.provider_totals?.healthy_keys || 0,
                    capacity_per_key: p.capacity_per_key,
                    capacity: p.provider_totals?.reqs_capacity_today || 0,
                })),
        [providers],
    );

    const usagePercent = dailyCapacity > 0
        ? Math.min(100, Math.round((totalMessagesToday / dailyCapacity) * 1000) / 10)
        : 0;
    const usageColor = usagePercent < 70 ? 'success' : usagePercent < 90 ? 'warning' : 'error';

    if (isLoading) {
        return (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
                        Status de API
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Estado runtime de cada chave cadastrada — cooldown, uso diário, último erro. Atualiza automaticamente a cada 15s.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                    {lastFetchAt ? (
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                            atualizado {formatRelative(lastFetchAt, now)}
                        </Typography>
                    ) : null}
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => load(true)}
                        startIcon={isRefreshing ? <CircularProgress size={14} /> : <RefreshRoundedIcon />}
                        disabled={isRefreshing}
                        sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1.5 }}
                    >
                        Atualizar
                    </Button>
                </Stack>
            </Stack>

            {error ? (
                <Alert severity="error" sx={{ borderRadius: 2 }} action={
                    <Button size="small" onClick={() => load(false)} sx={{ textTransform: 'none', fontWeight: 800 }}>Tentar novamente</Button>
                }>
                    {error}
                </Alert>
            ) : null}

            {totals.keys === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Nenhuma chave de IA configurada ainda. Cadastre pelo menos uma chave na aba <strong>Integrações</strong> para ver o status aqui.
                </Alert>
            ) : (
                <>
                    <Box
                        sx={{
                            p: 2.5,
                            borderRadius: 2.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper'
                        }}
                    >
                        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'baseline' }} justifyContent="space-between" sx={{ mb: 1 }}>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800 }}>
                                Mensagens hoje / Mensagens totais
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                Estimativa real por chave (free tier × tokens/mensagem). Reseta às 00:05 UTC.
                            </Typography>
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 1.25 }}>
                            <Typography sx={{ fontSize: 22, fontWeight: 900, color: 'text.primary', minWidth: 0 }}>
                                <Box component="span" sx={{ color: usageColor === 'error' ? 'error.main' : usageColor === 'warning' ? 'warning.main' : 'success.main' }}>
                                    {formatNumber(totalMessagesToday)}
                                </Box>
                                <Box component="span" sx={{ color: 'text.disabled', mx: 0.5 }}>/</Box>
                                <Box component="span">{formatNumber(dailyCapacity)}</Box>
                            </Typography>
                            <Chip
                                size="small"
                                color={usageColor}
                                label={`${usagePercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% consumido`}
                                sx={{ fontWeight: 800, borderRadius: 1.5 }}
                            />
                            {dailyCapacity > 0 ? (
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    Restam ~{formatNumber(dailyRemaining)} mensagens hoje
                                    {' · '}
                                    <Box component="span" sx={{ fontStyle: 'italic' }}>
                                        chaves esgotadas/inválidas já descontadas
                                    </Box>
                                </Typography>
                            ) : (
                                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                                    Sem capacidade estimada disponível
                                </Typography>
                            )}
                        </Stack>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, usagePercent)}
                            color={usageColor}
                            sx={{
                                height: 10,
                                borderRadius: 999,
                                bgcolor: 'rgba(0,0,0,0.06)',
                                '& .MuiLinearProgress-bar': { borderRadius: 999 }
                            }}
                        />

                        {/* Breakdown por provider — quanto cada um contribui pra capacidade total
                            (capacidade conta apenas chaves saudáveis/em-cooldown; esgotadas/inválidas dão 0). */}
                        {providerBreakdown.length > 0 && dailyCapacity > 0 ? (
                            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, mb: 1 }}>
                                    Composição da capacidade (por provedor)
                                </Typography>
                                <Stack direction="row" spacing={1.25} flexWrap="wrap" sx={{ rowGap: 1 }}>
                                    {providerBreakdown.map((b) => (
                                        <Tooltip
                                            key={b.provider}
                                            title={`${b.healthy_keys} chave(s) saudável(is) × ~${formatNumber(b.capacity_per_key || 0)} mensagens/chave/dia = ${formatNumber(b.capacity)}`}
                                            arrow
                                            placement="top"
                                        >
                                            <Chip
                                                size="small"
                                                variant="outlined"
                                                label={
                                                    <Box component="span">
                                                        <Box component="span" sx={{ fontWeight: 800 }}>
                                                            {(PROVIDER_LABELS[b.provider] || b.provider)}
                                                        </Box>
                                                        {' · '}
                                                        <Box component="span" sx={{ color: 'text.secondary' }}>
                                                            {b.healthy_keys}× = {formatNumber(b.capacity)}
                                                        </Box>
                                                    </Box>
                                                }
                                                sx={{ fontSize: 12, borderRadius: 1.5 }}
                                            />
                                        </Tooltip>
                                    ))}
                                </Stack>
                            </Box>
                        ) : null}
                    </Box>

                    <Box
                        sx={{
                            p: 2,
                            borderRadius: 2.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper'
                        }}
                    >
                        <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ rowGap: 1.5 }}>
                            <MetricCell label="Total de chaves" value={formatNumber(totals.keys)} />
                            <Divider flexItem orientation="vertical" />
                            <MetricCell label="Saudáveis" value={formatNumber(totals.healthy)} />
                            <MetricCell label="Em cooldown" value={formatNumber(totals.rate_limited)} />
                            <MetricCell label="Esgotadas" value={formatNumber(totals.daily_exhausted)} />
                            <MetricCell label="Inválidas" value={formatNumber(totals.invalid)} />
                            <Divider flexItem orientation="vertical" />
                            <MetricCell label="Mensagens hoje" value={formatNumber(totalMessagesToday)} hint="Total agregado (zera 00:05 UTC = 21:05 BRT)" />
                        </Stack>
                    </Box>
                </>
            )}

            <Stack spacing={2}>
                {providers.map((p) => (
                    <ProviderSection key={p.provider} provider={p} now={now} />
                ))}
            </Stack>

            <Alert severity="info" sx={{ borderRadius: 2 }}>
                <strong>Como ler:</strong> a estimativa <em>"X usadas / Y capacidade"</em> usa o limite real do free tier de cada provider —
                Groq (1k req/dia, 100k tokens/dia → cap real ~25 reqs), Cerebras (1M tokens/dia → ~250 reqs),
                Mistral (~33M tokens/dia → ~8.000 reqs), Gemini (1.500 req/dia), OpenRouter (50 req/dia/modelo free), SambaNova (~200 req/dia, flutuante).
                Cada mensagem de webchat consome ~4.000 tokens em média (system prompt + histórico + resposta).
                Quanto mais provedores você somar em <strong>Integrações</strong>, maior a capacidade total. "Mensagens hoje" e "Tokens hoje" resetam às 00:05 UTC.
                Chaves <strong>inválidas</strong> não voltam sozinhas: revogue/atualize no painel do provedor e troque a CSV em Integrações.
            </Alert>
        </Stack>
    );
}
