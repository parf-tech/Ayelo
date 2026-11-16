import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { borderWidth, MIN_TARGET, stateOpacity, useTheme } from '../../theme';
import { Icon, Text, type IconName } from '../../ui';

/** Ligne d'un menu déroulant (fiche d'un profil, conversation) : icône + libellé, cible >= 44, ton danger pour une action destructrice. */
export function MenuItem({
  testID,
  icon,
  label,
  onPress,
  disabled,
  danger,
  loading,
}: {
  testID: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Action en cours : l'icône cède la place à l'indicateur, la ligne devient inerte et « occupée ». */
  loading?: boolean;
}) {
  const { colors, space } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) || Boolean(loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: MIN_TARGET,
        paddingHorizontal: space[3],
        opacity: disabled ? stateOpacity.disabled : pressed ? stateOpacity.pressed : 1,
      })}
    >
      {loading ? <ActivityIndicator color={danger ? colors.danger : colors.text} /> : <Icon name={icon} tone={danger ? 'danger' : 'text'} />}
      <Text variant="bodyMedium" tone={danger ? 'danger' : 'text'} style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Feuille de menu en ligne : même cadre pour tous les menus (contour fin, rayon, fond surface). */
export function MenuSheet({ testID, children }: { testID?: string; children: React.ReactNode }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      testID={testID}
      style={{ borderWidth: borderWidth.hairline, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: space[2], marginBottom: space[3] }}
    >
      {children}
    </View>
  );
}
