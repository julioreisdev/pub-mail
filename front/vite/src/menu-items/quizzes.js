// assets
import { IconListLetters, IconUsers } from '@tabler/icons-react';

// constant
const icons = { IconListLetters, IconUsers };

// ==============================|| QUIZZES MENU ITEMS ||============================== //

const quizzes = {
  id: 'quizzes',
  title: 'Quizzes',
  type: 'group',
  icon: icons.IconListLetters,
  children: [
    {
      id: 'quizzes-list',
      title: 'Quizzes',
      type: 'item',
      url: '/quizzes',
      icon: icons.IconListLetters,
      target: false
    },
    {
      id: 'quizzes-leads',
      title: 'Leads',
      type: 'item',
      url: '/quizzes/leads',
      icon: icons.IconUsers,
      target: false
    }
  ]
};

export default quizzes;
