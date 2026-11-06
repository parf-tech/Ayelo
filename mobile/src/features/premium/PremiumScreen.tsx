import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, ChoiceCard, ScreenContainer, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { getLegalLinks, openExternal } from '../legal/links';
import { usePremium } from './PremiumProvider';
import { usePurchase } from './usePurchase';

/** S30 : offres Premium (1 / 3 / 12 mois). Prix du store (RevenueCat) ; sans store, achat désactivé avec explication. */
export function PremiumScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { space } = useTheme();
  const { provider, offers, refreshStatus } = usePremium();
  const purchase = usePurchase();
  const [selected, setSelected] = useState<string | null>(null);

  const data = useResource(async () => {
    const [available, status] = await Promise.all([offers(), refreshStatus()]);
    const ids = available.subscriptions.map((s) => s.product_id);
    const products = provider.available ? await provider.getProducts(ids, 'subscription').catch(() => []) : [];
    return { available, status, products };
  }, [provider]);

  const links = getLegalLinks();
  const plans = [...(data.data?.available.subscriptions ?? [])].sort((a, b) => a.months - b.months);
  const priceOf = (productId: string) => data.data?.products.find((p) => p.productId === productId)?.priceString;
  const planLabel = (months: number) =>
    months === 1 || months === 3 || months === 12
      ? t(`premium.plan.${months}` as 'premium.plan.1')
      : t('premium.plan.other', { months });
  const status = data.data?.status;
  const dateText = status?.subscription?.period_end
    ? new Date(status.subscription.period_end).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <ScreenContainer
      scroll
      testID="screen-premium"
      footer={
        <Button
          testID="premium-subscribe"
          label={t('premium.subscribe')}
          onPress={() => selected && void purchase.buy(selected, 'subscription')}
          disabled={!selected || !purchase.available}
          loading={purchase.busyId !== null}
        />
      }
    >
      <ScreenHeader title={t('premium.title')} fallbackHref="/profile" />
      <Text variant="body" tone="textMuted" style={{ marginBottom: space[3] }}>
        {t('premium.subtitle')}
      </Text>
      {!purchase.available ? (
        <Banner testID="premium-unavailable" variant="warning" message={purchase.unavailableMessage ?? ''} style={{ marginBottom: space[3] }} />
      ) : null}
      {purchase.notice ? (
        <Banner testID="premium-notice" variant={purchase.notice.variant} message={purchase.notice.message} style={{ marginBottom: space[3] }} />
      ) : null}
      <AsyncView
        testID="premium"
        status={data.status}
        error={data.error}
        onRetry={() => void data.reload()}
        empty={plans.length === 0}
        emptyTitle={t('premium.offers.empty')}
      >
        {status?.premium ? (
          <Banner
            testID="premium-active"
            variant="success"
            message={dateText ? t('premium.active', { date: dateText }) : t('premium.activeNoDate')}
            style={{ marginBottom: space[3] }}
          />
        ) : null}
        <View accessibilityRole="radiogroup" accessibilityLabel={t('premium.title')} style={{ gap: space[2] }}>
          {plans.map((plan) => (
            <ChoiceCard
              key={plan.product_id}
              testID={`plan-${plan.product_id}`}
              label={planLabel(plan.months)}
              description={priceOf(plan.product_id) ?? t('premium.price.unknown')}
              selected={selected === plan.product_id}
              onPress={() => setSelected(plan.product_id)}
            />
          ))}
        </View>
        {!selected ? (
          <Text variant="caption" tone="textMuted" style={{ marginTop: space[2] }}>
            {t('premium.selectPlan')}
          </Text>
        ) : null}
        <Text variant="caption" tone="textMuted" style={{ marginTop: space[3] }} testID="premium-renewal">
          {t('premium.renewal')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space[2] }}>
          <Button
            testID="premium-terms"
            variant="ghost"
            label={links.terms ? t('premium.terms') : `${t('premium.terms')} (${t('premium.linkMissing')})`}
            disabled={!links.terms}
            onPress={() => links.terms && void openExternal(links.terms)}
          />
          <Button
            testID="premium-privacy"
            variant="ghost"
            label={links.privacy ? t('premium.privacy') : `${t('premium.privacy')} (${t('premium.linkMissing')})`}
            disabled={!links.privacy}
            onPress={() => links.privacy && void openExternal(links.privacy)}
          />
        </View>
        <Button testID="premium-restore" variant="secondary" label={t('premium.restore')} onPress={() => void purchase.restore()} style={{ marginTop: space[2] }} />
        <Button testID="premium-credits" variant="ghost" label={t('premium.credits.cta')} onPress={() => router.push('/premium/credits' as never)} />
      </AsyncView>
    </ScreenContainer>
  );
}
