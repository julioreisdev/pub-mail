import { useCallback, useMemo } from 'react';
import { useAuth } from 'contexts/AuthContext';
import { ALL_MODULES } from 'views/pages/access/modules';

// Estado de acesso do usuário logado (vem de GET /auth/me → `access`):
//  - modules: módulos liberados p/ ESTE usuário (SUPER_ADMIN = todos)
//  - needsPayment: a conta (org) precisa pagar → tela de pagamento trava tudo
//  - welcomePending: 1º acesso de conta gratuita → modal de boas-vindas
//  - expiringSoon / daysLeft: aviso de renovação (≤ 3 dias)
// Sem `access` (cache antigo antes do /me responder) tratamos como liberado —
// o back é quem trava de verdade (402/403); o front só desenha.
export default function useAccess() {
  const { user, refreshAccess } = useAuth();
  const access = user?.access || null;
  const role = user?.user?.role;
  const isSuper = role === 'SUPER_ADMIN' || access?.is_super === true;

  const modules = useMemo(() => {
    if (isSuper) return ALL_MODULES;
    if (!access) return ALL_MODULES;
    return Array.isArray(access.modules) ? access.modules : [];
  }, [access, isSuper]);

  const has = useCallback((m) => isSuper || modules.includes(m), [isSuper, modules]);
  const hasAny = useCallback((list) => isSuper || list.some((m) => modules.includes(m)), [isSuper, modules]);

  return {
    access,
    modules,
    has,
    hasAny,
    isSuper,
    needsPayment: !isSuper && access?.needs_payment === true,
    welcomePending: !isSuper && access?.welcome_pending === true,
    expiringSoon: !isSuper && access?.expiring_soon === true,
    daysLeft: access?.days_left ?? null,
    refreshAccess
  };
}
