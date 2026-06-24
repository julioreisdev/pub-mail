import useSWR from 'swr';
import { fetcher } from '../api/api';

const TRANSACTIONS_KEY = '/wallet/transactions';

export function useTransactions(options = {}) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(TRANSACTIONS_KEY, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        transactions: data ?? null,

        isLoading,
        isValidating,
        error,

        refresh: () => mutate(),
        mutate
    };
}

export default useTransactions;
