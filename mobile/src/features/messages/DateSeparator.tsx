import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Text } from '../../ui';
import { dayLabel } from './messageTime';

/** Séparateur de jour du fil (« Aujourd'hui », « Hier », date) : texte seul, ni couleur ni trait ne portent le sens. */
export function DateSeparator({ iso, testID }: { iso: string; testID?: string }) {
  const { t, locale } = useI18n();
  const { colors, radius, space } = useTheme();
  const label = dayLabel(iso, locale);
  if (!label) return null;
  const text = label.kind === 'today' ? t('conversation.day.today') : label.kind === 'yesterday' ? t('conversation.day.yesterday') : label.text;
  return (
    <View testID={testID} style={{ alignItems: 'center', marginTop: space[4], marginBottom: space[2] }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1] }}>
        <Text variant="captionStrong" tone="textMuted">
          {text}
        </Text>
      </View>
    </View>
  );
}
