import { Box, Card, CardContent, Chip, Container, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function PrivacyPolicy() {
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
                            Política de Privacidade
                        </Typography>
                        <Typography>Sua privacidade é importante para nós e tratamos seus dados com responsabilidade.</Typography>
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
                            <Typography sx={{ color: '#1f2552' }}>
                                A sua privacidade é importante para nós. É política do Pub Mail respeitar a sua privacidade em relação a qualquer informação
                                sua que possamos coletar no site{' '}
                                <Link href="/" target="_blank" rel="noopener noreferrer">
                                    Pub Mail
                                </Link>{' '}
                                e em outros sites que possuímos e operamos.
                            </Typography>

                            <Typography sx={{ color: '#1f2552' }}>
                                Solicitamos informações pessoais apenas quando realmente precisamos delas para lhe fornecer um serviço. Fazemos isso por
                                meios justos e legais, com o seu conhecimento e consentimento. Também informamos por que estamos coletando e como essas
                                informações serão usadas.
                            </Typography>

                            <Typography sx={{ color: '#1f2552' }}>
                                Apenas retemos as informações coletadas pelo tempo necessário para fornecer o serviço solicitado. Quando armazenamos dados,
                                protegemos dentro de meios comercialmente aceitáveis para evitar perdas e roubos, bem como acesso, divulgação, cópia, uso ou
                                modificação não autorizados.
                            </Typography>

                            <Typography sx={{ color: '#1f2552' }}>
                                Não compartilhamos informações de identificação pessoal publicamente ou com terceiros, exceto quando exigido por lei.
                            </Typography>

                            <Typography sx={{ color: '#1f2552' }}>
                                Nosso site pode ter links para sites externos que não são operados por nós. Esteja ciente de que não temos controle sobre o
                                conteúdo e as práticas desses sites e não podemos aceitar responsabilidade por suas respectivas{' '}
                                <Link href="https://politicaprivacidade.com/" target="_blank" rel="noopener noreferrer">
                                    políticas de privacidade
                                </Link>
                                .
                            </Typography>

                            <Typography sx={{ color: '#1f2552' }}>
                                Você é livre para recusar a nossa solicitação de informações pessoais, entendendo que talvez não possamos fornecer alguns
                                dos serviços desejados.
                            </Typography>

                            <Typography sx={{ color: '#1f2552' }}>
                                O uso continuado de nosso site será considerado como aceitação de nossas práticas em torno de privacidade e informações
                                pessoais. Se você tiver alguma dúvida sobre como lidamos com dados do usuário e informações pessoais, entre em contato
                                conosco.
                            </Typography>

                            <Typography variant="h4" sx={{ mt: 1, fontWeight: 900, color: '#1f2552' }}>
                                Cookies e publicidade
                            </Typography>

                            <Box component="ul" sx={{ m: 0, pl: 3, color: '#1f2552' }}>
                                <Box component="li" sx={{ mb: 1 }}>
                                    O serviço Google AdSense que usamos para veicular publicidade usa um cookie DoubleClick para exibir anúncios mais
                                    relevantes e limitar o número de vezes que um anúncio é exibido para você.
                                </Box>
                                <Box component="li" sx={{ mb: 1 }}>
                                    Para mais informações sobre o Google AdSense, consulte as FAQs oficiais de privacidade do Google AdSense.
                                </Box>
                                <Box component="li" sx={{ mb: 1 }}>
                                    Utilizamos anúncios para compensar os custos de funcionamento deste site e financiar futuros desenvolvimentos. Os cookies
                                    de publicidade comportamental usados por este site são projetados para apresentar anúncios mais relevantes, com base em
                                    interesses de forma anônima.
                                </Box>
                                <Box component="li">
                                    Alguns parceiros anunciam em nosso nome e os cookies de rastreamento de afiliados nos permitem identificar se clientes
                                    chegaram ao site por meio de parceiros, para fins de crédito e promoções aplicáveis.
                                </Box>
                            </Box>

                            <Typography variant="h4" sx={{ mt: 1, fontWeight: 900, color: '#1f2552' }}>
                                Compromisso do usuário
                            </Typography>

                            <Typography sx={{ color: '#1f2552' }}>
                                O usuário se compromete a fazer uso adequado dos conteúdos e das informações que o Pub Mail oferece no site, incluindo, mas
                                não se limitando a:
                            </Typography>

                            <Box component="ul" sx={{ m: 0, pl: 3, color: '#1f2552' }}>
                                <Box component="li" sx={{ mb: 1 }}>
                                    Não se envolver em atividades ilegais ou contrárias à boa-fé e à ordem pública.
                                </Box>
                                <Box component="li" sx={{ mb: 1 }}>
                                    Não difundir propaganda ou conteúdo de natureza racista, xenofóbica, jogos de sorte ou azar, pornografia ilegal, apologia
                                    ao terrorismo ou contra os direitos humanos.
                                </Box>
                                <Box component="li">
                                    Não causar danos aos sistemas físicos e lógicos do Pub Mail, de seus fornecedores ou terceiros, nem introduzir vírus ou
                                    quaisquer outros sistemas capazes de causar danos.
                                </Box>
                            </Box>

                            <Typography variant="h4" sx={{ mt: 1, fontWeight: 900, color: '#1f2552' }}>
                                Mais informações
                            </Typography>

                            <Typography sx={{ color: '#1f2552' }}>
                                Esperamos que esteja esclarecido. Se houver algo que você não tem certeza se precisa ou não, geralmente é mais seguro manter
                                os cookies ativados, caso interaja com algum recurso do nosso site.
                            </Typography>

                            <Typography sx={{ color: '#59618a', fontSize: 14, pt: 1.5, borderTop: '1px solid #e6e9fb' }}>
                                Esta política é efetiva a partir de 20 de março de 2026.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
}
