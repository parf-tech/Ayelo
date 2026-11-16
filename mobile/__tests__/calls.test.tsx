import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { colors } from '../src/theme/tokens';
import { Button } from '../src/ui';
import { callReducer, CallInfo, CallState, initialCallState } from '../src/features/calls/callMachine';
import { useCalls } from '../src/features/calls/CallProvider';
import { CallScreen } from '../src/features/calls/CallScreen';
import { MediaUnavailableError, UnavailableMediaEngine } from '../src/features/calls/mediaEngine';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { resetRouterMocks, router } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({}),
}));

const ME = meFixture();
const user = () => userEvent.setup();
const LIVEKIT = { url: 'wss://livekit.example.test', room: 'call-1', token: 'jwt' };
const CALL: CallInfo = { id: 'k1', conversationId: 'c1', kind: 'audio', direction: 'out', peerId: 'u2', peerName: 'Awa', peerPhoto: null };

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
});

afterEach(async () => {
  await act(async () => undefined);
});

describe('machine d\'états des appels', () => {
  it('sortant : sonnerie -> accepté par le correspondant -> en cours -> terminé', () => {
    let s: CallState = callReducer(initialCallState, { type: 'OUTGOING', call: CALL, livekit: LIVEKIT });
    expect(s.phase).toBe('outgoing');
    s = callReducer(s, { type: 'REMOTE_STATE', callId: 'k1', state: 'accepted' });
    expect(s.phase).toBe('active');
    s = callReducer(s, { type: 'REMOTE_STATE', callId: 'k1', state: 'ended' });
    expect(s).toMatchObject({ phase: 'ended', reason: 'ended' });
  });

  it('sortant refusé, manqué ou occupé', () => {
    const out = callReducer(initialCallState, { type: 'OUTGOING', call: CALL, livekit: null });
    expect(callReducer(out, { type: 'REMOTE_STATE', callId: 'k1', state: 'declined' })).toMatchObject({ reason: 'declined' });
    expect(callReducer(out, { type: 'REMOTE_STATE', callId: 'k1', state: 'missed' })).toMatchObject({ reason: 'missed' });
    expect(callReducer(initialCallState, { type: 'BUSY', call: CALL })).toMatchObject({ phase: 'ended', reason: 'busy' });
  });

  it('entrant : accepter ouvre l\'appel ; annulation par l\'appelant le termine', () => {
    const incoming = callReducer(initialCallState, { type: 'INCOMING', call: { ...CALL, direction: 'in' } });
    expect(incoming.phase).toBe('incoming');
    expect(callReducer(incoming, { type: 'ACCEPTED', callId: 'k1', livekit: LIVEKIT, now: 1 }).phase).toBe('active');
    expect(callReducer(incoming, { type: 'CANCELLED', callId: 'k1', reason: 'cancelled' })).toMatchObject({ reason: 'cancelled' });
  });

  it('ignore les événements d\'un autre appel et n\'écrase jamais un appel en cours', () => {
    const active = callReducer(callReducer(initialCallState, { type: 'OUTGOING', call: CALL, livekit: null }), { type: 'ACCEPTED', callId: 'k1', now: 1 });
    expect(callReducer(active, { type: 'INCOMING', call: { ...CALL, id: 'k2', direction: 'in' } })).toBe(active);
    expect(callReducer(active, { type: 'CANCELLED', callId: 'autre', reason: 'missed' })).toBe(active);
    expect(callReducer(active, { type: 'REMOTE_STATE', callId: 'autre', state: 'ended' })).toBe(active);
  });
});

describe('MediaEngine « non disponible »', () => {
  it('ne simule rien : connexion et réglages échouent explicitement', async () => {
    const engine = new UnavailableMediaEngine();
    expect(engine.available).toBe(false);
    await expect(engine.connect()).rejects.toBeInstanceOf(MediaUnavailableError);
    await expect(engine.setMicrophoneEnabled()).rejects.toBeInstanceOf(MediaUnavailableError);
    await expect(engine.setCameraEnabled()).rejects.toBeInstanceOf(MediaUnavailableError);
    await expect(engine.disconnect()).resolves.toBeUndefined();
  });
});

function Harness() {
  const calls = useCalls();
  return (
    <>
      <Button
        testID="start-audio"
        label="start"
        onPress={() => void calls.startCall({ conversationId: 'c1', kind: 'audio', peerId: 'u2', peerName: 'Awa', peerPhoto: null })}
      />
      <CallScreen />
    </>
  );
}

const baseRoutes = () => ({ 'GET /me': [200, ME] }) as Record<string, [number, unknown]>;

describe('S15 à S18 : signalisation d\'appel', () => {
  it('appel sortant : POST /calls, écran de sonnerie, média indiqué indisponible', async () => {
    const fake = installFakeApi({
      ...baseRoutes(),
      'POST /calls': [201, { id: 'k1', status: 'ringing', ring_seconds: 30, livekit: LIVEKIT }],
    });
    await renderShell(<Harness />, { calls: true });
    await user().press(screen.getByTestId('start-audio'));
    expect(await screen.findByTestId('screen-call-outgoing')).toBeOnTheScreen();
    expect(fake.called('POST /calls')[0]?.body).toEqual({ conversation_id: 'c1', kind: 'audio' });
    expect(router.push).toHaveBeenCalledWith('/call');
    expect(screen.getByTestId('call-status')).toHaveTextContent('Appel audio : sonnerie en cours…');
    expect(screen.getByTestId('call-media-unavailable')).toHaveTextContent(/seule la sonnerie est transmise/);
  });

  it('refus par le correspondant (call.state sur le canal de la conversation) puis fermeture', async () => {
    installFakeApi({ ...baseRoutes(), 'POST /calls': [201, { id: 'k1', status: 'ringing', ring_seconds: 30, livekit: LIVEKIT }] });
    const { transport } = await renderShell(<Harness />, { calls: true });
    await user().press(screen.getByTestId('start-audio'));
    await screen.findByTestId('screen-call-outgoing');
    await waitFor(() => expect(transport.channels()).toContain('private-conversation.c1'));
    await act(async () => {
      transport.emit('private-conversation.c1', 'call.state', { call_id: 'k1', conversation_id: 'c1', state: 'declined', kind: 'audio' });
    });
    expect(await screen.findByTestId('screen-call-ended')).toBeOnTheScreen();
    expect(screen.getByTestId('call-status')).toHaveTextContent('Appel refusé');
    await user().press(screen.getByTestId('call-close'));
    expect(router.back).toHaveBeenCalled();
  });

  it('correspondant déjà en ligne (status busy) : résumé « déjà en ligne »', async () => {
    installFakeApi({ ...baseRoutes(), 'POST /calls': [200, { id: 'k1', status: 'busy' }] });
    await renderShell(<Harness />, { calls: true });
    await user().press(screen.getByTestId('start-audio'));
    expect(await screen.findByTestId('screen-call-ended')).toBeOnTheScreen();
    expect(screen.getByTestId('call-status')).toHaveTextContent('Cette personne est déjà en ligne');
  });

  it('annuler pendant la sonnerie : POST /calls/{id}/end', async () => {
    const fake = installFakeApi({
      ...baseRoutes(),
      'POST /calls': [201, { id: 'k1', status: 'ringing', ring_seconds: 30, livekit: LIVEKIT }],
      'POST /calls/k1/end': emptyBody(),
    });
    await renderShell(<Harness />, { calls: true });
    const u = user();
    await u.press(screen.getByTestId('start-audio'));
    await u.press(await screen.findByTestId('call-hangup'));
    await waitFor(() => expect(fake.called('POST /calls/k1/end')).toHaveLength(1));
    expect(await screen.findByTestId('call-status')).toHaveTextContent('Appel annulé');
  });

  it('sans réponse : au bout de la sonnerie (30 s), l\'appelant termine l\'appel', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      const fake = installFakeApi({
        ...baseRoutes(),
        'POST /calls': [201, { id: 'k1', status: 'ringing', ring_seconds: 30, livekit: LIVEKIT }],
        'POST /calls/k1/end': emptyBody(),
      });
      await renderShell(<Harness />, { calls: true });
      await act(async () => {
        await user().press(screen.getByTestId('start-audio'));
      });
      await screen.findByTestId('screen-call-outgoing');
      await act(async () => {
        jest.advanceTimersByTime(33500);
      });
      await waitFor(() => expect(fake.called('POST /calls/k1/end')).toHaveLength(1));
    } finally {
      jest.useRealTimers();
    }
  });

  it('démarrage refusé (403 match_required) : message d\'erreur, pas d\'écran d\'appel', async () => {
    installFakeApi({ ...baseRoutes(), 'POST /calls': [403, { error: { code: 'match_required', message: 'x' } }] });
    await renderShell(<Harness />, { calls: true });
    await user().press(screen.getByTestId('start-audio'));
    expect(await screen.findByText('Les appels sont réservés aux matchs.')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalledWith('/call');
  });

  it('appel entrant (call.incoming) : écran S16, accepter -> POST /calls/{id}/accept, média indisponible signalé', async () => {
    const fake = installFakeApi({
      ...baseRoutes(),
      'POST /calls/k9/accept': [200, { id: 'k9', status: 'accepted', livekit: LIVEKIT }],
      'POST /calls/k9/end': emptyBody(),
    });
    const { transport } = await renderShell(<Harness />, { calls: true });
    await waitFor(() => expect(transport.channels()).toContain('private-user.u1'));
    await act(async () => {
      transport.emit('private-user.u1', 'call.incoming', { call_id: 'k9', conversation_id: 'c1', kind: 'video', caller_id: 'u2', caller_name: 'Awa' });
    });
    expect(await screen.findByTestId('screen-call-incoming')).toBeOnTheScreen();
    expect(router.push).toHaveBeenCalledWith('/call');
    expect(screen.getByTestId('call-status')).toHaveTextContent('Appel vidéo entrant');

    const u = user();
    await u.press(screen.getByTestId('call-accept'));
    expect(await screen.findByTestId('screen-call-active')).toBeOnTheScreen();
    expect(fake.called('POST /calls/k9/accept')).toHaveLength(1);
    expect(screen.getByTestId('call-media-unavailable')).toBeOnTheScreen();
    // Boutons sans effet masqués (micro, caméra, haut-parleur) ; le chronomètre n'est pas une région vivante.
    expect(screen.queryByTestId('call-mute')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('call-camera')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('call-speaker')).not.toBeOnTheScreen();
    expect(screen.getByTestId('call-status')).toHaveProp('accessibilityLiveRegion', 'none');

    await u.press(screen.getByTestId('call-hangup'));
    await waitFor(() => expect(fake.called('POST /calls/k9/end')).toHaveLength(1));
    expect(await screen.findByTestId('screen-call-ended')).toBeOnTheScreen();
  });

  it('appel entrant refusé : POST /calls/{id}/decline', async () => {
    const fake = installFakeApi({ ...baseRoutes(), 'POST /calls/k9/decline': emptyBody() });
    const { transport } = await renderShell(<Harness />, { calls: true });
    await waitFor(() => expect(transport.channels()).toContain('private-user.u1'));
    await act(async () => {
      transport.emit('private-user.u1', 'call.incoming', { call_id: 'k9', conversation_id: 'c1', kind: 'audio', caller_id: 'u2', caller_name: 'Awa' });
    });
    await user().press(await screen.findByTestId('call-decline'));
    await waitFor(() => expect(fake.called('POST /calls/k9/decline')).toHaveLength(1));
    expect(await screen.findByTestId('screen-call-ended')).toBeOnTheScreen();
  });

  it('appel entrant annulé par l\'appelant (call.cancelled) : résumé « manqué »', async () => {
    installFakeApi(baseRoutes());
    const { transport } = await renderShell(<Harness />, { calls: true });
    await waitFor(() => expect(transport.channels()).toContain('private-user.u1'));
    await act(async () => {
      transport.emit('private-user.u1', 'call.incoming', { call_id: 'k9', conversation_id: 'c1', kind: 'audio', caller_id: 'u2', caller_name: 'Awa' });
    });
    await screen.findByTestId('screen-call-incoming');
    await act(async () => {
      transport.emit('private-user.u1', 'call.cancelled', { call_id: 'k9', reason: 'missed' });
    });
    expect(await screen.findByTestId('screen-call-ended')).toBeOnTheScreen();
    expect(screen.getByTestId('call-status')).toHaveTextContent('Appel manqué');
  });

  it('repos : sans appel, l\'écran renvoie vers les messages', async () => {
    installFakeApi(baseRoutes());
    await renderShell(<Harness />, { calls: true });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/messages'));
  });
});

describe('refonte visuelle (direction Prune) : présentation seule', () => {
  const incomingRoutes = () =>
    ({
      ...baseRoutes(),
      'POST /calls/k9/accept': [200, { id: 'k9', status: 'accepted', livekit: LIVEKIT }],
      'POST /calls/k9/end': emptyBody(),
    }) as Record<string, [number, unknown]>;
  const ring = async () => {
    const view = await renderShell(<Harness />, { calls: true });
    await waitFor(() => expect(view.transport.channels()).toContain('private-user.u1'));
    await act(async () => {
      view.transport.emit('private-user.u1', 'call.incoming', { call_id: 'k9', conversation_id: 'c1', kind: 'video', caller_id: 'u2', caller_name: 'Awa' });
    });
    await screen.findByTestId('screen-call-incoming');
  };

  it('fond prune pleine page, texte d’état en couleur onBrand, actions Refuser et Répondre présentes', async () => {
    installFakeApi(incomingRoutes());
    await ring();
    expect(StyleSheet.flatten(screen.getByTestId('screen-call-incoming').props.style).backgroundColor).toBe(colors.light.brand);
    expect(StyleSheet.flatten(screen.getByTestId('call-status').props.style).color).toBe(colors.light.onBrand);
    expect(screen.getByTestId('call-accept')).toHaveProp('accessibilityLabel', 'Répondre');
    expect(screen.getByTestId('call-decline')).toHaveProp('accessibilityLabel', 'Refuser');
  });

  it('en cours : chronomètre à chiffres de largeur fixe, signaler et raccrocher, aucune commande sans effet', async () => {
    installFakeApi(incomingRoutes());
    await ring();
    await user().press(screen.getByTestId('call-accept'));
    await screen.findByTestId('screen-call-active');
    expect(StyleSheet.flatten(screen.getByTestId('call-status').props.style).fontVariant).toEqual(['tabular-nums']);
    expect(screen.getByTestId('call-report')).toBeOnTheScreen();
    expect(screen.getByTestId('call-hangup')).toBeOnTheScreen();
    expect(screen.queryByTestId('call-mute')).not.toBeOnTheScreen();
  });
});
