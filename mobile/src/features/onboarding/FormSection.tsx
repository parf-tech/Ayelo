import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Text } from '../../ui';

type Props = {
  title: string;
  hint?: string;
  /** Marque le champ comme facultatif : mention « Facultatif » à droite du titre, annoncée avec le titre. */
  optional?: boolean;
  testID?: string;
  children: React.ReactNode;
};

/**
 * Section d'un formulaire d'onboarding ou de préférences : titre (rôle header), mention facultatif à droite, aide.
 * Aucun trait ni pictogramme : c'est l'espace (le parent espace les sections de 32) qui sépare les groupes.
 */
export function FormSection({ title, hint, optional = false, testID, children }: Props) {
  const { t } = useI18n();
  const { space } = useTheme();
  const optionalLabel = t('common.optional');
  return (
    <View testID={testID} style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: space[3] }}>
        <Text
          variant="h3"
          header
          style={{ flexShrink: 1 }}
          accessibilityLabel={optional ? `${title} (${optionalLabel.toLowerCase()})` : undefined}
        >
          {title}
        </Text>
        {optional ? (
          <Text variant="caption" tone="textMuted" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {optionalLabel}
          </Text>
        ) : null}
      </View>
      {children}
      {hint ? (
        <Text variant="caption" tone="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
