import { useSyncExternalStore } from 'react';

/**
 * Mémoire (non persistante) de l'expiration de session : le serveur a refusé le jeton (révoqué, expiré, « déconnexion partout »
 * depuis un autre appareil). L'application revient à l'accueil ; sans ce message l'utilisateur ne comprenait pas pourquoi
 * (BUG-001). Une déconnexion voulue ne le positionne pas ; une nouvelle connexion l'efface.
 */
let expired = false;
const listeners = new Set<() => void>();

export function setSessionNotice(value: boolean): void {
  if (expired === value) return;
  expired = value;
  listeners.forEach((l) => l());
}

export function useSessionNotice(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => expired,
    () => expired,
  );
}
