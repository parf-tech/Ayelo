import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { VerificationScreen } from '../src/features/verification/VerificationScreen';
import { VerificationStatusScreen } from '../src/features/verification/VerificationStatusScreen';
import { pickImage } from '../src/media/picker';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { resetRouterMocks, router } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({}),
}));
jest.mock('../src/media/picker', () => ({ pickImage: jest.fn() }));

const pick = pickImage as jest.Mock;
const ME = meFixture();
const user = () => userEvent.setup();
const blob = (size: number) => ({ ok: true, status: 200, blob: async () => ({ size }) }) as unknown as Response;

const overview = (status: string, extra = {}) => ({
  verification_status: status,
  last_request: status === 'none' ? null : { id: 'v1', status: status === 'verified' ? 'approved' : status, reject_reason: null, created_at: '2026-11-06T10:00:00Z', reviewed_at: null, ...extra },
});

function routes(consentGranted = false, status = 'none') {
  return {
    'GET /me': [200, ME],
    'GET /me/verification/pose': [200, { pose: 'pouce levé' }],
    'GET /me/verification': [200, overview(status)],
    'GET /me/consents': [200, { data: consentGranted ? { verification_biometric: { granted: true, version: '1', since: 'x' } } : {} }],
  } as Record<string, [number, unknown]>;
}

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

describe('S40 Vérifier mon profil', () => {
  it('affiche la consigne de pose du serveur et exige le consentement biométrique distinct', async () => {
    const fake = installFakeApi(routes());
    pick.mockResolvedValue({ kind: 'picked', image: { uri: 'file:///selfie.jpg', mimeType: 'image/jpeg', fileSize: 10 } });
    await renderShell(<VerificationScreen />);
    expect(await screen.findByTestId('verify-pose')).toHaveTextContent('pouce levé');
    const u = user();
    await u.press(screen.getByTestId('verify-camera'));
    expect(await screen.findByTestId('verify-preview')).toBeOnTheScreen();
    await u.press(screen.getByTestId('verify-submit'));
    expect(screen.getByTestId('verify-consent-error')).toBeOnTheScreen();
    expect(fake.called('POST /me/consents')).toHaveLength(0);
    expect(fake.called('POST /media/upload-url')).toHaveLength(0);
  });

  it('parcours complet : consentement, selfie, envoi présigné, POST /me/verification, puis suivi', async () => {
    const fake = installFakeApi({
      ...routes(),
      'POST /me/consents': [204, undefined],
      'GET file:///selfie.jpg': blob(2048) as never,
      'POST /media/upload-url': [201, { media_id: 'sm1', upload: { url: 'https://storage.example.test/sm1', headers: { 'Content-Type': 'image/jpeg' } } }],
      'PUT https://storage.example.test/sm1': [200, {}],
      'POST /media/sm1/complete': [200, { media_id: 'sm1', status: 'processing' }],
      'POST /me/verification': [201, { id: 'v1', status: 'pending' }],
    });
    pick.mockResolvedValue({ kind: 'picked', image: { uri: 'file:///selfie.jpg', mimeType: 'image/jpeg', fileSize: 2048 } });
    await renderShell(<VerificationScreen />);
    const u = user();
    await screen.findByTestId('verify-pose');
    expect(pick).not.toHaveBeenCalled();
    await u.press(screen.getByTestId('verify-consent'));
    await u.press(screen.getByTestId('verify-camera'));
    expect(pick).toHaveBeenCalledWith('camera');
    await u.press(screen.getByTestId('verify-submit'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/verification/status'));
    expect(fake.called('POST /me/consents')[0]?.body).toEqual({ kind: 'verification_biometric', granted: true });
    expect(fake.called('POST /media/upload-url')[0]?.body).toEqual({ kind: 'verification_selfie', mime_type: 'image/jpeg', size_bytes: 2048 });
    expect(fake.called('POST /me/verification')[0]?.body).toEqual({ selfie_media_id: 'sm1' });
    // Ordre : consentement avant tout envoi du selfie.
    const order = fake.calls.map((c) => `${c.method} ${c.path}`);
    expect(order.indexOf('POST /me/consents')).toBeLessThan(order.indexOf('POST /media/upload-url'));
    // Le dépôt sur le stockage objet ne porte pas le jeton.
    expect(fake.called('PUT https://storage.example.test/sm1')[0]?.headers.Authorization).toBeUndefined();
  });

  it('consentement déjà accordé : pas de case, pas de nouvel appel de consentement', async () => {
    const fake = installFakeApi({
      ...routes(true),
      'GET file:///selfie.jpg': blob(10) as never,
      'POST /media/upload-url': [201, { media_id: 'sm2', upload: { url: 'https://storage.example.test/sm2', headers: {} } }],
      'PUT https://storage.example.test/sm2': [200, {}],
      'POST /media/sm2/complete': [200, { media_id: 'sm2', status: 'processing' }],
      'POST /me/verification': [201, { id: 'v2', status: 'pending' }],
    });
    pick.mockResolvedValue({ kind: 'picked', image: { uri: 'file:///selfie.jpg', mimeType: 'image/jpeg', fileSize: 10 } });
    await renderShell(<VerificationScreen />);
    await screen.findByTestId('verify-pose');
    expect(screen.queryByTestId('verify-consent')).not.toBeOnTheScreen();
    const u = user();
    await u.press(screen.getByTestId('verify-camera'));
    await u.press(screen.getByTestId('verify-submit'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/verification/status'));
    expect(fake.called('POST /me/consents')).toHaveLength(0);
  });

  it('caméra refusée : message avec la marche à suivre, aucun envoi', async () => {
    const fake = installFakeApi(routes());
    pick.mockResolvedValue({ kind: 'denied' });
    await renderShell(<VerificationScreen />);
    await screen.findByTestId('verify-pose');
    await user().press(screen.getByTestId('verify-camera'));
    expect(await screen.findByTestId('verify-banner')).toHaveTextContent(/Accès à la caméra refusé/);
    expect(fake.called('POST /media/upload-url')).toHaveLength(0);
  });

  it('selfie rejeté par le serveur (422 invalid_selfie) et demande déjà en cours (409)', async () => {
    const fake = installFakeApi({
      ...routes(true),
      'GET file:///selfie.jpg': blob(10) as never,
      'POST /media/upload-url': [201, { media_id: 'sm3', upload: { url: 'https://storage.example.test/sm3', headers: {} } }],
      'PUT https://storage.example.test/sm3': [200, {}],
      'POST /media/sm3/complete': [200, { media_id: 'sm3', status: 'processing' }],
      'POST /me/verification': [422, { error: { code: 'invalid_selfie', message: 'x' } }],
    });
    pick.mockResolvedValue({ kind: 'picked', image: { uri: 'file:///selfie.jpg', mimeType: 'image/jpeg', fileSize: 10 } });
    await renderShell(<VerificationScreen />);
    await screen.findByTestId('verify-pose');
    const u = user();
    await u.press(screen.getByTestId('verify-camera'));
    await u.press(screen.getByTestId('verify-submit'));
    expect(await screen.findByText('Ce selfie n’a pas pu être utilisé. Reprenez-en un.')).toBeOnTheScreen();
    fake.set('POST /me/verification', [409, { error: { code: 'already_pending', message: 'x' } }]);
    fake.set('POST /media/upload-url', [201, { media_id: 'sm4', upload: { url: 'https://storage.example.test/sm3', headers: {} } }]);
    fake.set('POST /media/sm4/complete', [200, { media_id: 'sm4', status: 'processing' }]);
    await u.press(screen.getByTestId('verify-submit'));
    expect(await screen.findByText('Une demande est déjà en cours.')).toBeOnTheScreen();
  });

  it('consentement manquant côté serveur (403 consent_required) : message dédié', async () => {
    installFakeApi({
      ...routes(true),
      'GET file:///selfie.jpg': blob(10) as never,
      'POST /media/upload-url': [201, { media_id: 'sm5', upload: { url: 'https://storage.example.test/sm5', headers: {} } }],
      'PUT https://storage.example.test/sm5': [200, {}],
      'POST /media/sm5/complete': [200, { media_id: 'sm5', status: 'processing' }],
      'POST /me/verification': [403, { error: { code: 'consent_required', message: 'x' } }],
    });
    pick.mockResolvedValue({ kind: 'picked', image: { uri: 'file:///selfie.jpg', mimeType: 'image/jpeg', fileSize: 10 } });
    await renderShell(<VerificationScreen />);
    await screen.findByTestId('verify-pose');
    const u = user();
    await u.press(screen.getByTestId('verify-camera'));
    await u.press(screen.getByTestId('verify-submit'));
    expect(await screen.findByText('Votre consentement est nécessaire pour continuer.')).toBeOnTheScreen();
  });

  it('demande déjà en attente ou profil déjà vérifié : pas de nouveau selfie, accès au suivi', async () => {
    installFakeApi(routes(true, 'pending'));
    await renderShell(<VerificationScreen />);
    expect(await screen.findByTestId('verify-already')).toBeOnTheScreen();
    expect(screen.queryByTestId('verify-camera')).not.toBeOnTheScreen();
    await user().press(screen.getByTestId('verify-see-status'));
    expect(router.replace).toHaveBeenCalledWith('/verification/status');
  });

  it('erreur de chargement : « Réessayer »', async () => {
    const fake = installFakeApi({ ...routes(), 'GET /me/verification/pose': [500, { error: { code: 'server_error', message: 'x' } }] });
    await renderShell(<VerificationScreen />);
    expect(await screen.findByTestId('async-retry')).toBeOnTheScreen();
    fake.set('GET /me/verification/pose', [200, { pose: 'main ouverte près du visage' }]);
    await user().press(screen.getByTestId('async-retry'));
    expect(await screen.findByTestId('verify-pose')).toHaveTextContent('main ouverte près du visage');
  });
});

describe('S41 État de la vérification', () => {
  it.each([
    ['pending', /en cours d’examen/],
    ['verified', /Profil vérifié/],
    ['none', /Aucune vérification demandée/],
  ])('statut %s', async (status, text) => {
    installFakeApi(routes(true, status));
    await renderShell(<VerificationStatusScreen />);
    expect(await screen.findByTestId('verification-status-banner')).toHaveTextContent(text);
  });

  it('refusé : motif affiché et possibilité de recommencer', async () => {
    installFakeApi({
      ...routes(true),
      'GET /me/verification': [200, overview('rejected', { reject_reason: 'Visage non visible' })],
    });
    await renderShell(<VerificationStatusScreen />);
    expect(await screen.findByTestId('verification-reason')).toHaveTextContent('Motif : Visage non visible');
    await user().press(screen.getByTestId('verification-retry'));
    expect(router.replace).toHaveBeenCalledWith('/verification');
  });

  it('en attente : actualisation périodique du statut', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      const fake = installFakeApi(routes(true, 'pending'));
      await renderShell(<VerificationStatusScreen />);
      await screen.findByTestId('verification-status-banner');
      const before = fake.called('GET /me/verification').length;
      await act(async () => {
        jest.advanceTimersByTime(30500);
      });
      await waitFor(() => expect(fake.called('GET /me/verification').length).toBeGreaterThan(before));
    } finally {
      jest.useRealTimers();
    }
  });
});
