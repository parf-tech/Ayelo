import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, useWindowDimensions, View } from 'react-native';
import type { ProfileMedia } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { pickImage, type PickedImage } from '../../media/picker';
import { uploadMedia } from '../../media/upload';
import { borderWidth, stateOpacity, useTheme } from '../../theme';
import { AsyncView, Banner, Button, Icon, IconButton, Text } from '../../ui';

export const MAX_PHOTOS = 6;

type UploadEntry = { key: number; image: PickedImage; status: 'uploading' | 'failed'; message?: string };

export type PhotosState = { count: number; hasPhoto: boolean; ready: boolean };

type Props = {
  /** Informe l'écran parent (bouton « Continuer » de l'onboarding). */
  onChange?: (state: PhotosState) => void;
};

/** S06 / S60 : grille de photos, ajout (envoi présigné), état « en revue », réordonner, supprimer. */
export function PhotosManager({ onChange }: Props) {
  const { t } = useI18n();
  const { space, colors, radius } = useTheme();
  const { width } = useWindowDimensions();
  const { api } = useAuth();
  const me = useResource(() => api.auth.me(), [api]);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [banner, setBanner] = useState<{ message: string; settings?: boolean } | undefined>();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState(1);

  const photos = useMemo<ProfileMedia[]>(
    () =>
      (me.data?.profile?.media ?? [])
        .filter((m) => m.kind === 'profile_photo')
        .sort((a, b) => a.position - b.position),
    [me.data],
  );

  const total = photos.length + uploads.filter((u) => u.status === 'uploading').length;

  React.useEffect(() => {
    onChange?.({ count: photos.length, hasPhoto: photos.length > 0, ready: me.status === 'ready' });
  }, [photos.length, me.status, onChange]);

  const showError = useCallback(
    (error: unknown) => {
      const { key, params } = apiErrorMessage(error);
      setBanner({ message: t(key, params) });
    },
    [t],
  );

  const runUpload = useCallback(
    async (key: number, image: PickedImage) => {
      setUploads((list) => list.map((u) => (u.key === key ? { ...u, status: 'uploading', message: undefined } : u)));
      try {
        await uploadMedia(api, { kind: 'profile_photo', image });
        setUploads((list) => list.filter((u) => u.key !== key));
        await me.reload({ silent: true });
      } catch (error) {
        const { key: msgKey, params } = apiErrorMessage(error);
        setUploads((list) => list.map((u) => (u.key === key ? { ...u, status: 'failed', message: t(msgKey, params) } : u)));
      }
    },
    [api, me, t],
  );

  const add = async () => {
    setBanner(undefined);
    if (total >= MAX_PHOTOS) return;
    const result = await pickImage('library');
    if (result.kind === 'denied') {
      // L'autorisation ne se redonne que dans les réglages du téléphone : le bandeau y mène.
      setBanner({ message: t('photos.permissionDenied'), settings: true });
      return;
    }
    if (result.kind !== 'picked') return;
    const key = nextKey;
    setNextKey(key + 1);
    setUploads((list) => [...list, { key, image: result.image, status: 'uploading' }]);
    await runUpload(key, result.image);
  };

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const ids = photos.map((p) => p.id);
    const moved = ids[index];
    const other = ids[target];
    if (!moved || !other) return;
    ids[index] = other;
    ids[target] = moved;
    setBanner(undefined);
    // Affichage immédiat, puis confirmation par le serveur (retour à l'ordre serveur en cas d'échec).
    me.setData((previous) =>
      previous && previous.profile
        ? {
            ...previous,
            profile: {
              ...previous.profile,
              media: previous.profile.media.map((m) => {
                const position = ids.indexOf(m.id);
                return position >= 0 && m.kind === 'profile_photo' ? { ...m, position } : m;
              }),
            },
          }
        : previous,
    );
    try {
      await api.profile.orderMedia(ids);
    } catch (error) {
      showError(error);
      await me.reload({ silent: true });
    }
  };

  const remove = async (id: string) => {
    setConfirmId(null);
    setBanner(undefined);
    try {
      await api.profile.deleteMedia(id);
      await me.reload({ silent: true });
    } catch (error) {
      showError(error);
    }
  };

  // Trois boutons de 44 pt ne tiennent pas dans une demi-largeur à 320 pt : une tuile par ligne en dessous de 360 pt.
  const tileWidth = width < 360 ? '100%' : '48%';

  return (
    <View testID="photos-manager">
      <Text variant="caption" tone="textMuted" testID="photos-count">
        {t('photos.count', { count: total, max: MAX_PHOTOS })}
      </Text>
      <Text variant="caption" tone="textMuted" style={{ marginBottom: space[3] }}>
        {t('photos.reviewNote')}
      </Text>
      {banner ? (
        <Banner
          testID="photos-banner"
          variant="error"
          message={banner.message}
          actionLabel={banner.settings ? t('photos.permissionDenied.action') : undefined}
          onAction={banner.settings ? () => void Linking.openSettings() : undefined}
          onDismiss={() => setBanner(undefined)}
          dismissLabel={t('ui.banner.dismiss')}
          style={{ marginBottom: space[3] }}
        />
      ) : null}
      <AsyncView
        status={me.status}
        error={me.error}
        onRetry={() => void me.reload()}
        empty={photos.length === 0 && uploads.length === 0}
        emptyTitle={t('photos.empty')}
        skeletonRows={2}
        testID="photos"
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space[3] }}>
          {photos.map((photo, index) => (
            <View
              key={photo.id}
              testID={`photo-${photo.id}`}
              style={{ width: tileWidth, gap: space[1] }}
            >
              <View style={{ borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.skeleton }}>
                {photo.url ? (
                  <Image
                    source={{ uri: photo.url }}
                    accessible
                    accessibilityRole="image"
                    accessibilityIgnoresInvertColors
                    accessibilityLabel={t('photos.alt', { n: index + 1 })}
                    style={{ width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.skeleton }}
                  />
                ) : (
                  <View style={{ width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.skeleton }} />
                )}
              </View>
              {photo.status ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], paddingHorizontal: space[1] }}>
                  <Icon
                    name={photo.status === 'approved' ? 'Check' : 'Clock'}
                    size="sm"
                    tone={photo.status === 'approved' ? 'success' : 'warning'}
                  />
                  <Text
                    variant="captionMedium"
                    tone={photo.status === 'approved' ? 'success' : 'warning'}
                    style={{ flexShrink: 1 }}
                    testID={`photo-status-${photo.id}`}
                  >
                    {t(`photos.status.${photo.status}`)}
                  </Text>
                </View>
              ) : null}
              {confirmId === photo.id ? (
                <View style={{ padding: space[2], gap: space[1] }}>
                  <Text variant="caption">{t('photos.deleteConfirm')}</Text>
                  <Button testID={`photo-confirm-${photo.id}`} variant="danger" label={t('common.delete')} onPress={() => void remove(photo.id)} />
                  <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirmId(null)} />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: space[1], paddingBottom: space[1] }}>
                  <IconButton
                    testID={`photo-up-${index}`}
                    icon="ChevronLeft"
                    accessibilityLabel={t('photos.moveUp', { n: index + 1 })}
                    disabled={index === 0}
                    onPress={() => void move(index, -1)}
                  />
                  <IconButton
                    testID={`photo-down-${index}`}
                    icon="ChevronRight"
                    accessibilityLabel={t('photos.moveDown', { n: index + 1 })}
                    disabled={index === photos.length - 1}
                    onPress={() => void move(index, 1)}
                  />
                  <IconButton
                    testID={`photo-delete-${index}`}
                    icon="Trash2"
                    variant="danger"
                    accessibilityLabel={t('photos.delete', { n: index + 1 })}
                    onPress={() => setConfirmId(photo.id)}
                  />
                </View>
              )}
            </View>
          ))}
          {uploads.map((upload) => (
            <View
              key={`up-${upload.key}`}
              testID={`upload-${upload.key}`}
              style={{ width: tileWidth, borderRadius: radius.md, borderWidth: borderWidth.hairline, borderColor: upload.status === 'failed' ? colors.danger : colors.border, overflow: 'hidden', backgroundColor: colors.surface }}
            >
              <View>
                <Image
                  source={{ uri: upload.image.uri }}
                  accessibilityIgnoresInvertColors
                  accessible={false}
                  style={{ width: '100%', aspectRatio: 3 / 4, opacity: stateOpacity.skeleton }}
                />
                {upload.status === 'uploading' ? (
                  <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : null}
              </View>
              <Text variant="captionMedium" tone={upload.status === 'failed' ? 'danger' : 'textMuted'} style={{ padding: space[2] }}>
                {upload.status === 'failed' ? (upload.message ?? t('photos.failed')) : t('photos.uploading')}
              </Text>
              {upload.status === 'failed' ? (
                <View>
                  <Button testID={`upload-retry-${upload.key}`} variant="secondary" label={t('photos.retry')} onPress={() => void runUpload(upload.key, upload.image)} />
                  <Button variant="ghost" label={t('photos.dismiss')} onPress={() => setUploads((list) => list.filter((u) => u.key !== upload.key))} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </AsyncView>
      <View style={{ marginTop: space[4] }}>
        <Button
          testID="photos-add"
          variant="secondary"
          label={total >= MAX_PHOTOS ? t('photos.full', { max: MAX_PHOTOS }) : t('photos.add')}
          disabled={total >= MAX_PHOTOS || me.status !== 'ready'}
          onPress={() => void add()}
        />
      </View>
    </View>
  );
}
