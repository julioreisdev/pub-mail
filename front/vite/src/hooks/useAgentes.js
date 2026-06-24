import useSWR from 'swr';
import { fetcher } from '../api/api';

const AGENTES_KEY = '/agentes';

export function useAgentes(options = {}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    AGENTES_KEY,
    fetcher,
    {
      revalidateOnFocus: true,
      shouldRetryOnError: false,
      ...options
    }
  );

  return {
    agentes: data ?? null,
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
    mutate
  };
}

export default useAgentes;
