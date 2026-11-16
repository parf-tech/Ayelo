import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';

/** Nombre de bandes : plus il est grand, plus le fondu est lisse (chaque bande n'est qu'une vue unie semi-transparente). */
export const SCRIM_BANDS = 10;
/** Opacité d'une bande ; l'empilement atteint environ 0,97 en bas, où se pose le texte (blanc sur prune). */
export const SCRIM_BAND_OPACITY = 0.3;
/**
 * Opacité minimale du fondu sous le texte pour garder 4,5:1 (blanc sur prune mélangé à une photo blanche, pire cas) :
 * 0,63 suffit ; 0,65 laisse une marge.
 */
export const SCRIM_TEXT_MIN_ALPHA = 0.65;

/**
 * Opacité cumulée du fondu à une fraction de sa hauteur (0 = bas, 1 = haut) : nombre de bandes qui la couvrent.
 * Exportée pour le test de lisibilité : le texte doit rester dans la zone où l'opacité dépasse SCRIM_TEXT_MIN_ALPHA.
 */
export function scrimAlphaAt(fraction: number): number {
  if (fraction > 1) return 0;
  const covering = Math.min(SCRIM_BANDS, Math.floor(SCRIM_BANDS - SCRIM_BANDS * Math.max(fraction, 0) + 1e-9) + 1);
  return 1 - (1 - SCRIM_BAND_OPACITY) ** covering;
}

/**
 * Fondu prune du bas vers le haut, posé sur une photo pour garantir la lisibilité du texte.
 * Sans dépendance de dégradé : bandes empilées de hauteur décroissante (react-native-svg est réservé aux illustrations).
 * Décoratif : exclu de l'arbre d'accessibilité.
 */
export function Scrim({ height = '60%', testID }: { height?: `${number}%`; testID?: string }) {
  const { colors } = useTheme();
  const total = Number.parseFloat(height);
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}
    >
      {Array.from({ length: SCRIM_BANDS }, (_unused, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${(total * (SCRIM_BANDS - index)) / SCRIM_BANDS}%` as `${number}%`,
            backgroundColor: colors.brand,
            opacity: SCRIM_BAND_OPACITY,
          }}
        />
      ))}
    </View>
  );
}
