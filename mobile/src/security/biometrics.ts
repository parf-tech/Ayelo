import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Enveloppe d'`expo-local-authentication` : jamais d'exception (web, simulateur, module absent), résultats en quatre cas.
 * Le repli sur le code ou le schéma de l'appareil est toujours permis : sans lui, une biométrie qui échoue bloquerait la personne.
 */

export type AuthResult = 'success' | 'cancelled' | 'failed' | 'unavailable';

/** Vrai si l'appareil a au moins un verrouillage enregistré (biométrie, code ou schéma). Sinon l'option n'est pas proposée. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

const CANCELLED = new Set(['user_cancel', 'system_cancel', 'app_cancel', 'user_fallback']);
const UNAVAILABLE = new Set(['not_enrolled', 'not_available', 'passcode_not_set']);

export async function authenticate({ prompt, cancel }: { prompt: string; cancel: string }): Promise<AuthResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: cancel,
      disableDeviceFallback: false,
    });
    if (result.success) return 'success';
    if (CANCELLED.has(result.error)) return 'cancelled';
    if (UNAVAILABLE.has(result.error)) return 'unavailable';
    return 'failed';
  } catch {
    return 'unavailable';
  }
}
