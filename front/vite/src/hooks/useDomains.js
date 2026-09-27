import useSWR from 'swr';
import { fetcher } from '../api/api';
import useAccess from './useAccess';

const EMAIL_PROJECTS_KEY = '/domains';

export function useDomains(options = {}) {
  const { has } = useAccess(); // sem o módulo, chave null → não busca (evita 403 MODULE_DISABLED)
    const { data, error, isLoading, isValidating, mutate } = useSWR(has('email') ? EMAIL_PROJECTS_KEY : null, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        domains: data ?? null,

        isLoading,
        isValidating,
        error,

        refresh: () => mutate(),
        mutate
    };
}

export default useDomains;
