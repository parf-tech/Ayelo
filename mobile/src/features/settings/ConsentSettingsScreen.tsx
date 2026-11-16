import React, { useState } from 'react';
import { View } from 'react-native';
import type { ConsentKind } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, ListRow, ScreenContainer, SwitchRow, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { SwitchGroup } from './SwitchGroup';

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
        <View testID="consent-revoke-confirm" style={{ gap: space[3], marginBottom: space[5] }}>
          <Banner variant="warning" message={`${t('consentSettings.revokeSensitive.title')} ${t('consentSettings.revokeSensitive.body')}`} />
          <Button testID="consent-revoke-yes" variant="danger" label={t('consentSettings.revokeSensitive.action')} onPress={() => void set('sensitive_data', false)} loading={busy} />
          <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirmRevoke(false)} />
        </View>
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
          <View>
            <ListRow label={t('consentSettings.terms')} />
            <ListRow label={t('consentSettings.privacy')} />
          </View>
        </View>
      </AsyncView>
    </ScreenContainer>
  );
}
