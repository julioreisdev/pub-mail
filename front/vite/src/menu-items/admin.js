// assets
import { IconUserShield } from '@tabler/icons-react';

// constant
const icons = { IconUserShield };

// ==============================|| ADMIN MENU ITEMS (somente SUPER_ADMIN) ||============================== //

const admin = {
  id: 'admin',
  title: 'Administração',
  type: 'group',
  requiredRole: 'SUPER_ADMIN',
  icon: icons.IconUserShield,
  children: [
    {
      id: 'admin-users',
      title: 'Usuários',
      type: 'item',
      url: '/admin/users',
      icon: icons.IconUserShield,
      target: false
    }
  ]
};

export default admin;
