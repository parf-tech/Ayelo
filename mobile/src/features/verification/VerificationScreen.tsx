import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { pickImage, type PickedImage } from '../../media/picker';
import { uploadMedia } from '../../media/upload';
import { borderWidth, useTheme } from '../../theme';
import { AsyncView, Banner, Button, CheckboxField, Icon, ScreenContainer, Text } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { poseLabel } from './poses';

/**
 * S40 : vérification du profil. Consigne de pose (GET /me/verification/pose), consentement biométrique distinct
 * (POST /me/consents verification_biometric), selfie à la caméra, envoi présigné puis POST /me/verification.
 */
export function VerificationScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space, radius, colors } = useTheme();
  const { api, refreshMe } = useAuth();
  const data = useResource(async () => {
    const [pose, overview, consents] = await Promise.all([api.profile.pose(), api.profile.verification(), api.auth.consents()]);
    return { pose: pose.pose, overview, consentGranted: consents.data.verification_biometric?.granted === true };
  }, [api]);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [selfie, setSelfie] = useState<PickedImage | null>(null);
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<{ variant: 'error' | 'warning'; message: string; settings?: boolean } | undefined>();

  const alreadyConsented = data.data?.consentGranted === true;
  const verified = data.data?.overview.verification_status === 'verified';
  const pending = data.data?.overview.verification_status === 'pending';

  const takeSelfie = async () => {
    setBanner(undefined);
    const result = await pickImage('camera');
    if (result.kind === 'denied') setBanner({ variant: 'warning', message: t('verify.cameraDenied'), settings: true });
    else if (result.kind === 'picked') setSelfie(result.image);
  };

  const submit = async () => {
    if (!selfie || sending) return;
    if (!alreadyConsented && !consent) {
      setConsentError(true);
      return;
    }
    setSending(true);
    setBanner(undefined);
    try {
      if (!alreadyConsented) await api.auth.updateConsent({ kind: 'verification_biometric', granted: true });
      const uploaded = await uploadMedia(api, { kind: 'verification_selfie', image: selfie });
      await api.profile.startVerification(uploaded.media_id);
      await refreshMe();
      router.replace('/verification/status' as never);
    } catch (error) {
      const { key, params } = apiErrorMessage(error);
      setBanner({ variant: 'error', message: t(key, params) });
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer
      scroll
      testID="screen-verification"
      footer={
        !verified && !pending && data.status === 'ready' ? (
          <View style={{ gap: space[2] }}>
            <Button testID="verify-submit" label={t('verify.submit')} onPress={() => void submit()} loading={sending} loadingLabel={t('verify.sending')} disabled={!selfie} />
            {!selfie ? (
              <Text variant="bodySmall" tone="textMuted" align="center" testID="verify-need-selfie">
                {t('verify.needSelfie')}
              </Text>
            ) : null}
          </View>
        ) : undefined
      }
    >
      <ScreenHeader title={t('verify.title')} fallbackHref="/profile" />
      <Text variant="body" tone="textMuted" style={{ marginBottom: space[3] }}>
        {t('verify.subtitle')}
      </Text>
      {banner ? (
        <Banner
          testID="verify-banner"
          variant={banner.variant}
          message={banner.message}
          actionLabel={banner.settings ? t('verify.cameraDenied.action') : undefined}
          onAction={banner.settings ? () => void Linking.openSettings() : undefined}
          style={{ marginBottom: space[3] }}
        />
      ) : null}
      <AsyncView status={data.status} error={data.error} onRetry={() => void data.reload()} testID="verification">
        {verified || pending ? (
          <View style={{ gap: space[3] }}>
            <Banner testID="verify-already" variant={verified ? 'success' : 'info'} message={verified ? t('verify.alreadyVerified') : t('verifyStatus.pending')} />
            <Button testID="verify-see-status" variant="secondary" label={t('verify.seeStatus')} onPress={() => router.replace('/verification/status' as never)} />
          </View>
        ) : (
          <View style={{ gap: space[4] }}>
            <View
              style={{
                flexDirection: 'row',
                gap: space[3],
                padding: space[4],
                borderRadius: radius.lg,
                borderWidth: borderWidth.hairline,
                borderColor: colors.border,
                borderLeftWidth: borderWidth.strong * 2,
                borderLeftColor: colors.primary,
                backgroundColor: colors.surface,
              }}
            >
              <Icon name="Camera" size="lg" tone="primary" />
              <View style={{ flex: 1 }}>
                <Text variant="caption" tone="textMuted">
                  {t('verify.pose')}
                </Text>
                <Text variant="h2" testID="verify-pose">
                  {poseLabel(t, data.data?.pose)}
                </Text>
                <Text variant="body" tone="textMuted" style={{ marginTop: space[1] }}>
                  {t('verify.pose.hint', { pose: poseLabel(t, data.data?.pose) })}
                </Text>
              </View>
            </View>
            {!alreadyConsented ? (
              <View>
                <CheckboxField
                  testID="verify-consent"
                  label={t('verify.consent.label')}
                  description={t('verify.consent.description')}
                  checked={consent}
                  onChange={(value) => {
                    setConsent(value);
                    setConsentError(false);
                  }}
                />
                {consentError ? (
                  <Text variant="caption" tone="danger" accessibilityRole="alert" testID="verify-consent-error">
                    {t('verify.consent.required')}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {selfie ? (
              <Image
                testID="verify-preview"
                source={{ uri: selfie.uri }}
                accessible
                accessibilityRole="image"
                accessibilityLabel={t('verify.preview')}
                accessibilityIgnoresInvertColors
                style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.lg, backgroundColor: colors.skeleton }}
              />
            ) : null}
            <Button testID="verify-camera" variant="secondary" label={selfie ? t('verify.retake') : t('verify.takePhoto')} onPress={() => void takeSelfie()} />
          </View>
        )}
      </AsyncView>
    </ScreenContainer>
  );
}
