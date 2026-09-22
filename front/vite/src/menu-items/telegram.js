// assets
import { IconBrandTelegram, IconAdjustmentsHorizontal, IconUsersGroup, IconSpeakerphone, IconMessages, IconSitemap, IconBroadcast, IconRotateClockwise2, IconCreditCard } from '@tabler/icons-react';

// constant
const icons = { IconBrandTelegram, IconAdjustmentsHorizontal, IconUsersGroup, IconSpeakerphone, IconMessages, IconSitemap, IconBroadcast, IconRotateClockwise2, IconCreditCard };

// ==============================|| TELEGRAM MENU ITEMS ||============================== //

const telegram = {
  id: 'telegram',
  title: 'Telegram',
  type: 'group',
  icon: icons.IconBrandTelegram,
  children: [
    {
      id: 'telegram-settings',
      title: 'Configurações',
      type: 'item',
      url: '/telegram/settings',
      icon: icons.IconAdjustmentsHorizontal,
      target: false
    },
    {
      id: 'telegram-groups',
      title: 'Grupos',
      type: 'item',
      url: '/telegram/groups',
      icon: icons.IconUsersGroup,
      target: false
    },
    {
      id: 'telegram-channels',
      title: 'Canais',
      type: 'item',
      url: '/telegram/channels',
      icon: icons.IconBroadcast,
      target: false
    },
    {
      id: 'telegram-broadcasts',
      title: 'Broadcasts',
      type: 'item',
      url: '/telegram/broadcasts',
      icon: icons.IconSpeakerphone,
      target: false
    },
    {
      id: 'telegram-rotators',
      title: 'Mensagem rotativa',
      type: 'item',
      url: '/telegram/rotators',
      icon: icons.IconRotateClockwise2,
      target: false
    },
    {
      id: 'telegram-payments',
      title: 'Pagamentos / VIP',
      type: 'item',
      url: '/telegram/payments',
      icon: icons.IconCreditCard,
      target: false
    },
    {
      id: 'telegram-dms',
      title: 'DMs',
      type: 'item',
      url: '/telegram/dms',
      icon: icons.IconMessages,
      target: false
    },
    {
      id: 'telegram-flows',
      title: 'Fluxo Inicial',
      type: 'item',
      url: '/telegram/flows',
      icon: icons.IconSitemap,
      target: false
    }
  ]
};

export default telegram;
