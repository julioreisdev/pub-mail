import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';

// project imports
import Footer from './Footer';
import Sidebar from './Sidebar';
import MainContentStyled from './MainContentStyled';
import Loader from 'ui-component/Loader';
import Breadcrumbs from 'ui-component/extended/Breadcrumbs';

import useConfig from 'hooks/useConfig';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

// assets
import { IconMenu2 } from '@tabler/icons-react';

// ==============================|| MAIN LAYOUT ||============================== //

export default function MainLayout() {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));

  const {
    state: { borderRadius, miniDrawer }
  } = useConfig();
  const { menuMaster, menuMasterLoading } = useGetMenuMaster();
  const drawerOpen = menuMaster?.isDashboardDrawerOpened;

  useEffect(() => {
    handlerDrawerOpen(!miniDrawer);
  }, [miniDrawer]);

  useEffect(() => {
    downMD && handlerDrawerOpen(false);
  }, [downMD]);

  if (menuMasterLoading) return <Loader />;

  return (
    <Box sx={{ display: 'flex' }}>
      {/* menu / drawer (sem header — logout e tema ficam dentro da própria sidebar) */}
      <Sidebar />

      {/* gatilho de menu SÓ no mobile (única forma de abrir o drawer sem header) */}
      {downMD && (
        <IconButton
          onClick={() => handlerDrawerOpen(true)}
          aria-label="abrir menu"
          sx={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 1200,
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 1,
            '&:hover': { bgcolor: 'background.paper' }
          }}
        >
          <IconMenu2 stroke={1.5} size={20} />
        </IconButton>
      )}

      {/* main content */}
      <MainContentStyled {...{ borderRadius, open: downMD ? false : drawerOpen }}>
        <Box
          sx={{ px: { xs: 0 }, pt: { xs: 5, md: 0 }, minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}
        >
          <Breadcrumbs />
          <Outlet />
          <Footer />
        </Box>
      </MainContentStyled>
    </Box>
  );
}
