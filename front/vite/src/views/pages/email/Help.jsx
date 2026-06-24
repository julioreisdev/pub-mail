// src/views/pages/email/Help.jsx
import { Box, Divider, Stack, Typography } from '@mui/material';

import MainCard from 'ui-component/cards/MainCard';

export default function EmailHelp() {
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
                    <Stack spacing={2.5}>
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
                                Ajuda — E-mail Marketing
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Guia rápido com as principais informações sobre envio, importação de leads e templates.
                            </Typography>
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
                                1) Envio
                            </Typography>

                            <Stack component="ul" spacing={1} sx={{ pl: 2.5, m: 0 }}>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Usamos um serviço baseado na <b>Amazon SES</b>. A robustez do SES está integrada a mecanismos de controle de terceiros e a
                                    implementações próprias para aumentar as chances de entrega na caixa de entrada.
                                </Typography>

                                <Typography component="li" variant="body2" color="text.secondary">
                                    Mantemos diversas medidas ativas, como <b>controle de reputação</b>, <b>monitoramento de entregabilidade</b> e{' '}
                                    <b>verificação de endereços de e-mail</b>, para garantir a melhor experiência possível.
                                </Typography>

                                <Typography component="li" variant="body2" color="text.secondary">
                                    Disparamos a uma velocidade de até <b>200 e-mails por segundo</b>, seguindo boas práticas e respeitando políticas de{' '}
                                    <i>rate limit</i> para maximizar a entregabilidade.
                                </Typography>

                                <Typography component="li" variant="body2" color="text.secondary">
                                    Um <b>pixel de abertura</b> é vinculado a cada e-mail enviado, permitindo rastrear aberturas com precisão. Porém, nos
                                    primeiros disparos as métricas podem apresentar alguma imprecisão devido a robôs de verificação (principalmente enquanto o
                                    domínio ainda está construindo reputação).
                                </Typography>
                            </Stack>
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
                                2) Importação de leads
                            </Typography>

                            <Stack component="ul" spacing={1} sx={{ pl: 2.5, m: 0 }}>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    A importação de leads é feita por um processo <b>assíncrono</b>, com processamento em segundo plano para manter uma
                                    experiência fluida.
                                </Typography>

                                <Typography component="li" variant="body2" color="text.secondary">
                                    O fluxo é otimizado para lidar com <b>grandes volumes</b> de dados, garantindo importação eficiente e estável mesmo com
                                    listas extensas.
                                </Typography>

                                <Typography component="li" variant="body2" color="text.secondary">
                                    Durante a importação, os leads passam por validações para garantir a qualidade dos dados, incluindo verificação de{' '}
                                    <b>formato</b>, <b>duplicidade</b> e <b>integridade</b>.
                                </Typography>
                            </Stack>
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
                                3) Templates e caixa de entrada
                            </Typography>

                            <Stack component="ul" spacing={1} sx={{ pl: 2.5, m: 0 }}>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Recomendamos fazer uma análise criteriosa do template. Grandes provedores (Gmail, Outlook etc.) usam filtros rigorosos —
                                    tente deixar o e-mail o mais parecido possível com uma mensagem “pessoa para pessoa” (ex.: de um colega de trabalho para
                                    outro).
                                </Typography>

                                <Typography component="li" variant="body2" color="text.secondary">
                                    Use nossa <b>I.A.</b> para gerar templates: ela é treinada para produzir estruturas que tendem a passar melhor pelos
                                    filtros de spam dos principais provedores.
                                </Typography>

                                <Typography component="li" variant="body2" color="text.secondary">
                                    Após cada envio, os templates podem ser apagados. A exceção é quando o projeto tem apenas <b>2 templates</b>
                                    cadastrados — nesse caso, eles são mantidos para garantir variação nos próximos envios e reduzir chance de identificação
                                    como spam.
                                </Typography>

                                <Typography component="li" variant="body2" color="text.secondary">
                                    Cadastre <b>vários templates</b> para manter os envios sempre diferentes.
                                </Typography>
                            </Stack>
                        </Box>
                    </Stack>
                </Box>
            </MainCard>
        </Box>
    );
}
