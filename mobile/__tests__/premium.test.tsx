import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { ExecutionEnvironment } from 'expo-constants';
import React from 'react';
import { Linking } from 'react-native';
import { createPurchaseProvider } from '../src/billing/createPurchaseProvider';
import {
  type ProductKind,
  type PurchaseOutcome,
  type PurchaseProvider,
  type RestoreOutcome,
  type StoreProduct,
  UnavailablePurchaseProvider,
} from '../src/billing/purchaseProvider';
import { APP_STORE_SUBSCRIPTIONS_URL, PLAY_STORE_SUBSCRIPTIONS_URL, subscriptionsUrl } from '../src/features/premium/ManageSubscription';
import { CreditsScreen } from '../src/features/premium/CreditsScreen';
import { PremiumScreen } from '../src/features/premium/PremiumScreen';
import { bestValueProductId } from '../src/features/premium/pricing';
import { isPurchaseConfirmed, MAX_ATTEMPTS, POLL_INTERVAL_MS, PurchaseResultScreen } from '../src/features/premium/PurchaseResultScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { resetRouterMocks, router } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

// Le SDK natif RevenueCat ne doit JAMAIS être chargé par les tests : s'il l'est, ce module lève une erreur.
jest.mock('react-native-purchases', () => {
  throw new Error('react-native-purchases chargé par les tests');
});

const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => mockParams.current,
}));

const ME = meFixture();
const user = () => userEvent.setup();

const OFFERS = {
  subscriptions: [
    { product_id: 'premium_12m', months: 12 },
    { product_id: 'premium_1m', months: 1 },
    { product_id: 'premium_3m', months: 3 },
  ],
  packs: [
    { product_id: 'conversation_5', type: 'conversation', credits: 5 },
    { product_id: 'conversation_1', type: 'conversation', credits: 1 },
  ],
};
const STATUS_FREE = { premium: false, subscription: null, credits: { conversation: 1 } };

class FakeStore implements PurchaseProvider {
  readonly available = true;
  configured: string[] = [];
  loggedOut = 0;
  purchases: [string, ProductKind][] = [];
  nextOutcome: PurchaseOutcome = { kind: 'purchased' };
  restoreOutcome: RestoreOutcome = { kind: 'restored' };
  async configure(appUserId: string) {
    this.configured.push(appUserId);
  }
  async getProducts(ids: string[]): Promise<StoreProduct[]> {
    return ids.map((id) => ({ productId: id, title: id, priceString: `${id.replace(/[^0-9]/g, '')},99 €` }));
  }
  async purchase(productId: string, kind: ProductKind) {
    this.purchases.push([productId, kind]);
    return this.nextOutcome;
  }
  async restore() {
    return this.restoreOutcome;
  }
  async logOut() {
    this.loggedOut += 1;
  }
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  mockParams.current = {};
});

afterEach(async () => {
  await act(async () => undefined);
});

describe('PurchaseProvider : choix de l\'implémentation', () => {
  it('Expo Go : indisponible, aucun achat possible', async () => {
    const provider = createPurchaseProvider({
      executionEnvironment: ExecutionEnvironment.StoreClient,
      env: { EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_xxx', EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_xxx' },
    });
    expect(provider.available).toBe(false);
    expect(provider.unavailableReason).toBe('expo_go');
    expect(await provider.purchase('premium_1m', 'subscription')).toEqual({ kind: 'unavailable' });
    expect(await provider.restore()).toEqual({ kind: 'unavailable' });
    expect(await provider.getProducts(['premium_1m'], 'subscription')).toEqual([]);
  });

  it('build natif sans clé SDK publique : indisponible (clé absente)', () => {
    const provider = createPurchaseProvider({ executionEnvironment: ExecutionEnvironment.Standalone, env: {}, os: 'android' });
    expect(provider.available).toBe(false);
    expect(provider.unavailableReason).toBe('missing_key');
  });

  it('build natif avec clé : charge l\'implémentation RevenueCat (injectée ici, jamais le SDK réel)', () => {
    const store = new FakeStore();
    const provider = createPurchaseProvider({
      executionEnvironment: ExecutionEnvironment.Standalone,
      env: { EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_xxx' },
      os: 'android',
      load: () => store,
    });
    expect(provider).toBe(store);
  });

  it('module d\'achat introuvable : repli sur « indisponible » sans planter', () => {
    const provider = createPurchaseProvider({
      executionEnvironment: ExecutionEnvironment.Standalone,
      env: { EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_xxx' },
      os: 'ios',
      load: () => null,
    });
    expect(provider).toBeInstanceOf(UnavailablePurchaseProvider);
    expect(provider.unavailableReason).toBe('not_installed');
  });
});

describe('isPurchaseConfirmed', () => {
  const base = { premium: false, credits: 1, periodEnd: '' };
  it('abonnement : confirmé quand Premium devient actif ou que la période est prolongée', () => {
    expect(isPurchaseConfirmed('subscription', base, { ...STATUS_FREE })).toBe(false);
    expect(isPurchaseConfirmed('subscription', base, { premium: true, subscription: null, credits: { conversation: 1 } })).toBe(true);
    const renew = { premium: true, periodEnd: '2026-12-01' };
    const sub = (end: string) => ({ premium: true, subscription: { product_id: 'p', status: 'active', period_end: end, store: 'apple' }, credits: { conversation: 1 } });
    expect(isPurchaseConfirmed('subscription', { ...base, ...renew }, sub('2026-12-01'))).toBe(false);
    expect(isPurchaseConfirmed('subscription', { ...base, ...renew }, sub('2027-01-01'))).toBe(true);
  });
  it('crédits : confirmé seulement si le solde augmente', () => {
    expect(isPurchaseConfirmed('consumable', base, { ...STATUS_FREE })).toBe(false);
    expect(isPurchaseConfirmed('consumable', base, { ...STATUS_FREE, credits: { conversation: 6 } })).toBe(true);
  });
});

describe('S30 Offres Premium', () => {
  const routes = () => ({
    'GET /me': [200, ME],
    'GET /billing/offers': [200, OFFERS],
    'GET /billing/status': [200, STATUS_FREE],
  }) as never;

  it('Expo Go : offres affichées, prix indisponibles, achat désactivé et explication claire', async () => {
    installFakeApi(routes());
    await renderShell(<PremiumScreen />, { premium: new UnavailablePurchaseProvider('expo_go') });
    expect(await screen.findByTestId('premium-unavailable')).toHaveTextContent(/Expo Go/);
    expect(screen.getByTestId('plan-premium_1m')).toBeOnTheScreen();
    expect(screen.getAllByText('Prix indisponible')).toHaveLength(3);
    // Aucun prix chiffré : aucune étiquette « Meilleur prix » (elle doit être dérivée des prix réels).
    expect(screen.queryByText(/Meilleur prix/)).not.toBeOnTheScreen();
    await user().press(screen.getByTestId('plan-premium_3m'));
    expect(screen.getByTestId('premium-subscribe')).toBeDisabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('plans triés par durée, mention de renouvellement automatique et liens légaux toujours actifs', async () => {
    delete process.env.EXPO_PUBLIC_TERMS_URL;
    installFakeApi(routes());
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    await screen.findByTestId('plan-premium_1m');
    expect(screen.getByTestId('premium-renewal')).toHaveTextContent(/se renouvelle automatiquement/);
    // Sans URL configurée, le lien mène à l'écran de repli de l'application (jamais un bouton mort).
    expect(screen.getByTestId('premium-terms')).toBeEnabled();
    await user().press(screen.getByTestId('premium-terms'));
    expect(router.push).toHaveBeenCalledWith('/legal/terms');
    await user().press(screen.getByTestId('premium-privacy'));
    expect(router.push).toHaveBeenCalledWith('/legal/privacy');
    const labels = screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel as string);
    expect(labels[0]).toMatch(/^1 mois/);
    expect(labels[1]).toMatch(/^3 mois/);
    expect(labels[2]).toMatch(/^12 mois/);
  });

  it('prix par mois sur les offres de plusieurs mois, quand le store donne montant, devise et période', async () => {
    installFakeApi(routes());
    const store = new FakeStore();
    store.getProducts = async (ids: string[]) =>
      ids.map((id) => {
        const months = Number(id.replace(/[^0-9]/g, ''));
        const price = months === 1 ? 9.99 : months === 3 ? 24.99 : 59.99;
        return { productId: id, title: id, priceString: `${price} €`, price, currencyCode: 'EUR', subscriptionPeriod: `P${months}M` };
      });
    await renderShell(<PremiumScreen />, { premium: store });
    const m3 = await screen.findByTestId('plan-premium_3m');
    expect(m3).toHaveProp('accessibilityLabel', expect.stringMatching(/soit 8,33.*par mois/));
    expect(screen.getByTestId('plan-premium_12m')).toHaveProp('accessibilityLabel', expect.stringMatching(/soit 5,00.*par mois.*Meilleur prix/));
    // 1 mois : le prix est déjà mensuel, pas de ligne en plus.
    expect(screen.getByTestId('plan-premium_1m')).not.toHaveProp('accessibilityLabel', expect.stringMatching(/par mois/));
  });

  it('app_user_id RevenueCat = user.id ; déconnexion du SDK au démontage', async () => {
    installFakeApi(routes());
    const store = new FakeStore();
    const { unmount } = await renderShell(<PremiumScreen />, { premium: store });
    await waitFor(() => expect(store.configured).toEqual(['u1']));
    unmount();
    await waitFor(() => expect(store.loggedOut).toBeGreaterThan(0));
  });

  it('achat accepté par le store : prix du store, puis écran de validation serveur (S32)', async () => {
    installFakeApi(routes());
    const store = new FakeStore();
    await renderShell(<PremiumScreen />, { premium: store });
    const u = user();
    await u.press(await screen.findByTestId('plan-premium_3m'));
    expect(screen.getByText('3,99 €')).toBeOnTheScreen();
    await u.press(screen.getByTestId('premium-subscribe'));
    await waitFor(() => expect(store.purchases).toEqual([['premium_3m', 'subscription']]));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/premium/result',
        params: { kind: 'subscription', premium: '0', credits: '1', periodEnd: '' },
      }),
    );
  });

  it('achat annulé : rien ne se passe ; en attente : avis ; erreur : avis sans succès affiché', async () => {
    installFakeApi(routes());
    const store = new FakeStore();
    await renderShell(<PremiumScreen />, { premium: store });
    const u = user();
    await u.press(await screen.findByTestId('plan-premium_1m'));

    store.nextOutcome = { kind: 'cancelled' };
    await u.press(screen.getByTestId('premium-subscribe'));
    await waitFor(() => expect(store.purchases).toHaveLength(1));
    expect(screen.queryByTestId('premium-notice')).not.toBeOnTheScreen();

    store.nextOutcome = { kind: 'pending' };
    await u.press(screen.getByTestId('premium-subscribe'));
    expect(await screen.findByText(/en attente d’approbation/)).toBeOnTheScreen();

    store.nextOutcome = { kind: 'error', message: 'boom' };
    await u.press(screen.getByTestId('premium-subscribe'));
    expect(await screen.findByText(/L’achat n’a pas abouti/)).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('abonné actif : date de fin affichée ; restauration des achats', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/status': [200, { premium: true, subscription: { product_id: 'premium_1m', status: 'active', period_end: '2026-12-15T00:00:00Z', store: 'apple' }, credits: { conversation: 0 } }],
    } as never);
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    expect(await screen.findByTestId('premium-active')).toHaveTextContent(/Premium actif jusqu’au/);
    await user().press(screen.getByTestId('premium-restore'));
    expect(await screen.findByText(/Vos achats ont été restaurés/)).toBeOnTheScreen();
  });

  it('erreur de chargement des offres : « Réessayer »', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [500, { error: { code: 'server_error', message: 'x' } }],
      'GET /billing/status': [200, STATUS_FREE],
    } as never);
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    expect(await screen.findByTestId('async-retry')).toBeOnTheScreen();
    fake.set('GET /billing/offers', [200, OFFERS]);
    await user().press(screen.getByTestId('async-retry'));
    expect(await screen.findByTestId('plan-premium_1m')).toBeOnTheScreen();
  });
});

describe("Gérer ou résilier l'abonnement", () => {
  const activeStatus = (store: string) => ({
    premium: true,
    subscription: { product_id: 'premium_1m', status: 'active', period_end: '2026-12-15T00:00:00Z', store },
    credits: { conversation: 0 },
  });
  const apiFor = (status: unknown) =>
    installFakeApi({ 'GET /me': [200, ME], 'GET /billing/offers': [200, OFFERS], 'GET /billing/status': [200, status] } as never);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("subscriptionsUrl : boutique de l'abonnement, sinon plateforme de l'appareil", () => {
    expect(subscriptionsUrl('apple', 'android')).toBe(APP_STORE_SUBSCRIPTIONS_URL);
    expect(subscriptionsUrl('google', 'ios')).toBe(PLAY_STORE_SUBSCRIPTIONS_URL);
    expect(subscriptionsUrl(null, 'ios')).toBe('https://apps.apple.com/account/subscriptions');
    expect(subscriptionsUrl(undefined, 'android')).toBe('https://play.google.com/store/account/subscriptions');
  });

  it('abonné : bouton visible avec explication claire, ouvre la page des abonnements de la boutique', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    apiFor(activeStatus('apple'));
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    const button = await screen.findByTestId('premium-manage');
    expect(button).toHaveProp('accessibilityLabel', 'Gérer mon abonnement');
    expect(screen.getByTestId('premium-manage-info')).toHaveTextContent(/fin de la période déjà payée/);
    await user().press(button);
    expect(openURL).toHaveBeenCalledWith('https://apps.apple.com/account/subscriptions');
  });

  it('abonnement Google Play : ouvre la page des abonnements Google Play', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    apiFor(activeStatus('google'));
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    await user().press(await screen.findByTestId('premium-manage'));
    expect(openURL).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions');
  });

  it('en anglais : libellé et explication traduits', async () => {
    apiFor(activeStatus('apple'));
    await renderShell(<PremiumScreen />, { premium: new FakeStore(), locale: 'en' });
    expect(await screen.findByTestId('premium-manage')).toHaveProp('accessibilityLabel', 'Manage my subscription');
    expect(screen.getByTestId('premium-manage-info')).toHaveTextContent(/end of the period you already paid for/);
  });

  it("échec d'ouverture : message clair, sans plantage", async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    apiFor(activeStatus('apple'));
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    await user().press(await screen.findByTestId('premium-manage'));
    expect(await screen.findByText(/Impossible d’ouvrir la boutique/)).toBeOnTheScreen();
  });

  it('non abonné : aucun bouton de gestion', async () => {
    apiFor(STATUS_FREE);
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    await screen.findByTestId('plan-premium_1m');
    expect(screen.queryByTestId('premium-manage')).not.toBeOnTheScreen();
  });
});

describe('S31 Crédits', () => {
  it('packs triés, solde affiché, achat consommable', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/status': [200, STATUS_FREE],
    } as never);
    const store = new FakeStore();
    await renderShell(<CreditsScreen />, { premium: store });
    expect(await screen.findByTestId('credits-balance')).toHaveTextContent('Crédits « Conversation » : 1');
    await user().press(screen.getByTestId('buy-conversation_5'));
    await waitFor(() => expect(store.purchases).toEqual([['conversation_5', 'consumable']]));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/premium/result' })));
    // Ligne non cliquable avec bouton : le bouton porte le libellé complet et n'est pas masqué par un parent accessible.
    expect(screen.getByTestId('buy-conversation_1')).toHaveProp('accessibilityLabel', 'Acheter 1 crédit');
    expect(screen.getByTestId('pack-conversation_1')).toHaveProp('accessible', false);
  });

  it('indisponible dans Expo Go : bouton désactivé', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /billing/offers': [200, OFFERS], 'GET /billing/status': [200, STATUS_FREE] } as never);
    await renderShell(<CreditsScreen />, { premium: new UnavailablePurchaseProvider('expo_go') });
    expect(await screen.findByTestId('credits-unavailable')).toBeOnTheScreen();
    expect(screen.getByTestId('buy-conversation_1')).toBeDisabled();
  });
});

describe('S32 Validation de l\'achat par le serveur', () => {
  it('ne confirme pas tant que le serveur ne voit pas l\'achat, puis confirme', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      mockParams.current = { kind: 'subscription', premium: '0', credits: '1', periodEnd: '' };
      let premium = false;
      const fake = installFakeApi({
        'GET /me': [200, ME],
        'POST /billing/sync': () => [200, { premium, subscription: null, credits: { conversation: 1 } }],
      } as never);
      await renderShell(<PurchaseResultScreen />, { premium: new UnavailablePurchaseProvider() });
      await waitFor(() => expect(fake.called('POST /billing/sync')).toHaveLength(1));
      expect(screen.getByTestId('purchase-validating')).toBeOnTheScreen();
      expect(screen.queryByTestId('purchase-confirmed')).not.toBeOnTheScreen();

      await act(async () => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS + 50);
      });
      expect(screen.queryByTestId('purchase-confirmed')).not.toBeOnTheScreen();

      premium = true;
      await act(async () => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS + 50);
      });
      expect(await screen.findByTestId('purchase-confirmed')).toHaveTextContent(/Bienvenue dans Premium/);
    } finally {
      jest.useRealTimers();
    }
  });

  it('serveur silencieux : délai dépassé -> message honnête, nouvelle vérification et support', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      mockParams.current = { kind: 'consumable', premium: '0', credits: '1' };
      const fake = installFakeApi({
        'GET /me': [200, ME],
        'POST /billing/sync': [200, STATUS_FREE],
      } as never);
      await renderShell(<PurchaseResultScreen />, { premium: new UnavailablePurchaseProvider() });
      for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
        await act(async () => {
          jest.advanceTimersByTime(POLL_INTERVAL_MS + 50);
        });
      }
      expect(await screen.findByTestId('purchase-timeout')).toBeOnTheScreen();
      expect(fake.called('POST /billing/sync')).toHaveLength(MAX_ATTEMPTS);
      expect(screen.queryByTestId('purchase-confirmed')).not.toBeOnTheScreen();
      await act(async () => {
        await user().press(screen.getByTestId('purchase-support'));
      });
      expect(router.replace).toHaveBeenCalledWith('/settings/support');
    } finally {
      jest.useRealTimers();
    }
  });

  it('crédits ajoutés : confirmation avec le nouveau solde', async () => {
    mockParams.current = { kind: 'consumable', premium: '0', credits: '1' };
    installFakeApi({
      'GET /me': [200, ME],
      'POST /billing/sync': [200, { premium: false, subscription: null, credits: { conversation: 6 } }],
    } as never);
    await renderShell(<PurchaseResultScreen />, { premium: new UnavailablePurchaseProvider() });
    expect(await screen.findByTestId('purchase-confirmed')).toHaveTextContent(/Crédits ajoutés. Solde : 6./);
  });

  it('événement temps réel billing.updated : le serveur est relu (POST /billing/sync)', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'POST /billing/sync': [200, STATUS_FREE],
    } as never);
    const { transport } = await renderShell(<CreditsScreenProbe />, { premium: new UnavailablePurchaseProvider() });
    await waitFor(() => expect(transport.channels()).toContain('private-user.u1'));
    await act(async () => {
      transport.emit('private-user.u1', 'billing.updated', { user_id: 'u1' });
    });
    await waitFor(() => expect(fake.called('POST /billing/sync')).toHaveLength(1));
  });
});

function CreditsScreenProbe() {
  return null;
}

describe('Paywall : conformité et textes utilisateur', () => {
  const routes = () => ({
    'GET /me': [200, ME],
    'GET /billing/offers': [200, OFFERS],
    'GET /billing/status': [200, STATUS_FREE],
  }) as never;

  it('offre la plus longue présélectionnée ; prix et période près du bouton, renouvellement lisible (>= 14)', async () => {
    installFakeApi(routes());
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    await screen.findByTestId('plan-premium_12m');
    expect(screen.getByTestId('plan-premium_12m')).toBeChecked();
    expect(screen.getByText('12,99 €')).toBeOnTheScreen();
    expect(screen.queryByText(/Meilleur prix/)).not.toBeOnTheScreen();
    expect(screen.getByTestId('premium-subscribe')).toBeEnabled();
    expect(screen.getByTestId('premium-subscribe')).toHaveProp('accessibilityLabel', 'S’abonner, 12,99 €');
    expect(screen.getByTestId('premium-summary')).toHaveTextContent('12 mois, 12,99 €. Renouvellement automatique jusqu’à résiliation.');
    const renewal = screen.getByTestId('premium-renewal');
    const style = Object.assign({}, ...[renewal.props.style].flat(2).filter(Boolean));
    expect(style.fontSize).toBeGreaterThanOrEqual(14);
    await user().press(screen.getByTestId('plan-premium_1m'));
    expect(screen.getByTestId('premium-summary')).toHaveTextContent(/^1 mois, 1,99 €\./);
  });

  it("achat de l'offre présélectionnée sans autre geste", async () => {
    installFakeApi(routes());
    const store = new FakeStore();
    await renderShell(<PremiumScreen />, { premium: store });
    await screen.findByTestId('plan-premium_12m');
    await user().press(screen.getByTestId('premium-subscribe'));
    await waitFor(() => expect(store.purchases).toEqual([['premium_12m', 'subscription']]));
  });

  it("liens légaux : l'URL configurée est ouverte, sinon repli dans l'application", async () => {
    process.env.EXPO_PUBLIC_PRIVACY_URL = 'https://example.test/privacy';
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    try {
      installFakeApi(routes());
      await renderShell(<PremiumScreen />, { premium: new FakeStore() });
      await screen.findByTestId('plan-premium_12m');
      await user().press(screen.getByTestId('premium-privacy'));
      expect(openURL).toHaveBeenCalledWith('https://example.test/privacy');
      expect(router.push).not.toHaveBeenCalled();
    } finally {
      delete process.env.EXPO_PUBLIC_PRIVACY_URL;
      openURL.mockRestore();
    }
  });

  it('hors développement : aucun texte technique (RevenueCat, Expo Go, EXPO_PUBLIC_) montré', async () => {
    const globals = globalThis as unknown as { __DEV__: boolean };
    const previous = globals.__DEV__;
    globals.__DEV__ = false;
    try {
      installFakeApi(routes());
      for (const reason of ['expo_go', 'missing_key', 'not_installed'] as const) {
        const view = await renderShell(<PremiumScreen />, { premium: new UnavailablePurchaseProvider(reason) });
        const banner = await screen.findByTestId('premium-unavailable');
        expect(banner).toHaveTextContent(/Les achats sont momentanément indisponibles\. Réessayez plus tard\./);
        expect(banner).not.toHaveTextContent(/RevenueCat|Expo Go|EXPO_PUBLIC/);
        view.unmount();
      }
    } finally {
      globals.__DEV__ = previous;
    }
  });

  it('Premium offert (promotional) : message explicatif au lieu de la page de boutique', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    try {
      installFakeApi({
        'GET /me': [200, ME],
        'GET /billing/offers': [200, OFFERS],
        'GET /billing/status': [200, { premium: true, subscription: { product_id: 'premium_promo', status: 'active', period_end: '2026-12-15T00:00:00Z', store: 'promotional' }, credits: { conversation: 0 } }],
      } as never);
      await renderShell(<PremiumScreen />, { premium: new FakeStore() });
      expect(await screen.findByTestId('premium-manage-info')).toHaveTextContent(/Premium offert jusqu’au .* Rien à résilier/);
      expect(screen.queryByRole('button', { name: 'Gérer mon abonnement' })).not.toBeOnTheScreen();
      expect(openURL).not.toHaveBeenCalled();
    } finally {
      openURL.mockRestore();
    }
  });

  it('abonné via une boutique : plus de bouton S’abonner (pas de double souscription)', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, OFFERS],
      'GET /billing/status': [200, { premium: true, subscription: { product_id: 'premium_1m', status: 'active', period_end: '2026-12-15T00:00:00Z', store: 'apple' }, credits: { conversation: 0 } }],
    } as never);
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    await screen.findByTestId('premium-active');
    expect(screen.queryByTestId('premium-subscribe')).not.toBeOnTheScreen();
  });
});

describe('Paywall : refonte visuelle (direction Prune)', () => {
  const routes = () => ({
    'GET /me': [200, ME],
    'GET /billing/offers': [200, OFFERS],
    'GET /billing/status': [200, STATUS_FREE],
  }) as never;
  const priced = (prices: Record<number, number>, currency = 'EUR') => {
    const store = new FakeStore();
    store.getProducts = async (ids: string[]) =>
      ids.map((id) => {
        const months = Number(id.replace(/[^0-9]/g, ''));
        return { productId: id, title: id, priceString: `${prices[months]} €`, price: prices[months], currencyCode: currency, subscriptionPeriod: `P${months}M` };
      });
    return store;
  };

  it('avantages : seulement ceux de l’offre, avec coche (icône) et texte', async () => {
    installFakeApi(routes());
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    await screen.findByTestId('plan-premium_12m');
    const benefits = screen.getByTestId('premium-benefits');
    for (const label of ['J’aime illimités', 'Coups de cœur', 'Retour en arrière', 'Conversations sans crédit']) {
      expect(within(benefits).getByText(label)).toBeOnTheScreen();
    }
    // Pictogrammes décoratifs, masqués aux lecteurs d'écran : le texte porte le sens.
    expect(within(benefits).getAllByTestId('icon-CircleCheck', { includeHiddenElements: true })).toHaveLength(4);
  });

  it('« Meilleur prix » : dérivé des prix réels, sur l’offre au prix par mois le plus bas seulement', async () => {
    installFakeApi(routes());
    await renderShell(<PremiumScreen />, { premium: priced({ 1: 9.99, 3: 24.99, 12: 59.99 }) });
    expect(await screen.findByTestId('plan-premium_12m')).toHaveProp('accessibilityLabel', expect.stringMatching(/Meilleur prix/));
    expect(screen.getByTestId('plan-premium_3m')).not.toHaveProp('accessibilityLabel', expect.stringMatching(/Meilleur prix/));
    expect(screen.getByTestId('plan-premium_1m')).not.toHaveProp('accessibilityLabel', expect.stringMatching(/Meilleur prix/));
  });

  it('« Meilleur prix » : absent si la durée la plus longue n’est pas la moins chère par mois', async () => {
    installFakeApi(routes());
    // 12 mois à 150 € (12,50 par mois) contre 9,99 par mois : la durée longue n'est pas la bonne affaire.
    await renderShell(<PremiumScreen />, { premium: priced({ 1: 9.99, 3: 24.99, 12: 150 }) });
    await screen.findByTestId('plan-premium_12m');
    expect(screen.getByTestId('plan-premium_3m')).toHaveProp('accessibilityLabel', expect.stringMatching(/Meilleur prix/));
    expect(screen.getByTestId('plan-premium_12m')).not.toHaveProp('accessibilityLabel', expect.stringMatching(/Meilleur prix/));
    // La présélection (offre la plus longue) ne change pas.
    expect(screen.getByTestId('plan-premium_12m')).toBeChecked();
  });

  it('« Meilleur prix » : absent si deux offres ont le même prix par mois ou des devises différentes', () => {
    const plans = [
      { product_id: 'a', months: 1 },
      { product_id: 'b', months: 3 },
    ];
    const product = (productId: string, price: number, months: number, currencyCode = 'EUR') => ({
      productId,
      title: productId,
      priceString: String(price),
      price,
      currencyCode,
      subscriptionPeriod: `P${months}M`,
    });
    expect(bestValueProductId(plans, [product('a', 10, 1), product('b', 30, 3)])).toBeNull();
    expect(bestValueProductId(plans, [product('a', 10, 1), product('b', 24, 3, 'USD')])).toBeNull();
    expect(bestValueProductId(plans, [product('a', 10, 1)])).toBeNull();
    expect(bestValueProductId(plans, [product('a', 10, 1), product('b', 24, 3)])).toBe('b');
    expect(bestValueProductId(plans.slice(0, 1), [product('a', 10, 1)])).toBeNull();
  });

  it('plans : sélection portée par coche, bordure et état coché (pas la couleur seule)', async () => {
    installFakeApi(routes());
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    await screen.findByTestId('plan-premium_12m');
    const hidden = { includeHiddenElements: true };
    expect(screen.getByTestId('plan-premium_12m-check', hidden)).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-premium_1m-check', hidden)).not.toBeOnTheScreen();
    await user().press(screen.getByTestId('plan-premium_1m'));
    expect(screen.getByTestId('plan-premium_1m-check', hidden)).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-premium_12m-check', hidden)).not.toBeOnTheScreen();
  });
});
