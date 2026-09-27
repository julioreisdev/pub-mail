import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import Error404 from '../views/pages/errors/Error404';
import Error401 from '../views/pages/errors/Error401';
import Error503 from '../views/pages/errors/Error503';
import ErrorGeneric from '../views/pages/errors/ErrorGeneric';

const CHUNK_RELOAD_KEY = 'pm-chunk-reload';
const STALE_CHUNK_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isStaleChunkError(error) {
  const message = error?.message ? String(error.message) : String(error || '');
  return STALE_CHUNK_RE.test(message);
}

/**
 * Após um deploy, chunks antigos somem do servidor e a aba aberta falha ao
 * importar a próxima rota. Recarrega UMA vez (flag em sessionStorage) pra
 * pegar o bundle novo; se já recarregou e continua falhando, deixa o erro
 * aparecer (evita loop infinito).
 * @returns {boolean} true se disparou o reload
 */
export function reloadOnceForStaleChunk() {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function clearStaleChunkFlag() {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

export default function ErrorBoundary() {
  const error = useRouteError();
  const staleChunk = !isRouteErrorResponse(error) && isStaleChunkError(error);

  useEffect(() => {
    if (staleChunk) reloadOnceForStaleChunk();
  }, [staleChunk]);

  // Erros vindos do router (throw new Response, loaders/actions, etc.)
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return <Error404 />;
    if (error.status === 401) return <Error401 />;
    if (error.status === 503) return <Error503 />;

    return (
      <ErrorGeneric code={String(error.status)} title="Ocorreu um erro" description={error.statusText || 'Erro ao carregar esta página.'} />
    );
  }

  if (staleChunk) {
    return (
      <ErrorGeneric
        code="Atualização"
        title="Nova versão disponível"
        description="O sistema foi atualizado. Recarregando a página para carregar a versão mais recente…"
      />
    );
  }

  // Erros genéricos (exceptions)
  const message = error?.message ? String(error.message) : 'Erro inesperado.';
  return <ErrorGeneric code="Erro" title="Ocorreu um erro inesperado" description={message} />;
}
