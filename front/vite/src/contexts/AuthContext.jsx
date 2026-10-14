import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, storeTokens, clearStoredSession } from '../api/api';
import { disconnectSocket } from '../realtime/socket';

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

  // Contrato do back (auth.service.ts):
  //   POST /auth/login → { tokens: { accessToken, refreshToken, accessExpiresIn, refreshExpiresIn }, user }
  //   GET  /auth/me    → { user, organization }
  // 'token' = access; 'refreshToken' usado pelo interceptor do api.js no 401.
  const persistSession = ({ tokens, user: newUser }) => {
    storeTokens(tokens);
    setToken(tokens?.accessToken || '');

    if (newUser) {
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
    } else {
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const clearSession = () => {
    clearStoredSession();
    setToken('');
    setUser(null);
  };

  // Login: chama API, guarda tokens e (se preciso) busca /me
  const login = async ({ email, password }) => {
    const result = await post('/auth/login', { email, password });

    const tokens = result?.tokens;
    if (!tokens?.accessToken) throw new Error('Resposta inválida: token não encontrado.');

    // /auth/me devolve { user, organization, access }; o login devolve só `user`.
    // Guarda os tokens no storage (o interceptor precisa deles) e só publica a
    // sessão no contexto DEPOIS do /me — senão o app monta com `access` vazio
    // (menu/rotas/leads errados por um instante e 403 espúrios).
    storeTokens(tokens);
    let me = null;
    try {
      me = await get('/auth/me');
    } catch (e) {
      console.warn('[Auth] /auth/me após login falhou (mantendo user do login):', e?.message || e);
    }
    persistSession({ tokens, user: me || (result?.user ? { user: result.user } : null) });

    return true;
  };

  // Recarrega /auth/me (user + organization + access). Usado pelo AccessGate
  // após pagar / boas-vindas / 402 vindo da API. Best-effort.
  const refreshAccess = async () => {
    try {
      const me = await get('/auth/me');
      localStorage.setItem('user', JSON.stringify(me));
      setUser(me);
      return me;
    } catch (e) {
      console.warn('[Auth] refreshAccess falhou:', e?.message || e);
      return null;
    }
  };

  const logout = () => {
    // revoga o refresh no back (best-effort) e limpa local
    post('/auth/logout').catch(() => {});
    disconnectSocket();
    clearSession();
  };

  // Boot do app: se tem token, valida buscando /me
  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        // página pública de pagamento (/pay/:token): não precisa de sessão — não chama /auth/me
        // (um token vencido ali dispararia refresh/redirect para o login do visitante)
        const publicPay = /^\/pay\//.test(window.location.pathname || '');
        if (!token || publicPay) {
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
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          // sessão inválida (o interceptor já tentou refresh) => desloga
          console.log('[Auth] sessão inválida no bootstrap:', status);
          if (isMounted) clearSession();
        } else {
          // 5xx / rede: mantém o user em cache e segue (não desloga por instabilidade)
          console.warn('[Auth] bootstrap /auth/me falhou (mantendo sessão em cache):', e?.message || e);
        }
        if (isMounted) setIsAuthLoading(false);
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
      logout,
      refreshAccess
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
