import { lazy } from 'react';

// project imports
import MainLayout from 'layout/MainLayout';
import Loadable from 'ui-component/Loadable';

import RequireAuth from './RequireAuth';
import RequireAdmin from './RequireAdmin';
import ErrorBoundary from './ErrorBoundary';

// pages
const DashboardDefault = Loadable(lazy(() => import('views/dashboard/Default')));

const BillingAccount = Loadable(lazy(() => import('views/pages/billing/BillingAccount')));
const AccountSettings = Loadable(lazy(() => import('views/pages/account-settings/AccountSettings')));
const EmailMarketing = Loadable(lazy(() => import('views/pages/email/EmailMarketing')));
const EmailHelp = Loadable(lazy(() => import('views/pages/email/Help')));
const Catalog = Loadable(lazy(() => import('views/pages/catalog/Catalog')));
const Tickets = Loadable(lazy(() => import('views/pages/support/Tickets')));
const Agentes = Loadable(lazy(() => import('views/pages/webchat/Agentes')));
const Webchats = Loadable(lazy(() => import('views/pages/webchat/Webchats')));
const WebchatBuilder = Loadable(lazy(() => import('views/pages/webchat/WebchatBuilder')));
const Leads = Loadable(lazy(() => import('views/pages/webchat/Leads')));
const PostsList = Loadable(lazy(() => import('views/pages/posts/Posts')));
const PostSchedules = Loadable(lazy(() => import('views/pages/posts/Schedules')));
const Avatars = Loadable(lazy(() => import('views/pages/avatars/Avatars')));
const AdminUsers = Loadable(lazy(() => import('views/pages/admin/Users')));
const Quizzes = Loadable(lazy(() => import('views/pages/quiz/Quizzes')));
const QuizBuilder = Loadable(lazy(() => import('views/pages/quiz/QuizBuilder')));

// ==============================|| MAIN ROUTING (PROTECTED) ||============================== //

const MainRoutes = {
  path: '/',
  element: <RequireAuth />,
  errorElement: <ErrorBoundary />,
  children: [
    {
      element: <MainLayout />,
      children: [
        // ✅ Dashboard agora fica em /dashboard (index)
        {
          path: 'dashboard',
          children: [{ index: true, element: <DashboardDefault /> }]
        },

        {
          path: 'email',
          children: [
            { path: 'email-marketing', element: <EmailMarketing /> },
            { path: 'email-marketing-help', element: <EmailHelp /> }
          ]
        },

        {
          path: 'settings',
          children: [
            { path: 'billing-account', element: <BillingAccount /> },
            { path: 'account-settings', element: <AccountSettings /> }
          ]
        },

        {
          path: 'support',
          children: [
            { path: 'catalog', element: <Catalog /> },
            { path: 'tickets', element: <Tickets /> }
          ]
        },

        {
          path: 'webchat',
          children: [
            { path: 'agentes', element: <Agentes /> },
            { path: 'webchats', element: <Webchats /> },
            { path: 'webchats/:id/builder', element: <WebchatBuilder /> },
            { path: 'leads', element: <Leads /> }
          ]
        },

        {
          path: 'quizzes',
          children: [
            { index: true, element: <Quizzes /> },
            { path: ':id/builder', element: <QuizBuilder /> }
          ]
        },

        {
          element: <RequireAdmin />,
          children: [
            {
              path: 'admin',
              children: [{ path: 'users', element: <AdminUsers /> }]
            }
          ]
        },

        {
          path: 'posts',
          children: [
            { path: 'list', element: <PostsList /> },
            { path: 'schedules', element: <PostSchedules /> }
          ]
        },
        {
          path: 'ia-content',
          children: [{ path: 'avatars', element: <Avatars /> }]
        }
      ]
    }
  ]
};

export default MainRoutes;
