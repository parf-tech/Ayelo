import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useTheme } from '../../theme';
import { AsyncView, Avatar, Banner, Button, ScreenContainer, Text, useToast, VerifiedBadge } from '../../ui';
import { primaryPhotoUrl } from '../discover/swipe';
import { countryLabel } from '../onboarding/countries';

/** S59 : mon profil (aperçu, accès à l'édition, vérification, Premium, paramètres). */
export function ProfileTabScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space } = useTheme();
  const toast = useToast();
  const { api } = useAuth();
  const me = useResource(() => api.auth.me(), [api]);
  const [resending, setResending] = useState(false);
  const data = me.data;
  const profile = data?.profile ?? null;
  const go = (path: string) => () => router.push(path as never);

  const resend = async () => {
    setResending(true);
    try {
      await api.auth.resendEmail();
      toast.show({ message: t('verifyEmail.resent'), variant: 'success' });
    } catch (error) {
      const { key, params } = apiErrorMessage(error);
      toast.show({ message: t(key, params), variant: 'error' });
    } finally {
      setResending(false);
    }
  };

  const hasApprovedPhoto = profile?.media.some((m) => m.kind === 'profile_photo' && m.status === 'approved') ?? false;

  return (
    <ScreenContainer scroll testID="screen-profile-tab">
      <Text variant="title" header style={{ marginBottom: space[3] }}>
        {t('profileTab.title')}
      </Text>
      <AsyncView testID="profile-tab" status={me.status} error={me.error} onRetry={() => void me.reload()} skeletonRows={3}>
        {data && data.email_verified === false ? (
          <Banner
            testID="profile-email-banner"
            variant="warning"
            message={t('verifyEmail.banner')}
            actionLabel={t('verifyEmail.banner.action')}
            onAction={go('/verify-email')}
            style={{ marginBottom: space[3] }}
          />
        ) : null}
        {data && data.email_verified === false ? (
          <Button testID="profile-resend" variant="ghost" label={t('verifyEmail.resend')} onPress={() => void resend()} loading={resending} />
        ) : null}

        {profile ? (
          <View style={{ alignItems: 'center', gap: space[2], marginBottom: space[4] }}>
            <Avatar uri={primaryPhotoUrl(profile)} name={profile.display_name} size={120} testID="profile-avatar" />
            <Text variant="h2" header testID="profile-name">
              {t('profileTab.age', { name: profile.display_name, age: profile.age })}
            </Text>
            <Text variant="body" tone="textMuted">
              {[profile.city, countryLabel(t, profile.residence_country)].filter(Boolean).join(', ')}
            </Text>
            {profile.verified ? (
              <VerifiedBadge testID="profile-verified" label={t('detail.verified')} explanation={t('verified.explain')} hint={t('verified.hint')} />
            ) : null}
            {data?.premium ? (
              <Text variant="caption" tone="success" style={{ fontWeight: '700' }} testID="profile-premium-badge">
                {t('profileTab.premiumActive')}
              </Text>
            ) : null}
            {!hasApprovedPhoto || !profile.is_visible ? (
              <Banner testID="profile-not-visible" variant="info" message={t('profileTab.notVisible')} />
            ) : null}
          </View>
        ) : (
          <Banner testID="profile-missing" variant="info" message={t('profileTab.noProfile')} actionLabel={t('profileTab.noProfile.action')} onAction={go('/onboarding/profile')} style={{ marginBottom: space[3] }} />
        )}

        <Text variant="body" tone="textMuted" testID="profile-credits" style={{ marginBottom: space[3] }}>
          {t('profileTab.credits', { count: data?.credits.conversation ?? 0 })}
        </Text>
        <View style={{ gap: space[2] }}>
          <Button testID="profile-edit" label={t('profileTab.edit')} onPress={go('/profile-edit')} disabled={!profile} />
          <Button testID="profile-verify" variant="secondary" label={t('profileTab.verify')} onPress={go('/verification')} disabled={!profile} />
          <Button testID="profile-premium" variant="secondary" label={t('profileTab.premium')} onPress={go('/premium')} />
          <Button testID="profile-settings" variant="secondary" label={t('profileTab.settings')} onPress={go('/settings')} />
        </View>
      </AsyncView>
    </ScreenContainer>
  );
}
