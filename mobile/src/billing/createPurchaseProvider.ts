import Constants, { ExecutionEnvironment } from 'expo-constants';
import { readPublicEnv } from '../config/env';
import { Platform } from 'react-native';
import { UnavailablePurchaseProvider, type PurchaseProvider } from './purchaseProvider';

type Env = Record<string, string | undefined>;

/**
 * Choisit l'implémentation d'achat :
 *  - Expo Go : « indisponible » (le SDK natif n'y fonctionne pas) ;
 *  - sans clé SDK publique (EXPO_PUBLIC_REVENUECAT_IOS_KEY / _ANDROID_KEY) : « indisponible » ;
 *  - sinon RevenueCat, chargé seulement ici (build de développement ou production).
 */
export function createPurchaseProvider(
  options: { env?: Env; executionEnvironment?: string; os?: string; load?: () => PurchaseProvider | null } = {},
): PurchaseProvider {
  const env: Env = options.env ?? readPublicEnv();
  const executionEnvironment = options.executionEnvironment ?? Constants.executionEnvironment;
  const os = options.os ?? Platform.OS;

  if (executionEnvironment === ExecutionEnvironment.StoreClient) return new UnavailablePurchaseProvider('expo_go');

  const apiKey = (os === 'ios' ? env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY)?.trim();
  if (!apiKey) return new UnavailablePurchaseProvider('missing_key');

  if (options.load) return options.load() ?? new UnavailablePurchaseProvider('not_installed');
  try {
    // Chargement différé : le module natif n'est évalué que dans un build de développement / production.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RevenueCatPurchaseProvider } = require('./revenueCatProvider') as typeof import('./revenueCatProvider');
    return new RevenueCatPurchaseProvider(apiKey);
  } catch {
    return new UnavailablePurchaseProvider('not_installed');
  }
}
