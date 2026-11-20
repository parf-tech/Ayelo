import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';

/** Intervalle entre deux battements : bien sous la durée de vie de la présence côté serveur (120 s), au-dessus de la limite de débit (10 par minute). */
export const PRESENCE_HEARTBEAT_MS = 60_000;

/**
 * Présence en ligne (FR-D-4) : tant que l'application est au premier plan, envoie POST /me/presence à l'ouverture puis toutes les
 * minutes, pour rester « en ligne » même sans autre appel (lecture d'une conversation). Aucun battement en arrière-plan : la
 * présence expire d'elle-même. Un échec (réseau, serveur) est ignoré, le battement suivant réessaie.
 */
export function PresenceHeartbeat({ intervalMs = PRESENCE_HEARTBEAT_MS }: { intervalMs?: number }) {
  const { api } = useAuth();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const beat = () => {
      void api.profile.heartbeat().catch(() => undefined);
    };
    const start = () => {
      if (timer !== null) return;
      beat();
      timer = setInterval(beat, intervalMs);
    };
    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));
    return () => {
      subscription.remove();
      stop();
    };
  }, [api, intervalMs]);

  return null;
}
