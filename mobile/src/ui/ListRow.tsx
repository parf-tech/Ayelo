import React from 'react';
import { Pressable, View } from 'react-native';
import { MIN_TARGET, useTheme } from '../theme';
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
        <Text variant="body" tone={tone === 'danger' ? 'danger' : 'text'} style={{ fontWeight: '600' }} numberOfLines={1}>
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
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={accessibilityLabel}
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
        opacity: pressed ? 0.7 : 1,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      })}
    >
      {content}
    </Pressable>
  );
}
