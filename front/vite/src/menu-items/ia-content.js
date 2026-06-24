// assets
import { IconCalendarEvent, IconCards, IconCreditCard, IconBrandFunimation } from '@tabler/icons-react';

// constant
const icons = { IconCalendarEvent, IconCards, IconCreditCard, IconBrandFunimation };

// ==============================|| POSTAGENS MENU ITEMS ||============================== //

const iaContent = {
    id: 'ia-content',
    title: 'Conteúdo de IA',
    caption: '',
    icon: icons.IconCreditCard,
    type: 'group',
    children: [
        {
            id: 'ia-content-avatar',
            title: 'Avatares',
            type: 'item',
            url: '/ia-content/avatars',
            icon: icons.IconBrandFunimation,
            target: false
        }
    ]
};

export default iaContent;
