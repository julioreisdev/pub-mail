// src/views/pages/tickets/TicketWhatsappRequest.jsx
import { useMemo, useState } from 'react';
import { Box, Stack, Typography, TextField, Button, Divider, Chip, Alert } from '@mui/material';
import { WhatsAppIcon as WhatsAppIcon } from 'ui-component/icons';

import MainCard from 'ui-component/cards/MainCard';
import { useAuth } from 'contexts/AuthContext';

const WHATSAPP_NUMBER_E164 = '554391162065'; // +55 43 9116-2065 (sem +, espaços ou traços)
const COMPANY_NAME = 'Pub Mail';


// A-87: o JWT (nem um pedaço dele) NUNCA vai na mensagem — o suporte
// identifica o cliente por User ID / Org ID.
function buildWhatsappMessage({ companyName, userPayload, userText }) {
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

    const { user: userPayload } = useAuth();

    const canSend = useMemo(() => {
        // Pode enviar mesmo sem texto; mas precisa ter os dados do usuário pra identificar o pedido
        return Boolean(userPayload);
    }, [userPayload]);

    const handleSend = () => {
        const message = buildWhatsappMessage({
            companyName: COMPANY_NAME,
            userPayload,
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
                                Não encontrei os dados da sua conta. Ainda posso abrir o WhatsApp, mas a mensagem vai sem identificação.
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
