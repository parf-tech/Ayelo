import { screen, userEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { HomeScreen } from '../src/features/home/HomeScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { jsonResponse, probe, renderApp } from './helpers/app';

jest.mock('expo-router', () => require('./helpers/routerMock').expoRouterMock);

const fetchMock = jest.fn();
const ME = { id: 'u1', email: 'moi@example.test', locale: 'fr' };

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
});

async function seedToken(token = 'STORED') {
  await SecureStore.setItemAsync('ayelo.auth_token', token);
}

describe('restauration de la session au lancement', () => {
  it('sans jeton : visiteur, aucun appel réseau', async () => {
    await renderApp(<HomeScreen />);
    await waitFor(() => expect(probe.auth()).toBe('signedOut'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('jeton valide : GET /me avec Bearer puis connecté', async () => {
    await seedToken();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, ME));
    await renderApp(<HomeScreen />);
    await waitFor(() => expect(probe.auth()).toBe('signedIn'));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/v1/me');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer STORED');
    expect(headers['X-Device-Id']).toBeDefined();
    expect(await screen.findByText('Connecté en tant que moi@example.test')).toBeOnTheScreen();
  });

  it('jeton révoqué (401) : session effacée du stockage sécurisé', async () => {
    await seedToken('REVOKED');
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: { code: 'unauthenticated', message: 'Non authentifié.' } }),
    );
    await renderApp(<HomeScreen />);
    await waitFor(() => expect(probe.auth()).toBe('signedOut'));
    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ayelo.auth_token'));
  });

  it('réseau coupé au lancement : on garde la session (jeton conservé)', async () => {
    await seedToken();
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderApp(<HomeScreen />);
    await waitFor(() => expect(probe.auth()).toBe('signedIn'));
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('ayelo.auth_token');
  });
});

describe('déconnexion', () => {
  it('POST /auth/logout puis session locale effacée', async () => {
    await seedToken();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, ME)).mockResolvedValueOnce(jsonResponse(204, undefined));
    await renderApp(<HomeScreen />);
    await waitFor(() => expect(probe.auth()).toBe('signedIn'));

    await userEvent.setup().press(screen.getByTestId('home-logout'));
    await waitFor(() => expect(probe.auth()).toBe('signedOut'));

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/v1/auth/logout');
    expect(init.method).toBe('POST');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ayelo.auth_token');
  });

  it('même si le serveur est injoignable, la session locale est effacée', async () => {
    await seedToken();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ME))
      .mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderApp(<HomeScreen />);
    await waitFor(() => expect(probe.auth()).toBe('signedIn'));
    await userEvent.setup().press(screen.getByTestId('home-logout'));
    await waitFor(() => expect(probe.auth()).toBe('signedOut'));
  });
});
