import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useI18n } from '../../i18n';
import { borderWidth, MIN_TARGET, useTheme } from '../../theme';
import { Button, IconButton, Text } from '../../ui';
import { MediaFrame } from './MediaFrame';
import { formatClock } from './messageTime';
import type { LocalMessage } from './thread';
import type { LoadMessageImage } from './useMessageImages';
import { useVoicePlayback } from './voicePlayback';

/** Largeur d'un lecteur de note vocale dans la conversation. */
const VOICE_WIDTH = 240;

export type VoiceMessageProps = {
  message: LocalMessage;
  mine: boolean;
  loadUrl: LoadMessageImage;
  deletable: boolean;
  onOpenActions: () => void;
};

/**
 * Contenu d'une note vocale, selon la décision de modération (`media_status`) : envoi en cours (lecteur grisé, durée enregistrée),
 * en vérification, refusée (cadres sans motif), approuvée (lecteur), statut absent (serveur plus ancien : « Message vocal reçu »).
 */
export function VoiceMessage(props: VoiceMessageProps) {
  const { message, mine } = props;
  const { t } = useI18n();
  const status = message.media_status;

  if (message.local) return <VoiceRow message={message} disabled />;
  if (status === 'approved') return <VoicePlayer {...props} />;
  if (status === 'rejected') {
    return <MediaFrame testID={`voice-status-${message.id}`} icon="Ban" label={t(mine ? 'conversation.voice.rejected.mine' : 'conversation.voice.rejected.theirs')} />;
  }
  if (status === 'processing') {
    return <MediaFrame testID={`voice-status-${message.id}`} icon="Clock" label={t(mine ? 'conversation.voice.processing.mine' : 'conversation.voice.processing.theirs')} />;
  }
  return <MediaFrame testID={`voice-status-${message.id}`} icon="Mic" label={t('conversation.media.voice')} />;
}

/** Ligne du lecteur : bouton, barre de progression, temps. `playing` et les temps viennent du lecteur, ou de la durée annoncée. */
function VoiceRow({
  message,
  disabled = false,
  playing = false,
  loading = false,
  progress = 0,
  timeLabel,
  onToggle,
  onOpenActions,
  deletable = false,
}: {
  message: LocalMessage;
  disabled?: boolean;
  playing?: boolean;
  loading?: boolean;
  progress?: number;
  timeLabel?: string;
  onToggle?: () => void;
  onOpenActions?: () => void;
  deletable?: boolean;
}) {
  const { t } = useI18n();
  const { colors, radius, space } = useTheme();
  const seconds = message.media_duration_seconds;
  const time = timeLabel ?? (seconds !== null ? formatClock(seconds * 1000) : '');

  return (
    <Pressable
      accessible={false}
      onLongPress={deletable ? onOpenActions : undefined}
      style={{
        width: VOICE_WIDTH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingVertical: space[1],
        paddingRight: space[3],
        borderRadius: radius.pill,
        borderWidth: borderWidth.hairline,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
      }}
    >
      {loading ? (
        <View style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <IconButton
          testID={playing ? `voice-pause-${message.id}` : `voice-play-${message.id}`}
          icon={playing ? 'Pause' : 'Play'}
          variant="filled"
          accessibilityLabel={playing ? t('conversation.voice.pause') : t('conversation.voice.play')}
          onPress={onToggle ?? (() => undefined)}
          disabled={disabled}
        />
      )}
      <View style={{ flex: 1, height: space[1], borderRadius: radius.pill, backgroundColor: colors.skeleton, overflow: 'hidden' }} accessible={false}>
        <View testID={`voice-progress-${message.id}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`, height: '100%', backgroundColor: colors.primary }} />
      </View>
      <Text variant="bodySmall" tone="textMuted" testID={`voice-time-${message.id}`}>
        {time}
      </Text>
    </Pressable>
  );
}

/** Note approuvée : l'adresse n'est demandée qu'au premier « Écouter ». */
function VoicePlayer({ message, mine, loadUrl, deletable, onOpenActions }: VoiceMessageProps) {
  const { t } = useI18n();
  const { state, play, pause, reload } = useVoicePlayback(message.id, loadUrl);

  if (state.phase === 'pending') {
    return <MediaFrame testID={`voice-status-${message.id}`} icon="Clock" label={t(mine ? 'conversation.voice.processing.mine' : 'conversation.voice.processing.theirs')} />;
  }
  if (state.phase === 'rejected') {
    return <MediaFrame testID={`voice-status-${message.id}`} icon="Ban" label={t(mine ? 'conversation.voice.rejected.mine' : 'conversation.voice.rejected.theirs')} />;
  }
  if (state.phase === 'error') {
    return (
      <MediaFrame testID={`voice-status-${message.id}`} icon="CircleAlert" label={t('conversation.voice.error')}>
        <Button testID={`voice-reload-${message.id}`} variant="ghost" label={t('conversation.voice.reload')} onPress={reload} />
      </MediaFrame>
    );
  }

  const announced = message.media_duration_seconds ?? 0;
  const total = state.duration > 0 ? state.duration : announced;
  const started = state.phase === 'ready' && (state.playing || state.position > 0);
  const timeLabel = started ? `${formatClock(state.position * 1000)} / ${formatClock(total * 1000)}` : formatClock(total * 1000);

  return (
    <VoiceRow
      message={message}
      loading={state.phase === 'loading'}
      playing={state.playing}
      progress={total > 0 ? state.position / total : 0}
      timeLabel={timeLabel}
      onToggle={state.playing ? pause : play}
      onOpenActions={onOpenActions}
      deletable={deletable}
    />
  );
}
