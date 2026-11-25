import { screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { AuthFormScreen } from '../src/features/auth/AuthFormScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { jsonResponse, probe, renderApp } from './helpers/app';
import { resetRouterMocks } from './helpers/routerMock';

jest.mock('expo-router', () => require('./helpers/routerMock').expoRouterMock);

/**
 * Suppression de compte en cours : la connexion aux bons identifiants répond 403 `deletion_pending` (avec `purge_at`) sans jeton.
 * L'application l'explique, propose « Annuler la suppression » et renvoie la même connexion avec `cancel_deletion: true`.
 * L'annulation n'a jamais lieu sans que la personne l'ait demandée.
 */

const user = () => userEvent.setup();
const fetchMock = jest.fn();

const pending = () =>
  jsonResponse(403, { error: { code: 'deletion_pending', message: 'Suppression du compte en cours.', purge_at: '2026-12-22T12:00:00+00:00' } });
const session = () => jsonResponse(200, { token: 'SANCTUM', user: { id: 'u1', email: 'a@b.fr', locale: 'fr' } });

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
});

function request(call: number) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return { url, body: init.body ? JSON.parse(init.body as string) : undefined };
}

async function signIn(locale: 'fr' | 'en' = 'fr') {
  await renderApp(<AuthFormScreen mode="login" />, undefined, locale);
  const u = user();
  await u.type(screen.getByTestId('auth-email'), 'a@b.fr');
  await u.type(screen.getByTestId('auth-password'), 'Motdepasse2026');
  await u.press(screen.getByTestId('auth-submit'));
  return u;
}

describe('Connexion d’un compte en cours de suppression', () => {
  it('explique la suppression et sa date, propose de l’annuler, sans session ni annulation d’office', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    await signIn();

    expect(await screen.findByTestId('auth-deletion-pending')).toHaveTextContent(/22 décembre 2026/);
    expect(screen.getByRole('button', { name: 'Annuler la suppression' })).toBeOnTheScreen();
    expect(probe.auth()).toBe('signedOut');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(request(0).body.cancel_deletion).toBeUndefined();
  });

  it('« Annuler la suppression » renvoie la connexion avec cancel_deletion, ouvre la session et le dit', async () => {
    fetchMock.mockResolvedValueOnce(pending()).mockResolvedValueOnce(session());
    const u = await signIn();
    await u.press(await screen.findByRole('button', { name: 'Annuler la suppression' }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(request(1)).toMatchObject({ url: 'https://api.example.test/api/v1/auth/login', body: { email: 'a@b.fr', password: 'Motdepasse2026', cancel_deletion: true } });
    expect(probe.auth()).toBe('signedIn');
    expect(
      await screen.findByText('Suppression annulée. Votre profil reste masqué : réactivez « Profil visible dans Découvrir » dans Confidentialité.'),
    ).toBeOnTheScreen();
  });

  it('une annulation refusée (délai écoulé) affiche l’erreur ordinaire, sans session', async () => {
    fetchMock
      .mockResolvedValueOnce(pending())
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: 'account_restricted', message: 'Compte indisponible.' } }));
    const u = await signIn();
    await u.press(await screen.findByRole('button', { name: 'Annuler la suppression' }));

    expect(await screen.findByText("Ce compte n'est pas disponible.")).toBeOnTheScreen();
    expect(probe.auth()).toBe('signedOut');
  });

  it('modifier l’adresse efface la proposition d’annulation (elle ne vaut que pour ces identifiants)', async () => {
    fetchMock.mockResolvedValueOnce(pending());
    const u = await signIn();
    await screen.findByTestId('auth-deletion-pending');
    await u.type(screen.getByTestId('auth-email'), 'x');

    expect(screen.queryByTestId('auth-deletion-pending')).toBeNull();
  });

  it('même parcours en anglais', async () => {
    fetchMock.mockResolvedValueOnce(pending()).mockResolvedValueOnce(session());
    const u = await signIn('en');

    expect(await screen.findByTestId('auth-deletion-pending')).toHaveTextContent(/December 22, 2026/);
    await u.press(screen.getByRole('button', { name: 'Cancel the deletion' }));
    expect(
      await screen.findByText('Deletion cancelled. Your profile stays hidden: turn “Profile visible in Discover” back on in Privacy.'),
    ).toBeOnTheScreen();
  });
});
