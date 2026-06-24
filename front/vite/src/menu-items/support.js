// assets
import { IconCreditCard } from '@tabler/icons-react';
import { IconBuildingCommunity } from '@tabler/icons-react';
import { IconHelp } from '@tabler/icons-react';
import { IconListLetters } from '@tabler/icons-react';

// constant
const icons = { IconCreditCard, IconBuildingCommunity, IconHelp, IconListLetters };

// ==============================|| CONFIGURAÇÕES MENU ITEMS ||============================== //

const support = {
    id: 'support',
    title: 'Suporte',
    caption: '',
    icon: icons.IconHelp,
    type: 'group',
    children: [
        {
            id: 'catalog',
            title: 'Catálogo',
            type: 'item',
            url: '/support/catalog',
            icon: icons.IconListLetters,
            target: false
        },
        {
            id: 'support-tickets',
            title: 'Tickets',
            type: 'item',
            url: '/support/tickets',
            icon: icons.IconHelp,
            target: false
        }
    ]
};

export default support;
