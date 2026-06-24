import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { useAuth } from 'contexts/AuthContext';

export default function RequireAuth() {
    const { isAuthenticated, isAuthLoading } = useAuth();
    const location = useLocation();

    // enquanto valida token + /me
    if (isAuthLoading) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    // se não estiver logado, manda pro login
    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // ok: libera rotas internas
    return <Outlet />;
}
