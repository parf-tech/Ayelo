import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { BillingStatus } from '../../api/types';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Banner, Button, ScreenContainer, Skeleton, Text } from '../../ui';
import { usePremium } from './PremiumProvider';

export const POLL_INTERVAL_MS = 3000;
export const MAX_ATTEMPTS = 10;

type Phase = 'validating' | 'confirmed' | 'timeout';

/** Le serveur a-t-il enregistré l'achat ? Premium devenu actif, ou solde de crédits en hausse. */
export function isPurchaseConfirmed(
  kind: string,
  baseline: { premium: boolean; credits: number; periodEnd: string },
  status: BillingStatus,
): boolean {
  if (kind === 'subscription') {
    // Nouvel abonnement : Premium devenu actif. Renouvellement / extension : la fin de période a changé.
    return status.premium && (!baseline.premium || (status.subscription?.period_end ?? '') !== baseline.periodEnd);
  }
  return status.credits.conversation > baseline.credits;
}

/**
 * S32 : confirmation. L'application n'affiche « succès » qu'après confirmation du SERVEUR (webhook RevenueCat,
 * lu via POST /billing/sync ou l'événement billing.updated), jamais sur la seule réponse du store.
 */
export function PurchaseResultScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { syncStatus } = usePremium();
  const params = useLocalSearchParams<{ kind?: string; premium?: string; credits?: string; periodEnd?: string }>();
  const kind = typeof params.kind === 'string' ? params.kind : 'subscription';
  const baseline = {
    premium: params.premium === '1',
    credits: Number(typeof params.credits === 'string' ? params.credits : '0') || 0,
    periodEnd: typeof params.periodEnd === 'string' ? params.periodEnd : '',
  };
  const [phase, setPhase] = useState<Phase>('validating');
  const [credits, setCredits] = useState<number | null>(null);
  const attempts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const checkRef = useRef<() => Promise<void>>(async () => undefined);
  const check = useCallback(async () => {
    attempts.current += 1;
    const status = await syncStatus();
    if (!alive.current) return;
    if (status && isPurchaseConfirmed(kind, baseline, status)) {
      setCredits(status.credits.conversation);
      setPhase('confirmed');
      return;
    }
    if (attempts.current >= MAX_ATTEMPTS) {
      setPhase('timeout');
      return;
    }
    timer.current = setTimeout(() => void checkRef.current(), POLL_INTERVAL_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, syncStatus]);
  useEffect(() => {
    checkRef.current = check;
  });

  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [check]);

  const retry = () => {
    attempts.current = 0;
    setPhase('validating');
    void check();
  };

  return (
    <ScreenContainer
      testID="screen-purchase-result"
      footer={
        phase === 'confirmed' ? (
          <Button testID="purchase-done" label={t('purchase.done')} onPress={() => router.replace('/profile' as never)} />
        ) : phase === 'timeout' ? (
          <View style={{ gap: space[2] }}>
            <Button testID="purchase-check" label={t('purchase.check')} onPress={retry} />
            <Button testID="purchase-support" variant="secondary" label={t('purchase.support')} onPress={() => router.replace('/settings/support' as never)} />
          </View>
        ) : undefined
      }
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: space[3] }}>
        <Text variant="title" header>
          {t('purchase.title')}
        </Text>
        {phase === 'validating' ? (
          <>
            <Text variant="body" accessibilityLiveRegion="polite" testID="purchase-validating">
              {t('purchase.validating')}
            </Text>
            <Text variant="caption" tone="textMuted">
              {t('purchase.validating.hint')}
            </Text>
            <Skeleton />
          </>
        ) : null}
        {phase === 'confirmed' ? (
          <Banner
            testID="purchase-confirmed"
            variant="success"
            message={kind === 'subscription' ? t('purchase.confirmed.premium') : t('purchase.confirmed.credits', { count: credits ?? 0 })}
          />
        ) : null}
        {phase === 'timeout' ? <Banner testID="purchase-timeout" variant="warning" message={t('purchase.timeout')} /> : null}
      </View>
    </ScreenContainer>
  );
}
