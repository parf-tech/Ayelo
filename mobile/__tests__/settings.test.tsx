import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { AppealScreen } from '../src/features/settings/AppealScreen';
import { BlockedScreen } from '../src/features/settings/BlockedScreen';
import { ConsentSettingsScreen } from '../src/features/settings/ConsentSettingsScreen';
import { DeleteAccountScreen } from '../src/features/settings/DeleteAccountScreen';
import { ExportScreen, EXPORT_POLL_MS } from '../src/features/settings/ExportScreen';
import { LegalScreen } from '../src/features/settings/LegalScreen';
import { NotificationsScreen } from '../src/features/settings/NotificationsScreen';
import { PrivacyScreen } from '../src/features/settings/PrivacyScreen';
import { SanctionsScreen } from '../src/features/settings/SanctionsScreen';
import { SessionsScreen } from '../src/features/settings/SessionsScreen';
import { SettingsScreen } from '../src/features/settings/SettingsScreen';
import { SupportScreen } from '../src/features/settings/SupportScreen';
import { getLegalLinks } from '../src/features/legal/links';
import { LegalFallbackScreen } from '../src/features/legal/LegalFallbackScreen';
import { ProfileEditScreen } from '../src/features/profile/ProfileEditScreen';
import { ProfileTabScreen } from '../src/features/profile/ProfileTabScreen';
import { probe } from './helpers/app';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { media, meFixture, selfProfile } from './helpers/fixtures';
import { resetRouterMocks, router } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => mockParams.current,
}));

const ME = meFixture();
const user = () => userEvent.setup();
const toggle = async (id: string, value: boolean) => {
  await fireEvent(screen.getByTestId(id), 'valueChange', value);
};

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

describe('S50 Paramètres', () => {
  it('liste les entrées et navigue vers chaque sous-écran', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/status': [200, { premium: false, subscription: null, credits: { conversation: 0 } }],
    } as never);
    await renderShell(<SettingsScreen />);
    const u = user();
    const targets: [string, string][] = [
      ['settings-preferences', '/settings/preferences'],
      ['settings-notifications', '/settings/notifications'],
      ['settings-purchases', '/settings/purchases'],
      ['settings-privacy', '/settings/privacy'],
      ['settings-sessions', '/settings/sessions'],
      ['settings-blocked', '/settings/blocked'],
      ['settings-consents', '/settings/consents'],
      ['settings-sanctions', '/settings/sanctions'],
      ['settings-export', '/settings/export'],
      ['settings-support', '/settings/support'],
      ['settings-legal', '/settings/legal'],
      ['settings-delete', '/settings/delete-account'],
    ];
    for (const [id, path] of targets) {
      await u.press(await screen.findByTestId(id));
      expect(router.push).toHaveBeenLastCalledWith(path);
    }
  });

  it('abonné : « Gérer mon abonnement » ouvre la page des abonnements de la boutique', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/status': [
        200,
        { premium: true, subscription: { product_id: 'premium_1m', status: 'active', period_end: '2026-12-15T00:00:00Z', store: 'google' }, credits: { conversation: 0 } },
      ],
    } as never);
    await renderShell(<SettingsScreen />);
    const row = await screen.findByTestId('settings-manage-subscription');
    expect(row).toHaveProp('accessibilityLabel', 'Gérer mon abonnement');
    expect(screen.getByTestId('settings-manage-subscription-info')).toHaveTextContent(/fin de la période déjà payée/);
    await user().press(row);
    expect(openURL).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions');
    openURL.mockRestore();
  });

  it('statut indisponible (erreur réseau) : la ligne reste affichée et ouvre la boutique de la plateforme', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/status': [500, { error: { code: 'server_error', message: 'x' } }],
    } as never);
    await renderShell(<SettingsScreen />);
    await screen.findByTestId('settings-preferences');
    await waitFor(() => expect(fake.called('GET /billing/status')).toHaveLength(1));
    await user().press(screen.getByTestId('settings-manage-subscription'));
    expect(openURL).toHaveBeenCalledWith(expect.stringMatching(/apps\.apple\.com|play\.google\.com/));
    openURL.mockRestore();
  });

  it('Premium offert par l’équipe : message explicatif, pas de page de boutique vide', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/status': [200, { premium: true, subscription: { product_id: 'premium_promo', status: 'active', period_end: '2026-12-15T00:00:00Z', store: 'promotional' }, credits: { conversation: 0 } }],
    } as never);
    await renderShell(<SettingsScreen />);
    await waitFor(() => expect(screen.getByTestId('settings-manage-subscription-info')).toHaveTextContent(/Premium offert jusqu’au .*Rien à résilier/));
    expect(openURL).not.toHaveBeenCalled();
    openURL.mockRestore();
  });

  it('se déconnecter : POST /auth/logout puis session effacée', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /billing/status': [200, { premium: false, subscription: null, credits: { conversation: 0 } }],
      'POST /auth/logout': emptyBody(),
    } as never);
    await renderShell(<SettingsScreen />);
    await user().press(await screen.findByTestId('settings-logout'));
    await waitFor(() => expect(probe.auth()).toBe('signedOut'));
    expect(fake.called('POST /auth/logout')).toHaveLength(1);
  });
});

describe('S51 Confidentialité', () => {
  it('bascule envoyée en PATCH /me/privacy et conservée', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'PATCH /me/privacy': [200, meFixture({ profile: selfProfile({ hide_distance: true }) })],
    });
    await renderShell(<PrivacyScreen />);
    await screen.findByTestId('privacy-distance');
    await toggle('privacy-distance', true);
    await waitFor(() => expect(fake.called('PATCH /me/privacy')).toHaveLength(1));
    expect(fake.called('PATCH /me/privacy')[0]?.body).toEqual({ hide_distance: true });
    await waitFor(() => expect(screen.getByTestId('privacy-distance').props.value).toBe(true));
  });

  it('refus du serveur : retour à la valeur précédente et message', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'PATCH /me/privacy': [500, { error: { code: 'server_error', message: 'x' } }],
    });
    await renderShell(<PrivacyScreen />);
    await screen.findByTestId('privacy-visible');
    await toggle('privacy-visible', false);
    expect(await screen.findByTestId('privacy-banner')).toBeOnTheScreen();
    expect(screen.getByTestId('privacy-visible').props.value).toBe(true);
  });

  it('sans profil : invitation à créer le profil', async () => {
    installFakeApi({ 'GET /me': [200, meFixture({ profile: null })] });
    await renderShell(<PrivacyScreen />);
    expect(await screen.findByText('Créez d’abord votre profil pour régler la confidentialité.')).toBeOnTheScreen();
  });
});

describe('S52 Notifications', () => {
  const prefs = { push_messages: true, push_matches: true, push_calls: true, push_marketing: false, email_marketing: false };

  it('charge les préférences, envoie uniquement la clé modifiée', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /me/notifications': [200, prefs],
      'PUT /me/notifications': [200, { ...prefs, push_marketing: true }],
    });
    await renderShell(<NotificationsScreen />);
    await screen.findByTestId('notif-push_marketing');
    expect(screen.getByTestId('notif-push_messages').props.value).toBe(true);
    await toggle('notif-push_marketing', true);
    await waitFor(() => expect(fake.called('PUT /me/notifications')).toHaveLength(1));
    expect(fake.called('PUT /me/notifications')[0]?.body).toEqual({ push_marketing: true });
  });

  it('échec : retour arrière et bannière', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /me/notifications': [200, prefs],
      'PUT /me/notifications': [500, { error: { code: 'server_error', message: 'x' } }],
    });
    await renderShell(<NotificationsScreen />);
    await screen.findByTestId('notif-push_calls');
    await toggle('notif-push_calls', false);
    expect(await screen.findByTestId('notif-banner')).toBeOnTheScreen();
    expect(screen.getByTestId('notif-push_calls').props.value).toBe(true);
  });
});

describe('S53 Sessions', () => {
  const sessions = {
    data: [
      { id: 's1', platform: 'android', app_version: '0.1.0', last_active_at: '2026-11-06T10:00:00Z', created_at: null, current: true },
      { id: 's2', platform: 'ios', app_version: null, last_active_at: null, created_at: null, current: false },
    ],
  };

  it('liste les appareils, marque l\'appareil courant, ferme une autre session', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /auth/sessions': () => [200, sessions],
      'DELETE /auth/sessions/s2': emptyBody(),
    });
    await renderShell(<SessionsScreen />);
    expect(await screen.findByTestId('session-s1')).toBeOnTheScreen();
    expect(screen.getByText(/Cet appareil/)).toBeOnTheScreen();
    const u = user();
    await u.press(screen.getByTestId('session-close-s2'));
    await u.press(screen.getByTestId('sessions-confirm-yes'));
    await waitFor(() => expect(fake.called('DELETE /auth/sessions/s2')).toHaveLength(1));
    expect(probe.auth()).toBe('signedIn');
  });

  it('fermer la session courante ou toutes les sessions déconnecte', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /auth/sessions': [200, sessions],
      'DELETE /auth/sessions': emptyBody(),
      'POST /auth/logout': emptyBody(),
    });
    await renderShell(<SessionsScreen />);
    const u = user();
    await u.press(await screen.findByTestId('sessions-close-all'));
    expect(screen.getByText(/Toutes les sessions seront fermées/)).toBeOnTheScreen();
    await u.press(screen.getByTestId('sessions-confirm-yes'));
    await waitFor(() => expect(probe.auth()).toBe('signedOut'));
    expect(fake.called('DELETE /auth/sessions')).toHaveLength(1);
  });

  it('erreur de chargement puis rechargement', async () => {
    const fake = installFakeApi({ 'GET /me': [200, ME], 'GET /auth/sessions': [500, { error: { code: 'server_error', message: 'x' } }] });
    await renderShell(<SessionsScreen />);
    expect(await screen.findByTestId('async-retry')).toBeOnTheScreen();
    fake.set('GET /auth/sessions', [200, sessions]);
    await user().press(screen.getByTestId('async-retry'));
    expect(await screen.findByTestId('session-s2')).toBeOnTheScreen();
  });
});

describe('S54 Bloqués', () => {
  it('liste puis débloque', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /blocks': [200, { data: [{ user_id: 'b1', display_name: 'Paul', created_at: '2026-11-01T00:00:00Z' }] }],
      'DELETE /blocks/b1': emptyBody(),
    });
    await renderShell(<BlockedScreen />);
    expect(await screen.findByText('Paul')).toBeOnTheScreen();
    await user().press(screen.getByLabelText('Débloquer Paul'));
    await waitFor(() => expect(fake.called('DELETE /blocks/b1')).toHaveLength(1));
    expect(await screen.findByText('Vous n’avez bloqué personne.')).toBeOnTheScreen();
  });

  it('état vide', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /blocks': [200, { data: [] }] });
    await renderShell(<BlockedScreen />);
    expect(await screen.findByText('Vous n’avez bloqué personne.')).toBeOnTheScreen();
  });
});

describe('S55 Suppression du compte', () => {
  it('exige le mot de passe avant tout appel', async () => {
    const fake = installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<DeleteAccountScreen />);
    await user().press(screen.getByTestId('delete-confirm'));
    expect(screen.getByText('Saisissez votre mot de passe.')).toBeOnTheScreen();
    expect(fake.called('DELETE /me')).toHaveLength(0);
  });

  it('DELETE /me : la confirmation (délai, annulation, abonnement) reste affichée AVANT toute déconnexion', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'DELETE /me': [202, { status: 'scheduled', purge_after_days: 30 }],
      'POST /auth/logout': emptyBody(),
    });
    await renderShell(<DeleteAccountScreen />);
    const u = user();
    await u.type(screen.getByTestId('delete-password'), 'Motdepasse123');
    await u.press(screen.getByTestId('delete-confirm'));
    await waitFor(() => expect(fake.called('DELETE /me')).toHaveLength(1));
    expect(fake.called('DELETE /me')[0]?.body).toEqual({ password: 'Motdepasse123' });
    expect(await screen.findByTestId('delete-grace')).toHaveTextContent('Suppression définitive dans 30 jours.');
    expect(screen.getByTestId('delete-cancel-hint')).toHaveTextContent(/contactez le support/);
    expect(screen.getByTestId('delete-subscription')).toHaveTextContent(/ne résilie pas votre abonnement/);
    expect(screen.getByTestId('delete-manage-subscription')).toBeOnTheScreen();
    expect(probe.auth()).toBe('signedIn');
    expect(fake.called('POST /auth/logout')).toHaveLength(0);
    await u.press(screen.getByTestId('delete-signout'));
    await waitFor(() => expect(probe.auth()).toBe('signedOut'));
    expect(fake.called('POST /auth/logout')).toHaveLength(1);
  });

  it('le formulaire mentionne déjà l’abonnement à résilier avant de supprimer', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<DeleteAccountScreen />);
    expect(screen.getByTestId('delete-subscription')).toHaveTextContent(/continuera d’être facturé/);
    expect(screen.getByTestId('delete-confirm')).toHaveProp('accessibilityLabel', 'Supprimer mon compte');
  });

  it('mot de passe incorrect (403) : message sur le champ, compte conservé', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'DELETE /me': [403, { error: { code: 'invalid_credentials', message: 'Mot de passe incorrect.' } }],
    });
    await renderShell(<DeleteAccountScreen />);
    const u = user();
    await u.type(screen.getByTestId('delete-password'), 'faux');
    await u.press(screen.getByTestId('delete-confirm'));
    expect(await screen.findByText('Mot de passe incorrect.')).toBeOnTheScreen();
    expect(probe.auth()).toBe('signedIn');
  });

  it('compte social : le serveur exige un jeton fournisseur (422) -> explication et support', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'DELETE /me': [422, { error: { code: 'validation_failed', message: 'x', fields: { provider: ['requis'], id_token: ['requis'] } } }],
    });
    await renderShell(<DeleteAccountScreen />);
    const u = user();
    await u.type(screen.getByTestId('delete-password'), 'x');
    await u.press(screen.getByTestId('delete-confirm'));
    expect(await screen.findByTestId('delete-banner')).toHaveTextContent(/Google ou Apple/);
  });
});

describe('S67 Export des données', () => {
  it('demande puis suit l\'export jusqu\'au lien de téléchargement', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    try {
      const fake = installFakeApi({
        'GET /me': [200, ME],
        'POST /me/export': [202, { id: 'e1', status: 'pending' }],
        'GET /me/export/e1': [200, { id: 'e1', status: 'ready', url: 'https://files.example.test/e1.zip', expires_at: '2026-12-01T00:00:00Z' }],
      });
      await renderShell(<ExportScreen />);
      await act(async () => {
        fireEvent.changeText(screen.getByTestId('export-password'), 'Motdepasse123');
      });
      await act(async () => {
        await fireEvent.press(screen.getByTestId('export-request'));
      });
      expect(await screen.findByTestId('export-pending')).toBeOnTheScreen();
      expect(fake.called('POST /me/export')[0]?.body).toEqual({ password: 'Motdepasse123' });
      await act(async () => {
        jest.advanceTimersByTime(EXPORT_POLL_MS + 100);
      });
      expect(await screen.findByTestId('export-ready')).toBeOnTheScreen();
      expect(fake.called('GET /me/export/e1')).toHaveLength(1);
      await act(async () => {
        await fireEvent.press(screen.getByTestId('export-download'));
      });
      expect(openURL).toHaveBeenCalledWith('https://files.example.test/e1.zip');
    } finally {
      jest.useRealTimers();
    }
  });

  it('une demande par jour : 429 quota_reached affiche la limite', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'POST /me/export': [429, { error: { code: 'quota_reached', message: 'x' } }] });
    await renderShell(<ExportScreen />);
    const u = user();
    await u.type(screen.getByTestId('export-password'), 'Motdepasse123');
    await u.press(screen.getByTestId('export-request'));
    expect(await screen.findByTestId('export-banner')).toHaveTextContent(/Limite atteinte/);
  });

  it('exige le mot de passe avant tout appel', async () => {
    const fake = installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ExportScreen />);
    await user().press(screen.getByTestId('export-request'));
    expect(screen.getByText('Saisissez votre mot de passe.')).toBeOnTheScreen();
    expect(fake.called('POST /me/export')).toHaveLength(0);
  });

  it('mot de passe incorrect (403) : message sur le champ, aucun export affiché', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'POST /me/export': [403, { error: { code: 'invalid_credentials', message: 'Mot de passe incorrect.' } }],
    });
    await renderShell(<ExportScreen />);
    const u = user();
    await u.type(screen.getByTestId('export-password'), 'faux');
    await u.press(screen.getByTestId('export-request'));
    expect(await screen.findByText('Mot de passe incorrect.')).toBeOnTheScreen();
    expect(screen.queryByTestId('export-pending')).not.toBeOnTheScreen();
  });

  it('compte social (422 provider / id_token) : explication et support', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'POST /me/export': [422, { error: { code: 'validation_failed', message: 'x', fields: { provider: ['requis'], id_token: ['requis'] } } }],
    });
    await renderShell(<ExportScreen />);
    const u = user();
    await u.type(screen.getByTestId('export-password'), 'x');
    await u.press(screen.getByTestId('export-request'));
    expect(await screen.findByTestId('export-banner')).toHaveTextContent(/Google ou Apple/);
  });
});

describe('S56 Support', () => {
  it('valide les champs puis crée la demande et la liste', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /support/tickets': [200, { data: [] }],
      'POST /support/tickets': [201, { id: 't1', status: 'open' }],
    });
    await renderShell(<SupportScreen />);
    const u = user();
    await screen.findByText('Aucune demande pour le moment.');
    await u.press(screen.getByTestId('support-send'));
    expect(screen.getByText('Entre 3 et 120 caractères.')).toBeOnTheScreen();
    expect(fake.called('POST /support/tickets')).toHaveLength(0);

    await u.type(screen.getByTestId('support-subject'), 'Problème de photo');
    await u.type(screen.getByTestId('support-body'), 'Ma photo est refusée sans raison.');
    fake.set('GET /support/tickets', [200, { data: [{ id: 't1', subject: 'Problème de photo', status: 'open', created_at: '2026-11-06T10:00:00Z' }] }]);
    await u.press(screen.getByTestId('support-send'));
    await waitFor(() => expect(fake.called('POST /support/tickets')).toHaveLength(1));
    expect(fake.called('POST /support/tickets')[0]?.body).toEqual({ subject: 'Problème de photo', body: 'Ma photo est refusée sans raison.' });
    expect(await screen.findByText(/Ouverte/)).toBeOnTheScreen();
  });

  it('quota (5 par jour) : message de limite', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /support/tickets': [200, { data: [] }],
      'POST /support/tickets': [429, { error: { code: 'quota_reached', message: 'x' } }],
    });
    await renderShell(<SupportScreen />);
    const u = user();
    await u.type(screen.getByTestId('support-subject'), 'Sujet');
    await u.type(screen.getByTestId('support-body'), 'Message assez long');
    await u.press(screen.getByTestId('support-send'));
    expect(await screen.findByTestId('support-banner')).toHaveTextContent(/Limite atteinte/);
  });
});

describe('S57 Mentions légales', () => {
  it('liens lus dans les variables d\'environnement (jamais codés en dur)', () => {
    expect(getLegalLinks({})).toEqual({ terms: null, privacy: null, community: null, supportEmail: null });
    expect(
      getLegalLinks({
        EXPO_PUBLIC_TERMS_URL: 'https://example.test/cgu',
        EXPO_PUBLIC_PRIVACY_URL: 'javascript:alert(1)',
        EXPO_PUBLIC_COMMUNITY_RULES_URL: ' https://example.test/regles ',
        EXPO_PUBLIC_SUPPORT_EMAIL: 'aide@example.test',
      }),
    ).toEqual({
      terms: 'https://example.test/cgu',
      privacy: null,
      community: 'https://example.test/regles',
      supportEmail: 'aide@example.test',
    });
  });

  it('lien configuré : ouvert ; lien non configuré : repli dans l’application (jamais un lien mort)', async () => {
    process.env.EXPO_PUBLIC_TERMS_URL = 'https://example.test/cgu';
    delete process.env.EXPO_PUBLIC_PRIVACY_URL;
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<LegalScreen />);
    await user().press(screen.getByTestId('legal-terms'));
    expect(openURL).toHaveBeenCalledWith('https://example.test/cgu');
    await user().press(screen.getByTestId('legal-privacy'));
    expect(router.push).toHaveBeenCalledWith('/legal/privacy');
    delete process.env.EXPO_PUBLIC_TERMS_URL;
    openURL.mockRestore();
  });

  it('hors développement : ni « lien non configuré » ni note de brouillon', async () => {
    const globals = globalThis as unknown as { __DEV__: boolean };
    const previous = globals.__DEV__;
    globals.__DEV__ = false;
    try {
      delete process.env.EXPO_PUBLIC_TERMS_URL;
      installFakeApi({ 'GET /me': [200, ME] });
      await renderShell(<LegalScreen />);
      expect(screen.queryByText(/non configuré/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/validés par un juriste/)).not.toBeOnTheScreen();
    } finally {
      globals.__DEV__ = previous;
    }
  });

  it('écran de repli : titre du document, explication claire et contact support', async () => {
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL = 'aide@example.test';
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    mockParams.current = { doc: 'privacy' };
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<LegalFallbackScreen />);
    expect(screen.getByText('Politique de confidentialité')).toBeOnTheScreen();
    expect(screen.getByTestId('legal-fallback-body')).toHaveTextContent(/n’est pas encore accessible/);
    await user().press(screen.getByTestId('legal-fallback-contact'));
    expect(openURL).toHaveBeenCalledWith(expect.stringMatching(/^mailto:aide@example\.test/));
    delete process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
    openURL.mockRestore();
  });
});

describe('Consentements', () => {
  const consents = { data: { marketing: { granted: false, version: '1', since: 'x' }, sensitive_data: { granted: true, version: '1', since: 'x' } } };

  it('accorder un consentement : POST /me/consents', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /me/consents': [200, consents],
      'POST /me/consents': emptyBody(),
    });
    await renderShell(<ConsentSettingsScreen />);
    await screen.findByTestId('consent-marketing');
    await toggle('consent-marketing', true);
    await waitFor(() => expect(fake.called('POST /me/consents')).toHaveLength(1));
    expect(fake.called('POST /me/consents')[0]?.body).toEqual({ kind: 'marketing', granted: true });
  });

  it('retirer les données sensibles demande une confirmation (le profil sera masqué)', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /me/consents': [200, consents],
      'POST /me/consents': emptyBody(),
    });
    await renderShell(<ConsentSettingsScreen />);
    await screen.findByTestId('consent-sensitive_data');
    await toggle('consent-sensitive_data', false);
    expect(fake.called('POST /me/consents')).toHaveLength(0);
    expect(screen.getByTestId('consent-revoke-confirm')).toBeOnTheScreen();
    await user().press(screen.getByTestId('consent-revoke-yes'));
    await waitFor(() => expect(fake.called('POST /me/consents')).toHaveLength(1));
    expect(fake.called('POST /me/consents')[0]?.body).toEqual({ kind: 'sensitive_data', granted: false });
  });
});

describe('S65 / S66 Sanctions et contestation', () => {
  const sanctions = {
    data: [
      { id: 'sa1', kind: 'suspension', reason: 'Signalements répétés', starts_at: '2026-11-01T00:00:00Z', ends_at: '2026-11-15T00:00:00Z', appeal_status: null },
      { id: 'sa2', kind: 'warning', reason: 'Langage inapproprié', starts_at: '2026-10-01T00:00:00Z', ends_at: null, appeal_status: 'open' },
    ],
  };

  it('affiche les sanctions, le statut de contestation et ouvre S66', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /me/sanctions': [200, sanctions] });
    await renderShell(<SanctionsScreen />);
    expect(await screen.findByText('Suspension')).toBeOnTheScreen();
    expect(screen.getByText('Motif : Signalements répétés')).toBeOnTheScreen();
    expect(screen.getByTestId('sanction-appeal-status-sa2')).toHaveTextContent('Contestation en cours d’examen');
    expect(screen.queryByTestId('sanction-appeal-sa2')).not.toBeOnTheScreen();
    await user().press(screen.getByTestId('sanction-appeal-sa1'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/appeal', params: { sanctionId: 'sa1' } });
  });

  it('aucune sanction : état vide', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /me/sanctions': [200, { data: [] }] });
    await renderShell(<SanctionsScreen />);
    expect(await screen.findByText('Aucune sanction sur votre compte.')).toBeOnTheScreen();
  });

  it('contestation : 10 caractères minimum, POST /appeals, une seule par sanction (409)', async () => {
    mockParams.current = { sanctionId: 'sa1' };
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'POST /appeals': [409, { error: { code: 'already_appealed', message: 'x' } }],
    });
    await renderShell(<AppealScreen />);
    const u = user();
    await u.type(screen.getByTestId('appeal-message'), 'court');
    await u.press(screen.getByTestId('appeal-send'));
    expect(screen.getByText('Entre 10 et 2 000 caractères.')).toBeOnTheScreen();
    expect(fake.called('POST /appeals')).toHaveLength(0);

    await u.type(screen.getByTestId('appeal-message'), ' et maintenant un message assez long');
    await u.press(screen.getByTestId('appeal-send'));
    expect(await screen.findByText('Cette sanction a déjà été contestée.')).toBeOnTheScreen();
    expect(fake.called('POST /appeals')[0]?.body).toEqual({ sanction_id: 'sa1', message: 'court et maintenant un message assez long' });

    fake.set('POST /appeals', [201, { id: 'ap1', status: 'open' }]);
    await u.press(screen.getByTestId('appeal-send'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });
});

describe('S59 / S60 Mon profil', () => {
  it('aperçu, crédits, Premium et alerte e-mail non confirmé avec renvoi du lien', async () => {
    const fake = installFakeApi({
      'GET /me': [200, meFixture({ email_verified: false, premium: true, credits: { conversation: 2, proposal: 0, coin: 0 } })],
      'POST /auth/email/resend': emptyBody(),
    });
    await renderShell(<ProfileTabScreen />);
    expect(await screen.findByTestId('profile-name')).toHaveTextContent('Moi, 28 ans');
    expect(screen.getByTestId('profile-premium-badge')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-credits')).toHaveTextContent('Crédits « Conversation » : 2');
    expect(screen.getByTestId('profile-email-banner')).toBeOnTheScreen();
    await user().press(screen.getByTestId('profile-resend'));
    await waitFor(() => expect(fake.called('POST /auth/email/resend')).toHaveLength(1));
    await user().press(screen.getByTestId('profile-edit'));
    expect(router.push).toHaveBeenCalledWith('/profile-edit');
  });

  it('profil sans photo approuvée : avis de visibilité', async () => {
    installFakeApi({ 'GET /me': [200, meFixture({ profile: selfProfile({ media: [media('p', 0, 'processing')] }) })] });
    await renderShell(<ProfileTabScreen />);
    expect(await screen.findByTestId('profile-not-visible')).toBeOnTheScreen();
  });

  it('édition : seuls les champs modifiés sont envoyés (PUT /me/profile)', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'PUT /me/profile': [200, meFixture({ profile: selfProfile({ bio: 'Nouvelle bio' }) })],
    });
    await renderShell(<ProfileEditScreen />);
    const u = user();
    const bio = await screen.findByTestId('edit-bio');
    await u.clear(bio);
    await u.type(bio, 'Nouvelle bio');
    await u.press(screen.getByTestId('edit-save'));
    await waitFor(() => expect(fake.called('PUT /me/profile')).toHaveLength(1));
    expect(fake.called('PUT /me/profile')[0]?.body).toEqual({ bio: 'Nouvelle bio' });
  });

  it('pays de résidence : limite d\'un changement par semaine (422) expliquée', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'PUT /me/profile': [422, { error: { code: 'validation_failed', message: 'x', fields: { residence_country: ['limite'] } } }],
    });
    await renderShell(<ProfileEditScreen />);
    const u = user();
    await screen.findByTestId('edit-bio');
    await u.press(screen.getByTestId('edit-residence-BE'));
    await u.press(screen.getByTestId('edit-save'));
    expect(await screen.findByText('Le pays de résidence ne peut être modifié qu’une fois par semaine.')).toBeOnTheScreen();
  });

  it('bio de plus de 500 caractères refusée avant l\'envoi', async () => {
    const fake = installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ProfileEditScreen />);
    const bio = await screen.findByTestId('edit-bio');
    await fireEvent.changeText(bio, 'a'.repeat(501));
    await user().press(screen.getByTestId('edit-save'));
    expect(screen.getByText('500 caractères au maximum.', { exact: true, hidden: false })).toBeOnTheScreen();
    expect(fake.called('PUT /me/profile')).toHaveLength(0);
  });
});
