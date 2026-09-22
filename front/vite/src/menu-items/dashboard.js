// assets
import { IconMailBolt, IconHome, IconLayoutDashboard } from '@tabler/icons-react';

// constant
const icons = { IconMailBolt, IconHome, IconLayoutDashboard };

// ==============================|| DASHBOARD MENU ITEMS ||============================== //

const dashboard = {
  id: 'default',
  title: 'Dashboard',
  type: 'group',
  icon: icons.IconLayoutDashboard,
  children: [
    {
      id: 'dash',
      title: 'Início',
      type: 'item',
      url: '/dashboard',
      icon: icons.IconHome,
      breadcrumbs: false
    }
  ]
};

export default dashboard;
