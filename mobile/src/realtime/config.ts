import { readPublicEnv } from '../config/env';
import type { RealtimeConfig } from './types';

/**
 * Configuration de Laravel Reverb (protocole Pusher). La clé d'application Reverb est PUBLIQUE par conception
 * (jamais le secret) ; les variables EXPO_PUBLIC_* sont incluses dans l'application.
 * Sans EXPO_PUBLIC_REVERB_KEY et EXPO_PUBLIC_REVERB_HOST, le temps réel est « indisponible » et l'application
 * retombe sur le rafraîchissement périodique.
 */
export function getRealtimeConfig(env: Record<string, string | undefined> = readPublicEnv()): RealtimeConfig | null {
  const key = env.EXPO_PUBLIC_REVERB_KEY?.trim();
  const host = env.EXPO_PUBLIC_REVERB_HOST?.trim();
  if (!key || !host) return null;
  const secure = (env.EXPO_PUBLIC_REVERB_SCHEME?.trim() || 'https') === 'https';
  const rawPort = Number(env.EXPO_PUBLIC_REVERB_PORT);
  const port = Number.isInteger(rawPort) && rawPort > 0 ? rawPort : secure ? 443 : 80;
  return { key, host, port, secure };
}
