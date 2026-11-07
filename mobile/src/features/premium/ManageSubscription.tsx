import React from 'react';
import { Platform, View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, ListRow, Text, useToast } from '../../ui';
import { openExternal } from '../legal/links';

export const APP_STORE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
export const PLAY_STORE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

/**
 * Page « Abonnements » de la boutique où l'utilisateur gère ou résilie. On suit la boutique de l'abonnement
 * quand le serveur l'indique (apple / google), sinon la plateforme de l'appareil.
 */
export function subscriptionsUrl(store?: string | null, os: string = Platform.OS): string {
  if (store && /apple|app_?store|ios/i.test(store)) return APP_STORE_SUBSCRIPTIONS_URL;
  if (store && /google|play|android/i.test(store)) return PLAY_STORE_SUBSCRIPTIONS_URL;
  return os === 'ios' ? APP_STORE_SUBSCRIPTIONS_URL : PLAY_STORE_SUBSCRIPTIONS_URL;
}

type Props = {
  /** `store` de l'abonnement renvoyé par GET /billing/status. */
  store?: string | null;
  /** `button` : bouton secondaire (écran Premium) ; `row` : ligne de liste (réglages). */
  variant: 'button' | 'row';
  testID?: string;
};

/** Accès direct, sans détour ni offre de rétention, à la gestion/résiliation de l'abonnement dans la boutique. */
export function ManageSubscription({ store, variant, testID }: Props) {
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const label = t('premium.manage.cta');
  const open = async () => {
    const ok = await openExternal(subscriptionsUrl(store));
    if (!ok) toast.show({ message: t('premium.manage.openError'), variant: 'error' });
  };
  const info = (
    <Text variant="caption" tone="textMuted" style={{ marginTop: space[1], marginBottom: space[2] }} testID={testID ? `${testID}-info` : undefined}>
      {t('premium.manage.info')}
    </Text>
  );
  return (
    <View>
      {variant === 'row' ? (
        <ListRow testID={testID} label={label} onPress={() => void open()} />
      ) : (
        <Button testID={testID} variant="secondary" label={label} accessibilityHint={t('premium.manage.info')} onPress={() => void open()} />
      )}
      {info}
    </View>
  );
}
