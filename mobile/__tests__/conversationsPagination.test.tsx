import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { MessagesListScreen } from '../src/features/messages/MessagesListScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { installFakeApi } from './helpers/fakeApi';
import { conversation, meFixture, publicProfile } from './helpers/fixtures';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({}),
}));

const ME = meFixture();
const conv = (id: string, name: string) => conversation(id, publicProfile(`u-${id}`, name));

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
});

afterEach(async () => {
  await act(async () => undefined);
});

describe('Liste des conversations : pagination par curseur', () => {
  it('charge la page suivante en fin de liste avec le curseur, sans doublon, puis s\'arrête', async () => {
    const fake = installFakeApi({
      'GET /me': [200, ME],
      'GET /conversations': (req) => {
        const cursor = new URL(req.url).searchParams.get('cursor');
        if (cursor === null) return [200, { data: [conv('c1', 'Awa'), conv('c2', 'Binta')], meta: { next_cursor: 'CURSEUR+1/=' } }];
        if (cursor === 'CURSEUR+1/=') return [200, { data: [conv('c2', 'Binta'), conv('c3', 'Chloé')], meta: { next_cursor: null } }];
        throw new Error(`curseur inattendu ${cursor}`);
      },
    });
    await renderShell(<MessagesListScreen />, { conversations: true });
    expect(await screen.findByTestId('conversation-c1')).toBeOnTheScreen();
    expect(screen.queryByTestId('conversation-c3')).toBeNull();

    await fireEvent(screen.getByTestId('messages-list'), 'endReached');
    expect(await screen.findByTestId('conversation-c3')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^conversation-/)).toHaveLength(3);

    // Dernière page : plus de curseur, une nouvelle fin de liste n'appelle plus le serveur.
    const before = fake.called('GET /conversations').length;
    await fireEvent(screen.getByTestId('messages-list'), 'endReached');
    await act(async () => undefined);
    expect(fake.called('GET /conversations')).toHaveLength(before);
    expect(fake.called('GET /conversations').map((c) => new URL(c.url).searchParams.get('cursor'))).toEqual([null, 'CURSEUR+1/=']);
  });

  it('sans meta (ancien serveur) : liste complète, aucune page supplémentaire demandée', async () => {
    const fake = installFakeApi({ 'GET /me': [200, ME], 'GET /conversations': [200, { data: [conv('c1', 'Awa')] }] });
    await renderShell(<MessagesListScreen />, { conversations: true });
    expect(await screen.findByTestId('conversation-c1')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('messages-list'), 'endReached');
    await act(async () => undefined);
    expect(fake.called('GET /conversations')).toHaveLength(1);
  });

  it('un échec de chargement de page garde la liste et le curseur : le défilement suivant réessaie', async () => {
    let fail = true;
    installFakeApi({
      'GET /me': [200, ME],
      'GET /conversations': (req) => {
        if (new URL(req.url).searchParams.get('cursor') === null) return [200, { data: [conv('c1', 'Awa')], meta: { next_cursor: 'p2' } }];
        if (fail) throw new TypeError('Network request failed');
        return [200, { data: [conv('c2', 'Binta')], meta: { next_cursor: null } }];
      },
    });
    await renderShell(<MessagesListScreen />, { conversations: true });
    expect(await screen.findByTestId('conversation-c1')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('messages-list'), 'endReached');
    await act(async () => undefined);
    expect(screen.getByTestId('conversation-c1')).toBeOnTheScreen();
    expect(screen.queryByTestId('conversation-c2')).toBeNull();

    fail = false;
    await fireEvent(screen.getByTestId('messages-list'), 'endReached');
    await waitFor(() => expect(screen.getByTestId('conversation-c2')).toBeOnTheScreen());
  });
});
