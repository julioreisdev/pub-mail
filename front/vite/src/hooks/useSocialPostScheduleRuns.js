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

export function useSocialPostScheduleRuns(query = {}, options = {}) {
    const queryString = buildQueryString(query);
    const key = queryString ? `/posts/schedules/history?${queryString}` : '/posts/schedules/history';

    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        runs: data?.items ?? [],
        meta: data?.meta ?? null,
        isLoading,
        isValidating,
        error,
        refresh: () => mutate(),
        mutate
    };
}

export default useSocialPostScheduleRuns;
