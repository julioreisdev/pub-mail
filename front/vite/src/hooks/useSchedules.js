import useSWR from 'swr';
import { fetcher } from '../api/api';

/**
 * GET /email/projects/{projectId}/schedules
 *
 * Uso:
 * const { schedules, isLoading, error, refresh } = useSchedules(projectId);
 */
export function useSchedules(projectId, options = {}) {
    const key = projectId ? `/email/projects/${projectId}/schedules` : null;

    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        schedules: data ?? null,

        isLoading,
        isValidating,
        error,

        refresh: () => mutate(),
        mutate
    };
}

export default useSchedules;
