// assets
import {
  IconUserCircle,
  IconWorld,
  IconPlugConnected,
  IconActivityHeartbeat,
  IconSparkles,
  IconSettings,
  IconCreditCard,
  IconApi,
  IconShieldCheck
} from '@tabler/icons-react';

// constant
const icons = { IconUserCircle, IconWorld, IconPlugConnected, IconActivityHeartbeat, IconSparkles, IconSettings, IconCreditCard, IconApi, IconShieldCheck };

// ==============================|| CONFIGURAÇÕES MENU ITEMS ||============================== //

const settings = {
  id: 'settings',
  title: 'Configurações',
  type: 'group',
  requiredModule: 'settings',
  icon: icons.IconSettings,
  children: [
    {
      id: 'settings-account',
      title: 'Dados da conta',
      type: 'item',
      url: '/settings/account',
      icon: icons.IconUserCircle,
      target: false
    },
    {
      id: 'settings-domains',
      title: 'Domínios',
      type: 'item',
      url: '/settings/domains',
      icon: icons.IconWorld,
      target: false
    },
    {
      id: 'settings-integrations',
      title: 'Integrações',
      type: 'item',
      url: '/settings/integrations',
      icon: icons.IconPlugConnected,
      target: false
    },
    {
      id: 'settings-payments',
      title: 'Pagamentos',
      type: 'item',
      url: '/settings/payments',
      icon: icons.IconCreditCard,
      target: false
    },
    {
      id: 'settings-api',
      title: 'API e Webhooks',
      type: 'item',
      url: '/settings/api',
      icon: icons.IconApi,
      target: false
    },
    {
      // só dono/admin/superadmin (o menu não filtra por lista de papéis: a página mostra o aviso para os demais)
      id: 'settings-audit',
      title: 'Auditoria',
      type: 'item',
      url: '/settings/audit',
      icon: icons.IconShieldCheck,
      target: false
    },
    {
      id: 'settings-api-status',
      title: 'Status de API',
      type: 'item',
      url: '/settings/api-status',
      icon: icons.IconActivityHeartbeat,
      target: false
    },
    {
      id: 'settings-api-tutorial',
      title: 'Tutorial de IA',
      type: 'item',
      url: '/settings/api-tutorial',
      icon: icons.IconSparkles,
      target: false
    }
  ]
};

export default settings;
