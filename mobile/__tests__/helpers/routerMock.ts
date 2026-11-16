// Mock d'expo-router, sans import du code applicatif (évite un cycle avec helpers/app).
import * as React from 'react';

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export const redirects: string[] = [];

/** Navigation du navigateur courant : seul `dispatch` est observé (rejeu de l'action empêchée par `repeat`). */
export const navigation = {
  dispatch: jest.fn(),
};

/**
 * `usePreventRemove` d'expo-router 58 (remplace l'événement `beforeRemove`, qui n'existe plus). Reproduit le contrat réel :
 * - tant que `preventRemove` est vrai, une sortie (`emitRemove`) est empêchée et le rappel reçoit `{ data: { action }, repeat }` ;
 * - `repeat` coupe la protection puis rejoue l'action (`navigation.dispatch`) ;
 * - le `disablePrevention` renvoyé coupe la protection ; elle revient quand `preventRemove` change.
 * `emitRemove` simule le bouton retour, le retour matériel ou le geste, et renvoie vrai si la sortie a été empêchée.
 */
type PreventEntry = {
  prevent: boolean;
  disabled: boolean;
  callback?: (options: { data: { action: unknown }; repeat: () => void }) => void;
};
const preventEntries = new Set<PreventEntry>();

function usePreventRemove(preventRemove: boolean, callback?: PreventEntry['callback']): () => void {
  const entry = React.useRef<PreventEntry>({ prevent: preventRemove, disabled: false, callback });
  React.useEffect(() => {
    entry.current.callback = callback;
  });
  React.useEffect(() => {
    const current = entry.current;
    current.prevent = preventRemove;
    current.disabled = false;
    preventEntries.add(current);
    return () => {
      preventEntries.delete(current);
    };
  }, [preventRemove]);
  return React.useCallback(() => {
    entry.current.disabled = true;
  }, []);
}

export function emitRemove(action: unknown = { type: 'GO_BACK' }): boolean {
  let prevented = false;
  for (const entry of [...preventEntries]) {
    if (!entry.prevent || entry.disabled) continue;
    prevented = true;
    entry.callback?.({
      data: { action },
      repeat: () => {
        entry.disabled = true;
        navigation.dispatch(action);
      },
    });
  }
  return prevented;
}

/** Focus de l'écran courant (`useIsFocused`) : vrai par défaut ; un test le passe à faux avant le rendu. */
export const focus = { value: true };

export const expoRouterMock = {
  useRouter: () => router,
  useNavigation: () => navigation,
  usePreventRemove,
  useIsFocused: () => focus.value,
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
  preventEntries.clear();
  focus.value = true;
}
