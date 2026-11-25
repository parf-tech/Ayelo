import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { isApiError } from '../../api/errors';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { Button, Icon, Text } from '../../ui';
import { MediaFrame, MEDIA_SIZE } from './MediaFrame';
import type { LocalMessage } from './thread';
import type { LoadMessageImage } from './useMessageImages';

/** Côté de la vignette dans la conversation (la photo entière s'ouvre en plein écran). */
const IMAGE_SIZE = MEDIA_SIZE;

export type ImageMessageProps = {
  message: LocalMessage;
  mine: boolean;
  loadUrl: LoadMessageImage;
  /** Ouvre la photo en plein écran. */
  onOpen: (url: string) => void;
  /** Suppression disponible (message envoyé par moi, déjà reçu par le serveur) : appui long et action d'accessibilité. */
  deletable: boolean;
  onOpenActions: () => void;
};

/**
 * Contenu d'un message image, selon la décision de modération (`media_status`) :
 *  - envoi en cours ou échoué : aperçu de ma photo (fichier local) ;
 *  - en vérification : mon aperçu s'il existe encore, sinon un cadre « en cours de vérification » (jamais l'image du correspondant) ;
 *  - refusée : un cadre « refusée par la modération », sans motif ;
 *  - approuvée : la photo, par une adresse signée demandée pour ce message seul ;
 *  - statut absent (serveur plus ancien) : « Photo reçue », sans appel.
 * Chaque état a une icône ET un texte : la couleur ne porte jamais seule le sens.
 */
export function ImageMessage(props: ImageMessageProps) {
  const { message, mine } = props;
  const { t } = useI18n();
  const status = message.media_status;
  const local = message.local_image_uri;

  if (local && (message.local || status === null)) return <LocalPreview message={message} caption={null} />;
  if (status === 'approved') return <RemoteImage {...props} />;
  if (status === 'rejected') {
    return <MediaFrame testID={`image-status-${message.id}`} icon="Ban" label={t(mine ? 'conversation.image.rejected.mine' : 'conversation.image.rejected.theirs')} />;
  }
  if (status === 'processing') {
    const label = t(mine ? 'conversation.image.processing.mine' : 'conversation.image.processing.theirs');
    return mine && local ? <LocalPreview message={message} caption={label} /> : <MediaFrame testID={`image-status-${message.id}`} icon="Clock" label={label} />;
  }
  return <MediaFrame testID={`image-status-${message.id}`} icon="Camera" label={t('conversation.media.image')} />;
}

/** Ma photo, depuis le fichier local, tant qu'elle n'a pas de version approuvée. */
function LocalPreview({ message, caption }: { message: LocalMessage; caption: string | null }) {
  const { t } = useI18n();
  const { colors, radius, space } = useTheme();
  return (
    <View style={{ gap: space[1] }}>
      <Image
        testID={`image-local-${message.id}`}
        source={{ uri: message.local_image_uri }}
        accessibilityLabel={t('conversation.image.sent')}
        accessibilityIgnoresInvertColors
        style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: radius.lg, backgroundColor: colors.skeleton }}
      />
      {caption ? (
        <View testID={`image-status-${message.id}`} accessible accessibilityLabel={caption} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], maxWidth: IMAGE_SIZE }}>
          <Icon name="Clock" size="sm" tone="textMuted" />
          <Text variant="bodySmall" tone="textMuted" style={{ flexShrink: 1 }}>
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

type UrlState = { kind: 'loading' } | { kind: 'ready'; url: string } | { kind: 'pending' } | { kind: 'rejected' } | { kind: 'error' };

/**
 * Photo approuvée : l'adresse est demandée au montage (la mémoire de `useMessageImages` évite les doublons). Une photo qui ne se
 * charge plus (adresse expirée) déclenche UNE nouvelle demande ; un second échec affiche « Réessayer ». Une course avec la
 * modération (409 ou 410) se lit comme « en vérification » ou « refusée ».
 */
function RemoteImage({ message, mine, loadUrl, onOpen, deletable, onOpenActions }: ImageMessageProps) {
  const { t } = useI18n();
  const { colors, radius, space } = useTheme();
  const [state, setState] = useState<UrlState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [failures, setFailures] = useState(0);

  useEffect(() => {
    let alive = true;
    loadUrl(message.id, attempt > 0).then(
      (url) => {
        if (alive) setState({ kind: 'ready', url });
      },
      (error: unknown) => {
        if (!alive) return;
        if (isApiError(error) && error.code === 'media_pending') setState({ kind: 'pending' });
        else if (isApiError(error) && error.code === 'media_rejected') setState({ kind: 'rejected' });
        else setState({ kind: 'error' });
      },
    );
    return () => {
      alive = false;
    };
  }, [loadUrl, message.id, attempt]);

  if (state.kind === 'pending') {
    return <MediaFrame testID={`image-status-${message.id}`} icon="Clock" label={t(mine ? 'conversation.image.processing.mine' : 'conversation.image.processing.theirs')} />;
  }
  if (state.kind === 'rejected') {
    return <MediaFrame testID={`image-status-${message.id}`} icon="Ban" label={t(mine ? 'conversation.image.rejected.mine' : 'conversation.image.rejected.theirs')} />;
  }
  if (state.kind === 'error') {
    return (
      <MediaFrame testID={`image-status-${message.id}`} icon="CircleAlert" label={t('conversation.image.error')}>
        <Button
          testID={`image-reload-${message.id}`}
          variant="ghost"
          label={t('conversation.image.reload')}
          onPress={() => {
            setFailures(0);
            setState({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
        />
      </MediaFrame>
    );
  }
  if (state.kind === 'loading') {
    return (
      <View
        testID={`image-loading-${message.id}`}
        accessible
        accessibilityLabel={t('conversation.image.loading')}
        style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.skeleton }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Pressable
      testID={`image-open-${message.id}`}
      accessibilityRole="imagebutton"
      accessibilityLabel={t('conversation.image.view')}
      accessibilityActions={deletable ? [{ name: 'delete', label: t('conversation.deleteMessage') }] : undefined}
      onAccessibilityAction={onOpenActions}
      onPress={() => onOpen(state.url)}
      onLongPress={deletable ? onOpenActions : undefined}
      style={{ gap: space[1] }}
    >
      <Image
        testID={`image-${message.id}`}
        source={{ uri: state.url }}
        accessibilityLabel={t(mine ? 'conversation.image.sent' : 'conversation.media.image')}
        accessibilityIgnoresInvertColors
        onLoad={() => setFailures(0)}
        onError={() => {
          if (failures === 0) {
            // Adresse expirée ou périmée : une seule nouvelle demande, puis « Réessayer ».
            setFailures(1);
            setState({ kind: 'loading' });
            setAttempt((n) => n + 1);
          } else {
            setState({ kind: 'error' });
          }
        }}
        style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: radius.lg, backgroundColor: colors.skeleton }}
      />
    </Pressable>
  );
}
