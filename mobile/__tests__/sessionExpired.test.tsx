import { screen, userEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { Text } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';
import { setSessionNotice } from '../src/auth/sessionNotice';
import { WelcomeScreen } from '../src/features/welcome/WelcomeScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { Button } from '../src/ui';
import { jsonResponse, probe, renderApp } from './helpers/app';
import { resetRouterMocks } from './helpers/routerMock';

jest.mock('expo-router', () => require('./helpers/routerMock').expoRouterMock);

// BUG-001 (replica/bugs.md) : une session révoquée ou expirée ramenait à l'accueil sans aucune explication.

const fetchMock = jest.fn();
const ME = { id: 'u1', email: 'moi@example.test', locale: 'fr' };
const MESSAGE = 'Votre session a expiré. Reconnectez-vous.';

function Probe() {
  const { state, signOut } = useAuth();
  return (
    <>
      {state.user ? <Text testID="user">{state.user.email}</Text> : null}
      <Button testID="logout" label="Quitter" onPress={() => void signOut()} />
      <WelcomeScreen />
    </>
  );
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  setSessionNotice(false);
});

async function seedToken(token = 'STORED') {
  await SecureStore.setItemAsync('ayelo.auth_token', token);
}

describe('session expirée : l\'utilisateur est prévenu', () => {
  it('jeton révoqué au lancement (401 sur /me) : l\'accueil affiche « Votre session a expiré. Reconnectez-vous. »', async () => {
    await seedToken('REVOKED');
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { code: 'unauthenticated', message: 'Non authentifié.' } }));
    await renderApp(<Probe />);
    await waitFor(() => expect(probe.auth()).toBe('signedOut'));
    expect(await screen.findByText(MESSAGE)).toBeOnTheScreen();
    expect(screen.getByTestId('welcome-session-notice')).toBeOnTheScreen();
  });

  it('le message se ferme', async () => {
    setSessionNotice(true);
    await renderApp(<WelcomeScreen />);
    expect(await screen.findByText(MESSAGE)).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Fermer le message' }));
    expect(screen.queryByText(MESSAGE)).not.toBeOnTheScreen();
  });

  it('une déconnexion voulue n\'affiche pas ce message', async () => {
    await seedToken();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, ME)).mockResolvedValueOnce(jsonResponse(204, undefined));
    await renderApp(<Probe />);
    await waitFor(() => expect(probe.auth()).toBe('signedIn'));
    await userEvent.setup().press(screen.getByTestId('logout'));
    await waitFor(() => expect(probe.auth()).toBe('signedOut'));
    expect(screen.queryByText(MESSAGE)).not.toBeOnTheScreen();
  });

  it('sans session au lancement (aucun jeton) : pas de message', async () => {
    await renderApp(<WelcomeScreen />);
    await waitFor(() => expect(probe.auth()).toBe('signedOut'));
    expect(screen.queryByText(MESSAGE)).not.toBeOnTheScreen();
  });
});
