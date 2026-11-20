import React from 'react';
import { Pressable, View } from 'react-native';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, Icon, Text, type IconName } from '../../ui';
import { deliveryState, type DeliveryState, type LocalMessage } from './thread';
import { formatTime } from './messageTime';

type StateLook = { icon: IconName; tone: 'textMuted' | 'primary' | 'danger' };

/** Chaque état d'envoi a une icône ET un libellé : la couleur ne porte jamais seule le sens (WCAG 1.4.1). */
const STATE_LOOK: Record<DeliveryState, StateLook> = {
  sending: { icon: 'Clock', tone: 'textMuted' },
  failed: { icon: 'CircleAlert', tone: 'danger' },
  sent: { icon: 'Check', tone: 'textMuted' },
  delivered: { icon: 'CheckCheck', tone: 'textMuted' },
  read: { icon: 'CheckCheck', tone: 'primary' },
};

export type MessageBubbleProps = {
  message: LocalMessage;
  mine: boolean;
  content: string;
  /** Appui long ou action d'accessibilité « supprimer » disponible (message envoyé par moi, déjà reçu par le serveur). */
  deletable: boolean;
  /** Les boutons Supprimer / Annuler sont affichés sous la bulle. */
  actionOpen: boolean;
  onOpenActions: () => void;
  onCloseActions: () => void;
  onRetry: () => void;
  onDiscard: () => void;
  onDelete: () => void;
};

/** Bulle du fil : envoyée = primary / onPrimary, reçue = surface / text ; heure discrète et état d'envoi dessous. */
export function MessageBubble({
  message,
  mine,
  content,
  deletable,
  actionOpen,
  onOpenActions,
  onCloseActions,
  onRetry,
  onDiscard,
  onDelete,
}: MessageBubbleProps) {
  const { t, locale } = useI18n();
  const { colors, radius, space } = useTheme();
  const state = mine ? deliveryState(message) : null;
  const time = formatTime(message.created_at, locale);
  const look = state ? STATE_LOOK[state] : null;
  const stateLabel = state ? t(`conversation.state.${state}`) : '';
  const deleted = message.type === 'deleted';

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginVertical: space[1] }}>
      <Pressable
        testID={`message-${message.id}`}
        accessibilityLabel={state ? `${content}. ${stateLabel}` : content}
        accessibilityActions={deletable ? [{ name: 'delete', label: t('conversation.deleteMessage') }] : undefined}
        onAccessibilityAction={onOpenActions}
        onLongPress={deletable ? onOpenActions : undefined}
        style={{
          maxWidth: '80%',
          paddingHorizontal: space[4],
          paddingVertical: space[2] + 2,
          borderRadius: radius.lg,
          // Le coin proche de l'expéditeur est plus serré : la bulle « pointe » vers son auteur.
          borderBottomRightRadius: mine ? radius.sm : radius.lg,
          borderBottomLeftRadius: mine ? radius.lg : radius.sm,
          backgroundColor: mine ? colors.primary : colors.surface,
        }}
      >
        <Text variant="body" tone={mine ? 'onPrimary' : 'text'} style={deleted ? { fontStyle: 'italic' } : undefined}>
          {content}
        </Text>
      </Pressable>

      {time || state ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[1], paddingHorizontal: space[1] }}>
          {time ? (
            <Text variant="caption" tone="textMuted" testID={`time-${message.id}`} accessible={false}>
              {time}
            </Text>
          ) : null}
          {state && look ? (
            <View
              testID={`state-${message.id}`}
              accessible
              accessibilityLabel={stateLabel}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}
            >
              <Icon name={look.icon} size="sm" tone={look.tone} />
              <Text variant={state === 'failed' ? 'bodySmallStrong' : 'caption'} tone={look.tone === 'danger' ? 'danger' : 'textMuted'}>
                {stateLabel}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {message.local === 'failed' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Button testID={`retry-${message.client_id}`} variant="ghost" label={t('conversation.retry')} onPress={onRetry} />
          <Button variant="ghost" label={t('common.delete')} accessibilityLabel={t('conversation.discard')} onPress={onDiscard} />
        </View>
      ) : null}
      {actionOpen ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Button testID={`delete-${message.id}`} variant="danger" label={t('conversation.deleteMessage')} onPress={onDelete} />
          <Button variant="ghost" label={t('common.cancel')} onPress={onCloseActions} />
        </View>
      ) : null}
    </View>
  );
}
