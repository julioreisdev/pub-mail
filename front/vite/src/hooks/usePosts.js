import useSWR from 'swr';
import { fetcher } from '../api/api';

const POSTS_KEY = '/posts';

export function usePosts(options = {}) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(POSTS_KEY, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        posts: data?.data ?? [],

        isLoading,
        isValidating,
        error,

        refresh: () => mutate(),
        mutate
    };
}

export default usePosts;
