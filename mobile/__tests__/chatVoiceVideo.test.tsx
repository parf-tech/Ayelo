import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { useVideoPlayer } from 'expo-video';
import { ConversationScreen } from '../src/features/messages/ConversationScreen';
import { pickImage, pickVideo } from '../src/media/picker';
import { createVoicePlayer } from '../src/media/voicePlayer';
import { startVoiceRecording } from '../src/media/voiceRecorder';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { installFakeApi } from './helpers/fakeApi';
import { conversation, meFixture, message, publicProfile } from './helpers/fixtures';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

/**
 * Notes vocales et vidéos en conversation (décision du propriétaire, 2026-11-22), même parcours que les photos : le message part
 * pendant le traitement serveur et la revue humaine, annoncé « en cours de vérification » ; la lecture n'est ouverte qu'à
 * l'approbation, par une adresse signée demandée à l'usage. L'envoi n'est proposé que si CHAT_AV_ENABLED.
 */

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({ id: 'c1', name: 'Awa', peerId: 'u2' }),
}));

const mockFlags = { av: true };
jest.mock('../src/config/features', () => ({
  CALLS_ENABLED: false,
  get CHAT_AV_ENABLED() {
    return mockFlags.av;
  },
}));
jest.mock('../src/media/picker', () => ({ pickImage: jest.fn(), pickVideo: jest.fn() }));
jest.mock('../src/media/voiceRecorder', () => ({ startVoiceRecording: jest.fn(), MAX_VOICE_SECONDS: 120 }));
jest.mock('../src/media/voicePlayer', () => ({ createVoicePlayer: jest.fn() }));

type FakePlayer = { url: string; onUpdate: (status: { playing: boolean; position: number; duration: number; finished: boolean }) => void; play: jest.Mock; pause: jest.Mock; release: jest.Mock };
const players: FakePlayer[] = [];
const startRecording = startVoiceRecording as jest.Mock;
const makePlayer = createVoicePlayer as jest.Mock;
const pickVid = pickVideo as jest.Mock;
const pickImg = pickImage as jest.Mock;

const ME = meFixture();
const PEER = publicProfile('u2', 'Awa');
const user = () => userEvent.setup();
const blobResponse = (size: number) => ({ ok: true, status: 200, blob: async () => ({ size }) }) as unknown as Response;
const inTenMinutes = () => new Date(Date.now() + 10 * 60_000).toISOString();

type Routes = Parameters<typeof installFakeApi>[0];
type MediaStatus = 'processing' | 'approved' | 'rejected' | null;

const media = (id: string, sender: string, type: 'voice' | 'video', status: MediaStatus, seconds: number | null = 42) =>
  message(id, sender, '', { type, body: null, media_id: `media-${id}`, media_status: status, media_duration_seconds: seconds });

const baseRoutes = (messages: unknown[] = []): Routes => ({
  'GET /me': [200, ME],
  'GET /conversations': [200, { data: [conversation('c1', PEER)] }],
  'GET /conversations/c1/messages': [200, { data: messages, next_cursor: null }],
  'POST /conversations/c1/read': [204, undefined],
  'POST /conversations/c1/delivered': [204, undefined],
});

const uploadRoutes = (file: string, mediaId: string, size: number): Routes => ({
  [`GET ${file}`]: blobResponse(size),
  'POST /media/upload-url': [201, { media_id: mediaId, upload: { url: 'https://storage.example.test/put', headers: {} } }],
  'PUT https://storage.example.test/put': [200, {}],
  [`POST /media/${mediaId}/complete`]: [200, { media_id: mediaId, status: 'processing' }],
});

const sentMessage = (type: 'voice' | 'video', clientId: unknown, seconds: number): [number, unknown] => [
  201,
  { ...media('s1', 'u1', type, 'processing', seconds), client_id: String(clientId), media_id: 'm1' },
];

const sessionOf = (over: Partial<{ stop: jest.Mock; cancel: jest.Mock }> = {}) => ({
  stop: jest.fn(async () => ({ uri: 'file:///v.m4a', durationSeconds: 7 })),
  cancel: jest.fn(async () => undefined),
  ...over,
});

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  mockFlags.av = true;
  players.length = 0;
  startRecording.mockReset();
  pickVid.mockReset();
  pickImg.mockReset();
  makePlayer.mockReset();
  makePlayer.mockImplementation((url: string, onUpdate: FakePlayer['onUpdate']) => {
    const player: FakePlayer = { url, onUpdate, play: jest.fn(), pause: jest.fn(), release: jest.fn() };
    players.push(player);
    return player;
  });
});

afterEach(async () => {
  await act(async () => undefined);
});

describe('envoi proposé seulement si le serveur l’accepte (CHAT_AV_ENABLED)', () => {
  it('désactivé : ni micro, ni choix de vidéo ; « Joindre » ouvre directement la galerie de photos', async () => {
    mockFlags.av = false;
    pickImg.mockResolvedValue({ kind: 'cancelled' });
    installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-attach'));
    expect(pickImg).toHaveBeenCalledWith('library');
    expect(screen.queryByTestId('conversation-record')).toBeNull();
    expect(screen.queryByTestId('conversation-attach-sheet')).toBeNull();
    expect(screen.getByTestId('conversation-send')).toBeOnTheScreen();
  });

  it('activé : le micro remplace « Envoyer » quand le champ est vide ; « Envoyer » revient dès qu’on écrit', async () => {
    installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByTestId('conversation-record')).toBeOnTheScreen();
    expect(screen.getByLabelText('Enregistrer un message vocal')).toBeOnTheScreen();
    expect(screen.queryByTestId('conversation-send')).toBeNull();

    await user().type(screen.getByTestId('conversation-input'), 'Salut');
    expect(screen.getByTestId('conversation-send')).toBeOnTheScreen();
    expect(screen.queryByTestId('conversation-record')).toBeNull();
  });

  it('activé : « Joindre » propose Photo et Vidéo', async () => {
    pickImg.mockResolvedValue({ kind: 'cancelled' });
    installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-attach'));
    expect(screen.getByTestId('conversation-attach-sheet')).toBeOnTheScreen();
    await user().press(screen.getByTestId('attach-photo'));
    expect(pickImg).toHaveBeenCalledWith('library');
    expect(screen.queryByTestId('conversation-attach-sheet')).toBeNull();
  });
});

describe('note vocale : enregistrer et envoyer', () => {
  it('micro, barre d’enregistrement, envoi : dépôt message_voice avec la durée, puis message voice « en vérification »', async () => {
    startRecording.mockResolvedValue({ kind: 'started', session: sessionOf() });
    const fake = installFakeApi({
      ...baseRoutes(),
      ...uploadRoutes('file:///v.m4a', 'm1', 70_000),
      'POST /conversations/c1/messages': (req) => sentMessage('voice', (req.body as { client_id: string }).client_id, 7),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-record'));

    expect(await screen.findByTestId('recording-bar')).toBeOnTheScreen();
    expect(screen.getByTestId('recording-time')).toHaveTextContent('0:00');
    expect(screen.queryByTestId('conversation-input')).toBeNull();

    await user().press(screen.getByTestId('recording-send'));

    expect(await screen.findByText('Votre message vocal est en cours de vérification')).toBeOnTheScreen();
    expect(screen.queryByTestId('recording-bar')).toBeNull();
    expect(fake.called('POST /media/upload-url')[0]?.body).toEqual({ kind: 'message_voice', mime_type: 'audio/mp4', size_bytes: 70_000, duration_seconds: 7 });
    const post = fake.called('POST /conversations/c1/messages')[0]?.body as Record<string, unknown>;
    expect(post).toMatchObject({ type: 'voice', media_id: 'm1' });
    expect(post).not.toHaveProperty('body');
  });

  it('annuler : l’enregistrement est abandonné, rien n’est envoyé', async () => {
    const session = sessionOf();
    startRecording.mockResolvedValue({ kind: 'started', session });
    const fake = installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-record'));
    await user().press(await screen.findByTestId('recording-cancel'));

    expect(session.cancel).toHaveBeenCalledTimes(1);
    expect(session.stop).not.toHaveBeenCalled();
    expect(screen.queryByTestId('recording-bar')).toBeNull();
    expect(screen.getByTestId('conversation-input')).toBeOnTheScreen();
    expect(fake.calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });

  it('micro refusé : explication claire, aucune barre', async () => {
    startRecording.mockResolvedValue({ kind: 'denied' });
    installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-record'));
    expect(await screen.findByTestId('conversation-notice')).toHaveTextContent('Autorisez le micro dans les réglages pour enregistrer un message vocal.');
    expect(screen.queryByTestId('recording-bar')).toBeNull();
  });

  it('panne du micro : message clair, aucune barre', async () => {
    startRecording.mockResolvedValue({ kind: 'error' });
    installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-record'));
    expect(await screen.findByTestId('conversation-notice')).toHaveTextContent('L’enregistrement n’a pas pu démarrer. Réessayez.');
    expect(screen.queryByTestId('recording-bar')).toBeNull();
  });

  it('enregistrement vide (aucun fichier) : rien n’est envoyé, la zone de saisie revient', async () => {
    startRecording.mockResolvedValue({ kind: 'started', session: sessionOf({ stop: jest.fn(async () => null) }) });
    const fake = installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-record'));
    await user().press(await screen.findByTestId('recording-send'));
    await waitFor(() => expect(screen.queryByTestId('recording-bar')).toBeNull());
    expect(await screen.findByTestId('conversation-notice')).toBeOnTheScreen();
    expect(fake.calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });

  it('dépôt en échec : « Renvoyer » dépose de nouveau la note', async () => {
    startRecording.mockResolvedValue({ kind: 'started', session: sessionOf() });
    let puts = 0;
    const fake = installFakeApi({
      ...baseRoutes(),
      ...uploadRoutes('file:///v.m4a', 'm1', 70_000),
      'DELETE /media/m1': [204, undefined],
      'PUT https://storage.example.test/put': () => [++puts === 1 ? 403 : 200, {}],
      'POST /conversations/c1/messages': (req) => sentMessage('voice', (req.body as { client_id: string }).client_id, 7),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-record'));
    await user().press(await screen.findByTestId('recording-send'));
    await screen.findByText('Échec de l’envoi');
    await user().press(screen.getByText('Renvoyer'));
    expect(await screen.findByText('Votre message vocal est en cours de vérification')).toBeOnTheScreen();
    expect(fake.called('POST /media/upload-url')).toHaveLength(2);
  });
});

describe('vidéo : choisir et envoyer', () => {
  const VIDEO = { uri: 'file:///c.mp4', mimeType: 'video/mp4', fileSize: 9_000_000, durationSeconds: 12 };

  async function openVideoPicker() {
    await user().press(await screen.findByTestId('conversation-attach'));
    await user().press(screen.getByTestId('attach-video'));
  }

  it('choisir une vidéo : dépôt message_video avec la durée, puis message video « en vérification »', async () => {
    pickVid.mockResolvedValue({ kind: 'picked', video: VIDEO });
    const fake = installFakeApi({
      ...baseRoutes(),
      ...uploadRoutes('file:///c.mp4', 'm1', 9_000_000),
      'POST /conversations/c1/messages': (req) => sentMessage('video', (req.body as { client_id: string }).client_id, 12),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await openVideoPicker();

    expect(await screen.findByText('Votre vidéo est en cours de vérification')).toBeOnTheScreen();
    expect(fake.called('POST /media/upload-url')[0]?.body).toEqual({ kind: 'message_video', mime_type: 'video/mp4', size_bytes: 9_000_000, duration_seconds: 12 });
    expect(fake.called('POST /conversations/c1/messages')[0]?.body).toMatchObject({ type: 'video', media_id: 'm1' });
  });

  it.each([
    ['plus de 30 secondes', { ...VIDEO, durationSeconds: 31 }, /30 secondes/],
    ['plus de 50 Mo', { ...VIDEO, fileSize: 51 * 1024 * 1024 }, /50 Mo/],
    ['format non accepté', { ...VIDEO, uri: 'file:///c.webm', mimeType: 'video/webm' }, /MP4 ou MOV/],
  ])('%s : annoncé avant tout dépôt', async (_label, video, notice) => {
    pickVid.mockResolvedValue({ kind: 'picked', video });
    const fake = installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await openVideoPicker();
    expect(await screen.findByTestId('conversation-notice')).toHaveTextContent(notice);
    expect(fake.called('POST /media/upload-url')).toHaveLength(0);
    expect(screen.queryByText('Échec de l’envoi')).toBeNull();
  });

  it('durée inconnue : le serveur reste juge, le dépôt part sans durée', async () => {
    pickVid.mockResolvedValue({ kind: 'picked', video: { ...VIDEO, durationSeconds: null } });
    const fake = installFakeApi({
      ...baseRoutes(),
      ...uploadRoutes('file:///c.mp4', 'm1', 9_000_000),
      'POST /conversations/c1/messages': (req) => sentMessage('video', (req.body as { client_id: string }).client_id, 12),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await openVideoPicker();
    await screen.findByText('Votre vidéo est en cours de vérification');
    expect(fake.called('POST /media/upload-url')[0]?.body).toEqual({ kind: 'message_video', mime_type: 'video/mp4', size_bytes: 9_000_000 });
  });

  it('sélection annulée : rien n’est envoyé', async () => {
    pickVid.mockResolvedValue({ kind: 'cancelled' });
    const fake = installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await openVideoPicker();
    expect(fake.calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });
});

describe('note vocale reçue', () => {
  it('en vérification ou refusée : un texte honnête, aucune adresse demandée', async () => {
    const fake = installFakeApi(baseRoutes([media('p1', 'u2', 'voice', 'processing'), media('r1', 'u2', 'voice', 'rejected'), media('p2', 'u1', 'voice', 'processing')]));
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByText('Message vocal en cours de vérification')).toBeOnTheScreen();
    expect(screen.getByText('Message vocal refusé par la modération')).toBeOnTheScreen();
    expect(screen.getByText('Votre message vocal est en cours de vérification')).toBeOnTheScreen();
    expect(fake.calls.some((c) => c.path.endsWith('/media'))).toBe(false);
  });

  it('approuvée : lecteur avec sa durée ; l’adresse n’est demandée qu’au premier « Écouter »', async () => {
    const fake = installFakeApi({
      ...baseRoutes([media('a1', 'u2', 'voice', 'approved', 42)]),
      'GET /conversations/c1/messages/a1/media': [200, { url: 'https://storage.example.test/get/a1', expires_at: inTenMinutes() }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByTestId('voice-time-a1')).toHaveTextContent('0:42');
    expect(fake.called('GET /conversations/c1/messages/a1/media')).toHaveLength(0);
    expect(makePlayer).not.toHaveBeenCalled();

    await user().press(screen.getByTestId('voice-play-a1'));

    await waitFor(() => expect(players).toHaveLength(1));
    expect(players[0]?.url).toBe('https://storage.example.test/get/a1');
    expect(players[0]?.play).toHaveBeenCalledTimes(1);
    expect(fake.called('GET /conversations/c1/messages/a1/media')).toHaveLength(1);
    expect(await screen.findByTestId('voice-pause-a1')).toBeOnTheScreen();
  });

  it('suit la lecture : position et durée mises à jour, retour au début à la fin', async () => {
    installFakeApi({
      ...baseRoutes([media('a1', 'u2', 'voice', 'approved', 42)]),
      'GET /conversations/c1/messages/a1/media': [200, { url: 'https://storage.example.test/get/a1', expires_at: inTenMinutes() }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('voice-play-a1'));
    await waitFor(() => expect(players).toHaveLength(1));

    await act(async () => players[0]!.onUpdate({ playing: true, position: 3, duration: 10, finished: false }));
    expect(screen.getByTestId('voice-time-a1')).toHaveTextContent('0:03 / 0:10');

    await act(async () => players[0]!.onUpdate({ playing: false, position: 10, duration: 10, finished: true }));
    expect(screen.getByTestId('voice-play-a1')).toBeOnTheScreen();
    expect(screen.getByTestId('voice-time-a1')).toHaveTextContent('0:10');
  });

  it('« Pause » met le lecteur en pause, « Écouter » reprend sans redemander l’adresse', async () => {
    const fake = installFakeApi({
      ...baseRoutes([media('a1', 'u2', 'voice', 'approved', 42)]),
      'GET /conversations/c1/messages/a1/media': [200, { url: 'https://storage.example.test/get/a1', expires_at: inTenMinutes() }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('voice-play-a1'));
    await waitFor(() => expect(players).toHaveLength(1));
    await act(async () => players[0]!.onUpdate({ playing: true, position: 1, duration: 10, finished: false }));

    await user().press(screen.getByTestId('voice-pause-a1'));
    expect(players[0]?.pause).toHaveBeenCalledTimes(1);
    await act(async () => players[0]!.onUpdate({ playing: false, position: 1, duration: 10, finished: false }));
    await user().press(screen.getByTestId('voice-play-a1'));

    expect(players[0]?.play).toHaveBeenCalledTimes(2);
    expect(players).toHaveLength(1);
    expect(fake.called('GET /conversations/c1/messages/a1/media')).toHaveLength(1);
  });

  it('une seule lecture à la fois : lancer une seconde note met la première en pause', async () => {
    installFakeApi({
      ...baseRoutes([media('a1', 'u2', 'voice', 'approved', 10), media('a2', 'u2', 'voice', 'approved', 20)]),
      'GET /conversations/c1/messages/a1/media': [200, { url: 'https://storage.example.test/get/a1', expires_at: inTenMinutes() }],
      'GET /conversations/c1/messages/a2/media': [200, { url: 'https://storage.example.test/get/a2', expires_at: inTenMinutes() }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('voice-play-a1'));
    await waitFor(() => expect(players).toHaveLength(1));
    await act(async () => players[0]!.onUpdate({ playing: true, position: 1, duration: 10, finished: false }));

    await user().press(screen.getByTestId('voice-play-a2'));
    await waitFor(() => expect(players).toHaveLength(2));

    expect(players[0]?.pause).toHaveBeenCalled();
    expect(players[1]?.play).toHaveBeenCalled();
  });

  it('course avec la modération (409 puis 410) et panne : texte clair, « Réessayer » en cas de panne', async () => {
    let fail = true;
    installFakeApi({
      ...baseRoutes([media('a1', 'u2', 'voice', 'approved'), media('a2', 'u2', 'voice', 'approved'), media('a3', 'u2', 'voice', 'approved')]),
      'GET /conversations/c1/messages/a1/media': [409, { error: { code: 'media_pending', message: 'x' } }],
      'GET /conversations/c1/messages/a2/media': [410, { error: { code: 'media_rejected', message: 'x' } }],
      'GET /conversations/c1/messages/a3/media': () => (fail ? [500, { error: { code: 'server_error', message: 'x' } }] : [200, { url: 'https://storage.example.test/get/a3', expires_at: inTenMinutes() }]),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('voice-play-a1'));
    expect(await screen.findByText('Message vocal en cours de vérification')).toBeOnTheScreen();
    await user().press(screen.getByTestId('voice-play-a2'));
    expect(await screen.findByText('Message vocal refusé par la modération')).toBeOnTheScreen();
    await user().press(screen.getByTestId('voice-play-a3'));
    expect(await screen.findByText('Le message vocal n’a pas pu être chargé')).toBeOnTheScreen();

    fail = false;
    await user().press(screen.getByTestId('voice-reload-a3'));
    await waitFor(() => expect(players).toHaveLength(1));
    expect(players[0]?.url).toBe('https://storage.example.test/get/a3');
  });

  it('approuvée en direct (signal message.media) : la note devient lisible', async () => {
    installFakeApi(baseRoutes([media('p1', 'u2', 'voice', 'processing', 15)]));
    const { transport } = await renderShell(<ConversationScreen />, { conversations: true });
    await screen.findByText('Message vocal en cours de vérification');
    await waitFor(() => expect(transport.channels()).toContain('private-conversation.c1'));
    await act(async () => {
      transport.emit('private-conversation.c1', 'message.media', { message_id: 'p1', media_status: 'approved' });
    });
    expect(await screen.findByTestId('voice-play-p1')).toBeOnTheScreen();
    expect(screen.getByTestId('voice-time-p1')).toHaveTextContent('0:15');
  });

  it('les lecteurs sont libérés quand l’écran se ferme', async () => {
    installFakeApi({
      ...baseRoutes([media('a1', 'u2', 'voice', 'approved', 10)]),
      'GET /conversations/c1/messages/a1/media': [200, { url: 'https://storage.example.test/get/a1', expires_at: inTenMinutes() }],
    });
    const view = await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('voice-play-a1'));
    await waitFor(() => expect(players).toHaveLength(1));
    await act(async () => view.unmount());
    expect(players[0]?.release).toHaveBeenCalled();
  });
});

describe('vidéo reçue', () => {
  it('en vérification ou refusée : un texte honnête, aucune adresse demandée', async () => {
    const fake = installFakeApi(baseRoutes([media('p1', 'u2', 'video', 'processing'), media('r1', 'u2', 'video', 'rejected'), media('p2', 'u1', 'video', 'processing')]));
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByText('Vidéo en cours de vérification')).toBeOnTheScreen();
    expect(screen.getByText('Vidéo refusée par la modération')).toBeOnTheScreen();
    expect(screen.getByText('Votre vidéo est en cours de vérification')).toBeOnTheScreen();
    expect(fake.calls.some((c) => c.path.endsWith('/media'))).toBe(false);
  });

  it('approuvée : carte avec sa durée ; l’adresse n’est demandée qu’à l’ouverture, puis le lecteur plein écran s’ouvre', async () => {
    const fake = installFakeApi({
      ...baseRoutes([media('a1', 'u2', 'video', 'approved', 12)]),
      'GET /conversations/c1/messages/a1/media': [200, { url: 'https://storage.example.test/get/v1', expires_at: inTenMinutes() }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByTestId('video-time-a1')).toHaveTextContent('0:12');
    expect(screen.getByLabelText('Lire la vidéo en plein écran')).toBeOnTheScreen();
    expect(fake.called('GET /conversations/c1/messages/a1/media')).toHaveLength(0);
    expect(screen.queryByTestId('video-viewer')).toBeNull();

    await user().press(screen.getByTestId('video-open-a1'));

    expect(await screen.findByTestId('video-view')).toBeOnTheScreen();
    expect(screen.getByTestId('video-viewer')).toBeOnTheScreen();
    expect(fake.called('GET /conversations/c1/messages/a1/media')).toHaveLength(1);
    expect(useVideoPlayer as jest.Mock).toHaveBeenCalledWith('https://storage.example.test/get/v1', expect.any(Function));

    await user().press(screen.getByTestId('video-viewer-close'));
    await waitFor(() => expect(screen.queryByTestId('video-viewer')).toBeNull());
  });

  it('adresse introuvable : message clair et « Réessayer », sans lecteur', async () => {
    let fail = true;
    installFakeApi({
      ...baseRoutes([media('a1', 'u2', 'video', 'approved', 12)]),
      'GET /conversations/c1/messages/a1/media': () => (fail ? [500, { error: { code: 'server_error', message: 'x' } }] : [200, { url: 'https://storage.example.test/get/v1', expires_at: inTenMinutes() }]),
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('video-open-a1'));
    expect(await screen.findByText('La vidéo n’a pas pu être chargée')).toBeOnTheScreen();
    expect(screen.queryByTestId('video-view')).toBeNull();

    fail = false;
    await user().press(screen.getByTestId('video-viewer-reload'));
    expect(await screen.findByTestId('video-view')).toBeOnTheScreen();
  });

  it('409 (course avec la modération) : le visionneur se ferme et la carte devient « en vérification »', async () => {
    installFakeApi({
      ...baseRoutes([media('a1', 'u2', 'video', 'approved', 12)]),
      'GET /conversations/c1/messages/a1/media': [409, { error: { code: 'media_pending', message: 'x' } }],
    });
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('video-open-a1'));
    expect(await screen.findByText('Vidéo en cours de vérification')).toBeOnTheScreen();
    expect(screen.queryByTestId('video-viewer')).toBeNull();
  });
});

describe('anglais et accessibilité', () => {
  it('textes en anglais : micro, choix de média, états', async () => {
    installFakeApi(baseRoutes([media('p1', 'u2', 'voice', 'processing'), media('r1', 'u2', 'video', 'rejected')]));
    await renderShell(<ConversationScreen />, { conversations: true, locale: 'en' });
    expect(await screen.findByText('Voice message being reviewed')).toBeOnTheScreen();
    expect(screen.getByText('Video declined by moderation')).toBeOnTheScreen();
    expect(screen.getByLabelText('Record a voice message')).toBeOnTheScreen();
  });

  it('la barre d’enregistrement est annoncée et chaque bouton a un nom d’action', async () => {
    startRecording.mockResolvedValue({ kind: 'started', session: sessionOf() });
    installFakeApi(baseRoutes());
    await renderShell(<ConversationScreen />, { conversations: true });
    await user().press(await screen.findByTestId('conversation-record'));
    expect(await screen.findByLabelText('Annuler l’enregistrement')).toBeOnTheScreen();
    expect(screen.getByLabelText('Envoyer le message vocal')).toBeOnTheScreen();
    expect(screen.getByTestId('recording-bar')).toHaveAccessibleName(/Enregistrement en cours/);
  });
});
