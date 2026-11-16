import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { type PurchaseOutcome, type PurchaseProvider, type RestoreOutcome, type StoreProduct } from '../src/billing/purchaseProvider';
import { PremiumScreen } from '../src/features/premium/PremiumScreen';
import { ConsentSettingsScreen } from '../src/features/settings/ConsentSettingsScreen';
import { NotificationsScreen } from '../src/features/settings/NotificationsScreen';
import { PrivacyScreen } from '../src/features/settings/PrivacyScreen';
import { SessionsScreen } from '../src/features/settings/SessionsScreen';
import { SettingsScreen } from '../src/features/settings/SettingsScreen';
import { ConsentsScreen } from '../src/features/signup/ConsentsScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { colors } from '../src/theme';
import { Avatar, CheckboxField } from '../src/ui';
import { renderApp } from './helpers/app';
import { installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { flatStyle as flat, renderThemed } from './helpers/render';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('react-native-purchases', () => {
  throw new Error('react-native-purchases chargé par les tests');
});
jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({}),
}));

const ME = meFixture();
const user = () => userEvent.setup();
const toggle = async (id: string, value: boolean) => {
  await fireEvent(screen.getByTestId(id), 'valueChange', value);
};
const emptyBody = () => [204, null] as never;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => undefined);
});

describe('Sessions : confirmation avec une vraie phrase, près de la ligne touchée', () => {
  const sessions = {
    data: [
      { id: 's1', platform: 'android', app_version: '0.1.0', last_active_at: null, created_at: null, current: true },
      { id: 's2', platform: 'ios', app_version: '0.1.0', last_active_at: null, created_at: null, current: false },
    ],
  };

  it('autre appareil : phrase de conséquence, les autres boutons sont inertes, annuler referme', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /auth/sessions': [200, sessions] });
    await renderShell(<SessionsScreen />);
    await user().press(await screen.findByTestId('session-close-s2'));
    const panel = screen.getByTestId('sessions-confirm');
    expect(panel).toHaveTextContent(/L’appareil sélectionné sera déconnecté et devra se reconnecter pour utiliser votre compte\./);
    expect(screen.getByTestId('session-close-s1')).toBeDisabled();
    expect(screen.getByTestId('session-close-s2')).toBeDisabled();
    expect(screen.getByTestId('sessions-close-all')).toBeDisabled();
    await user().press(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByTestId('sessions-confirm')).toBeNull();
    expect(screen.getByTestId('session-close-s1')).toBeEnabled();
  });

  it('session courante : la phrase d’avant est conservée', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /auth/sessions': [200, sessions] });
    await renderShell(<SessionsScreen />);
    await user().press(await screen.findByTestId('session-close-s1'));
    expect(screen.getByTestId('sessions-confirm')).toHaveTextContent(/fermera la session de cet appareil/);
  });
});

describe('Textes légaux : un échec d’ouverture n’est jamais silencieux', () => {
  it('réglages des consentements : lignes cliquables ; échec -> bandeau d’erreur', async () => {
    process.env.EXPO_PUBLIC_TERMS_URL = 'https://example.test/cgu';
    const openURL = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no browser'));
    installFakeApi({ 'GET /me': [200, ME], 'GET /me/consents': [200, { data: {} }] });
    await renderShell(<ConsentSettingsScreen />);
    await user().press(await screen.findByTestId('consent-terms-open'));
    expect(openURL).toHaveBeenCalledWith('https://example.test/cgu');
    expect(await screen.findByTestId('consent-legal-error')).toHaveTextContent('Impossible d’ouvrir ce lien.');
    delete process.env.EXPO_PUBLIC_TERMS_URL;
  });

  it('inscription : même bandeau si « Lire les conditions » échoue', async () => {
    process.env.EXPO_PUBLIC_TERMS_URL = 'https://example.test/cgu';
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no browser'));
    await renderApp(<ConsentsScreen />, {
      step: 'consents',
      birthdate: '1990-03-05',
      ageToken: 'tok',
      consents: undefined,
    } as never);
    await user().press(screen.getByTestId('consent-terms-read'));
    expect(await screen.findByTestId('consents-legal-error')).toHaveTextContent('Impossible d’ouvrir ce lien.');
    delete process.env.EXPO_PUBLIC_TERMS_URL;
  });
});

describe('Paywall : restaurer et acheter des crédits restent visibles', () => {
  class Store implements PurchaseProvider {
    readonly available = true;
    restoreOutcome: RestoreOutcome | 'throw' = { kind: 'restored' };
    async configure() {}
    async getProducts(ids: string[]): Promise<StoreProduct[]> {
      return ids.map((id) => ({ productId: id, title: id, priceString: '9,99 €' }));
    }
    async purchase(): Promise<PurchaseOutcome> {
      return { kind: 'cancelled' };
    }
    async restore(): Promise<RestoreOutcome> {
      if (this.restoreOutcome === 'throw') throw new Error('store down');
      return this.restoreOutcome;
    }
    async logOut() {}
  }

  it('offres en échec (réseau) : les deux boutons sont présents', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [500, { error: { code: 'server_error', message: 'x' } }],
      'GET /billing/status': [200, { premium: false, subscription: null, credits: { conversation: 0 } }],
    } as never);
    await renderShell(<PremiumScreen />, { premium: new Store() });
    expect(await screen.findByTestId('async-retry')).toBeOnTheScreen();
    expect(screen.getByTestId('premium-restore')).toBeOnTheScreen();
    expect(screen.getByTestId('premium-credits')).toBeOnTheScreen();
  });

  it('une restauration qui lève une exception affiche une erreur au lieu de planter', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/offers': [200, { subscriptions: [{ product_id: 'premium_1m', months: 1 }], packs: [] }],
      'GET /billing/status': [200, { premium: false, subscription: null, credits: { conversation: 0 } }],
    } as never);
    const store = new Store();
    store.restoreOutcome = 'throw';
    await renderShell(<PremiumScreen />, { premium: store });
    await user().press(await screen.findByTestId('premium-restore'));
    expect(await screen.findByTestId('premium-notice')).toHaveTextContent('La restauration a échoué. Réessayez.');
    expect(screen.getByTestId('premium-restore')).toBeEnabled();
  });
});

describe('Réglages : déconnexion, suppression, langue', () => {
  const billing = { premium: false, subscription: null, credits: { conversation: 0 } };

  it('échec de déconnexion : bandeau d’erreur, le bouton redevient actif', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /billing/status': [200, billing], 'POST /auth/logout': emptyBody() } as never);
    await renderShell(<SettingsScreen />);
    jest.spyOn(tokenStore, 'clear').mockRejectedValueOnce(new Error('storage'));
    await user().press(await screen.findByTestId('settings-logout'));
    expect(await screen.findByTestId('settings-logout-error')).toHaveTextContent('Impossible de vous déconnecter. Réessayez.');
    expect(screen.getByTestId('settings-logout')).toBeEnabled();
  });

  it('la langue est une ligne de navigation qui annonce la langue cible ; la suppression existe toujours', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /billing/status': [200, billing] } as never);
    await renderShell(<SettingsScreen />);
    expect(await screen.findByTestId('settings-delete')).toBeOnTheScreen();
    expect(screen.getByTestId('language-toggle')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('language-toggle')).toHaveProp('accessibilityLabel', expect.stringMatching(/English/));
  });
});

describe('Notifications et confidentialité : seule la ligne touchée est inerte', () => {
  it('confidentialité : pendant l’enregistrement, seule la ligne modifiée est désactivée', async () => {
    let release: (value: [number, unknown]) => void = () => undefined;
    installFakeApi({
      'GET /me': [200, ME],
      'PATCH /me/privacy': (() => new Promise<[number, unknown]>((resolve) => (release = resolve))) as never,
    } as never);
    await renderShell(<PrivacyScreen />);
    await screen.findByTestId('privacy-visible');
    void toggle('privacy-visible', false);
    await waitFor(() => expect(screen.getByTestId('privacy-visible')).toBeDisabled());
    expect(screen.getByTestId('privacy-distance')).toBeEnabled();
    expect(screen.getByTestId('privacy-lastseen')).toBeEnabled();
    await act(async () => release([200, ME]));
    await waitFor(() => expect(screen.getByTestId('privacy-visible')).toBeEnabled());
  });

  it('notifications : un échec ne défait que la valeur de sa propre ligne', async () => {
    const prefs = { push_messages: true, push_matches: true, push_calls: true, push_marketing: false, email_marketing: false };
    installFakeApi({
      'GET /me': [200, ME],
      'GET /me/notifications': [200, prefs],
      'PUT /me/notifications': [500, { error: { code: 'server_error', message: 'x' } }],
    } as never);
    await renderShell(<NotificationsScreen />);
    await screen.findByTestId('notif-push_marketing');
    await toggle('notif-push_marketing', true);
    expect(await screen.findByTestId('notif-banner')).toBeOnTheScreen();
    expect(screen.getByTestId('notif-push_marketing')).toHaveProp('value', false);
    expect(screen.getByTestId('notif-push_messages')).toHaveProp('value', true);
  });
});

describe('Composants partagés', () => {
  it('CheckboxField désactivé : fond « désactivé », état annoncé ; même trait coché ou non', async () => {
    const onChange = jest.fn();
    const first = await renderThemed(<CheckboxField testID="cb" label="Option" checked={false} onChange={onChange} disabled />);
    const box = screen.getByTestId('cb');
    expect(flat(box.props.style).backgroundColor).toBe(colors.light.disabledBg);
    expect(box).toHaveProp('accessibilityState', expect.objectContaining({ disabled: true }));
    const restWidth = flat(box.props.style).borderWidth;
    await first.unmount();
    await renderThemed(<CheckboxField testID="cb2" label="Option" checked onChange={onChange} />);
    expect(flat(screen.getByTestId('cb2').props.style).borderWidth).toBe(restWidth);
  });

  it('Avatar : photo cassée -> initiale ; la taille de l’initiale suit celle du disque', async () => {
    await renderThemed(<Avatar testID="av" uri="https://img.example.test/x.jpg" name="Awa" size={120} />);
    expect(screen.queryByText('A')).toBeNull();
    fireEvent(screen.getByTestId('av'), 'error');
    // L'initiale de repli est masquée aux lecteurs d'écran (le nom voisin porte le sens) : on la cherche aussi masquée.
    expect(await screen.findByText('A', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(flat(screen.getByText('A', { includeHiddenElements: true }).props.style).fontSize).toBeGreaterThan(16);
  });
});
