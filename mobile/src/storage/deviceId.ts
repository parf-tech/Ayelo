import { randomUUID } from 'expo-crypto';
import { STORAGE_KEYS } from './keys';
import { secureStorage } from './secureStorage';

let cached: string | undefined;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant d'installation (uuid) : généré une seule fois, puis relu depuis le stockage sécurisé. */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const stored = await secureStorage.get(STORAGE_KEYS.deviceId);
  if (stored && UUID_RE.test(stored)) {
    cached = stored;
    return stored;
  }
  const fresh = randomUUID();
  cached = fresh;
  try {
    await secureStorage.set(STORAGE_KEYS.deviceId, fresh);
  } catch {
    // non persisté : un nouvel identifiant sera généré au prochain lancement
  }
  return fresh;
}

/** Réservé aux tests. */
export function resetDeviceIdCacheForTests(): void {
  cached = undefined;
}
