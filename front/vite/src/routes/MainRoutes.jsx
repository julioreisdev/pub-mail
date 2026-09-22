import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

// project imports
import MainLayout from 'layout/MainLayout';
import Loadable from 'ui-component/Loadable';

import RequireAuth from './RequireAuth';
import RequireAdmin from './RequireAdmin';
import ErrorBoundary from './ErrorBoundary';

// pages
const DashboardDefault = Loadable(lazy(() => import('views/dashboard/Default')));

const BillingAccount = Loadable(lazy(() => import('views/pages/billing/BillingAccount')));
const AccountDataPage = Loadable(lazy(() => import('views/pages/account-settings/AccountDataPage')));
const DomainsPage = Loadable(lazy(() => import('views/pages/account-settings/DomainsPage')));
const IntegrationsPage = Loadable(lazy(() => import('views/pages/account-settings/IntegrationsPage')));
const ApiStatusPage = Loadable(lazy(() => import('views/pages/account-settings/ApiStatusPage')));
const ApiTutorialPage = Loadable(lazy(() => import('views/pages/account-settings/ApiTutorialPage')));
const EmailMarketing = Loadable(lazy(() => import('views/pages/email/EmailMarketing')));
const EmailHelp = Loadable(lazy(() => import('views/pages/email/Help')));
const EmailAnalytics = Loadable(lazy(() => import('views/pages/email/Analytics')));
const EmailAbTests = Loadable(lazy(() => import('views/pages/email/AbTests')));
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
const FlowsPage = Loadable(lazy(() => import('views/pages/leads/FlowsPage')));
const RecyclePage = Loadable(lazy(() => import('views/pages/leads/RecyclePage')));
const TriggersPage = Loadable(lazy(() => import('views/pages/leads/TriggersPage')));
const TelegramPlaceholder = Loadable(lazy(() => import('views/pages/telegram/TelegramPlaceholder')));
const TelegramSettings = Loadable(lazy(() => import('views/pages/telegram/TelegramSettings')));
const TelegramDMs = Loadable(lazy(() => import('views/pages/telegram/TelegramDMs')));
const TelegramFlows = Loadable(lazy(() => import('views/pages/telegram/TelegramFlows')));
const TelegramGroups = Loadable(lazy(() => import('views/pages/telegram/TelegramGroups')));
const TelegramBroadcasts = Loadable(lazy(() => import('views/pages/telegram/TelegramBroadcasts')));
const TelegramRotators = Loadable(lazy(() => import('views/pages/telegram/TelegramRotators')));
const TelegramPayments = Loadable(lazy(() => import('views/pages/telegram/TelegramPayments')));

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
            { path: 'email-marketing-help', element: <EmailHelp /> },
            { path: 'analytics', element: <EmailAnalytics /> },
            { path: 'ab-tests', element: <EmailAbTests /> },
            { path: 'leads', element: <Leads lockedOrigin="email" /> },
            { path: 'flows', element: <FlowsPage /> },
            { path: 'recycle', element: <RecyclePage /> },
            { path: 'triggers', element: <TriggersPage /> }
          ]
        },

        {
          path: 'settings',
          children: [
            { path: 'billing-account', element: <BillingAccount /> },
            { path: 'account', element: <AccountDataPage /> },
            { path: 'domains', element: <DomainsPage /> },
            { path: 'integrations', element: <IntegrationsPage /> },
            { path: 'api-status', element: <ApiStatusPage /> },
            { path: 'api-tutorial', element: <ApiTutorialPage /> },
            // compat: link antigo -> nova página
            { path: 'account-settings', element: <Navigate to="/settings/account" replace /> }
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
            { path: 'leads', element: <Leads lockedOrigin="webchat" /> }
          ]
        },

        {
          path: 'quizzes',
          children: [
            { index: true, element: <Quizzes /> },
            { path: 'leads', element: <Leads lockedOrigin="quiz" /> },
            { path: ':id/builder', element: <QuizBuilder /> }
          ]
        },

        {
          path: 'leads',
          children: [{ path: 'automations', element: <Navigate to="/email/flows" replace /> }]
        },

        {
          path: 'telegram',
          children: [
            {
              path: 'settings',
              element: <TelegramSettings />
            },
            {
              path: 'groups',
              element: <TelegramGroups kind="group" />
            },
            {
              path: 'channels',
              element: <TelegramGroups kind="channel" />
            },
            {
              path: 'broadcasts',
              element: <TelegramBroadcasts />
            },
            {
              path: 'rotators',
              element: <TelegramRotators />
            },
            {
              path: 'payments',
              element: <TelegramPayments />
            },
            {
              path: 'dms',
              element: <TelegramDMs />
            },
            {
              path: 'flows',
              element: <TelegramFlows />
            }
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
