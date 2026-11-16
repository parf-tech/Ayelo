import React from 'react';
import { View } from 'react-native';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { borderWidth, radius, useTheme } from '../../theme';
import { AsyncView, Banner, Button, Icon, ListRow, ScreenContainer, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { usePremium } from './PremiumProvider';
import { usePurchase } from './usePurchase';

/** S31 : packs de crédits « Conversation » (consommables). */
export function CreditsScreen() {
  const { t } = useI18n();
  const { colors, space } = useTheme();
  const { provider, offers, refreshStatus } = usePremium();
  const purchase = usePurchase();

  const data = useResource(async () => {
    const [available, status] = await Promise.all([offers(), refreshStatus()]);
    const packs = available.packs.filter((p) => p.type === 'conversation').sort((a, b) => a.credits - b.credits);
    const products = provider.available ? await provider.getProducts(packs.map((p) => p.product_id), 'consumable').catch(() => []) : [];
    return { packs, status, products };
  }, [provider]);

  const packLabel = (credits: number) => (credits === 1 ? t('credits.pack.one') : t('credits.pack.many', { count: credits }));

  return (
    <ScreenContainer scroll testID="screen-credits">
      <ScreenHeader title={t('credits.title')} fallbackHref="/premium" />
      <Text variant="body" tone="textMuted" style={{ marginBottom: space[3] }}>
        {t('credits.subtitle')}
      </Text>
      {!purchase.available ? (
        <Banner testID="credits-unavailable" variant="warning" message={purchase.unavailableMessage ?? ''} style={{ marginBottom: space[3] }} />
      ) : null}
      {purchase.notice ? <Banner testID="credits-notice" variant={purchase.notice.variant} message={purchase.notice.message} style={{ marginBottom: space[3] }} /> : null}
      <AsyncView
        testID="credits"
        status={data.status}
        error={data.error}
        onRetry={() => void data.reload()}
        empty={(data.data?.packs.length ?? 0) === 0}
        emptyTitle={t('premium.offers.empty')}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            padding: space[4],
            marginBottom: space[3],
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: borderWidth.hairline,
            borderColor: colors.border,
          }}
        >
          <Icon name="MessageCircle" size="lg" tone="primary" />
          <Text variant="body" style={{ fontWeight: '600', flex: 1 }} testID="credits-balance">
            {t('premium.balance', { count: data.data?.status.credits.conversation ?? 0 })}
          </Text>
        </View>
        <View>
          {(data.data?.packs ?? []).map((pack) => {
            const price = data.data?.products.find((p) => p.productId === pack.product_id)?.priceString;
            return (
              <ListRow
                key={pack.product_id}
                testID={`pack-${pack.product_id}`}
                label={packLabel(pack.credits)}
                description={price ?? t('premium.price.unknown')}
                leading={<Icon name="MessageCircle" size="md" tone="primary" />}
                trailing={
                  <Button
                    testID={`buy-${pack.product_id}`}
                    label={t('credits.buy')}
                    accessibilityLabel={t('credits.buyPack', { pack: packLabel(pack.credits) })}
                    onPress={() => void purchase.buy(pack.product_id, 'consumable')}
                    disabled={!purchase.available}
                    loading={purchase.busyId === pack.product_id}
                  />
                }
              />
            );
          })}
        </View>
      </AsyncView>
    </ScreenContainer>
  );
}
