import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { CALLS_ENABLED } from '../../config/features';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useRealtime } from '../../realtime';
import { MIN_TARGET, stateOpacity, useTheme } from '../../theme';
import { AsyncView, Avatar, Banner, Button, Icon, IconButton, ScreenContainer, Text, useToast, type IconName } from '../../ui';
import { useCalls } from '../calls/CallProvider';
import { useConversations } from './ConversationsProvider';
import { DateSeparator } from './DateSeparator';
import { MessageBubble } from './MessageBubble';
import { dayKey } from './messageTime';
import type { LocalMessage } from './thread';
import { useThread } from './useThread';

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

/** Ligne du menu de conversation : icône + libellé, cible >= 44, même testID qu'avant. */
function MenuItem({
  testID,
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  testID: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { space } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: MIN_TARGET,
        paddingHorizontal: space[3],
        opacity: disabled ? stateOpacity.disabled : pressed ? stateOpacity.pressed : 1,
      })}
    >
      <Icon name={icon} tone={danger ? 'danger' : 'text'} />
      <Text variant="body" tone={danger ? 'danger' : 'text'} style={{ flex: 1, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** S14 : conversation (bulles, envoi optimiste, renvoi, accusés, pagination, « écrit… », avis de sécurité). */
export function ConversationScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors, radius, space } = useTheme();
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
  const peerPhoto = param(params.photo) || null;
  const isMatch = known?.unlocked_by === 'match';
  const canCall = CALLS_ENABLED && isMatch;

  const thread = useThread(conversationId);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<'block' | 'unmatch' | null>(null);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>();

  const submit = () => {
    const text = draft;
    if (!text.trim()) return;
    setDraft('');
    void thread.send(text);
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
      const matches = await api.discovery.matches();
      const match = matches.data.find((m) => m.conversation_id === conversationId);
      if (match) await api.discovery.deleteMatch(match.id);
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
          deletable={deletable}
          actionOpen={actionFor === item.id}
          onOpenActions={() => setActionFor(item.id)}
          onCloseActions={() => setActionFor(null)}
          onRetry={() => void thread.retry(item.client_id)}
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
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }}>
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
              style={{
                flex: 1,
                minHeight: MIN_TARGET + 4,
                maxHeight: 120,
                paddingHorizontal: space[4],
                paddingVertical: space[3],
                color: colors.text,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
              }}
            />
            <IconButton
              testID="conversation-send"
              icon="Send"
              size="lg"
              variant="filled"
              accessibilityLabel={t('conversation.send')}
              onPress={submit}
              disabled={draft.trim() === ''}
            />
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
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages' as never))}
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
              expanded={menuOpen}
              accessibilityLabel={t('conversation.menu')}
              onPress={() => setMenuOpen((open) => !open)}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[1] }}>
          <Avatar uri={peerPhoto} name={peerName || '?'} size={44} />
          <Text variant="h2" header numberOfLines={2} style={{ flex: 1, flexShrink: 1 }}>
            {peerName || t('conversation.title')}
          </Text>
        </View>
      </View>

      {menuOpen ? (
        <View testID="conversation-menu-sheet" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: space[2], marginBottom: space[2] }}>
          {confirm ? (
            <View style={{ gap: space[2], padding: space[2] }}>
              <Text variant="body">{confirm === 'block' ? t('detail.blockConfirm.title', { name: peerName }) : t('conversation.unmatch')}</Text>
              <Button
                testID="conversation-confirm"
                variant="danger"
                label={t('common.confirm')}
                onPress={() =>
                  void (confirm === 'block'
                    ? leave(() => api.safety.block(peerId), t('detail.blocked'))
                    : unmatch())
                }
              />
              <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirm(null)} />
            </View>
          ) : (
            <>
              <MenuItem testID="conversation-report" icon="Flag" label={t('conversation.report')} onPress={report} disabled={!peerId} />
              <MenuItem testID="conversation-block" icon="Ban" label={t('conversation.block')} onPress={() => setConfirm('block')} disabled={!peerId} />
              {isMatch ? <MenuItem testID="conversation-unmatch" icon="Undo2" label={t('conversation.unmatch')} onPress={() => setConfirm('unmatch')} /> : null}
              <MenuItem
                testID="conversation-hide"
                icon="Trash2"
                danger
                label={t('conversation.hide')}
                onPress={() => void leave(() => api.messaging.hideConversation(conversationId), t('conversation.hidden'))}
              />
            </>
          )}
        </View>
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
          <Text variant="caption" tone="textMuted" testID="realtime-off" style={{ flex: 1 }}>
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
    </ScreenContainer>
  );
}
