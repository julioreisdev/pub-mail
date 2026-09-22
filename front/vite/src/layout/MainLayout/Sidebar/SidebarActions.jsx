import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

import { useColorScheme, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { IconSun, IconMoon, IconLogout } from '@tabler/icons-react';

import { useAuth } from 'contexts/AuthContext';

// ==============================|| SIDEBAR - RODAPÉ (perfil + tema + sair) ||============================== //

export default function SidebarActions({ drawerOpen }) {
  const { mode, setMode } = useColorScheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const name = user?.user?.name || 'Usuário';
  const email = user?.user?.email || '';
  const initial = (name.trim()[0] || 'U').toUpperCase();

  const isDark = mode === 'dark';
  const toggleTheme = () => setMode(isDark ? 'light' : 'dark');

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const rowSx = {
    borderRadius: 2,
    py: 1,
    px: drawerOpen ? 1.5 : 0,
    justifyContent: drawerOpen ? 'flex-start' : 'center',
    mb: 0.25
  };
  const iconSx = { minWidth: drawerOpen ? 36 : 0, color: 'text.secondary' };

  const avatar = (
    <Avatar
      sx={{
        width: 34,
        height: 34,
        fontSize: 15,
        fontWeight: 700,
        color: 'primary.main',
        bgcolor: (t) => alpha(t.palette.primary.main, 0.15)
      }}
    >
      {initial}
    </Avatar>
  );

  return (
    <Box sx={{ mt: 'auto', pt: 1 }}>
      <Divider sx={{ mb: 1 }} />

      {/* Perfil */}
      <Tooltip title={drawerOpen ? '' : name} placement="right">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: drawerOpen ? 1.25 : 0,
            justifyContent: drawerOpen ? 'flex-start' : 'center',
            px: drawerOpen ? 1.25 : 0,
            py: 0.75,
            mb: 0.5
          }}
        >
          {avatar}
          {drawerOpen && (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                {name}
              </Typography>
              {email && (
                <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
                  {email}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Tooltip>

      {/* Alternar tema */}
      <Tooltip title={drawerOpen ? '' : isDark ? 'Modo claro' : 'Modo escuro'} placement="right">
        <ListItemButton onClick={toggleTheme} sx={rowSx} aria-label="alternar tema">
          <ListItemIcon sx={iconSx}>{isDark ? <IconSun size={20} stroke={1.6} /> : <IconMoon size={20} stroke={1.6} />}</ListItemIcon>
          {drawerOpen && (
            <ListItemText primary={<Typography variant="body1" sx={{ color: 'text.primary' }}>{isDark ? 'Modo claro' : 'Modo escuro'}</Typography>} />
          )}
        </ListItemButton>
      </Tooltip>

      {/* Sair */}
      <Tooltip title={drawerOpen ? '' : 'Sair'} placement="right">
        <ListItemButton
          onClick={handleLogout}
          sx={{ ...rowSx, '&:hover': { bgcolor: 'error.light', '& .MuiListItemIcon-root, & .MuiTypography-root': { color: 'error.main' } } }}
          aria-label="sair"
        >
          <ListItemIcon sx={iconSx}>
            <IconLogout size={20} stroke={1.6} />
          </ListItemIcon>
          {drawerOpen && <ListItemText primary={<Typography variant="body1" sx={{ color: 'text.primary' }}>Sair</Typography>} />}
        </ListItemButton>
      </Tooltip>
    </Box>
  );
}

SidebarActions.propTypes = { drawerOpen: PropTypes.bool };
