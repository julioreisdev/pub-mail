import PropTypes from 'prop-types';
import { useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';

// project imports
import NavCollapse from '../NavCollapse';
import NavItem from '../NavItem';
import { useGetMenuMaster } from 'api/menu';

// assets
import { IconChevronRight } from '@tabler/icons-react';

const STORAGE_PREFIX = 'pm-sidebar-group-';

// ==============================|| SIDEBAR MENU LIST GROUP (accordion) ||============================== //

export default function NavGroup({ item }) {
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  // Accordion ABERTO por padrão; a escolha do usuário é persistida por grupo.
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + item.id);
      return stored === null ? true : stored === '1';
    } catch {
      return true;
    }
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_PREFIX + item.id, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const items = item.children?.map((menu) => {
    switch (menu?.type) {
      case 'collapse':
        return <NavCollapse key={menu.id} menu={menu} level={1} parentId={item.id} />;
      case 'item':
        return <NavItem key={menu.id} item={menu} level={1} />;
      default:
        return null;
    }
  });

  const GroupIcon = item.icon;

  // Recolhido (mini): sem cabeçalho/accordion — só os ícones dos itens.
  if (!drawerOpen) {
    return (
      <List disablePadding sx={{ mb: 0.5 }}>
        {items}
      </List>
    );
  }

  return (
    <Box sx={{ mb: 0.25 }}>
      <ListItemButton
        onClick={toggle}
        aria-expanded={open}
        sx={{
          borderRadius: 2,
          py: 0.75,
          px: 1.25,
          mb: 0.25,
          gap: 1,
          color: 'text.secondary',
          '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }
        }}
      >
        {GroupIcon ? (
          <Box component="span" sx={{ display: 'flex', color: 'inherit', flexShrink: 0 }}>
            <GroupIcon size={17} stroke={1.9} />
          </Box>
        ) : null}
        <Typography
          variant="caption"
          sx={{
            flex: 1,
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'inherit',
            lineHeight: 1.6
          }}
        >
          {item.title}
        </Typography>
        <IconChevronRight
          size={16}
          stroke={2}
          style={{ transition: 'transform .2s ease', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}
        />
      </ListItemButton>

      <Collapse in={open} timeout={220} unmountOnExit>
        <List disablePadding sx={{ pl: 0.25 }}>
          {items}
        </List>
      </Collapse>
    </Box>
  );
}

NavGroup.propTypes = { item: PropTypes.any };
