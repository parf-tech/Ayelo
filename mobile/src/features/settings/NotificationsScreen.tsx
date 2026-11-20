import React, { useState } from 'react';
import { View } from 'react-native';
import type { NotificationPrefs } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Banner, ScreenContainer, SwitchGroup, SwitchRow, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

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
  // Réglages en cours d'enregistrement : une ligne n'est inerte que pendant SA requête, et un échec ne défait que SA valeur.
  const [busyKeys, setBusyKeys] = useState<(keyof NotificationPrefs)[]>([]);

  const change = async (key: keyof NotificationPrefs, value: boolean) => {
    if (busyKeys.includes(key)) return;
    setBanner(undefined);
    setBusyKeys((keys) => [...keys, key]);
    const previousValue = Boolean(prefs.data?.[key]);
    prefs.setData((current) => (current ? { ...current, [key]: value } : current));
    try {
      const updated = await api.notifications.updatePreferences({ [key]: value });
      // Seule la valeur enregistrée est reprise : la réponse d'une requête ne doit pas écraser le choix, encore en vol, d'un autre réglage.
      prefs.setData((current) => (current ? { ...current, [key]: updated[key] } : updated));
    } catch (error) {
      prefs.setData((current) => (current ? { ...current, [key]: previousValue } : current));
      const { key: k, params } = apiErrorMessage(error);
      setBanner(t(k, params));
    } finally {
      setBusyKeys((keys) => keys.filter((k) => k !== key));
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
                    disabled={busyKeys.includes(key)}
                    onValueChange={(value) => void change(key, value)}
                    divider={false}
                  />
                ))}
              </SwitchGroup>
            ))}
          </View>
          <Text variant="bodySmall" tone="textMuted" style={{ marginTop: space[3] }}>
            {t('notif.note')}
          </Text>
        </AsyncView>
      </View>
    </ScreenContainer>
  );
}
