import { act, renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { pushDestination } from '../src/push/pushRouting';
import { usePushReception } from '../src/push/usePushReception';
import { resetRouterMocks, router } from './helpers/routerMock';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
}));

let mockPathname = '/discover';
/** Navigateur racine simulé : `isReady` est le test qu'expo-router fait avant de naviguer. */
const mockNav = {
  ready: true,
  listeners: new Set<() => void>(),
  ref: {
    isReady: () => mockNav.ready,
    addListener: (_type: string, listener: () => void) => {
      mockNav.listeners.add(listener);
      return () => mockNav.listeners.delete(listener);
    },
  },
  becomeReady() {
    mockNav.ready = true;
    for (const listener of [...mockNav.listeners]) listener();
  },
};
jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  usePathname: () => mockPathname,
  useNavigationContainerRef: () => mockNav.ref,
}));

const mockAuth = jest.fn();
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => mockAuth() }));

const N = Notifications as jest.Mocked<typeof Notifications>;
const removeListener = jest.fn();

const CONV = '3f9c2a10-7b1e-4c55-9d2a-0a1b2c3d4e5f';
const OTHER = '8d7e6f50-1a2b-4c3d-8e9f-a0b1c2d3e4f5';

type Behavior = { shouldShowBanner: boolean; shouldShowList: boolean; shouldPlaySound: boolean; shouldSetBadge: boolean };

const status = (kind: 'in' | 'out' | 'loading' | 'onboarding') => ({
  state: {
    status: kind === 'in' || kind === 'onboarding' ? 'signedIn' : kind === 'out' ? 'signedOut' : 'loading',
    user: null,
    onboardingPending: kind === 'onboarding',
  },
});

const notification = (data: unknown, identifier = 'n-1') => ({ request: { identifier, content: { data } } });
const response = (data: unknown, identifier = 'n-1') => ({ notification: notification(data, identifier), actionIdentifier: 'default' });

/** Dernier gestionnaire de premier plan installé auprès d'expo-notifications. */
function foreground(data: unknown): Promise<Behavior> {
  const handler = N.setNotificationHandler.mock.calls.at(-1)![0]!;
  return handler.handleNotification(notification(data) as never) as Promise<Behavior>;
}

/** Simule un toucher sur une notification pendant que l'application tourne. */
async function tap(data: unknown, identifier = 'n-1') {
  const listener = N.addNotificationResponseReceivedListener.mock.calls.at(-1)![0] as (r: unknown) => void;
  await act(async () => listener(response(data, identifier)));
}

const message = (conversationId: unknown) => ({ type: 'message', conversation_id: conversationId });

beforeEach(() => {
  jest.clearAllMocks();
  resetRouterMocks();
  mockPathname = '/discover';
  mockNav.ready = true;
  mockNav.listeners.clear();
  mockAuth.mockReturnValue(status('in'));
  N.addNotificationResponseReceivedListener.mockReturnValue({ remove: removeListener } as never);
  N.getLastNotificationResponse.mockReturnValue(null);
});

describe('pushDestination (données du serveur, jamais fiables)', () => {
  it('un message mène à sa conversation', () => {
    expect(pushDestination(message(CONV))).toBe(`/conversation/${CONV}`);
  });

  it.each([
    ['identifiant manquant', { type: 'message' }],
    ['identifiant numérique', message(12345678)],
    ['identifiant trop court', message('abc')],
    ['remontée de chemin', message('../settings/delete')],
    ['barre oblique encodée', message('a1b2c3d4%2Fsettings')],
    ['paramètre de requête glissé', message(`${CONV}?redirect=/settings`)],
    ['barre oblique', message(`${CONV}/../../settings`)],
    ['type inconnu', { type: 'promo', conversation_id: CONV }],
    ['appel : aucun écran', { type: 'call', call_id: CONV }],
    ['données absentes', undefined],
    ['données nulles', null],
    ['données en texte', 'message'],
    ['tableau', [CONV]],
  ])('%s : ignoré', (_label, data) => {
    expect(pushDestination(data)).toBeNull();
  });
});

describe('notification reçue au premier plan', () => {
  it('installe un gestionnaire, retiré au démontage', async () => {
    const { unmount } = await renderHook(() => usePushReception());
    expect(N.setNotificationHandler).toHaveBeenCalledTimes(1);
    expect(N.setNotificationHandler.mock.calls[0]![0]).not.toBeNull();
    await unmount();
    expect(N.setNotificationHandler).toHaveBeenLastCalledWith(null);
  });

  it('message d’une autre conversation : bannière, liste et son', async () => {
    mockPathname = `/conversation/${OTHER}`;
    await renderHook(() => usePushReception());
    await expect(foreground(message(CONV))).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it('conversation déjà ouverte : ni bannière, ni liste, ni son', async () => {
    mockPathname = `/conversation/${CONV}`;
    await renderHook(() => usePushReception());
    await expect(foreground(message(CONV))).resolves.toEqual({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });

  it('suit l’écran courant : après être sorti de la conversation, la bannière revient', async () => {
    mockPathname = `/conversation/${CONV}`;
    const { rerender } = await renderHook(() => usePushReception());
    expect((await foreground(message(CONV))).shouldShowBanner).toBe(false);
    mockPathname = '/messages';
    await rerender({});
    expect((await foreground(message(CONV))).shouldShowBanner).toBe(true);
  });

  it('données inattendues : la notification s’affiche, sans erreur', async () => {
    await renderHook(() => usePushReception());
    expect((await foreground({ type: 'promo' })).shouldShowBanner).toBe(true);
    expect((await foreground(undefined)).shouldShowBanner).toBe(true);
  });

  it('sans session ouverte ou pendant l’onboarding : rien ne s’affiche', async () => {
    for (const kind of ['out', 'onboarding', 'loading'] as const) {
      mockAuth.mockReturnValue(status(kind));
      await renderHook(() => usePushReception());
      expect((await foreground(message(CONV))).shouldShowBanner).toBe(false);
    }
  });
});

describe('toucher une notification, application ouverte', () => {
  it('un message ouvre la conversation', async () => {
    await renderHook(() => usePushReception());
    await tap(message(CONV));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(`/conversation/${CONV}`);
  });

  it('un identifiant mal formé est ignoré, sans erreur ni trace', async () => {
    const spies = (['log', 'warn', 'error'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
    await renderHook(() => usePushReception());
    await tap(message('../../settings/delete'), 'bad-1');
    await tap(message(null), 'bad-2');
    await tap(undefined, 'bad-3');
    await tap({ type: 'message', conversation_id: { toString: () => CONV } }, 'bad-4');
    expect(router.push).not.toHaveBeenCalled();
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  it('une réponse sans structure attendue ne fait pas planter', async () => {
    await renderHook(() => usePushReception());
    const listener = N.addNotificationResponseReceivedListener.mock.calls.at(-1)![0] as (r: unknown) => void;
    await act(async () => listener({}));
    await act(async () => listener(null));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('un appel ouvre l’application sans écran d’appel', async () => {
    await renderHook(() => usePushReception());
    await tap({ type: 'call', call_id: CONV });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('la conversation déjà affichée n’est pas empilée une seconde fois', async () => {
    mockPathname = `/conversation/${CONV}`;
    await renderHook(() => usePushReception());
    await tap(message(CONV));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('un même toucher reçu deux fois n’ouvre qu’une conversation', async () => {
    await renderHook(() => usePushReception());
    await tap(message(CONV), 'same');
    await tap(message(CONV), 'same');
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('une erreur de navigation est avalée', async () => {
    router.push.mockImplementationOnce(() => {
      throw new Error('navigation pas prête');
    });
    await renderHook(() => usePushReception());
    await tap(message(CONV));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('déconnecté : aucune navigation', async () => {
    mockAuth.mockReturnValue(status('out'));
    await renderHook(() => usePushReception());
    await tap(message(CONV));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('onboarding en cours : aucune navigation', async () => {
    mockAuth.mockReturnValue(status('onboarding'));
    await renderHook(() => usePushReception());
    await tap(message(CONV));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('se désabonne au démontage', async () => {
    const { unmount } = await renderHook(() => usePushReception());
    await unmount();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});

describe('démarrage à froid (application fermée, toucher sur la notification)', () => {
  it('ouvre la conversation une seule fois, même après un nouveau rendu', async () => {
    N.getLastNotificationResponse.mockReturnValue(response(message(CONV), 'cold') as never);
    const { rerender } = await renderHook(() => usePushReception());
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(`/conversation/${CONV}`);
    expect(N.clearLastNotificationResponse).toHaveBeenCalled();
    await rerender({});
    await rerender({});
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('attend la restauration de la session, puis ouvre la conversation une seule fois', async () => {
    mockAuth.mockReturnValue(status('loading'));
    N.getLastNotificationResponse.mockReturnValue(response(message(CONV), 'cold') as never);
    const { rerender } = await renderHook(() => usePushReception());
    expect(router.push).not.toHaveBeenCalled();
    mockAuth.mockReturnValue(status('in'));
    await rerender({});
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(`/conversation/${CONV}`);
    await rerender({});
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('le même toucher livré aussi par l’écouteur n’ouvre qu’une conversation', async () => {
    N.getLastNotificationResponse.mockReturnValue(response(message(CONV), 'cold') as never);
    await renderHook(() => usePushReception());
    await tap(message(CONV), 'cold');
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('session absente : aucune navigation, et pas de rejeu après une connexion ultérieure', async () => {
    mockAuth.mockReturnValue(status('loading'));
    N.getLastNotificationResponse.mockReturnValue(response(message(CONV), 'cold') as never);
    const { rerender } = await renderHook(() => usePushReception());
    mockAuth.mockReturnValue(status('out'));
    await rerender({});
    mockAuth.mockReturnValue(status('in'));
    await rerender({});
    expect(router.push).not.toHaveBeenCalled();
  });

  it('onboarding en cours : aucune navigation, et pas de rejeu une fois terminé', async () => {
    mockAuth.mockReturnValue(status('onboarding'));
    N.getLastNotificationResponse.mockReturnValue(response(message(CONV), 'cold') as never);
    const { rerender } = await renderHook(() => usePushReception());
    mockAuth.mockReturnValue(status('in'));
    await rerender({});
    expect(router.push).not.toHaveBeenCalled();
  });

  it('données mal formées : ignorées, sans erreur', async () => {
    N.getLastNotificationResponse.mockReturnValue(response(message('../x'), 'cold') as never);
    await renderHook(() => usePushReception());
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('navigateur pas encore prêt (démarrage à froid)', () => {
  it('le toucher qui a lancé l’application attend le navigateur, puis ouvre la conversation une seule fois', async () => {
    mockNav.ready = false;
    N.getLastNotificationResponse.mockReturnValue(response(message(CONV), 'cold') as never);
    const { rerender } = await renderHook(() => usePushReception());
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => mockNav.becomeReady());
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(`/conversation/${CONV}`);
    await rerender({});
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('un toucher reçu avant que le navigateur soit prêt est conservé, pas perdu', async () => {
    mockNav.ready = false;
    await renderHook(() => usePushReception());
    await tap(message(CONV), 'early');
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => mockNav.becomeReady());
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('navigateur prêt mais session absente : toujours aucune navigation', async () => {
    mockNav.ready = false;
    mockAuth.mockReturnValue(status('out'));
    N.getLastNotificationResponse.mockReturnValue(response(message(CONV), 'cold') as never);
    await renderHook(() => usePushReception());
    await act(async () => mockNav.becomeReady());
    expect(router.push).not.toHaveBeenCalled();
  });

  it('au premier plan, rien ne s’affiche tant que le navigateur n’est pas prêt', async () => {
    mockNav.ready = false;
    await renderHook(() => usePushReception());
    expect((await foreground(message(CONV))).shouldShowBanner).toBe(false);
    await act(async () => mockNav.becomeReady());
    expect((await foreground(message(CONV))).shouldShowBanner).toBe(true);
  });

  it('cesse d’écouter le navigateur une fois prêt et au démontage', async () => {
    mockNav.ready = false;
    const { unmount } = await renderHook(() => usePushReception());
    expect(mockNav.listeners.size).toBe(1);
    await act(async () => mockNav.becomeReady());
    expect(mockNav.listeners.size).toBe(0);
    await unmount();
    mockNav.ready = false;
    const second = await renderHook(() => usePushReception());
    await second.unmount();
    expect(mockNav.listeners.size).toBe(0);
  });
});

describe('module de notifications indisponible (web, simulateur) : jamais d’exception dans la mise en page racine', () => {
  it('la lecture du toucher de démarrage lève : l’écouteur reste installé et un toucher ultérieur fonctionne', async () => {
    N.getLastNotificationResponse.mockImplementation(() => {
      throw new Error('ExpoNotifications.getLastNotificationResponse is not available on web');
    });
    await renderHook(() => usePushReception());
    expect(N.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    await tap(message(CONV));
    expect(router.push).toHaveBeenCalledWith(`/conversation/${CONV}`);
  });

  it('l’abonnement aux touchers lève : aucune exception, démontage sans erreur', async () => {
    N.addNotificationResponseReceivedListener.mockImplementation(() => {
      throw new Error('not available');
    });
    const { unmount } = await renderHook(() => usePushReception());
    await expect(unmount()).resolves.not.toThrow();
  });

  it('le gestionnaire de premier plan lève : aucune exception', async () => {
    N.setNotificationHandler.mockImplementation(() => {
      throw new Error('not available');
    });
    const { unmount } = await renderHook(() => usePushReception());
    await expect(unmount()).resolves.not.toThrow();
  });
});
