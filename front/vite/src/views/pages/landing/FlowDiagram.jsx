import PropTypes from 'prop-types';
import {
  IconMessageChatbot,
  IconMailBolt,
  IconListLetters,
  IconBrandTelegram,
  IconBrandWhatsapp,
  IconBrandWordpress
} from '@tabler/icons-react';

// ==============================|| FLUXOGRAMA DOS CANAIS (SVG animado) ||============================== //
// Usado na landing (grande) e no painel esquerdo do login (menor). SVG em viewBox fixo: escala com o
// container. 6 canais nas pontas de um hexágono → núcleo Pub Mail. Linhas tracejadas animadas, "leads"
// (pontos) viajando até o centro via SMIL animateMotion, nós flutuando (CSS). Sem lib de animação.
// `scale` = tamanho dos cartões (1 = login; 1.25 = landing, textos e ícones maiores).

export const CHANNELS = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    Icon: IconBrandWhatsapp,
    color: '#25D366',
    angle: -90, // topo (destaque)
    delay: 0,
    items: [
      'Vários números por empresa',
      'Chat multiatendente + bot',
      'CRM, funil e cobranças PIX',
      'Broadcasts anti-bloqueio',
      'Status, agendas e métricas'
    ]
  },
  {
    key: 'email',
    label: 'E-mail marketing',
    Icon: IconMailBolt,
    color: '#f59e0b',
    angle: -30,
    delay: 0.9,
    items: ['Construtor visual', 'Teste A/B e segmentação', 'Fluxo inicial e gatilhos', 'Reciclagem de leads']
  },
  {
    key: 'wordpress',
    label: 'WordPress',
    Icon: IconBrandWordpress,
    color: '#e2e8f0',
    angle: 30,
    delay: 4.3,
    items: ['Plugin Tradutor Invisível', 'Sites ilimitados', 'URL traduzida']
  },
  {
    key: 'telegram',
    label: 'Telegram',
    Icon: IconBrandTelegram,
    color: '#2AABEE',
    angle: 90,
    delay: 1.7,
    items: ['Bots e fluxos', 'Broadcasts e automações', 'Venda de conteúdo VIP']
  },
  {
    key: 'quiz',
    label: 'Quizzes',
    Icon: IconListLetters,
    color: '#a855f7',
    angle: 150,
    delay: 2.6,
    items: ['Captação de leads', 'Blocos de anúncios', 'Redireciona por resposta']
  },
  {
    key: 'webchat',
    label: 'Webchat com IA',
    Icon: IconMessageChatbot,
    color: '#377EF0',
    angle: 210,
    delay: 3.5,
    items: ['Integração com 6 IAs', 'Funil com cobrança PIX', 'Blocos de anúncios', 'Domínio próprio com HTTPS']
  }
];

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

const rad = (deg) => (deg * Math.PI) / 180;

export default function FlowDiagram({ scale = 1, maxWidth = 800, style }) {
  // geometria em função da escala (cartão maior → raio maior pra não encostar)
  const NODE_W = Math.round(208 * scale);
  const HEAD_H = Math.round(50 * scale);
  const ITEM_H = Math.round(19 * scale);
  const PAD_B = Math.round(10 * scale);
  const nodeH = (n) => HEAD_H + n.items.length * ITEM_H + PAD_B;
  const maxH = Math.max(...CHANNELS.map(nodeH));
  // raio mínimo: vizinhos a 60° precisam de (NODE_W + folga) de distância → R = (NODE_W + gap) / (2·sin 30°) = NODE_W + gap
  const RADIUS = NODE_W + Math.round(24 * scale) + maxH * 0.35;
  const VB_W = Math.round(RADIUS * 2 + NODE_W + 40);
  const VB_H = Math.round(RADIUS * 2 + maxH + 40);
  const CX = VB_W / 2;
  const CY = VB_H / 2;
  const CORE_R = Math.round(50 * scale);
  const nodes = CHANNELS.map((n) => ({
    ...n,
    x: Math.round(CX + RADIUS * Math.cos(rad(n.angle)) - NODE_W / 2),
    y: Math.round(CY + RADIUS * Math.sin(rad(n.angle)) - nodeH(n) / 2)
  }));
  const pathFor = (n) => {
    const sx = n.x + NODE_W / 2;
    const sy = n.y + nodeH(n) / 2;
    const cx = (sx + CX) / 2;
    const cy = sy < CY ? sy + 40 : sy - 40;
    return `M ${sx} ${sy} Q ${cx} ${cy} ${CX} ${CY}`;
  };
  const f = (v) => Math.round(v * scale * 10) / 10;

  return (
    <>
      <style>{keyframes}</style>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', maxWidth, display: 'block', ...style }}
        role="img"
        aria-label="WhatsApp, e-mail, quizzes, webchat, Telegram e WordPress integrados no Pub Mail"
      >
        <defs>
          <filter id="pmShadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.45" />
          </filter>
          <radialGradient id="pmCore" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#6aa6ff" />
            <stop offset="60%" stopColor="#377EF0" />
            <stop offset="100%" stopColor="#1e5dc8" />
          </radialGradient>
          {nodes.map((n) => (
            <path key={`p-${n.key}`} id={`pm-path-${n.key}`} d={pathFor(n)} />
          ))}
          {nodes.map((n) => (
            <clipPath key={`c-${n.key}`} id={`pm-clip-${n.key}`}>
              <rect x={n.x} y={n.y} rx={f(16)} width={NODE_W} height={nodeH(n)} />
            </clipPath>
          ))}
        </defs>

        <circle className="pm-glow" cx={CX} cy={CY} r={f(120)} fill="rgba(55,126,240,.10)" />

        {nodes.map((n) => (
          <g key={`l-${n.key}`}>
            <use href={`#pm-path-${n.key}`} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth={f(3)} strokeLinecap="round" />
            <use
              href={`#pm-path-${n.key}`}
              className="pm-line"
              fill="none"
              stroke={n.color}
              strokeWidth={f(2)}
              strokeLinecap="round"
              opacity="0.9"
            />
            {[0, 1.4].map((d, i) => (
              <circle key={i} r={f(5)} cx="0" cy="0" opacity="0" fill={n.color} style={{ filter: `drop-shadow(0 0 6px ${n.color})` }}>
                <animateMotion
                  dur="3.2s"
                  begin={`${n.delay + d}s`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.4 0 0.6 1"
                  keyTimes="0;1"
                >
                  <mpath href={`#pm-path-${n.key}`} />
                </animateMotion>
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.15;0.85;1"
                  dur="3.2s"
                  begin={`${n.delay + d}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
          </g>
        ))}

        <g>
          <circle className="pm-pulse" cx={CX} cy={CY} r={CORE_R + 2} fill="none" stroke="#5b9bff" strokeWidth={f(2)} />
          <circle cx={CX} cy={CY} r={CORE_R} fill="url(#pmCore)" filter="url(#pmShadow)" />
          <text
            x={CX}
            y={CY + f(8)}
            textAnchor="middle"
            fontSize={f(24)}
            fontWeight="800"
            fill="#fff"
            fontFamily="Ubuntu, Segoe UI, Roboto, sans-serif"
            letterSpacing="-0.5"
          >
            PM
          </text>
        </g>

        {nodes.map((n) => (
          <g key={n.key} className="pm-node" style={{ animationDelay: `${n.delay * -1}s` }}>
            <rect
              x={n.x}
              y={n.y}
              rx={f(16)}
              width={NODE_W}
              height={nodeH(n)}
              fill="#151d30"
              stroke="rgba(255,255,255,.10)"
              filter="url(#pmShadow)"
            />
            <rect x={n.x} y={n.y} width={f(6)} height={nodeH(n)} fill={n.color} clipPath={`url(#pm-clip-${n.key})`} />
            <foreignObject x={n.x + f(16)} y={n.y} width={NODE_W - f(22)} height={nodeH(n)}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: '#fff', fontFamily: 'Ubuntu, Segoe UI, Roboto, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: f(10), height: HEAD_H }}>
                  <div
                    style={{
                      width: f(32),
                      height: f(32),
                      borderRadius: f(10),
                      display: 'grid',
                      placeItems: 'center',
                      background: `${n.color}22`,
                      color: n.color,
                      flex: '0 0 auto'
                    }}
                  >
                    <n.Icon size={f(19)} stroke={2} />
                  </div>
                  <div style={{ fontSize: f(14.5), fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1 }}>{n.label}</div>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 0 2px' }}>
                  {n.items.map((it) => (
                    <li
                      key={it}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: f(8),
                        height: ITEM_H,
                        fontSize: f(12),
                        color: 'rgba(255,255,255,.78)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span style={{ width: f(5), height: f(5), borderRadius: 999, background: n.color, flex: '0 0 auto' }} />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>
    </>
  );
}

FlowDiagram.propTypes = { scale: PropTypes.number, maxWidth: PropTypes.number, style: PropTypes.object };
