import { useWindowDimensions } from 'react-native';

/** Seuils de la spec 03-composants (R3, section 2.1). */
export const COMPACT_WIDTH = { narrow: 360, tiny: 320 } as const;
export const COMPACT_FONT_SCALE = { large: 1.3, xl: 1.75 } as const;

export type CompactLayout = {
  fontScale: number;
  width: number;
  /** Largeur <= 360 pt. */
  isNarrow: boolean;
  /** Largeur <= 320 pt. */
  isTiny: boolean;
  /** Agrandissement du texte >= 1,3. */
  isLarge: boolean;
  /** Agrandissement du texte >= 1,75. */
  isXL: boolean;
};

/** Informations de mise en page pour basculer en colonne quand l'écran est étroit ou le texte agrandi. */
export function useCompactLayout(): CompactLayout {
  const { width, fontScale } = useWindowDimensions();
  return {
    fontScale,
    width,
    isNarrow: width <= COMPACT_WIDTH.narrow,
    isTiny: width <= COMPACT_WIDTH.tiny,
    isLarge: fontScale >= COMPACT_FONT_SCALE.large,
    isXL: fontScale >= COMPACT_FONT_SCALE.xl,
  };
}
