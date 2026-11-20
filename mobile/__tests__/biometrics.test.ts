import * as LocalAuthentication from 'expo-local-authentication';
import { authenticate, isBiometricAvailable } from '../src/security/biometrics';

jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const L = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const labels = { prompt: 'Déverrouillez Ayelo', cancel: 'Annuler' };

describe('isBiometricAvailable : l’appareil a un verrouillage (biométrie ou code)', () => {
  it.each([
    ['code ou schéma seulement', 1, true],
    ['biométrie faible', 2, true],
    ['biométrie forte', 3, true],
    ['aucun verrouillage', 0, false],
  ])('%s', async (_label, level, expected) => {
    L.getEnrolledLevelAsync.mockResolvedValue(level as never);
    await expect(isBiometricAvailable()).resolves.toBe(expected);
  });

  it('module indisponible (web, simulateur) : faux, sans exception', async () => {
    L.getEnrolledLevelAsync.mockRejectedValue(new Error('not available on web'));
    await expect(isBiometricAvailable()).resolves.toBe(false);
  });
});

describe('authenticate', () => {
  it('succès : demande la biométrie avec repli sur le code de l’appareil et les libellés fournis', async () => {
    L.authenticateAsync.mockResolvedValue({ success: true } as never);
    await expect(authenticate(labels)).resolves.toBe('success');
    expect(L.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: 'Déverrouillez Ayelo', cancelLabel: 'Annuler', disableDeviceFallback: false }),
    );
  });

  it.each([
    ['user_cancel', 'cancelled'],
    ['system_cancel', 'cancelled'],
    ['app_cancel', 'cancelled'],
    ['not_enrolled', 'unavailable'],
    ['not_available', 'unavailable'],
    ['passcode_not_set', 'unavailable'],
    ['authentication_failed', 'failed'],
    ['lockout', 'failed'],
    ['timeout', 'failed'],
    ['unknown', 'failed'],
  ])('erreur « %s » : %s', async (error, expected) => {
    L.authenticateAsync.mockResolvedValue({ success: false, error } as never);
    await expect(authenticate(labels)).resolves.toBe(expected);
  });

  it('le module lève une exception : indisponible, jamais d’exception', async () => {
    L.authenticateAsync.mockRejectedValue(new Error('not available on web'));
    await expect(authenticate(labels)).resolves.toBe('unavailable');
  });
});
