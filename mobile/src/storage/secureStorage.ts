import * as SecureStore from 'expo-secure-store';

/**
 * Accès au stockage sécurisé (Keychain iOS / Keystore Android).
 * Le jeton d'authentification ne doit JAMAIS passer par AsyncStorage.
 * Les erreurs de lecture sont absorbées (null) ; les erreurs d'écriture sont remontées à l'appelant.
 */
export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // clé absente ou stockage indisponible : rien à supprimer
    }
  },
};
