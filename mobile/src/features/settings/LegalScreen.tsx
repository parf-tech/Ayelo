import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Banner, ListRow, ScreenContainer, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { getLegalLinks } from '../legal/links';
import { type LegalDoc, useLegalOpener } from '../legal/useLegalOpener';

/** S57 : mentions légales. Les adresses viennent des variables EXPO_PUBLIC_* (textes validés par un juriste, jamais codés en dur). */
export function LegalScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const links = getLegalLinks();
  const openLegal = useLegalOpener();
  const [error, setError] = useState(false);

  const entries: { id: LegalDoc; label: string; url: string | null }[] = [
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
          description={entry.url || !__DEV__ ? undefined : t('legal.notConfigured')}
          onPress={() => {
            setError(false);
            void openLegal(entry.id).then((ok) => setError(!ok));
          }}
        />
      ))}
      {__DEV__ ? (
        <Text variant="caption" tone="textMuted" style={{ marginTop: space[4] }}>
          {t('legal.draftNote')}
        </Text>
      ) : null}
    </ScreenContainer>
  );
}
