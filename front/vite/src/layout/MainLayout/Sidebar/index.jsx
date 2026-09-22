import { memo, useMemo } from 'react';

import useMediaQuery from '@mui/material/useMediaQuery';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';

// project imports
import MenuList from '../MenuList';
import MiniDrawerStyled from './MiniDrawerStyled';
import SidebarToggle from './SidebarToggle';
import SidebarActions from './SidebarActions';

import { drawerWidth } from 'store/constant';
import SimpleBar from 'ui-component/third-party/SimpleBar';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

// ==============================|| SIDEBAR DRAWER ||============================== //

function Sidebar() {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  // conteúdo interno: coluna full-height → topo (toggle) · lista (rola) · rodapé (tema/sair)
  const content = useMemo(() => {
    const contentPadding = drawerOpen ? { px: 2 } : { px: 1 };
    const list = (
      <Box sx={{ ...contentPadding, pt: 0.5 }}>
        <MenuList />
      </Box>
    );

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <SidebarToggle
          drawerOpen={downMD ? true : drawerOpen}
          isMobile={downMD}
          onToggle={() => handlerDrawerOpen(downMD ? false : !drawerOpen)}
        />

        <Box sx={{ flex: 1, minHeight: 0 }}>
          {downMD ? (
            <Box sx={{ height: '100%', overflowY: 'auto' }}>{list}</Box>
          ) : (
            <SimpleBar sx={{ height: '100%' }}>{list}</SimpleBar>
          )}
        </Box>

        <Box sx={{ ...contentPadding, pb: 1.5 }}>
          <SidebarActions drawerOpen={downMD ? true : drawerOpen} />
        </Box>
      </Box>
    );
  }, [downMD, drawerOpen]);

  return (
    <Box component="nav" sx={{ flexShrink: { md: 0 }, width: { xs: 'auto', md: drawerWidth } }} aria-label="menu principal">
      {downMD ? (
        <Drawer
          variant="temporary"
          anchor="left"
          open={drawerOpen}
          onClose={() => handlerDrawerOpen(!drawerOpen)}
          slotProps={{
            paper: {
              sx: {
                mt: 0,
                zIndex: 1099,
                width: drawerWidth,
                bgcolor: 'background.default',
                color: 'text.primary',
                borderRight: 'none'
              }
            }
          }}
          ModalProps={{ keepMounted: true }}
          color="inherit"
        >
          {content}
        </Drawer>
      ) : (
        <MiniDrawerStyled variant="permanent" open={drawerOpen}>
          {content}
        </MiniDrawerStyled>
      )}
    </Box>
  );
}

export default memo(Sidebar);
