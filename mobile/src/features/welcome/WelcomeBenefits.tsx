import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { borderWidth, iconSize, useTheme } from '../../theme';
import { Text, useCompactLayout } from '../../ui';
import type { IconName } from '../../ui';
import { ICON_REGISTRY } from '../../ui/icons';

/** Engagements réellement livrés par le produit (décision 7 : selfie ; signalement et blocage ; export et suppression). */
export const WELCOME_BENEFITS: readonly { icon: IconName; label: TranslationKey; testID: string }[] = [
  { icon: 'ShieldCheck', label: 'welcome.benefits.verify', testID: 'welcome-benefit-verify' },
  { icon: 'Flag', label: 'welcome.benefits.report', testID: 'welcome-benefit-report' },
  { icon: 'Lock', label: 'welcome.benefits.data', testID: 'welcome-benefit-data' },
];

/**
 * Rangée de trois bénéfices sur fond prune : pictogramme du registre (couleur d'accent, décoratif) et libellé court.
 * Écran de 320 pt ou texte agrandi : les trois passent en colonne, pictogramme à gauche, pour que rien ne soit coupé.
 * Le pictogramme est dessiné ici avec le registre (`ICON_REGISTRY`) car `Icon` n'offre pas de teinte « sur prune ».
 */
export function WelcomeBenefits() {
  const { t } = useI18n();
  const { colors, space } = useTheme();
  const { isTiny, isLarge } = useCompactLayout();
  const stacked = isTiny || isLarge;

  return (
    <View
      testID="welcome-benefits"
      accessibilityLabel={t('welcome.benefits.label')}
      style={{ flexDirection: stacked ? 'column' : 'row', gap: stacked ? space[3] : space[2], alignSelf: 'stretch' }}
    >
      {WELCOME_BENEFITS.map(({ icon, label, testID }) => {
        const Glyph = ICON_REGISTRY[icon];
        return (
          <View
            key={icon}
            testID={testID}
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
              <Glyph color={colors.accent} size={iconSize.lg} strokeWidth={borderWidth.strong} fill="none" />
            </View>
            <Text
              variant="caption"
              style={{ color: colors.onBrand, textAlign: stacked ? 'left' : 'center', flexShrink: 1 }}
            >
              {t(label)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
