import useSWR from 'swr';
import { fetcher } from '../api/api';
import useAccess from './useAccess';

const QUIZ_DOMAINS_KEY = '/quiz-domains';

export function useQuizDomains(options = {}) {
  const { has } = useAccess(); // sem o módulo, chave null → não busca (evita 403 MODULE_DISABLED)
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    has('quiz') ? QUIZ_DOMAINS_KEY : null,
    fetcher,
    {
      revalidateOnFocus: true,
      shouldRetryOnError: false,
      ...options
    }
  );

  return {
    quizDomains: data ?? null,
    isLoading,
    isValidating,
    error,
    refresh: () => mutate(),
    mutate
  };
}

export default useQuizDomains;
