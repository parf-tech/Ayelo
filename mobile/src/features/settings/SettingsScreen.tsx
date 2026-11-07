import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, ListRow, ScreenContainer, Text } from '../../ui';
import { LanguageToggle } from '../common/LanguageToggle';
import { ScreenHeader } from '../common/ScreenHeader';
import { ManageSubscription } from '../premium/ManageSubscription';

function Section({ title }: { title: string }) {
  const { space } = useTheme();
  return (
    <Text variant="caption" tone="textMuted" header style={{ marginTop: space[4], fontWeight: '700' }}>
      {title}
    </Text>
  );
}

/** S50 : réglages. Point d'entrée de la confidentialité, des notifications, des sessions, des bloqués, etc. */
export function SettingsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { api, signOut } = useAuth();
  // Statut d'abonnement : seulement pour choisir la boutique (ou signaler un Premium offert). « Gérer mon abonnement »
  // reste affiché même si l'appel échoue : le chemin de résiliation ne dépend pas du réseau.
  const billing = useResource(() => api.billing.status(), [api]);
  const [loggingOut, setLoggingOut] = useState(false);
  const go = (path: string) => () => router.push(path as never);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ScreenContainer scroll testID="screen-settings">
      <ScreenHeader title={t('settings.title')} fallbackHref="/profile" />
      <Section title={t('settings.section.account')} />
      <ListRow testID="settings-preferences" label={t('settings.preferences')} onPress={go('/settings/preferences')} />
      <ListRow testID="settings-notifications" label={t('settings.notifications')} onPress={go('/settings/notifications')} />
      <ManageSubscription
        testID="settings-manage-subscription"
        variant="row"
        store={billing.data?.subscription?.store}
        periodEnd={billing.data?.subscription?.period_end}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="body" style={{ fontWeight: '600' }}>
          {t('settings.language')}
        </Text>
        <LanguageToggle />
      </View>
      <Section title={t('settings.section.privacy')} />
      <ListRow testID="settings-privacy" label={t('settings.privacy')} onPress={go('/settings/privacy')} />
      <ListRow testID="settings-sessions" label={t('settings.sessions')} onPress={go('/settings/sessions')} />
      <ListRow testID="settings-blocked" label={t('settings.blocked')} onPress={go('/settings/blocked')} />
      <ListRow testID="settings-consents" label={t('settings.consents')} onPress={go('/settings/consents')} />
      <ListRow testID="settings-sanctions" label={t('settings.sanctions')} onPress={go('/settings/sanctions')} />
      <ListRow testID="settings-export" label={t('settings.export')} onPress={go('/settings/export')} />
      <Section title={t('settings.section.help')} />
      <ListRow testID="settings-support" label={t('settings.support')} onPress={go('/settings/support')} />
      <ListRow testID="settings-legal" label={t('settings.legal')} onPress={go('/settings/legal')} />
      <ListRow testID="settings-delete" label={t('settings.delete')} tone="danger" onPress={go('/settings/delete-account')} />
      <View style={{ marginTop: space[5], gap: space[2] }}>
        <Button testID="settings-logout" variant="secondary" label={t('settings.logout')} onPress={() => void logout()} loading={loggingOut} />
        <Text variant="caption" tone="textMuted" align="center">
          {t('settings.version', { version: Constants.expoConfig?.version ?? '0.0.0' })}
        </Text>
      </View>
    </ScreenContainer>
  );
}
