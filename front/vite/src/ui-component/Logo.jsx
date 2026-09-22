import PropTypes from 'prop-types';
import Box from '@mui/material/Box';

// ==============================|| LOGO — wordmark "Pub Mail" (HTML/CSS, theme-aware) ||============================== //
// Sem imagem: renderiza a marca em texto, adaptando automaticamente a light/dark.
// variant="wordmark" (padrão) → "Pub Mail" · variant="mark" → selo "PM".

export default function Logo({ height = 34, variant = 'wordmark', sx = {} }) {
  if (variant === 'mark') {
    const size = height;
    return (
      <Box
        aria-label="Pub Mail"
        sx={{
          width: size,
          height: size,
          borderRadius: `${Math.round(size * 0.28)}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 800,
          fontSize: size * 0.42,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          userSelect: 'none',
          background: (t) => `linear-gradient(135deg, ${t.vars.palette.primary.main}, ${t.vars.palette.primary.dark})`,
          ...sx
        }}
      >
        PM
      </Box>
    );
  }

  const fontSize = height * 0.74;
  return (
    <Box
      aria-label="Pub Mail"
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        fontWeight: 800,
        fontSize,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        userSelect: 'none',
        ...sx
      }}
    >
      <Box component="span" sx={{ color: 'text.primary' }}>
        Pub
      </Box>
      <Box component="span" sx={{ color: 'primary.main', ml: `${fontSize * 0.13}px` }}>
        Mail
      </Box>
    </Box>
  );
}

Logo.propTypes = { height: PropTypes.number, variant: PropTypes.oneOf(['wordmark', 'mark']), sx: PropTypes.object };
