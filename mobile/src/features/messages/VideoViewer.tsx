import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isApiError } from '../../api/errors';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, IconButton, Text } from '../../ui';
import type { LoadMessageImage } from './useMessageImages';

type ViewerState = { kind: 'loading' } | { kind: 'ready'; url: string } | { kind: 'error' };

/**
 * Vidéo en plein écran. L'adresse signée est demandée à l'ouverture ; une course avec la modération (409 ou 410) ferme le
 * lecteur et met la bulle à jour (`onUnavailable`) ; toute autre panne affiche « Réessayer ». Le lecteur natif n'existe que quand
 * l'adresse est connue, et il est libéré à la fermeture.
 */
export function VideoViewer({
  messageId,
  loadUrl,
  onClose,
  onUnavailable,
}: {
  messageId: string;
  loadUrl: LoadMessageImage;
  onClose: () => void;
  onUnavailable: (messageId: string, status: 'processing' | 'rejected') => void;
}) {
  const { t } = useI18n();
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ViewerState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadUrl(messageId, attempt > 0).then(
      (url) => {
        if (alive) setState({ kind: 'ready', url });
      },
      (error: unknown) => {
        if (!alive) return;
        if (isApiError(error) && error.code === 'media_pending') onUnavailable(messageId, 'processing');
        else if (isApiError(error) && error.code === 'media_rejected') onUnavailable(messageId, 'rejected');
        else setState({ kind: 'error' });
      },
    );
    return () => {
      alive = false;
    };
  }, [loadUrl, messageId, attempt, onUnavailable]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View testID="video-viewer" accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center' }}>
        {state.kind === 'ready' ? <Player url={state.url} /> : null}
        {state.kind === 'loading' ? (
          <View testID="video-viewer-loading" accessible accessibilityLabel={t('conversation.video.loading')} style={{ alignItems: 'center' }}>
            <ActivityIndicator color={colors.onPrimary} />
          </View>
        ) : null}
        {state.kind === 'error' ? (
          <View style={{ alignItems: 'center', gap: space[3], padding: space[6] }}>
            <Text variant="body" tone="onPrimary" style={{ textAlign: 'center' }}>
              {t('conversation.video.error')}
            </Text>
            <Button
              testID="video-viewer-reload"
              variant="secondary"
              label={t('conversation.video.reload')}
              onPress={() => {
                setState({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            />
          </View>
        ) : null}
        <View style={{ position: 'absolute', top: insets.top + space[2], right: space[2] }}>
          <IconButton testID="video-viewer-close" icon="X" variant="filled" accessibilityLabel={t('conversation.video.close')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/** Lecteur natif : créé avec l'adresse, lancé tout de suite, libéré par expo-video à la fermeture. */
function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.play();
  });
  return <VideoView player={player} nativeControls contentFit="contain" style={{ flex: 1, width: '100%' }} />;
}
