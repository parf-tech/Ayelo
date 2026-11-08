import React from 'react';
import { Pressable, View } from 'react-native';
import { MIN_TARGET, stateOpacity, useTheme } from '../theme';
import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/** Choix multiple compact (genres, pays, intentions) : rôle checkbox, coche visible en plus de la couleur. */
export function Chip({ label, selected, onPress, disabled = false, testID }: ChipProps) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TARGET,
        justifyContent: 'center',
        paddingHorizontal: space[4],
        borderRadius: radius.pill,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.primary : colors.borderStrong,
        backgroundColor: colors.surface,
        opacity: pressed ? stateOpacity.pressed : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        {selected ? (
          <Text variant="caption" tone="primary" accessible={false} style={{ fontWeight: '700' }}>
            ✓
          </Text>
        ) : null}
        <Text variant="body" tone={selected ? 'primary' : 'text'} style={{ fontWeight: selected ? '600' : '400' }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
