import * as Notifications from 'expo-notifications';
import { router, Slot } from 'expo-router';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import React from 'react';
import { Text } from 'react-native';
import { PushReception } from '../src/push/PushReception';

/**
 * Vérification avec le VRAI routeur d'expo-router (pas le simulacre de `routerMock`) : `usePathname` et le navigateur racine
 * lus depuis la mise en page racine, navigation réelle vers `/conversation/{id}`, détection de la conversation ouverte.
 * Seuls `expo-notifications` (module natif) et la session sont simulés.
 */

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
}));

const mockAuth = jest.fn();
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => mockAuth() }));

const N = Notifications as jest.Mocked<typeof Notifications>;
const CONV = '3f9c2a10-7b1e-4c55-9d2a-0a1b2c3d4e5f';
const OTHER = '8d7e6f50-1a2b-4c3d-8e9f-a0b1c2d3e4f5';

const signedIn = { state: { status: 'signedIn', user: null, onboardingPending: false } };
const message = (id: string) => ({ type: 'message', conversation_id: id });
const response = (data: unknown, identifier = 'n-1') => ({ notification: { request: { identifier, content: { data } } }, actionIdentifier: 'default' });

/** Arborescence de test : la mise en page racine monte la réception des push comme `app/_layout.tsx`. */
function routes() {
  const Conversation = () => <Text>Écran conversation</Text>;
  const Home = () => <Text>Écran découvrir</Text>;
  const Root = () => (
    <>
      <PushReception />
      <Slot />
    </>
  );
  return { _layout: Root, index: Home, 'conversation/[id]': Conversation };
}

type Behavior = { shouldShowBanner: boolean; shouldShowList: boolean; shouldPlaySound: boolean; shouldSetBadge: boolean };
function foreground(data: unknown): Promise<Behavior> {
  const handler = N.setNotificationHandler.mock.calls.at(-1)![0]!;
  return handler.handleNotification({ request: { identifier: 'f', content: { data } } } as never) as Promise<Behavior>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue(signedIn);
  N.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() } as never);
  N.getLastNotificationResponse.mockReturnValue(null);
});

describe('réception des push avec le vrai routeur', () => {
  it('démarrage à froid : le toucher ouvre la conversation, sans erreur de navigation', async () => {
    N.getLastNotificationResponse.mockReturnValue(response(message(CONV), 'cold') as never);
    await renderRouter(routes(), { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname(`/conversation/${CONV}`));
    expect(screen.getByText('Écran conversation')).toBeOnTheScreen();
  });

  it('application ouverte : un toucher ouvre la conversation', async () => {
    await renderRouter(routes(), { initialUrl: '/' });
    expect(screen).toHavePathname('/');
    const listener = N.addNotificationResponseReceivedListener.mock.calls.at(-1)![0] as (r: unknown) => void;
    await act(async () => listener(response(message(CONV))));
    await waitFor(() => expect(screen).toHavePathname(`/conversation/${CONV}`));
  });

  it('un identifiant piégé n’ouvre rien : on reste sur l’écran courant', async () => {
    await renderRouter(routes(), { initialUrl: '/' });
    const listener = N.addNotificationResponseReceivedListener.mock.calls.at(-1)![0] as (r: unknown) => void;
    await act(async () => listener(response(message('../../settings/delete'), 'bad-1')));
    await act(async () => listener(response(message(`${CONV}?redirect=/settings`), 'bad-2')));
    expect(screen).toHavePathname('/');
  });

  it('premier plan : la bannière est masquée pour la conversation affichée (pathname lu depuis la mise en page racine)', async () => {
    await renderRouter(routes(), { initialUrl: `/conversation/${CONV}` });
    await waitFor(() => expect(screen).toHavePathname(`/conversation/${CONV}`));
    await waitFor(async () => expect((await foreground(message(CONV))).shouldShowBanner).toBe(false));
    expect((await foreground(message(OTHER))).shouldShowBanner).toBe(true);
  });

  it('premier plan : après avoir quitté la conversation, la bannière revient', async () => {
    await renderRouter(routes(), { initialUrl: `/conversation/${CONV}` });
    await waitFor(async () => expect((await foreground(message(CONV))).shouldShowBanner).toBe(false));
    await act(async () => router.replace('/'));
    await waitFor(() => expect(screen).toHavePathname('/'));
    await waitFor(async () => expect((await foreground(message(CONV))).shouldShowBanner).toBe(true));
  });

  it('un toucher sur la conversation déjà affichée n’empile pas un second écran', async () => {
    await renderRouter(routes(), { initialUrl: `/conversation/${CONV}` });
    await waitFor(() => expect(screen).toHavePathname(`/conversation/${CONV}`));
    const before = router.canGoBack();
    const listener = N.addNotificationResponseReceivedListener.mock.calls.at(-1)![0] as (r: unknown) => void;
    await act(async () => listener(response(message(CONV))));
    expect(screen).toHavePathname(`/conversation/${CONV}`);
    expect(router.canGoBack()).toBe(before);
  });

  it('déconnecté : le toucher ne navigue pas', async () => {
    mockAuth.mockReturnValue({ state: { status: 'signedOut', user: null, onboardingPending: false } });
    N.getLastNotificationResponse.mockReturnValue(response(message(CONV), 'cold') as never);
    await renderRouter(routes(), { initialUrl: '/' });
    expect(screen).toHavePathname('/');
  });
});
