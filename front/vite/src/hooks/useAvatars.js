import useSWR from 'swr';
import { fetcher } from '../api/api'; // Ajuste o caminho conforme a sua estrutura

const AVATARS_KEY = '/avatars';

export function useAvatars(options = {}) {
    const { data, error, isLoading, isValidating, mutate } = useSWR(AVATARS_KEY, fetcher, {
        revalidateOnFocus: true, // Atualiza a lista se o usuário mudar de aba e voltar
        shouldRetryOnError: false,
        ...options
    });

    return {
        avatars: data ?? null,
        isLoading,
        isValidating,
        error,
        refresh: () => mutate(),
        mutate
    };
}

export default useAvatars;
