// src/views/pages/home/Home.jsx
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { Box, Container, Stack, Typography, Button, Chip, Link as MuiLink } from '@mui/material';

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';

const BRAND_PURPLE = '#377EF0';
const LOGO_URL = '/favicon.png';

function FeatureLine({ icon, title, description }) {
    return (
        <Stack direction="row" spacing={1.75} alignItems="flex-start">
            <Box
                sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    color: BRAND_PURPLE,
                    bgcolor: 'rgba(55,126,240,0.08)',
                    flexShrink: 0
                }}
            >
                {icon}
            </Box>
            <Box>
                <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    {description}
                </Typography>
            </Box>
        </Stack>
    );
}

export default function Home() {
    const navigate = useNavigate();
    const goRegister = () => navigate('/register');
    const goLogin = () => navigate('/login');

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Container maxWidth="md" sx={{ py: 1.5 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                        <Box component="img" src={LOGO_URL} alt="Pub Mail" sx={{ height: 32, width: 'auto' }} />
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Button onClick={goLogin} variant="text" startIcon={<LoginRoundedIcon />} sx={{ textTransform: 'none', fontWeight: 700 }}>
                                Entrar
                            </Button>
                            <Button
                                onClick={goRegister}
                                variant="contained"
                                endIcon={<ArrowForwardRoundedIcon />}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, bgcolor: BRAND_PURPLE, '&:hover': { bgcolor: '#1e5dc8' } }}
                            >
                                Cadastre-se
                            </Button>
                        </Stack>
                    </Stack>
                </Container>
            </Box>

            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', py: { xs: 6, md: 10 } }}>
                <Container maxWidth="sm">
                    <Stack spacing={3} alignItems="flex-start">
                        <Chip label="Pub Mail" size="small" sx={{ fontWeight: 700, bgcolor: 'rgba(55,126,240,0.1)', color: BRAND_PURPLE, borderRadius: 999 }} />

                        <Typography variant="h1" sx={{ fontWeight: 800, fontSize: { xs: 32, md: 44 }, lineHeight: 1.15, letterSpacing: -0.5 }}>
                            Webchats institucionais com IA e email em massa para a sua escola.
                        </Typography>

                        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                            O <b>Pub Mail</b> é a plataforma completa para criar webchats institucionais apoiados por agentes de IA e realizar disparos de email em massa,
                            tudo em um só lugar.
                        </Typography>

                        <Stack spacing={2} sx={{ pt: 1, width: '100%' }}>
                            <FeatureLine
                                icon={<ChatOutlinedIcon fontSize="small" />}
                                title="Webchats com agentes de IA"
                                description="Atenda responsáveis, alunos e interessados 24/7 com agentes treinados no contexto da sua instituição."
                            />
                            <FeatureLine
                                icon={<EmailOutlinedIcon fontSize="small" />}
                                title="Email marketing em massa"
                                description="Dispare comunicados, avisos e campanhas para listas segmentadas com métricas de abertura."
                            />
                            <FeatureLine
                                icon={<SchoolOutlinedIcon fontSize="small" />}
                                title="Feito para instituições de ensino"
                                description="Pronto para o dia a dia da secretaria, com integração simples e onboarding rápido."
                            />
                        </Stack>

                        <Stack direction="row" spacing={1.5} sx={{ pt: 2 }}>
                            <Button
                                onClick={goRegister}
                                size="large"
                                variant="contained"
                                endIcon={<ArrowForwardRoundedIcon />}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 3, bgcolor: BRAND_PURPLE, '&:hover': { bgcolor: '#1e5dc8' } }}
                            >
                                Começar agora
                            </Button>
                            <Button
                                onClick={goLogin}
                                size="large"
                                variant="outlined"
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 3 }}
                            >
                                Já tenho conta
                            </Button>
                        </Stack>
                    </Stack>
                </Container>
            </Box>

            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', py: 2.5 }}>
                <Container maxWidth="md">
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            © {new Date().getFullYear()} Pub Mail. Todos os direitos reservados.
                        </Typography>
                        <Stack direction="row" spacing={2}>
                            <MuiLink component={RouterLink} to="/legal/politica-de-privacidade" variant="caption" underline="hover" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                Política de Privacidade
                            </MuiLink>
                            <MuiLink component={RouterLink} to="/legal/termos-de-uso" variant="caption" underline="hover" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                Termos de Uso
                            </MuiLink>
                        </Stack>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
}
