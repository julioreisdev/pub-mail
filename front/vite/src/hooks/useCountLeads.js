// src/hooks/useTemplatesPerProject.js
import useSWR from 'swr';
import { fetcher } from '../api/api';

export function useCountLeads(projectId, options = {}) {
    const isValidId = projectId != null && projectId !== '' && projectId !== 'null' && projectId !== 'undefined';

    const key = isValidId ? `/email/leads/leads-count/${projectId}` : null;

    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        leads: data ?? null,

        isLoading,
        isValidating,
        error,

        refresh: () => mutate(),
        mutate
    };
}

export default useCountLeads;
