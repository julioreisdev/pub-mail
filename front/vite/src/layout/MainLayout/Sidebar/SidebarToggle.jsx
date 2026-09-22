import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconX } from '@tabler/icons-react';

import Logo from 'ui-component/Logo';

// ==============================|| SIDEBAR - TOPO (logo + colapsar) ||============================== //
// Quando aberta: [logo Pub Mail] ........... [recolher]. Quando mini: [expandir].

export default function SidebarToggle({ drawerOpen, onToggle, isMobile = false }) {
  const Icon = isMobile ? IconX : drawerOpen ? IconLayoutSidebarLeftCollapse : IconLayoutSidebarLeftExpand;
  const title = isMobile ? 'Fechar' : drawerOpen ? 'Recolher menu' : 'Expandir menu';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: 60,
        flexShrink: 0,
        px: drawerOpen ? 2 : 0,
        justifyContent: drawerOpen ? 'space-between' : 'center'
      }}
    >
      {drawerOpen && <Logo height={26} />}
      <Tooltip title={title} placement="right">
        <IconButton
          onClick={onToggle}
          size="small"
          aria-label={title}
          sx={{
            color: 'text.secondary',
            borderRadius: 2,
            transition: 'background-color .15s ease, color .15s ease',
            '&:hover': { bgcolor: 'primary.light', color: 'primary.main' }
          }}
        >
          <Icon size={22} stroke={1.6} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

SidebarToggle.propTypes = { drawerOpen: PropTypes.bool, onToggle: PropTypes.func, isMobile: PropTypes.bool };
