import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, ScreenContainer, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { getLegalLinks, openExternal } from './links';
import type { LegalDoc } from './useLegalOpener';

const DOCS: readonly LegalDoc[] = ['terms', 'privacy', 'community'];

/**
 * Repli dans l'application quand l'adresse web d'un texte légal n'est pas configurée : le titre du document est
 * affiché avec une explication claire et, si l'adresse du support est connue, un bouton pour en demander une copie.
 * Ce n'est pas le texte juridique lui-même (celui-ci est validé par un juriste et publié sur le web).
 */
export function LegalFallbackScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const params = useLocalSearchParams<{ doc?: string }>();
  const doc: LegalDoc = DOCS.includes(params.doc as LegalDoc) ? (params.doc as LegalDoc) : 'terms';
  const { supportEmail } = getLegalLinks();
  const title = t(`legal.${doc}` as 'legal.terms');
  return (
    <ScreenContainer scroll testID="screen-legal-fallback">
      <ScreenHeader title={title} fallbackHref="/" />
      <View style={{ gap: space[6] }}>
        <Text variant="body" tone="textMuted" testID="legal-fallback-body">
          {t('legal.fallback.body')}
        </Text>
        {supportEmail ? (
          <Button
            testID="legal-fallback-contact"
            variant="secondary"
            label={t('legal.fallback.contact', { email: supportEmail })}
            onPress={() => void openExternal(`mailto:${supportEmail}?subject=${encodeURIComponent(title)}`)}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}
