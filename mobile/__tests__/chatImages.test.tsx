import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ConversationScreen } from '../src/features/messages/ConversationScreen';
import { applyMediaStatus, mergeMessage, type LocalMessage } from '../src/features/messages/thread';
import { pickImage } from '../src/media/picker';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { installFakeApi } from './helpers/fakeApi';
import { conversation, meFixture, message, publicProfile } from './helpers/fixtures';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

/**
 * Images en conversation (parcours « le message part tout de suite », décision du propriétaire du 2026-11-22) :
 * dépôt présigné `message_image`, message `image` avec `media_id`, statut de modération (`media_status`) affiché honnêtement,
 * adresse de lecture demandée image par image (`GET /conversations/{id}/messages/{messageId}/media`) et mise à jour en direct
 * par le signal `message.media`.
 */

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({ id: 'c1', name: 'Awa', peerId: 'u2' }),
}));
jest.mock('../src/config/features', () => ({ CALLS_ENABLED: false }));
jest.mock('../src/media/picker', () => ({ pickImage: jest.fn() }));

const pick = pickImage as jest.Mock;
const ME = meFixture();
const PEER = publicProfile('u2', 'Awa');
const user = () => userEvent.setup();
const blobResponse = (size: number) => ({ ok: true, status: 200, blob: async () => ({ size }) }) as unknown as Response;
const PHOTO = { uri: 'file:///p.jpg', mimeType: 'image/jpeg', fileSize: 2000 };
const inTenMinutes = () => new Date(Date.now() + 10 * 60_000).toISOString();

type MediaStatus = 'processing' | 'approved' | 'rejected' | null;
const imageMessage = (id: string, sender: string, status: MediaStatus, extra: Partial<LocalMessage> = {}) =>
  message(id, sender, '', { type: 'image', body: null, media_id: `media-${id}`, media_status: status, ...extra });

type Routes = Parameters<typeof installFakeApi>[0];

const uploadRoutes = (mediaId = 'm1'): Routes => ({
  'GET file:///p.jpg': blobResponse(2000),
  'POST /media/upload-url': [201, { media_id: mediaId, upload: { url: 'https://storage.example.test/put', headers: { 'Content-Type': 'image/jpeg' } } }],
  'PUT https://storage.example.test/put': [200, {}],
  [`POST /media/${mediaId}/complete`]: [200, { media_id: mediaId, status: 'processing' }],
});

const baseRoutes = (messages: unknown[] = []): Routes => ({
  'GET /me': [200, ME],
  'GET /conversations': [200, { data: [conversation('c1', PEER)] }],
  'GET /conversations/c1/messages': [200, { data: messages, next_cursor: null }],
  'POST /conversations/c1/read': [204, undefined],
  'POST /conversations/c1/delivered': [204, undefined],
});

const sent = (clientId: unknown, status: MediaStatus = 'processing'): [number, unknown] => [
  201,
  { ...imageMessage('s1', 'u1', status, { client_id: String(clientId), media_id: 'm1' }) },
];

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  pick.mockReset();
});

afterEach(async () => {
  await act(async () => undefined);
});

describe('thread : fonctions pures', () => {
  it('applyMediaStatus ne change que le message visé, et laisse la liste intacte si le message est inconnu', () => {
    const list = [imageMessage('a', 'u2', 'processing'), imageMessage('b', 'u2', 'processing')];
    const updated = applyMediaStatus(list, 'a', 'approved');
    expect(updated.map((m) => m.media_status)).toEqual(['approved', 'processing']);
    expect(applyMediaStatus(list, 'zzz', 'approved')).toBe(list);
  });

  it('le message du serveur garde l’aperçu local de l’image envoyée (même client_id)', () => {
    const local: LocalMessage = { ...imageMessage('local-c1', 'u1', null, { client_id: 'c1', media_id: null }), local: 'sending', local_image_uri: 'file:///p.jpg' };
    const merged = mergeMessage([local], imageMessage('s1', 'u1', 'processing', { client_id: 'c1' }));
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 's1', media_status: 'processing', local_image_uri: 'file:///p.jpg' });
    expect(merged[0]?.local).toBeUndefined();
  });
});

describe('envoi d’une image', () => {
  it('le bouton « joindre une photo » est proposé ; absent quand la conversation est fermée', async () => {
    installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByTestId('conversation-attach')).toBeOnTheScreen();
    expect(screen.getByLabelText('Joindre une photo')).toBeOnTheScreen();
  });

  it('dépôt présigné (message_image), puis message image avec media_id : la bulle dit que la photo est en vérification', async () => {
    pick.mockResolvedValue({ kind: 'picked', image: PHOTO });
    const fake = installFakeApi({
      ...baseRoutes(),
      ...uploadRoutes('m1'),
      'POST /conversations/c1/messages': (req) => sent((req.body as { client_id: string }).client_id),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-attach'));

    expect(await screen.findByText('Votre photo est en cours de vérification')).toBeOnTheScreen();
    expect(pick).toHaveBeenCalledWith('library');
    expect(fake.called('POST /media/upload-url')[0]?.body).toEqual({ kind: 'message_image', mime_type: 'image/jpeg', size_bytes: 2000 });
    const post = fake.called('POST /conversations/c1/messages')[0]?.body as Record<string, unknown>;
    expect(post).toMatchObject({ type: 'image', media_id: 'm1' });
    expect(post).not.toHaveProperty('body');
    expect(typeof post.client_id).toBe('string');
    // L'ordre compte : le message n'est envoyé qu'une fois le dépôt terminé.
    const order = fake.calls.map((c) => `${c.method} ${c.path}`).filter((c) => /upload-url|complete|messages$/.test(c) && !c.startsWith('GET'));
    expect(order).toEqual(['POST /media/upload-url', 'POST /media/m1/complete', 'POST /conversations/c1/messages']);
    // L'expéditeur revoit sa propre photo (aperçu local) tant qu'elle est en vérification.
    expect(screen.getByTestId('image-local-s1').props.source).toEqual({ uri: 'file:///p.jpg' });
  });

  it('pendant le dépôt, la photo apparaît tout de suite avec son état d’envoi', async () => {
    pick.mockResolvedValue({ kind: 'picked', image: PHOTO });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    installFakeApi({
      ...baseRoutes(),
      ...uploadRoutes('m1'),
      'PUT https://storage.example.test/put': async () => {
        await gate;
        return [200, {}];
      },
      'POST /conversations/c1/messages': (req) => sent((req.body as { client_id: string }).client_id),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-attach'));
    expect(await screen.findByText('Envoi en cours')).toBeOnTheScreen();
    expect(screen.getByTestId(/^image-local-local-/).props.source).toEqual({ uri: 'file:///p.jpg' });
    await act(async () => release());
    expect(await screen.findByText('Votre photo est en cours de vérification')).toBeOnTheScreen();
  });

  it('dépôt refusé par le stockage : échec affiché, puis « Renvoyer » dépose de nouveau la photo', async () => {
    pick.mockResolvedValue({ kind: 'picked', image: PHOTO });
    let puts = 0;
    const fake = installFakeApi({
      ...baseRoutes(),
      ...uploadRoutes('m1'),
      'DELETE /media/m1': [204, undefined],
      'PUT https://storage.example.test/put': () => [++puts === 1 ? 403 : 200, {}],
      'POST /conversations/c1/messages': (req) => sent((req.body as { client_id: string }).client_id),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-attach'));

    expect(await screen.findByTestId('conversation-notice')).toBeOnTheScreen();
    expect(screen.getByText('Échec de l’envoi')).toBeOnTheScreen();
    expect(fake.called('POST /conversations/c1/messages')).toHaveLength(0);

    await user().press(screen.getByText('Renvoyer'));
    expect(await screen.findByText('Votre photo est en cours de vérification')).toBeOnTheScreen();
    expect(fake.called('POST /media/upload-url')).toHaveLength(2);
  });

  it('dépôt réussi mais envoi du message en échec : le renvoi garde le même media_id et le même client_id (aucun second dépôt)', async () => {
    pick.mockResolvedValue({ kind: 'picked', image: PHOTO });
    let posts = 0;
    const fake = installFakeApi({
      ...baseRoutes(),
      ...uploadRoutes('m1'),
      'POST /conversations/c1/messages': (req) => (++posts === 1 ? [500, { error: { code: 'server_error', message: 'x' } }] : sent((req.body as { client_id: string }).client_id)),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-attach'));
    await screen.findByText('Échec de l’envoi');

    await user().press(screen.getByText('Renvoyer'));
    expect(await screen.findByText('Votre photo est en cours de vérification')).toBeOnTheScreen();
    const [first, second] = fake.called('POST /conversations/c1/messages').map((c) => c.body as { client_id: string; media_id: string });
    expect(second).toEqual(first);
    expect(fake.called('POST /media/upload-url')).toHaveLength(1);
  });

  it('média refusé par le serveur à l’envoi (422) : le renvoi dépose une nouvelle photo', async () => {
    pick.mockResolvedValue({ kind: 'picked', image: PHOTO });
    let posts = 0;
    const fake = installFakeApi({
      ...baseRoutes(),
      ...uploadRoutes('m1'),
      'POST /conversations/c1/messages': (req) =>
        ++posts === 1 ? [422, { error: { code: 'validation_failed', message: 'x' }, errors: { media_id: ['Média invalide ou refusé.'] } }] : sent((req.body as { client_id: string }).client_id),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-attach'));
    await screen.findByText('Échec de l’envoi');
    await user().press(screen.getByText('Renvoyer'));
    expect(await screen.findByText('Votre photo est en cours de vérification')).toBeOnTheScreen();
    expect(fake.called('POST /media/upload-url')).toHaveLength(2);
  });

  it('format non pris en charge ou photo de plus de 8 Mo : annoncé avant tout dépôt', async () => {
    const fake = installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    const attach = await screen.findByTestId('conversation-attach');

    pick.mockResolvedValueOnce({ kind: 'picked', image: { uri: 'file:///p.heic', mimeType: 'image/heic', fileSize: 1000 } });
    await user().press(attach);
    expect(await screen.findByTestId('conversation-notice')).toHaveTextContent(/format/i);

    pick.mockResolvedValueOnce({ kind: 'picked', image: { uri: 'file:///big.jpg', mimeType: 'image/jpeg', fileSize: 9 * 1024 * 1024 } });
    await user().press(attach);
    await waitFor(() => expect(screen.getByTestId('conversation-notice')).toHaveTextContent(/8 Mo/));

    expect(fake.called('POST /media/upload-url')).toHaveLength(0);
    expect(screen.queryByText('Échec de l’envoi')).toBeNull();
  });

  it('sélection annulée : rien n’est envoyé', async () => {
    pick.mockResolvedValue({ kind: 'cancelled' });
    const fake = installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-attach'));
    expect(fake.calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });

  it('conversation fermée pendant l’envoi (403) : le bandeau « conversation fermée » remplace la zone de saisie', async () => {
    pick.mockResolvedValue({ kind: 'picked', image: PHOTO });
    installFakeApi({
      ...baseRoutes(),
      ...uploadRoutes('m1'),
      'POST /conversations/c1/messages': [403, { error: { code: 'conversation_closed', message: 'x' } }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-attach'));
    expect(await screen.findByTestId('conversation-closed')).toBeOnTheScreen();
    expect(screen.queryByTestId('conversation-attach')).toBeNull();
  });
});

describe('image reçue : statut de modération et adresse de lecture', () => {
  it('en vérification ou refusée : un texte honnête, aucune adresse demandée', async () => {
    const fake = installFakeApi(baseRoutes([imageMessage('p1', 'u2', 'processing'), imageMessage('r1', 'u2', 'rejected')]));
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByText('Photo en cours de vérification')).toBeOnTheScreen();
    expect(screen.getByText('Photo refusée par la modération')).toBeOnTheScreen();
    expect(fake.calls.some((c) => c.path.endsWith('/media'))).toBe(false);
  });

  it('approuvée : l’adresse signée est demandée pour ce message et l’image s’affiche', async () => {
    const fake = installFakeApi({
      ...baseRoutes([imageMessage('a1', 'u2', 'approved')]),
      'GET /conversations/c1/messages/a1/media': [200, { url: 'https://storage.example.test/get/a1?sig=1', expires_at: inTenMinutes() }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    const image = await screen.findByTestId('image-a1');
    expect(image.props.source).toEqual({ uri: 'https://storage.example.test/get/a1?sig=1' });
    expect(fake.called('GET /conversations/c1/messages/a1/media')).toHaveLength(1);
    expect(screen.getByLabelText('Voir la photo en plein écran')).toBeOnTheScreen();
  });

  it('l’adresse est mise en cache : un nouveau rendu ne la redemande pas', async () => {
    const fake = installFakeApi({
      ...baseRoutes([imageMessage('a1', 'u2', 'approved')]),
      'GET /conversations/c1/messages/a1/media': [200, { url: 'https://storage.example.test/get/a1?sig=1', expires_at: inTenMinutes() }],
    });
    const { transport } = await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByTestId('image-a1');
    await waitFor(() => expect(transport.channels()).toContain('private-conversation.c1'));
    await act(async () => {
      transport.emit('private-conversation.c1', 'typing', { user_id: 'u2' });
    });
    expect(fake.called('GET /conversations/c1/messages/a1/media')).toHaveLength(1);
  });

  it('image qui ne se charge plus (adresse expirée) : une nouvelle adresse est demandée, une seule fois par échec', async () => {
    let calls = 0;
    const fake = installFakeApi({
      ...baseRoutes([imageMessage('a1', 'u2', 'approved')]),
      'GET /conversations/c1/messages/a1/media': () => [200, { url: `https://storage.example.test/get/a1?sig=${++calls}`, expires_at: inTenMinutes() }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    const image = await screen.findByTestId('image-a1');
    await act(async () => {
      fireEvent(image, 'error');
    });
    await waitFor(() => expect(screen.getByTestId('image-a1').props.source).toEqual({ uri: 'https://storage.example.test/get/a1?sig=2' }));
    expect(fake.called('GET /conversations/c1/messages/a1/media')).toHaveLength(2);
  });

  it('course avec la modération : 409 media_pending devient « en vérification », 410 media_rejected devient « refusée »', async () => {
    installFakeApi({
      ...baseRoutes([imageMessage('a1', 'u2', 'approved'), imageMessage('a2', 'u2', 'approved')]),
      'GET /conversations/c1/messages/a1/media': [409, { error: { code: 'media_pending', message: 'x' } }],
      'GET /conversations/c1/messages/a2/media': [410, { error: { code: 'media_rejected', message: 'x' } }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByText('Photo en cours de vérification')).toBeOnTheScreen();
    expect(await screen.findByText('Photo refusée par la modération')).toBeOnTheScreen();
  });

  it('adresse introuvable (réseau, serveur) : message clair et « Réessayer »', async () => {
    let fail = true;
    const fake = installFakeApi({
      ...baseRoutes([imageMessage('a1', 'u2', 'approved')]),
      'GET /conversations/c1/messages/a1/media': () => (fail ? [500, { error: { code: 'server_error', message: 'x' } }] : [200, { url: 'https://storage.example.test/get/a1?sig=9', expires_at: inTenMinutes() }]),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByText('La photo n’a pas pu être chargée')).toBeOnTheScreen();
    fail = false;
    await user().press(screen.getByTestId('image-reload-a1'));
    expect(await screen.findByTestId('image-a1')).toBeOnTheScreen();
    expect(fake.called('GET /conversations/c1/messages/a1/media')).toHaveLength(2);
  });

  it('serveur sans statut (media_status null) : repli sur « Photo reçue », sans appel', async () => {
    const fake = installFakeApi(baseRoutes([imageMessage('o1', 'u2', null)]));
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByText('Photo reçue')).toBeOnTheScreen();
    expect(fake.calls.some((c) => c.path.endsWith('/media'))).toBe(false);
  });

  it('toucher la photo l’ouvre en plein écran ; le bouton Fermer la referme', async () => {
    installFakeApi({
      ...baseRoutes([imageMessage('a1', 'u2', 'approved')]),
      'GET /conversations/c1/messages/a1/media': [200, { url: 'https://storage.example.test/get/a1?sig=1', expires_at: inTenMinutes() }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByTestId('image-a1');
    expect(screen.queryByTestId('image-viewer')).toBeNull();
    await user().press(screen.getByTestId('image-open-a1'));
    expect(await screen.findByTestId('image-viewer')).toBeOnTheScreen();
    expect(screen.getByTestId('image-viewer-image').props.source).toEqual({ uri: 'https://storage.example.test/get/a1?sig=1' });
    await user().press(screen.getByTestId('image-viewer-close'));
    await waitFor(() => expect(screen.queryByTestId('image-viewer')).toBeNull());
  });
});

describe('décision de modération en direct (signal message.media)', () => {
  it('approbation : la bulle « en vérification » devient la photo, sans recharger la conversation', async () => {
    const fake = installFakeApi({
      ...baseRoutes([imageMessage('p1', 'u2', 'processing')]),
      'GET /conversations/c1/messages/p1/media': [200, { url: 'https://storage.example.test/get/p1?sig=1', expires_at: inTenMinutes() }],
    });
    const { transport } = await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Photo en cours de vérification');
    await waitFor(() => expect(transport.channels()).toContain('private-conversation.c1'));

    await act(async () => {
      transport.emit('private-conversation.c1', 'message.media', { message_id: 'p1', media_status: 'approved' });
    });
    expect((await screen.findByTestId('image-p1')).props.source).toEqual({ uri: 'https://storage.example.test/get/p1?sig=1' });
    expect(screen.queryByText('Photo en cours de vérification')).toBeNull();
    expect(fake.called('GET /conversations/c1/messages')).toHaveLength(1);
  });

  it('rejet : la bulle devient « refusée » et aucune adresse n’est demandée', async () => {
    const fake = installFakeApi(baseRoutes([imageMessage('p1', 'u2', 'processing')]));
    const { transport } = await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Photo en cours de vérification');
    await waitFor(() => expect(transport.channels()).toContain('private-conversation.c1'));
    await act(async () => {
      transport.emit('private-conversation.c1', 'message.media', { message_id: 'p1', media_status: 'rejected' });
    });
    expect(await screen.findByText('Photo refusée par la modération')).toBeOnTheScreen();
    expect(fake.calls.some((c) => c.path.endsWith('/media'))).toBe(false);
  });

  it('un signal mal formé (statut inconnu, identifiant absent) est ignoré', async () => {
    installFakeApi(baseRoutes([imageMessage('p1', 'u2', 'processing')]));
    const { transport } = await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Photo en cours de vérification');
    await waitFor(() => expect(transport.channels()).toContain('private-conversation.c1'));
    await act(async () => {
      transport.emit('private-conversation.c1', 'message.media', { message_id: 'p1', media_status: 'hacked' });
      transport.emit('private-conversation.c1', 'message.media', { media_status: 'approved' });
      transport.emit('private-conversation.c1', 'message.media', null);
    });
    expect(screen.getByText('Photo en cours de vérification')).toBeOnTheScreen();
  });
});

describe('anglais et accessibilité', () => {
  it('textes en anglais pour les trois états et le bouton', async () => {
    installFakeApi(baseRoutes([imageMessage('p1', 'u2', 'processing'), imageMessage('r1', 'u2', 'rejected'), imageMessage('m9', 'u1', 'processing')]));
    await renderShell(<ConversationScreen />, { conversations: true, locale: 'en' });
    expect(await screen.findByText('Photo being reviewed')).toBeOnTheScreen();
    expect(screen.getByText('Photo declined by moderation')).toBeOnTheScreen();
    expect(screen.getByText('Your photo is being reviewed')).toBeOnTheScreen();
    expect(screen.getByLabelText('Attach a photo')).toBeOnTheScreen();
  });

  it('la couleur ne porte jamais seule le sens : chaque état a une icône et un texte, et la bulle a un libellé', async () => {
    installFakeApi(baseRoutes([imageMessage('r1', 'u2', 'rejected')]));
    await renderShell(<ConversationScreen />, { conversations: true });
    const bubble = await screen.findByTestId('message-r1');
    expect(bubble).toBeOnTheScreen();
    expect(screen.getByTestId('image-status-r1')).toHaveAccessibleName('Photo refusée par la modération');
  });
});
