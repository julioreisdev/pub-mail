// assets
import { IconMailBolt, IconHome } from '@tabler/icons-react';

// constant
const icons = { IconMailBolt, IconHome };

// ==============================|| DASHBOARD MENU ITEMS ||============================== //

const dashboard = {
  id: 'default',
  title: 'Dashboard',
  type: 'group',
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
