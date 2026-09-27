import useSWR from 'swr';
import { fetcher } from '../api/api';
import useAccess from './useAccess';

const QUIZZES_KEY = '/quizzes';

export function useQuizzes(options = {}) {
  // Sem o módulo liberado a chave é null → SWR não busca (o back daria 403 MODULE_DISABLED).
  const { has } = useAccess();
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    has('quiz') ? QUIZZES_KEY : null,
    fetcher,
    {
      revalidateOnFocus: true,
      shouldRetryOnError: false,
      ...options
    }
  );

  return {
    quizzes: data ?? null,
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
    mutate
  };
}

export default useQuizzes;
