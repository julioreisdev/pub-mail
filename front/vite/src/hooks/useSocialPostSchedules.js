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

export function useSocialPostSchedules(query = {}, options = {}) {
    const queryString = buildQueryString(query);
    const key = queryString ? `/posts/schedules?${queryString}` : '/posts/schedules';

    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        schedules: data?.items ?? [],
        meta: data?.meta ?? null,
        isLoading,
        isValidating,
        error,
        refresh: () => mutate(),
        mutate
    };
}

export default useSocialPostSchedules;
