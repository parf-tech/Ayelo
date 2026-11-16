import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { borderWidth, useTheme } from '../../theme';
import { AsyncView, Avatar, Banner, Button, Icon, NavRow, RowGroup, ScreenContainer, Text, useToast, VerifiedBadge } from '../../ui';
import { primaryPhotoUrl } from '../discover/swipe';
import { countryLabel } from '../onboarding/countries';

/** Photo du profil : taille de l'avatar dans l'anneau. */
const AVATAR_SIZE = 104;

/** S59 : mon profil (aperçu, accès à l'édition, vérification, Premium, paramètres). */
export function ProfileTabScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space, colors, radius } = useTheme();
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
          <View
            testID="profile-card"
            style={{
              alignItems: 'center',
              gap: space[2],
              marginBottom: space[4],
              padding: space[5],
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: borderWidth.hairline,
              borderColor: colors.border,
            }}
          >
            <View style={{ padding: space[1], borderRadius: radius.pill, borderWidth: borderWidth.strong, borderColor: colors.primary }}>
              <Avatar uri={primaryPhotoUrl(profile)} name={profile.display_name} size={AVATAR_SIZE} testID="profile-avatar" />
            </View>
            <Text variant="h2" header testID="profile-name" align="center">
              {t('profileTab.age', { name: profile.display_name, age: profile.age })}
            </Text>
            <Text variant="body" tone="textMuted" align="center">
              {[profile.city, countryLabel(t, profile.residence_country)].filter(Boolean).join(', ')}
            </Text>
            {profile.verified ? (
              <VerifiedBadge testID="profile-verified" label={t('detail.verified')} explanation={t('verified.explain')} hint={t('verified.hint')} />
            ) : null}
            {data?.premium ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                <Icon name="Sparkles" size="sm" tone="success" />
                <Text variant="captionStrong" tone="success" testID="profile-premium-badge">
                  {t('profileTab.premiumActive')}
                </Text>
              </View>
            ) : null}
            {!hasApprovedPhoto || !profile.is_visible ? (
              <Banner testID="profile-not-visible" variant="info" message={t('profileTab.notVisible')} style={{ alignSelf: 'stretch' }} />
            ) : null}
          </View>
        ) : (
          <Banner testID="profile-missing" variant="info" message={t('profileTab.noProfile')} actionLabel={t('profileTab.noProfile.action')} onAction={go('/onboarding/profile')} style={{ marginBottom: space[3] }} />
        )}

        <Text variant="body" tone="textMuted" testID="profile-credits" style={{ marginBottom: space[3] }}>
          {t('profileTab.credits', { count: data?.credits.conversation ?? 0 })}
        </Text>
        <RowGroup testID="profile-menu">
          <NavRow testID="profile-edit" icon="Pencil" label={t('profileTab.edit')} onPress={go('/profile-edit')} disabled={!profile} />
          <NavRow testID="profile-verify" icon="ShieldCheck" label={t('profileTab.verify')} onPress={go('/verification')} disabled={!profile} />
          <NavRow testID="profile-premium" icon="Sparkles" label={t('profileTab.premium')} onPress={go('/premium')} />
          <NavRow testID="profile-settings" icon="SlidersHorizontal" label={t('profileTab.settings')} onPress={go('/settings')} />
        </RowGroup>
      </AsyncView>
    </ScreenContainer>
  );
}
