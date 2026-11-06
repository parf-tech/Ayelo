import { useRouter } from 'expo-router';
import React from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { usePolling } from '../../hooks/usePolling';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, ScreenContainer, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

/** S41 : suivi de la vérification (en attente, vérifié, refusé avec motif). Actualisation périodique tant que c'est en attente. */
export function VerificationStatusScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const { api, refreshMe } = useAuth();
  const data = useResource(() => api.profile.verification(), [api]);
  const status = data.data?.verification_status;

  usePolling(
    () => {
      void data.reload({ silent: true }).then(() => refreshMe());
    },
    30000,
    status === 'pending',
  );

  const variant = status === 'verified' ? 'success' : status === 'rejected' ? 'error' : 'info';
  const message =
    status === 'verified'
      ? t('verifyStatus.verified')
      : status === 'pending'
        ? t('verifyStatus.pending')
        : status === 'rejected'
          ? t('verifyStatus.rejected')
          : t('verifyStatus.none');
  const reason = data.data?.last_request?.reject_reason;

  return (
    <ScreenContainer scroll testID="screen-verification-status">
      <ScreenHeader title={t('verifyStatus.title')} fallbackHref="/profile" />
      <AsyncView status={data.status} error={data.error} onRetry={() => void data.reload()} testID="verification-status">
        <Banner testID="verification-status-banner" variant={variant} message={message} style={{ marginBottom: space[3] }} />
        {status === 'rejected' && reason ? (
          <Text variant="body" tone="textMuted" testID="verification-reason" style={{ marginBottom: space[3] }}>
            {t('verifyStatus.reason', { reason })}
          </Text>
        ) : null}
        {status === 'rejected' || status === 'none' ? (
          <Button
            testID="verification-retry"
            label={status === 'rejected' ? t('verifyStatus.retry') : t('verifyStatus.start')}
            onPress={() => router.replace('/verification' as never)}
          />
        ) : (
          <Button testID="verification-refresh" variant="secondary" label={t('verifyStatus.refresh')} onPress={() => void data.reload({ silent: true })} />
        )}
      </AsyncView>
    </ScreenContainer>
  );
}
