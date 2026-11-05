import { STORAGE_KEYS } from './keys';
import { secureStorage } from './secureStorage';

let cached: string | null | undefined;

/** Jeton Sanctum : stocké dans expo-secure-store, avec un cache mémoire. */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (cached === undefined) {
      cached = await secureStorage.get(STORAGE_KEYS.authToken);
    }
    return cached;
  },
  async set(token: string): Promise<void> {
    cached = token;
    try {
      await secureStorage.set(STORAGE_KEYS.authToken, token);
    } catch {
      // le jeton reste valable en mémoire pour cette session
    }
  },
  async clear(): Promise<void> {
    cached = null;
    await secureStorage.remove(STORAGE_KEYS.authToken);
  },
  /** Réservé aux tests : oublie le cache mémoire. */
  resetCacheForTests(): void {
    cached = undefined;
  },
};
