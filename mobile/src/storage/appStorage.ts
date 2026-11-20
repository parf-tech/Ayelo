import { STORAGE_KEYS } from './keys';
import { secureStorage } from './secureStorage';

/** Préférences non sensibles (langue, reprise de l'onboarding). */
export const appStorage = {
  getLocale: () => secureStorage.get(STORAGE_KEYS.locale),
  async setLocale(locale: string): Promise<void> {
    try {
      await secureStorage.set(STORAGE_KEYS.locale, locale);
    } catch {
      // préférence non mémorisée : sans conséquence
    }
  },
  async getOnboardingPending(): Promise<boolean> {
    return (await secureStorage.get(STORAGE_KEYS.onboardingPending)) === '1';
  },
  /** Verrouillage de l'application par biométrie : préférence de cet appareil, effacée à la déconnexion. */
  async getBiometricLock(): Promise<boolean> {
    return (await secureStorage.get(STORAGE_KEYS.biometricLock)) === '1';
  },
  /** Activer remonte l'échec d'écriture (le verrou ne doit pas sembler actif s'il n'est pas mémorisé) ; désactiver l'absorbe. */
  async setBiometricLock(on: boolean): Promise<void> {
    if (on) await secureStorage.set(STORAGE_KEYS.biometricLock, '1');
    else await secureStorage.remove(STORAGE_KEYS.biometricLock);
  },
  async setOnboardingPending(pending: boolean): Promise<void> {
    try {
      if (pending) await secureStorage.set(STORAGE_KEYS.onboardingPending, '1');
      else await secureStorage.remove(STORAGE_KEYS.onboardingPending);
    } catch {
      // reprise d'onboarding non mémorisée : sans conséquence grave
    }
  },
};
