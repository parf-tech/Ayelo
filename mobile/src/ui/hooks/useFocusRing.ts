import { useCallback, useMemo, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { focus, useTheme } from '../../theme';

const NO_RING: ViewStyle = {};

export type FocusRing = {
  focused: boolean;
  handlers: { onFocus: () => void; onBlur: () => void };
  /** Contour de `focus.width` en `colors.focusRing`, décalé de `focus.offset`, seulement quand l'élément a le focus. */
  ringStyle: ViewStyle;
};

/**
 * Focus visible (WCAG 2.4.7) pour clavier externe, Switch Control et Switch Access (spec R5).
 * `ringColor` : couleur du contour quand `focusRing` se confond avec le fond (sur le fond prune, passer `colors.onBrand`).
 */
export function useFocusRing(ringColor?: string): FocusRing {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);
  const handlers = useMemo(() => ({ onFocus, onBlur }), [onFocus, onBlur]);
  const ringStyle = useMemo<ViewStyle>(
    () =>
      focused
        ? {
            outlineWidth: focus.width,
            outlineColor: ringColor ?? colors[focus.color],
            outlineOffset: focus.offset,
            outlineStyle: 'solid',
          }
        : NO_RING,
    [focused, colors, ringColor],
  );
  return { focused, handlers, ringStyle };
}
