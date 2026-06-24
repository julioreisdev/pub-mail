import useSWR from 'swr';
import { fetcher } from '../api/api';

/**
 * GET /email/projects/{projectId}/schedules
 *
 * Uso:
 * const { sents, isLoading, error, refresh } = useSchedulesSents(projectId);
 */
export function useSchedulesSents(projectId, options = {}) {
    const key = projectId ? `/email/projects/${projectId}/schedules-sent` : null;

    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        sents: data ?? null,

        isLoading,
        isValidating,
        error,

        refresh: () => mutate(),
        mutate
    };
}

export default useSchedulesSents;
