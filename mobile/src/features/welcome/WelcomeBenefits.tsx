import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { useTheme } from '../../theme';
import { Icon, Text, useCompactLayout } from '../../ui';
import type { IconName } from '../../ui';

/** Engagements réellement livrés par le produit (décision 7 : selfie ; signalement et blocage ; export et suppression). */
export const WELCOME_BENEFITS: readonly { icon: IconName; label: TranslationKey; testID: string }[] = [
  { icon: 'ShieldCheck', label: 'welcome.benefits.verify', testID: 'welcome-benefit-verify' },
  { icon: 'Flag', label: 'welcome.benefits.report', testID: 'welcome-benefit-report' },
  { icon: 'Lock', label: 'welcome.benefits.data', testID: 'welcome-benefit-data' },
];

/**
 * Rangée de trois bénéfices sur fond prune : pictogramme `Icon` (couleur d'accent, décoratif) et libellé court.
 * Écran de 320 pt ou texte agrandi : les trois passent en colonne, pictogramme à gauche, pour que rien ne soit coupé.
 */
export function WelcomeBenefits() {
  const { t } = useI18n();
  const { space } = useTheme();
  const { isTiny, isLarge } = useCompactLayout();
  const stacked = isTiny || isLarge;

  return (
    <View
      testID="welcome-benefits"
      accessibilityRole="list"
      accessibilityLabel={t('welcome.benefits.label')}
      style={{ flexDirection: stacked ? 'column' : 'row', gap: stacked ? space[3] : space[2], alignSelf: 'stretch' }}
    >
      {WELCOME_BENEFITS.map(({ icon, label, testID }) => {
        return (
          <View
            key={icon}
            testID={testID}
            accessible
            style={
              stacked
                ? { flexDirection: 'row', alignItems: 'center', gap: space[3] }
                : { flex: 1, alignItems: 'center', gap: space[2] }
            }
          >
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              testID={`${testID}-icon`}
            >
              <Icon name={icon} size="lg" tone="accent" />
            </View>
            <Text variant="caption" tone="onBrand" align={stacked ? 'left' : 'center'} style={{ flexShrink: 1 }}>
              {t(label)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
