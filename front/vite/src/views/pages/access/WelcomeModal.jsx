import { useState } from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { keyframes } from '@mui/material/styles';
import { IconArrowRight, IconSparkles } from '@tabler/icons-react';

import { post } from 'api/api';
import Logo from 'ui-component/Logo';
import { MODULE_DEFS } from './modules';

const rise = keyframes`
  from { opacity: 0; transform: translateY(10px) }
  to { opacity: 1; transform: translateY(0) }
`;

// Boas-vindas no 1º acesso de conta gratuita. Persistido no servidor
// (POST /access/welcome-seen) — não volta nem em outro navegador.
export default function WelcomeModal({ open, name, modules, onDone }) {
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const defs = (modules || []).map((k) => MODULE_DEFS[k]).filter(Boolean);
  const first = String(name || '').split(' ')[0];

  const finish = async () => {
    setBusy(true);
    try {
      await post('/access/welcome-seen');
    } catch {
      /* best-effort: o gate re-lê /me de qualquer forma */
    }
    setDismissed(true); // fecha já (otimista); o gate re-lê /me em seguida
    setBusy(false);
    onDone?.();
  };

  return (
    <Dialog open={open && !dismissed} maxWidth="sm" fullWidth disableEscapeKeyDown PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}>
      {/* faixa superior */}
      <Box
        sx={{
          px: 3.5,
          pt: 3.5,
          pb: 3,
          color: '#fff',
          background: 'radial-gradient(700px 300px at 0% 0%, rgba(55,126,240,.55), transparent 60%), linear-gradient(135deg,#0b1120,#1b2a4a)'
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Logo variant="mark" height={30} />
            <Typography sx={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>Pub Mail</Typography>
          </Stack>
          <Box sx={{ color: 'rgba(255,255,255,.7)' }}>
            <IconSparkles size={22} />
          </Box>
        </Stack>
        <Typography sx={{ mt: 3, fontWeight: 800, fontSize: { xs: 24, sm: 28 }, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Bem-vindo{first ? `, ${first}` : ''}! 👋
        </Typography>
        <Typography sx={{ mt: 0.75, color: 'rgba(255,255,255,.75)' }}>Sua conta está pronta. Isto é o que você já pode usar:</Typography>
      </Box>

      <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        {defs.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>Nenhum módulo liberado ainda. Fale com o administrador.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            {defs.map((m, i) => (
              <Stack
                key={m.key}
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  p: 1.5,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  animation: `${rise} .4s ease both`,
                  animationDelay: `${0.08 * i + 0.1}s`
                }}
              >
                <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', color: m.color, bgcolor: `${m.color}1f`, flexShrink: 0 }}>
                  <m.Icon size={22} stroke={1.8} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>{m.label}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {m.description}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Box>
        )}

        <Button
          fullWidth
          variant="contained"
          disableElevation
          size="large"
          disabled={busy}
          onClick={finish}
          endIcon={<IconArrowRight size={18} />}
          sx={{ mt: 3, fontWeight: 700, borderRadius: 2.5, py: 1.3 }}
        >
          Começar
        </Button>
      </Box>
    </Dialog>
  );
}

WelcomeModal.propTypes = { open: PropTypes.bool, name: PropTypes.string, modules: PropTypes.array, onDone: PropTypes.func };
