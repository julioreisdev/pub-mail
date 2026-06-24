import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { get, post } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem('token') || '');
    const [user, setUser] = useState(() => {
        const raw = localStorage.getItem('user');
        try {
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    const [isAuthLoading, setIsAuthLoading] = useState(true);

    const isAuthenticated = !!token;

    const persistSession = ({ token: newToken, user: newUser }) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);

        if (newUser) {
            localStorage.setItem('user', JSON.stringify(newUser));
            setUser(newUser);
        } else {
            localStorage.removeItem('user');
            setUser(null);
        }
    };

    const clearSession = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken('');
        setUser(null);
        window.location.reload();
    };

    // Login: chama API, guarda token, e opcionalmente já busca /me
    const login = async ({ email, password }) => {
        const result = await post('/auth/login', { email, password });

        const newToken = result?.token || result?.accessToken;
        if (!newToken) throw new Error('Resposta inválida: token não encontrado.');

        // se a API já devolver user, ótimo; se não, a gente busca via /me
        const maybeUser = result?.user || null;

        persistSession({ token: newToken, user: maybeUser });

        // se não veio user no login, busca agora
        if (!maybeUser) {
            const me = await get('/auth/me');
            persistSession({ token: newToken, user: me });
        }

        return true;
    };

    const logout = () => {
        clearSession();
    };

    // Boot do app: se tem token, valida buscando /me
    useEffect(() => {
        let isMounted = true;

        const bootstrap = async () => {
            try {
                if (!token) {
                    if (isMounted) setIsAuthLoading(false);
                    return;
                }

                const me = await get('/auth/me');

                // mantém token e atualiza user
                if (isMounted) {
                    localStorage.setItem('user', JSON.stringify(me));
                    setUser(me);
                    setIsAuthLoading(false);
                }
            } catch (e) {
                // token inválido/expirado => desloga
                console.log('[Auth] bootstrap falhou:', e);
                if (isMounted) {
                    clearSession();
                    setIsAuthLoading(false);
                }
            }
        };

        bootstrap();

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // roda uma vez no mount

    const value = useMemo(
        () => ({
            token,
            user,
            isAuthenticated,
            isAuthLoading,
            login,
            logout
        }),
        [token, user, isAuthenticated, isAuthLoading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
    return ctx;
}
