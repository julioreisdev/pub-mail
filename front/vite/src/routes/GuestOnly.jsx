import { Navigate } from 'react-router-dom';
import { useAuth } from 'contexts/AuthContext';

export default function GuestOnly({ children }) {
    const { isAuthenticated, isAuthLoading } = useAuth();

    if (isAuthLoading) return null;

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}
