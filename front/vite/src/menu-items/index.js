// project imports
import dashboard from './dashboard';
import emails from './email';
import telegram from './telegram';
import whatsapp from './whatsapp';
import wordpress from './wordpress';
import settings from './settings';
import webchat from './webchat';
import quizzes from './quizzes';
import admin from './admin';

// ==============================|| MENU ITEMS ||============================== //

const menuItems = {
  items: [dashboard, webchat, quizzes, emails, telegram, whatsapp, wordpress, admin, settings]
};

export default menuItems;
