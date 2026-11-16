import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { fontWeight, MIN_TARGET, useTheme } from '../theme';
import { announce } from './a11y/announce';
import { Icon } from './Icon';
import { Text } from './Text';
import { useFocusRing } from './hooks/useFocusRing';

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
  const { handlers, ringStyle } = useFocusRing();
  const [open, setOpen] = useState(false);
  return (
    <View testID={testID} style={{ gap: space[1] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          // iOS n'a pas de région vivante : l'explication est annoncée à l'ouverture.
          if (!open) announce(explanation);
          setOpen((o) => !o);
        }}
        onFocus={handlers.onFocus}
        onBlur={handlers.onBlur}
        style={[{ minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: space[1], alignSelf: 'flex-start' }, ringStyle]}
      >
        <Icon name="BadgeCheck" size="sm" tone="verified" testID={testID ? `${testID}-icon` : undefined} />
        <Text variant="caption" tone="verified" style={{ fontWeight: fontWeight.bold }}>
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
