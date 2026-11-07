import { useSyncExternalStore } from 'react';

/**
 * Mémoire (non persistante) de la demande de suppression de compte enregistrée pendant cette session.
 * Le serveur révoque les sessions dès la demande : si l'application est déconnectée avant que l'utilisateur ait lu
 * la confirmation, l'accueil la réaffiche (délai de grâce, comment annuler).
 */
let current: { days: number } | null = null;
const listeners = new Set<() => void>();

export function setDeletionNotice(value: { days: number } | null): void {
  current = value;
  listeners.forEach((l) => l());
}

export function useDeletionNotice(): { days: number } | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
    () => current,
  );
}
