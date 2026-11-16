// Mock d'expo-router, sans import du code applicatif (évite un cycle avec helpers/app).
export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export const redirects: string[] = [];

/**
 * Navigation du navigateur courant : seul `beforeRemove` est suivi (un écran qui bloque la sortie, ex. profil non enregistré).
 * `emitBeforeRemove` simule une sortie (bouton retour, retour matériel ou geste) et renvoie vrai si l'écran l'a empêchée.
 */
type BeforeRemoveEvent = { preventDefault: () => void; data: { action: unknown } };
const beforeRemoveListeners: ((event: BeforeRemoveEvent) => void)[] = [];
export const navigation = {
  addListener: jest.fn((name: string, listener: (event: BeforeRemoveEvent) => void) => {
    if (name === 'beforeRemove') beforeRemoveListeners.push(listener);
    return () => {
      const index = beforeRemoveListeners.indexOf(listener);
      if (index >= 0) beforeRemoveListeners.splice(index, 1);
    };
  }),
  dispatch: jest.fn(),
};
export function emitBeforeRemove(action: unknown = { type: 'GO_BACK' }): boolean {
  let prevented = false;
  for (const listener of [...beforeRemoveListeners]) listener({ preventDefault: () => (prevented = true), data: { action } });
  return prevented;
}

export const expoRouterMock = {
  useRouter: () => router,
  useNavigation: () => navigation,
  Redirect: ({ href }: { href: string }) => {
    redirects.push(href);
    return null;
  },
};

export function resetRouterMocks() {
  router.push.mockClear();
  router.replace.mockClear();
  router.back.mockClear();
  navigation.dispatch.mockClear();
  redirects.length = 0;
}
