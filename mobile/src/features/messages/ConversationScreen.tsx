import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { CALLS_ENABLED, CHAT_AV_ENABLED } from '../../config/features';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { pickImage, pickVideo } from '../../media/picker';
import { startVoiceRecording, type RecordingSession, type VoiceRecording } from '../../media/voiceRecorder';
import { useRealtime } from '../../realtime';
import { borderWidth, fontFamilyFor, focus, MIN_TARGET, useFontsReady, useTheme } from '../../theme';
import { AsyncView, Avatar, Banner, Button, Icon, IconButton, ScreenContainer, Text, useToast } from '../../ui';
import { useCalls } from '../calls/CallProvider';
import { MenuItem, MenuSheet } from '../common/MenuItem';
import { useGoBack } from '../common/useGoBack';
import { primaryPhotoUrl } from '../discover/swipe';
import { useConversations } from './ConversationsProvider';
import { DateSeparator } from './DateSeparator';
import { ImageMessage } from './ImageMessage';
import { ImageViewer } from './ImageViewer';
import { MessageBubble } from './MessageBubble';
import { RecordingBar } from './RecordingBar';
import { VideoMessage } from './VideoMessage';
import { VideoViewer } from './VideoViewer';
import { VoiceMessage } from './VoiceMessage';
import { dayKey } from './messageTime';
import type { LocalMessage } from './thread';
import { useMessageImages } from './useMessageImages';
import { useThread, type ImageSendResult } from './useThread';

/** Hauteur maximale de la zone de saisie (au-delà, elle défile). */
const COMPOSER_MAX_HEIGHT = 120;

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

/** S14 : conversation (bulles, envoi optimiste, renvoi, accusés, pagination, « écrit… », avis de sécurité). */
export function ConversationScreen() {
  const router = useRouter();
  const goBack = useGoBack('/messages');
  const { t } = useI18n();
  const { colors, radius, space, type } = useTheme();
  const fontsReady = useFontsReady();
  const toast = useToast();
  const { api } = useAuth();
  const calls = useCalls();
  const { status: realtimeStatus } = useRealtime();
  const params = useLocalSearchParams<{ id: string; name?: string; photo?: string; peerId?: string }>();
  const conversationId = param(params.id);
  const conversations = useConversations();
  const known = conversations.find(conversationId);
  const peerName = known?.profile?.display_name ?? param(params.name);
  const peerId = known?.profile?.user_id ?? param(params.peerId);
  // Photo : paramètre de navigation, sinon celle du profil dans la liste des conversations (ouverture par notification ou lien).
  const peerPhoto = param(params.photo) || (known?.profile ? primaryPhotoUrl(known.profile) : null) || null;
  const isMatch = known?.unlocked_by === 'match';
  const canCall = CALLS_ENABLED && isMatch;

  const thread = useThread(conversationId);
  const loadImage = useMessageImages(conversationId);
  const [viewing, setViewing] = useState<string | null>(null);
  const [viewingVideo, setViewingVideo] = useState<string | null>(null);
  const [recording, setRecording] = useState<RecordingSession | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<'block' | 'unmatch' | 'hide' | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>();
  // Identifiant du match à rompre, fourni par GET /conversations (nul hors match).
  const matchId = known?.match_id ?? null;

  const submit = () => {
    const text = draft;
    if (!text.trim()) return;
    setDraft('');
    void thread.send(text);
  };

  /** Affiche l'erreur d'un envoi d'image (le message local est déjà en « échec », avec « Renvoyer »). */
  const showImageResult = async (result: Promise<ImageSendResult | undefined>) => {
    const outcome = await result;
    if (outcome && !outcome.ok) {
      const { key, params: p } = apiErrorMessage(outcome.error);
      setNotice(t(key, p));
    }
  };

  const attachPhoto = async () => {
    setAttachOpen(false);
    setNotice(undefined);
    try {
      const picked = await pickImage('library');
      if (picked.kind !== 'picked') return;
      await showImageResult(thread.sendImage(picked.image));
    } catch (error) {
      const { key, params: p } = apiErrorMessage(error);
      setNotice(t(key, p));
    }
  };

  const attachVideo = async () => {
    setAttachOpen(false);
    setNotice(undefined);
    try {
      const picked = await pickVideo();
      if (picked.kind !== 'picked') return;
      await showImageResult(thread.sendMedia({ type: 'video', file: picked.video, durationSeconds: picked.video.durationSeconds ?? undefined }));
    } catch (error) {
      const { key, params: p } = apiErrorMessage(error);
      setNotice(t(key, p));
    }
  };

  // Avec les notes vocales et les vidéos, « Joindre » propose le choix ; sans elles, il ouvre directement la galerie de photos.
  const onAttach = () => {
    if (CHAT_AV_ENABLED) setAttachOpen((open) => !open);
    else void attachPhoto();
  };

  const record = async () => {
    setNotice(undefined);
    setAttachOpen(false);
    const started = await startVoiceRecording();
    if (started.kind === 'started') setRecording(started.session);
    else setNotice(t(started.kind === 'denied' ? 'conversation.record.denied' : 'conversation.record.failed'));
  };

  const sendRecording = async (voice: VoiceRecording | null) => {
    setRecording(null);
    if (!voice) {
      setNotice(t('conversation.record.empty'));
      return;
    }
    await showImageResult(thread.sendMedia({ type: 'voice', file: { uri: voice.uri, mimeType: 'audio/mp4', fileSize: null }, durationSeconds: voice.durationSeconds }));
  };

  const report = () => {
    setMenuOpen(false);
    router.push({
      pathname: '/report',
      params: { reportedId: peerId, name: peerName, contextType: 'conversation', contextId: conversationId },
    } as never);
  };

  const leave = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      await conversations.refresh({ silent: true });
      toast.show({ message, variant: 'success' });
      router.replace('/messages' as never);
    } catch (error) {
      const { key, params: p } = apiErrorMessage(error);
      setNotice(t(key, p));
      setConfirm(null);
    }
  };

  const unmatch = () =>
    leave(async () => {
      // Le menu n'affiche « Rompre le match » que si `match_id` est connu ; cette garde ne sert qu'au typage.
      if (!matchId) return;
      await api.discovery.deleteMatch(matchId);
    }, t('conversation.unmatchDone'));

  const renderMessage = ({ item, index }: { item: LocalMessage; index: number }) => {
    const mine = item.sender_id === thread.myId;
    const missed = item.type === 'call_missed';
    let content: string;
    switch (item.type) {
      case 'text':
        content = item.body ?? '';
        break;
      case 'call_missed':
        content = item.body === 'video' ? t('conversation.missedCall.video') : t('conversation.missedCall.audio');
        break;
      case 'deleted':
        content = t('conversation.deleted');
        break;
      case 'image':
        content = t('conversation.media.image');
        break;
      case 'video':
        content = t('conversation.media.video');
        break;
      case 'voice':
        content = t('conversation.media.voice');
        break;
      default:
        content = t('messages.preview.other');
    }

    // Liste inversée : le message suivant dans les données est le plus ancien. Le séparateur de jour s'affiche au-dessus du
    // plus ancien message de chaque jour (donc quand le message plus ancien est d'un autre jour, ou qu'il n'y en a pas).
    const older = thread.messages[index + 1];
    const startsDay = dayKey(item.created_at) !== '' && (!older || dayKey(older.created_at) !== dayKey(item.created_at));

    let row: React.ReactNode;
    if (missed) {
      row = (
        <View testID={`message-${item.id}`} accessible accessibilityLabel={content} style={{ alignItems: 'center', marginVertical: space[2], flexDirection: 'row', justifyContent: 'center', gap: space[2] }}>
          <Icon name={item.body === 'video' ? 'VideoOff' : 'PhoneOff'} size="sm" tone="textMuted" />
          <Text variant="caption" tone="textMuted">
            {content}
          </Text>
        </View>
      );
    } else {
      const deletable = mine && !item.local && item.type !== 'deleted';
      row = (
        <MessageBubble
          message={item}
          mine={mine}
          content={content}
          media={
            item.type === 'image' ? (
              <ImageMessage
                message={item}
                mine={mine}
                loadUrl={loadImage}
                onOpen={setViewing}
                deletable={deletable}
                onOpenActions={() => setActionFor(item.id)}
              />
            ) : item.type === 'voice' ? (
              <VoiceMessage message={item} mine={mine} loadUrl={loadImage} deletable={deletable} onOpenActions={() => setActionFor(item.id)} />
            ) : item.type === 'video' ? (
              <VideoMessage message={item} mine={mine} onOpen={setViewingVideo} deletable={deletable} onOpenActions={() => setActionFor(item.id)} />
            ) : undefined
          }
          deletable={deletable}
          actionOpen={actionFor === item.id}
          onOpenActions={() => setActionFor(item.id)}
          onCloseActions={() => setActionFor(null)}
          onRetry={() => {
            setNotice(undefined);
            void showImageResult(thread.retry(item.client_id));
          }}
          onDiscard={() => thread.discard(item.client_id)}
          onDelete={() => {
            setActionFor(null);
            void thread.removeMine(item).catch((error: unknown) => {
              const { key, params: p } = apiErrorMessage(error);
              setNotice(t(key, p));
            });
          }}
        />
      );
    }

    return (
      <View>
        {startsDay ? <DateSeparator iso={item.created_at} testID={`day-${item.id}`} /> : null}
        {row}
      </View>
    );
  };

  return (
    <ScreenContainer
      testID="screen-conversation"
      footer={
        thread.closed ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              paddingHorizontal: space[4],
              paddingVertical: space[3],
            }}
          >
            <Icon name="Lock" tone="textMuted" />
            <Text variant="bodySmall" tone="textMuted" testID="conversation-closed" style={{ flex: 1 }}>
              {t('conversation.closed')}
            </Text>
          </View>
        ) : recording ? (
          <RecordingBar session={recording} onSend={(voice) => void sendRecording(voice)} onCancel={() => setRecording(null)} />
        ) : (
          <View style={{ gap: space[2] }}>
          {attachOpen ? (
            <MenuSheet testID="conversation-attach-sheet">
              <MenuItem testID="attach-photo" icon="ImagePlus" label={t('conversation.attach.photo')} onPress={() => void attachPhoto()} />
              <MenuItem testID="attach-video" icon="Video" label={t('conversation.attach.video')} onPress={() => void attachVideo()} />
            </MenuSheet>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }}>
            <IconButton
              testID="conversation-attach"
              icon="ImagePlus"
              size="lg"
              expanded={CHAT_AV_ENABLED ? attachOpen : undefined}
              accessibilityLabel={t('conversation.attach')}
              onPress={onAttach}
            />
            <TextInput
              testID="conversation-input"
              accessibilityLabel={t('conversation.input')}
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (text) thread.notifyTyping();
              }}
              placeholder={t('conversation.input')}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              selectionColor={colors.primary}
              style={{
                flex: 1,
                minHeight: MIN_TARGET + space[1],
                maxHeight: COMPOSER_MAX_HEIGHT,
                paddingHorizontal: space[4],
                paddingVertical: space[3],
                color: colors.text,
                fontSize: type.body.size,
                lineHeight: type.body.line,
                ...(fontsReady ? { fontFamily: fontFamilyFor(type.body.weight) } : null),
                // Focus visible : contour plus épais et couleur de focus (comme TextField).
                borderWidth: composerFocused ? borderWidth.strong : borderWidth.hairline,
                borderColor: composerFocused ? colors[focus.color] : colors.borderStrong,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
              }}
            />
            {CHAT_AV_ENABLED && draft.trim() === '' ? (
              <IconButton
                testID="conversation-record"
                icon="Mic"
                size="lg"
                variant="filled"
                accessibilityLabel={t('conversation.record')}
                onPress={() => void record()}
              />
            ) : (
              <IconButton
                testID="conversation-send"
                icon="Send"
                size="lg"
                variant="filled"
                accessibilityLabel={t('conversation.send')}
                onPress={submit}
                disabled={draft.trim() === ''}
              />
            )}
          </View>
          </View>
        )
      }
    >
      {/* En-tête sur deux lignes : actions (retour, appels, menu) puis identité. Le nom peut passer sur deux lignes
          sans jamais repousser le menu hors de l'écran (320 pt, texte à 200 %). */}
      <View testID="conversation-header" style={{ marginBottom: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[1] }}>
          <IconButton
            testID="back-button"
            icon="ChevronLeft"
            accessibilityLabel={t('common.back')}
            onPress={goBack}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
            {canCall ? (
              <>
                <IconButton
                  testID="call-audio"
                  icon="Phone"
                  accessibilityLabel={t('conversation.audioCall')}
                  onPress={() => void calls.startCall({ conversationId, kind: 'audio', peerId: peerId || null, peerName, peerPhoto })}
                />
                <IconButton
                  testID="call-video"
                  icon="Video"
                  accessibilityLabel={t('conversation.videoCall')}
                  onPress={() => void calls.startCall({ conversationId, kind: 'video', peerId: peerId || null, peerName, peerPhoto })}
                />
              </>
            ) : null}
            <IconButton
              testID="conversation-menu"
              icon="Ellipsis"
              variant="tonal"
              expanded={menuOpen}
              accessibilityLabel={t('conversation.menu')}
              // Rouvrir le menu ne ressuscite pas une confirmation laissée en plan.
              onPress={() => {
                setMenuOpen((open) => !open);
                setConfirm(null);
              }}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[1] }}>
          <Avatar uri={peerPhoto} name={peerName || '?'} size={MIN_TARGET} testID="conversation-peer-avatar" />
          <Text variant="h2" header numberOfLines={2} style={{ flex: 1, flexShrink: 1 }}>
            {peerName || t('conversation.title')}
          </Text>
        </View>
      </View>

      {menuOpen ? (
        <MenuSheet testID="conversation-menu-sheet">
          {confirm ? (
            <View style={{ gap: space[2], padding: space[2] }}>
              <Text variant="bodyStrong">
                {confirm === 'block'
                  ? t('detail.blockConfirm.title', { name: peerName })
                  : confirm === 'unmatch'
                    ? t('conversation.unmatchConfirm.title')
                    : t('conversation.hideConfirm.title')}
              </Text>
              <Text variant="bodySmall" tone="textMuted" testID="conversation-confirm-body">
                {confirm === 'block'
                  ? t('detail.blockConfirm.body')
                  : confirm === 'unmatch'
                    ? t('conversation.unmatchConfirm.body')
                    : t('conversation.hideConfirm.body')}
              </Text>
              <Button
                testID="conversation-confirm"
                variant="danger"
                label={t('common.confirm')}
                onPress={() =>
                  void (confirm === 'block'
                    ? leave(() => api.safety.block(peerId), t('detail.blocked'))
                    : confirm === 'unmatch'
                      ? unmatch()
                      : leave(() => api.messaging.hideConversation(conversationId), t('conversation.hidden')))
                }
              />
              <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirm(null)} />
            </View>
          ) : (
            <>
              <MenuItem testID="conversation-report" icon="Flag" label={t('conversation.report')} onPress={report} disabled={!peerId} />
              <MenuItem testID="conversation-block" icon="Ban" danger label={t('conversation.block')} onPress={() => setConfirm('block')} disabled={!peerId} />
              {matchId ? <MenuItem testID="conversation-unmatch" icon="Undo2" label={t('conversation.unmatch')} onPress={() => setConfirm('unmatch')} /> : null}
              <MenuItem testID="conversation-hide" icon="Trash2" danger label={t('conversation.hide')} onPress={() => setConfirm('hide')} />
            </>
          )}
        </MenuSheet>
      ) : null}

      {thread.safetyHint ? (
        <Banner
          testID="safety-banner"
          variant="warning"
          message={`${t('conversation.safety.title')}. ${t('conversation.safety.body')}`}
          actionLabel={t('conversation.safety.report')}
          onAction={report}
          onDismiss={thread.dismissSafetyHint}
          dismissLabel={t('conversation.safety.dismiss')}
          style={{ marginBottom: space[2] }}
        />
      ) : null}
      {notice ? <Banner testID="conversation-notice" variant="error" message={notice} onDismiss={() => setNotice(undefined)} dismissLabel={t('ui.banner.dismiss')} style={{ marginBottom: space[2] }} /> : null}
      {realtimeStatus !== 'connected' && thread.status === 'ready' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[1] }}>
          <Icon name="WifiOff" size="sm" tone="textMuted" />
          <Text variant="bodySmall" tone="textMuted" testID="realtime-off" style={{ flex: 1 }}>
            {t('conversation.realtime.off')}
          </Text>
        </View>
      ) : null}

      <AsyncView
        testID="thread"
        status={thread.status}
        error={thread.error}
        onRetry={() => void thread.reload()}
        empty={thread.messages.length === 0}
        emptyTitle={t('conversation.empty')}
      >
        <FlatList
          testID="thread-list"
          inverted
          data={thread.messages}
          keyExtractor={(m) => m.client_id || m.id}
          renderItem={renderMessage}
          onEndReached={() => void thread.loadOlder()}
          onEndReachedThreshold={0.4}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListHeaderComponent={
            thread.peerTyping ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1], marginVertical: space[1] }}>
                <Text variant="caption" tone="textMuted" testID="peer-typing" accessibilityLiveRegion="polite">
                  {t('conversation.typing', { name: peerName })}
                </Text>
              </View>
            ) : undefined
          }
          ListFooterComponent={
            thread.hasMore ? (
              <Button
                testID="load-older"
                variant="ghost"
                label={thread.loadingMore ? t('conversation.loadingOlder') : t('conversation.loadOlder')}
                onPress={() => void thread.loadOlder()}
                disabled={thread.loadingMore}
              />
            ) : undefined
          }
        />
      </AsyncView>
      {viewing ? <ImageViewer uri={viewing} onClose={() => setViewing(null)} /> : null}
      {viewingVideo ? (
        <VideoViewer
          messageId={viewingVideo}
          loadUrl={loadImage}
          onClose={() => setViewingVideo(null)}
          onUnavailable={(messageId, status) => {
            setViewingVideo(null);
            thread.setMediaStatus(messageId, status);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}
