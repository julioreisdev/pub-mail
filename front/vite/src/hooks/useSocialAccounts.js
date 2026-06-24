import useSWR from 'swr';
import { fetcher } from '../api/api';

function buildQueryString(query = {}) {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
    });

    return params.toString();
}

export function useSocialAccounts(query = {}, options = {}) {
    const queryString = buildQueryString(query);
    const key = queryString ? `/social-accounts?${queryString}` : '/social-accounts';

    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        socialAccounts: data?.items ?? [],
        meta: data?.meta ?? null,
        isLoading,
        isValidating,
        error,
        refresh: () => mutate(),
        mutate
    };
}

export default useSocialAccounts;
