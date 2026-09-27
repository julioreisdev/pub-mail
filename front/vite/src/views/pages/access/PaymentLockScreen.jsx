import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconLogout, IconLock } from '@tabler/icons-react';
import Logo from 'ui-component/Logo';

import { useAuth } from 'contexts/AuthContext';
import PixCheckoutCard from './PixCheckoutCard';

// Tela que TRAVA a plataforma enquanto a conta precisa pagar. Overlay fixo
// acima de tudo (sidebar inclusa): trocar a URL não adianta — o gate re-renderiza
// isto em qualquer rota, e o back responde 402 pra qualquer API de qualquer forma.
export default function PaymentLockScreen({ access, onPaid }) {
  const { logout, user } = useAuth();
  const name = user?.user?.name || '';

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        overflowY: 'auto',
        background: 'radial-gradient(1200px 600px at 20% -10%, rgba(55,126,240,.35), transparent 60%), radial-gradient(900px 500px at 100% 100%, rgba(168,85,247,.25), transparent 55%), linear-gradient(160deg,#0b1120 0%,#111a30 60%,#0b1120 100%)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* grade sutil */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, #000 40%, transparent 80%)'
        }}
      />

      <Stack direction="row" justifyContent="flex-end" sx={{ p: 2, position: 'relative' }}>
        <Button size="small" onClick={logout} startIcon={<IconLogout size={16} />} sx={{ color: 'rgba(255,255,255,.75)', fontWeight: 600, '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,.08)' } }}>
          {name ? `Sair (${name.split(' ')[0]})` : 'Sair'}
        </Button>
      </Stack>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, pb: 4, position: 'relative', minWidth: 0 }}>
        <Stack spacing={2} alignItems="center" sx={{ width: '100%', maxWidth: 560, minWidth: 0 }}>
          {access?.status === 'BLOCKED' ? (
            <BlockedCard />
          ) : (
            <>
              <PixCheckoutCard access={access} mode="lock" onPaid={onPaid} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.55)', textAlign: 'center', maxWidth: 480 }}>
                Após a confirmação, a plataforma é liberada automaticamente nesta mesma tela.
              </Typography>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

PaymentLockScreen.propTypes = { access: PropTypes.object, onPaid: PropTypes.func };

// Conta bloqueada manualmente pelo administrador: não há o que pagar aqui.
function BlockedCard() {
  return (
    <Box sx={{ width: '100%', maxWidth: 480, borderRadius: 4, p: { xs: 3, sm: 4 }, bgcolor: 'background.paper', color: 'text.primary', boxShadow: '0 30px 80px rgba(2,6,23,.45)', border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
      <Stack alignItems="center" spacing={2}>
        <Logo height={30} />
        <Box sx={{ width: 72, height: 72, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'error.main', bgcolor: (t) => `rgba(${t.vars.palette.error.mainChannel} / 0.12)` }}>
          <IconLock size={34} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em' }}>Conta bloqueada</Typography>
        <Typography sx={{ color: 'text.secondary', maxWidth: 360 }}>
          O acesso desta conta foi suspenso pelo administrador. Entre em contato com quem forneceu o seu acesso para regularizar.
        </Typography>
      </Stack>
    </Box>
  );
}
