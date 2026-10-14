import { useState } from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { keyframes, useTheme } from '@mui/material/styles';
import { IconArrowRight, IconCircleCheckFilled, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';

import { post } from 'api/api';
import Logo from 'ui-component/Logo';
import { MODULE_DEFS } from './modules';

const rise = keyframes`
  from { opacity: 0; transform: translateY(12px) }
  to { opacity: 1; transform: translateY(0) }
`;
const float = keyframes`
  0%, 100% { transform: translateY(0) }
  50% { transform: translateY(-6px) }
`;
const wave = keyframes`
  0%, 60%, 100% { transform: rotate(0deg) }
  10%, 30% { transform: rotate(16deg) }
  20% { transform: rotate(-8deg) }
  40% { transform: rotate(10deg) }
`;
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(55,126,240,.55) }
  70% { box-shadow: 0 0 0 16px rgba(55,126,240,0) }
  100% { box-shadow: 0 0 0 0 rgba(55,126,240,0) }
`;

// Boas-vindas no 1º acesso. Persistido no servidor (POST /access/welcome-seen) — não volta nem em outro navegador.
// Cabeçalho navy colado no topo do diálogo: o tema dá 12 px de padding a todo Dialog → `p: 0` no Paper.
export default function WelcomeModal({ open, name, modules, onDone }) {
  const theme = useTheme();
  const xs = useMediaQuery(theme.breakpoints.down('sm'));
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const defs = (modules || []).map((k) => MODULE_DEFS[k]).filter(Boolean);
  const first = String(name || '').split(' ')[0];
  const floating = defs.slice(0, 4);

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
    <Dialog
      open={open && !dismissed}
      maxWidth="sm"
      fullWidth
      fullScreen={xs}
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          p: 0,
          m: { xs: 0, sm: 2 },
          borderRadius: { xs: 0, sm: 5 },
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          boxShadow: '0 30px 80px -20px rgba(2,6,23,.55)'
        }
      }}
      slotProps={{ backdrop: { sx: { backdropFilter: 'blur(6px)', bgcolor: 'rgba(2,6,23,.55)' } } }}
    >
      {/* ---------------------------------------------------------------- cabeçalho */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          px: { xs: 3, sm: 4 },
          pt: { xs: 3.5, sm: 4 },
          pb: { xs: 3.5, sm: 4 },
          color: '#fff',
          background:
            'radial-gradient(420px 220px at 100% 0%, rgba(37,211,102,.28), transparent 65%), radial-gradient(520px 260px at 0% 0%, rgba(55,126,240,.6), transparent 62%), linear-gradient(140deg,#0b1120 0%,#13213f 60%,#0f1a33 100%)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse at 30% 0%, #000 0%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 30% 0%, #000 0%, transparent 75%)',
            pointerEvents: 'none'
          }
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ position: 'relative' }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box
              sx={{
                borderRadius: 2,
                animation: `${pulse} 2.6s ease-out infinite`,
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
              }}
            >
              <Logo variant="mark" height={34} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
              Pub{' '}
              <Box component="span" sx={{ color: '#7fb0ff' }}>
                Mail
              </Box>
            </Typography>
          </Stack>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.6}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 700,
              color: '#bbf7d0',
              bgcolor: 'rgba(34,197,94,.14)',
              border: '1px solid rgba(34,197,94,.35)'
            }}
          >
            <IconCircleCheckFilled size={14} />
            <span>Conta ativa</span>
          </Stack>
        </Stack>

        <Stack
          direction="row"
          alignItems="flex-end"
          justifyContent="space-between"
          spacing={2}
          sx={{ position: 'relative', mt: { xs: 3, sm: 3.5 } }}
        >
          <Box sx={{ minWidth: 0, animation: `${rise} .5s ease both` }}>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 26, sm: 32 }, letterSpacing: '-0.03em', lineHeight: 1.08 }}>
              Boas-vindas{first ? `, ${first}` : ''}!{' '}
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  transformOrigin: '70% 70%',
                  animation: `${wave} 2.2s ease-in-out .6s 2`,
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
                }}
              >
                👋
              </Box>
            </Typography>
            <Typography sx={{ mt: 1, color: 'rgba(255,255,255,.72)', fontSize: 15, lineHeight: 1.5, maxWidth: 380 }}>
              Sua conta está pronta. {defs.length === 1 ? 'Este é o módulo' : 'Estes são os módulos'} que você já pode usar:
            </Typography>
          </Box>

          {/* ícones dos módulos flutuando (só no computador) */}
          {floating.length ? (
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexShrink: 0, pr: 0.5 }}>
              {floating.map((m, i) => (
                <Box
                  key={m.key}
                  sx={{
                    width: 46,
                    height: 46,
                    ml: i ? -1.25 : 0,
                    borderRadius: '14px',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    bgcolor: m.color,
                    border: '3px solid #13213f',
                    boxShadow: '0 10px 24px -8px rgba(0,0,0,.6)',
                    transform: `rotate(${(i - 1.5) * 6}deg)`,
                    animation: `${float} 3.2s ease-in-out ${i * 0.35}s infinite`,
                    '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
                  }}
                >
                  <m.Icon size={22} stroke={1.9} />
                </Box>
              ))}
            </Box>
          ) : null}
        </Stack>
      </Box>

      {/* ---------------------------------------------------------------- módulos */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2.5, sm: 4 }, pt: { xs: 2.5, sm: 3 }, pb: 1 }}>
        {defs.length === 0 ? (
          <Box sx={{ p: 2.5, borderRadius: 3, border: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700 }}>Nenhum módulo liberado ainda</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Fale com o administrador da sua conta para liberar o acesso.
            </Typography>
          </Box>
        ) : (
          <>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: '.08em', color: 'text.secondary', lineHeight: 1 }}>
                Seus módulos
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                {defs.length} {defs.length === 1 ? 'liberado' : 'liberados'}
              </Typography>
            </Stack>
            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
              {defs.map((m, i) => (
                <Stack
                  key={m.key}
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{
                    position: 'relative',
                    p: 1.5,
                    pl: 1.75,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    overflow: 'hidden',
                    transition: 'border-color .2s, transform .2s, box-shadow .2s',
                    animation: `${rise} .45s ease both`,
                    animationDelay: `${0.07 * i + 0.15}s`,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 10,
                      bottom: 10,
                      width: 3,
                      borderRadius: 3,
                      bgcolor: m.color
                    },
                    '&:hover': { borderColor: m.color, transform: 'translateY(-1px)', boxShadow: `0 8px 22px -12px ${m.color}` }
                  }}
                >
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2.5,
                      display: 'grid',
                      placeItems: 'center',
                      color: m.color,
                      bgcolor: `${m.color}1f`,
                      flexShrink: 0
                    }}
                  >
                    <m.Icon size={22} stroke={1.8} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }}>{m.label}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35, mt: 0.25 }}>
                      {m.description}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* ---------------------------------------------------------------- rodapé */}
      <Box sx={{ flexShrink: 0, px: { xs: 2.5, sm: 4 }, pt: 2, pb: { xs: 3, sm: 3.5 } }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mb: 2, px: 1.5, py: 1, borderRadius: 2.5, bgcolor: 'action.hover', color: 'text.secondary' }}
        >
          <IconLayoutSidebarLeftExpand size={18} style={{ flexShrink: 0 }} />
          <Typography variant="caption" sx={{ lineHeight: 1.4 }}>
            Cada módulo fica no menu à esquerda. Você pode trocar de tela quando quiser.
          </Typography>
        </Stack>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          size="large"
          disabled={busy}
          onClick={finish}
          endIcon={<IconArrowRight size={18} />}
          sx={{
            fontWeight: 700,
            borderRadius: 3,
            py: 1.4,
            fontSize: 15,
            background: 'linear-gradient(135deg,#377EF0,#2563eb)',
            boxShadow: '0 12px 28px -12px rgba(37,99,235,.8)',
            '&:hover': { background: 'linear-gradient(135deg,#2f6fdc,#1d4ed8)' }
          }}
        >
          Começar a usar
        </Button>
      </Box>
    </Dialog>
  );
}

WelcomeModal.propTypes = { open: PropTypes.bool, name: PropTypes.string, modules: PropTypes.array, onDone: PropTypes.func };
