import React, { useState } from 'react';
import { View } from 'react-native';
import type { ConsentKind } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, NavRow, RowGroup, ScreenContainer, SwitchGroup, SwitchRow, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { type LegalDoc, useLegalOpener } from '../legal/useLegalOpener';
import { ConfirmPanel } from './ConfirmPanel';

const TOGGLES: ConsentKind[] = ['marketing', 'location', 'sensitive_data', 'verification_biometric'];

/** Consentements (GET/POST /me/consents). Retirer « données sensibles » masque le profil : confirmation explicite. */
export function ConsentSettingsScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const { api, refreshMe } = useAuth();
  const consents = useResource(() => api.auth.consents(), [api]);
  const [banner, setBanner] = useState<string | undefined>();
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [legalError, setLegalError] = useState(false);
  const openLegal = useLegalOpener();

  const granted = (kind: ConsentKind) => consents.data?.data[kind]?.granted === true;

  const set = async (kind: ConsentKind, value: boolean) => {
    setBusy(true);
    setBanner(undefined);
    try {
      await api.auth.updateConsent({ kind, granted: value });
      await consents.reload({ silent: true });
      if (kind === 'sensitive_data') void refreshMe();
    } catch (error) {
      const { key, params } = apiErrorMessage(error);
      setBanner(t(key, params));
    } finally {
      setBusy(false);
      setConfirmRevoke(false);
    }
  };

  const onToggle = (kind: ConsentKind, value: boolean) => {
    if (kind === 'sensitive_data' && !value) {
      setConfirmRevoke(true);
      return;
    }
    void set(kind, value);
  };

  return (
    <ScreenContainer scroll testID="screen-consent-settings">
      <ScreenHeader title={t('consentSettings.title')} fallbackHref="/settings" />
      <Text variant="body" tone="textMuted" style={{ marginTop: space[1], marginBottom: space[5] }}>
        {t('consentSettings.intro')}
      </Text>
      {banner ? (
        <Banner
          testID="consent-banner"
          variant="error"
          message={banner}
          onDismiss={() => setBanner(undefined)}
          dismissLabel={t('ui.banner.dismiss')}
          style={{ marginBottom: space[4] }}
        />
      ) : null}
      {confirmRevoke ? (
        <ConfirmPanel
          testID="consent-revoke-confirm"
          confirmTestID="consent-revoke-yes"
          message={`${t('consentSettings.revokeSensitive.title')} ${t('consentSettings.revokeSensitive.body')}`}
          confirmLabel={t('consentSettings.revokeSensitive.action')}
          onConfirm={() => void set('sensitive_data', false)}
          onCancel={() => setConfirmRevoke(false)}
          loading={busy}
        />
      ) : null}
      <AsyncView testID="consents" status={consents.status} error={consents.error} onRetry={() => void consents.reload()}>
        <View style={{ gap: space[6] }}>
          <SwitchGroup>
            {TOGGLES.map((kind) => (
              <SwitchRow
                key={kind}
                testID={`consent-${kind}`}
                label={t(`consentSettings.${kind}`)}
                description={kind === 'sensitive_data' ? t('consentSettings.sensitive_data.hint') : undefined}
                value={granted(kind)}
                disabled={busy}
                onValueChange={(value) => onToggle(kind, value)}
                divider={false}
              />
            ))}
          </SwitchGroup>
          <View style={{ gap: space[3] }}>
            {legalError ? <Banner testID="consent-legal-error" variant="error" message={t('legal.openError')} /> : null}
            <RowGroup>
              {(['terms', 'privacy'] as const satisfies readonly LegalDoc[]).map((doc) => (
                <NavRow
                  key={doc}
                  testID={`consent-${doc}-open`}
                  label={t(`consentSettings.${doc}`)}
                  onPress={() => {
                    setLegalError(false);
                    void openLegal(doc).then((ok) => setLegalError(!ok));
                  }}
                />
              ))}
            </RowGroup>
          </View>
        </View>
      </AsyncView>
    </ScreenContainer>
  );
}
