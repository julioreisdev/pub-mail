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
    const { recycle, ...swrOptions } = options;
    const isValidId = projectId != null && projectId !== '' && projectId !== 'null' && projectId !== 'undefined';

    const suffix = recycle === true ? '?recycle=true' : recycle === false ? '?recycle=false' : '';
    const key = isValidId ? `/email/projects/${projectId}/templates${suffix}` : null;

    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...swrOptions
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
