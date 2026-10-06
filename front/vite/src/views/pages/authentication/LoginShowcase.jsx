import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FlowDiagram from 'views/pages/landing/FlowDiagram';

// ==============================|| LOGIN — painel esquerdo (marca + fluxograma animado) ||============================== //
// Sempre escuro (independe do tema do app). O diagrama é o mesmo da landing (`FlowDiagram`), em escala 1.

const NAVY = '#0b1120';

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
          Pub
          <Box component="span" sx={{ color: '#5b9bff', ml: 0.5 }}>
            Mail
          </Box>
        </Box>
      </Box>

      {/* fluxograma */}
      {/* o diagrama ocupa o espaço que sobrar entre a marca e o texto e ESCALA pra caber (nunca gera scroll) */}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          my: 1.5
        }}
      >
        <FlowDiagram scale={1} maxWidth={800} />
      </Box>

      {/* uma linha só, sem discurso */}
      <Box sx={{ position: 'relative' }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
          Webchats com IA, e-mail marketing, quizzes, WhatsApp, Telegram e WordPress.
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,.62)', mt: 0.5 }}>Todos os seus leads em um só lugar.</Typography>
      </Box>
    </Box>
  );
}
