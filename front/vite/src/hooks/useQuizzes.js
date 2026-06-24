import useSWR from 'swr';
import { fetcher } from '../api/api';

const QUIZZES_KEY = '/quizzes';

export function useQuizzes(options = {}) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    QUIZZES_KEY,
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
