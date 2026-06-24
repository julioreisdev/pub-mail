import { Box, Card, CardContent, Chip, Container, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function TermsOfUse() {
    return (
        <Box
            sx={{
                minHeight: '100vh',
                py: { xs: 4, md: 6 },
                background:
                    'radial-gradient(900px 480px at 0% -10%, rgba(103,58,183,0.15), transparent 62%), radial-gradient(900px 480px at 100% -5%, rgba(60,99,255,0.14), transparent 62%), #f4f6ff'
            }}
        >
            <Container maxWidth="md">
                <Box
                    sx={{
                        borderRadius: 4,
                        p: { xs: 3, md: 4 },
                        boxShadow: '0 22px 46px rgba(34, 48, 122, 0.14)'
                    }}
                >
                    <Stack spacing={1.25}>
                        <Chip
                            label="Pub Mail"
                            sx={{
                                width: 'fit-content',
                                fontWeight: 800,
                                bgcolor: 'rgba(255,255,255,0.18)',
                                borderRadius: 999
                            }}
                        />
                        <Typography variant="h2" sx={{ fontSize: { xs: 30, md: 38 }, fontWeight: 900, lineHeight: 1.2 }}>
                            Termos de Uso
                        </Typography>
                        <Typography>Condições aplicáveis à utilização da plataforma Pub Mail.</Typography>
                        <Link component={RouterLink} to="/" underline="hover" sx={{ width: 'fit-content', fontWeight: 700 }}>
                            Voltar para o Pub Mail
                        </Link>
                    </Stack>
                </Box>

                <Card
                    variant="outlined"
                    sx={{
                        mt: 2.5,
                        borderRadius: 4,
                        borderColor: '#e6e9fb',
                        boxShadow: '0 18px 34px rgba(34, 48, 122, 0.08)'
                    }}
                >
                    <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                        <Stack spacing={2}>
                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#1f2552' }}>
                                1. Termos
                            </Typography>
                            <Typography sx={{ color: '#1f2552' }}>
                                Ao acessar o site{' '}
                                <Link href="/" target="_blank" rel="noopener noreferrer">
                                    Pub Mail
                                </Link>
                                , você concorda em cumprir estes termos de serviço, todas as leis e regulamentos aplicáveis e concorda que é responsável
                                pelo cumprimento de todas as leis locais aplicáveis. Se você não concordar com algum desses termos, está proibido de usar ou
                                acessar este site.
                            </Typography>

                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#1f2552' }}>
                                2. Uso de licença
                            </Typography>
                            <Typography sx={{ color: '#1f2552' }}>
                                É concedida permissão para baixar temporariamente uma cópia dos materiais (informações ou software) no site Pub Mail, apenas
                                para visualização transitória pessoal e não comercial. Esta é a concessão de uma licença, não uma transferência de título e,
                                sob esta licença, você não pode:
                            </Typography>
                            <Box component="ol" sx={{ m: 0, pl: 3, color: '#1f2552' }}>
                                <Box component="li" sx={{ mb: 1 }}>
                                    Modificar ou copiar os materiais.
                                </Box>
                                <Box component="li" sx={{ mb: 1 }}>
                                    Usar os materiais para qualquer finalidade comercial ou para exibição pública (comercial ou não comercial).
                                </Box>
                                <Box component="li" sx={{ mb: 1 }}>
                                    Tentar descompilar ou fazer engenharia reversa de qualquer software contido no site Pub Mail.
                                </Box>
                                <Box component="li" sx={{ mb: 1 }}>
                                    Remover quaisquer direitos autorais ou outras notações de propriedade dos materiais.
                                </Box>
                                <Box component="li">Transferir os materiais para outra pessoa ou espelhar os materiais em qualquer outro servidor.</Box>
                            </Box>
                            <Typography sx={{ color: '#1f2552' }}>
                                Esta licença será automaticamente rescindida se você violar alguma dessas restrições e poderá ser rescindida por Pub Mail a
                                qualquer momento. Ao encerrar a visualização desses materiais ou após o término desta licença, você deve apagar todos os
                                materiais baixados em sua posse.
                            </Typography>

                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#1f2552' }}>
                                3. Isenção de responsabilidade
                            </Typography>
                            <Box component="ol" sx={{ m: 0, pl: 3, color: '#1f2552' }}>
                                <Box component="li" sx={{ mb: 1 }}>
                                    Os materiais no site da Pub Mail são fornecidos "como estão". Pub Mail não oferece garantias, expressas ou implícitas, e
                                    isenta todas as outras garantias, incluindo garantias implícitas de comercialização, adequação a um fim específico ou não
                                    violação de propriedade intelectual.
                                </Box>
                                <Box component="li">
                                    O Pub Mail não garante a precisão, os resultados prováveis ou a confiabilidade do uso dos materiais no site ou em sites
                                    vinculados.
                                </Box>
                            </Box>

                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#1f2552' }}>
                                4. Limitações
                            </Typography>
                            <Typography sx={{ color: '#1f2552' }}>
                                Em nenhum caso o Pub Mail ou seus fornecedores serão responsáveis por quaisquer danos (incluindo perda de dados, lucro ou
                                interrupção dos negócios) decorrentes do uso ou incapacidade de uso dos materiais em Pub Mail, mesmo que Pub Mail ou
                                representante autorizado tenha sido notificado da possibilidade de tais danos.
                            </Typography>

                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#1f2552' }}>
                                5. Precisão dos materiais
                            </Typography>
                            <Typography sx={{ color: '#1f2552' }}>
                                Os materiais exibidos no site da Pub Mail podem incluir erros técnicos, tipográficos ou fotográficos. Pub Mail não garante
                                que qualquer material em seu site seja preciso, completo ou atual e pode fazer alterações sem aviso prévio.
                            </Typography>

                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#1f2552' }}>
                                6. Links
                            </Typography>
                            <Typography sx={{ color: '#1f2552' }}>
                                O Pub Mail não analisou todos os sites vinculados ao seu site e não é responsável pelo conteúdo de nenhum site vinculado. A
                                inclusão de qualquer link não implica endosso por Pub Mail.
                            </Typography>

                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#1f2552' }}>
                                Modificações
                            </Typography>
                            <Typography sx={{ color: '#1f2552' }}>
                                O Pub Mail pode revisar estes termos de serviço a qualquer momento, sem aviso prévio. Ao usar este site, você concorda em
                                ficar vinculado à versão atual desses termos.
                            </Typography>

                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#1f2552' }}>
                                Lei aplicável
                            </Typography>
                            <Typography sx={{ color: '#1f2552' }}>
                                Estes termos e condições são regidos e interpretados de acordo com as leis do Pub Mail e você se submete irrevogavelmente à
                                jurisdição exclusiva dos tribunais naquele estado ou localidade.
                            </Typography>

                            <Typography sx={{ color: '#59618a', fontSize: 14, pt: 1.5, borderTop: '1px solid #e6e9fb' }}>
                                Última revisão: 20 de março de 2026.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
}
