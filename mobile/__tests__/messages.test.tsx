import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, ScaledSize } from 'react-native';
import { ConversationScreen } from '../src/features/messages/ConversationScreen';
import { MessagesListScreen, previewText } from '../src/features/messages/MessagesListScreen';
import {
  addPending,
  applyReceipt,
  deliveryState,
  latestIncoming,
  mergeMessage,
  mergePage,
  setLocalState,
} from '../src/features/messages/thread';
import { translate } from '../src/i18n';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { conversation, meFixture, message, publicProfile } from './helpers/fixtures';
import { resetRouterMocks, router } from './helpers/routerMock';
import { FakeTransport, renderShell } from './helpers/shell';

const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => mockParams.current,
}));

// Indicateur de fonction des appels : modifiable par test (décision de conception 1 : masqués par défaut).
const mockFeatures = { callsEnabled: false };
jest.mock('../src/config/features', () => ({
  get CALLS_ENABLED() {
    return mockFeatures.callsEnabled;
  },
}));

const ME = meFixture();
const PEER = publicProfile('u2', 'Awa');
const user = () => userEvent.setup();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  mockParams.current = { id: 'c1', name: 'Awa', peerId: 'u2' };
  mockFeatures.callsEnabled = false;
});

afterEach(async () => {
  await act(async () => undefined);
});

describe('thread (fonctions pures)', () => {
  const m1 = message('m1', 'u2', 'salut', { created_at: '2026-11-06T10:00:01.000000Z' });
  const m2 = message('m2', 'u1', 'hello', { created_at: '2026-11-06T10:00:02.000000Z' });

  it('trie du plus récent au plus ancien et fusionne sans doublon (idempotent)', () => {
    const list = mergePage([], [m1, m2]);
    expect(list.map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(mergePage(list, [m1, m2])).toHaveLength(2);
  });

  it('le message du serveur remplace le message local de même client_id', () => {
    const pending = { ...m2, id: 'local-x', client_id: 'cid-1', local: 'sending' as const };
    const list = addPending([m1], pending);
    expect(list[0]?.local).toBe('sending');
    const merged = mergeMessage(list, { ...m2, id: 'srv-1', client_id: 'cid-1' });
    expect(merged.filter((m) => m.client_id === 'cid-1')).toHaveLength(1);
    expect(merged.find((m) => m.client_id === 'cid-1')?.id).toBe('srv-1');
    expect(merged.find((m) => m.client_id === 'cid-1')?.local).toBeUndefined();
  });

  it('un accusé déjà reçu n\'est pas effacé par une version plus ancienne du message', () => {
    const read = { ...m2, read_at: '2026-11-06T10:05:00Z' };
    const merged = mergeMessage([read], { ...m2, read_at: null });
    expect(merged[0]?.read_at).toBe('2026-11-06T10:05:00Z');
  });

  it('accusé de lecture : met à jour mes messages jusqu\'au message ciblé', () => {
    const mine1 = message('a1', 'u1', 'un', { created_at: '2026-11-06T10:00:01.000000Z' });
    const mine2 = message('a2', 'u1', 'deux', { created_at: '2026-11-06T10:00:02.000000Z' });
    const mine3 = message('a3', 'u1', 'trois', { created_at: '2026-11-06T10:00:03.000000Z' });
    const list = mergePage([], [mine1, mine2, mine3]);
    const next = applyReceipt(list, 'read', 'a2', 'u1', 'NOW');
    expect(next.find((m) => m.id === 'a1')?.read_at).toBe('NOW');
    expect(next.find((m) => m.id === 'a2')?.read_at).toBe('NOW');
    expect(next.find((m) => m.id === 'a3')?.read_at).toBeNull();
    expect(deliveryState(next.find((m) => m.id === 'a1') as never)).toBe('read');
  });

  it('état de livraison et dernier message entrant', () => {
    expect(deliveryState({ ...m2, local: 'sending' })).toBe('sending');
    expect(deliveryState({ ...m2, local: 'failed' })).toBe('failed');
    expect(deliveryState({ ...m2, delivered_at: 'x' })).toBe('delivered');
    expect(deliveryState(m2)).toBe('sent');
    expect(latestIncoming(mergePage([], [m1, m2]), 'u1')?.id).toBe('m1');
    expect(setLocalState([{ ...m2, local: 'failed' }], 'cid-m2', 'sending')[0]?.local).toBe('sending');
  });

  it('aperçu de liste : texte, médias, appel manqué, mes messages', () => {
    const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate('fr', key, params);
    expect(previewText(t, null)).toBe('Dites bonjour !');
    expect(previewText(t, { id: '1', mine: false, type: 'text', body: 'yo', created_at: '' })).toBe('yo');
    expect(previewText(t, { id: '1', mine: true, type: 'text', body: 'yo', created_at: '' })).toBe('Vous : yo');
    expect(previewText(t, { id: '1', mine: false, type: 'image', body: null, created_at: '' })).toBe('Photo');
    expect(previewText(t, { id: '1', mine: false, type: 'call_missed', body: 'audio', created_at: '' })).toBe('Appel manqué');
  });
});

describe('S13 Liste des conversations', () => {
  it('affiche aperçu et pastille de non-lus, ouvre la conversation', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /conversations': [
        200,
        {
          data: [
            conversation('c1', PEER, {
              unread: 3,
              last_message: { id: 'm9', mine: false, type: 'text', body: 'À demain ?', created_at: '2026-11-06T10:00:00Z' },
            }),
          ],
        },
      ],
    });
    await renderShell(<MessagesListScreen />, { conversations: true });
    expect(await screen.findByText('À demain ?')).toBeOnTheScreen();
    expect(screen.getByTestId('unread-c1')).toHaveTextContent('3');
    expect(screen.getByLabelText('Awa, 3 non lus. À demain ?')).toBeOnTheScreen();
    await user().press(screen.getByTestId('conversation-c1'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/conversation/[id]', params: expect.objectContaining({ id: 'c1', name: 'Awa' }) }),
    );
  });

  it('état vide avec invitation à découvrir', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /conversations': [200, { data: [] }] });
    await renderShell(<MessagesListScreen />, { conversations: true });
    expect(await screen.findByText('Aucune conversation pour le moment')).toBeOnTheScreen();
    await user().press(screen.getByRole('button', { name: 'Découvrir des profils' }));
    expect(router.push).toHaveBeenCalledWith('/discover');
  });

  it('hors ligne : état d\'erreur dédié puis rechargement', async () => {
    const fake = installFakeApi({ 'GET /me': [200, ME], 'GET /conversations': () => { throw new TypeError('Network request failed'); } });
    await renderShell(<MessagesListScreen />, { conversations: true });
    expect(await screen.findByText('Vous êtes hors ligne')).toBeOnTheScreen();
    fake.set('GET /conversations', [200, { data: [conversation('c1', PEER)] }]);
    await user().press(screen.getByTestId('async-retry'));
    expect(await screen.findByTestId('conversation-c1')).toBeOnTheScreen();
  });
});

describe('S14 Conversation', () => {
  const serverMsg = (id: string, from: string, body: string, extra = {}) =>
    message(id, from, body, { created_at: `2026-11-06T10:00:0${id.slice(-1)}.000000Z`, ...extra });

  function baseRoutes(extra: Record<string, never> = {}) {
    return {
      'GET /me': [200, ME],
      'GET /conversations': [200, { data: [conversation('c1', PEER)] }],
      'GET /conversations/c1/messages': [200, { data: [serverMsg('m2', 'u2', 'Coucou'), serverMsg('m1', 'u1', 'Salut')], next_cursor: null }],
      'POST /conversations/c1/delivered': emptyBody(),
      'POST /conversations/c1/read': emptyBody(),
      ...extra,
    } as never;
  }

  it('charge l\'historique, accuse remise puis lecture du dernier message reçu', async () => {
    const fake = installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByText('Coucou')).toBeOnTheScreen();
    await waitFor(() => expect(fake.called('POST /conversations/c1/read')).toHaveLength(1));
    expect(fake.called('POST /conversations/c1/delivered')[0]?.body).toEqual({ up_to_message_id: 'm2' });
    expect(fake.called('POST /conversations/c1/read')[0]?.body).toEqual({ up_to_message_id: 'm2' });
  });

  it('envoi optimiste : affiché tout de suite avec client_id, confirmé par le serveur sans doublon', async () => {
    let release: () => void = () => undefined;
    const fake = installFakeApi(
      baseRoutes({
        'POST /conversations/c1/messages': ((req: { body: unknown }) =>
          new Promise<[number, unknown]>((resolve) => {
            const body = req.body as { client_id: string; body: string };
            release = () => resolve([201, serverMsg('m3', 'u1', body.body, { client_id: body.client_id })]);
          })) as never,
      }),
    );
    await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Coucou');
    const u = user();
    await u.type(screen.getByTestId('conversation-input'), 'Ça va ?');
    await u.press(screen.getByTestId('conversation-send'));

    // Affiché immédiatement, état « Envoi en cours », champ vidé.
    expect(await screen.findByText('Ça va ?')).toBeOnTheScreen();
    expect(screen.getByText(/Envoi en cours/)).toBeOnTheScreen();
    expect(screen.getByTestId('conversation-input').props.value).toBe('');
    await waitFor(() => expect(fake.called('POST /conversations/c1/messages')).toHaveLength(1));
    const sent = fake.called('POST /conversations/c1/messages')[0]?.body as { client_id: string; type: string; body: string };
    expect(sent).toMatchObject({ type: 'text', body: 'Ça va ?' });
    expect(sent.client_id).toMatch(/^[0-9a-f-]{36}$/);

    await act(async () => {
      release();
    });
    await waitFor(() => expect(screen.queryByText(/Envoi en cours/)).not.toBeOnTheScreen());
    expect(screen.getAllByText('Ça va ?')).toHaveLength(1);
    expect(screen.getByTestId('state-m3')).toHaveTextContent(/Envoyé/);
  });


  it('échec d\'envoi : état « Échec », renvoi avec le MÊME client_id', async () => {
    const fake = installFakeApi(baseRoutes({ 'POST /conversations/c1/messages': [500, { error: { code: 'server_error', message: 'x' } }] as never }));
    await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Coucou');
    const u = user();
    await u.type(screen.getByTestId('conversation-input'), 'Test');
    await u.press(screen.getByTestId('conversation-send'));
    const firstId = await waitFor(() => {
      const call = fake.called('POST /conversations/c1/messages')[0];
      expect(call).toBeDefined();
      return (call?.body as { client_id: string }).client_id;
    });
    expect(await screen.findByText(/Échec de l’envoi/)).toBeOnTheScreen();

    fake.set('POST /conversations/c1/messages', (req) => [201, serverMsg('m5', 'u1', 'Test', { client_id: (req.body as { client_id: string }).client_id })]);
    await u.press(screen.getByTestId(`retry-${firstId}`));
    await waitFor(() => expect(fake.called('POST /conversations/c1/messages')).toHaveLength(2));
    expect((fake.called('POST /conversations/c1/messages')[1]?.body as { client_id: string }).client_id).toBe(firstId);
    await waitFor(() => expect(screen.queryByTestId(`retry-${firstId}`)).not.toBeOnTheScreen());
    expect(screen.getAllByText('Test')).toHaveLength(1);
  });

  it('avis de sécurité : safety_hint money_request affiche la bannière', async () => {
    installFakeApi(
      baseRoutes({
        'POST /conversations/c1/messages': ((req: { body: unknown }) => [
          201,
          { ...serverMsg('m6', 'u1', 'envoie de l\'argent', { client_id: (req.body as { client_id: string }).client_id }), safety_hint: 'money_request' },
        ]) as never,
      }),
    );
    await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Coucou');
    const u = user();
    await u.type(screen.getByTestId('conversation-input'), 'envoie de l\'argent');
    await u.press(screen.getByTestId('conversation-send'));
    const banner = await screen.findByTestId('safety-banner');
    expect(banner).toHaveTextContent(/Attention : demande d’argent/);
    expect(banner).toHaveTextContent(/Ne versez jamais d’argent/);
  });

  it('pagination par curseur : « Messages précédents » charge la page suivante sans doublon', async () => {
    const fake = installFakeApi(
      baseRoutes({
        'GET /conversations/c1/messages': ((req: { url: string }) =>
          req.url.includes('cursor=NEXT')
            ? [200, { data: [serverMsg('m0', 'u2', 'Très ancien'), serverMsg('m1', 'u1', 'Salut')], next_cursor: null }]
            : [200, { data: [serverMsg('m2', 'u2', 'Coucou'), serverMsg('m1', 'u1', 'Salut')], next_cursor: 'NEXT' }]) as never,
      }),
    );
    await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Coucou');
    await user().press(screen.getByTestId('load-older'));
    expect(await screen.findByText('Très ancien')).toBeOnTheScreen();
    expect(screen.getAllByText('Salut')).toHaveLength(1);
    expect(fake.calls.some((c) => c.url.includes('cursor=NEXT'))).toBe(true);
    expect(screen.queryByTestId('load-older')).not.toBeOnTheScreen();
  });

  it('temps réel : message.created apparaît, accusé de lecture mis à jour, « écrit… » affiché', async () => {
    installFakeApi(baseRoutes());
    const { transport } = await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Coucou');
    await waitFor(() => expect(transport.channels()).toContain('private-conversation.c1'));

    await act(async () => {
      transport.emit('private-conversation.c1', 'message.created', {
        message: serverMsg('m4', 'u2', 'Nouveau en direct'),
      });
    });
    expect(await screen.findByText('Nouveau en direct')).toBeOnTheScreen();

    expect(screen.getByTestId('state-m1')).toHaveTextContent(/Envoyé/);
    await act(async () => {
      transport.emit('private-conversation.c1', 'message.read', { up_to_message_id: 'm1', by: 'u2' });
    });
    expect(screen.getByTestId('state-m1')).toHaveTextContent(/Lu/);

    await act(async () => {
      transport.emit('private-conversation.c1', 'typing', { user_id: 'u2' });
    });
    expect(screen.getByTestId('peer-typing')).toHaveTextContent('Awa écrit…');
  });

  it('repli : sans socket connectée, la conversation se rafraîchit périodiquement', async () => {
    const fake = installFakeApi(baseRoutes());
    const { transport } = await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Coucou');
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      await act(async () => {
        transport.setStatus('disconnected');
      });
      expect(screen.getByTestId('realtime-off')).toBeOnTheScreen();
      const before = fake.called('GET /conversations/c1/messages').length;
      await act(async () => {
        jest.advanceTimersByTime(15500);
      });
      await waitFor(() => expect(fake.called('GET /conversations/c1/messages').length).toBeGreaterThan(before));
    } finally {
      jest.useRealTimers();
    }
  });

  it('conversation fermée (403 conversation_closed) : champ de saisie remplacé par un avis', async () => {
    installFakeApi(
      baseRoutes({ 'POST /conversations/c1/messages': [403, { error: { code: 'conversation_closed', message: 'x' } }] as never }),
    );
    await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Coucou');
    const u = user();
    await u.type(screen.getByTestId('conversation-input'), 'Hello');
    await u.press(screen.getByTestId('conversation-send'));
    expect(await screen.findByTestId('conversation-closed')).toBeOnTheScreen();
  });

  it('erreur de chargement : « Réessayer » recharge le fil', async () => {
    const fake = installFakeApi(
      baseRoutes({ 'GET /conversations/c1/messages': [500, { error: { code: 'server_error', message: 'x' } }] as never }),
    );
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByTestId('async-retry')).toBeOnTheScreen();
    fake.set('GET /conversations/c1/messages', [200, { data: [serverMsg('m2', 'u2', 'Revenu')], next_cursor: null }]);
    await user().press(screen.getByTestId('async-retry'));
    expect(await screen.findByText('Revenu')).toBeOnTheScreen();
  });

  it('appel manqué affiché comme ligne système (S18)', async () => {
    installFakeApi(
      baseRoutes({
        'GET /conversations/c1/messages': [
          200,
          { data: [serverMsg('m7', 'u2', '', { type: 'call_missed', body: 'video' })], next_cursor: null },
        ] as never,
      }),
    );
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByText('Appel vidéo manqué')).toBeOnTheScreen();
  });

  it('menu : signaler ouvre S58 avec le contexte de la conversation', async () => {
    installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Coucou');
    const u = user();
    await u.press(screen.getByTestId('conversation-menu'));
    await u.press(screen.getByTestId('conversation-report'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/report',
      params: { reportedId: 'u2', name: 'Awa', contextType: 'conversation', contextId: 'c1' },
    });
  });
});

describe('S14 Conversation : en-tête et boutons d\'appel', () => {
  const routes = () =>
    ({
      'GET /me': [200, ME],
      'GET /conversations': [200, { data: [conversation('c1', PEER)] }],
      'GET /conversations/c1/messages': [200, { data: [], next_cursor: null }],
    }) as never;

  afterEach(() => jest.restoreAllMocks());

  it('appels masqués tant que le moteur média n\'existe pas (CALLS_ENABLED = false), même pour un match', async () => {
    installFakeApi(routes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByTestId('conversation-menu');
    expect(screen.queryByTestId('call-audio')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('call-video')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Appel audio')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Appel vidéo')).not.toBeOnTheScreen();
  });

  it('le menu garde « Rompre le match » même quand les appels sont masqués', async () => {
    installFakeApi(routes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-menu'));
    expect(screen.getByTestId('conversation-unmatch')).toBeOnTheScreen();
    expect(screen.getByTestId('conversation-report')).toBeOnTheScreen();
    expect(screen.getByTestId('conversation-block')).toBeOnTheScreen();
  });

  it('indicateur activé : les boutons d\'appel réapparaissent pour un match (le code des appels est conservé)', async () => {
    mockFeatures.callsEnabled = true;
    installFakeApi(routes());
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByTestId('call-audio')).toBeOnTheScreen();
    expect(screen.getByTestId('call-video')).toBeOnTheScreen();
  });

  it('indicateur activé mais conversation non issue d\'un match : toujours pas d\'appel', async () => {
    mockFeatures.callsEnabled = true;
    installFakeApi({
      ...(routes() as object),
      'GET /conversations': [200, { data: [conversation('c1', PEER, { unlocked_by: 'credit' })] }],
    } as never);
    await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByTestId('conversation-menu');
    expect(screen.queryByTestId('call-audio')).not.toBeOnTheScreen();
  });

  it('320 pt, texte à 200 % : nom long sur deux lignes max, menu et retour sur une ligne d\'actions séparée', async () => {
    const size: ScaledSize = { width: 320, height: 640, scale: 2, fontScale: 2 };
    jest.spyOn(Dimensions, 'get').mockImplementation(() => size);
    const longName = 'Marie-Antoinette de la Fontaine-Beauséjour';
    installFakeApi({
      ...(routes() as object),
      'GET /conversations': [200, { data: [conversation('c1', publicProfile('u2', longName))] }],
    } as never);
    await renderShell(<ConversationScreen />, { conversations: true });
    const menu = await screen.findByTestId('conversation-menu');
    const name = screen.getByRole('header', { name: longName });
    expect(name.props.numberOfLines).toBe(2);
    expect(screen.getByTestId('conversation-header')).toBeOnTheScreen();
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
    // Le menu n'est pas dans la même ligne que le nom : il ne peut pas être repoussé hors de l'écran.
    expect(menu.parent).not.toBe(name.parent);
    expect(Number(flatMinHeight(menu))).toBeGreaterThanOrEqual(44);
  });
});

function flatMinHeight(node: { props: { style?: unknown } }): number {
  const style = node.props.style;
  const resolved = typeof style === 'function' ? (style as (s: { pressed: boolean }) => unknown)({ pressed: false }) : style;
  return Object.assign({}, ...[resolved].flat(Infinity).filter(Boolean)).minHeight as number;
}

describe('temps réel : abonnements', () => {
  it('s\'abonne au canal privé de la conversation et se désabonne au démontage', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /conversations': [200, { data: [] }],
      'GET /conversations/c1/messages': [200, { data: [], next_cursor: null }],
    });
    const transport = new FakeTransport();
    const { unmount } = await renderShell(<ConversationScreen />, { conversations: true, transport });
    await waitFor(() => expect(transport.channels()).toContain('private-conversation.c1'));
    expect(transport.connected).toBe(1);
    unmount();
    await waitFor(() => expect(transport.channels()).not.toContain('private-conversation.c1'));
  });
});
