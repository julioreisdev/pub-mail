// assets
import { IconBrandWordpress, IconLanguage, IconBellRinging } from '@tabler/icons-react';

// ==============================|| WORDPRESS MENU ITEMS ||============================== //

const wordpress = {
  id: 'wordpress',
  title: 'WordPress',
  type: 'group',
  requiredModule: 'wordpress',
  icon: IconBrandWordpress,
  children: [
    {
      id: 'wordpress-translator',
      title: 'Tradução Invisível',
      type: 'item',
      url: '/wordpress/tradutor',
      icon: IconLanguage,
      target: false
    },
    {
      id: 'wordpress-push-in-play',
      title: 'Push In Play',
      type: 'item',
      url: '/wordpress/push-in-play',
      icon: IconBellRinging,
      target: false
    }
  ]
};

export default wordpress;
