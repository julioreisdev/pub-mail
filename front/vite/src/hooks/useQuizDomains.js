import useSWR from 'swr';
import { fetcher } from '../api/api';

const QUIZ_DOMAINS_KEY = '/quiz-domains';

export function useQuizDomains(options = {}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    QUIZ_DOMAINS_KEY,
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
