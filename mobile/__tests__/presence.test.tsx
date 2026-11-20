import { act, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { PresenceHeartbeat } from '../src/features/presence/PresenceHeartbeat';
import { MessagesListScreen } from '../src/features/messages/MessagesListScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { conversation, meFixture, publicProfile } from './helpers/fixtures';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({}),
}));

const ME = meFixture();
const pause = (ms: number) => act(async () => new Promise<void>((resolve) => setTimeout(resolve, ms)));

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

/** Remplace l'état de l'application et capte l'écouteur de changement d'état pour le déclencher à la main. */
function mockAppState(initial: AppStateStatus) {
  let listener: ((state: AppStateStatus) => void) | null = null;
  const remove = jest.fn();
  Object.defineProperty(AppState, 'currentState', { value: initial, configurable: true, writable: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
    listener = cb as (state: AppStateStatus) => void;
    return { remove };
  });
  return {
    remove,
    change: (state: AppStateStatus) => act(async () => listener?.(state)),
  };
}

describe('Battement de présence (POST /me/presence)', () => {
  it('bat dès l\'ouverture puis à chaque intervalle tant que l\'application est active', async () => {
    mockAppState('active');
    const fake = installFakeApi({ 'GET /me': [200, ME], 'POST /me/presence': emptyBody() });
    await renderShell(<PresenceHeartbeat intervalMs={30} />);

    await waitFor(() => expect(fake.called('POST /me/presence').length).toBeGreaterThanOrEqual(3));
  });

  it('ne bat pas en arrière-plan, reprend au retour au premier plan et s\'arrête au départ', async () => {
    const state = mockAppState('background');
    const fake = installFakeApi({ 'GET /me': [200, ME], 'POST /me/presence': emptyBody() });
    await renderShell(<PresenceHeartbeat intervalMs={30} />);

    await pause(120);
    expect(fake.called('POST /me/presence')).toHaveLength(0);

    await state.change('active');
    await waitFor(() => expect(fake.called('POST /me/presence').length).toBeGreaterThanOrEqual(2));

    await state.change('background');
    const frozen = fake.called('POST /me/presence').length;
    await pause(120);
    expect(fake.called('POST /me/presence')).toHaveLength(frozen);
  });

  it('un battement refusé (réseau, 500) ne casse rien et les suivants continuent', async () => {
    mockAppState('active');
    let n = 0;
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'POST /me/presence': () => {
        n += 1;
        return n === 1 ? [500, { error: { code: 'server_error', message: 'Erreur.' } }] : emptyBody();
      },
    });
    await renderShell(<PresenceHeartbeat intervalMs={30} />);

    await waitFor(() => expect(fake.called('POST /me/presence').length).toBeGreaterThanOrEqual(3));
  });

  it('libère l\'écouteur et le minuteur au démontage', async () => {
    const state = mockAppState('active');
    const fake = installFakeApi({ 'GET /me': [200, ME], 'POST /me/presence': emptyBody() });
    const view = await renderShell(<PresenceHeartbeat intervalMs={30} />);
    await waitFor(() => expect(fake.called('POST /me/presence').length).toBeGreaterThanOrEqual(1));

    await view.unmount();
    const frozen = fake.called('POST /me/presence').length;
    await pause(120);

    expect(state.remove).toHaveBeenCalled();
    expect(fake.called('POST /me/presence')).toHaveLength(frozen);
  });
});

describe('Liste des conversations : présence', () => {
  const convWith = (id: string, name: string, extra: Record<string, unknown>) => conversation(id, publicProfile(`u-${id}`, name, extra));

  it('montre un repère « en ligne » (lu par le lecteur d\'écran) seulement pour les interlocuteurs en ligne', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /conversations': [
        200,
        {
          data: [
            convWith('c1', 'Awa', { online: true }),
            convWith('c2', 'Binta', { online: false }),
            convWith('c3', 'Chloé', {}),
          ],
        },
      ],
    });
    await renderShell(<MessagesListScreen />, { conversations: true });

    expect(await screen.findByTestId('online-c1')).toBeOnTheScreen();
    expect(screen.queryByTestId('online-c2')).toBeNull();
    // Interlocuteur qui masque sa présence : le serveur n'envoie pas `online`, rien ne s'affiche.
    expect(screen.queryByTestId('online-c3')).toBeNull();

    expect(screen.getByTestId('conversation-c1').props.accessibilityLabel).toContain('En ligne.');
    expect(screen.getByTestId('conversation-c2').props.accessibilityLabel).not.toContain('En ligne.');
  });

  it('dit « online » en anglais', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /conversations': [200, { data: [convWith('c1', 'Awa', { online: true })] }],
    });
    await renderShell(<MessagesListScreen />, { conversations: true, locale: 'en' });

    expect((await screen.findByTestId('conversation-c1')).props.accessibilityLabel).toContain('Online.');
  });
});
