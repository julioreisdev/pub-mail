import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// routing
import router from 'routes';

// project imports
import ThemeCustomization from 'themes';
import { reloadOnceForStaleChunk, clearStaleChunkFlag } from 'routes/ErrorBoundary';

// ==============================|| APP ||============================== //

export default function App() {
  // Deploy com aba aberta: o preload de um chunk antigo falha → recarrega
  // uma vez (guard em sessionStorage) em vez de mostrar erro técnico.
  useEffect(() => {
    const onPreloadError = (event) => {
      if (reloadOnceForStaleChunk()) event.preventDefault?.();
    };
    window.addEventListener('vite:preloadError', onPreloadError);
    // boot saudável por 15s → libera o guard pra um próximo deploy também se recuperar
    const t = window.setTimeout(clearStaleChunkFlag, 15000);
    return () => {
      window.removeEventListener('vite:preloadError', onPreloadError);
      window.clearTimeout(t);
    };
  }, []);

  return (
    <ThemeCustomization>
      <RouterProvider router={router} />
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </ThemeCustomization>
  );
}
