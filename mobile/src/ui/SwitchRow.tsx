import React from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import { borderWidth, MIN_TARGET, useTheme } from '../theme';
import { Icon, IconName } from './Icon';
import { Text } from './Text';
import { useFocusRing } from './hooks/useFocusRing';

export type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Pictogramme décoratif à gauche du libellé. */
  icon?: IconName;
  /** Trait de séparation sous la ligne (défaut : oui). Désactivé quand la ligne est seule dans une section. */
  divider?: boolean;
  testID?: string;
};

/**
 * Bascule étiquetée (confidentialité, notifications, consentements).
 * Toute la ligne est la cible tactile (>= 44 pt). Pour le lecteur d'écran, seul l'interrupteur est exposé
 * (libellé = étiquette, indication = description) : le texte visuel est masqué pour éviter la double annonce.
 */
export function SwitchRow({ label, description, value, onValueChange, disabled = false, icon, divider = true, testID }: SwitchRowProps) {
  const { colors, space } = useTheme();
  const { handlers, ringStyle } = useFocusRing();
  return (
    <Pressable
      accessible={false}
      // La ligne ne prend pas le focus clavier : l'interrupteur natif le porte (sinon deux arrêts pour un seul contrôle).
      focusable={false}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      testID={testID ? `${testID}-row` : undefined}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: MIN_TARGET + 12,
          paddingVertical: space[2],
          gap: space[3],
          borderBottomWidth: divider ? borderWidth.hairline : 0,
          borderBottomColor: colors.border,
        },
        ringStyle,
      ]}
    >
      {icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name={icon} size="lg" tone="primary" />
        </View>
      ) : null}
      <View style={{ flex: 1 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text variant="bodyMedium" tone={disabled ? 'textMuted' : 'text'}>
          {label}
        </Text>
        {description ? (
          <Text variant="bodySmall" tone="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={description}
        // Web : le champ natif du navigateur porte déjà le rôle et l'état ; les redéclarer sur le conteneur produisait deux
        // interrupteurs imbriqués (axe : aria-required-attr, nested-interactive). Natif : rôle et état restent explicites.
        accessibilityRole={Platform.OS === 'web' ? undefined : 'switch'}
        accessibilityState={Platform.OS === 'web' ? undefined : { checked: value, disabled }}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        onFocus={handlers.onFocus}
        onBlur={handlers.onBlur}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </Pressable>
  );
}
