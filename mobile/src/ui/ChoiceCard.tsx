import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { MIN_TARGET, useTheme } from '../theme';
import { Text } from './Text';

export type ChoiceCardProps = {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Carte de choix unique (intention, genre, plan Premium) : rôle « radio », état coché/non coché non porté par la couleur seule. */
export function ChoiceCard({ label, description, selected, onPress, disabled = false, testID, style }: ChoiceCardProps) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      accessibilityState={{ checked: selected, selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: MIN_TARGET + 12,
          flexDirection: 'row',
          alignItems: 'center',
          padding: space[4],
          borderRadius: radius.md,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.primary : colors.borderStrong,
          backgroundColor: disabled ? colors.disabledBg : colors.surface,
          opacity: pressed && !disabled ? 0.8 : 1,
        },
        style,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body" style={{ fontWeight: '600' }} tone={disabled ? 'textMuted' : 'text'}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="textMuted" style={{ marginTop: space[1] }}>
            {description}
          </Text>
        ) : null}
      </View>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.pill,
          borderWidth: 2,
          borderColor: selected ? colors.primary : colors.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: space[3],
        }}
      >
        {selected ? (
          <View style={{ width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.primary }} />
        ) : null}
      </View>
    </Pressable>
  );
}
