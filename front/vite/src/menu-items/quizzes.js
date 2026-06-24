// assets
import { IconListLetters } from '@tabler/icons-react';

// constant
const icons = { IconListLetters };

// ==============================|| QUIZZES MENU ITEMS ||============================== //

const quizzes = {
  id: 'quizzes',
  title: 'Quizzes',
  type: 'group',
  children: [
    {
      id: 'quizzes-list',
      title: 'Quizzes',
      type: 'item',
      url: '/quizzes',
      icon: icons.IconListLetters,
      target: false
    }
  ]
};

export default quizzes;
