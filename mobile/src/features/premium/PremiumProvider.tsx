import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { BillingOffers, BillingStatus } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { createPurchaseProvider } from '../../billing/createPurchaseProvider';
import type { PurchaseProvider } from '../../billing/purchaseProvider';
import { REALTIME_EVENTS, useChannel, userChannel } from '../../realtime';

type PremiumContextValue = {
  provider: PurchaseProvider;
  status: BillingStatus | null;
  /** GET /billing/status (état connu du serveur). Lève l'erreur d'API en cas d'échec. */
  refreshStatus: () => Promise<BillingStatus>;
  /** POST /billing/sync : le serveur recalcule depuis ses webhooks (l'application n'impose jamais l'état). */
  syncStatus: () => Promise<BillingStatus | null>;
  offers: () => Promise<BillingOffers>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

type Props = { children: React.ReactNode; provider?: PurchaseProvider };

/**
 * Achats : passerelle RevenueCat (PurchaseProvider) + état Premium/crédits du serveur.
 * L'`app_user_id` RevenueCat est `user.id`. L'événement temps réel `billing.updated` déclenche un rechargement.
 */
export function PremiumProvider({ children, provider: injected }: Props) {
  const { api, state, refreshMe } = useAuth();
  const provider = useMemo(() => injected ?? createPurchaseProvider(), [injected]);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const userId = state.user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    void provider.configure(userId).catch(() => undefined);
    return () => {
      void provider.logOut();
    };
  }, [provider, userId]);

  const refreshStatus = useCallback(async () => {
    const result = await api.billing.status();
    setStatus(result);
    return result;
  }, [api]);

  const syncStatus = useCallback(async () => {
    try {
      const result = await api.billing.sync();
      setStatus(result);
      void refreshMe();
      return result;
    } catch {
      return null;
    }
  }, [api, refreshMe]);

  const offers = useCallback(() => api.billing.offers(), [api]);

  useChannel(userId ? userChannel(userId) : null, (event) => {
    if (event === REALTIME_EVENTS.billingUpdated) void syncStatus();
  });

  const value = useMemo(
    () => ({ provider, status, refreshStatus, syncStatus, offers }),
    [provider, status, refreshStatus, syncStatus, offers],
  );
  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium doit être utilisé sous <PremiumProvider>.');
  return ctx;
}
