// src/views/pages/tickets/TicketWhatsappRequest.jsx
import { useMemo, useState } from 'react';
import { Box, Stack, Typography, TextField, Button, Divider, Chip, Alert } from '@mui/material';
import { WhatsAppIcon as WhatsAppIcon } from 'ui-component/icons';

import MainCard from 'ui-component/cards/MainCard';

const WHATSAPP_NUMBER_E164 = '554391162065'; // +55 43 9116-2065 (sem +, espaços ou traços)
const COMPANY_NAME = 'Pub Mail';

function safeJsonParse(value, fallback = null) {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function maskToken(token) {
    if (!token || typeof token !== 'string') return '';
    // Mostra só começo e fim (evita vazar credencial inteira)
    const start = token.slice(0, 18);
    const end = token.slice(-10);
    return `${start}...${end}`;
}

function buildWhatsappMessage({ companyName, userPayload, token, userText }) {
    const u = userPayload?.user || {};
    const org = userPayload?.organization || {};

    const lines = [
        `Olá! Gostaria de abrir um ticket com a ${companyName}.`,
        '',
        '📌 *Dados do solicitante*',
        `• Nome: ${u.name || '-'}`,
        `• E-mail: ${u.email || '-'}`,
        `• Role: ${u.role || '-'}`,
        `• User ID: ${u.id || '-'}`,
        '',
        '🏢 *Organização*',
        `• Nome: ${org.name || '-'}`,
        `• Org ID: ${org.id || '-'}`,
        '',
        '🔐 *Sessão*',
        `• Token (resumo): ${maskToken(token) || '-'}`,
        // Se você realmente quiser mandar o token inteiro (não recomendado), troque a linha acima por:
        // `• Token: ${token || '-'}`,
        '',
        '📝 *Pedido do cliente*',
        userText?.trim() ? userText.trim() : '(não informado)'
    ];

    return lines.join('\n');
}

function openWhatsapp(numberE164, message) {
    const encoded = encodeURIComponent(message);
    // wa.me funciona bem no mobile e desktop
    const url = `https://wa.me/${numberE164}?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

export default function TicketWhatsappRequest() {
    const [text, setText] = useState('');

    const { userPayload, token } = useMemo(() => {
        const rawUser = localStorage.getItem('user'); // string JSON
        const rawToken = localStorage.getItem('token'); // string JWT
        return {
            userPayload: safeJsonParse(rawUser, null),
            token: rawToken || ''
        };
    }, []);

    const canSend = useMemo(() => {
        // Pode enviar mesmo sem texto; mas precisa ter ao menos user ou token pra "informações do localStorage"
        return Boolean(userPayload || token);
    }, [userPayload, token]);

    const handleSend = () => {
        const message = buildWhatsappMessage({
            companyName: COMPANY_NAME,
            userPayload,
            token,
            userText: text
        });
        openWhatsapp(WHATSAPP_NUMBER_E164, message);
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <MainCard
                content={false}
                sx={{
                    overflow: 'hidden',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider'
                }}
            >
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="h3" sx={{ fontWeight: 900 }}>
                                Solicitar suporte via WhatsApp
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                                Descreva o que você precisa e envie sua solicitação já com seus dados.
                            </Typography>
                        </Box>

                        <Divider />

                        {!canSend && (
                            <Alert severity="warning">
                                Não encontrei dados no <b>localStorage</b> (chaves <code>user</code> / <code>token</code>). Ainda posso abrir o WhatsApp,
                                mas a mensagem vai sem identificação.
                            </Alert>
                        )}

                        <TextField
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Explique com detalhes o que você precisa (ex: erro, prints, passo a passo, objetivo, urgência, etc.)"
                            multiline
                            minRows={10}
                            fullWidth
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 3
                                }
                            }}
                        />

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
                            <Button
                                onClick={handleSend}
                                variant="contained"
                                size="large"
                                startIcon={<WhatsAppIcon />}
                                sx={{
                                    borderRadius: 3,
                                    textTransform: 'none',
                                    fontWeight: 900,
                                    px: 2.5
                                }}
                            >
                                Solicitar no WhatsApp
                            </Button>
                        </Stack>

                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Ao clicar, abriremos o WhatsApp com a mensagem preenchida. Não enviamos nada automaticamente.
                        </Typography>
                    </Stack>
                </Box>
            </MainCard>
        </Box>
    );
}
