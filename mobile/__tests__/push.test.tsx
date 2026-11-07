import { renderHook, waitFor } from '@testing-library/react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { ApiError } from '../src/api';
import { registerForPush, usePushRegistration } from '../src/push/registerPush';

jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(),
}));

const mockAuth = jest.fn();
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => mockAuth() }));

const N = Notifications as jest.Mocked<typeof Notifications>;
const registerDevice = jest.fn(async () => undefined);
const api = { notifications: { registerDevice } } as never;
const removeListener = jest.fn();

function signedIn(onboardingPending: boolean) {
  return { state: { status: 'signedIn', user: null, onboardingPending }, api };
}

beforeEach(() => {
  (Device as { isDevice: boolean }).isDevice = true;
  N.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true } as never);
  N.requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
  N.getDevicePushTokenAsync.mockResolvedValue({ type: 'android', data: 'FCM-TOKEN' } as never);
  N.addPushTokenListener.mockReturnValue({ remove: removeListener } as never);
});

describe('registerForPush', () => {
  it('demande la permission puis enregistre le jeton natif', async () => {
    await expect(registerForPush(api)).resolves.toBe('FCM-TOKEN');
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(registerDevice).toHaveBeenCalledWith({ push_token: 'FCM-TOKEN', app_version: expect.any(String) });
  });

  it('permission déjà accordée : aucune invite', async () => {
    N.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true } as never);
    await registerForPush(api);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(registerDevice).toHaveBeenCalledTimes(1);
  });

  it('permission refusée : ni jeton ni appel API', async () => {
    N.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    await expect(registerForPush(api)).resolves.toBeNull();
    expect(N.getDevicePushTokenAsync).not.toHaveBeenCalled();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('refus définitif (canAskAgain faux) : pas de nouvelle invite', async () => {
    N.getPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);
    await expect(registerForPush(api)).resolves.toBeNull();
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('simulateur : rien ne se passe', async () => {
    (Device as { isDevice: boolean }).isDevice = false;
    await expect(registerForPush(api)).resolves.toBeNull();
    expect(N.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it("n'échoue jamais si l'API ou le système lève une erreur", async () => {
    registerDevice.mockRejectedValueOnce(new Error('409'));
    await expect(registerForPush(api)).resolves.toBeNull();
    N.getDevicePushTokenAsync.mockRejectedValueOnce(new Error('FCM indisponible'));
    await expect(registerForPush(api)).resolves.toBeNull();
  });
});

describe('409 push_token_in_use', () => {
  it("non fatal : pas de nouvelle tentative, pas d'exception, trace en développement seulement", async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    registerDevice.mockRejectedValueOnce(
      new ApiError({ status: 409, code: 'push_token_in_use', message: 'Ce jeton de notification est déjà utilisé par un autre compte.' }),
    );
    mockAuth.mockReturnValue(signedIn(false));
    const { rerender } = await renderHook(() => usePushRegistration());
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    await rerender({});
    await new Promise((r) => setTimeout(r, 20));
    expect(registerDevice).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('usePushRegistration', () => {
  it("n'agit pas avant la fin de l'onboarding (consentements et âge)", async () => {
    mockAuth.mockReturnValue(signedIn(true));
    await renderHook(() => usePushRegistration());
    expect(N.getPermissionsAsync).not.toHaveBeenCalled();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('visiteur ou session en cours de restauration : aucune invite', async () => {
    mockAuth.mockReturnValue({ state: { status: 'signedOut', user: null, onboardingPending: false }, api });
    await renderHook(() => usePushRegistration());
    mockAuth.mockReturnValue({ state: { status: 'loading', user: null, onboardingPending: false }, api });
    await renderHook(() => usePushRegistration());
    expect(N.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('session active et onboarding terminé : enregistre une seule fois', async () => {
    mockAuth.mockReturnValue(signedIn(false));
    const { rerender } = await renderHook(() => usePushRegistration());
    await waitFor(() => expect(registerDevice).toHaveBeenCalledTimes(1));
    await rerender({});
    expect(registerDevice).toHaveBeenCalledTimes(1);
  });

  it('renvoie le nouveau jeton quand le système le change, et se désabonne au démontage', async () => {
    mockAuth.mockReturnValue(signedIn(false));
    const { unmount } = await renderHook(() => usePushRegistration());
    await waitFor(() => expect(N.addPushTokenListener).toHaveBeenCalled());
    const listener = N.addPushTokenListener.mock.calls[0]![0] as (t: { data: string }) => void;
    listener({ data: 'ROTATED' });
    await waitFor(() => expect(registerDevice).toHaveBeenCalledWith(expect.objectContaining({ push_token: 'ROTATED' })));
    await unmount();
    expect(removeListener).toHaveBeenCalled();
  });
});
