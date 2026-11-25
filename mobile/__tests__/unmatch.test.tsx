import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ConversationScreen } from '../src/features/messages/ConversationScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { conversation, meFixture, publicProfile } from './helpers/fixtures';
import { resetRouterMocks, router } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

/**
 * « Rompre le match » lit `match_id` dans GET /conversations et appelle DELETE /matches/{id}. L'application n'utilise pas
 * GET /matches, qui ne renvoie que les 100 derniers matchs sans curseur : un match ancien se rompt donc comme un autre.
 */

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({ id: 'c1', name: 'Awa', peerId: 'u2' }),
}));

jest.mock('../src/config/features', () => ({ CALLS_ENABLED: false }));

const ME = meFixture();
const PEER = publicProfile('u2', 'Awa');
const user = () => userEvent.setup();

const routes = (c = conversation('c1', PEER, { match_id: 'm-old' })) =>
  ({
    'GET /me': [200, ME],
    'GET /conversations': [200, { data: [c] }],
    'GET /conversations/c1/messages': [200, { data: [], next_cursor: null }],
    'DELETE /matches/m-old': emptyBody(),
  }) as never;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
});

afterEach(async () => {
  await act(async () => undefined);
});

async function openMenu(locale?: 'en') {
  await renderShell(<ConversationScreen />, { conversations: true, ...(locale ? { locale } : {}) });
  await user().press(await screen.findByTestId('conversation-menu'));
}

describe('Rompre le match par l’identifiant fourni par la conversation', () => {
  it('rompt le match avec match_id, sans lire GET /matches, annonce « Match rompu. » et ferme l’écran', async () => {
    const fake = installFakeApi(routes());
    await openMenu();
    const u = user();
    await u.press(screen.getByTestId('conversation-unmatch'));
    await u.press(screen.getByTestId('conversation-confirm'));
    await waitFor(() => expect(fake.called('DELETE /matches/m-old')).toHaveLength(1));
    expect(await screen.findByText('Match rompu.')).toBeOnTheScreen();
    expect(router.replace).toHaveBeenCalledWith('/messages');
    expect(fake.calls.some((c) => c.path === '/matches')).toBe(false);
  });

  it('conversation hors match (match_id nul) : le menu ne propose pas « Rompre le match »', async () => {
    installFakeApi(routes(conversation('c1', PEER, { unlocked_by: 'credit' })));
    await openMenu();
    expect(screen.getByTestId('conversation-block')).toBeOnTheScreen();
    expect(screen.queryByTestId('conversation-unmatch')).toBeNull();
  });

  it('refus du serveur (match introuvable) : l’erreur s’affiche, l’écran reste ouvert, aucun faux succès', async () => {
    const fake = installFakeApi(routes());
    fake.set('DELETE /matches/m-old', [404, { error: { code: 'not_found', message: 'Introuvable.' } }]);
    await openMenu();
    const u = user();
    await u.press(screen.getByTestId('conversation-unmatch'));
    await u.press(screen.getByTestId('conversation-confirm'));
    expect(await screen.findByTestId('conversation-notice')).toBeOnTheScreen();
    expect(screen.queryByText('Match rompu.')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('même parcours en anglais', async () => {
    installFakeApi(routes());
    await openMenu('en');
    const u = user();
    await u.press(screen.getByTestId('conversation-unmatch'));
    await u.press(screen.getByTestId('conversation-confirm'));
    expect(await screen.findByText('Match ended.')).toBeOnTheScreen();
  });
});
