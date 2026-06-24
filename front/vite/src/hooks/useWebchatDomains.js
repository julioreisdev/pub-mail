import useSWR from 'swr';
import { fetcher } from '../api/api';

const WEBCHAT_DOMAINS_KEY = '/webchat-domains';

export function useWebchatDomains(options = {}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    WEBCHAT_DOMAINS_KEY,
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
