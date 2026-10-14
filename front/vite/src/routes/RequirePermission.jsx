import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Navigate, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';

import useAccess from 'hooks/useAccess';
import { permissionLabel } from 'views/pages/access/modules';

// Gate de rota por SUB-PERMISSÃO (Fase 7: whatsapp:finance|crm|settings). Sem a permissão cai no
// Chat do WhatsApp com aviso. O back também nega (403 PERMISSION_DENIED) — este gate só evita a tela vazia.
// Uso: rota-pai `{ element: <RequirePermission permission="whatsapp:crm" />, children: [...] }`
// ou como wrapper: `<RequirePermission permission="…"><Pagina /></RequirePermission>`.
export default function RequirePermission({ permission, fallback = '/whatsapp/chat', children }) {
  const { hasPermission } = useAccess();
  const allowed = hasPermission(permission);

  useEffect(() => {
    if (!allowed)
      toast.error(`Seu acesso não inclui "${permissionLabel(permission)}". Fale com o administrador da conta.`, {
        id: `perm-${permission}`
      });
  }, [allowed, permission]);

  if (!allowed) return <Navigate to={fallback} replace />;
  return children || <Outlet />;
}

RequirePermission.propTypes = { permission: PropTypes.string.isRequired, fallback: PropTypes.string, children: PropTypes.node };
