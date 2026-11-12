import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MIN_TARGET, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type VerifiedBadgeProps = {
  /** Texte du badge, par exemple « Profil vérifié ». */
  label: string;
  /** Phrase affichée au toucher : ce que le badge confirme, et ce qu'il ne garantit pas. */
  explanation: string;
  /** Indication lue par le lecteur d'écran (comment obtenir l'explication). */
  hint: string;
  testID?: string;
};

/** Badge « vérifié » (icône `BadgeCheck`, jeton `verified`). Un toucher déplie une explication courte, annoncée par le lecteur d'écran. */
export function VerifiedBadge({ label, explanation, hint, testID }: VerifiedBadgeProps) {
  const { space } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View testID={testID} style={{ gap: space[1] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{ minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: space[1], alignSelf: 'flex-start' }}
      >
        <Icon name="BadgeCheck" size="sm" tone="verified" testID={testID ? `${testID}-icon` : undefined} />
        <Text variant="caption" tone="verified" style={{ fontWeight: '700' }}>
          {label}
        </Text>
      </Pressable>
      {open ? (
        <Text
          variant="caption"
          tone="textMuted"
          accessibilityLiveRegion="polite"
          testID={testID ? `${testID}-explanation` : undefined}
        >
          {explanation}
        </Text>
      ) : null}
    </View>
  );
}
