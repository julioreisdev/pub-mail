// assets
import { IconBrandHipchat, IconRobot, IconUsers } from '@tabler/icons-react';

// constant
const icons = { IconBrandHipchat, IconRobot, IconUsers };

// ==============================|| WEBCHAT MENU ITEMS ||============================== //

const webchat = {
  id: 'webchat',
  title: 'Webchat',
  type: 'group',
  children: [
    {
      id: 'webchat-agentes',
      title: 'Agentes',
      type: 'item',
      url: '/webchat/agentes',
      icon: icons.IconRobot,
      target: false
    },
    {
      id: 'webchat-webchats',
      title: 'Webchats',
      type: 'item',
      url: '/webchat/webchats',
      icon: icons.IconBrandHipchat,
      target: false
    },
    {
      id: 'webchat-leads',
      title: 'Leads',
      type: 'item',
      url: '/webchat/leads',
      icon: icons.IconUsers,
      target: false
    }
  ]
};

export default webchat;
