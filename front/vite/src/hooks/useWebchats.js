import useSWR from 'swr';
import { fetcher } from '../api/api';
import useAccess from './useAccess';

const WEBCHATS_KEY = '/webchats';

export function useWebchats(options = {}) {
  // Sem o módulo liberado a chave é null → SWR não busca (o back daria 403 MODULE_DISABLED).
  const { has } = useAccess();
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    has('webchat') ? WEBCHATS_KEY : null,
    fetcher,
    {
      revalidateOnFocus: true,
      shouldRetryOnError: false,
      ...options
    }
  );

  return {
    webchats: data ?? null,
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
    mutate
  };
}

export default useWebchats;
