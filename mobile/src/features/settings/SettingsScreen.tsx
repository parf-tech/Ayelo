import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Banner, Button, NavRow, RowGroup, ScreenContainer, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { ManageSubscription } from '../premium/ManageSubscription';

function Section({ title }: { title: string }) {
  const { space } = useTheme();
  return (
    <Text variant="captionStrong" tone="textMuted" header style={{ marginTop: space[6], marginBottom: space[2], marginLeft: space[1] }}>
      {title}
    </Text>
  );
}

/** S50 : réglages. Point d'entrée de la confidentialité, des notifications, des sessions, des bloqués, etc. */
export function SettingsScreen() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { space } = useTheme();
  const { api, signOut } = useAuth();
  // Statut d'abonnement : seulement pour choisir la boutique (ou signaler un Premium offert). « Gérer mon abonnement »
  // reste affiché même si l'appel échoue : le chemin de résiliation ne dépend pas du réseau.
  const billing = useResource(() => api.billing.status(), [api]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const otherLocale = locale === 'fr' ? 'en' : 'fr';
  // Version affichée seulement si la configuration la connaît : jamais une version inventée.
  const version = Constants.expoConfig?.version;
  const go = (path: string) => () => router.push(path as never);

  const logout = async () => {
    setLoggingOut(true);
    setLogoutError(false);
    try {
      await signOut();
    } catch {
      setLogoutError(true);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ScreenContainer scroll testID="screen-settings">
      <ScreenHeader title={t('settings.title')} fallbackHref="/profile" />
      <Section title={t('settings.section.account')} />
      <RowGroup>
        <NavRow testID="settings-preferences" icon="SlidersHorizontal" label={t('settings.preferences')} onPress={go('/settings/preferences')} />
        <NavRow testID="settings-notifications" icon="MessageCircle" label={t('settings.notifications')} onPress={go('/settings/notifications')} />
        <NavRow
          testID="language-toggle"
          icon="Globe"
          label={t('settings.language')}
          value={t(`language.name.${otherLocale}`)}
          accessibilityLabel={`${t('language.change')}: ${t(`language.name.${otherLocale}`)}`}
          onPress={() => setLocale(otherLocale)}
        />
      </RowGroup>
      <Section title={t('settings.section.subscription')} />
      <View>
        <ManageSubscription
          testID="settings-manage-subscription"
          variant="row"
          store={billing.data?.subscription?.store}
          periodEnd={billing.data?.subscription?.period_end}
        />
      </View>
      <Section title={t('settings.section.privacy')} />
      <RowGroup>
        <NavRow testID="settings-privacy" icon="Lock" label={t('settings.privacy')} onPress={go('/settings/privacy')} />
        <NavRow testID="settings-sessions" icon="Clock" label={t('settings.sessions')} onPress={go('/settings/sessions')} />
        <NavRow testID="settings-blocked" icon="Ban" label={t('settings.blocked')} onPress={go('/settings/blocked')} />
        <NavRow testID="settings-consents" icon="ShieldCheck" label={t('settings.consents')} onPress={go('/settings/consents')} />
        <NavRow testID="settings-sanctions" icon="ShieldAlert" label={t('settings.sanctions')} onPress={go('/settings/sanctions')} />
        <NavRow testID="settings-export" icon="Copy" label={t('settings.export')} onPress={go('/settings/export')} />
      </RowGroup>
      <Section title={t('settings.section.help')} />
      <RowGroup>
        <NavRow testID="settings-support" icon="Info" label={t('settings.support')} onPress={go('/settings/support')} />
        <NavRow testID="settings-legal" icon="Eye" label={t('settings.legal')} onPress={go('/settings/legal')} />
      </RowGroup>
      <View style={{ marginTop: space[5], gap: space[2] }}>
        {logoutError ? (
          <Banner testID="settings-logout-error" variant="error" message={t('settings.logoutError')} onDismiss={() => setLogoutError(false)} dismissLabel={t('ui.banner.dismiss')} />
        ) : null}
        <Button testID="settings-logout" variant="secondary" label={t('settings.logout')} onPress={() => void logout()} loading={loggingOut} />
        {version ? (
          <Text variant="caption" tone="textMuted" align="center" testID="settings-version">
            {t('settings.version', { version })}
          </Text>
        ) : null}
      </View>
      {/* Action irréversible : groupe à part, au bas de l'écran, loin de l'aide et des mentions légales. */}
      <View style={{ marginTop: space[6] }}>
        <RowGroup>
          <NavRow testID="settings-delete" icon="Trash2" label={t('settings.delete')} tone="danger" onPress={go('/settings/delete-account')} />
        </RowGroup>
      </View>
    </ScreenContainer>
  );
}
