import useSWR from 'swr';
import { fetcher } from '../api/api';

const EMAIL_PROJECTS_KEY = '/domains';

export function useDomains(options = {}) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(EMAIL_PROJECTS_KEY, fetcher, {
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
