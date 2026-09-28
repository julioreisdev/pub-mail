import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { IconMessageChatbot, IconMailBolt, IconListLetters, IconBrandTelegram, IconBrandWhatsapp } from '@tabler/icons-react';

// ==============================|| LOGIN — painel esquerdo (marca + fluxograma animado) ||============================== //
// Sempre escuro (independe do tema do app). O diagrama é um SVG fixo em viewBox
// (escala com o container): 5 canais nas pontas de uma estrela → núcleo Pub Mail. Linhas com traço animado
// e "leads" (pontos) viajando até o centro via SMIL animateMotion; nós flutuam
// com CSS keyframes. Tudo em CSS/SVG — sem lib de animação.

const NAVY = '#0b1120';
const NODE_W = 208;
const HEAD_H = 50; // cabeçalho (ícone + título)
const ITEM_H = 19; // cada tópico
const PAD_B = 10;
// Estrela de 5 pontas: núcleo no centro, cada nó na ponta (ângulos -90, -18, 54, 126, 198).
const VB_W = 680;
const VB_H = 600;
const CX = VB_W / 2;
const CY = 335;
const RADIUS = 220; // distância do centro do nó ao núcleo
const nodeH = (n) => HEAD_H + n.items.length * ITEM_H + PAD_B;
const rad = (deg) => (deg * Math.PI) / 180;

const CHANNELS = [
  {
    key: 'webchat',
    label: 'Webchat com IA',
    Icon: IconMessageChatbot,
    color: '#377EF0',
    angle: -90, // topo
    delay: 0,
    items: ['Gateway de pagamento', 'Integração com 6 IAs', 'Blocos de anúncios', 'Personalizável']
  },
  {
    key: 'email',
    label: 'E-mail marketing',
    Icon: IconMailBolt,
    color: '#f59e0b',
    angle: -18, // ombro direito
    delay: 0.9,
    items: ['Resend provider', 'Teste A/B', 'Broadcast', 'Fluxo inicial', 'Reciclagem']
  },
  {
    key: 'telegram',
    label: 'Telegram',
    Icon: IconBrandTelegram,
    color: '#2AABEE',
    angle: 54, // base direita
    delay: 1.7,
    items: ['Gateway de pagamento', 'Venda de conteúdo VIP']
  },
  {
    key: 'quiz',
    label: 'Quizzes',
    Icon: IconListLetters,
    color: '#a855f7',
    angle: 126, // base esquerda
    delay: 2.6,
    items: ['Blocos de anúncios', 'Integração com rewardeds', 'Personalizável']
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    Icon: IconBrandWhatsapp,
    color: '#25D366',
    angle: 198, // ombro esquerdo
    delay: 3.5,
    items: ['Chat, status e broadcasts', 'Agendamentos', 'Contatos na organização']
  }
].map((n) => ({
  ...n,
  x: Math.round(CX + RADIUS * Math.cos(rad(n.angle)) - NODE_W / 2),
  y: Math.round(CY + RADIUS * Math.sin(rad(n.angle)) - nodeH(n) / 2)
}));

// Curva do centro do nó até o núcleo (controle puxado pro eixo do nó → curva suave).
function pathFor(n) {
  const sx = n.x + NODE_W / 2;
  const sy = n.y + nodeH(n) / 2;
  const cx = (sx + CX) / 2;
  const cy = sy < CY ? sy + 40 : sy - 40;
  return `M ${sx} ${sy} Q ${cx} ${cy} ${CX} ${CY}`;
}

const keyframes = `
@keyframes pmFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes pmDash { to { stroke-dashoffset: -28; } }
@keyframes pmPulse { 0% { transform: scale(0.85); opacity: .55; } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes pmGlow { 0%,100% { opacity: .55; } 50% { opacity: .9; } }
.pm-node { animation: pmFloat 5.5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.pm-line { stroke-dasharray: 6 8; animation: pmDash 1.6s linear infinite; }
.pm-pulse { animation: pmPulse 2.8s ease-out infinite; transform-box: fill-box; transform-origin: center; }
.pm-glow { animation: pmGlow 6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .pm-node, .pm-line, .pm-pulse, .pm-glow { animation: none; } }
`;

export default function LoginShowcase() {
  return (
    <Box
      sx={{
        position: 'relative',
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
        color: '#fff',
        background: `radial-gradient(1200px 600px at 10% -10%, rgba(55,126,240,.28), transparent 60%),
                     radial-gradient(900px 500px at 110% 110%, rgba(42,171,238,.18), transparent 55%),
                     linear-gradient(160deg, ${NAVY} 0%, #101a33 60%, #0b1120 100%)`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: { md: 5, lg: 7 }
      }}
    >
      <style>{keyframes}</style>

      {/* grade sutil de fundo */}
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

      {/* marca */}
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #377EF0, #1e5dc8)',
            boxShadow: '0 10px 30px rgba(55,126,240,.45)'
          }}
        >
          PM
        </Box>
        <Box sx={{ fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', lineHeight: 1 }}>
          Pub<Box component="span" sx={{ color: '#5b9bff', ml: 0.5 }}>Mail</Box>
        </Box>
      </Box>

      {/* fluxograma */}
      {/* o diagrama ocupa o espaço que sobrar entre a marca e o texto e ESCALA pra caber (nunca gera scroll) */}
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', my: 1.5 }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', maxWidth: 800 }} role="img" aria-label="Webchat, e-mail, quizzes, WhatsApp e Telegram integrados no Pub Mail">
          <defs>
            <filter id="pmShadow" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.45" />
            </filter>
            <radialGradient id="pmCore" cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#6aa6ff" />
              <stop offset="60%" stopColor="#377EF0" />
              <stop offset="100%" stopColor="#1e5dc8" />
            </radialGradient>
            {CHANNELS.map((n) => (
              <path key={`p-${n.key}`} id={`pm-path-${n.key}`} d={pathFor(n)} />
            ))}
            {CHANNELS.map((n) => (
              <clipPath key={`c-${n.key}`} id={`pm-clip-${n.key}`}>
                <rect x={n.x} y={n.y} rx="16" width={NODE_W} height={nodeH(n)} />
              </clipPath>
            ))}
          </defs>

          {/* halo do núcleo */}
          <circle className="pm-glow" cx={CX} cy={CY} r="120" fill="rgba(55,126,240,.10)" />

          {/* linhas + leads viajando */}
          {CHANNELS.map((n) => (
            <g key={`l-${n.key}`}>
              <use href={`#pm-path-${n.key}`} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="3" strokeLinecap="round" />
              <use href={`#pm-path-${n.key}`} className="pm-line" fill="none" stroke={n.color} strokeWidth="2" strokeLinecap="round" opacity="0.9" />
              {/* opacity 0 até o animateMotion começar (senão o ponto aparece parado na origem durante o `begin`).
                  cx/cy PRECISAM ser 0: o animateMotion soma o caminho à posição própria do elemento. */}
              {[0, 1.4].map((d, i) => (
                <circle key={i} r="5" cx="0" cy="0" opacity="0" fill={n.color} style={{ filter: `drop-shadow(0 0 6px ${n.color})` }}>
                  <animateMotion dur="3.2s" begin={`${n.delay + d}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1" keyTimes="0;1">
                    <mpath href={`#pm-path-${n.key}`} />
                  </animateMotion>
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="3.2s" begin={`${n.delay + d}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>
          ))}

          {/* núcleo */}
          <g>
            <circle className="pm-pulse" cx={CX} cy={CY} r="52" fill="none" stroke="#5b9bff" strokeWidth="2" />
            <circle cx={CX} cy={CY} r="50" fill="url(#pmCore)" filter="url(#pmShadow)" />
            <text x={CX} y={CY + 8} textAnchor="middle" fontSize="24" fontWeight="800" fill="#fff" fontFamily="Ubuntu, Segoe UI, Roboto, sans-serif" letterSpacing="-0.5">
              PM
            </text>
          </g>

          {/* nós dos canais */}
          {CHANNELS.map((n) => (
            <g key={n.key} className="pm-node" style={{ animationDelay: `${n.delay * -1}s` }}>
              <rect x={n.x} y={n.y} rx="16" width={NODE_W} height={nodeH(n)} fill="#151d30" stroke="rgba(255,255,255,.10)" filter="url(#pmShadow)" />
              <rect x={n.x} y={n.y} width="6" height={nodeH(n)} fill={n.color} clipPath={`url(#pm-clip-${n.key})`} />
              <foreignObject x={n.x + 16} y={n.y} width={NODE_W - 22} height={nodeH(n)}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: '#fff', fontFamily: 'Ubuntu, Segoe UI, Roboto, sans-serif' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: HEAD_H }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        display: 'grid',
                        placeItems: 'center',
                        background: `${n.color}22`,
                        color: n.color,
                        flex: '0 0 auto'
                      }}
                    >
                      <n.Icon size={19} stroke={2} />
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1 }}>{n.label}</div>
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 0 2px' }}>
                    {n.items.map((it) => (
                      <li key={it} style={{ display: 'flex', alignItems: 'center', gap: 8, height: ITEM_H, fontSize: 12, color: 'rgba(255,255,255,.78)', whiteSpace: 'nowrap' }}>
                        <span style={{ width: 5, height: 5, borderRadius: 999, background: n.color, flex: '0 0 auto' }} />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              </foreignObject>
            </g>
          ))}
        </svg>
      </Box>

      {/* uma linha só, sem discurso */}
      <Box sx={{ position: 'relative' }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
          Webchats com IA, e-mail marketing, quizzes, WhatsApp e Telegram.
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,.62)', mt: 0.5 }}>
          Todos os seus leads em um só lugar.
        </Typography>
      </Box>
    </Box>
  );
}
