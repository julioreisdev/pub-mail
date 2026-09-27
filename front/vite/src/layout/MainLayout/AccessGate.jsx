import { useEffect } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';

import useAccess from 'hooks/useAccess';
import { useAuth } from 'contexts/AuthContext';
import PaymentLockScreen from 'views/pages/access/PaymentLockScreen';
import WelcomeModal from 'views/pages/access/WelcomeModal';
import RenewalReminder from 'views/pages/access/RenewalReminder';

// Portão de acesso do painel (dentro do MainLayout, em volta do <Outlet/>):
//  - conta precisa pagar → renderiza a tela de pagamento NO LUGAR da página
//    (trocar a URL cai aqui de novo; o back responde 402 em tudo de qualquer jeito);
//  - 1º acesso de conta gratuita → modal de boas-vindas;
//  - vence em ≤ 3 dias → faixa + lembrete 2×/dia.
// Reage aos eventos do api.js (402 → recarrega /me; 403 de módulo → dashboard).
export default function AccessGate({ children }) {
  const { user } = useAuth();
  const { access, needsPayment, welcomePending, refreshAccess } = useAccess();

  useEffect(() => {
    const onPay = () => refreshAccess?.();
    // Só avisa: a rota já é protegida pelo RequireModule; redirecionar aqui
    // expulsava o usuário de páginas permitidas por causa de requisições
    // secundárias (tags, domínios, gateway…).
    const onMod = (e) => {
      toast.error(e?.detail?.message || 'Módulo não incluído no seu acesso.', { id: 'module-disabled' });
    };
    window.addEventListener('pm:payment-required', onPay);
    window.addEventListener('pm:module-disabled', onMod);
    return () => {
      window.removeEventListener('pm:payment-required', onPay);
      window.removeEventListener('pm:module-disabled', onMod);
    };
  }, [refreshAccess]);

  if (needsPayment) {
    return <PaymentLockScreen access={access} onPaid={() => refreshAccess?.()} />;
  }

  return (
    <>
      <RenewalReminder access={access} userId={user?.user?.id} onPaid={() => refreshAccess?.()} />
      {children}
      <WelcomeModal open={welcomePending} name={user?.user?.name} modules={access?.modules || []} onDone={() => refreshAccess?.()} />
    </>
  );
}

AccessGate.propTypes = { children: PropTypes.node };
