import { act, screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { VerifyEmailLinkScreen } from '../src/features/emailVerification/VerifyEmailLinkScreen';
import { DeleteAccountScreen } from '../src/features/settings/DeleteAccountScreen';
import { SanctionsScreen } from '../src/features/settings/SanctionsScreen';
import { VerificationStatusScreen } from '../src/features/verification/VerificationStatusScreen';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { colors } from '../src/theme';
import { installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { flatStyle as flat } from './helpers/render';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: jest.fn(() => ({})),
}));

const ME = meFixture();
const user = () => userEvent.setup();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  resetRouterMocks();
});

afterEach(async () => {
  await act(async () => undefined);
});

describe('Compte et sécurité : textes d’aide sans point final', () => {
  // Sous-titres et aides d'un écran : une phrase, sans point final (les messages d'état et d'erreur gardent le leur).
  const SUBTITLES = [
    'forgot.subtitle',
    'reset.subtitle',
    'verifyEmail.body',
    'verifyEmail.bodyNoEmail',
    'export.body',
    'export.passwordHelp',
    'delete.passwordHelp',
    'appeal.subtitle',
    'legal.notConfigured',
  ] as const;

  it.each(SUBTITLES)('%s : aucun point final en français ni en anglais', (key) => {
    expect(fr[key].trim().endsWith('.')).toBe(false);
    expect(en[key].trim().endsWith('.')).toBe(false);
  });

  it('chaque sous-titre reste une seule phrase (pas de point au milieu)', () => {
    for (const key of SUBTITLES) {
      expect(fr[key]).not.toMatch(/\.\s+\p{Lu}/u);
      expect(en[key]).not.toMatch(/\.\s+[A-Z]/);
    }
  });

  it('les paramètres des textes modifiés sont conservés (adresse e-mail)', () => {
    expect(fr['verifyEmail.body']).toContain('{email}');
    expect(en['verifyEmail.body']).toContain('{email}');
  });
});

describe('Suppression du compte', () => {
  it('l’abonnement est rappelé sur une carte calme (fond surface, sans filet), avant le champ de mot de passe', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<DeleteAccountScreen />);
    const card = flat(screen.getByTestId('delete-subscription').props.style);
    expect(card.backgroundColor).toBe(colors.light.surface);
    expect(card.borderWidth).toBeUndefined();
    expect(screen.getByTestId('delete-password')).toBeOnTheScreen();
    expect(screen.getByTestId('delete-confirm')).toHaveProp('accessibilityLabel', 'Supprimer mon compte');
  });
});

describe('Sanctions', () => {
  const sanctions = {
    data: [
      { id: 'sa1', kind: 'suspension', reason: 'Signalements répétés', starts_at: '2026-11-01T00:00:00Z', ends_at: '2026-11-15T00:00:00Z', appeal_status: null },
      { id: 'sa2', kind: 'warning', reason: 'Langage inapproprié', starts_at: '2026-10-01T00:00:00Z', ends_at: null, appeal_status: 'accepted' },
    ],
  };

  it('chaque sanction est une carte surface sans filet ; le statut de contestation est écrit (icône décorative en plus)', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /me/sanctions': [200, sanctions] });
    await renderShell(<SanctionsScreen />);
    await screen.findByText('Suspension');
    const card = flat(screen.getByTestId('sanction-sa1').props.style);
    expect(card.backgroundColor).toBe(colors.light.surface);
    expect(card.borderWidth).toBeUndefined();
    expect(screen.getByTestId('sanction-appeal-status-sa2')).toHaveTextContent('Contestation acceptée');
    expect(screen.getByTestId('sanction-appeal-sa1')).toBeOnTheScreen();
  });

  it('le type de sanction est un titre pour les lecteurs d’écran', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /me/sanctions': [200, sanctions] });
    await renderShell(<SanctionsScreen />);
    expect(await screen.findByRole('header', { name: 'Suspension' })).toBeOnTheScreen();
  });
});

describe('Confirmation de l’e-mail par lien', () => {
  it('reprend l’en-tête de marque des écrans publics, sans bouton retour', async () => {
    installFakeApi({});
    await renderShell(<VerifyEmailLinkScreen />);
    expect(screen.getByTestId('auth-header')).toBeOnTheScreen();
    expect(screen.queryByTestId('back-button')).not.toBeOnTheScreen();
    await user().type(screen.getByTestId('verify-link-token'), 'abc');
    expect(screen.getByTestId('verify-link-submit')).toBeEnabled();
  });
});

describe('Suivi de la vérification', () => {
  it('médaillon décoratif : le statut reste écrit dans la bannière', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /me/verification': [200, { verification_status: 'pending', last_request: null }],
    } as never);
    await renderShell(<VerificationStatusScreen />);
    expect(await screen.findByTestId('verification-status-banner')).toHaveTextContent(/en cours d’examen/);
  });
});
