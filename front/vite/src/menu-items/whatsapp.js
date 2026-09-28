// assets
import {
  IconBrandWhatsapp,
  IconAdjustmentsHorizontal,
  IconMessages,
  IconCircleDashed,
  IconAddressBook,
  IconSpeakerphone,
  IconCalendarClock
} from '@tabler/icons-react';

const icons = {
  IconBrandWhatsapp,
  IconAdjustmentsHorizontal,
  IconMessages,
  IconCircleDashed,
  IconAddressBook,
  IconSpeakerphone,
  IconCalendarClock
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
      target: false
    },
    { id: 'whatsapp-chat', title: 'Chat', type: 'item', url: '/whatsapp/chat', icon: icons.IconMessages, target: false },
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
