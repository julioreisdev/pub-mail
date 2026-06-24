import useSWR from 'swr';
import { fetcher } from '../api/api';

const META_KEY = '/posts/schedules/meta';

export function useSocialPostSchedulesMeta(options = {}) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(META_KEY, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        meta: data ?? null,
        isLoading,
        isValidating,
        error,
        refresh: () => mutate(),
        mutate
    };
}

export default useSocialPostSchedulesMeta;
