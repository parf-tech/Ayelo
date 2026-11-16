import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { ProfileEditScreen } from '../src/features/profile/ProfileEditScreen';
import { ProfileTabScreen } from '../src/features/profile/ProfileTabScreen';
import { VerificationScreen } from '../src/features/verification/VerificationScreen';
import { poseLabel } from '../src/features/verification/poses';
import { translate } from '../src/i18n';
import { pickImage } from '../src/media/picker';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { emitBeforeRemove, navigation, resetRouterMocks, router } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

// Revue design, lot 3 : vérification du profil (poses traduites), profil (sortie protégée).

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({}),
}));
jest.mock('../src/media/picker', () => ({ pickImage: jest.fn() }));

const pick = pickImage as jest.Mock;
const ME = meFixture();
const user = () => userEvent.setup();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  pick.mockReset();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => undefined);
});

function verificationRoutes(pose = 'pouce levé') {
  return {
    'GET /me': [200, ME],
    'GET /me/verification/pose': [200, { pose }],
    'GET /me/verification': [200, { verification_status: 'none', last_request: null }],
    'GET /me/consents': [200, { data: {} }],
  } as never;
}

describe('S40 Vérification : pose traduite, aide, réglages de la caméra', () => {
  it('les quatre poses du serveur ont une traduction anglaise ; une pose inconnue s’affiche telle quelle', () => {
    const t = (key: Parameters<typeof translate>[1]) => translate('en', key);
    expect(['pouce levé', 'main ouverte près du visage', 'deux doigts levés', 'regard à gauche avec le sourire'].map((p) => poseLabel(t, p))).toEqual([
      'thumbs up',
      'open hand next to your face',
      'two fingers up',
      'looking left, smiling',
    ]);
    expect(poseLabel(t, 'nouvelle pose')).toBe('nouvelle pose');
    expect(poseLabel(t, undefined)).toBe('');
  });

  it('en anglais : la consigne et son explication utilisent la pose traduite', async () => {
    installFakeApi(verificationRoutes('deux doigts levés'));
    await renderShell(<VerificationScreen />, { locale: 'en' });
    expect(await screen.findByTestId('verify-pose')).toHaveTextContent('two fingers up');
    expect(screen.getByText('Take a selfie copying exactly this pose: two fingers up.')).toBeOnTheScreen();
  });

  it('en français : le texte reste celui du serveur', async () => {
    installFakeApi(verificationRoutes('regard à gauche avec le sourire'));
    await renderShell(<VerificationScreen />);
    expect(await screen.findByTestId('verify-pose')).toHaveTextContent('regard à gauche avec le sourire');
  });

  it('bouton d’envoi désactivé : une aide dit pourquoi, et elle disparaît une fois le selfie pris', async () => {
    installFakeApi(verificationRoutes());
    pick.mockResolvedValue({ kind: 'picked', image: { uri: 'file:///selfie.jpg', mimeType: 'image/jpeg', fileSize: 10 } });
    await renderShell(<VerificationScreen />);
    await screen.findByTestId('verify-pose');
    expect(screen.getByTestId('verify-submit')).toBeDisabled();
    expect(screen.getByTestId('verify-need-selfie')).toHaveTextContent('Prenez d’abord un selfie pour pouvoir l’envoyer.');
    await user().press(screen.getByTestId('verify-camera'));
    await screen.findByTestId('verify-preview');
    expect(screen.queryByTestId('verify-need-selfie')).toBeNull();
  });

  it('caméra refusée : l’avis propose d’ouvrir les réglages du téléphone', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    installFakeApi(verificationRoutes());
    pick.mockResolvedValue({ kind: 'denied' });
    await renderShell(<VerificationScreen />);
    await screen.findByTestId('verify-pose');
    const u = user();
    await u.press(screen.getByTestId('verify-camera'));
    expect(await screen.findByTestId('verify-banner')).toHaveTextContent(/Accès à la caméra refusé/);
    await u.press(screen.getByRole('button', { name: 'Ouvrir les réglages' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });
});

describe('S60 Édition du profil : modifications non enregistrées', () => {
  async function editBio(text = 'Nouvelle bio') {
    const bio = await screen.findByTestId('edit-bio');
    await act(async () => {
      fireEvent.changeText(bio, text);
    });
  }

  it('sans modification, la sortie n’est pas bloquée', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ProfileEditScreen />);
    await screen.findByTestId('edit-bio');
    expect(emitBeforeRemove()).toBe(false);
    expect(screen.queryByTestId('edit-unsaved')).toBeNull();
  });

  it('avec des modifications : la sortie est bloquée, un avis propose de rester ou de quitter', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ProfileEditScreen />);
    await editBio();
    let prevented = false;
    await act(async () => {
      prevented = emitBeforeRemove({ type: 'GO_BACK' });
    });
    expect(prevented).toBe(true);
    expect(await screen.findByTestId('edit-unsaved')).toHaveTextContent(/Vous avez des modifications non enregistrées/);

    const u = user();
    await u.press(screen.getByRole('button', { name: 'Continuer la modification' }));
    expect(screen.queryByTestId('edit-unsaved')).toBeNull();
    expect(navigation.dispatch).not.toHaveBeenCalled();

    await act(async () => {
      emitBeforeRemove({ type: 'GO_BACK' });
    });
    await u.press(await screen.findByRole('button', { name: 'Quitter sans enregistrer' }));
    expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
    // La sortie rejouée n'est plus bloquée.
    expect(emitBeforeRemove({ type: 'GO_BACK' })).toBe(false);
  });

  it('après un enregistrement réussi, on quitte sans avis', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'PUT /me/profile': [200, meFixture()] } as never);
    await renderShell(<ProfileEditScreen />);
    await editBio();
    await user().press(screen.getByTestId('edit-save'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(emitBeforeRemove()).toBe(false);
  });
});

describe('S59 Profil : anneau de la photo', () => {
  it('anneau circulaire (rayon pill) à bordure de 2 pt', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    await renderShell(<ProfileTabScreen />);
    let element: ReturnType<typeof screen.getByTestId> | null = await screen.findByTestId('profile-avatar');
    let ring: Record<string, number> | undefined;
    for (let depth = 0; element && depth < 5 && !ring; depth += 1) {
      const style = StyleSheet.flatten(element.props.style) as Record<string, number> | undefined;
      if (style?.borderWidth === 2) ring = style;
      element = element.parent;
    }
    expect(ring?.borderRadius).toBe(999);
  });
});
