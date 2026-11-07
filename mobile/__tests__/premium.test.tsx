import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
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
    await user().press(screen.getByTestId('plan-premium_3m'));
    expect(screen.getByTestId('premium-subscribe')).toBeDisabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('plans triés par durée, avec mention de renouvellement automatique et liens non configurés', async () => {
    installFakeApi(routes());
    await renderShell(<PremiumScreen />, { premium: new FakeStore() });
    await screen.findByTestId('plan-premium_1m');
    expect(screen.getByTestId('premium-renewal')).toHaveTextContent(/se renouvelle automatiquement/);
    expect(screen.getByTestId('premium-terms')).toBeDisabled();
    const labels = screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel as string);
    expect(labels[0]).toMatch(/^1 mois/);
    expect(labels[1]).toMatch(/^3 mois/);
    expect(labels[2]).toMatch(/^12 mois/);
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
    expect(button).toHaveProp('accessibilityLabel', 'Gérer ou résilier mon abonnement');
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
    expect(await screen.findByTestId('premium-manage')).toHaveProp('accessibilityLabel', 'Manage or cancel my subscription');
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
    expect(screen.getByTestId('pack-conversation_1')).toHaveProp('accessibilityLabel', expect.stringMatching(/^1 crédit/));
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
