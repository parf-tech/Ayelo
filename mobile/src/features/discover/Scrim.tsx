import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';

/** Nombre de bandes : plus il est grand, plus le fondu est lisse (chaque bande n'est qu'une vue unie semi-transparente). */
const BANDS = 8;
/** Opacité d'une bande ; l'empilement atteint environ 0,9 en bas, où se pose le texte (blanc sur prune). */
const BAND_OPACITY = 0.26;

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
      {Array.from({ length: BANDS }, (_unused, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${(total * (BANDS - index)) / BANDS}%` as `${number}%`,
            backgroundColor: colors.brand,
            opacity: BAND_OPACITY,
          }}
        />
      ))}
    </View>
  );
}
