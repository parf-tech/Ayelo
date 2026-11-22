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
 * `GET /matches` ne renvoie que les 100 derniers matchs, sans curseur ni indicateur de troncature (contrat, contrôleur).
 * « Rompre le match » retrouve le match par l'identifiant de la conversation dans cette liste : un match plus ancien n'y est
 * pas. L'écran ne doit alors ni annoncer « Match rompu » ni quitter la conversation, puisque rien n'a été fait.
 */

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({ id: 'c1', name: 'Awa', peerId: 'u2' }),
}));

jest.mock('../src/config/features', () => ({ CALLS_ENABLED: false }));

const ME = meFixture();
const PEER = publicProfile('u2', 'Awa');
const user = () => userEvent.setup();

const matchRow = (id: string, conversationId: string | null) => ({ id, created_at: '2026-11-01T10:00:00Z', conversation_id: conversationId, profile: null });

const routes = (matches: unknown[]) =>
  ({
    'GET /me': [200, ME],
    'GET /conversations': [200, { data: [conversation('c1', PEER)] }],
    'GET /conversations/c1/messages': [200, { data: [], next_cursor: null }],
    'GET /matches': [200, { data: matches }],
    'DELETE /matches/m1': emptyBody(),
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

async function breakMatch() {
  await renderShell(<ConversationScreen />, { conversations: true });
  const u = user();
  await u.press(await screen.findByTestId('conversation-menu'));
  await u.press(screen.getByTestId('conversation-unmatch'));
  await u.press(screen.getByTestId('conversation-confirm'));
}

describe('Rompre le match et la limite de 100 de GET /matches', () => {
  it('match parmi les 100 derniers : il est rompu, « Match rompu. » s’affiche et l’écran se ferme', async () => {
    const fake = installFakeApi(routes([matchRow('m0', 'c0'), matchRow('m1', 'c1')]));
    await breakMatch();
    await waitFor(() => expect(fake.called('DELETE /matches/m1')).toHaveLength(1));
    expect(await screen.findByText('Match rompu.')).toBeOnTheScreen();
    expect(router.replace).toHaveBeenCalledWith('/messages');
  });

  it('match plus ancien que les 100 derniers : rien n’est rompu, l’écran le dit et reste ouvert', async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => matchRow(`m-${i}`, `c-${i}`));
    const fake = installFakeApi(routes(hundred));
    await breakMatch();
    await waitFor(() => expect(fake.called('GET /matches')).toHaveLength(1));
    expect(await screen.findByTestId('conversation-notice')).toHaveTextContent(/pas parmi vos 100 derniers matchs/);
    expect(fake.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    expect(screen.queryByText('Match rompu.')).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('même constat en anglais', async () => {
    installFakeApi(routes([matchRow('m0', 'c0')]));
    await renderShell(<ConversationScreen />, { conversations: true, locale: 'en' });
    const u = user();
    await u.press(await screen.findByTestId('conversation-menu'));
    await u.press(screen.getByTestId('conversation-unmatch'));
    await u.press(screen.getByTestId('conversation-confirm'));
    expect(await screen.findByTestId('conversation-notice')).toHaveTextContent(/not among your 100 latest matches/);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
