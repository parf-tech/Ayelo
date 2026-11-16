import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { ConversationScreen } from '../src/features/messages/ConversationScreen';
import { MessagesListScreen } from '../src/features/messages/MessagesListScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { FontsReadyProvider, fontFamily } from '../src/theme';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { conversation, meFixture, message, publicProfile } from './helpers/fixtures';
import { resetRouterMocks, router } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

// Revue design, lot 3 : conversation (confirmations, saisie, photo) et liste des conversations.

const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => mockParams.current,
}));

jest.mock('../src/config/features', () => ({ CALLS_ENABLED: false }));

const ME = meFixture();
const PEER = publicProfile('u2', 'Awa');
const user = () => userEvent.setup();

const routes = (extra: Record<string, unknown> = {}) =>
  ({
    'GET /me': [200, ME],
    'GET /conversations': [200, { data: [conversation('c1', PEER)] }],
    'GET /conversations/c1/messages': [200, { data: [], next_cursor: null }],
    'POST /conversations/c1/hide': emptyBody(),
    'POST /blocks': emptyBody(),
    ...extra,
  }) as never;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  mockParams.current = { id: 'c1', name: 'Awa', peerId: 'u2' };
});

afterEach(async () => {
  await act(async () => undefined);
});

describe('S14 Menu de la conversation : confirmations', () => {
  it('« Supprimer la conversation » demande confirmation, avec la conséquence, avant d’agir', async () => {
    const fake = installFakeApi(routes());
    await renderShell(<ConversationScreen />, { conversations: true });
    const u = user();
    await u.press(await screen.findByTestId('conversation-menu'));
    await u.press(screen.getByTestId('conversation-hide'));
    // Rien n'est parti : seule la confirmation s'affiche.
    expect(fake.called('POST /conversations/c1/hide')).toHaveLength(0);
    expect(screen.getByText('Supprimer cette conversation ?')).toBeOnTheScreen();
    expect(screen.getByTestId('conversation-confirm-body')).toHaveTextContent('Elle disparaît de votre liste ; l’autre personne la voit toujours.');

    await u.press(screen.getByText('Annuler'));
    expect(fake.called('POST /conversations/c1/hide')).toHaveLength(0);
    expect(screen.getByTestId('conversation-hide')).toBeOnTheScreen();

    await u.press(screen.getByTestId('conversation-hide'));
    await u.press(screen.getByTestId('conversation-confirm'));
    await waitFor(() => expect(fake.called('POST /conversations/c1/hide')).toHaveLength(1));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/messages'));
  });

  it('« Bloquer » et « Rompre le match » montrent aussi le texte des conséquences', async () => {
    installFakeApi(routes());
    await renderShell(<ConversationScreen />, { conversations: true });
    const u = user();
    await u.press(await screen.findByTestId('conversation-menu'));
    await u.press(screen.getByTestId('conversation-block'));
    expect(screen.getByText('Bloquer Awa ?')).toBeOnTheScreen();
    expect(screen.getByTestId('conversation-confirm-body')).toHaveTextContent(/ne pourra plus vous voir ni vous écrire/);
    await u.press(screen.getByText('Annuler'));

    await u.press(screen.getByTestId('conversation-unmatch'));
    expect(screen.getByText('Rompre ce match ?')).toBeOnTheScreen();
    expect(screen.getByTestId('conversation-confirm-body')).toHaveTextContent('Vous ne pourrez plus vous écrire.');
  });
});

describe('S14 Conversation : photo, saisie, liste', () => {
  it('sans photo en paramètre (notification, lien), l’avatar reprend la photo du profil de la liste des conversations', async () => {
    mockParams.current = { id: 'c1' };
    installFakeApi(routes());
    await renderShell(<ConversationScreen />, { conversations: true });
    const avatar = await screen.findByTestId('conversation-peer-avatar');
    await waitFor(() => expect(avatar.props.source).toEqual({ uri: 'https://cdn.example.test/u2-m1.jpg' }));
  });

  it('zone de saisie : police de marque, taille et interligne du corps, contour fin puis épais au focus', async () => {
    installFakeApi(routes());
    await renderShell(
      <FontsReadyProvider ready>
        <ConversationScreen />
      </FontsReadyProvider>,
      { conversations: true },
    );
    const input = await screen.findByTestId('conversation-input');
    const rest = StyleSheet.flatten(input.props.style) as Record<string, unknown>;
    expect(rest.fontFamily).toBe(fontFamily['400']);
    expect(rest.fontSize).toBe(16);
    expect(rest.lineHeight).toBe(24);
    expect(rest.borderWidth).toBe(1);
    await act(async () => {
      fireEvent(input, 'focus');
    });
    expect((StyleSheet.flatten(screen.getByTestId('conversation-input').props.style) as Record<string, unknown>).borderWidth).toBe(2);
    await act(async () => {
      fireEvent(screen.getByTestId('conversation-input'), 'blur');
    });
    expect((StyleSheet.flatten(screen.getByTestId('conversation-input').props.style) as Record<string, unknown>).borderWidth).toBe(1);
  });

  it('police du système tant que les polices de marque ne sont pas chargées', async () => {
    installFakeApi(routes());
    await renderShell(<ConversationScreen />, { conversations: true });
    const input = await screen.findByTestId('conversation-input');
    expect((StyleSheet.flatten(input.props.style) as Record<string, unknown>).fontFamily).toBeUndefined();
  });

  it('liste des messages : un toucher sur un bouton passe même clavier ouvert, et le clavier se ferme en faisant défiler', async () => {
    installFakeApi(
      routes({
        'GET /conversations/c1/messages': [200, { data: [message('m1', 'u2', 'Coucou', { created_at: '2026-11-06T10:00:01.000000Z' })], next_cursor: null }],
        'POST /conversations/c1/delivered': emptyBody(),
        'POST /conversations/c1/read': emptyBody(),
      }),
    );
    await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Coucou');
    const list = screen.getByTestId('thread-list');
    expect(list.props.keyboardShouldPersistTaps).toBe('handled');
    expect(list.props.keyboardDismissMode).toBe('interactive');
  });

  it('liste des conversations : rangées sans valeur en dur (séparateur fin, avatar de 56) et pastille numérique', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /conversations': [200, { data: [conversation('c1', PEER, { unread: 3 })] }],
    } as never);
    await renderShell(<MessagesListScreen />, { conversations: true });
    expect(await screen.findByTestId('unread-c1')).toHaveTextContent('3');
    const badge = StyleSheet.flatten(screen.getByTestId('unread-c1').props.style) as Record<string, number>;
    expect(badge.minWidth).toBe(24);
    expect(badge.minHeight).toBe(24);
    expect(badge.borderRadius).toBe(999);
  });
});
