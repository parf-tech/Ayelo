// ATTENTION : ce fichier importe le SDK natif react-native-purchases. Il exige un BUILD DE DÉVELOPPEMENT
// (expo-dev-client / EAS) : le SDK ne fonctionne pas dans Expo Go. Il n'est chargé que par createPurchaseProvider(),
// jamais par les tests Jest.
import Purchases from 'react-native-purchases';
import type { ProductKind, PurchaseOutcome, PurchaseProvider, RestoreOutcome, StoreProduct } from './purchaseProvider';

type PurchasesLikeError = { userCancelled?: boolean; message?: string; code?: unknown };

export class RevenueCatPurchaseProvider implements PurchaseProvider {
  readonly available = true;
  private configured = false;

  /** `apiKey` : clé SDK PUBLIQUE RevenueCat (par plateforme), jamais la clé secrète. */
  constructor(private readonly apiKey: string) {}

  async configure(appUserId: string): Promise<void> {
    if (!this.configured) {
      Purchases.configure({ apiKey: this.apiKey, appUserID: appUserId });
      this.configured = true;
      return;
    }
    await Purchases.logIn(appUserId);
  }

  async getProducts(productIds: string[], kind: ProductKind): Promise<StoreProduct[]> {
    if (productIds.length === 0) return [];
    const category =
      kind === 'subscription' ? Purchases.PRODUCT_CATEGORY.SUBSCRIPTION : Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION;
    const products = await Purchases.getProducts(productIds, category);
    return products.map((p) => ({ productId: p.identifier, title: p.title, priceString: p.priceString }));
  }

  async purchase(productId: string, kind: ProductKind): Promise<PurchaseOutcome> {
    try {
      const category =
        kind === 'subscription' ? Purchases.PRODUCT_CATEGORY.SUBSCRIPTION : Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION;
      const [product] = await Purchases.getProducts([productId], category);
      if (!product) return { kind: 'error', message: 'product_not_found' };
      await Purchases.purchaseStoreProduct(product);
      return { kind: 'purchased' };
    } catch (error) {
      const e = error as PurchasesLikeError;
      if (e.userCancelled) return { kind: 'cancelled' };
      return { kind: 'error', message: e.message };
    }
  }

  async restore(): Promise<RestoreOutcome> {
    try {
      await Purchases.restorePurchases();
      return { kind: 'restored' };
    } catch (error) {
      return { kind: 'error', message: (error as PurchasesLikeError).message };
    }
  }

  async logOut(): Promise<void> {
    if (!this.configured) return;
    try {
      await Purchases.logOut();
    } catch {
      // déjà anonyme : rien à faire
    }
  }
}
