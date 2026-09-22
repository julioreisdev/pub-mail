// assets
import { IconUsers, IconRouteAltLeft } from '@tabler/icons-react';

// constant
const icons = { IconUsers, IconRouteAltLeft };

// ==============================|| LEADS MENU ITEMS ||============================== //

const leads = {
  id: 'leads',
  title: 'Leads',
  type: 'group',
  children: [
    {
      id: 'leads-list',
      title: 'Leads',
      type: 'item',
      url: '/webchat/leads',
      icon: icons.IconUsers,
      target: false
    },
    {
      id: 'leads-automations',
      title: 'Automações',
      type: 'item',
      url: '/leads/automations',
      icon: icons.IconRouteAltLeft,
      target: false
    }
  ]
};

export default leads;
