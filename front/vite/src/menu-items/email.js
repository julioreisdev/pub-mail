// assets
import { IconMailBolt, IconChartHistogram, IconTestPipe, IconUsers, IconRoute, IconRecycle, IconBolt } from '@tabler/icons-react';

// constant
const icons = { IconMailBolt, IconChartHistogram, IconTestPipe, IconUsers, IconRoute, IconRecycle, IconBolt };

// ==============================|| EMAIL MARKETING MENU ITEMS ||============================== //

const emails = {
    id: 'email',
    title: 'Email Marketing',
    type: 'group',
    icon: icons.IconMailBolt,
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
            id: 'email-analytics',
            title: 'Analytics',
            type: 'item',
            url: '/email/analytics',
            icon: icons.IconChartHistogram,
            breadcrumbs: true
        },
        {
            id: 'email-ab-tests',
            title: 'Testes A/B',
            type: 'item',
            url: '/email/ab-tests',
            icon: icons.IconTestPipe,
            breadcrumbs: true
        },
        {
            id: 'email-leads',
            title: 'Leads',
            type: 'item',
            url: '/email/leads',
            icon: icons.IconUsers,
            breadcrumbs: true
        },
        {
            id: 'email-flows',
            title: 'Fluxo Inicial',
            type: 'item',
            url: '/email/flows',
            icon: icons.IconRoute,
            breadcrumbs: true
        },
        {
            id: 'email-recycle',
            title: 'Reciclagem',
            type: 'item',
            url: '/email/recycle',
            icon: icons.IconRecycle,
            breadcrumbs: true
        },
        {
            id: 'email-triggers',
            title: 'Gatilhos',
            type: 'item',
            url: '/email/triggers',
            icon: icons.IconBolt,
            breadcrumbs: true
        }
    ]
};

export default emails;
