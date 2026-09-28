import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { IconBrandWhatsapp } from '@tabler/icons-react';
import MainCard from 'ui-component/cards/MainCard';

// Página "em construção" do módulo WhatsApp (as telas chegam por fase).
export default function WhatsAppPlaceholder({ title, description }) {
  return (
    <MainCard title={title}>
      <Box sx={{ py: 8, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <Box sx={{ width: 84, height: 84, borderRadius: '24px', display: 'grid', placeItems: 'center', color: '#fff', background: 'linear-gradient(135deg,#25D366,#128C7E)', boxShadow: '0 18px 40px rgba(37,211,102,.28)', mb: 2.5 }}>
          <IconBrandWhatsapp size={44} stroke={1.8} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>{title}</Typography>
        {description ? (
          <Typography sx={{ color: 'text.secondary', mt: 1, maxWidth: 520 }}>{description}</Typography>
        ) : null}
        <Chip size="small" label="Em construção" sx={{ mt: 2.5, fontWeight: 700 }} />
      </Box>
    </MainCard>
  );
}
WhatsAppPlaceholder.propTypes = { title: PropTypes.string.isRequired, description: PropTypes.string };
