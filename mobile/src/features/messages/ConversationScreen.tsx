import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { useRealtime } from '../../realtime';
import { MIN_TARGET, useTheme } from '../../theme';
import { AsyncView, Avatar, Banner, Button, ScreenContainer, Text, useToast } from '../../ui';
import { useCalls } from '../calls/CallProvider';
import { useConversations } from './ConversationsProvider';
import { deliveryState, type LocalMessage } from './thread';
import { useThread } from './useThread';

const STATE_GLYPH = { sending: '…', failed: '!', sent: '✓', delivered: '✓✓', read: '✓✓' } as const;

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
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
  const canCall = known?.unlocked_by === 'match';

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

  const renderMessage = ({ item }: { item: LocalMessage }) => {
    const mine = item.sender_id === thread.myId;
    const state = mine ? deliveryState(item) : null;
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

    if (missed) {
      return (
        <View testID={`message-${item.id}`} accessible accessibilityLabel={content} style={{ alignItems: 'center', marginVertical: space[2] }}>
          <Text variant="caption" tone="textMuted">
            {content}
          </Text>
        </View>
      );
    }

    const deletable = mine && !item.local && item.type !== 'deleted';
    return (
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginVertical: space[1] }}>
        <Pressable
          testID={`message-${item.id}`}
          accessibilityLabel={state ? `${content}. ${t(`conversation.state.${state}`)}` : content}
          accessibilityActions={deletable ? [{ name: 'delete', label: t('conversation.deleteMessage') }] : undefined}
          onAccessibilityAction={() => setActionFor(item.id)}
          onLongPress={deletable ? () => setActionFor(item.id) : undefined}
          style={{
            maxWidth: '80%',
            paddingHorizontal: space[3],
            paddingVertical: space[2],
            borderRadius: radius.md,
            backgroundColor: mine ? colors.primary : colors.surface,
            borderWidth: mine ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          <Text variant="body" tone={mine ? 'onPrimary' : 'text'} style={item.type === 'deleted' ? { fontStyle: 'italic' } : undefined}>
            {content}
          </Text>
        </Pressable>
        {state ? (
          <Text
            variant="caption"
            tone={state === 'failed' ? 'danger' : 'textMuted'}
            testID={`state-${item.id}`}
            accessibilityLabel={t(`conversation.state.${state}`)}
          >
            {STATE_GLYPH[state]} {t(`conversation.state.${state}`)}
          </Text>
        ) : null}
        {item.local === 'failed' ? (
          <View style={{ flexDirection: 'row' }}>
            <Button testID={`retry-${item.client_id}`} variant="ghost" label={t('conversation.retry')} onPress={() => void thread.retry(item.client_id)} />
            <Button variant="ghost" label={t('common.delete')} accessibilityLabel={t('conversation.discard')} onPress={() => thread.discard(item.client_id)} />
          </View>
        ) : null}
        {actionFor === item.id ? (
          <View style={{ flexDirection: 'row' }}>
            <Button
              testID={`delete-${item.id}`}
              variant="danger"
              label={t('conversation.deleteMessage')}
              onPress={() => {
                setActionFor(null);
                void thread.removeMine(item).catch((error: unknown) => {
                  const { key, params: p } = apiErrorMessage(error);
                  setNotice(t(key, p));
                });
              }}
            />
            <Button variant="ghost" label={t('common.cancel')} onPress={() => setActionFor(null)} />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenContainer
      testID="screen-conversation"
      footer={
        thread.closed ? (
          <Text variant="caption" tone="textMuted" testID="conversation-closed">
            {t('conversation.closed')}
          </Text>
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
                minHeight: MIN_TARGET,
                maxHeight: 120,
                paddingHorizontal: space[3],
                paddingVertical: space[2],
                color: colors.text,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
              }}
            />
            <Button testID="conversation-send" label={t('conversation.send')} onPress={submit} disabled={draft.trim() === ''} />
          </View>
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] }}>
        <Button testID="back-button" variant="ghost" label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages' as never))} />
        <Avatar uri={peerPhoto} name={peerName || '?'} size={36} />
        <Text variant="h2" header numberOfLines={1} style={{ flex: 1 }}>
          {peerName || t('conversation.title')}
        </Text>
        {canCall ? (
          <>
            <Button
              testID="call-audio"
              variant="ghost"
              label="☎"
              accessibilityLabel={t('conversation.audioCall')}
              onPress={() => void calls.startCall({ conversationId, kind: 'audio', peerId: peerId || null, peerName, peerPhoto })}
            />
            <Button
              testID="call-video"
              variant="ghost"
              label="▶"
              accessibilityLabel={t('conversation.videoCall')}
              onPress={() => void calls.startCall({ conversationId, kind: 'video', peerId: peerId || null, peerName, peerPhoto })}
            />
          </>
        ) : null}
        <Button testID="conversation-menu" variant="ghost" label="⋯" accessibilityLabel={t('conversation.menu')} onPress={() => setMenuOpen((open) => !open)} />
      </View>

      {menuOpen ? (
        <View testID="conversation-menu-sheet" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: space[2], marginBottom: space[2] }}>
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
              <Button testID="conversation-report" variant="ghost" label={t('conversation.report')} onPress={report} disabled={!peerId} />
              <Button testID="conversation-block" variant="ghost" label={t('conversation.block')} onPress={() => setConfirm('block')} disabled={!peerId} />
              {canCall ? <Button testID="conversation-unmatch" variant="ghost" label={t('conversation.unmatch')} onPress={() => setConfirm('unmatch')} /> : null}
              <Button
                testID="conversation-hide"
                variant="ghost"
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
        <Text variant="caption" tone="textMuted" testID="realtime-off" style={{ marginBottom: space[1] }}>
          {t('conversation.realtime.off')}
        </Text>
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
              <Text variant="caption" tone="textMuted" testID="peer-typing" accessibilityLiveRegion="polite">
                {t('conversation.typing', { name: peerName })}
              </Text>
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
