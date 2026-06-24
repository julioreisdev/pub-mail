import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import Error404 from '../views/pages/errors/Error404';
import Error401 from '../views/pages/errors/Error401';
import Error503 from '../views/pages/errors/Error503';
import ErrorGeneric from '../views/pages/errors/ErrorGeneric';

export default function ErrorBoundary() {
  const error = useRouteError();

  // Erros vindos do router (throw new Response, loaders/actions, etc.)
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return <Error404 />;
    if (error.status === 401) return <Error401 />;
    if (error.status === 503) return <Error503 />;

    return (
      <ErrorGeneric code={String(error.status)} title="Ocorreu um erro" description={error.statusText || 'Erro ao carregar esta página.'} />
    );
  }

  // Erros genéricos (exceptions)
  const message = error?.message ? String(error.message) : 'Erro inesperado.';
  return <ErrorGeneric code="Erro" title="Ocorreu um erro inesperado" description={message} />;
}
