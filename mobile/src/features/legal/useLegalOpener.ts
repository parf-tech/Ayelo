import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { getLegalLinks, openExternal } from './links';

export type LegalDoc = 'terms' | 'privacy' | 'community';

/**
 * Ouvre un texte légal : la page web si l'adresse est configurée (EXPO_PUBLIC_*_URL), sinon l'écran de repli de
 * l'application (`/legal/{doc}`), qui explique la situation. Un lien légal n'est donc jamais mort ni désactivé.
 * Retourne `false` si l'ouverture externe a échoué.
 */
export function useLegalOpener(): (doc: LegalDoc) => Promise<boolean> {
  const router = useRouter();
  return useCallback(
    async (doc: LegalDoc) => {
      const url = getLegalLinks()[doc];
      if (url) return openExternal(url);
      router.push(`/legal/${doc}` as never);
      return true;
    },
    [router],
  );
}
