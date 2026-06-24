// assets
import { IconBuildingCommunity } from '@tabler/icons-react';

// constant
const icons = { IconBuildingCommunity };

// ==============================|| CONFIGURAÇÕES MENU ITEMS ||============================== //

const settings = {
  id: 'settings',
  title: 'Configurações',
  caption: '',
  icon: icons.IconBuildingCommunity,
  type: 'group',
  children: [
    {
      id: 'account-settings',
      title: 'Conta & Domínios',
      type: 'item',
      url: '/settings/account-settings',
      icon: icons.IconBuildingCommunity,
      target: false
    }
  ]
};

export default settings;
