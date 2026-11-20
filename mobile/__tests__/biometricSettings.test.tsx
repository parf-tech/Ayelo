import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { DeleteAccountScreen } from '../src/features/settings/DeleteAccountScreen';
import { ExportScreen } from '../src/features/settings/ExportScreen';
import { SessionsScreen } from '../src/features/settings/SessionsScreen';
import { SettingsScreen } from '../src/features/settings/SettingsScreen';
import { BiometricLockContext, type BiometricLockValue } from '../src/security/BiometricLockProvider';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { meFixture } from './helpers/fixtures';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => ({}),
}));

const ME = meFixture();
const user = () => userEvent.setup();

function fake(over: Partial<BiometricLockValue> = {}): BiometricLockValue {
  return {
    ready: true,
    supported: true,
    enabled: false,
    locked: false,
    setEnabled: jest.fn(async () => 'ok'),
    unlock: jest.fn(async () => true),
    confirm: jest.fn(async () => true),
    ...over,
  };
}

const withLock = (value: BiometricLockValue, ui: React.ReactElement) => (
  <BiometricLockContext.Provider value={value}>{ui}</BiometricLockContext.Provider>
);

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
});

afterEach(async () => {
  await act(async () => undefined);
});

const BILLING = { 'GET /billing/status': [200, { premium: false, subscription: null, credits: { conversation: 0 } }] };

describe('Réglages : verrouillage biométrique', () => {
  it('appareil sans verrouillage : l’option n’est pas proposée', async () => {
    installFakeApi({ 'GET /me': [200, ME], ...BILLING } as never);
    await renderShell(withLock(fake({ supported: false }), <SettingsScreen />));
    await screen.findByTestId('settings-privacy');
    expect(screen.queryByTestId('settings-biometric', { includeHiddenElements: true })).toBeNull();
  });

  it('proposée dans « Confidentialité et sécurité », désactivée par défaut, avec son explication', async () => {
    installFakeApi({ 'GET /me': [200, ME], ...BILLING } as never);
    await renderShell(withLock(fake(), <SettingsScreen />));
    const row = await screen.findByTestId('settings-biometric', { includeHiddenElements: true });
    expect(row).toBeTruthy();
    expect(screen.getByText('Verrouiller l’application', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(/après 1 minute/i, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /Verrouiller l’application/, checked: false })).toBeOnTheScreen();
  });

  it('activée : l’interrupteur est coché', async () => {
    installFakeApi({ 'GET /me': [200, ME], ...BILLING } as never);
    await renderShell(withLock(fake({ enabled: true }), <SettingsScreen />));
    expect(await screen.findByRole('switch', { name: /Verrouiller l’application/, checked: true })).toBeOnTheScreen();
  });

  it('basculer demande l’activation ; une annulation ne dit rien, un échec prévient', async () => {
    installFakeApi({ 'GET /me': [200, ME], ...BILLING } as never);
    const value = fake();
    await renderShell(withLock(value, <SettingsScreen />));
    await screen.findByTestId('settings-biometric', { includeHiddenElements: true });
    await act(async () => {
      fireEvent(screen.getByTestId('settings-biometric', { includeHiddenElements: true }), 'valueChange', true);
    });
    expect(value.setEnabled).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText('Le verrouillage n’a pas pu être modifié.')).toBeNull();

    (value.setEnabled as jest.Mock).mockResolvedValueOnce('cancelled');
    await act(async () => {
      fireEvent(screen.getByTestId('settings-biometric', { includeHiddenElements: true }), 'valueChange', true);
    });
    expect(screen.queryByText('Le verrouillage n’a pas pu être modifié.')).toBeNull();

    (value.setEnabled as jest.Mock).mockResolvedValueOnce('failed');
    await act(async () => {
      fireEvent(screen.getByTestId('settings-biometric', { includeHiddenElements: true }), 'valueChange', true);
    });
    expect(await screen.findByText('Le verrouillage n’a pas pu être modifié.')).toBeOnTheScreen();
  });
});

describe('actions sensibles : la biométrie s’ajoute au mot de passe', () => {
  it('suppression du compte : refusée par la biométrie, aucun appel ; acceptée, la requête part', async () => {
    const fakeApi = installFakeApi({
      'GET /me': [200, ME],
      'DELETE /me': [202, { status: 'scheduled', purge_after_days: 30 }],
    });
    const value = fake({ enabled: true, confirm: jest.fn(async () => false) });
    await renderShell(withLock(value, <DeleteAccountScreen />));
    const u = user();
    await u.type(screen.getByTestId('delete-password'), 'Motdepasse123');
    await u.press(screen.getByTestId('delete-confirm'));
    expect(value.confirm).toHaveBeenCalledTimes(1);
    expect(fakeApi.called('DELETE /me')).toHaveLength(0);

    (value.confirm as jest.Mock).mockResolvedValue(true);
    await u.press(screen.getByTestId('delete-confirm'));
    await waitFor(() => expect(fakeApi.called('DELETE /me')).toHaveLength(1));
    expect(fakeApi.called('DELETE /me')[0]?.body).toEqual({ password: 'Motdepasse123' });
  });

  it('suppression du compte sans mot de passe : l’erreur s’affiche sans invite biométrique', async () => {
    installFakeApi({ 'GET /me': [200, ME] });
    const value = fake({ enabled: true });
    await renderShell(withLock(value, <DeleteAccountScreen />));
    await user().press(screen.getByTestId('delete-confirm'));
    expect(screen.getByText('Saisissez votre mot de passe.')).toBeOnTheScreen();
    expect(value.confirm).not.toHaveBeenCalled();
  });

  it('export des données : refusé par la biométrie, aucun appel ; la touche « Terminé » passe aussi par la confirmation', async () => {
    const fakeApi = installFakeApi({
      'GET /me': [200, ME],
      'POST /me/export': [202, { id: 'e1', status: 'pending' }],
      'GET /me/export/e1': [200, { id: 'e1', status: 'pending' }],
    });
    const value = fake({ enabled: true, confirm: jest.fn(async () => false) });
    await renderShell(withLock(value, <ExportScreen />));
    const u = user();
    await u.type(screen.getByTestId('export-password'), 'Motdepasse123', { submitEditing: true });
    expect(value.confirm).toHaveBeenCalledTimes(1);
    expect(fakeApi.called('POST /me/export')).toHaveLength(0);

    (value.confirm as jest.Mock).mockResolvedValue(true);
    await u.press(screen.getByTestId('export-request'));
    await waitFor(() => expect(fakeApi.called('POST /me/export')).toHaveLength(1));
  });

  it('fermer une session : refusé par la biométrie, aucun appel ; accepté, la requête part', async () => {
    const sessions = {
      data: [
        { id: 's1', platform: 'android', app_version: '1.0.0', last_used_at: '2026-11-01T10:00:00Z', current: true },
        { id: 's2', platform: 'ios', app_version: '1.0.0', last_used_at: '2026-11-02T10:00:00Z', current: false },
      ],
    };
    const fakeApi = installFakeApi({
      'GET /me': [200, ME],
      'GET /auth/sessions': () => [200, sessions],
      'DELETE /auth/sessions/s2': emptyBody(),
    });
    const value = fake({ enabled: true, confirm: jest.fn(async () => false) });
    await renderShell(withLock(value, <SessionsScreen />));
    const u = user();
    await u.press(await screen.findByTestId('session-close-s2'));
    await u.press(screen.getByTestId('sessions-confirm-yes'));
    expect(value.confirm).toHaveBeenCalledTimes(1);
    expect(fakeApi.called('DELETE /auth/sessions/s2')).toHaveLength(0);

    (value.confirm as jest.Mock).mockResolvedValue(true);
    await u.press(screen.getByTestId('sessions-confirm-yes'));
    await waitFor(() => expect(fakeApi.called('DELETE /auth/sessions/s2')).toHaveLength(1));
  });
});
