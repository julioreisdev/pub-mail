import useSWR from 'swr';
import { fetcher } from '../api/api';
import useAccess from './useAccess';

const WEBCHAT_DOMAINS_KEY = '/webchat-domains';

export function useWebchatDomains(options = {}) {
  const { has } = useAccess(); // sem o módulo, chave null → não busca (evita 403 MODULE_DISABLED)
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    has('webchat') ? WEBCHAT_DOMAINS_KEY : null,
    fetcher,
    {
      revalidateOnFocus: true,
      shouldRetryOnError: false,
      ...options
    }
  );

  return {
    webchatDomains: data ?? null,
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
    mutate
  };
}

export default useWebchatDomains;
