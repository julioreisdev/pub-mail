import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Navigate, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';

import useAccess from 'hooks/useAccess';
import { MODULE_DEFS } from 'views/pages/access/modules';

// Gate de rota por MÓDULO: usuário sem o módulo cai no dashboard com aviso.
// (O back também nega — 403 MODULE_DISABLED — este gate só evita a tela vazia.)
export default function RequireModule({ module }) {
  const { has } = useAccess();
  const allowed = has(module);

  useEffect(() => {
    if (!allowed) toast.error(`O módulo ${MODULE_DEFS[module]?.label || module} não está incluído no seu acesso.`, { id: `mod-${module}` });
  }, [allowed, module]);

  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

RequireModule.propTypes = { module: PropTypes.string.isRequired };
