// assets
import { IconMailBolt, IconHome, IconHelpCircle } from '@tabler/icons-react';

// constant
const icons = { IconMailBolt, IconHome, IconHelpCircle };

// ==============================|| DASHBOARD MENU ITEMS ||============================== //

const emails = {
    id: 'email',
    title: 'Email Marketing',
    type: 'group',
    children: [
        {
            id: 'email-marketing',
            title: 'Projetos',
            type: 'item',
            url: '/email/email-marketing',
            icon: icons.IconMailBolt,
            breadcrumbs: true
        },
        {
            id: 'email-marketing-help',
            title: 'Ajuda',
            type: 'item',
            url: '/email/email-marketing-help',
            icon: icons.IconHelpCircle,
            breadcrumbs: true
        }
    ]
};

export default emails;
