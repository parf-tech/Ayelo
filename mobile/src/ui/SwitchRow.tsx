import React from 'react';
import { Pressable, Switch, View } from 'react-native';
import { MIN_TARGET, useTheme } from '../theme';
import { Text } from './Text';

export type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Bascule étiquetée (confidentialité, notifications, consentements).
 * Toute la ligne est la cible tactile (>= 44 pt). Pour le lecteur d'écran, seul l'interrupteur est exposé
 * (libellé = étiquette, indication = description) : le texte visuel est masqué pour éviter la double annonce.
 */
export function SwitchRow({ label, description, value, onValueChange, disabled = false, testID }: SwitchRowProps) {
  const { colors, space } = useTheme();
  return (
    <Pressable
      accessible={false}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      testID={testID ? `${testID}-row` : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: MIN_TARGET + 12,
        paddingVertical: space[2],
        gap: space[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text variant="body" style={{ fontWeight: '600' }}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </Pressable>
  );
}
