// assets
import { IconCalendarEvent, IconCards, IconCreditCard } from '@tabler/icons-react';

// constant
const icons = { IconCalendarEvent, IconCards, IconCreditCard };

// ==============================|| POSTAGENS MENU ITEMS ||============================== //

const posts = {
    id: 'post',
    title: 'Postagens',
    caption: '',
    icon: icons.IconCreditCard,
    type: 'group',
    children: [
        {
            id: 'posts-list',
            title: 'Galeria',
            type: 'item',
            url: '/posts/list',
            icon: icons.IconCards,
            target: false
        },
        {
            id: 'posts-schedules',
            title: 'Agendamentos',
            type: 'item',
            url: '/posts/schedules',
            icon: icons.IconCalendarEvent,
            target: false
        }
    ]
};

export default posts;
