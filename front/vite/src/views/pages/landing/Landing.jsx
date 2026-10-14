import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import { keyframes } from '@mui/material/styles';
import {
  IconArrowRight,
  IconBrandWhatsapp,
  IconMailBolt,
  IconBrandTelegram,
  IconListLetters,
  IconMessageChatbot,
  IconBrandWordpress,
  IconCheck,
  IconCode,
  IconLogin2,
  IconMenu2,
  IconSparkles,
  IconX,
  IconLayoutGrid
} from '@tabler/icons-react';

import { useAuth } from 'contexts/AuthContext';
import FlowDiagram, { CHANNELS } from './FlowDiagram';
import WhatsAppShowcase from './WhatsAppShowcase';
import SubscriptionsShowcase from './SubscriptionsShowcase';

// ================================|| LANDING (/) ||================================ //
// Cabeçalho fixo (Início · Preços · Entrar) → hero escuro com o fluxograma grande → planos
// (mensal/anual com desconto por módulo) → código-fonte → contato. Cores fiéis ao sistema:
// primary #377EF0 (azul), navy #0b1120 / #151d30 (escuros do tema), verde WhatsApp nos CTAs de contato.

const NAVY = '#0b1120';
const PRIMARY = '#377EF0';
const PRIMARY_DARK = '#1e5dc8';
const WA_GREEN = '#25D366';
const WA_DARK = '#128C7E';
const HEADER_H = 72;
const CONTACT_PHONE = '558988136674';
const CONTACT_URL = `https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent('Olá! Quero saber mais sobre o Pub Mail.')}`;

// Preço mensal em reais e desconto no anual (pedido do dono).
const PLANS = [
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    Icon: IconBrandWhatsapp,
    color: '#25D366',
    monthly: 697,
    annualOff: 0.4,
    items: [
      'Vários números por empresa',
      'Chat multiatendente, etiquetas e respostas rápidas',
      'Bot de atendimento com PIX',
      'Assinaturas e autoatendimento pelo bot',
      'CRM: clientes, funil, tarefas e cobranças',
      'Agenda, chamados e pedidos',
      'Broadcasts com ritmo anti-bloqueio',
      'Status, agendamentos e métricas'
    ]
  },
  {
    key: 'email',
    name: 'E-mail marketing',
    Icon: IconMailBolt,
    color: '#f59e0b',
    monthly: 297,
    annualOff: 0.3,
    items: [
      'Construtor visual de e-mails',
      'Agendamentos e segmentação',
      'Teste A/B de assunto e template',
      'Fluxo inicial, gatilhos e reciclagem',
      'Entrega, bounce e analytics'
    ]
  },
  {
    key: 'webchat',
    name: 'Webchat com IA',
    Icon: IconMessageChatbot,
    color: PRIMARY,
    monthly: 397,
    annualOff: 0.3,
    items: [
      'Agentes com 6 provedores de IA',
      'Construtor de funil',
      'Cobrança PIX e entrega de produto',
      'Blocos de anúncios',
      'Domínio próprio com HTTPS'
    ]
  },
  {
    key: 'telegram',
    name: 'Telegram',
    Icon: IconBrandTelegram,
    color: '#2AABEE',
    monthly: 197,
    annualOff: 0.2,
    items: ['Bots e fluxo inicial', 'Broadcasts e automações', 'Grupos, canais e DMs', 'Venda de conteúdo VIP por PIX', 'Mensagem rotativa']
  },
  {
    key: 'quiz',
    name: 'Quizzes',
    Icon: IconListLetters,
    color: '#a855f7',
    monthly: 97,
    annualOff: 0.1,
    items: [
      'Construtor visual com presets',
      'Captação de leads',
      'Redirecionamento por resposta',
      'Blocos de anúncios',
      'Domínio próprio com HTTPS'
    ]
  },
  {
    key: 'wordpress',
    name: 'WordPress',
    Icon: IconBrandWordpress,
    color: '#64748b',
    monthly: 197,
    annualOff: 0.2,
    items: [
      'Tradutor Invisível: cada visitante lê no idioma dele, com URL traduzida',
      'Push In Play: notificações push do seu site, sem serviço externo',
      'Popup de permissão com teste A/B e app na tela inicial (iPhone)',
      'Automação de boas-vindas e broadcasts por horário com sorteio de copys',
      'Copys importadas de planilha, métricas por copy e por disparo',
      'Sites ilimitados, licença pela conta e atualização automática'
    ]
  }
];
const ALL_PLAN = { name: 'Todos os módulos', monthly: 1497, annualOff: 0.6 };
const SOURCE_PRICE = 10000;

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const annualTotal = (p) => Math.round(p.monthly * 12 * (1 - p.annualOff));
const perMonthAnnual = (p) => Math.round(annualTotal(p) / 12);

const floatKf = keyframes`0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}`;

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_H + 1;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

// ---------------------------------------------------------------- cabeçalho fixo
function Header({ active, onNav, isAuthenticated }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const items = [
    { id: 'inicio', label: 'Início' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'assinaturas', label: 'Assinaturas' },
    { id: 'precos', label: 'Preços' }
  ];
  const NavLink = ({ id, label }) => (
    <Button
      onClick={() => {
        onNav(id);
        setOpen(false);
      }}
      sx={{
        color: active === id ? '#fff' : 'rgba(255,255,255,.72)',
        fontWeight: 700,
        fontSize: 15,
        px: 1.5,
        borderRadius: 2,
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 4,
          height: 2,
          borderRadius: 2,
          bgcolor: PRIMARY,
          opacity: active === id ? 1 : 0,
          transition: 'opacity .2s'
        },
        '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,.06)' }
      }}
    >
      {label}
    </Button>
  );
  const enter = (
    <Button
      variant="contained"
      disableElevation
      onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
      startIcon={isAuthenticated ? <IconLayoutGrid size={18} /> : <IconLogin2 size={18} />}
      sx={{
        bgcolor: PRIMARY,
        '&:hover': { bgcolor: PRIMARY_DARK },
        fontWeight: 700,
        borderRadius: 2.5,
        px: 2.5,
        boxShadow: '0 8px 24px rgba(55,126,240,.35)'
      }}
    >
      {isAuthenticated ? 'Ir ao painel' : 'Entrar'}
    </Button>
  );
  return (
    <Box
      component="header"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        height: HEADER_H,
        display: 'flex',
        alignItems: 'center',
        color: '#fff',
        bgcolor: scrolled ? 'rgba(11,17,32,.86)' : 'rgba(11,17,32,.35)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid',
        borderColor: scrolled ? 'rgba(255,255,255,.08)' : 'transparent',
        transition: 'background-color .25s, border-color .25s'
      }}
    >
      <Container maxWidth="xl" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box onClick={() => onNav('inicio')} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer' }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '11px',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: '-0.02em',
              background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
              boxShadow: '0 10px 30px rgba(55,126,240,.45)'
            }}
          >
            PM
          </Box>
          <Box sx={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Pub
            <Box component="span" sx={{ color: '#5b9bff', ml: 0.5 }}>
              Mail
            </Box>
          </Box>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
          {items.map((it) => (
            <NavLink key={it.id} {...it} />
          ))}
          <Box sx={{ width: 12 }} />
          {enter}
        </Stack>
        <IconButton
          onClick={() => setOpen(true)}
          sx={{ display: { xs: 'inline-flex', md: 'none' }, color: '#fff' }}
          aria-label="Abrir menu"
        >
          <IconMenu2 size={24} />
        </IconButton>
      </Container>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 280, bgcolor: NAVY, color: '#fff', p: 2 } }}
      >
        <Stack direction="row" justifyContent="flex-end">
          <IconButton onClick={() => setOpen(false)} sx={{ color: '#fff' }} aria-label="Fechar menu">
            <IconX size={22} />
          </IconButton>
        </Stack>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {items.map((it) => (
            <NavLink key={it.id} {...it} />
          ))}
          <Box sx={{ pt: 1 }}>{enter}</Box>
        </Stack>
      </Drawer>
    </Box>
  );
}

// ---------------------------------------------------------------- hero
function Hero({ onNav }) {
  return (
    <Box
      id="inicio"
      component="section"
      sx={{
        position: 'relative',
        color: '#fff',
        minHeight: '100vh',
        pt: `${HEADER_H + 24}px`,
        pb: { xs: 8, md: 10 },
        overflow: 'hidden',
        background: `radial-gradient(1200px 600px at 10% -10%, rgba(55,126,240,.28), transparent 60%),
                     radial-gradient(900px 500px at 110% 110%, rgba(37,211,102,.14), transparent 55%),
                     linear-gradient(160deg, ${NAVY} 0%, #101a33 60%, #0b1120 100%)`
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at center, #000 40%, transparent 85%)',
          pointerEvents: 'none'
        }}
      />
      <Container maxWidth="xl" sx={{ position: 'relative' }}>
        <Stack alignItems="center" spacing={2} sx={{ textAlign: 'center', maxWidth: 860, mx: 'auto' }}>
          <Chip
            icon={<IconSparkles size={16} />}
            label="Plataforma completa de captação, atendimento e vendas"
            sx={{
              color: '#cfe0ff',
              bgcolor: 'rgba(55,126,240,.14)',
              border: '1px solid rgba(55,126,240,.35)',
              fontWeight: 700,
              '& .MuiChip-icon': { color: '#8fb8ff' }
            }}
          />
          <Typography
            component="h1"
            sx={{ fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, fontSize: { xs: 34, sm: 46, md: 56 } }}
          >
            Todos os seus leads em um só lugar.
          </Typography>
          <Typography sx={{ fontSize: { xs: 16, md: 19 }, color: 'rgba(255,255,255,.72)', maxWidth: 720 }}>
            WhatsApp com vários números, e-mail marketing, webchats com IA, quizzes, Telegram e WordPress — conectados num único painel, com
            bot, CRM, assinaturas e cobrança automática por PIX, boleto ou cartão.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            <Button
              size="large"
              variant="contained"
              disableElevation
              onClick={() => onNav('precos')}
              endIcon={<IconArrowRight size={18} />}
              sx={{
                bgcolor: PRIMARY,
                '&:hover': { bgcolor: PRIMARY_DARK },
                fontWeight: 700,
                borderRadius: 2.5,
                px: 3.5,
                boxShadow: '0 12px 32px rgba(55,126,240,.4)'
              }}
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
              startIcon={<IconBrandWhatsapp size={20} />}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,.28)',
                fontWeight: 700,
                borderRadius: 2.5,
                px: 3,
                '&:hover': { borderColor: WA_GREEN, bgcolor: 'rgba(37,211,102,.1)' }
              }}
            >
              Falar no WhatsApp
            </Button>
          </Stack>
        </Stack>

        {/* fluxograma grande (≥ md); no celular o hexágono ficaria ilegível → cartões empilhados */}
        <Box
          sx={{
            mt: { xs: 4, md: 5 },
            display: { xs: 'none', md: 'flex' },
            justifyContent: 'center',
            animation: `${floatKf} 9s ease-in-out infinite`
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 1180 }}>
            <FlowDiagram scale={1.3} maxWidth={1180} />
          </Box>
        </Box>
        <Box
          sx={{ mt: 4, display: { xs: 'grid', md: 'none' }, gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' } }}
        >
          {CHANNELS.map((n) => (
            <Box
              key={n.key}
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: '#151d30',
                border: '1px solid rgba(255,255,255,.1)',
                borderLeft: `5px solid ${n.color}`
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: `${n.color}22`,
                    color: n.color,
                    flexShrink: 0
                  }}
                >
                  <n.Icon size={20} stroke={2} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{n.label}</Typography>
              </Stack>
              <Stack spacing={0.5}>
                {n.items.map((it) => (
                  <Stack key={it} direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 5, height: 5, borderRadius: 999, bgcolor: n.color, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.8)' }}>
                      {it}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

// ---------------------------------------------------------------- planos
function PlanCard({ plan, annual }) {
  const { Icon } = plan;
  const price = annual ? perMonthAnnual(plan) : plan.monthly;
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        height: '100%',
        transition: 'transform .2s, box-shadow .2s, border-color .2s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 18px 40px rgba(15,23,42,.12)', borderColor: `${plan.color}80` }
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: `${plan.color}1f`,
            color: plan.color
          }}
        >
          <Icon size={24} stroke={2} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em' }}>{plan.name}</Typography>
      </Stack>
      <Box>
        <Stack direction="row" alignItems="baseline" spacing={0.75} flexWrap="wrap">
          {annual ? (
            <Typography sx={{ color: 'text.disabled', fontWeight: 600, fontSize: 18, textDecoration: 'line-through' }}>
              {brl(plan.monthly)}
            </Typography>
          ) : null}
          <Typography sx={{ fontWeight: 800, fontSize: 36, letterSpacing: '-0.03em', lineHeight: 1 }}>{brl(price)}</Typography>
          <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>/mês</Typography>
        </Stack>
        {annual ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {brl(annualTotal(plan))} por ano ·{' '}
            <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}>
              {Math.round(plan.annualOff * 100)}% de desconto
            </Box>{' '}
            sobre {brl(plan.monthly)}/mês
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            No anual sai por {brl(perMonthAnnual(plan))}/mês ({Math.round(plan.annualOff * 100)}% off)
          </Typography>
        )}
      </Box>
      <Stack spacing={0.9} sx={{ flex: 1 }}>
        {plan.items.map((it) => (
          <Stack key={it} direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ mt: '3px', color: plan.color, flexShrink: 0 }}>
              <IconCheck size={16} stroke={2.5} />
            </Box>
            <Typography variant="body2">{it}</Typography>
          </Stack>
        ))}
      </Stack>
      <Button
        variant="outlined"
        component="a"
        href={CONTACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          fontWeight: 700,
          borderRadius: 2.5,
          borderColor: 'divider',
          color: 'text.primary',
          '&:hover': { borderColor: plan.color, color: plan.color, bgcolor: `${plan.color}0f` }
        }}
      >
        Assinar {plan.name}
      </Button>
    </Box>
  );
}

function AllModulesCard({ annual }) {
  const price = annual ? perMonthAnnual(ALL_PLAN) : ALL_PLAN.monthly;
  const sumMonthly = PLANS.reduce((a, p) => a + p.monthly, 0);
  return (
    <Box
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: 4,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        background: `radial-gradient(800px 300px at 0% 0%, rgba(55,126,240,.45), transparent 60%), linear-gradient(135deg, #101a33, ${NAVY})`,
        border: '1px solid rgba(55,126,240,.45)',
        boxShadow: '0 24px 60px rgba(15,23,42,.35)'
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em' }}>{ALL_PLAN.name}</Typography>
            <Chip label="Mais completo" size="small" sx={{ bgcolor: PRIMARY, color: '#fff', fontWeight: 800 }} />
          </Stack>
          <Typography sx={{ color: 'rgba(255,255,255,.72)', mt: 0.5 }}>
            WhatsApp, e-mail marketing, webchat com IA, Telegram, quizzes e WordPress na mesma conta — separados, somariam {brl(sumMonthly)}
            /mês.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            {PLANS.map((p) => (
              <Chip
                key={p.key}
                icon={<p.Icon size={15} />}
                label={p.name}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,.08)', color: '#fff', fontWeight: 600, '& .MuiChip-icon': { color: p.color } }}
              />
            ))}
          </Stack>
        </Box>
        <Box sx={{ textAlign: { xs: 'left', md: 'right' }, flexShrink: 0 }}>
          <Stack direction="row" alignItems="baseline" spacing={0.75} justifyContent={{ md: 'flex-end' }} flexWrap="wrap">
            {annual ? (
              <Typography sx={{ color: 'rgba(255,255,255,.5)', fontWeight: 600, fontSize: 20, textDecoration: 'line-through' }}>
                {brl(ALL_PLAN.monthly)}
              </Typography>
            ) : null}
            <Typography sx={{ fontWeight: 800, fontSize: 44, letterSpacing: '-0.03em', lineHeight: 1 }}>{brl(price)}</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,.72)', fontWeight: 600 }}>/mês</Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.72)', mt: 0.5 }}>
            {annual ? `${brl(annualTotal(ALL_PLAN))} por ano · ` : `No anual sai por ${brl(perMonthAnnual(ALL_PLAN))}/mês · `}
            <Box component="span" sx={{ color: '#7ee2a4', fontWeight: 700 }}>
              {Math.round(ALL_PLAN.annualOff * 100)}% de desconto no anual
            </Box>
          </Typography>
          <Button
            variant="contained"
            disableElevation
            component="a"
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<IconArrowRight size={18} />}
            sx={{
              mt: 2,
              bgcolor: PRIMARY,
              '&:hover': { bgcolor: PRIMARY_DARK },
              fontWeight: 700,
              borderRadius: 2.5,
              px: 3,
              boxShadow: '0 12px 32px rgba(55,126,240,.4)'
            }}
          >
            Quero todos os módulos
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

function SourceCard() {
  return (
    <Box
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3,
        alignItems: { md: 'center' }
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: 3,
          display: 'grid',
          placeItems: 'center',
          bgcolor: `${PRIMARY}1f`,
          color: PRIMARY,
          flexShrink: 0
        }}
      >
        <IconCode size={30} stroke={2} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>Comprar o código-fonte</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          Para revender como seu produto ou implementar mais coisas em cima: back-end, front-end, micros de IA e e-mail, plugin WordPress e
          o tutorial de instalação em produção.
        </Typography>
      </Box>
      <Box sx={{ textAlign: { xs: 'left', md: 'right' }, flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 36, letterSpacing: '-0.03em', lineHeight: 1 }}>{brl(SOURCE_PRICE)}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          pagamento único
        </Typography>
        <Button
          variant="outlined"
          component="a"
          href={CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ mt: 1.5, fontWeight: 700, borderRadius: 2.5 }}
        >
          Falar sobre o código-fonte
        </Button>
      </Box>
    </Box>
  );
}

function Pricing() {
  const [annual, setAnnual] = useState(true);
  return (
    <Box id="precos" component="section" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.default' }}>
      <Container maxWidth="xl">
        <Stack alignItems="center" spacing={2} sx={{ textAlign: 'center', mb: 5 }}>
          <Typography component="h2" sx={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: { xs: 30, md: 40 } }}>
            Planos por módulo
          </Typography>
          <Typography sx={{ color: 'text.secondary', maxWidth: 640, fontSize: { xs: 15, md: 17 } }}>
            Contrate só o que você usa. Cada módulo tem desconto no plano anual; todos juntos têm o maior desconto.
          </Typography>
          <Box
            sx={{
              display: 'inline-flex',
              p: 0.5,
              borderRadius: 999,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              mt: 1
            }}
          >
            {[
              { v: false, label: 'Mensal' },
              { v: true, label: 'Anual' }
            ].map((o) => (
              <Button
                key={o.label}
                onClick={() => setAnnual(o.v)}
                disableElevation
                sx={{
                  borderRadius: 999,
                  px: 2.5,
                  fontWeight: 700,
                  color: annual === o.v ? '#fff' : 'text.secondary',
                  bgcolor: annual === o.v ? PRIMARY : 'transparent',
                  '&:hover': { bgcolor: annual === o.v ? PRIMARY_DARK : 'action.hover' }
                }}
              >
                {o.label}
                {o.v ? (
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      px: 0.75,
                      py: 0.1,
                      borderRadius: 1,
                      fontSize: 11,
                      fontWeight: 800,
                      bgcolor: annual ? 'rgba(255,255,255,.2)' : `${WA_GREEN}22`,
                      color: annual ? '#fff' : WA_DARK
                    }}
                  >
                    até 60% off
                  </Box>
                ) : null}
              </Button>
            ))}
          </Box>
        </Stack>

        <Box sx={{ mb: 3 }}>
          <AllModulesCard annual={annual} />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(3, minmax(0,1fr))' }
          }}
        >
          {PLANS.map((p) => (
            <PlanCard key={p.key} plan={p} annual={annual} />
          ))}
        </Box>
        <Box sx={{ mt: 3 }}>
          <SourceCard />
        </Box>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', mt: 3 }}>
          Preços em reais. O plano anual é pago uma vez por ano, já com o desconto do módulo.
        </Typography>
      </Container>
    </Box>
  );
}

// ---------------------------------------------------------------- contato + rodapé
function Contact() {
  return (
    <Box component="section" sx={{ pb: { xs: 8, md: 12 }, bgcolor: 'background.default' }}>
      <Container maxWidth="md">
        <Box
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            textAlign: 'center',
            color: '#fff',
            background: `linear-gradient(135deg, ${WA_DARK}, ${WA_GREEN})`,
            boxShadow: '0 24px 60px rgba(18,140,126,.3)'
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 30 }, letterSpacing: '-0.02em' }}>Fale com a gente</Typography>
          <Typography sx={{ mt: 1, color: 'rgba(255,255,255,.88)', fontSize: { xs: 15, md: 17 } }}>
            Tire dúvidas, peça uma demonstração ou feche o seu plano direto no WhatsApp.
          </Typography>
          <Button
            size="large"
            variant="contained"
            disableElevation
            component="a"
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<IconBrandWhatsapp size={22} />}
            sx={{ mt: 3, bgcolor: '#fff', color: WA_DARK, fontWeight: 800, borderRadius: 2.5, px: 3.5, '&:hover': { bgcolor: '#f1fdf6' } }}
          >
            +55 (89) 8813-6674
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

function Footer() {
  return (
    <Box component="footer" sx={{ py: 3, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Container maxWidth="xl">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems="center">
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Pub Mail © {new Date().getFullYear()}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Typography
              component="a"
              href="/legal/termos-de-uso"
              variant="body2"
              sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'text.primary' } }}
            >
              Termos de uso
            </Typography>
            <Typography
              component="a"
              href="/legal/politica-de-privacidade"
              variant="body2"
              sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'text.primary' } }}
            >
              Privacidade
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

// ---------------------------------------------------------------- página
export default function Landing() {
  const { isAuthenticated } = useAuth();
  const [active, setActive] = useState('inicio');
  // seção ativa no cabeçalho conforme a rolagem
  useEffect(() => {
    const onScroll = () => {
      // a última seção cujo topo já passou do cabeçalho é a ativa
      const limit = HEADER_H + 80;
      let current = 'inicio';
      for (const id of ['whatsapp', 'assinaturas', 'precos']) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= limit) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    document.title = 'Pub Mail — WhatsApp, e-mail, webchat, Telegram, quizzes e WordPress';
    const hash = window.location.hash.replace('#', '');
    if (['precos', 'whatsapp', 'assinaturas'].includes(hash)) setTimeout(() => scrollToId(hash), 150);
  }, []);
  const onNav = useMemo(() => (id) => scrollToId(id), []);
  return (
    <Box sx={{ bgcolor: 'background.default', color: 'text.primary' }}>
      <Header active={active} onNav={onNav} isAuthenticated={isAuthenticated} />
      <Hero onNav={onNav} />
      <WhatsAppShowcase onNav={onNav} />
      <SubscriptionsShowcase onNav={onNav} />
      <Pricing />
      <Contact />
      <Footer />
    </Box>
  );
}
