import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { borderWidth, MIN_TARGET, stateOpacity, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { useFocusRing } from './hooks/useFocusRing';

/** Côté de la case (pt). */
const BOX_SIZE = 26;

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
  const { handlers, ringStyle } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={[label, badge].filter(Boolean).join(', ')}
      accessibilityHint={description}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: MIN_TARGET + 12,
          flexDirection: 'row',
          alignItems: 'flex-start',
          padding: space[4],
          borderRadius: radius.md,
          // Trait constant (2 pt) : cocher ne déplace rien ; seul le contour change de couleur.
          borderWidth: borderWidth.strong,
          borderColor: disabled ? colors.disabledBg : checked ? colors.primary : colors.borderStrong,
          backgroundColor: disabled ? colors.disabledBg : colors.surface,
          opacity: pressed && !disabled ? stateOpacity.pressed : 1,
        },
        ringStyle,
        style,
      ]}
    >
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          width: BOX_SIZE,
          height: BOX_SIZE,
          borderRadius: radius.sm,
          borderWidth: borderWidth.strong,
          borderColor: disabled ? colors.disabledText : checked ? colors.primary : colors.borderStrong,
          backgroundColor: disabled ? (checked ? colors.disabledText : colors.disabledBg) : checked ? colors.primary : colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: space[3],
          marginTop: borderWidth.strong,
        }}
      >
        {checked ? <Icon name="Check" size="md" tone="onPrimary" testID={testID ? `${testID}-check` : undefined} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" tone={disabled ? 'textMuted' : 'text'}>
          {label}
        </Text>
        {badge ? (
          <Text variant="caption" tone="textMuted" style={{ marginTop: space[1] }}>
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
