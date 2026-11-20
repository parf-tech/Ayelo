import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { AsyncView, ListRow, ScreenContainer } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { formatPurchaseAmount, formatPurchaseDate, purchaseStatusKey } from './purchaseHistory';

/**
 * S34 : historique des achats (GET /billing/transactions : les 100 derniers, sans curseur).
 * Lecture seule : le remboursement et la résiliation se font dans la boutique (voir « Gérer mon abonnement »).
 * Les offres (GET /billing/offers) ne servent qu'à nommer les produits : si elles sont indisponibles, la ligne s'appelle « Achat ».
 */
export function PurchaseHistoryScreen() {
  const { t, locale } = useI18n();
  const { space } = useTheme();
  const { api } = useAuth();
  const history = useResource(() => api.billing.transactions(), [api]);
  const offers = useResource(() => api.billing.offers(), [api]);

  // On attend les offres (réussies ou en échec) avant d'afficher la liste : sinon les noms changeraient sous les yeux.
  const status = history.status === 'ready' && offers.status === 'loading' ? 'loading' : history.status;
  const list = history.data?.data ?? [];

  const planLabel = (months: number) =>
    months === 1 || months === 3 || months === 12 ? t(`premium.plan.${months}` as 'premium.plan.1') : t('premium.plan.other', { months });

  const productLabel = (productId: string) => {
    const subscription = offers.data?.subscriptions.find((s) => s.product_id === productId);
    if (subscription) return t('purchases.product.subscription', { plan: planLabel(subscription.months) });
    const pack = offers.data?.packs.find((p) => p.product_id === productId);
    if (pack) return pack.credits === 1 ? t('credits.pack.one') : t('credits.pack.many', { count: pack.credits });
    return t('purchases.product.unknown');
  };

  const retry = () => {
    void history.reload();
    if (offers.status === 'error') void offers.reload();
  };

  return (
    <ScreenContainer scroll testID="screen-purchases">
      <ScreenHeader title={t('purchases.title')} fallbackHref="/settings" />
      <View style={{ paddingTop: space[3] }}>
        <AsyncView
          testID="purchases"
          status={status}
          error={history.error}
          onRetry={retry}
          empty={list.length === 0}
          emptyTitle={t('purchases.empty')}
          emptyDescription={t('purchases.empty.body')}
        >
          {list.map((purchase) => {
            const statusKey = purchaseStatusKey(purchase.status);
            const description = [formatPurchaseDate(purchase.created_at, locale), statusKey ? t(statusKey) : null]
              .filter((part): part is string => Boolean(part))
              .join(', ');
            return (
              <ListRow
                key={purchase.id}
                testID={`purchase-${purchase.id}`}
                label={productLabel(purchase.product_id)}
                description={description || undefined}
                value={formatPurchaseAmount(purchase.price_cents, purchase.currency, locale) ?? undefined}
              />
            );
          })}
        </AsyncView>
      </View>
    </ScreenContainer>
  );
}
