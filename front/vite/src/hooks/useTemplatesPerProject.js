// src/hooks/useTemplatesPerProject.js
import useSWR from 'swr';
import { fetcher } from '../api/api';

/**
 * GET /email/projects/{projectId}/templates
 *
 * Uso:
 * const { templates, isLoading, error, refresh } = useTemplatesPerProject(projectId);
 */
export function useTemplatesPerProject(projectId, options = {}) {
    const isValidId = projectId != null && projectId !== '' && projectId !== 'null' && projectId !== 'undefined';

    const key = isValidId ? `/email/projects/${projectId}/templates` : null;

    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        templates: data ?? null,

        isLoading,
        isValidating,
        error,

        refresh: () => mutate(),
        mutate
    };
}

export default useTemplatesPerProject;
