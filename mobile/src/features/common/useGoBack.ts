import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/** Action « retour » unique de l'application : revient en arrière, ou remplace par `fallbackHref` si la pile est vide. */
export function useGoBack(fallbackHref: string): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref as never);
  }, [router, fallbackHref]);
}
