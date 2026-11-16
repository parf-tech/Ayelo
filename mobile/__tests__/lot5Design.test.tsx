import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { AuthFormScreen } from '../src/features/auth/AuthFormScreen';
import { ForgotPasswordScreen } from '../src/features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../src/features/auth/ResetPasswordScreen';
import { VerifyEmailScreen } from '../src/features/emailVerification/VerifyEmailScreen';
import { IntentScreen } from '../src/features/onboarding/IntentScreen';
import { dictionaries } from '../src/i18n';
import { renderApp } from './helpers/app';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { redirects, resetRouterMocks } from './helpers/routerMock';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: jest.fn(() => ({})),
}));

const user = () => userEvent.setup();
const g = globalThis as unknown as { __DEV__: boolean };

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  resetRouterMocks();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => undefined);
});

describe('Lot 5 : mot de passe oublié', () => {
  it('le clavier envoie la demande (touche « OK ») et le champ est typé adresse e-mail', async () => {
    const fake = installFakeApi({ 'POST /auth/password/forgot': emptyBody() });
    await renderApp(<ForgotPasswordScreen />);
    const field = screen.getByTestId('forgot-email');
    expect(field.props.textContentType).toBe('emailAddress');
    expect(field.props.returnKeyType).toBe('go');
    await user().type(field, 'awa@example.test', { submitEditing: true });
    expect(await screen.findByTestId('forgot-sent')).toBeOnTheScreen();
    expect(fake.called('POST /auth/password/forgot')).toHaveLength(1);
  });

  it('après l’envoi, « Renvoyer ou changer d’adresse » ramène le champ', async () => {
    installFakeApi({ 'POST /auth/password/forgot': emptyBody() });
    await renderApp(<ForgotPasswordScreen />);
    const u = user();
    await u.type(screen.getByTestId('forgot-email'), 'awa@example.test');
    await u.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-sent')).toBeOnTheScreen();
    expect(screen.queryByTestId('forgot-email')).toBeNull();
    await u.press(screen.getByTestId('forgot-retry'));
    expect(screen.getByTestId('forgot-email')).toBeOnTheScreen();
    expect(screen.queryByTestId('forgot-sent')).toBeNull();
  });
});

describe('Lot 5 : nouveau mot de passe', () => {
  it('mot de passe refusé par le serveur : message sous le champ, pas de bandeau qui le répète', async () => {
    installFakeApi({
      'POST /auth/password/reset': [422, { error: { code: 'validation_failed', message: 'x', fields: { password: ['weak'] } } }],
    });
    await renderApp(<ResetPasswordScreen />);
    const u = user();
    await u.type(screen.getByTestId('reset-token'), 'jeton-recu');
    await u.type(screen.getByTestId('reset-password'), 'Motdepasse2026');
    await u.type(screen.getByTestId('reset-confirm'), 'Motdepasse2026');
    await u.press(screen.getByTestId('reset-submit'));
    expect(await screen.findByText(dictionaries.fr['validation.password.weak'])).toBeOnTheScreen();
    expect(screen.queryByTestId('reset-banner')).toBeNull();
  });
});

describe('Lot 5 : connexion hors ligne', () => {
  it('erreur réseau : le bandeau propose « Réessayer » et relance la connexion', async () => {
    let attempts = 0;
    installFakeApi({
      'POST /auth/login': (() => {
        attempts += 1;
        throw new TypeError('Network request failed');
      }) as never,
    });
    await renderApp(<AuthFormScreen mode="login" />);
    const u = user();
    await u.type(screen.getByTestId('auth-email'), 'awa@example.test');
    await u.type(screen.getByTestId('auth-password'), 'Motdepasse2026');
    await u.press(screen.getByTestId('auth-submit'));
    const banner = await screen.findByTestId('auth-banner');
    const retry = within(banner).getByRole('button', { name: dictionaries.fr['common.retry'] });
    expect(attempts).toBe(1);
    await u.press(retry);
    await waitFor(() => expect(attempts).toBe(2));
  });
});

describe('Lot 5 : vérification de l’e-mail', () => {
  it('« J’ai confirmé » est dans le pied de page, avec « Continuer plus tard »', async () => {
    installFakeApi({});
    await renderApp(<VerifyEmailScreen />);
    const footer = screen.getByTestId('screen-verify-email-footer');
    expect(within(footer).getByTestId('verify-check')).toBeOnTheScreen();
    expect(within(footer).getByTestId('verify-skip')).toBeOnTheScreen();
  });

  it('pendant le décompte, le libellé accessible de « Renvoyer » reste stable (le décompte est un complément)', async () => {
    installFakeApi({ 'POST /auth/email/resend': emptyBody() });
    await renderApp(<VerifyEmailScreen />);
    await user().press(screen.getByTestId('verify-resend'));
    const resend = await screen.findByTestId('verify-resend');
    await waitFor(() => expect(resend).toBeDisabled());
    expect(resend.props.accessibilityLabel).toBe(dictionaries.fr['verifyEmail.resend']);
    expect(resend.props.accessibilityHint).toMatch(/\d+ s/);
  });
});

describe('Lot 5 : intention', () => {
  it('continuer sans choix : une bannière d’erreur au-dessus de la liste', async () => {
    installFakeApi({ 'GET /me': [200, meFixture()] });
    await renderApp(<IntentScreen />);
    await user().press(screen.getByTestId('intent-submit'));
    const banner = await screen.findByTestId('intent-error');
    expect(banner).toHaveTextContent(dictionaries.fr['validation.intent']);
  });
});

describe('Lot 5 : démonstration des composants', () => {
  it('en production la route renvoie à l’accueil', async () => {
    const previous = g.__DEV__;
    g.__DEV__ = false;
    try {
      const Route = require('../app/(public)/components-demo').default as React.ComponentType;
      redirects.length = 0;
      const { render } = require('@testing-library/react-native') as typeof import('@testing-library/react-native');
      await render(<Route />);
      expect(redirects).toContain('/');
    } finally {
      g.__DEV__ = previous;
    }
  });
});

describe('Lot 5 : catalogues', () => {
  it('les clés mortes retirées n’existent plus ni en français ni en anglais', () => {
    for (const key of ['welcome.title', 'welcome.signIn', 'welcome.createAccount', 'home.title', 'call.mute', 'month.1', 'month.12', 'premium.subtitle', 'ui.password.showShort'] as const) {
      expect(Object.keys(dictionaries.fr)).not.toContain(key);
      expect(Object.keys(dictionaries.en)).not.toContain(key);
    }
  });

  it('les nouvelles clés existent dans les deux langues', () => {
    for (const key of ['forgot.retry', 'delete.notice', 'profile.country.more', 'photos.permissionDenied.action', 'prefs.verifiedOnly.hintOptional'] as const) {
      expect(dictionaries.fr[key]).toBeTruthy();
      expect(dictionaries.en[key]).toBeTruthy();
    }
  });
});
