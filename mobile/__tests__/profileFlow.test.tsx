import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import React, { useEffect } from 'react';
import { createApiClient, createEndpoints } from '../src/api';
import { ForgotPasswordScreen } from '../src/features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../src/features/auth/ResetPasswordScreen';
import { VerifyEmailLinkScreen } from '../src/features/emailVerification/VerifyEmailLinkScreen';
import { VerifyEmailScreen } from '../src/features/emailVerification/VerifyEmailScreen';
import { IntentScreen } from '../src/features/onboarding/IntentScreen';
import { ProfileDraft, useOnboardingDraft } from '../src/features/onboarding/OnboardingProvider';
import { PhotosScreen } from '../src/features/photos/PhotosScreen';
import { PreferencesScreen } from '../src/features/preferences/PreferencesScreen';
import { pickImage } from '../src/media/picker';
import { resolveImageMime, uploadMedia } from '../src/media/upload';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { probe, renderApp } from './helpers/app';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { media, meFixture, selfProfile } from './helpers/fixtures';
import { resetRouterMocks, router } from './helpers/routerMock';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('../src/media/picker', () => ({ pickImage: jest.fn() }));

const pick = pickImage as jest.Mock;
const user = () => userEvent.setup();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
});

afterEach(async () => {
  await act(async () => undefined);
});

function Prefill({ draft, children }: { draft: Partial<ProfileDraft>; children: React.ReactNode }) {
  const { update } = useOnboardingDraft();
  useEffect(() => {
    update(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

const blobResponse = (size: number) => ({ ok: true, status: 200, blob: async () => ({ size }) }) as unknown as Response;

describe('S05 : envoi du profil (PUT /me/profile)', () => {
  const full: Partial<ProfileDraft> = {
    displayName: ' Awa ',
    gender: 'woman',
    country: 'FR',
    originCountry: 'CI',
    city: 'Paris',
    intent: null,
  };

  it('envoie pays de résidence ET d\'origine, puis ouvre les photos', async () => {
    const api = installFakeApi({
      'PUT /me/profile': [201, meFixture()],
      'GET /me': [200, meFixture()],
    });
    await renderApp(
      <Prefill draft={full}>
        <IntentScreen />
      </Prefill>,
    );
    const u = user();
    await u.press(screen.getByTestId('intent-flirt'));
    await u.press(screen.getByTestId('intent-submit'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/onboarding/photos'));
    const put = api.called('PUT /me/profile')[0];
    expect(put?.body).toEqual({
      display_name: 'Awa',
      gender: 'woman',
      origin_country: 'CI',
      residence_country: 'FR',
      city: 'Paris',
      intent: 'flirt',
    });
  });

  it('refuse sans intention : aucun appel réseau', async () => {
    const api = installFakeApi({});
    await renderApp(
      <Prefill draft={full}>
        <IntentScreen />
      </Prefill>,
    );
    await user().press(screen.getByTestId('intent-submit'));
    expect(screen.getByText('Choisissez une option.')).toBeOnTheScreen();
    expect(api.fetchMock).not.toHaveBeenCalled();
  });

  it('erreur serveur : bannière traduite, on reste sur S05', async () => {
    installFakeApi({ 'PUT /me/profile': [500, { error: { code: 'server_error', message: 'x' } }] });
    await renderApp(
      <Prefill draft={full}>
        <IntentScreen />
      </Prefill>,
    );
    const u = user();
    await u.press(screen.getByTestId('intent-flirt'));
    await u.press(screen.getByTestId('intent-submit'));
    expect(await screen.findByText('Un problème est survenu de notre côté. Réessayez plus tard.')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('envoi de média (URL présignée)', () => {
  const api = () =>
    createEndpoints(
      createApiClient({ baseUrl: 'https://api.example.test', getDeviceId: async () => 'd', getToken: async () => 'T' }),
    );

  it('POST upload-url, PUT sur l\'URL présignée SANS jeton, puis POST complete', async () => {
    const fake = installFakeApi({
      'GET file:///photo.jpg': blobResponse(1234),
      'POST /media/upload-url': [
        201,
        { media_id: 'm1', upload: { url: 'https://storage.example.test/put', headers: { 'Content-Type': 'image/jpeg' } } },
      ],
      'PUT https://storage.example.test/put': [200, {}],
      'POST /media/m1/complete': [200, { media_id: 'm1', status: 'processing' }],
    });
    const result = await uploadMedia(api(), {
      kind: 'profile_photo',
      image: { uri: 'file:///photo.jpg', mimeType: 'image/jpeg', fileSize: null },
    });
    expect(result).toEqual({ media_id: 'm1', status: 'processing' });
    expect(fake.called('POST /media/upload-url')[0]?.body).toEqual({
      kind: 'profile_photo',
      mime_type: 'image/jpeg',
      size_bytes: 1234,
    });
    const put = fake.called('PUT https://storage.example.test/put')[0];
    expect(put?.headers).toEqual({ 'Content-Type': 'image/jpeg' });
    expect(put?.headers.Authorization).toBeUndefined();
  });

  it('échec du dépôt : la réservation est supprimée et une erreur upload_failed est levée', async () => {
    const fake = installFakeApi({
      'GET file:///photo.jpg': blobResponse(10),
      'POST /media/upload-url': [201, { media_id: 'm2', upload: { url: 'https://storage.example.test/put', headers: {} } }],
      'PUT https://storage.example.test/put': [403, {}],
      'DELETE /media/m2': emptyBody(),
    });
    await expect(
      uploadMedia(api(), { kind: 'profile_photo', image: { uri: 'file:///photo.jpg', mimeType: 'image/jpeg', fileSize: null } }),
    ).rejects.toMatchObject({ code: 'upload_failed' });
    expect(fake.called('DELETE /media/m2')).toHaveLength(1);
    expect(fake.called('POST /media/m2/complete')).toHaveLength(0);
  });

  it('format non pris en charge (HEIC) : refusé avant tout appel', async () => {
    const fake = installFakeApi({});
    await expect(
      uploadMedia(api(), { kind: 'profile_photo', image: { uri: 'file:///a.heic', mimeType: 'image/heic', fileSize: null } }),
    ).rejects.toMatchObject({ code: 'unsupported_format' });
    expect(fake.fetchMock).not.toHaveBeenCalled();
    expect(resolveImageMime({ uri: 'file:///a.PNG', mimeType: null })).toBe('image/png');
    expect(resolveImageMime({ uri: 'file:///a.jpg', mimeType: 'image/jpg' })).toBe('image/jpeg');
  });
});

describe('S06 Photos', () => {
  const twoPhotos = () =>
    meFixture({
      profile: selfProfile({ media: [media('p1', 0, 'approved'), media('p2', 1, 'processing')] }),
    });

  it('affiche les photos, le statut « En revue » et bloque « Continuer » sans photo', async () => {
    installFakeApi({ 'GET /me': [200, meFixture({ profile: selfProfile({ media: [] }) })] });
    await renderApp(<PhotosScreen />);
    expect(await screen.findByText('Aucune photo pour le moment.')).toBeOnTheScreen();
    await user().press(screen.getByTestId('photos-continue'));
    expect(screen.getByText('Ajoutez au moins une photo pour continuer.')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('état « en revue » visible et « Continuer » mène aux préférences', async () => {
    installFakeApi({ 'GET /me': [200, twoPhotos()] });
    await renderApp(<PhotosScreen />);
    expect(await screen.findByTestId('photo-status-p2')).toHaveTextContent('En revue');
    expect(screen.getByTestId('photo-status-p1')).toHaveTextContent('Approuvée');
    await user().press(screen.getByTestId('photos-continue'));
    expect(router.push).toHaveBeenCalledWith('/onboarding/preferences');
  });

  it('ajout : picker, upload présigné, puis rechargement de la grille', async () => {
    pick.mockResolvedValue({ kind: 'picked', image: { uri: 'file:///n.jpg', mimeType: 'image/jpeg', fileSize: 10 } });
    let meCalls = 0;
    const fake = installFakeApi({
      'GET /me': () => {
        meCalls += 1;
        return [200, meCalls === 1 ? meFixture({ profile: selfProfile({ media: [] }) }) : twoPhotos()];
      },
      'GET file:///n.jpg': blobResponse(99),
      'POST /media/upload-url': [201, { media_id: 'p2', upload: { url: 'https://storage.example.test/p2', headers: {} } }],
      'PUT https://storage.example.test/p2': [200, {}],
      'POST /media/p2/complete': [200, { media_id: 'p2', status: 'processing' }],
    });
    await renderApp(<PhotosScreen />);
    await screen.findByText('Aucune photo pour le moment.');
    await user().press(screen.getByTestId('photos-add'));
    expect(await screen.findByTestId('photo-status-p2')).toHaveTextContent('En revue');
    expect(fake.called('POST /media/p2/complete')).toHaveLength(1);
  });

  it('échec d\'envoi : message d\'erreur et bouton de nouvel essai', async () => {
    pick.mockResolvedValue({ kind: 'picked', image: { uri: 'file:///n.jpg', mimeType: 'image/jpeg', fileSize: 10 } });
    installFakeApi({
      'GET /me': [200, meFixture({ profile: selfProfile({ media: [] }) })],
      'GET file:///n.jpg': blobResponse(99),
      'POST /media/upload-url': [201, { media_id: 'p9', upload: { url: 'https://storage.example.test/p9', headers: {} } }],
      'PUT https://storage.example.test/p9': [500, {}],
      'DELETE /media/p9': emptyBody(),
    });
    await renderApp(<PhotosScreen />);
    await screen.findByText('Aucune photo pour le moment.');
    await user().press(screen.getByTestId('photos-add'));
    expect(await screen.findByText('L’envoi du fichier a échoué. Réessayez.')).toBeOnTheScreen();
    expect(screen.getByTestId('upload-retry-1')).toBeOnTheScreen();
  });

  it('réordonner : PUT /me/media/order avec tous les identifiants', async () => {
    const fake = installFakeApi({
      'GET /me': [200, twoPhotos()],
      'PUT /me/media/order': [200, { ids: ['p2', 'p1'] }],
    });
    await renderApp(<PhotosScreen />);
    await screen.findByTestId('photo-p1');
    await user().press(screen.getByTestId('photo-down-0'));
    await waitFor(() => expect(fake.called('PUT /me/media/order')).toHaveLength(1));
    expect(fake.called('PUT /me/media/order')[0]?.body).toEqual({ ids: ['p2', 'p1'] });
  });

  it('supprimer : confirmation puis DELETE /media/{id}', async () => {
    const fake = installFakeApi({
      'GET /me': [200, twoPhotos()],
      'DELETE /media/p2': emptyBody(),
    });
    await renderApp(<PhotosScreen />);
    await screen.findByTestId('photo-p2');
    const u = user();
    await u.press(screen.getByTestId('photo-delete-1'));
    expect(fake.called('DELETE /media/p2')).toHaveLength(0);
    await u.press(screen.getByTestId('photo-confirm-p2'));
    await waitFor(() => expect(fake.called('DELETE /media/p2')).toHaveLength(1));
  });
});

describe('S07 Préférences', () => {
  const prefs = {
    seeking_genders: [],
    age_min: 18,
    age_max: 99,
    countries: [],
    origins: [],
    intents: [],
    verified_only: false,
    max_distance_km: null,
  };

  it('charge GET /me/preferences, enregistre PUT puis termine l\'onboarding', async () => {
    const fake = installFakeApi({
      'GET /me/preferences': [200, prefs],
      'PUT /me/preferences': [200, prefs],
      'GET /me': [200, meFixture()],
    });
    await renderApp(<PreferencesScreen mode="onboarding" />);
    const u = user();
    await u.press(await screen.findByTestId('pref-seeking-man'));
    await u.press(screen.getByTestId('pref-age-min-plus'));
    await u.press(screen.getByTestId('pref-country-FR'));
    await u.press(screen.getByTestId('pref-intent-flirt'));
    await u.press(screen.getByTestId('prefs-save'));

    await waitFor(() => expect(fake.called('PUT /me/preferences')).toHaveLength(1));
    expect(fake.called('PUT /me/preferences')[0]?.body).toEqual({
      seeking_genders: ['man'],
      age_min: 19,
      age_max: 99,
      countries: ['FR'],
      origins: [],
      intents: ['flirt'],
      verified_only: false,
    });
    await waitFor(() => expect(probe.onboardingPending()).toBe('false'));
  });

  it('chargement impossible : erreur avec « Réessayer »', async () => {
    installFakeApi({ 'GET /me/preferences': [503, { error: { code: 'server_error', message: 'x' } }] });
    await renderApp(<PreferencesScreen mode="edit" />);
    expect(await screen.findByTestId('async-retry')).toBeOnTheScreen();
    expect(screen.getByTestId('prefs-save')).toBeDisabled();
  });
});

describe('S03 Vérification de l\'e-mail', () => {
  it('« Renvoyer » appelle POST /auth/email/resend puis impose un délai', async () => {
    const fake = installFakeApi({ 'POST /auth/email/resend': emptyBody() });
    await renderApp(<VerifyEmailScreen />);
    await user().press(screen.getByTestId('verify-resend'));
    await waitFor(() => expect(fake.called('POST /auth/email/resend')).toHaveLength(1));
    expect(await screen.findByText('Lien renvoyé. Pensez à vérifier vos courriers indésirables.')).toBeOnTheScreen();
    expect(screen.getByTestId('verify-resend')).toBeDisabled();
  });

  it('« J\'ai confirmé » : adresse non confirmée -> message, on reste ; confirmée -> suite', async () => {
    let verified = false;
    installFakeApi({ 'GET /me': () => [200, meFixture({ email_verified: verified, profile: null })] });
    await renderApp(<VerifyEmailScreen />);
    const u = user();
    await u.press(screen.getByTestId('verify-check'));
    expect(await screen.findByText('L’adresse n’est pas encore confirmée.')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
    verified = true;
    await u.press(screen.getByTestId('verify-check'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding/profile'));
  });

  it('429 au renvoi : message de limite, pas de délai de confirmation', async () => {
    installFakeApi({ 'POST /auth/email/resend': [429, { error: { code: 'rate_limited', message: 'x' }}] });
    await renderApp(<VerifyEmailScreen />);
    await user().press(screen.getByTestId('verify-resend'));
    expect(await screen.findByText('Trop de tentatives. Réessayez dans un moment.')).toBeOnTheScreen();
  });

  it('lien de confirmation : code collé -> POST /auth/email/verify', async () => {
    const fake = installFakeApi({ 'POST /auth/email/verify': emptyBody() });
    await renderApp(<VerifyEmailLinkScreen />);
    const u = user();
    expect(screen.getByTestId('verify-link-submit')).toBeDisabled();
    await u.type(screen.getByTestId('verify-link-token'), 'abc123');
    await u.press(screen.getByTestId('verify-link-submit'));
    expect(await screen.findByTestId('verify-link-success')).toBeOnTheScreen();
    expect(fake.called('POST /auth/email/verify')[0]?.body).toEqual({ token: 'abc123' });
  });

  it('lien expiré (422 invalid_token) : message traduit', async () => {
    installFakeApi({ 'POST /auth/email/verify': [422, { error: { code: 'invalid_token', message: 'x' } }] });
    await renderApp(<VerifyEmailLinkScreen />);
    const u = user();
    await u.type(screen.getByTestId('verify-link-token'), 'old');
    await u.press(screen.getByTestId('verify-link-submit'));
    expect(await screen.findByText('Ce lien est invalide ou a expiré.')).toBeOnTheScreen();
  });
});

describe('S61 Mot de passe oublié', () => {
  it('e-mail invalide : erreur locale sans appel', async () => {
    const fake = installFakeApi({});
    await renderApp(<ForgotPasswordScreen />);
    await user().press(screen.getByTestId('forgot-submit'));
    expect(screen.getByText('Saisissez votre adresse e-mail.')).toBeOnTheScreen();
    expect(fake.fetchMock).not.toHaveBeenCalled();
  });

  it('demande du lien : message neutre puis accès à la saisie du nouveau mot de passe', async () => {
    const fake = installFakeApi({ 'POST /auth/password/forgot': emptyBody() });
    await renderApp(<ForgotPasswordScreen />);
    const u = user();
    await u.type(screen.getByTestId('forgot-email'), 'a@b.fr');
    await u.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-sent')).toBeOnTheScreen();
    expect(fake.called('POST /auth/password/forgot')[0]?.body).toEqual({ email: 'a@b.fr' });
    await u.press(screen.getByTestId('forgot-have-link'));
    expect(router.push).toHaveBeenCalledWith('/reset-password');
  });

  it('réinitialisation : valide le mot de passe, envoie token + mot de passe, confirme', async () => {
    const fake = installFakeApi({ 'POST /auth/password/reset': emptyBody() });
    await renderApp(<ResetPasswordScreen />);
    const u = user();
    await u.type(screen.getByTestId('reset-token'), 'tok');
    await u.type(screen.getByTestId('reset-password'), 'court');
    await u.type(screen.getByTestId('reset-confirm'), 'autre');
    await u.press(screen.getByTestId('reset-submit'));
    expect(screen.getByText('Les deux mots de passe sont différents.')).toBeOnTheScreen();
    expect(fake.fetchMock).not.toHaveBeenCalled();

    await u.clear(screen.getByTestId('reset-password'));
    await u.clear(screen.getByTestId('reset-confirm'));
    await u.type(screen.getByTestId('reset-password'), 'Motdepasse123');
    await u.type(screen.getByTestId('reset-confirm'), 'Motdepasse123');
    await u.press(screen.getByTestId('reset-submit'));
    expect(await screen.findByTestId('reset-success')).toBeOnTheScreen();
    expect(fake.called('POST /auth/password/reset')[0]?.body).toEqual({ token: 'tok', password: 'Motdepasse123' });
    await u.press(screen.getByTestId('reset-to-login'));
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('jeton expiré : message traduit', async () => {
    installFakeApi({ 'POST /auth/password/reset': [422, { error: { code: 'invalid_token', message: 'x' } }] });
    await renderApp(<ResetPasswordScreen />);
    const u = user();
    await u.type(screen.getByTestId('reset-token'), 'old');
    await u.type(screen.getByTestId('reset-password'), 'Motdepasse123');
    await u.type(screen.getByTestId('reset-confirm'), 'Motdepasse123');
    await u.press(screen.getByTestId('reset-submit'));
    expect(await screen.findByText('Ce lien est invalide ou a expiré.')).toBeOnTheScreen();
  });
});

