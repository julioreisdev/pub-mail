import useSWR from 'swr';
import { fetcher } from '../api/api';

const WEBCHATS_KEY = '/webchats';

export function useWebchats(options = {}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    WEBCHATS_KEY,
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
