import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  IconArrowRight,
  IconRepeat,
  IconUserPlus,
  IconReceipt2,
  IconFileInvoice,
  IconCalendarEvent,
  IconPlayerPause,
  IconCreditCard,
  IconLink,
  IconCash,
  IconStethoscope,
  IconWifi,
  IconBuildingStore,
  IconShieldLock,
  IconCrown,
  IconBuildingCommunity,
  IconBasket,
  IconReportMoney,
  IconSend,
  IconFileImport,
  IconHistory,
  IconApi,
  IconUsersGroup,
  IconForms,
  IconTicket,
  IconShoppingCart,
  IconRobot,
  IconCheck,
  IconQrcode,
  IconScale,
  IconPlugConnected
} from '@tabler/icons-react';

// ======================|| LANDING — seção "Assinaturas" (entre WhatsApp e Preços) ||====================== //
// Plano de assinaturas do WhatsApp (fases 1–8): o cliente se cadastra, assina, paga, consulta, pede 2ª via,
// agenda, abre chamado, faz pedido e cancela pelo próprio WhatsApp; meios de pagamento; modelos por ramo;
// operação (financeiro, fila, importação, auditoria/LGPD, API). Maquete com cores fixas do WhatsApp; o resto
// segue o tema (claro/escuro) do site.

const BLUE = '#377EF0';
const BLUE_DARK = '#1E5FD0';
const NAVY = '#0b1120';
const WA_GREEN = '#25D366';
const CONTACT_URL = `https://wa.me/558988136674?text=${encodeURIComponent('Olá! Quero saber mais sobre as assinaturas pelo WhatsApp no Pub Mail.')}`;

const JOURNEY = [
  {
    Icon: IconUserPlus,
    title: 'Cadastro',
    text: 'O bot pergunta nome, documento, e-mail e o que mais a sua empresa precisar — o cliente se cadastra sozinho.'
  },
  {
    Icon: IconRepeat,
    title: 'Assinatura',
    text: 'Escolhe o plano na conversa, com teste grátis, proporcional, cupom e o dia de vencimento que preferir.'
  },
  {
    Icon: IconReceipt2,
    title: 'Cobrança automática',
    text: 'A cobrança sai sozinha antes do vencimento, com lembretes antes, no dia e depois. Pagou, liberou.'
  },
  {
    Icon: IconFileInvoice,
    title: 'Consulta e 2ª via',
    text: '"Quero a 2ª via": o bot confere quem é e devolve o PIX ou o boleto já com multa e juros.'
  },
  {
    Icon: IconCalendarEvent,
    title: 'Agenda, chamados e pedidos',
    text: 'Marca horário, abre chamado com foto e protocolo, faz pedido do catálogo e acompanha tudo pelo WhatsApp.'
  },
  {
    Icon: IconPlayerPause,
    title: 'Troca, pausa e cancelamento',
    text: 'Troca de plano com crédito do que já pagou, pausa até uma data e cancelamento com a regra que você definir.'
  }
];

const PAYMENTS = [
  { Icon: IconQrcode, label: 'PIX' },
  { Icon: IconFileInvoice, label: 'Boleto' },
  { Icon: IconCreditCard, label: 'Cartão com débito automático' },
  { Icon: IconLink, label: 'Link de pagamento' },
  { Icon: IconCash, label: 'Parcelamento' },
  { Icon: IconScale, label: 'Multa e juros na 2ª via' },
  { Icon: IconCheck, label: 'Conciliação com o gateway' }
];

const VERTICALS = [
  {
    Icon: IconStethoscope,
    title: 'Clínica / consultório',
    text: 'Consultas com profissional e horário, planos com consultas inclusas, confirmação na véspera.'
  },
  {
    Icon: IconWifi,
    title: 'Provedor de internet',
    text: 'Planos de fibra, 2ª via, "estou sem internet" com roteiro e chamado técnico com protocolo.'
  },
  { Icon: IconBuildingStore, title: 'Loja', text: 'Catálogo por categoria, carrinho, entrega ou retirada e PIX no próprio WhatsApp.' },
  {
    Icon: IconShieldLock,
    title: 'Segurança e monitoramento',
    text: 'Ocorrência urgente direto para a central, chamados de equipamento e planos mensais.'
  },
  { Icon: IconCrown, title: 'Conteúdo VIP', text: 'Plano mensal e anual, entrada no grupo VIP ao pagar e saída automática no atraso.' },
  {
    Icon: IconBuildingCommunity,
    title: 'Prefeitura',
    text: 'Protocolos com foto, bairro e prazo; o cidadão acompanha o andamento pelo bot.'
  },
  {
    Icon: IconBasket,
    title: 'Mercado / delivery',
    text: 'Pedido mínimo, frete grátis acima de um valor e o cliente acompanha "saiu para entrega".'
  }
];

const OPERATIONS = [
  {
    Icon: IconReportMoney,
    title: 'Financeiro',
    text: 'Receita recorrente, cancelamentos, inadimplência, previsão de 30/60/90 dias e permanência dos clientes.'
  },
  {
    Icon: IconSend,
    title: 'Fila de envios',
    text: 'Cobranças e avisos saem num ritmo seguro por número; se o WhatsApp restringir um número, ele pausa sozinho.'
  },
  {
    Icon: IconFileImport,
    title: 'Importação em massa',
    text: 'Traga até 50 mil clientes de uma planilha, com histórico de pagamentos e saldo, sem mandar mensagem a ninguém.'
  },
  {
    Icon: IconHistory,
    title: 'Auditoria',
    text: 'Quem mudou o quê e quando — preço, assinatura, cobrança, cadastro — com o antes e o depois.'
  },
  {
    Icon: IconShieldLock,
    title: 'LGPD',
    text: 'Exporte os dados de um cliente ou apague-os de vez, mantendo só o que a lei fiscal exige.'
  },
  {
    Icon: IconApi,
    title: 'API e webhooks',
    text: 'Seu sistema cria clientes, assinaturas e cobranças e é avisado na hora quando algo acontece.'
  },
  {
    Icon: IconUsersGroup,
    title: 'Permissões da equipe',
    text: 'O atendente atende sem ver o financeiro nem mexer nas configurações; acesso por número.'
  },
  {
    Icon: IconForms,
    title: 'Campos do seu negócio',
    text: 'Placa, plano de saúde, contrato: campos próprios em clientes, pedidos, chamados e agendamentos.'
  }
];

// ---------------------------------------------------------------- maquete: conversa com o bot
function Bubble({ out, children }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start' }}>
      <Box
        sx={{
          maxWidth: '82%',
          px: 1.25,
          py: 0.75,
          borderRadius: 2,
          fontSize: 13,
          lineHeight: 1.4,
          color: '#111b21',
          bgcolor: out ? '#d9fdd3' : '#fff',
          boxShadow: '0 1px 1px rgba(11,20,26,.12)',
          whiteSpace: 'pre-line'
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function SelfServiceMock() {
  return (
    <Box
      aria-hidden
      sx={{
        width: '100%',
        maxWidth: 360,
        mx: 'auto',
        borderRadius: 5,
        p: 1.25,
        bgcolor: '#111b21',
        boxShadow: '0 30px 80px rgba(11,17,32,.35)'
      }}
    >
      <Box sx={{ borderRadius: 4, overflow: 'hidden', bgcolor: '#efeae2' }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1.75, py: 1.25, bgcolor: '#075E54', color: '#fff' }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 999, bgcolor: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}>
            <IconRobot size={19} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.2 }}>Fibra Max Internet</Typography>
            <Typography sx={{ fontSize: 11.5, opacity: 0.8 }}>atendimento automático</Typography>
          </Box>
        </Stack>
        <Stack spacing={0.9} sx={{ p: 1.5, minHeight: 360 }}>
          <Bubble out>2ª via</Bubble>
          <Bubble>
            Olá, Ana! Encontrei 1 fatura em aberto do Plano 500 MB:{'\n'}vencida em 10/10 · R$ 129,90{'\n'}+ multa e juros: R$ 3,45
          </Bubble>
          <Bubble>💳 PIX copia e cola:{'\n'}00020126580014br.gov.bcb…</Bubble>
          <Bubble out>Pago ✅</Bubble>
          <Bubble>Pagamento confirmado! Sua conexão segue liberada. Até o próximo mês 🙂</Bubble>
          <Bubble out>Quero trocar para o plano de 1 GB</Bubble>
          <Bubble>Feito! O valor que você já pagou virou crédito. A diferença vem na próxima fatura, dia 10/11.</Bubble>
        </Stack>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------- cartões
function IconBadge({ Icon, color = BLUE }) {
  return (
    <Box
      sx={{ width: 40, height: 40, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: `${color}1f`, color, flexShrink: 0 }}
    >
      <Icon size={21} stroke={1.9} />
    </Box>
  );
}

function InfoCard({ item, color }) {
  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: 3,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        height: '100%',
        transition: 'transform .2s, box-shadow .2s',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 14px 34px rgba(11,17,32,.08)' }
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <IconBadge Icon={item.Icon} color={color} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.4 }}>{item.title}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14.5, lineHeight: 1.5 }}>{item.text}</Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function SubTitle({ title, text }) {
  return (
    <Stack alignItems="center" spacing={1} sx={{ textAlign: 'center', mb: 4 }}>
      <Typography component="h3" sx={{ fontWeight: 800, letterSpacing: '-0.025em', fontSize: { xs: 24, md: 32 } }}>
        {title}
      </Typography>
      {text && <Typography sx={{ color: 'text.secondary', fontSize: { xs: 15, md: 16.5 }, maxWidth: 660 }}>{text}</Typography>}
    </Stack>
  );
}

const GRID = (lg) => ({
  display: 'grid',
  gap: 2,
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: `repeat(${lg}, minmax(0,1fr))` }
});

export default function SubscriptionsShowcase({ onNav }) {
  return (
    <Box
      id="assinaturas"
      component="section"
      sx={{
        position: 'relative',
        py: { xs: 8, md: 12 },
        overflow: 'hidden',
        bgcolor: 'background.paper',
        backgroundImage: `radial-gradient(900px 420px at 0% 0%, ${BLUE}14, transparent 60%), radial-gradient(700px 380px at 100% 100%, ${BLUE}10, transparent 60%)`,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Container maxWidth="xl">
        {/* cabeçalho + maquete */}
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 5, md: 8 },
            alignItems: 'center',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.15fr) minmax(0,1fr)' }
          }}
        >
          <Stack spacing={2.25} sx={{ textAlign: { xs: 'center', md: 'left' }, alignItems: { xs: 'center', md: 'flex-start' } }}>
            <Chip
              icon={<IconRepeat size={18} />}
              label="Assinaturas e autoatendimento"
              sx={{
                color: BLUE_DARK,
                bgcolor: `${BLUE}1f`,
                border: `1px solid ${BLUE}55`,
                fontWeight: 800,
                '& .MuiChip-icon': { color: BLUE_DARK }
              }}
            />
            <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, fontSize: { xs: 30, md: 44 } }}>
              Seu cliente assina, paga e se resolve sozinho — pelo WhatsApp.
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: { xs: 15.5, md: 18 }, maxWidth: 620 }}>
              Planos mensais com cobrança automática, 2ª via, troca de plano, agenda, chamados e pedidos atendidos pelo bot, 24 horas por
              dia. A equipe só entra quando precisa.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'center', md: 'flex-start' }}>
              {PAYMENTS.map((p) => (
                <Chip
                  key={p.label}
                  icon={<p.Icon size={16} />}
                  label={p.label}
                  variant="outlined"
                  sx={{ fontWeight: 700, borderColor: 'divider', bgcolor: 'background.default', '& .MuiChip-icon': { color: BLUE } }}
                />
              ))}
            </Stack>
          </Stack>
          <SelfServiceMock />
        </Box>

        {/* jornada */}
        <Box sx={{ mt: { xs: 9, md: 12 } }}>
          <SubTitle
            title="Do cadastro ao cancelamento, sem atendente"
            text="Cada etapa é um bloco pronto no Fluxo do Bot. Você monta a conversa arrastando, com os seus textos."
          />
          <Box sx={GRID(3)}>
            {JOURNEY.map((j, i) => (
              <Box key={j.title} sx={{ position: 'relative', height: '100%' }}>
                <Typography
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    top: 10,
                    right: 16,
                    fontWeight: 900,
                    fontSize: 34,
                    color: 'text.disabled',
                    opacity: 0.35,
                    lineHeight: 1
                  }}
                >
                  {i + 1}
                </Typography>
                <InfoCard item={j} />
              </Box>
            ))}
          </Box>
        </Box>

        {/* modelos por ramo */}
        <Box sx={{ mt: { xs: 9, md: 12 } }}>
          <SubTitle
            title="Pronto para o seu ramo em um clique"
            text="Escolha um modelo e ganhe produtos, campos, etiquetas, funil e o fluxo do bot já montados — tudo editável depois."
          />
          <Box sx={GRID(4)}>
            {VERTICALS.map((v) => (
              <InfoCard key={v.title} item={v} color={WA_GREEN} />
            ))}
            <Box
              sx={{
                p: 2.25,
                borderRadius: 3,
                border: '1px dashed',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5
              }}
            >
              <IconBadge Icon={IconPlugConnected} color="#8b5cf6" />
              <Typography sx={{ color: 'text.secondary', fontSize: 14.5, lineHeight: 1.5 }}>
                Outro ramo? Comece do zero com os mesmos blocos: serviços com horário, catálogo, protocolos e planos.
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* operação */}
        <Box sx={{ mt: { xs: 9, md: 12 } }}>
          <SubTitle
            title="Feito para operar com milhares de clientes"
            text="O que roda nos bastidores para a cobrança sair certa, no tempo certo, com controle."
          />
          <Box sx={GRID(4)}>
            {OPERATIONS.map((o) => (
              <InfoCard key={o.title} item={o} />
            ))}
          </Box>
        </Box>

        {/* chamada */}
        <Box
          sx={{
            mt: { xs: 7, md: 10 },
            p: { xs: 3, md: 4.5 },
            borderRadius: 4,
            color: '#fff',
            display: 'grid',
            gap: 3,
            alignItems: 'center',
            gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
            background: `radial-gradient(700px 260px at 0% 0%, rgba(55,126,240,.45), transparent 60%), linear-gradient(135deg, #12204a, ${NAVY})`,
            boxShadow: '0 30px 70px rgba(11,17,32,.3)'
          }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, color: '#bcd3ff' }}>
              <IconTicket size={18} />
              <IconShoppingCart size={18} />
              <IconCalendarEvent size={18} />
              <Typography sx={{ fontWeight: 700, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Incluído no plano WhatsApp
              </Typography>
            </Stack>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 22, md: 28 }, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              Transforme o WhatsApp no caixa da sua empresa.
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,.75)', mt: 1, fontSize: { xs: 15, md: 16.5 }, maxWidth: 640 }}>
              Assinaturas, cobranças, agenda, chamados e pedidos fazem parte do módulo WhatsApp, no mesmo painel do atendimento.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              size="large"
              variant="contained"
              disableElevation
              onClick={() => onNav?.('precos')}
              endIcon={<IconArrowRight size={18} />}
              sx={{ bgcolor: BLUE, fontWeight: 800, borderRadius: 2.5, px: 3, '&:hover': { bgcolor: BLUE_DARK } }}
            >
              Ver planos
            </Button>
            <Button
              size="large"
              variant="outlined"
              component="a"
              href={CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<IconSend size={18} />}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,.3)',
                fontWeight: 700,
                borderRadius: 2.5,
                px: 3,
                '&:hover': { borderColor: BLUE, bgcolor: 'rgba(55,126,240,.14)' }
              }}
            >
              Falar com a gente
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
