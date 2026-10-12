import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconArrowLeft } from '@tabler/icons-react';

// Páginas jurídicas públicas do Pub Mail (termos, privacidade): cabeçalho navy no padrão da landing + corpo em cartão.
const NAVY = '#0b1120';
const PRIMARY = '#377EF0';
const PRIMARY_DARK = '#1e5dc8';

export const LEGAL = {
  company: 'Pub Mail',
  site: 'https://reveleonline.com',
  email: 'julioreisdev@gmail.com',
  whatsapp: '+55 (89) 8813-6674',
  whatsappUrl: 'https://wa.me/558988136674',
  updated: '06 de outubro de 2026'
};

export function Section({ title, children }) {
  return (
    <Box component="section" sx={{ '& + &': { mt: 3.5 } }}>
      <Typography component="h2" sx={{ fontWeight: 800, fontSize: { xs: 19, md: 21 }, letterSpacing: '-0.01em', mb: 1 }}>
        {title}
      </Typography>
      <Stack
        spacing={1.25}
        sx={{ '& p, & li': { color: 'text.secondary', lineHeight: 1.7 }, '& ul, & ol': { m: 0, pl: 3 }, '& li': { mb: 0.5 } }}
      >
        {children}
      </Stack>
    </Box>
  );
}
Section.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node };

export default function LegalLayout({ kicker, title, subtitle, children }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 3, md: 6 } }}>
      <Container maxWidth="md">
        <Box
          sx={{
            borderRadius: 4,
            p: { xs: 3, md: 4.5 },
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            background: `radial-gradient(900px 400px at 0% 0%, rgba(55,126,240,.45), transparent 60%), linear-gradient(135deg, #101a33, ${NAVY})`,
            boxShadow: '0 24px 60px rgba(15,23,42,.25)'
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 14,
                  background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`
                }}
              >
                PM
              </Box>
              <Box sx={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', lineHeight: 1 }}>
                Pub
                <Box component="span" sx={{ color: '#5b9bff', ml: 0.5 }}>
                  Mail
                </Box>
              </Box>
              {kicker ? (
                <Chip label={kicker} size="small" sx={{ ml: 1, bgcolor: 'rgba(255,255,255,.12)', color: '#fff', fontWeight: 700 }} />
              ) : null}
            </Stack>
            <Typography component="h1" sx={{ fontSize: { xs: 30, md: 40 }, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              {title}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,.78)', fontSize: { xs: 15, md: 17 } }}>{subtitle}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.6)' }}>
              Última atualização: {LEGAL.updated}
            </Typography>
            <Link
              component={RouterLink}
              to="/"
              underline="hover"
              sx={{ width: 'fit-content', fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <IconArrowLeft size={16} /> Voltar para o Pub Mail
            </Link>
          </Stack>
        </Box>

        <Box
          sx={{ mt: 3, borderRadius: 4, p: { xs: 3, md: 4.5 }, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
        >
          {children}
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mt: 3, px: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Pub Mail © {new Date().getFullYear()}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Link component={RouterLink} to="/legal/termos-de-uso" variant="body2" underline="hover" sx={{ color: 'text.secondary' }}>
              Termos de uso
            </Link>
            <Link
              component={RouterLink}
              to="/legal/politica-de-privacidade"
              variant="body2"
              underline="hover"
              sx={{ color: 'text.secondary' }}
            >
              Política de privacidade
            </Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
LegalLayout.propTypes = {
  kicker: PropTypes.string,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node
};
