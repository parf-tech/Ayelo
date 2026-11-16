import React from 'react';
import { View } from 'react-native';
import { borderWidth, useTheme } from '../theme';

/**
 * Groupe de bascules (`SwitchRow`) sur une carte `surface` : un filet fin sépare deux lignes d'un même groupe,
 * jamais le haut ni le bas. Les groupes entre eux se séparent par l'espace (le parent applique `space[6]`).
 * Présentation seule : chaque ligne garde son identifiant de test, son rôle et son état.
 */
export function SwitchGroup({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { colors, radius, space } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View testID={testID} style={{ paddingHorizontal: space[4], borderRadius: radius.md, backgroundColor: colors.surface }}>
      {rows.map((row, index) => (
        <View
          key={index}
          style={index > 0 ? { borderTopWidth: borderWidth.hairline, borderTopColor: colors.border } : undefined}
        >
          {row}
        </View>
      ))}
    </View>
  );
}
