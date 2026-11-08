import React from 'react';
import { Pressable, View } from 'react-native';
import { MIN_TARGET, stateOpacity, useTheme } from '../theme';
import { Text } from './Text';

export type ListRowProps = {
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  tone?: 'default' | 'danger';
  /** Élément à gauche (avatar). */
  leading?: React.ReactNode;
  /** Élément à droite (badge). */
  trailing?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
};

/** Ligne de liste (réglages, conversations) : cible >= 44, chevron si cliquable. */
export function ListRow({
  label,
  description,
  value,
  onPress,
  tone = 'default',
  leading,
  trailing,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const { colors, space } = useTheme();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: MIN_TARGET + 12,
        paddingVertical: space[2],
        gap: space[3],
      }}
    >
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="body" tone={tone === 'danger' ? 'danger' : 'text'} style={{ fontWeight: '600' }} numberOfLines={2}>
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
      {onPress ? (
        <Text variant="body" tone="textMuted" accessible={false} importantForAccessibility="no">
          ›
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) {
    // Ligne statique : regroupée (une seule vocalisation) seulement sans `trailing`. Avec un contrôle à droite
    // (Acheter, Débloquer, Fermer la session), un parent `accessible` le masquerait à VoiceOver : on laisse
    // chaque enfant focalisable.
    const grouped = !trailing;
    return (
      <View
        testID={testID}
        accessible={grouped}
        accessibilityLabel={grouped ? accessibilityLabel : undefined}
        style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (description ? `${label}. ${description}` : label)}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? stateOpacity.pressed : 1,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      })}
    >
      {content}
    </Pressable>
  );
}
