import useSWR from 'swr'; // ajuste o caminho conforme seu projeto
import { fetcher } from '../api/api';

const WALLET_BALANCE_KEY = '/wallet/balance';

export function useWallet(options = {}) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(WALLET_BALANCE_KEY, fetcher, {
        revalidateOnFocus: true,
        shouldRetryOnError: false,
        ...options
    });

    return {
        wallet: data ?? null, // { id, organization_id, balance, status }
        balance: data?.balance ?? '0.0000',
        status: data?.status ?? null,

        isLoading, // SWR v2
        isValidating,
        error,

        refresh: () => mutate(), // revalida/busca de novo
        mutate // caso queira atualizar manualmente (optimistic update etc.)
    };
}

export default useWallet;
