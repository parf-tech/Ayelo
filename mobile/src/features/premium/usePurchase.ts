import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { ProductKind } from '../../billing/purchaseProvider';
import { useI18n } from '../../i18n';
import { usePremium } from './PremiumProvider';

export type PurchaseNotice = { variant: 'info' | 'warning' | 'error'; message: string };

/** Lance un achat via le PurchaseProvider ; si le store valide, ouvre S32 (validation par le serveur). Rien n'est jamais simulé. */
export function usePurchase() {
  const router = useRouter();
  const { t } = useI18n();
  const { provider, status } = usePremium();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<PurchaseNotice | undefined>();

  // Les causes techniques (Expo Go, clé RevenueCat absente...) ne sont montrées qu'en développement ; l'utilisateur lit un message générique.
  const unavailableMessage = provider.available
    ? null
    : __DEV__
      ? t(`premium.unavailable.${provider.unavailableReason ?? 'expo_go'}`)
      : t('premium.unavailable.generic');

  const buy = async (productId: string, kind: ProductKind) => {
    if (busyId) return;
    setNotice(undefined);
    if (!provider.available) {
      setNotice({ variant: 'warning', message: unavailableMessage ?? '' });
      return;
    }
    setBusyId(productId);
    const baseline = { premium: status?.premium ?? false, credits: status?.credits.conversation ?? 0, periodEnd: status?.subscription?.period_end ?? '' };
    try {
      const outcome = await provider.purchase(productId, kind);
      switch (outcome.kind) {
        case 'purchased':
          router.replace({
            pathname: '/premium/result',
            params: { kind, premium: baseline.premium ? '1' : '0', credits: String(baseline.credits), periodEnd: baseline.periodEnd },
          } as never);
          return;
        case 'pending':
          setNotice({ variant: 'info', message: t('premium.pending') });
          return;
        case 'cancelled':
          return;
        case 'unavailable':
          setNotice({ variant: 'warning', message: unavailableMessage ?? t('premium.unavailable.generic') });
          return;
        default:
          setNotice({ variant: 'error', message: t('premium.purchaseError') });
      }
    } finally {
      setBusyId(null);
    }
  };

  const restore = async () => {
    setNotice(undefined);
    const outcome = await provider.restore();
    if (outcome.kind === 'restored') setNotice({ variant: 'info', message: t('premium.restore.done') });
    else if (outcome.kind === 'unavailable') setNotice({ variant: 'warning', message: unavailableMessage ?? '' });
    else setNotice({ variant: 'error', message: t('premium.restore.error') });
  };

  return { buy, restore, busyId, notice, setNotice, available: provider.available, unavailableMessage };
}
