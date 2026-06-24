import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Stack, Tabs, Tab, Typography, TextField, Alert } from '@mui/material';

import MainCard from 'ui-component/cards/MainCard';

import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import DomainRoundedIcon from '@mui/icons-material/DomainRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import DomainsTabs from './DomainsTabs';
import IntegrationsManager from './IntegrationsManager';
import AiApiTutorial from './AiApiTutorial';
import ApiStatus from './ApiStatus';

const safeJsonParse = (text, fallback) => {
    try {
        return JSON.parse(text);
    } catch {
        return fallback;
    }
};

const formatDateTime = (iso) => {
    if (!iso) return '';
    try {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(iso));
    } catch {
        return String(iso);
    }
};

export default function AccountSettings() {
    const [searchParams] = useSearchParams();
    const [tab, setTab] = useState(() => {
        const selectedTab = String(searchParams.get('tab') || '').toLowerCase();
        if (selectedTab === 'domains') return 1;
        if (selectedTab === 'integrations') return 2;
        if (selectedTab === 'api-status') return 3;
        if (selectedTab === 'ai-tutorial') return 4;
        return 0;
    });
    const initialDomainTab = searchParams.get('domainTab') === 'webchat' ? 'webchat' : 'email';

    const [rawUser, setRawUser] = useState(null);
    const [token, setToken] = useState('');

    useEffect(() => {
        const u = localStorage.getItem('user');
        const t = localStorage.getItem('token');

        setRawUser(u);
        setToken(t || '');
    }, []);

    useEffect(() => {
        const selectedTab = String(searchParams.get('tab') || '').toLowerCase();
        if (selectedTab === 'domains') {
            setTab(1);
            return;
        }
        if (selectedTab === 'integrations') {
            setTab(2);
            return;
        }
        if (selectedTab === 'api-status') {
            setTab(3);
            return;
        }
        if (selectedTab === 'ai-tutorial') {
            setTab(4);
            return;
        }
        setTab(0);
    }, [searchParams]);

    const parsedUser = useMemo(() => safeJsonParse(rawUser, null), [rawUser]);

    const user = parsedUser?.user || null;
    const org = parsedUser?.organization || null;

    const userFields = useMemo(
        () => [
            { label: 'User ID', value: user?.id || '' },
            { label: 'Organization ID', value: user?.organization_id || '' },
            { label: 'Nome', value: user?.name || '' },
            { label: 'E-mail', value: user?.email || '' },
            { label: 'Role', value: user?.role || '' },
            { label: 'Ativo', value: typeof user?.active === 'boolean' ? (user.active ? 'Sim' : 'Não') : '' }
        ],
        [user]
    );

    const orgFields = useMemo(
        () => [
            { label: 'Organization ID', value: org?.id || '' },
            { label: 'Nome', value: org?.name || '' },
            { label: 'Document ID', value: org?.document_id || '' },
            { label: 'Status', value: typeof org?.status === 'boolean' ? (org.status ? 'Ativa' : 'Inativa') : '' },
            { label: 'Stripe Customer ID', value: org?.stripe_customer_id || '' },
            { label: 'Criado em', value: org?.created_at ? formatDateTime(org.created_at) : '' },
            { label: 'Atualizado em', value: org?.updated_at ? formatDateTime(org.updated_at) : '' }
        ],
        [org]
    );

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <MainCard
                content={false}
                sx={{
                    overflow: 'hidden',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    marginBottom: '1rem'
                }}
            >
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                        <Tabs
                            value={tab}
                            onChange={(_, v) => setTab(v)}
                            textColor="secondary"
                            indicatorColor="secondary"
                            sx={{
                                minHeight: 44,
                                '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 800 }
                            }}
                        >
                            <Tab icon={<AccountCircleRoundedIcon />} iconPosition="start" label="Dados da conta" />
                            <Tab icon={<DomainRoundedIcon />} iconPosition="start" label="Domínios" />
                            <Tab icon={<VpnKeyRoundedIcon />} iconPosition="start" label="Integrações" />
                            <Tab icon={<MonitorHeartRoundedIcon />} iconPosition="start" label="Status de API" />
                            <Tab icon={<SmartToyRoundedIcon />} iconPosition="start" label="Tutorial APIs IA" />
                        </Tabs>
                    </Box>

                    {tab === 0 ? (
                        <Stack spacing={2.5}>
                            {!user || !org ? (
                                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                    Não foi possível ler os dados do localStorage (chave <strong>user</strong>).
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
                                <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5 }}>
                                    Usuário
                                </Typography>

                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        justifyContent: 'space-between',
                                        gap: 2
                                    }}
                                >
                                    {userFields.map((f) => (
                                        <Box
                                            key={f.label}
                                            sx={{
                                                flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' },
                                                maxWidth: { xs: '100%', sm: 'calc(50% - 8px)' }
                                            }}
                                        >
                                            <TextField fullWidth label={f.label} value={f.value} disabled />
                                        </Box>
                                    ))}
                                </Box>
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
                                <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5 }}>
                                    Organização
                                </Typography>

                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        justifyContent: 'space-between',
                                        gap: 2
                                    }}
                                >
                                    {orgFields.map((f) => (
                                        <Box
                                            key={f.label}
                                            sx={{
                                                flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' },
                                                maxWidth: { xs: '100%', sm: 'calc(50% - 8px)' }
                                            }}
                                        >
                                            <TextField fullWidth label={f.label} value={f.value} disabled />
                                        </Box>
                                    ))}
                                </Box>
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
                                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                                    Token
                                </Typography>
                                <TextField fullWidth label="token" value={token} disabled />
                            </Box>
                        </Stack>
                    ) : tab === 1 ? (
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
                            <DomainsTabs initialTab={initialDomainTab} />
                        </Box>
                    ) : tab === 2 ? (
                        <Box
                            sx={{
                                p: 3,
                                borderRadius: 3,
                                border: '1px dashed',
                                borderColor: 'divider',
                                bgcolor: 'background.paper'
                            }}
                        >
                            <IntegrationsManager />
                        </Box>
                    ) : tab === 3 ? (
                        <Box
                            sx={{
                                p: 3,
                                borderRadius: 3,
                                border: '1px dashed',
                                borderColor: 'divider',
                                bgcolor: 'background.paper'
                            }}
                        >
                            <ApiStatus />
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                p: 3,
                                borderRadius: 3,
                                border: '1px dashed',
                                borderColor: 'divider',
                                bgcolor: 'background.paper'
                            }}
                        >
                            <AiApiTutorial />
                        </Box>
                    )}
                </Box>
            </MainCard>
        </Box>
    );
}
