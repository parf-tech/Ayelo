import React from 'react';
import { View } from 'react-native';
import { borderWidth, useTheme } from '../../theme';
import { Icon, Text, type IconName } from '../../ui';

/** Côté d'une vignette de photo ou de vidéo dans la conversation. */
export const MEDIA_SIZE = 220;

/**
 * Cadre d'un média qui ne peut pas (encore) être montré : en vérification, refusé, introuvable. Une icône ET un texte, annoncés
 * ensemble : la couleur ne porte jamais seule le sens. `children` : une action éventuelle (« Réessayer »).
 */
export function MediaFrame({ testID, icon, label, children }: { testID: string; icon: IconName; label: string; children?: React.ReactNode }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={{
        width: MEDIA_SIZE,
        minHeight: MEDIA_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        padding: space[4],
        borderRadius: radius.lg,
        borderWidth: borderWidth.hairline,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
      }}
    >
      <Icon name={icon} tone="textMuted" />
      <Text variant="bodySmall" tone="text" style={{ textAlign: 'center' }}>
        {label}
      </Text>
      {children}
    </View>
  );
}
