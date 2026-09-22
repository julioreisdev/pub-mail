import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from '@mui/material';
import { DeleteOutlineRoundedIcon as DeleteOutlineRoundedIcon } from 'ui-component/icons';
import { EditRoundedIcon as EditRoundedIcon } from 'ui-component/icons';
import { SyncRoundedIcon as SyncRoundedIcon } from 'ui-component/icons';
import { YouTubeIcon as YouTubeIcon } from 'ui-component/icons';
import { InstagramIcon as InstagramIcon } from 'ui-component/icons';
import { IconBrandTiktokFilled } from '@tabler/icons-react';
import toast from 'react-hot-toast';

import { get, patch, post, remove } from '../../../api/api';
import useSocialAccounts from '../../../hooks/useSocialAccounts';

const NETWORK_SECTIONS = [
    {
        value: 'TIKTOK',
        label: 'TikTok',
        oauthEnabled: true,
        buttonLabel: 'Conectar Conta TikTok',
        buttonBackground: 'linear-gradient(120deg, #ff0050 0%, #00f2ea 52%, #000000 100%)',
        buttonTextColor: '#ffffff'
    },
    {
        value: 'INSTAGRAM',
        label: 'Instagram',
        oauthEnabled: false,
        buttonLabel: 'Cadastrar Conta Instagram',
        buttonBackground: 'linear-gradient(115deg, #f58529 0%, #dd2a7b 38%, #8134af 68%, #515bd4 100%)',
        buttonTextColor: '#ffffff'
    },
    {
        value: 'YOUTUBE',
        label: 'YouTube',
        oauthEnabled: false,
        buttonLabel: 'Cadastrar Conta Youtube',
        buttonBackground: '#ff0000',
        buttonTextColor: '#ffffff'
    }
];

function getErrorMessage(error, fallback = 'Não foi possível concluir a ação.') {
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

function networkLabel(value) {
    return NETWORK_SECTIONS.find((item) => item.value === value)?.label || value || '-';
}

function networkIcon(network, size = 20) {
    if (network === 'TIKTOK') {
        return <IconBrandTiktokFilled size={size + 3} stroke={1.8} />;
    }

    if (network === 'INSTAGRAM') {
        return <InstagramIcon sx={{ fontSize: size + 3 }} />;
    }

    if (network === 'YOUTUBE') {
        return <YouTubeIcon sx={{ fontSize: size + 4 }} />;
    }

    return null;
}

function statusMeta(status) {
    if (status === 'ACTIVE') {
        return { label: 'Ativo', color: 'success' };
    }

    return { label: 'Desconectado', color: 'error' };
}

function accountAvatarUrl(account) {
    return String(account?.profile_image_url || '').trim();
}

function accountInitial(account) {
    const name = String(account?.display_name || account?.username || '?')
        .trim()
        .charAt(0);
    return (name || '?').toUpperCase();
}

export default function SocialLoginsManager() {
    const { socialAccounts, isLoading, error, mutate } = useSocialAccounts();
    const [connectingNetwork, setConnectingNetwork] = useState('');
    const [deletingId, setDeletingId] = useState('');
    const [settingDefaultId, setSettingDefaultId] = useState('');
    const [syncingProfileId, setSyncingProfileId] = useState('');
    const [savingAliasId, setSavingAliasId] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const oauth = params.get('oauth');
        const network = params.get('network');
        const message = params.get('message');

        if (!oauth) return;

        if (oauth === 'success') {
            const label = networkLabel(network);
            toast.success(`Conta ${label} conectada com sucesso.`);
            mutate();
        } else {
            toast.error(message || 'Não foi possível concluir a autenticação da conta social.');
        }

        params.delete('oauth');
        params.delete('network');
        params.delete('message');

        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
        window.history.replaceState({}, document.title, nextUrl);
    }, [mutate]);

    const accountsByNetwork = useMemo(() => {
        const grouped = {
            TIKTOK: [],
            INSTAGRAM: [],
            YOUTUBE: []
        };

        socialAccounts.forEach((account) => {
            const key = String(account?.social_network || '').toUpperCase();
            if (grouped[key]) grouped[key].push(account);
        });

        return grouped;
    }, [socialAccounts]);

    const startOAuth = async (network) => {
        if (connectingNetwork) return;

        setConnectingNetwork(network);
        try {
            const returnTo = `${window.location.origin}/settings/account-settings?tab=logins`;
            const response = await get(`/social-accounts/oauth/${network}/url`, {
                params: { return_to: returnTo }
            });

            const authorizationUrl = response?.authorization_url;
            if (!authorizationUrl) {
                throw new Error('URL de autenticação não retornada pelo backend.');
            }

            window.location.assign(authorizationUrl);
        } catch (e) {
            toast.error(getErrorMessage(e, 'Não foi possível iniciar o OAuth.'));
            setConnectingNetwork('');
        }
    };

    const removeAccount = async (accountId) => {
        if (!accountId || deletingId) return;
        setDeletingId(accountId);
        try {
            await remove(`/social-accounts/${accountId}`);
            await mutate();
            toast.success('Conta social removida com sucesso.');
        } catch (e) {
            toast.error(getErrorMessage(e, 'Não foi possível remover a conta social.'));
        } finally {
            setDeletingId('');
        }
    };

    const setDefaultAccount = async (accountId) => {
        if (!accountId || settingDefaultId) return;
        setSettingDefaultId(accountId);
        try {
            await patch(`/social-accounts/${accountId}`, { is_default: true });
            await mutate();
            toast.success('Conta definida como padrão.');
        } catch (e) {
            toast.error(getErrorMessage(e, 'Não foi possível definir a conta padrão.'));
        } finally {
            setSettingDefaultId('');
        }
    };

    const syncAccountProfile = async (account) => {
        const accountId = account?.id;
        if (!accountId || syncingProfileId) return;

        setSyncingProfileId(accountId);
        try {
            const response = await post(`/social-accounts/${accountId}/sync-profile`);
            await mutate();

            if (response?.profile_sync_ok) {
                toast.success('Perfil sincronizado com sucesso.');
                return;
            }

            toast('Conta sincronizada, mas o TikTok não retornou nome de exibição.', {
                icon: '⚠️'
            });
        } catch (e) {
            toast.error(getErrorMessage(e, 'Não foi possível sincronizar o perfil.'));
        } finally {
            setSyncingProfileId('');
        }
    };

    const setAccountAlias = async (account) => {
        const accountId = account?.id;
        if (!accountId || savingAliasId) return;

        const currentName = account?.display_name || account?.username || '';
        const nextNameRaw = window.prompt('Defina um apelido para exibir essa conta:', currentName);
        if (nextNameRaw === null) return;

        const nextName = String(nextNameRaw).trim();
        if (!nextName) {
            toast.error('Informe um nome válido para salvar o apelido.');
            return;
        }

        setSavingAliasId(accountId);
        try {
            await patch(`/social-accounts/${accountId}`, { display_name: nextName });
            await mutate();
            toast.success('Apelido salvo com sucesso.');
        } catch (e) {
            toast.error(getErrorMessage(e, 'Não foi possível salvar o apelido.'));
        } finally {
            setSavingAliasId('');
        }
    };

    const accountProfileIncomplete = (account) => {
        const extra = account?.extra;
        if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return false;
        return Boolean(extra.profile_incomplete);
    };

    const accountUsername = (account) => account?.display_name || account?.username || 'Conta sem nome';

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
                    {getErrorMessage(error, 'Não foi possível carregar as contas sociais.')}
                </Alert>
            ) : null}

            {NETWORK_SECTIONS.map((network) => {
                const accounts = accountsByNetwork[network.value] || [];

                return (
                    <Box
                        key={network.value}
                        sx={{
                            p: 2,
                            borderRadius: 2.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper'
                        }}
                    >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', md: 'center' }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                {networkIcon(network.value, 19)}
                                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                                    {network.label}
                                </Typography>
                            </Stack>

                            <Box sx={{ flex: 1 }} />

                            <Button
                                variant="contained"
                                onClick={() => {
                                    if (!network.oauthEnabled) return;
                                    startOAuth(network.value);
                                }}
                                disabled={Boolean(connectingNetwork) || !network.oauthEnabled}
                                sx={{
                                    borderRadius: 2,
                                    fontWeight: 800,
                                    textTransform: 'none',
                                    px: 1.8,
                                    color: network.buttonTextColor || '#ffffff',
                                    background: network.buttonBackground,
                                    '&:hover': {
                                        background: network.buttonBackground,
                                        filter: 'brightness(0.93)'
                                    },
                                    '&.Mui-disabled': {
                                        color: network.buttonTextColor || '#ffffff',
                                        background: network.buttonBackground,
                                        WebkitTextFillColor: network.buttonTextColor || '#ffffff',
                                        opacity: connectingNetwork === network.value ? 0.38 : 0.5,
                                        filter: connectingNetwork === network.value ? 'grayscale(0.35)' : 'none'
                                    }
                                }}
                            >
                                {connectingNetwork === network.value
                                    ? 'Conectando...'
                                    : network.oauthEnabled
                                      ? network.buttonLabel
                                      : `${network.buttonLabel} (em breve)`}
                            </Button>
                        </Stack>

                        {accounts.length === 0 ? (
                            <Alert severity="info" sx={{ borderRadius: 2, mt: 1.8 }}>
                                Nenhuma conta conectada no {network.label}.
                            </Alert>
                        ) : (
                            <TableContainer sx={{ mt: 1.6 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Nome de exibição</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Padrão</TableCell>
                                            <TableCell>Criado em</TableCell>
                                            <TableCell align="right">Ações</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {accounts.map((account) => {
                                            const status = statusMeta(account.status);
                                            const profileIncomplete = accountProfileIncomplete(account);
                                            return (
                                                <TableRow key={account.id} hover>
                                                    <TableCell>
                                                        <Stack direction="row" spacing={0.8} alignItems="center">
                                                            <Avatar
                                                                src={accountAvatarUrl(account)}
                                                                alt={accountUsername(account)}
                                                                sx={{ width: 22, height: 22, fontSize: 11 }}
                                                            >
                                                                {accountInitial(account)}
                                                            </Avatar>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                                {accountUsername(account)}
                                                            </Typography>
                                                        </Stack>
                                                        {profileIncomplete ? (
                                                            <Chip
                                                                size="small"
                                                                label="Perfil incompleto"
                                                                color="warning"
                                                                sx={{ mt: 0.6, borderRadius: 2, fontWeight: 700 }}
                                                            />
                                                        ) : null}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            size="small"
                                                            label={status.label}
                                                            color={status.color}
                                                            sx={{ borderRadius: 2, fontWeight: 800 }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {account.is_default ? (
                                                            <Chip
                                                                size="small"
                                                                label="Padrão"
                                                                color="success"
                                                                sx={{ borderRadius: 2, fontWeight: 800 }}
                                                            />
                                                        ) : (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                color="secondary"
                                                                onClick={() => setDefaultAccount(account.id)}
                                                                disabled={Boolean(settingDefaultId) || Boolean(deletingId)}
                                                                sx={{ textTransform: 'none', fontWeight: 700 }}
                                                            >
                                                                {settingDefaultId === account.id ? 'Salvando...' : 'Tornar padrão'}
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{formatDateTime(account.created_at)}</TableCell>
                                                    <TableCell align="right">
                                                        {account.social_network === 'TIKTOK' ? (
                                                            <Tooltip title="Sincronizar perfil">
                                                                <span>
                                                                    <IconButton
                                                                        size="small"
                                                                        color="primary"
                                                                        onClick={() => syncAccountProfile(account)}
                                                                        disabled={
                                                                            Boolean(syncingProfileId) ||
                                                                            Boolean(deletingId) ||
                                                                            Boolean(savingAliasId)
                                                                        }
                                                                    >
                                                                        <SyncRoundedIcon fontSize="small" />
                                                                    </IconButton>
                                                                </span>
                                                            </Tooltip>
                                                        ) : null}
                                                        <Tooltip title="Definir apelido">
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    color="secondary"
                                                                    onClick={() => setAccountAlias(account)}
                                                                    disabled={
                                                                        Boolean(syncingProfileId) ||
                                                                        Boolean(deletingId) ||
                                                                        Boolean(savingAliasId)
                                                                    }
                                                                >
                                                                    <EditRoundedIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                        <Tooltip title="Remover conta">
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={() => removeAccount(account.id)}
                                                                    disabled={
                                                                        Boolean(syncingProfileId) ||
                                                                        Boolean(deletingId) ||
                                                                        Boolean(savingAliasId)
                                                                    }
                                                                >
                                                                    <DeleteOutlineRoundedIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                );
            })}
        </Stack>
    );
}
