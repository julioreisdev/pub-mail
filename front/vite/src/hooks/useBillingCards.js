import useSWR from 'swr';
import { fetcher } from '../api/api';

const KEY = '/billing/cards';

export default function useBillingCards(options = {}) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(KEY, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    const cards = Array.isArray(data) ? data : [];

    // Ordena default primeiro
    const ordered = [...cards].sort((a, b) => Number(!!b.is_default) - Number(!!a.is_default));

    return {
        cards: ordered,
        isLoading,
        isValidating,
        error,
        mutate
    };
}
