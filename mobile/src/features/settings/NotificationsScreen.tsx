import React, { useState } from 'react';
import { View } from 'react-native';
import type { NotificationPrefs } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, ScreenContainer, SwitchRow, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { SwitchGroup } from './SwitchGroup';

/** Deux groupes : l'activité du compte, puis les nouveautés et offres (séparés par l'espace, sans titre ni trait). */
const GROUPS: (keyof NotificationPrefs)[][] = [
  ['push_messages', 'push_matches', 'push_calls'],
  ['push_marketing', 'email_marketing'],
];

/** S52 : notifications par type (GET/PUT /me/notifications). */
export function NotificationsScreen() {
  const { t } = useI18n();
  const { space } = useTheme();
  const { api } = useAuth();
  const prefs = useResource(() => api.notifications.preferences(), [api]);
  const [banner, setBanner] = useState<string | undefined>();

  const change = async (key: keyof NotificationPrefs, value: boolean) => {
    setBanner(undefined);
    const previous = prefs.data;
    prefs.setData((current) => (current ? { ...current, [key]: value } : current));
    try {
      const updated = await api.notifications.updatePreferences({ [key]: value });
      prefs.setData(updated);
    } catch (error) {
      prefs.setData(previous);
      const { key: k, params } = apiErrorMessage(error);
      setBanner(t(k, params));
    }
  };

  return (
    <ScreenContainer scroll testID="screen-notifications">
      <ScreenHeader title={t('notif.title')} fallbackHref="/settings" />
      <View style={{ paddingTop: space[3] }}>
        {banner ? (
          <Banner
            testID="notif-banner"
            variant="error"
            message={banner}
            onDismiss={() => setBanner(undefined)}
            dismissLabel={t('ui.banner.dismiss')}
            style={{ marginBottom: space[4] }}
          />
        ) : null}
        <AsyncView testID="notif" status={prefs.status} error={prefs.error} onRetry={() => void prefs.reload()}>
          <View style={{ gap: space[6] }}>
            {GROUPS.map((keys) => (
              <SwitchGroup key={keys[0]}>
                {keys.map((key) => (
                  <SwitchRow
                    key={key}
                    testID={`notif-${key}`}
                    label={t(`notif.${key}`)}
                    value={Boolean(prefs.data?.[key])}
                    onValueChange={(value) => void change(key, value)}
                    divider={false}
                  />
                ))}
              </SwitchGroup>
            ))}
          </View>
          <Text variant="caption" tone="textMuted" style={{ marginTop: space[3] }}>
            {t('notif.note')}
          </Text>
        </AsyncView>
      </View>
    </ScreenContainer>
  );
}
