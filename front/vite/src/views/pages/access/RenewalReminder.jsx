import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { IconAlertTriangle, IconX } from '@tabler/icons-react';

import PixCheckoutCard from './PixCheckoutCard';
import { formatDate } from './modules';

// Aviso de renovação: a partir de 3 dias antes do vencimento (access.expiring_soon),
// no máximo 2× por dia (manhã/tarde — 2ª exibição só 6h depois da 1ª), por usuário,
// guardado em localStorage. + faixa fixa discreta no topo com "Renovar" o tempo todo.
const KEY = (uid) => `pm-renew:${uid}`;
const MAX_PER_DAY = 2;
const MIN_GAP_MS = 6 * 3600_000;

function readLog(uid) {
  try {
    const raw = localStorage.getItem(KEY(uid));
    const v = raw ? JSON.parse(raw) : null;
    const today = new Date().toDateString();
    if (!v || v.day !== today) return { day: today, count: 0, last: 0 };
    return v;
  } catch {
    return { day: new Date().toDateString(), count: 0, last: 0 };
  }
}
function writeLog(uid, v) {
  try {
    localStorage.setItem(KEY(uid), JSON.stringify(v));
  } catch {
    /* storage bloqueado — mostra assim mesmo */
  }
}
function shouldShow(uid) {
  const v = readLog(uid);
  if (v.count >= MAX_PER_DAY) return false;
  if (v.count > 0 && Date.now() - v.last < MIN_GAP_MS) return false;
  return true;
}

export default function RenewalReminder({ access, userId, onPaid }) {
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const days = access?.days_left ?? 0;

  useEffect(() => {
    if (!userId || !access?.expiring_soon) return;
    if (shouldShow(userId)) {
      const v = readLog(userId);
      writeLog(userId, { ...v, count: v.count + 1, last: Date.now() });
      setOpen(true);
    }
  }, [userId, access?.expiring_soon]);

  if (!access?.expiring_soon) return null;

  const text = days <= 0 ? 'Seu acesso vence hoje' : `Seu acesso vence em ${days} dia${days === 1 ? '' : 's'}`;

  return (
    <>
      {/* faixa fixa (passiva) */}
      <Box
        sx={{
          mb: 2,
          px: 2,
          py: 1,
          borderRadius: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          border: '1px solid',
          borderColor: (t) => `rgba(${t.vars.palette.warning.mainChannel} / 0.5)`,
          bgcolor: (t) => `rgba(${t.vars.palette.warning.mainChannel} / 0.1)`,
          color: 'text.primary'
        }}
      >
        <Box sx={{ color: 'warning.main', display: 'flex' }}>
          <IconAlertTriangle size={20} />
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 200 }}>
          {text}
          {access?.access_until ? ` (${formatDate(access.access_until)}).` : '.'} Renove para não interromper seus envios e automações.
        </Typography>
        <Button size="small" variant="contained" color="warning" disableElevation onClick={() => setCheckout(true)} sx={{ fontWeight: 700 }}>
          Renovar agora
        </Button>
      </Box>

      {/* modal 2×/dia */}
      <Dialog open={open && !checkout} onClose={() => setOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <Box sx={{ p: 3.5, textAlign: 'center' }}>
          <IconButton size="small" onClick={() => setOpen(false)} sx={{ position: 'absolute', top: 10, right: 10 }} aria-label="fechar">
            <IconX size={18} />
          </IconButton>
          <Box sx={{ width: 64, height: 64, mx: 'auto', borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'warning.main', bgcolor: (t) => `rgba(${t.vars.palette.warning.mainChannel} / 0.14)` }}>
            <IconAlertTriangle size={32} />
          </Box>
          <Typography sx={{ mt: 2, fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>{text}</Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            Quando vencer, a plataforma e todas as automações (e-mails, fluxos, bots) ficam pausadas até o pagamento.
          </Typography>
          <Stack spacing={1} sx={{ mt: 3 }}>
            <Button variant="contained" disableElevation size="large" onClick={() => setCheckout(true)} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
              Renovar agora
            </Button>
            <Button onClick={() => setOpen(false)} sx={{ fontWeight: 600 }}>
              Lembrar depois
            </Button>
          </Stack>
        </Box>
      </Dialog>

      {/* checkout de renovação */}
      <Dialog open={checkout} onClose={() => setCheckout(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: 'transparent', boxShadow: 'none' } }}>
        <PixCheckoutCard
          access={access}
          mode="renew"
          onPaid={() => {
            setCheckout(false);
            setOpen(false);
            onPaid?.();
          }}
        />
      </Dialog>
    </>
  );
}

RenewalReminder.propTypes = { access: PropTypes.object, userId: PropTypes.string, onPaid: PropTypes.func };
