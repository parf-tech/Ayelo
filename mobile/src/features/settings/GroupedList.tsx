import React from 'react';
import { Pressable, View } from 'react-native';
import { MIN_TARGET, stateOpacity, useTheme } from '../../theme';
import { Icon, Text, type IconName } from '../../ui';

/**
 * Groupe de lignes sur une carte (réglages, profil) : fond `surface`, coins arrondis, séparateurs fins entre les lignes.
 * Présentation seule : chaque ligne garde son identifiant de test, son rôle et son libellé d'accessibilité.
 */
export function RowGroup({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { colors, radius } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      testID={testID}
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
    >
      {rows.map((row, index) => (
        <View key={index} style={index > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
}

export type NavRowProps = {
  label: string;
  onPress: () => void;
  /** Pictogramme à gauche (décoratif : le libellé porte le sens). */
  icon?: IconName;
  description?: string;
  /** Valeur courte à droite (ex. état). */
  value?: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Élément supplémentaire à droite, avant le chevron (badge d'état). */
  trailing?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
};

/** Ligne cliquable d'un `RowGroup` : icône, libellé, chevron. Cible >= 44 pt, non désactivée par la seule couleur. */
export function NavRow({ label, onPress, icon, description, value, tone = 'default', disabled = false, trailing, accessibilityLabel, testID }: NavRowProps) {
  const { space } = useTheme();
  const danger = tone === 'danger';
  const iconTone = disabled ? 'disabledText' : danger ? 'danger' : 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (description ? `${label}. ${description}` : label)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? stateOpacity.pressed : 1 })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: MIN_TARGET + 12,
          paddingVertical: space[2],
          paddingHorizontal: space[4],
          gap: space[3],
        }}
      >
        {icon ? <Icon name={icon} tone={iconTone} /> : null}
        <View style={{ flex: 1 }}>
          <Text variant="body" tone={disabled ? 'textMuted' : danger ? 'danger' : 'text'} style={{ fontWeight: '600' }} numberOfLines={2}>
            {label}
          </Text>
          {description ? (
            <Text variant="caption" tone="textMuted" numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>
        {value ? (
          <Text variant="caption" tone="textMuted">
            {value}
          </Text>
        ) : null}
        {trailing}
        <Icon name="ChevronRight" size="sm" tone="textMuted" />
      </View>
    </Pressable>
  );
}
