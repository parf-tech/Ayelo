import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, ChoiceCard, ScreenContainer, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { useLegalOpener } from '../legal/useLegalOpener';
import { isPromotionalStore, ManageSubscription } from './ManageSubscription';
import { usePremium } from './PremiumProvider';
import { PremiumBenefits } from './PremiumBenefits';
import { bestValueProductId, monthlyPrice } from './pricing';
import { usePurchase } from './usePurchase';

/** S30 : offres Premium (1 / 3 / 12 mois). Prix du store (RevenueCat) ; sans store, achat désactivé avec explication. */
export function PremiumScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { space } = useTheme();
  const { provider, offers, refreshStatus } = usePremium();
  const purchase = usePurchase();
  const [chosen, setChosen] = useState<string | null>(null);
  const openLegal = useLegalOpener();

  const data = useResource(async () => {
    const [available, status] = await Promise.all([offers(), refreshStatus()]);
    const ids = available.subscriptions.map((s) => s.product_id);
    const products = provider.available ? await provider.getProducts(ids, 'subscription').catch(() => []) : [];
    return { available, status, products };
  }, [provider]);

  const plans = [...(data.data?.available.subscriptions ?? [])].sort((a, b) => a.months - b.months);
  const priceOf = (productId: string) => data.data?.products.find((p) => p.productId === productId)?.priceString;
  const planLabel = (months: number) =>
    months === 1 || months === 3 || months === 12
      ? t(`premium.plan.${months}` as 'premium.plan.1')
      : t('premium.plan.other', { months });
  const status = data.data?.status;
  // Offre la plus longue : présélectionnée. L'étiquette « Meilleur prix » est autre chose : elle n'apparaît que si les prix réels
  // du store la justifient (voir bestValueProductId).
  const longestPlan = plans.length > 1 ? plans.reduce((best, p) => (p.months >= best.months ? p : best)) : null;
  const bestValueId = bestValueProductId(plans, data.data?.products ?? []);
  const selected = chosen ?? longestPlan?.product_id ?? plans[0]?.product_id ?? null;
  const selectedPlan = plans.find((p) => p.product_id === selected) ?? null;
  const selectedPrice = selectedPlan ? priceOf(selectedPlan.product_id) : undefined;
  // Un Premium offert (sans boutique) n'empêche pas de s'abonner ; un abonnement de boutique actif, si.
  const alreadySubscribed = status?.premium === true && !isPromotionalStore(status.subscription?.store);
  const dateText = status?.subscription?.period_end
    ? new Date(status.subscription.period_end).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <ScreenContainer
      scroll
      testID="screen-premium"
      footer={
        data.status === 'ready' && !alreadySubscribed && selectedPlan ? (
          <View style={{ gap: space[2] }}>
            <Text variant="bodyStrong" testID="premium-summary">
              {selectedPrice
                ? t('premium.summary', { plan: planLabel(selectedPlan.months), price: selectedPrice })
                : t('premium.summary.noPrice', { plan: planLabel(selectedPlan.months) })}
            </Text>
            <Button
              testID="premium-subscribe"
              label={selectedPrice ? t('premium.subscribePrice', { price: selectedPrice }) : t('premium.subscribe')}
              onPress={() => selected && void purchase.buy(selected, 'subscription')}
              disabled={!selected || !purchase.available}
              loading={purchase.busyId !== null}
            />
            <Text variant="bodySmall" tone="textMuted" testID="premium-renewal">
              {t('premium.renewal')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space[4] }}>
              <Button testID="premium-terms" variant="ghost" label={t('premium.terms')} onPress={() => void openLegal('terms')} />
              <Button testID="premium-privacy" variant="ghost" label={t('premium.privacy')} onPress={() => void openLegal('privacy')} />
            </View>
          </View>
        ) : undefined
      }
    >
      <ScreenHeader title={t('premium.title')} fallbackHref="/profile" />
      <View style={{ marginBottom: space[4] }}>
        <PremiumBenefits />
      </View>
      {!purchase.available && purchase.unavailableMessage ? (
        <Banner testID="premium-unavailable" variant="warning" message={purchase.unavailableMessage} style={{ marginBottom: space[3] }} />
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
        {status?.premium ? (
          <View style={{ marginBottom: space[3] }}>
            <ManageSubscription testID="premium-manage" variant="button" store={status.subscription?.store} periodEnd={status.subscription?.period_end} />
          </View>
        ) : null}
        {!alreadySubscribed ? (
          <Text variant="h3" header style={{ marginBottom: space[2] }}>
            {t('premium.plans.title')}
          </Text>
        ) : null}
        {!alreadySubscribed ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={t('premium.plans.title')} style={{ gap: space[2] }}>
            {plans.map((plan) => {
              const price = priceOf(plan.product_id) ?? t('premium.price.unknown');
              const perMonth = monthlyPrice(data.data?.products.find((p) => p.productId === plan.product_id), plan.months, locale);
              const parts = [price, perMonth ? t('premium.perMonth', { amount: perMonth }) : null, bestValueId === plan.product_id ? t('premium.bestValue') : null];
              return (
                <ChoiceCard
                  key={plan.product_id}
                  testID={`plan-${plan.product_id}`}
                  label={planLabel(plan.months)}
                  description={parts.filter(Boolean).join(' · ')}
                  selected={selected === plan.product_id}
                  onPress={() => setChosen(plan.product_id)}
                  disabled={purchase.busyId !== null}
                />
              );
            })}
          </View>
        ) : null}
      </AsyncView>
      {/* Restaurer les achats et acheter des crédits restent toujours visibles (chargement, échec ou absence d'offres comprises) : exigence des boutiques. */}
      <View style={{ marginTop: space[2] }}>
        <Button
          testID="premium-restore"
          variant="secondary"
          label={t('premium.restore')}
          onPress={() => void purchase.restore()}
          loading={purchase.restoring}
          disabled={purchase.busyId !== null}
        />
        <Button testID="premium-credits" variant="ghost" label={t('premium.credits.cta')} onPress={() => router.push('/premium/credits' as never)} />
      </View>
    </ScreenContainer>
  );
}
