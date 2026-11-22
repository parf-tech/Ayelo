import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n';
import { MAX_VOICE_SECONDS, type RecordingSession, type VoiceRecording } from '../../media/voiceRecorder';
import { useTheme } from '../../theme';
import { Icon, IconButton, Text } from '../../ui';
import { formatClock } from './messageTime';

/**
 * Barre d'enregistrement d'une note vocale, à la place de la zone de saisie : annuler, durée écoulée, envoyer.
 * À MAX_VOICE_SECONDS l'enregistrement s'arrête tout seul ; la note reste à envoyer ou à annuler (jamais envoyée sans geste).
 * Fermer l'écran pendant l'enregistrement l'abandonne et rend le micro.
 *  - `onSend` reçoit le fichier (null si l'enregistreur n'en a rien rendu) ; `onCancel` est appelé après l'abandon.
 */
export function RecordingBar({
  session,
  onSend,
  onCancel,
}: {
  session: RecordingSession;
  onSend: (recording: VoiceRecording | null) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const { colors, radius, space } = useTheme();
  const startedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [stopped, setStopped] = useState<{ recording: VoiceRecording | null } | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    const begin = Date.now();
    startedAt.current = begin;
    const timer = setInterval(() => {
      if (finished.current) return;
      const ms = Date.now() - begin;
      if (ms >= MAX_VOICE_SECONDS * 1000) {
        finished.current = true;
        setElapsed(MAX_VOICE_SECONDS * 1000);
        void session.stop().then((recording) => setStopped({ recording }));
        return;
      }
      setElapsed(ms);
    }, 250);
    return () => clearInterval(timer);
  }, [session]);

  // Fermeture de l'écran sans geste : l'enregistrement est abandonné.
  useEffect(
    () => () => {
      if (!finished.current) {
        finished.current = true;
        void session.cancel();
      }
    },
    [session],
  );

  const send = async () => {
    if (stopped) {
      onSend(stopped.recording);
      return;
    }
    finished.current = true;
    onSend(await session.stop());
  };

  const cancel = async () => {
    finished.current = true;
    await session.cancel();
    onCancel();
  };

  return (
    <View
      testID="recording-bar"
      accessible
      accessibilityLabel={`${t('conversation.record.active')}, ${formatClock(elapsed)}`}
      accessibilityLiveRegion="polite"
      style={{ gap: space[2] }}
    >
      {stopped ? (
        <Text variant="bodySmall" tone="textMuted" testID="recording-limit">
          {t('conversation.record.limit')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <IconButton testID="recording-cancel" icon="Trash2" size="lg" accessibilityLabel={t('conversation.record.cancel')} onPress={() => void cancel()} />
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            minHeight: 48,
            paddingHorizontal: space[4],
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
          }}
        >
          <Icon name="Mic" tone="danger" />
          <Text variant="body" testID="recording-time">
            {formatClock(elapsed)}
          </Text>
        </View>
        <IconButton testID="recording-send" icon="Send" size="lg" variant="filled" accessibilityLabel={t('conversation.record.send')} onPress={() => void send()} />
      </View>
    </View>
  );
}
