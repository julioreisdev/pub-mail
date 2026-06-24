// project imports
import dashboard from './dashboard';
import emails from './email';
import settings from './settings';
import webchat from './webchat';
import quizzes from './quizzes';
import admin from './admin';

// ==============================|| MENU ITEMS ||============================== //

const menuItems = {
  items: [dashboard, webchat, quizzes, emails, admin, settings]
};

export default menuItems;
