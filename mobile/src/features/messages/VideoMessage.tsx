import React from 'react';
import { Pressable, View } from 'react-native';
import { useI18n } from '../../i18n';
import { borderWidth, useTheme } from '../../theme';
import { Icon, Text } from '../../ui';
import { MediaFrame, MEDIA_SIZE } from './MediaFrame';
import { formatClock } from './messageTime';
import type { LocalMessage } from './thread';

export type VideoMessageProps = {
  message: LocalMessage;
  mine: boolean;
  /** Ouvre le lecteur plein écran de cette vidéo (l'adresse n'est demandée qu'à l'ouverture). */
  onOpen: (messageId: string) => void;
  deletable: boolean;
  onOpenActions: () => void;
};

/**
 * Contenu d'une vidéo, selon la décision de modération (`media_status`) : envoi en cours, en vérification, refusée (cadres sans
 * motif), approuvée (carte avec sa durée, qui ouvre le lecteur), statut absent (serveur plus ancien : « Vidéo reçue »).
 */
export function VideoMessage({ message, mine, onOpen, deletable, onOpenActions }: VideoMessageProps) {
  const { t } = useI18n();
  const { colors, radius, space } = useTheme();
  const status = message.media_status;

  if (message.local) {
    return <MediaFrame testID={`video-status-${message.id}`} icon="Video" label={t('conversation.video.sent')} />;
  }
  if (status === 'rejected') {
    return <MediaFrame testID={`video-status-${message.id}`} icon="Ban" label={t(mine ? 'conversation.video.rejected.mine' : 'conversation.video.rejected.theirs')} />;
  }
  if (status === 'processing') {
    return <MediaFrame testID={`video-status-${message.id}`} icon="Clock" label={t(mine ? 'conversation.video.processing.mine' : 'conversation.video.processing.theirs')} />;
  }
  if (status !== 'approved') {
    return <MediaFrame testID={`video-status-${message.id}`} icon="Video" label={t('conversation.media.video')} />;
  }

  const seconds = message.media_duration_seconds;
  return (
    <Pressable
      testID={`video-open-${message.id}`}
      accessibilityRole="button"
      accessibilityLabel={t('conversation.video.open')}
      accessibilityActions={deletable ? [{ name: 'delete', label: t('conversation.deleteMessage') }] : undefined}
      onAccessibilityAction={onOpenActions}
      onPress={() => onOpen(message.id)}
      onLongPress={deletable ? onOpenActions : undefined}
      style={{
        width: MEDIA_SIZE,
        height: Math.round((MEDIA_SIZE * 9) / 16),
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        borderRadius: radius.lg,
        borderWidth: borderWidth.hairline,
        borderColor: colors.borderStrong,
        backgroundColor: colors.skeleton,
      }}
    >
      <View style={{ width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <Icon name="Play" tone="onPrimary" />
      </View>
      {seconds !== null ? (
        <Text variant="bodySmall" tone="text" testID={`video-time-${message.id}`}>
          {formatClock(seconds * 1000)}
        </Text>
      ) : null}
    </Pressable>
  );
}
