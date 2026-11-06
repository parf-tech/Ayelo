/** Prix et titres affichés viennent du store (via RevenueCat) : l'API du backend ne renvoie ni prix ni devise. */
export type StoreProduct = { productId: string; title: string; priceString: string };

export type ProductKind = 'subscription' | 'consumable';

/** `purchased` signifie seulement « le store a validé » : l'état Premium/crédits ne change qu'après confirmation du serveur (webhook). */
export type PurchaseOutcome =
  | { kind: 'purchased' }
  | { kind: 'cancelled' }
  | { kind: 'pending' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message?: string };

export type RestoreOutcome = { kind: 'restored' } | { kind: 'unavailable' } | { kind: 'error'; message?: string };

export type UnavailableReason = 'expo_go' | 'missing_key' | 'not_installed';

/**
 * Passerelle vers les achats intégrés (RevenueCat). Isolée derrière une interface pour que l'application et les tests
 * n'importent jamais le SDK natif. L'`app_user_id` RevenueCat est l'identifiant utilisateur du backend (user.id).
 */
export interface PurchaseProvider {
  readonly available: boolean;
  readonly unavailableReason?: UnavailableReason;
  configure(appUserId: string): Promise<void>;
  getProducts(productIds: string[], kind: ProductKind): Promise<StoreProduct[]>;
  purchase(productId: string, kind: ProductKind): Promise<PurchaseOutcome>;
  restore(): Promise<RestoreOutcome>;
  logOut(): Promise<void>;
}

/** Implémentation « indisponible » (Expo Go, clé absente) : aucun achat n'est jamais simulé. */
export class UnavailablePurchaseProvider implements PurchaseProvider {
  readonly available = false;
  constructor(readonly unavailableReason: UnavailableReason = 'expo_go') {}
  async configure(): Promise<void> {}
  async getProducts(): Promise<StoreProduct[]> {
    return [];
  }
  async purchase(): Promise<PurchaseOutcome> {
    return { kind: 'unavailable' };
  }
  async restore(): Promise<RestoreOutcome> {
    return { kind: 'unavailable' };
  }
  async logOut(): Promise<void> {}
}
