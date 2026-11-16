import React from 'react';
import { Platform, View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, Icon, Text, useToast } from '../../ui';
import { openExternal } from '../legal/links';
import { NavRow, RowGroup } from '../settings/GroupedList';

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

/** Premium offert par l'équipe (`store: 'promotional'`, sans transaction de boutique) : rien à résilier dans une boutique. */
export function isPromotionalStore(store?: string | null): boolean {
  return Boolean(store && /promo|gift|grant|offert/i.test(store));
}

type Props = {
  /** `store` de l'abonnement renvoyé par GET /billing/status. Inconnu (statut non chargé) : on suit la plateforme. */
  store?: string | null;
  /** `period_end` de l'abonnement, pour le message d'un Premium offert. */
  periodEnd?: string | null;
  /** `button` : bouton secondaire (écran Premium) ; `row` : ligne de liste (réglages). */
  variant: 'button' | 'row';
  testID?: string;
};

/** Note d'explication : pictogramme décoratif + texte (le texte porte le sens), sur le fond de l'écran. */
function Note({ children, testID, onSurface = false }: { children: string; testID?: string; onSurface?: boolean }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[2],
        marginTop: space[2],
        marginBottom: space[2],
        ...(onSurface ? { padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface } : { paddingHorizontal: space[1] }),
      }}
    >
      <View style={{ paddingTop: space[1] }}>
        <Icon name={onSurface ? 'Sparkles' : 'Info'} size="sm" tone={onSurface ? 'primary' : 'textMuted'} />
      </View>
      <Text variant="bodySmall" tone="textMuted" style={{ flex: 1 }} testID={testID}>
        {children}
      </Text>
    </View>
  );
}

/** Accès direct, sans détour ni offre de rétention, à la gestion/résiliation de l'abonnement dans la boutique. */
export function ManageSubscription({ store, periodEnd, variant, testID }: Props) {
  const { t, locale } = useI18n();
  const toast = useToast();
  if (isPromotionalStore(store)) {
    // Pas de boutique derrière cet abonnement : on explique au lieu d'ouvrir une page d'abonnements vide.
    const date = periodEnd ? new Date(periodEnd).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    return (
      <View testID={testID}>
        <Note onSurface testID={testID ? `${testID}-info` : undefined}>
          {date ? t('premium.manage.promo', { date }) : t('premium.manage.promoNoDate')}
        </Note>
      </View>
    );
  }
  const label = t('premium.manage.cta');
  const open = async () => {
    const ok = await openExternal(subscriptionsUrl(store));
    if (!ok) toast.show({ message: t('premium.manage.openError'), variant: 'error' });
  };
  return (
    <View>
      {variant === 'row' ? (
        <RowGroup>
          <NavRow testID={testID} icon="Sparkles" label={label} onPress={() => void open()} />
        </RowGroup>
      ) : (
        <Button testID={testID} variant="secondary" label={label} accessibilityHint={t('premium.manage.info')} onPress={() => void open()} />
      )}
      <Note testID={testID ? `${testID}-info` : undefined}>{t('premium.manage.info')}</Note>
    </View>
  );
}
