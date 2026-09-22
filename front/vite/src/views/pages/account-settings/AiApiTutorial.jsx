import { Alert, Box, Chip, Link, Stack, Typography } from '@mui/material';
import { OpenInNewRoundedIcon as OpenInNewRoundedIcon } from 'ui-component/icons';

const PROVIDERS = [
    {
        key: 'groq',
        title: 'Groq',
        model: 'llama-3.3-70b-versatile',
        url: 'https://console.groq.com/keys',
        free: '1.000 req/dia · 30 RPM · 6.000 tokens/min',
        steps: [
            {
                title: 'Crie a conta',
                body: (
                    <>
                        Acesse{' '}
                        <Link href="https://console.groq.com/login" target="_blank" rel="noopener noreferrer">
                            console.groq.com/login
                        </Link>{' '}
                        e faça login com Google ou GitHub.
                    </>
                )
            },
            {
                title: 'Vá em "API Keys"',
                body: 'No menu lateral esquerdo, clique em "API Keys". Você vai cair direto na tela de gerenciamento.'
            },
            {
                title: 'Gere a chave',
                body: 'Clique em "Create API Key", dê um nome (ex: "pub-mail-prod") e copie a chave que começa com "gsk_". A Groq não mostra a chave duas vezes.'
            },
            {
                title: 'Cole no Pub Mail',
                body: 'Volte aqui na aba Integrações > IA — Provedores > Groq, e cole. Múltiplas chaves separadas por vírgula somam quotas.'
            }
        ]
    },
    {
        key: 'cerebras',
        title: 'Cerebras Cloud',
        model: 'llama-3.3-70b',
        url: 'https://cloud.cerebras.ai',
        free: '1M tokens/dia · 30 RPM',
        steps: [
            {
                title: 'Crie a conta',
                body: (
                    <>
                        Acesse{' '}
                        <Link href="https://cloud.cerebras.ai/" target="_blank" rel="noopener noreferrer">
                            cloud.cerebras.ai
                        </Link>{' '}
                        e crie uma conta gratuita (Google login funciona).
                    </>
                )
            },
            {
                title: 'API Keys',
                body: 'No menu superior/lateral, vá em "API Keys" (ou Inference > API Keys, dependendo do layout atual).'
            },
            {
                title: 'Generate New Key',
                body: 'Clique em "Generate New Key", dê um nome e copie. As chaves começam com "csk-".'
            },
            {
                title: 'Cole no Pub Mail',
                body: 'Aba Integrações > IA — Provedores > Cerebras Cloud. CSV se quiser várias contas.'
            }
        ],
        notes: 'Cerebras é o mais rápido (~450 tok/s) e a quota mais generosa. Considere ele primary depois da Groq.'
    },
    {
        key: 'mistral',
        title: 'Mistral La Plateforme',
        model: 'mistral-small-latest',
        url: 'https://console.mistral.ai',
        free: '~1B tokens/mês · 1 RPS',
        steps: [
            {
                title: 'Crie a conta',
                body: (
                    <>
                        Acesse{' '}
                        <Link href="https://console.mistral.ai/" target="_blank" rel="noopener noreferrer">
                            console.mistral.ai
                        </Link>{' '}
                        e cadastre-se. É preciso confirmar e-mail.
                    </>
                )
            },
            {
                title: 'Workspace > API Keys',
                body: 'No menu, vá em "API Keys". Pode pedir pra você confirmar telefone (alguns países).'
            },
            {
                title: 'Create new key',
                body: 'Clique em "Create new key" e copie. Selecione o plano "Experiment" (gratuito) se aparecer dropdown.'
            },
            {
                title: 'Cole no Pub Mail',
                body: 'Aba Integrações > IA — Provedores > Mistral La Plateforme.'
            }
        ],
        notes: 'A cota é em tokens/mês — generoso pra uso normal.'
    },
    {
        key: 'openrouter',
        title: 'OpenRouter',
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        url: 'https://openrouter.ai/keys',
        free: '~50 req/dia por modelo grátis',
        steps: [
            {
                title: 'Crie a conta',
                body: (
                    <>
                        Acesse{' '}
                        <Link href="https://openrouter.ai/" target="_blank" rel="noopener noreferrer">
                            openrouter.ai
                        </Link>{' '}
                        e faça login (Google/GitHub).
                    </>
                )
            },
            {
                title: 'Settings > Keys',
                body: 'Clique no avatar > Keys, ou direto em openrouter.ai/keys.'
            },
            {
                title: 'Create Key',
                body: 'Crie uma chave (começam com "sk-or-v1-..."). Não precisa adicionar saldo para usar os modelos com sufixo ":free".'
            },
            {
                title: 'Cole no Pub Mail',
                body: 'Aba Integrações > IA — Provedores > OpenRouter.'
            }
        ],
        notes: 'Os limites variam por modelo grátis. O Pub Mail usa Llama 3.3 70B free como default.'
    },
    {
        key: 'gemini',
        title: 'Google Gemini',
        model: 'gemini-2.0-flash',
        url: 'https://aistudio.google.com/apikey',
        free: '1.500 req/dia · 15 RPM',
        steps: [
            {
                title: 'Acesse AI Studio',
                body: (
                    <>
                        Vá em{' '}
                        <Link href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                            aistudio.google.com/apikey
                        </Link>{' '}
                        com sua conta Google.
                    </>
                )
            },
            {
                title: 'Create API key',
                body: 'Clique em "Create API key". Pode escolher um projeto Google Cloud existente ou deixar criar um novo automaticamente.'
            },
            {
                title: 'Copie a chave',
                body: 'A chave começa com "AIzaSy". Copie e guarde — o AI Studio mostra ela depois também, mas é bom já salvar.'
            },
            {
                title: 'Cole no Pub Mail',
                body: 'Aba Integrações > IA — Provedores > Google Gemini.'
            }
        ],
        notes: 'Gemini Flash é particularmente bom em multilíngue (mandarim, árabe, hindi). Vale ter mesmo se você só usa PT/EN.'
    },
    {
        key: 'sambanova',
        title: 'SambaNova Cloud',
        model: 'Llama-3.3-70B-Instruct',
        url: 'https://cloud.sambanova.ai',
        free: '~10 RPM, daily limits flutuantes',
        steps: [
            {
                title: 'Crie a conta',
                body: (
                    <>
                        Acesse{' '}
                        <Link href="https://cloud.sambanova.ai/" target="_blank" rel="noopener noreferrer">
                            cloud.sambanova.ai
                        </Link>{' '}
                        e cadastre-se (precisa confirmar e-mail).
                    </>
                )
            },
            {
                title: 'APIs > API Keys',
                body: 'No menu lateral: APIs > API Keys.'
            },
            {
                title: 'Generate Key',
                body: 'Clique "Generate Key" e copie. As chaves começam com "sn_" ou similar.'
            },
            {
                title: 'Cole no Pub Mail',
                body: 'Aba Integrações > IA — Provedores > SambaNova Cloud.'
            }
        ],
        notes: 'Mais limitado que os outros — vale como reserva pra picos.'
    }
];

function ProviderSection({ provider, index }) {
    return (
        <Box
            sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2.5,
                bgcolor: 'background.paper',
                p: 2.5
            }}
        >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <Box
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        fontWeight: 800,
                        fontSize: 13
                    }}
                >
                    {index + 1}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    {provider.title}
                </Typography>
                <Chip
                    size="small"
                    label={provider.model}
                    variant="outlined"
                    sx={{ borderRadius: 1, fontSize: 11, height: 22 }}
                />
                <Chip
                    size="small"
                    label={provider.free}
                    color="success"
                    sx={{ borderRadius: 1, fontSize: 11, height: 22 }}
                />
            </Stack>

            <Stack spacing={1.25} sx={{ mt: 2 }}>
                {provider.steps.map((step, idx) => (
                    <Stack key={`${provider.key}-step-${idx}`} direction="row" spacing={1.5} alignItems="flex-start">
                        <Box
                            sx={{
                                minWidth: 22,
                                height: 22,
                                borderRadius: '50%',
                                bgcolor: 'rgba(0,0,0,0.06)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: 12,
                                mt: 0.25
                            }}
                        >
                            {idx + 1}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{step.title}</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>
                                {step.body}
                            </Typography>
                        </Box>
                    </Stack>
                ))}
            </Stack>

            {provider.notes ? (
                <Alert
                    severity="info"
                    sx={{ mt: 2, borderRadius: 2 }}
                    icon={false}
                >
                    💡 {provider.notes}
                </Alert>
            ) : null}

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Link
                    href={provider.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none'
                    }}
                >
                    Abrir página de chaves do {provider.title}
                    <OpenInNewRoundedIcon fontSize="inherit" />
                </Link>
            </Stack>
        </Box>
    );
}

export default function AiApiTutorial() {
    return (
        <Stack spacing={2.5}>
            <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
                    Tutorial — APIs de IA gratuitas
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    O Pub Mail usa rotação inteligente entre múltiplos provedores grátis para escalar sem limite. Quanto mais chaves você cadastrar
                    (em diferentes provedores e múltiplas contas por provedor), maior a capacidade diária. Recomendado: pelo menos <strong>Groq +
                    Cerebras + Gemini</strong>.
                </Typography>
            </Box>

            <Alert severity="info" sx={{ borderRadius: 2 }}>
                <strong>Dica:</strong> em todos os provedores você pode criar várias contas (com e-mails diferentes) e somar as chaves no campo
                correspondente em <strong>Integrações</strong>, separadas por vírgula. O sistema faz round-robin entre as chaves saudáveis.
            </Alert>

            {PROVIDERS.map((provider, index) => (
                <ProviderSection key={provider.key} provider={provider} index={index} />
            ))}

            <Alert severity="warning" sx={{ borderRadius: 2 }}>
                <strong>Sobre múltiplas contas:</strong> os termos de uso de alguns provedores limitam contas múltiplas por usuário. Use com bom
                senso — em escala normal funciona; em escala muito grande, eventualmente alguma plataforma pode banir contas relacionadas.
            </Alert>
        </Stack>
    );
}
