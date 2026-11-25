import { useCallback, useMemo } from 'react';
import { useAuth } from '../../auth/AuthProvider';

/** Marge avant l'expiration : une adresse qui expire dans moins d'une minute est redemandée. */
const EXPIRY_MARGIN_MS = 60_000;

type Entry = { url: string; expiresAt: number };

export type LoadMessageImage = (messageId: string, force?: boolean) => Promise<string>;

/**
 * Adresses de lecture des images d'une conversation : une demande par image (`GET .../messages/{id}/media`), gardée en mémoire
 * jusqu'à son expiration (jamais sur disque : l'adresse est un secret de courte durée). Deux affichages simultanés de la même
 * image partagent une seule demande ; `force` en demande une nouvelle (image qui ne se charge plus, adresse expirée).
 * Le cache est propre à la conversation et au compte : il disparaît avec eux.
 */
export function useMessageImages(conversationId: string): LoadMessageImage {
  const { api } = useAuth();
  // Un cache par compte (api) et par conversation : changer l'un ou l'autre repart d'un cache vide.
  const store = useMemo(() => ({ api, conversationId, cache: new Map<string, Entry>(), inflight: new Map<string, Promise<string>>() }), [api, conversationId]);

  return useCallback(
    (messageId, force = false) => {
      const hit = store.cache.get(messageId);
      if (!force && hit && hit.expiresAt - Date.now() > EXPIRY_MARGIN_MS) return Promise.resolve(hit.url);
      const pending = store.inflight.get(messageId);
      if (pending && !force) return pending;

      const request = store.api.messaging
        .messageMedia(store.conversationId, messageId)
        .then((media) => {
          const expiresAt = Date.parse(media.expires_at);
          store.cache.set(messageId, { url: media.url, expiresAt: Number.isNaN(expiresAt) ? 0 : expiresAt });
          return media.url;
        })
        .finally(() => {
          if (store.inflight.get(messageId) === request) store.inflight.delete(messageId);
        });
      store.inflight.set(messageId, request);
      return request;
    },
    [store],
  );
}
