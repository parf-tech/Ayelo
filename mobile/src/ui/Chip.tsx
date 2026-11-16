import React from 'react';
import { Pressable, View } from 'react-native';
import { borderWidth, MIN_TARGET, stateOpacity, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { useFocusRing } from './hooks/useFocusRing';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Choix multiple compact (genres, pays, intentions) : rôle checkbox.
 * Non sélectionnée : fond `surface`. Sélectionnée : fond d'écran, bordure `primary` de 2 pt et coche `Check` : l'état
 * n'est jamais porté par la couleur seule. La bordure fait toujours 2 pt (de la couleur du fond au repos) : rien ne
 * bouge à la sélection. Le libellé passe à la ligne (320 pt, texte à 200 %) au lieu d'être tronqué ; cible >= 44 pt.
 */
export function Chip({ label, selected, onPress, disabled = false, testID }: ChipProps) {
  const { colors, radius, space } = useTheme();
  const { handlers, ringStyle } = useFocusRing();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      style={({ pressed }) => ([{
        minHeight: MIN_TARGET,
        maxWidth: '100%',
        justifyContent: 'center',
        paddingHorizontal: space[4] - borderWidth.strong,
        paddingVertical: space[2] - borderWidth.strong,
        borderRadius: radius.pill,
        borderWidth: borderWidth.strong,
        borderColor: selected ? colors.primary : colors.surface,
        backgroundColor: selected ? colors.bg : colors.surface,
        opacity: disabled ? 0.6 : pressed ? stateOpacity.pressed : 1,
      }, ringStyle])}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], flexShrink: 1 }}>
        {selected ? <Icon name="Check" size="sm" tone="primary" testID={testID ? `${testID}-check` : undefined} /> : null}
        <Text variant="bodySmall" style={{ fontWeight: '500', flexShrink: 1 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
