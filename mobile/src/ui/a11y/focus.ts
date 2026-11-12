import type { RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle } from 'react-native';

/**
 * Place le focus du lecteur d'écran sur l'élément référencé (feuilles, en-têtes, formulaires).
 * Sans erreur si la référence est nulle ou si le nœud n'est pas monté.
 */
export function focusNode(ref: RefObject<unknown> | null | undefined): void {
  const node = ref?.current;
  if (!node) return;
  try {
    const handle = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  } catch {
    // Le focus d'accessibilité est un confort : ne jamais casser l'écran.
  }
}
