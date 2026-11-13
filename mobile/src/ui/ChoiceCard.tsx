import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { borderWidth, MIN_TARGET, stateOpacity, useTheme } from '../theme';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

export type ChoiceCardProps = {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Pictogramme du registre `ui/icons.ts`, décoratif (le libellé porte le sens). Ignoré en mise en page `tile`. */
  icon?: IconName;
  /** `card` : carte pleine largeur (défaut). `tile` : tuile courte, pour trois mots ou moins sur une ligne (genre). */
  layout?: 'card' | 'tile';
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Choix unique (intention, genre, plan Premium) : rôle « radio ».
 * Non sélectionnée : fond `surface`. Sélectionnée : fond d'écran, bordure `primary` de 2 pt et pastille pleine avec
 * coche `Check` : l'état n'est jamais porté par la couleur seule. La bordure fait toujours 2 pt (de la couleur du
 * fond au repos) pour que rien ne bouge à la sélection. Le texte passe à la ligne (320 pt, texte à 200 %) ; cible
 * >= 56 pt en carte, >= 52 pt en tuile.
 */
export function ChoiceCard({ label, description, selected, onPress, disabled = false, icon, layout = 'card', testID, style }: ChoiceCardProps) {
  const { colors, radius, space } = useTheme();
  const tile = layout === 'tile';
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
          minHeight: tile ? MIN_TARGET + 8 : MIN_TARGET + 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: tile ? 'center' : undefined,
          padding: tile ? space[2] : space[4],
          borderRadius: radius.md,
          borderWidth: borderWidth.strong,
          borderColor: selected ? colors.primary : disabled ? colors.disabledBg : colors.surface,
          backgroundColor: disabled ? colors.disabledBg : selected ? colors.bg : colors.surface,
          opacity: pressed && !disabled ? stateOpacity.pressed : 1,
        },
        style,
      ]}
    >
      {icon && !tile ? (
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: selected ? colors.surface : colors.bg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: space[3],
          }}
        >
          <Icon name={icon} size="md" tone={disabled ? 'disabledText' : 'primary'} />
        </View>
      ) : null}
      <View style={tile ? { flexShrink: 1 } : { flex: 1 }}>
        <Text variant="body" style={{ fontWeight: '500' }} tone={disabled ? 'textMuted' : 'text'}>
          {label}
        </Text>
        {description && !tile ? (
          <Text variant="caption" tone="textMuted" style={{ marginTop: space[1] }}>
            {description}
          </Text>
        ) : null}
      </View>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          width: tile ? 20 : 24,
          height: tile ? 20 : 24,
          borderRadius: radius.pill,
          borderWidth: borderWidth.strong,
          borderColor: selected ? colors.primary : colors.borderStrong,
          backgroundColor: selected ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: tile ? space[2] : space[3],
        }}
      >
        {selected ? <Icon name="Check" size="sm" tone="onPrimary" testID={testID ? `${testID}-check` : undefined} /> : null}
      </View>
    </Pressable>
  );
}
