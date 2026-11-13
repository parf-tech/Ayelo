import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { borderWidth, radius, useTheme } from '../../theme';
import { Icon, Text } from '../../ui';

/** Avantages réellement inclus (liste de `premium.subtitle`, ancien texte unique) : coche + texte, jamais la couleur seule. */
const BENEFITS = ['likes', 'superlikes', 'undo', 'conversations'] as const;

export function PremiumBenefits() {
  const { t } = useI18n();
  const { colors, space } = useTheme();
  return (
    <View
      testID="premium-benefits"
      accessibilityRole="list"
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: borderWidth.hairline,
        borderColor: colors.border,
        padding: space[4],
        gap: space[3],
      }}
    >
      <Text variant="h3" header>
        {t('premium.benefits.title')}
      </Text>
      {BENEFITS.map((key) => (
        <View key={key} accessibilityRole="text" style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 28 }}>
          <Icon name="CircleCheck" size="md" tone="primary" />
          <Text variant="body" style={{ flex: 1 }}>
            {t(`premium.benefit.${key}` as 'premium.benefit.likes')}
          </Text>
        </View>
      ))}
    </View>
  );
}
