import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { usePolling } from '../../hooks/usePolling';
import { useTheme } from '../../theme';
import { AsyncView, Banner, Button, Icon, ScreenContainer, Text, type IconName } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';

/** Médaillon du statut : un cercle de cette taille. */
const MEDAL_SIZE = 88;

/** S41 : suivi de la vérification (en attente, vérifié, refusé avec motif). Actualisation périodique tant que c'est en attente. */
export function VerificationStatusScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space, colors, radius } = useTheme();
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
  // Pictogramme décoratif : le texte de la bannière porte le statut (jamais la seule icône ou couleur).
  const glyph: IconName = status === 'verified' ? 'BadgeCheck' : status === 'rejected' ? 'CircleX' : status === 'pending' ? 'Clock' : 'ShieldCheck';
  const glyphTone = status === 'verified' ? 'success' : status === 'rejected' ? 'danger' : 'primary';

  return (
    <ScreenContainer scroll testID="screen-verification-status">
      <ScreenHeader title={t('verifyStatus.title')} fallbackHref="/profile" />
      <AsyncView status={data.status} error={data.error} onRetry={() => void data.reload()} testID="verification-status">
        <View style={{ gap: space[6] }}>
          {/* Médaillon décoratif : le texte de la bannière porte le statut (jamais l'icône ou la couleur seules). */}
          <View style={{ alignItems: 'center' }}>
            <View
              style={{ width: MEDAL_SIZE, height: MEDAL_SIZE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}
            >
              <Icon name={glyph} size="xl" tone={glyphTone} />
            </View>
          </View>
          <View style={{ gap: space[3] }}>
            <Banner testID="verification-status-banner" variant={variant} message={message} />
            {status === 'rejected' && reason ? (
              <Text variant="body" tone="textMuted" testID="verification-reason">
                {t('verifyStatus.reason', { reason })}
              </Text>
            ) : null}
          </View>
          {status === 'rejected' || status === 'none' ? (
            <Button
              testID="verification-retry"
              label={status === 'rejected' ? t('verifyStatus.retry') : t('verifyStatus.start')}
              onPress={() => router.replace('/verification' as never)}
            />
          ) : (
            <Button testID="verification-refresh" variant="secondary" label={t('verifyStatus.refresh')} onPress={() => void data.reload({ silent: true })} />
          )}
        </View>
      </AsyncView>
    </ScreenContainer>
  );
}
