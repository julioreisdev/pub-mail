import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import Logo from 'ui-component/Logo';
import AuthLogin from '../auth-forms/AuthLogin';
import LoginShowcase from './LoginShowcase';

// ================================|| LOGIN — layout dividido ||================================ //
// Esquerda (≥ md): marca + fluxograma animado dos canais. Direita: formulário enxuto.
// No mobile o painel esquerdo some e a marca sobe pro topo do formulário.

export default function Login() {
  return (
    <Box sx={{ minHeight: '100vh', height: { md: '100vh' }, overflow: { md: 'hidden' }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr', lg: '1.15fr 1fr' }, bgcolor: 'background.default' }}>
      <Box sx={{ display: { xs: 'none', md: 'block' }, minHeight: 0 }}>
        <LoginShowcase />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 3, sm: 5 }, position: 'relative' }}>
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Stack spacing={3.5}>
            <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center' }}>
              <Logo height={40} />
            </Box>

            <Box>
              <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: { xs: 26, sm: 30 } }}>
                Entrar
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                Acesse sua conta para continuar.
              </Typography>
            </Box>

            <AuthLogin />
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ position: 'absolute', bottom: 16, color: 'text.disabled' }}>
          Pub Mail © {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  );
}
