import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

// project imports
import MainLayout from 'layout/MainLayout';
import Loadable from 'ui-component/Loadable';

import RequireAuth from './RequireAuth';
import RequireAdmin from './RequireAdmin';
import RequireModule from './RequireModule';
import RequirePermission from './RequirePermission';
import ErrorBoundary from './ErrorBoundary';

// pages
const DashboardDefault = Loadable(lazy(() => import('views/dashboard/Default')));

const BillingAccount = Loadable(lazy(() => import('views/pages/billing/BillingAccount')));
const AccountDataPage = Loadable(lazy(() => import('views/pages/account-settings/AccountDataPage')));
const DomainsPage = Loadable(lazy(() => import('views/pages/account-settings/DomainsPage')));
const IntegrationsPage = Loadable(lazy(() => import('views/pages/account-settings/IntegrationsPage')));
const ApiStatusPage = Loadable(lazy(() => import('views/pages/account-settings/ApiStatusPage')));
const ApiTutorialPage = Loadable(lazy(() => import('views/pages/account-settings/ApiTutorialPage')));
const PaymentsSettingsPage = Loadable(lazy(() => import('views/pages/account-settings/PaymentsSettingsPage')));
const ApiWebhooks = Loadable(lazy(() => import('views/pages/account-settings/ApiWebhooks')));
const AuditLog = Loadable(lazy(() => import('views/pages/account-settings/AuditLog')));
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
const AdminPayments = Loadable(lazy(() => import('views/pages/admin/Payments')));
const Quizzes = Loadable(lazy(() => import('views/pages/quiz/Quizzes')));
const QuizBuilder = Loadable(lazy(() => import('views/pages/quiz/QuizBuilder')));
const FlowsPage = Loadable(lazy(() => import('views/pages/leads/FlowsPage')));
const RecyclePage = Loadable(lazy(() => import('views/pages/leads/RecyclePage')));
const TriggersPage = Loadable(lazy(() => import('views/pages/leads/TriggersPage')));
const TelegramSettings = Loadable(lazy(() => import('views/pages/telegram/TelegramSettings')));
const TelegramDMs = Loadable(lazy(() => import('views/pages/telegram/TelegramDMs')));
const TelegramFlows = Loadable(lazy(() => import('views/pages/telegram/TelegramFlows')));
const TelegramGroups = Loadable(lazy(() => import('views/pages/telegram/TelegramGroups')));
const TelegramBroadcasts = Loadable(lazy(() => import('views/pages/telegram/TelegramBroadcasts')));
const TelegramRotators = Loadable(lazy(() => import('views/pages/telegram/TelegramRotators')));
const TelegramPayments = Loadable(lazy(() => import('views/pages/telegram/TelegramPayments')));
const WhatsAppSettings = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppSettings')));
const WhatsAppChat = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppChat')));
const WhatsAppContacts = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppContacts')));
const WhatsAppStatus = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppStatus')));
const WhatsAppBroadcasts = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppBroadcasts')));
const WhatsAppSchedules = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppSchedules')));
const WhatsAppBot = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppBot')));
const WhatsAppCustomers = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppCustomers')));
const WhatsAppProducts = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppProducts')));
const WhatsAppCharges = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppCharges')));
const WhatsAppPipeline = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppPipeline')));
const WhatsAppTasks = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppTasks')));
const WhatsAppMetrics = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppMetrics')));
const WhatsAppNotifications = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppNotifications')));
const WhatsAppAgenda = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppAgenda')));
const WhatsAppResources = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppResources')));
const WhatsAppTickets = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppTickets')));
const WhatsAppOrders = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppOrders')));
const WhatsAppFinance = Loadable(lazy(() => import('views/pages/whatsapp/WhatsAppFinance')));
const TranslatorPlugin = Loadable(lazy(() => import('views/pages/wordpress/TranslatorPlugin')));
const PushInPlay = Loadable(lazy(() => import('views/pages/wordpress/PushInPlay')));

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
          element: <RequireModule module="email" />, // gate por módulo liberado
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
          element: <RequireModule module="settings" />, // gate por módulo liberado
          children: [
            { path: 'billing-account', element: <BillingAccount /> },
            { path: 'account', element: <AccountDataPage /> },
            { path: 'domains', element: <DomainsPage /> },
            { path: 'integrations', element: <IntegrationsPage /> },
            { path: 'api-status', element: <ApiStatusPage /> },
            { path: 'api-tutorial', element: <ApiTutorialPage /> },
            { path: 'payments', element: <PaymentsSettingsPage /> },
            { path: 'api', element: <ApiWebhooks /> },
            { path: 'audit', element: <AuditLog /> },
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
          element: <RequireModule module="webchat" />, // gate por módulo liberado
          children: [
            { path: 'agentes', element: <Agentes /> },
            { path: 'webchats', element: <Webchats /> },
            { path: 'webchats/:id/builder', element: <WebchatBuilder /> },
            { path: 'leads', element: <Leads lockedOrigin="webchat" /> }
          ]
        },

        {
          path: 'quizzes',
          element: <RequireModule module="quiz" />, // gate por módulo liberado
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
          path: 'whatsapp',
          element: <RequireModule module="whatsapp" />, // gate por módulo liberado
          children: [
            // Fase 7: sub-permissões do WhatsApp (o back também nega com 403 PERMISSION_DENIED)
            {
              path: 'settings',
              element: (
                <RequirePermission permission="whatsapp:settings">
                  <WhatsAppSettings />
                </RequirePermission>
              )
            },
            { path: 'chat', element: <WhatsAppChat /> },
            { path: 'bot', element: <WhatsAppBot /> },
            { path: 'status', element: <WhatsAppStatus /> },
            { path: 'contacts', element: <WhatsAppContacts /> },
            { path: 'broadcasts', element: <WhatsAppBroadcasts /> },
            { path: 'schedules', element: <WhatsAppSchedules /> },
            {
              path: 'customers',
              element: (
                <RequirePermission permission="whatsapp:crm">
                  <WhatsAppCustomers />
                </RequirePermission>
              )
            },
            { path: 'agenda', element: <WhatsAppAgenda /> },
            { path: 'resources', element: <WhatsAppResources /> },
            { path: 'tickets', element: <WhatsAppTickets /> },
            { path: 'orders', element: <WhatsAppOrders /> },
            {
              path: 'products',
              element: (
                <RequirePermission permission="whatsapp:crm">
                  <WhatsAppProducts />
                </RequirePermission>
              )
            },
            {
              path: 'charges',
              element: (
                <RequirePermission permission="whatsapp:finance">
                  <WhatsAppCharges />
                </RequirePermission>
              )
            },
            {
              path: 'finance',
              element: (
                <RequirePermission permission="whatsapp:finance">
                  <WhatsAppFinance />
                </RequirePermission>
              )
            },
            { path: 'pipeline', element: <WhatsAppPipeline /> },
            { path: 'tasks', element: <WhatsAppTasks /> },
            { path: 'metrics', element: <WhatsAppMetrics /> },
            { path: 'notifications', element: <WhatsAppNotifications /> }
          ]
        },
        {
          path: 'wordpress',
          element: <RequireModule module="wordpress" />, // gate por módulo liberado
          children: [
            { path: 'tradutor', element: <TranslatorPlugin /> },
            { path: 'push-in-play', element: <PushInPlay /> }
          ]
        },
        {
          path: 'telegram',
          element: <RequireModule module="telegram" />, // gate por módulo liberado
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
              children: [
                { path: 'users', element: <AdminUsers /> },
                { path: 'payments', element: <AdminPayments /> }
              ]
            }
          ]
        },

        {
          path: 'posts',
          element: <RequireModule module="webchat" />, // gate por módulo liberado
          children: [
            { path: 'list', element: <PostsList /> },
            { path: 'schedules', element: <PostSchedules /> }
          ]
        },
        {
          path: 'ia-content',
          element: <RequireModule module="webchat" />, // gate por módulo liberado
          children: [{ path: 'avatars', element: <Avatars /> }]
        }
      ]
    }
  ]
};

export default MainRoutes;
