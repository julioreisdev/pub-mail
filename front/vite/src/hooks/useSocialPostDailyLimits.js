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

export function useSocialPostDailyLimits(query = {}, options = {}) {
    const queryString = buildQueryString(query);
    const key = queryString ? `/posts/schedules/daily-limits?${queryString}` : '/posts/schedules/daily-limits';

    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        dailyLimits: data ?? null,
        isLoading,
        isValidating,
        error,
        refresh: () => mutate(),
        mutate
    };
}

export default useSocialPostDailyLimits;
