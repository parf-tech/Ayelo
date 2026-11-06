import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Banner, ListRow, ScreenContainer, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { getLegalLinks, openExternal } from '../legal/links';

/** S57 : mentions légales. Les adresses viennent des variables EXPO_PUBLIC_* (textes validés par un juriste, jamais codés en dur). */
export function LegalScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const links = getLegalLinks();
  const [error, setError] = useState(false);

  const entries = [
    { id: 'terms', label: t('legal.terms'), url: links.terms },
    { id: 'privacy', label: t('legal.privacy'), url: links.privacy },
    { id: 'community', label: t('legal.community'), url: links.community },
  ];

  return (
    <ScreenContainer scroll testID="screen-legal">
      <ScreenHeader title={t('legal.title')} fallbackHref="/settings" />
      {error ? <Banner testID="legal-error" variant="error" message={t('legal.openError')} style={{ marginBottom: space[3] }} /> : null}
      {entries.map((entry) => (
        <ListRow
          key={entry.id}
          testID={`legal-${entry.id}`}
          label={entry.label}
          description={entry.url ? undefined : t('legal.notConfigured')}
          onPress={
            entry.url
              ? () => {
                  setError(false);
                  void openExternal(entry.url as string).then((ok) => setError(!ok));
                }
              : undefined
          }
        />
      ))}
      <Text variant="caption" tone="textMuted" style={{ marginTop: space[4] }}>
        {t('legal.draftNote')}
      </Text>
    </ScreenContainer>
  );
}
