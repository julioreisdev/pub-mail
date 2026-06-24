import { Link } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import AuthWrapper1 from './AuthWrapper1';
import AuthCardWrapper from './AuthCardWrapper';
import Logo from 'ui-component/Logo';

import AuthLogin from '../auth-forms/AuthLogin';

// ================================|| AUTH3 - LOGIN ||================================ //

export default function Login() {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));

  return (
    <AuthWrapper1>
      <Stack sx={{ justifyContent: 'flex-end', minHeight: '100vh' }}>
        <Stack sx={{ justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 32px)' }}>
          <Box sx={{ m: { xs: 1, sm: 1.5 }, mb: 0 }}>
            <AuthCardWrapper>
              <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 1.25 }}>
                <Logo height={50} />
                <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <Typography variant={downMD ? 'h4' : 'h3'} sx={{ color: 'secondary.main' }}>
                    Olá, bem-vindo de volta!
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '14px', textAlign: { xs: 'center', md: 'inherit' } }}>
                    Entre com suas credenciais para continuar
                  </Typography>
                </Stack>

                <Box sx={{ width: 1, mt: 0.5 }}>
                  <AuthLogin />
                </Box>

                <Divider sx={{ width: 1, my: 0.75 }} />

                {/* manter link de Register */}
                <Stack sx={{ alignItems: 'center' }}>
                  <Typography component={Link} to="/register" variant="subtitle1" sx={{ textDecoration: 'none' }}>
                    Não tem uma conta? Criar conta
                  </Typography>

                </Stack>
              </Stack>
            </AuthCardWrapper>
          </Box>
        </Stack>

        {/* Footer removido (berrydashboard / codedthemes) */}
        {/*
        <Box sx={{ px: 3, my: 3 }}>
          <AuthFooter />
        </Box>
        */}
      </Stack>
    </AuthWrapper1>
  );
}
