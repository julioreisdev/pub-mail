import useSWR from 'swr';
import { fetcher } from '../api/api';

/**
 * GET /email/projects/{projectId}/schedules
 *
 * Uso:
 * const { sents, isLoading, error, refresh } = useSchedulesSents(projectId);
 */
export function useSchedulesSents(projectId, options = {}) {
    const { recycle, ...swrOptions } = options;
    const suffix = recycle === true ? '?recycle=true' : recycle === false ? '?recycle=false' : '';
    const key = projectId ? `/email/projects/${projectId}/schedules-sent${suffix}` : null;

    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...swrOptions
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
