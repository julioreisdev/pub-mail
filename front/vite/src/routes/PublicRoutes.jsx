import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

import Loadable from 'ui-component/Loadable';
import MinimalLayout from 'layout/MinimalLayout';

import GuestOnly from './GuestOnly';
import ErrorBoundary from './ErrorBoundary';

// pages
const LoginPage = Loadable(lazy(() => import('views/pages/authentication/Login')));
const RegisterPage = Loadable(lazy(() => import('views/pages/authentication/Register')));
const PublicWebchat = Loadable(lazy(() => import('views/pages/webchat/PublicWebchat')));
const SplitRedirect = Loadable(lazy(() => import('views/pages/webchat/SplitRedirect')));
const QuizSplitRedirect = Loadable(lazy(() => import('views/pages/quiz/QuizSplitRedirect')));
const PublicQuiz = Loadable(lazy(() => import('views/pages/quiz/PublicQuiz')));
const PrivacyPolicy = Loadable(lazy(() => import('views/pages/legal/PrivacyPolicy')));
const TermsOfUse = Loadable(lazy(() => import('views/pages/legal/TermsOfUse')));

const PublicRoutes = {
    path: '/',
    element: <MinimalLayout />,
    errorElement: <ErrorBoundary />,
    children: [
        // /  -> Login (sem Home)
        { index: true, element: <Navigate to="/login" replace /> },

        // /home legado -> redireciona para login
        { path: 'home', element: <Navigate to="/login" replace /> },

        // /login -> Login (somente guest)
        {
            path: 'login',
            element: (
                <GuestOnly>
                    <LoginPage />
                </GuestOnly>
            )
        },

        // /register -> Register (somente guest)
        {
            path: 'register',
            element: (
                <GuestOnly>
                    <RegisterPage />
                </GuestOnly>
            )
        },

        // /webchat/splits/:slug -> sorteia e redireciona para um webchat do split
        { path: 'webchat/splits/:slug', element: <SplitRedirect /> },

        // /quiz/splits/:slug -> sorteia e redireciona para um quiz do split
        { path: 'quiz/splits/:slug', element: <QuizSplitRedirect /> },

        // /quiz/:slug -> página pública do quiz
        { path: 'quiz/:slug', element: <PublicQuiz /> },

        // /webchat/:slug -> pagina publica do webchat
        { path: 'webchat/:slug', element: <PublicWebchat /> },

        // /legal/... -> páginas jurídicas públicas
        { path: 'legal/politica-de-privacidade', element: <PrivacyPolicy /> },
        { path: 'legal/politica-de-privacidade/*', element: <PrivacyPolicy /> },
        { path: 'legal/termos-de-uso', element: <TermsOfUse /> },
        { path: 'legal/termos-de-uso/*', element: <TermsOfUse /> }
    ]
};

export default PublicRoutes;
