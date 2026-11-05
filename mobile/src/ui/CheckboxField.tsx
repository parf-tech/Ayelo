import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { MIN_TARGET, useTheme } from '../theme';
import { Text } from './Text';

export type CheckboxFieldProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Texte de la pastille « Obligatoire » / « Facultatif ». */
  badge?: string;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Case à cocher distincte (consentements) : rôle « checkbox », coche textuelle (pas seulement la couleur). */
export function CheckboxField({
  label,
  description,
  checked,
  onChange,
  badge,
  disabled = false,
  testID,
  style,
}: CheckboxFieldProps) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={[label, badge].filter(Boolean).join(', ')}
      accessibilityHint={description}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: MIN_TARGET + 12,
          flexDirection: 'row',
          alignItems: 'flex-start',
          padding: space[4],
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: checked ? colors.primary : colors.border,
          backgroundColor: colors.surface,
          opacity: pressed && !disabled ? 0.8 : 1,
        },
        style,
      ]}
    >
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 26,
          height: 26,
          borderRadius: radius.sm,
          borderWidth: 2,
          borderColor: checked ? colors.primary : colors.textMuted,
          backgroundColor: checked ? colors.primary : colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: space[3],
          marginTop: 2,
        }}
      >
        {checked ? (
          <Text variant="body" tone="onPrimary" style={{ fontWeight: '700', lineHeight: 20 }}>
            ✓
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" style={{ fontWeight: '600' }}>
          {label}
        </Text>
        {badge ? (
          <Text variant="caption" tone="textMuted" style={{ marginTop: 2 }}>
            {badge}
          </Text>
        ) : null}
        {description ? (
          <Text variant="caption" tone="textMuted" style={{ marginTop: space[1] }}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
