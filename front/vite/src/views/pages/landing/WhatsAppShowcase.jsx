import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  IconArrowRight,
  IconBrandWhatsapp,
  IconMessages,
  IconRobot,
  IconSpeakerphone,
  IconCalendarClock,
  IconCircleDashed,
  IconAddressBook,
  IconLayoutKanban,
  IconChecklist,
  IconUserDollar,
  IconPackage,
  IconReceipt2,
  IconChartBar,
  IconBellRinging,
  IconAdjustmentsHorizontal,
  IconUsersGroup,
  IconCheck,
  IconChecks,
  IconShieldCheck,
  IconLock,
  IconPlayerPlayFilled,
  IconMicrophone,
  IconPaperclip,
  IconSend2,
  IconAlertTriangle,
  IconBulb,
  IconRepeat,
  IconCalendarEvent,
  IconTicket,
  IconShoppingCart,
  IconReportMoney
} from '@tabler/icons-react';

// ======================|| LANDING — seção "WhatsApp" (antes de Preços) ||====================== //
// Mapa completo do módulo WhatsApp do painel (menu `menu-items/whatsapp.js`): 3 destaques com
// maquete (Chat, Fluxo do Bot, Broadcasts) + grade com os demais itens, cada um com um exemplo
// de uso. Cores fixas do WhatsApp nas maquetes; o resto segue o tema (claro/escuro) do site.

const WA_GREEN = '#25D366';
const WA_DARK = '#128C7E';
const WA_TEAL = '#075E54';
const NAVY = '#0b1120';
const CONTACT_PHONE = '558988136674';
const CONTACT_URL = `https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent('Olá! Quero saber mais sobre o módulo WhatsApp do Pub Mail.')}`;

// ---------------------------------------------------------------- maquetes
function PhoneMock({ title, subtitle, children, footer = 'Digite uma mensagem' }) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 350,
        mx: 'auto',
        p: '10px',
        borderRadius: '36px',
        bgcolor: NAVY,
        boxShadow: '0 30px 70px rgba(11,17,32,.35), inset 0 0 0 1px rgba(255,255,255,.08)'
      }}
    >
      <Box
        sx={{
          borderRadius: '28px',
          overflow: 'hidden',
          bgcolor: '#efe7dd',
          minHeight: 500,
          display: 'flex',
          flexDirection: 'column',
          color: '#111b21'
        }}
      >
        <Box sx={{ bgcolor: WA_TEAL, color: '#fff', px: 2, pt: 2.25, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(255,255,255,.18)'
            }}
          >
            <IconBrandWhatsapp size={20} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.15 }} noWrap>
              {title}
            </Typography>
            <Typography sx={{ fontSize: 11.5, opacity: 0.85, lineHeight: 1.2 }} noWrap>
              {subtitle}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            flex: 1,
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.9,
            backgroundImage:
              'radial-gradient(rgba(0,0,0,.045) 1px, transparent 1px), radial-gradient(rgba(0,0,0,.03) 1px, transparent 1px)',
            backgroundSize: '18px 18px, 18px 18px',
            backgroundPosition: '0 0, 9px 9px'
          }}
        >
          {children}
        </Box>
        <Box sx={{ px: 1.25, py: 1, display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f0f2f5' }}>
          <Box
            sx={{
              flex: 1,
              height: 34,
              borderRadius: 999,
              bgcolor: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              color: '#667781',
              fontSize: 12.5
            }}
          >
            <IconPaperclip size={15} />
            {footer}
          </Box>
          <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: WA_DARK, color: '#fff', display: 'grid', placeItems: 'center' }}>
            <IconMicrophone size={17} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function Bubble({ out, children, time, tag, double = true }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start' }}>
      <Box
        sx={{
          maxWidth: '84%',
          px: 1.25,
          pt: 0.75,
          pb: 0.5,
          borderRadius: 2.25,
          borderTopLeftRadius: out ? 18 : 4,
          borderTopRightRadius: out ? 4 : 18,
          bgcolor: out ? '#d9fdd3' : '#fff',
          boxShadow: '0 1px 1px rgba(0,0,0,.08)',
          fontSize: 13,
          lineHeight: 1.4
        }}
      >
        {tag ? <Typography sx={{ fontSize: 11, fontWeight: 700, color: WA_DARK, mb: 0.25 }}>{tag}</Typography> : null}
        <Box>{children}</Box>
        <Stack direction="row" spacing={0.4} alignItems="center" justifyContent="flex-end" sx={{ mt: 0.25, color: '#667781' }}>
          <Typography sx={{ fontSize: 10.5 }}>{time}</Typography>
          {out ? <IconChecks size={14} color={double ? '#53bdeb' : '#8696a0'} /> : null}
        </Stack>
      </Box>
    </Box>
  );
}

function AudioBubble({ out, time, duration }) {
  const bars = [4, 9, 14, 8, 16, 11, 6, 13, 17, 9, 5, 12, 15, 7, 10, 14, 6, 9, 12, 5, 8, 11, 4];
  return (
    <Box sx={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start' }}>
      <Box
        sx={{
          width: '78%',
          px: 1,
          py: 0.75,
          borderRadius: 2.25,
          bgcolor: out ? '#d9fdd3' : '#fff',
          boxShadow: '0 1px 1px rgba(0,0,0,.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            bgcolor: WA_GREEN,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          <IconPlayerPlayFilled size={13} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px', height: 20 }}>
            {bars.map((h, i) => (
              <Box key={i} sx={{ width: 3, height: h, borderRadius: 2, bgcolor: i < 9 ? WA_DARK : '#b8c0c6' }} />
            ))}
          </Box>
          <Stack direction="row" justifyContent="space-between" sx={{ color: '#667781', fontSize: 10.5, mt: 0.25 }}>
            <span>{duration}</span>
            <span>{time}</span>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function SystemLine({ children }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ px: 1.25, py: 0.4, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.85)', fontSize: 11, color: '#54656f', fontWeight: 600 }}>
        {children}
      </Box>
    </Box>
  );
}

function ChatMock() {
  return (
    <PhoneMock title="Mariana Souza" subtitle="Em atendimento · Carla (Vendas)">
      <SystemLine>Hoje</SystemLine>
      <Bubble time="09:12">Oi! Vi o anúncio do curso. Ainda tem vaga para a turma de sábado?</Bubble>
      <Bubble out time="09:13" tag="Carla:">
        Tem sim, Mariana! São 4 encontros, das 9h às 12h. Quer que eu reserve a sua?
      </Bubble>
      <AudioBubble time="09:15" duration="0:21" />
      <Bubble out time="09:16" tag="Carla:">
        Perfeito. Já reservei e deixei a conversa com a etiqueta <b>Matrícula</b>. Te mando o PIX aqui mesmo.
      </Bubble>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
        {['Matrícula', 'Turma sábado', 'Quente'].map((t, i) => (
          <Box
            key={t}
            sx={{
              px: 1,
              py: 0.2,
              borderRadius: 999,
              fontSize: 10.5,
              fontWeight: 700,
              color: '#fff',
              bgcolor: ['#2e7d32', '#1565c0', '#ef6c00'][i]
            }}
          >
            {t}
          </Box>
        ))}
      </Box>
    </PhoneMock>
  );
}

function BotMock() {
  return (
    <PhoneMock title="Clínica Vida" subtitle="Bot · responde na hora" footer="Digite o número da opção">
      <Bubble time="18:40">Boa noite, queria marcar uma consulta</Bubble>
      <Bubble out time="18:40" tag="Clínica Vida">
        Boa noite! 😊 Sou o assistente da Clínica Vida. Para começar, me diga o seu <b>nome</b>.
      </Bubble>
      <Bubble time="18:41">Paulo Henrique</Bubble>
      <Bubble out time="18:41" tag="Clínica Vida">
        Prazer, Paulo! O que você precisa?
        <br />
        <b>1</b> · Agendar consulta
        <br />
        <b>2</b> · Resultado de exame
        <br />
        <b>3</b> · Falar com a recepção
      </Bubble>
      <Bubble time="18:41">3</Bubble>
      <Bubble out time="18:42" tag="Clínica Vida">
        A recepção atende das <b>8h às 18h</b>. Já deixei seu pedido na fila: amanhã cedo alguém te responde por aqui.
      </Bubble>
      <SystemLine>Conversa entrou na fila · aviso enviado à equipe</SystemLine>
    </PhoneMock>
  );
}

function BroadcastMock() {
  const rows = [
    { label: 'Vendas', color: '#25D366', sent: 548, total: 549, pct: 99.8 },
    { label: 'Suporte', color: '#8e5bf6', sent: 412, total: 549, pct: 75 }
  ];
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 420,
        mx: 'auto',
        borderRadius: 4,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 30px 70px rgba(11,17,32,.18)',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: `${WA_GREEN}22`, color: WA_DARK, display: 'grid', placeItems: 'center' }}
        >
          <IconSpeakerphone size={22} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 15 }} noWrap>
            Promoção de fim de semana
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            1.098 contatos · 5 textos sorteados · 0,3 s entre envios
          </Typography>
        </Box>
        <Chip size="small" label="Enviando" sx={{ bgcolor: `${WA_GREEN}22`, color: WA_DARK, fontWeight: 700 }} />
      </Box>
      <Stack spacing={1.75} sx={{ p: 2.5 }}>
        {rows.map((r) => (
          <Box key={r.label}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: r.color }} />
                <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{r.label}</Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                {r.sent} / {r.total}
              </Typography>
            </Stack>
            <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'action.selected', overflow: 'hidden' }}>
              <Box sx={{ width: `${r.pct}%`, height: '100%', borderRadius: 4, bgcolor: r.color }} />
            </Box>
          </Box>
        ))}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {[
            ['Entregues', '960'],
            ['Responderam', '137'],
            ['Pulados', '12']
          ].map(([k, v]) => (
            <Box key={k} sx={{ px: 1.25, py: 0.6, borderRadius: 2, bgcolor: 'action.hover', minWidth: 96 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.1 }}>
                {k}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{v}</Typography>
            </Box>
          ))}
        </Stack>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2.5,
            display: 'flex',
            gap: 1.25,
            alignItems: 'flex-start',
            bgcolor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.08)`,
            border: '1px solid',
            borderColor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.35)`
          }}
        >
          <Box sx={{ color: 'error.main', mt: 0.2 }}>
            <IconAlertTriangle size={18} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Suporte pausado sozinho</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              3 contatos seguidos bloquearam o número. Você decide se retoma.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip size="small" label="Retomar" sx={{ fontWeight: 700 }} />
              <Chip size="small" label="Enviar mesmo assim" variant="outlined" sx={{ fontWeight: 700 }} />
            </Stack>
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------- conteúdo
const HIGHLIGHTS = [
  {
    key: 'chat',
    Icon: IconMessages,
    kicker: 'Chat de atendimento',
    title: 'Vários números, uma caixa de entrada para a equipe inteira.',
    text: 'Cada atendente assume, transfere e encerra conversas. Tudo o que chega pelos números da empresa aparece num lugar só, com quem está atendendo e de qual número veio.',
    bullets: [
      'Etiquetas, respostas rápidas com "/" e assinatura automática do atendente',
      'Áudio com forma de onda, fotos, vídeos, arquivos e prévia de link',
      'Chat interno da equipe, com grupos, sem sair da tela',
      'Mensagens e mídias guardadas cifradas no servidor'
    ],
    example:
      'Uma loja com dois números (Vendas e Suporte) e três atendentes: a fila é dividida entre eles, e o gerente acompanha tudo pelo celular.',
    Mock: ChatMock
  },
  {
    key: 'bot',
    Icon: IconRobot,
    kicker: 'Fluxo do Bot',
    title: 'Um robô que recebe, pergunta e entrega para a pessoa certa.',
    text: 'Monte o fluxo arrastando blocos: boas-vindas, menu numerado, perguntas que guardam a resposta, horário de atendimento, cobrança por PIX e passagem para um humano.',
    bullets: [
      'Simulador na própria tela para testar antes de ligar',
      'Começa em modo teste: só os contatos que você escolher recebem',
      'Fora do horário avisa quando volta e deixa a conversa na fila',
      'Fluxos diferentes para números diferentes'
    ],
    example:
      'Uma clínica: o bot pergunta nome e convênio, oferece agendar, ver resultado de exame ou falar com a recepção, e à noite deixa o pedido na fila para a manhã.',
    Mock: BotMock,
    reverse: true
  },
  {
    key: 'broadcasts',
    Icon: IconSpeakerphone,
    kicker: 'Broadcasts',
    title: 'Disparo em massa com proteção contra bloqueio.',
    text: 'Vários números dividem a audiência, cada contato recebe um texto sorteado entre os seus modelos, e o ritmo é você quem define. Se um número começa a ser bloqueado, o disparo pausa sozinho.',
    bullets: [
      'Só envia para quem tem WhatsApp e não bloqueou o número',
      'Escolha de quais números vem a audiência e quem fica de fora',
      'Veja quem respondeu e exclua quem não interage há N dias',
      'Horários diários, aquecimento gradual e limite por dia'
    ],
    example:
      'Promoção de fim de semana para 1.100 contatos: dois números enviam metade cada, cinco textos circulam ao mesmo tempo e quem comprou no mês passado fica de fora.',
    Mock: BroadcastMock
  }
];

const MODULES = [
  {
    Icon: IconCalendarClock,
    title: 'Agendamentos',
    text: 'Programe uma mensagem (ou uma sequência com mídia) para contatos e grupos numa data e hora.',
    example: 'Lembrete da reunião de amanhã às 8h para os 12 participantes do grupo.'
  },
  {
    Icon: IconCircleDashed,
    title: 'Status',
    text: 'Publique status com foto, vídeo ou texto, agora ou agendado, em um ou vários números. Veja e responda os status dos seus contatos.',
    example: 'Status da oferta do dia nos dois números às 9h, sem abrir o celular.'
  },
  {
    Icon: IconAddressBook,
    title: 'Contatos',
    text: 'Agenda sincronizada dos números, tags, importação e exportação por planilha, e descadastro automático para quem pede PARE.',
    example: 'Importe a lista do evento e marque todos com a tag "feira-2026".'
  },
  {
    Icon: IconLayoutKanban,
    title: 'Funil',
    text: 'Quadro de etapas (novo, em negociação, ganho, perdido) com valor do negócio. Mover de etapa pode mandar mensagem e criar tarefa.',
    example: 'Ao arrastar para "Proposta enviada", o cliente recebe o PDF e o vendedor ganha uma tarefa de retorno em 2 dias.'
  },
  {
    Icon: IconChecklist,
    title: 'Tarefas',
    text: 'Lembretes ligados à conversa, com prazo e responsável. Avisa no painel e no celular quando vence.',
    example: '"Ligar para o Carlos sobre o contrato" na sexta às 10h, atribuída ao Marcos.'
  },
  {
    Icon: IconUserDollar,
    title: 'Clientes',
    text: 'Ficha do cliente com vários números, documento, endereços, campos personalizados, assinaturas e histórico. Importe até 50 mil clientes de uma vez.',
    example: 'Academia: cada aluno tem plano, dia de vencimento e histórico de pagamentos ao lado da conversa.'
  },
  {
    Icon: IconPackage,
    title: 'Produtos',
    text: 'Catálogo com preço e recorrência (avulso, mensal, trimestral, anual) para usar nas cobranças e no bot.',
    example: '"Plano Premium · R$ 97/mês" e "Consultoria · R$ 450 avulso".'
  },
  {
    Icon: IconReceipt2,
    title: 'Cobranças',
    text: 'PIX, boleto, cartão e link de pagamento pelo chat, cobrança recorrente gerada sozinha, lembretes antes e depois do vencimento, recibo ao pagar.',
    example: 'Todo dia 5 a mensalidade vai para cada aluno; quem atrasa recebe lembrete e a etiqueta "Inadimplente".'
  },
  {
    Icon: IconRepeat,
    title: 'Assinaturas',
    text: 'O cliente assina, paga, consulta, pede 2ª via, troca de plano, pausa e cancela pelo próprio WhatsApp. Teste grátis, proporcional, cupom, carência e cartão com débito automático.',
    example: 'Provedor: o cliente manda "2ª via", o bot confere o CPF e devolve o PIX já com multa e juros.'
  },
  {
    Icon: IconCalendarEvent,
    title: 'Agenda',
    text: 'Profissionais, salas e serviços com duração e vagas. O cliente agenda pelo bot, paga na reserva ou no local, confirma na véspera e entra na lista de espera.',
    example: 'Barbearia: "1 para confirmar, 2 para remarcar" um dia antes; vaga liberada vai para quem estava esperando.'
  },
  {
    Icon: IconTicket,
    title: 'Chamados',
    text: 'Protocolo numerado, prazo por categoria, foto pelo WhatsApp e respostas internas ou ao cliente.',
    example: 'Prefeitura: buraco na rua vira o protocolo PSA2026000118 com foto e bairro, e o cidadão acompanha pelo bot.'
  },
  {
    Icon: IconShoppingCart,
    title: 'Pedidos',
    text: 'Catálogo por categoria no bot, carrinho, entrega ou retirada, PIX ou pagamento na entrega e quadro de preparo.',
    example: 'Mercado: o cliente monta a compra no WhatsApp e acompanha "saiu para entrega" sem ligar para a loja.'
  },
  {
    Icon: IconReportMoney,
    title: 'Financeiro',
    text: 'Receita recorrente, cancelamentos, inadimplência, previsão de recebimento em 30/60/90 dias e permanência dos clientes.',
    example: 'Saiba hoje quanto entra nos próximos 30 dias e quantos clientes estão em atraso.'
  },
  {
    Icon: IconChartBar,
    title: 'Métricas',
    text: 'Tempo da primeira resposta, tempo de resolução, volume por atendente e etiqueta, funil, cobranças e nota de satisfação.',
    example: 'Descubra que a Ana responde em 4 min e o turno da tarde demora 40.'
  },
  {
    Icon: IconBellRinging,
    title: 'Notificações',
    text: 'Aviso no painel e push no celular, mesmo com o app fechado. Cada pessoa escolhe o que recebe: mensagens, fila, pagamentos, tarefas.',
    example: 'O dono só é avisado quando entra pagamento; o atendente, a cada mensagem do número dele.'
  },
  {
    Icon: IconUsersGroup,
    title: 'Equipe',
    text: 'Conversas e grupos entre os usuários do painel, com arquivos e respostas, separados das conversas com clientes.',
    example: 'O supervisor manda a tabela nova para o grupo "Vendas" sem usar o WhatsApp pessoal.'
  },
  {
    Icon: IconAdjustmentsHorizontal,
    title: 'Configurações',
    text: 'Conecte quantos números quiser pelo QR code, com nome e cor para cada um, aquecimento gradual e acesso por número para cada usuário.',
    example: 'O estagiário só vê o número de Suporte; a diretoria vê todos.'
  }
];

const PILLARS = [
  { Icon: IconMessages, label: 'Atendimento' },
  { Icon: IconRobot, label: 'Automação' },
  { Icon: IconUserDollar, label: 'CRM e cobrança' },
  { Icon: IconShieldCheck, label: 'Proteção anti-bloqueio' }
];

// ---------------------------------------------------------------- blocos
function Highlight({ item, index }) {
  const { Icon, Mock } = item;
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 4, md: 6 },
        alignItems: 'center',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' }
      }}
    >
      <Box sx={{ order: { xs: 1, md: item.reverse ? 2 : 1 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              color: WA_DARK,
              bgcolor: `${WA_GREEN}22`
            }}
          >
            <Icon size={22} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: WA_DARK }}>
            {String(index + 1).padStart(2, '0')} · {item.kicker}
          </Typography>
        </Stack>
        <Typography component="h3" sx={{ fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.12, fontSize: { xs: 26, md: 34 } }}>
          {item.title}
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: { xs: 15.5, md: 17 }, mt: 1.5, maxWidth: 560 }}>{item.text}</Typography>
        <Stack spacing={1} sx={{ mt: 2.5 }}>
          {item.bullets.map((b) => (
            <Stack key={b} direction="row" spacing={1.25} alignItems="flex-start">
              <Box sx={{ color: WA_DARK, mt: '3px', flexShrink: 0 }}>
                <IconCheck size={17} stroke={2.5} />
              </Box>
              <Typography sx={{ fontSize: 15 }}>{b}</Typography>
            </Stack>
          ))}
        </Stack>
        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 3,
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: `4px solid ${WA_GREEN}`
          }}
        >
          <Box sx={{ color: WA_DARK, mt: 0.25, flexShrink: 0 }}>
            <IconBulb size={20} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
              Na prática
            </Typography>
            <Typography sx={{ fontSize: 14.5, mt: 0.25 }}>{item.example}</Typography>
          </Box>
        </Box>
      </Box>
      <Box sx={{ order: { xs: 2, md: item.reverse ? 1 : 2 }, px: { xs: 1, sm: 0 } }}>
        <Mock />
      </Box>
    </Box>
  );
}

function ModuleCard({ item }) {
  const { Icon } = item;
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 3.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 18px 40px rgba(11,17,32,.12)', borderColor: `${WA_GREEN}99` }
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color: WA_DARK,
            bgcolor: `${WA_GREEN}1f`
          }}
        >
          <Icon size={22} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>{item.title}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 14.5, color: 'text.secondary', lineHeight: 1.5 }}>{item.text}</Typography>
      <Box sx={{ mt: 'auto', pt: 1.75 }}>
        <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: 'action.hover', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Box sx={{ color: WA_DARK, mt: '1px', flexShrink: 0 }}>
            <IconBulb size={16} />
          </Box>
          <Typography sx={{ fontSize: 13.5, lineHeight: 1.45 }}>{item.example}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function WhatsAppShowcase({ onNav }) {
  return (
    <Box
      id="whatsapp"
      component="section"
      sx={{
        position: 'relative',
        py: { xs: 8, md: 12 },
        overflow: 'hidden',
        bgcolor: 'background.default',
        backgroundImage: `radial-gradient(900px 420px at 100% 0%, ${WA_GREEN}1a, transparent 60%), radial-gradient(700px 380px at 0% 100%, ${WA_GREEN}12, transparent 60%)`
      }}
    >
      <Container maxWidth="xl">
        {/* cabeçalho da seção */}
        <Stack alignItems="center" spacing={2} sx={{ textAlign: 'center', maxWidth: 820, mx: 'auto' }}>
          <Chip
            icon={<IconBrandWhatsapp size={18} />}
            label="Módulo WhatsApp"
            sx={{
              color: WA_DARK,
              bgcolor: `${WA_GREEN}22`,
              border: `1px solid ${WA_GREEN}66`,
              fontWeight: 800,
              '& .MuiChip-icon': { color: WA_DARK }
            }}
          />
          <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, fontSize: { xs: 30, md: 44 } }}>
            O WhatsApp da sua empresa vira uma central de atendimento e vendas.
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: { xs: 15.5, md: 18 }, maxWidth: 700 }}>
            Conecte os números que você já usa e ganhe equipe, bot, funil, cobrança por PIX e disparos em massa, tudo no mesmo painel, no
            computador e no celular.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center" sx={{ pt: 0.5 }}>
            {PILLARS.map((p) => (
              <Chip
                key={p.label}
                icon={<p.Icon size={16} />}
                label={p.label}
                variant="outlined"
                sx={{ fontWeight: 700, borderColor: 'divider', bgcolor: 'background.paper', '& .MuiChip-icon': { color: WA_DARK } }}
              />
            ))}
          </Stack>
        </Stack>

        {/* destaques com maquete */}
        <Stack spacing={{ xs: 8, md: 12 }} sx={{ mt: { xs: 7, md: 10 } }}>
          {HIGHLIGHTS.map((h, i) => (
            <Highlight key={h.key} item={h} index={i} />
          ))}
        </Stack>

        {/* grade com o restante */}
        <Box sx={{ mt: { xs: 9, md: 13 } }}>
          <Stack alignItems="center" spacing={1} sx={{ textAlign: 'center', mb: 4 }}>
            <Typography component="h3" sx={{ fontWeight: 800, letterSpacing: '-0.025em', fontSize: { xs: 24, md: 32 } }}>
              E tudo o mais que um atendimento precisa
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: { xs: 15, md: 16.5 }, maxWidth: 620 }}>
              Cada item abaixo é uma tela do painel. Juntos, cobrem o dia a dia inteiro de quem vende e atende pelo WhatsApp.
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0,1fr))',
                lg: 'repeat(3, minmax(0,1fr))',
                xl: 'repeat(4, minmax(0,1fr))'
              }
            }}
          >
            {MODULES.map((m) => (
              <ModuleCard key={m.title} item={m} />
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
            background: `radial-gradient(700px 260px at 0% 0%, rgba(37,211,102,.35), transparent 60%), linear-gradient(135deg, #0f2d2a, ${NAVY})`,
            boxShadow: '0 30px 70px rgba(11,17,32,.3)'
          }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, color: '#9ff0c0' }}>
              <IconLock size={18} />
              <Typography sx={{ fontWeight: 700, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Seus dados, no seu servidor
              </Typography>
            </Stack>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 22, md: 28 }, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              Comece com um número hoje e adicione os outros quando quiser.
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,.75)', mt: 1, fontSize: { xs: 15, md: 16.5 }, maxWidth: 640 }}>
              Conexão por QR code em menos de um minuto. Mensagens e mídias ficam cifradas, com acesso por número para cada pessoa da
              equipe.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              size="large"
              variant="contained"
              disableElevation
              onClick={() => onNav?.('precos')}
              endIcon={<IconArrowRight size={18} />}
              sx={{ bgcolor: WA_GREEN, color: '#062b16', fontWeight: 800, borderRadius: 2.5, px: 3, '&:hover': { bgcolor: '#1fc45a' } }}
            >
              Ver o plano WhatsApp
            </Button>
            <Button
              size="large"
              variant="outlined"
              component="a"
              href={CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<IconSend2 size={18} />}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,.3)',
                fontWeight: 700,
                borderRadius: 2.5,
                px: 3,
                '&:hover': { borderColor: WA_GREEN, bgcolor: 'rgba(37,211,102,.12)' }
              }}
            >
              Tirar dúvidas
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
