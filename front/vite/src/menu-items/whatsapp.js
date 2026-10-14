// assets
import {
  IconBrandWhatsapp,
  IconAdjustmentsHorizontal,
  IconMessages,
  IconCircleDashed,
  IconAddressBook,
  IconSpeakerphone,
  IconCalendarClock,
  IconRobot,
  IconUserDollar,
  IconPackage,
  IconReceipt2,
  IconLayoutKanban,
  IconChecklist,
  IconChartBar,
  IconBellRinging,
  IconCalendarEvent,
  IconUsersGroup,
  IconTicket,
  IconShoppingCart,
  IconReportMoney
} from '@tabler/icons-react';

const icons = {
  IconBrandWhatsapp,
  IconAdjustmentsHorizontal,
  IconMessages,
  IconCircleDashed,
  IconAddressBook,
  IconSpeakerphone,
  IconCalendarClock,
  IconRobot,
  IconUserDollar,
  IconPackage,
  IconReceipt2,
  IconLayoutKanban,
  IconChecklist,
  IconChartBar,
  IconBellRinging,
  IconCalendarEvent,
  IconUsersGroup,
  IconTicket,
  IconShoppingCart,
  IconReportMoney
};

// ==============================|| WHATSAPP MENU ITEMS ||============================== //

const whatsapp = {
  id: 'whatsapp',
  title: 'WhatsApp',
  type: 'group',
  requiredModule: 'whatsapp',
  icon: icons.IconBrandWhatsapp,
  children: [
    {
      id: 'whatsapp-settings',
      title: 'Configurações',
      type: 'item',
      url: '/whatsapp/settings',
      icon: icons.IconAdjustmentsHorizontal,
      requiredPermission: 'whatsapp:settings', // Fase 7: sub-permissão (MenuList filtra)
      target: false
    },
    {
      id: 'whatsapp-notifications',
      title: 'Notificações',
      type: 'item',
      url: '/whatsapp/notifications',
      icon: icons.IconBellRinging,
      target: false
    },
    { id: 'whatsapp-chat', title: 'Chat', type: 'item', url: '/whatsapp/chat', icon: icons.IconMessages, target: false },
    { id: 'whatsapp-bot', title: 'Fluxo do Bot', type: 'item', url: '/whatsapp/bot', icon: icons.IconRobot, target: false },
    { id: 'whatsapp-status', title: 'Status', type: 'item', url: '/whatsapp/status', icon: icons.IconCircleDashed, target: false },
    {
      id: 'whatsapp-schedules',
      title: 'Agendamentos',
      type: 'item',
      url: '/whatsapp/schedules',
      icon: icons.IconCalendarClock,
      target: false
    },
    { id: 'whatsapp-contacts', title: 'Contatos', type: 'item', url: '/whatsapp/contacts', icon: icons.IconAddressBook, target: false },
    { id: 'whatsapp-pipeline', title: 'Funil', type: 'item', url: '/whatsapp/pipeline', icon: icons.IconLayoutKanban, target: false },
    { id: 'whatsapp-tasks', title: 'Tarefas', type: 'item', url: '/whatsapp/tasks', icon: icons.IconChecklist, target: false },
    {
      id: 'whatsapp-customers',
      title: 'Clientes',
      type: 'item',
      url: '/whatsapp/customers',
      icon: icons.IconUserDollar,
      requiredPermission: 'whatsapp:crm',
      target: false
    },
    { id: 'whatsapp-agenda', title: 'Agenda', type: 'item', url: '/whatsapp/agenda', icon: icons.IconCalendarEvent, target: false },
    {
      id: 'whatsapp-resources',
      title: 'Recursos',
      type: 'item',
      url: '/whatsapp/resources',
      icon: icons.IconUsersGroup,
      target: false
    },
    { id: 'whatsapp-tickets', title: 'Chamados', type: 'item', url: '/whatsapp/tickets', icon: icons.IconTicket, target: false },
    { id: 'whatsapp-orders', title: 'Pedidos', type: 'item', url: '/whatsapp/orders', icon: icons.IconShoppingCart, target: false },
    {
      id: 'whatsapp-products',
      title: 'Produtos',
      type: 'item',
      url: '/whatsapp/products',
      icon: icons.IconPackage,
      requiredPermission: 'whatsapp:crm',
      target: false
    },
    {
      id: 'whatsapp-charges',
      title: 'Cobranças',
      type: 'item',
      url: '/whatsapp/charges',
      icon: icons.IconReceipt2,
      requiredPermission: 'whatsapp:finance',
      target: false
    },
    {
      id: 'whatsapp-finance',
      title: 'Financeiro',
      type: 'item',
      url: '/whatsapp/finance',
      icon: icons.IconReportMoney,
      requiredPermission: 'whatsapp:finance',
      target: false
    },
    { id: 'whatsapp-metrics', title: 'Métricas', type: 'item', url: '/whatsapp/metrics', icon: icons.IconChartBar, target: false },
    {
      id: 'whatsapp-broadcasts',
      title: 'Broadcasts',
      type: 'item',
      url: '/whatsapp/broadcasts',
      icon: icons.IconSpeakerphone,
      target: false
    }
  ]
};

export default whatsapp;
