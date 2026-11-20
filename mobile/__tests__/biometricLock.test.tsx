import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { AppState } from 'react-native';
import { I18nProvider } from '../src/i18n';
import { BiometricLockProvider, LOCK_DELAY_MS, useBiometricLock } from '../src/security/BiometricLockProvider';
import { authenticate, isBiometricAvailable } from '../src/security/biometrics';
import { STORAGE_KEYS } from '../src/storage/keys';

jest.mock('../src/security/biometrics', () => ({ isBiometricAvailable: jest.fn(), authenticate: jest.fn() }));

const mockAuth = jest.fn();
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => mockAuth() }));

const A = authenticate as jest.Mock;
const available = isBiometricAvailable as jest.Mock;
const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

const signedIn = { state: { status: 'signedIn', user: null, onboardingPending: false }, signOut: jest.fn() };
const signedOut = { state: { status: 'signedOut', user: null, onboardingPending: false }, signOut: jest.fn() };
const loading = { state: { status: 'loading', user: null, onboardingPending: false }, signOut: jest.fn() };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const handlers: ((state: string) => void)[] = [];
const clock = { now: 1_000_000 };
const appState = (next: string, at: number) =>
  act(async () => {
    clock.now = at;
    for (const handler of [...handlers]) handler(next);
  });

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider initialLocale="fr">
      <BiometricLockProvider>{children}</BiometricLockProvider>
    </I18nProvider>
  );
}

async function mount() {
  const hook = await renderHook(() => useBiometricLock(), { wrapper });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  handlers.length = 0;
  clock.now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock.now);
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (state: string) => void) => {
    handlers.push(handler);
    return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
  }) as never);
  available.mockResolvedValue(true);
  A.mockResolvedValue('success');
  mockAuth.mockReturnValue(signedIn);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('état initial', () => {
  it('préférence absente : ni verrou ni invite, l’option est proposée', async () => {
    const { result } = await mount();
    expect(result.current).toMatchObject({ supported: true, enabled: false, locked: false });
    expect(A).not.toHaveBeenCalled();
  });

  it('appareil sans aucun verrouillage : l’option n’est pas proposée', async () => {
    available.mockResolvedValue(false);
    const { result } = await mount();
    expect(result.current.supported).toBe(false);
  });

  it('sans fournisseur (tests, écrans isolés) : rien n’est verrouillé et toute confirmation passe', async () => {
    const { result } = await renderHook(() => useBiometricLock());
    expect(result.current).toMatchObject({ supported: false, enabled: false, locked: false });
    await expect(result.current.confirm()).resolves.toBe(true);
  });
});

describe('démarrage à froid avec le verrou activé', () => {
  beforeEach(() => store.set(STORAGE_KEYS.biometricLock, '1'));

  it('démarre verrouillé, une seule invite, déverrouille au succès', async () => {
    const pending = deferred<string>();
    A.mockReturnValue(pending.promise);
    const { result } = await mount();
    expect(result.current.locked).toBe(true);
    await waitFor(() => expect(A).toHaveBeenCalledTimes(1));
    expect(A).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Déverrouillez Ayelo', cancel: 'Annuler' }));
    await act(async () => pending.resolve('success'));
    await waitFor(() => expect(result.current.locked).toBe(false));
    expect(A).toHaveBeenCalledTimes(1);
  });

  it('invite annulée : reste verrouillé sans relancer l’invite ; « unlock » réessaie', async () => {
    A.mockResolvedValueOnce('cancelled');
    const { result } = await mount();
    await waitFor(() => expect(A).toHaveBeenCalledTimes(1));
    expect(result.current.locked).toBe(true);
    await act(async () => undefined);
    expect(A).toHaveBeenCalledTimes(1);
    A.mockResolvedValueOnce('success');
    await act(async () => {
      await expect(result.current.unlock()).resolves.toBe(true);
    });
    expect(result.current.locked).toBe(false);
  });

  it('échec de la biométrie : reste verrouillé', async () => {
    A.mockResolvedValue('failed');
    const { result } = await mount();
    await waitFor(() => expect(A).toHaveBeenCalled());
    expect(result.current.locked).toBe(true);
  });

  it('l’appareil n’a plus de verrouillage (indisponible à l’invite) : le verrou est levé et désactivé', async () => {
    A.mockResolvedValue('unavailable');
    const { result } = await mount();
    await waitFor(() => expect(result.current.locked).toBe(false));
    expect(result.current.enabled).toBe(false);
    expect(store.has(STORAGE_KEYS.biometricLock)).toBe(false);
  });

  it('préférence activée mais appareil sans verrouillage au démarrage : désactivée et effacée, pas de verrou', async () => {
    available.mockResolvedValue(false);
    const { result } = await mount();
    expect(result.current).toMatchObject({ enabled: false, locked: false, supported: false });
    expect(store.has(STORAGE_KEYS.biometricLock)).toBe(false);
    expect(A).not.toHaveBeenCalled();
  });

  it('session en cours de restauration : aucune invite, puis une fois la session ouverte', async () => {
    mockAuth.mockReturnValue(loading);
    const { rerender } = await mount();
    await act(async () => undefined);
    expect(A).not.toHaveBeenCalled();
    mockAuth.mockReturnValue(signedIn);
    await rerender({});
    await waitFor(() => expect(A).toHaveBeenCalledTimes(1));
  });

  it('déconnecté : pas de verrou, et la préférence est effacée (un autre compte repart sans verrou)', async () => {
    mockAuth.mockReturnValue(signedOut);
    const { result } = await mount();
    await waitFor(() => expect(store.has(STORAGE_KEYS.biometricLock)).toBe(false));
    expect(result.current).toMatchObject({ enabled: false, locked: false });
    expect(A).not.toHaveBeenCalled();
  });
});

describe('retour au premier plan', () => {
  async function unlockedAndEnabled() {
    store.set(STORAGE_KEYS.biometricLock, '1');
    const hook = await mount();
    await waitFor(() => expect(hook.result.current.locked).toBe(false));
    A.mockClear();
    return hook;
  }

  it('moins d’une minute en arrière-plan : pas de verrou', async () => {
    const { result } = await unlockedAndEnabled();
    await appState('background', 2_000_000);
    await appState('active', 2_000_000 + LOCK_DELAY_MS - 1);
    expect(result.current.locked).toBe(false);
    expect(A).not.toHaveBeenCalled();
  });

  it('une minute ou plus en arrière-plan : verrouille et lance l’invite', async () => {
    const { result } = await unlockedAndEnabled();
    A.mockResolvedValue('cancelled');
    await appState('background', 2_000_000);
    await appState('active', 2_000_000 + LOCK_DELAY_MS);
    expect(result.current.locked).toBe(true);
    await waitFor(() => expect(A).toHaveBeenCalledTimes(1));
  });

  it('l’état « inactive » (invite système, centre de notifications) ne compte pas comme un départ', async () => {
    const { result } = await unlockedAndEnabled();
    await appState('inactive', 2_000_000);
    await appState('active', 2_000_000 + 10 * LOCK_DELAY_MS);
    expect(result.current.locked).toBe(false);
  });

  it('pendant l’invite, les changements d’état de l’application ne reverrouillent pas', async () => {
    const { result } = await unlockedAndEnabled();
    const pending = deferred<string>();
    A.mockReturnValueOnce(pending.promise);
    let confirmation!: Promise<boolean>;
    await act(async () => {
      confirmation = result.current.confirm();
    });
    await appState('background', 3_000_000);
    await appState('active', 3_000_000 + 5 * LOCK_DELAY_MS);
    await act(async () => pending.resolve('success'));
    await expect(confirmation).resolves.toBe(true);
    expect(result.current.locked).toBe(false);
  });

  it('sans verrou activé : jamais de verrouillage', async () => {
    const { result } = await mount();
    await appState('background', 2_000_000);
    await appState('active', 2_000_000 + 10 * LOCK_DELAY_MS);
    expect(result.current.locked).toBe(false);
    expect(A).not.toHaveBeenCalled();
  });
});

describe('activer et désactiver', () => {
  it('activer : confirme d’abord, puis mémorise (stockage sécurisé)', async () => {
    const { result } = await mount();
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.setEnabled(true);
    });
    expect(outcome).toBe('ok');
    expect(A).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Confirmez pour activer le verrouillage de l’application' }));
    expect(store.get(STORAGE_KEYS.biometricLock)).toBe('1');
    expect(result.current.enabled).toBe(true);
    expect(result.current.locked).toBe(false);
  });

  it.each([
    ['cancelled', 'cancelled'],
    ['failed', 'failed'],
  ])('activer, invite « %s » : rien n’est activé', async (answer, expected) => {
    A.mockResolvedValue(answer);
    const { result } = await mount();
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.setEnabled(true);
    });
    expect(outcome).toBe(expected);
    expect(result.current.enabled).toBe(false);
    expect(store.has(STORAGE_KEYS.biometricLock)).toBe(false);
  });

  it('activer sur un appareil sans verrouillage : refusé, sans invite', async () => {
    available.mockResolvedValue(false);
    const { result } = await mount();
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.setEnabled(true);
    });
    expect(outcome).toBe('unsupported');
    expect(A).not.toHaveBeenCalled();
  });

  it('désactiver demande aussi la confirmation ; annulée, le verrou reste', async () => {
    store.set(STORAGE_KEYS.biometricLock, '1');
    const { result } = await mount();
    await waitFor(() => expect(result.current.locked).toBe(false));
    A.mockResolvedValue('cancelled');
    await act(async () => {
      await result.current.setEnabled(false);
    });
    expect(result.current.enabled).toBe(true);
    expect(store.get(STORAGE_KEYS.biometricLock)).toBe('1');
    A.mockResolvedValue('success');
    await act(async () => {
      await expect(result.current.setEnabled(false)).resolves.toBe('ok');
    });
    expect(A).toHaveBeenLastCalledWith(expect.objectContaining({ prompt: 'Confirmez pour désactiver le verrouillage' }));
    expect(result.current.enabled).toBe(false);
    expect(store.has(STORAGE_KEYS.biometricLock)).toBe(false);
  });
});

describe('confirmation avant une action sensible', () => {
  it('verrou désactivé : passe sans invite', async () => {
    const { result } = await mount();
    await act(async () => {
      await expect(result.current.confirm()).resolves.toBe(true);
    });
    expect(A).not.toHaveBeenCalled();
  });

  it.each([
    ['success', true],
    ['unavailable', true],
    ['cancelled', false],
    ['failed', false],
  ])('verrou activé, invite « %s » : %s', async (answer, expected) => {
    store.set(STORAGE_KEYS.biometricLock, '1');
    const { result } = await mount();
    await waitFor(() => expect(result.current.locked).toBe(false));
    A.mockClear();
    A.mockResolvedValue(answer);
    await act(async () => {
      await expect(result.current.confirm()).resolves.toBe(expected);
    });
    expect(A).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Confirmez cette action' }));
  });
});
