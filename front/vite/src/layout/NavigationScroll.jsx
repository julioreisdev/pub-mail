import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// ==============================|| NAVIGATION SCROLL TO TOP ||============================== //
// Precisa estar DENTRO do RouterProvider (usa useLocation) — montado nos layouts.

export default function NavigationScroll({ children }) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return children || null;
}

NavigationScroll.propTypes = { children: PropTypes.oneOfType([PropTypes.node, PropTypes.any]) };
