// assets
import { IconBrandWordpress, IconLanguage } from '@tabler/icons-react';

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
    }
  ]
};

export default wordpress;
