import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, NativeScrollEvent, NativeSyntheticEvent, ScrollView, View, useWindowDimensions } from 'react-native';
import { isApiError } from '../../api/errors';
import type { SwipeAction } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { MAX_CONTENT_WIDTH, useTheme } from '../../theme';
import { AsyncView, Banner, Button, ScreenContainer, Text, useToast } from '../../ui';
import { ScreenHeader } from '../common/ScreenHeader';
import { countryLabel } from '../onboarding/countries';
import { performSwipe, primaryPhotoUrl, readablePhotos } from './swipe';

type Notice = { variant: 'error' | 'warning' | 'info'; message: string; action?: { label: string; href: string } };

/** S11 : détail d'un profil (galerie, bio), actions et menu Bloquer / Signaler / Écrire. */
export function ProfileDetailScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { space, colors, radius } = useTheme();
  const toast = useToast();
  const { api } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profileId = typeof id === 'string' ? id : '';
  const profile = useResource(() => api.profile.publicProfile(profileId), [api, profileId]);
  const { width } = useWindowDimensions();
  const galleryWidth = Math.min(width, MAX_CONTENT_WIDTH) - space[5] * 2;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [notice, setNotice] = useState<Notice | undefined>();
  const [busy, setBusy] = useState(false);

  const data = profile.data;
  const photos = data ? readablePhotos(data) : [];

  const swipe = async (action: SwipeAction) => {
    if (!data || busy) return;
    setBusy(true);
    setNotice(undefined);
    const outcome = await performSwipe(api, data.user_id, action);
    setBusy(false);
    switch (outcome.kind) {
      case 'ok':
        router.back();
        return;
      case 'matched':
        router.replace({
          pathname: '/match',
          params: { name: data.display_name, photo: primaryPhotoUrl(data) ?? '', conversationId: outcome.conversationId ?? '' },
        } as never);
        return;
      case 'premium':
        setNotice({ variant: 'warning', message: t('discover.premiumGate.body'), action: { label: t('discover.premium.cta'), href: '/premium' } });
        return;
      case 'quota':
        setNotice({ variant: 'warning', message: t('discover.quota.body'), action: { label: t('discover.premium.cta'), href: '/premium' } });
        return;
      default: {
        const { key, params } = apiErrorMessage(outcome.error);
        setNotice({ variant: 'error', message: t(key, params) });
      }
    }
  };

  const writeTo = async () => {
    if (!data || busy) return;
    setBusy(true);
    setNotice(undefined);
    setMenuOpen(false);
    try {
      const conversation = await api.messaging.openConversation(data.user_id);
      router.push({
        pathname: '/conversation/[id]',
        params: { id: conversation.id, name: data.display_name, photo: primaryPhotoUrl(data) ?? '', peerId: data.user_id },
      } as never);
    } catch (error) {
      const { key, params } = apiErrorMessage(error);
      const credit = isApiError(error) && (error.status === 402 || error.code === 'credit_required');
      setNotice({
        variant: credit ? 'warning' : 'error',
        message: t(key, params),
        action: credit ? { label: t('premium.credits.cta'), href: '/premium/credits' } : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await api.safety.block(data.user_id);
      toast.show({ message: t('detail.blocked'), variant: 'success' });
      router.back();
    } catch (error) {
      const { key, params } = apiErrorMessage(error);
      setNotice({ variant: 'error', message: t(key, params) });
      setConfirmBlock(false);
    } finally {
      setBusy(false);
    }
  };

  const openReport = () => {
    if (!data) return;
    setMenuOpen(false);
    router.push({
      pathname: '/report',
      params: { reportedId: data.user_id, name: data.display_name, contextType: 'profile', contextId: data.user_id },
    } as never);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / Math.max(galleryWidth, 1)));
  };

  const place = data ? [data.city, countryLabel(t, data.residence_country)].filter(Boolean).join(', ') : '';

  return (
    <ScreenContainer scroll testID="screen-profile-detail">
      <ScreenHeader
        title={data ? `${data.display_name}, ${data.age}` : t('detail.title')}
        right={
          data ? (
            <Button
              testID="detail-menu"
              variant="ghost"
              label="⋯"
              accessibilityLabel={t('detail.menu')}
              onPress={() => {
                setMenuOpen((open) => !open);
                setConfirmBlock(false);
              }}
            />
          ) : undefined
        }
      />
      {notice ? (
        <Banner
          testID="detail-notice"
          variant={notice.variant}
          message={notice.message}
          actionLabel={notice.action?.label}
          onAction={notice.action ? () => router.push(notice.action?.href as never) : undefined}
          style={{ marginBottom: space[3] }}
        />
      ) : null}
      {menuOpen ? (
        <View
          testID="detail-menu-sheet"
          accessibilityViewIsModal
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: space[2], marginBottom: space[3] }}
        >
          {confirmBlock && data ? (
            <View style={{ gap: space[2], padding: space[2] }}>
              <Text variant="h2">{t('detail.blockConfirm.title', { name: data.display_name })}</Text>
              <Text variant="body" tone="textMuted">
                {t('detail.blockConfirm.body')}
              </Text>
              <Button testID="detail-block-confirm" variant="danger" label={t('detail.blockConfirm.action')} onPress={() => void block()} loading={busy} />
              <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirmBlock(false)} />
            </View>
          ) : (
            <>
              <Button testID="detail-write" variant="ghost" label={t('detail.message')} onPress={() => void writeTo()} />
              <Button testID="detail-report" variant="ghost" label={t('detail.report')} onPress={openReport} />
              <Button testID="detail-block" variant="ghost" label={t('detail.block')} onPress={() => setConfirmBlock(true)} />
            </>
          )}
        </View>
      ) : null}
      <AsyncView status={profile.status} error={profile.error} onRetry={() => void profile.reload()} testID="profile-detail" skeletonRows={3}>
        {data ? (
          <View style={{ gap: space[3] }}>
            {photos.length > 0 ? (
              <View>
                <ScrollView
                  testID="detail-gallery"
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onScrollEnd}
                  style={{ width: galleryWidth, borderRadius: radius.lg }}
                >
                  {photos.map((photo, index) => (
                    <Image
                      key={photo.id}
                      source={{ uri: photo.url ?? undefined }}
                      accessibilityLabel={t('photos.alt', { n: index + 1 })}
                      style={{ width: galleryWidth, aspectRatio: 3 / 4, backgroundColor: colors.skeleton }}
                    />
                  ))}
                </ScrollView>
                <Text variant="caption" tone="textMuted" align="center" style={{ marginTop: space[1] }} accessibilityLiveRegion="polite">
                  {t('detail.photoCount', { current: Math.min(photoIndex + 1, photos.length), total: photos.length })}
                </Text>
              </View>
            ) : (
              <View style={{ aspectRatio: 3 / 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.skeleton, borderRadius: radius.lg }}>
                <Text tone="textMuted">{t('discover.noPhoto')}</Text>
              </View>
            )}
            {data.verified ? (
              <Text variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                ✓ {t('detail.verified')}
              </Text>
            ) : null}
            <Text variant="body">{t('detail.lives', { place })}</Text>
            <Text variant="body" tone="textMuted">
              {t('detail.origin', { country: countryLabel(t, data.origin_country) })}
            </Text>
            <Text variant="body" tone="primary" style={{ fontWeight: '600' }}>
              {t(`intent.${data.intent}.label`)}
            </Text>
            <Text variant="h2" header>
              {t('detail.about')}
            </Text>
            <Text variant="body" tone={data.bio ? 'text' : 'textMuted'}>
              {data.bio ?? t('detail.noBio')}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: space[3] }}>
              <Button testID="detail-dislike" variant="secondary" label="✕" accessibilityLabel={t('discover.dislike')} disabled={busy} onPress={() => void swipe('dislike')} style={{ minWidth: 56 }} />
              <Button testID="detail-super" variant="secondary" label="★" accessibilityLabel={t('discover.superLike')} disabled={busy} onPress={() => void swipe('super_like')} style={{ minWidth: 56 }} />
              <Button testID="detail-like" variant="secondary" label="♥" accessibilityLabel={t('discover.like')} disabled={busy} onPress={() => void swipe('like')} style={{ minWidth: 56 }} />
            </View>
          </View>
        ) : null}
      </AsyncView>
    </ScreenContainer>
  );
}
