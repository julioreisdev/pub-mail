import useSWR from 'swr';
import { fetcher } from '../api/api';
import useAccess from './useAccess';

const EMAIL_PROJECTS_KEY = '/email/projects';

export function useEmailProjects(options = {}) {
  // Sem o módulo liberado a chave é null → SWR não busca (o back daria 403 MODULE_DISABLED).
  const { has } = useAccess();
    const { data, error, isLoading, isValidating, mutate } = useSWR(has('email') ? EMAIL_PROJECTS_KEY : null, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        emailProjects: data ?? null,

        isLoading,
        isValidating,
        error,

        refresh: () => mutate(),
        mutate
    };
}

export default useEmailProjects;
