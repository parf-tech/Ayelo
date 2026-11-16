import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import type { Conversation, ConversationLastMessage } from '../../api/types';
import { useI18n } from '../../i18n';
import { borderWidth, fontWeight, MIN_TARGET, stateOpacity, useTheme } from '../../theme';
import { AsyncView, Avatar, ScreenContainer, Text } from '../../ui';
import { primaryPhotoUrl } from '../discover/swipe';
import { useConversations } from './ConversationsProvider';

/** Photo de la rangée, et hauteur minimale d'une rangée (photo + marges) ; le filet commence après la photo. */
const AVATAR_SIZE = 56;
const ROW_MIN_HEIGHT = MIN_TARGET + 28;

type Translate = ReturnType<typeof useI18n>['t'];

export function previewText(t: Translate, last: ConversationLastMessage | null): string {
  if (!last) return t('messages.preview.none');
  let text: string;
  switch (last.type) {
    case 'text':
      text = last.body ?? '';
      break;
    case 'image':
      text = t('messages.preview.image');
      break;
    case 'video':
      text = t('messages.preview.video');
      break;
    case 'voice':
      text = t('messages.preview.voice');
      break;
    case 'call_missed':
      text = t('messages.preview.call_missed');
      break;
    case 'deleted':
      text = t('messages.preview.deleted');
      break;
    default:
      text = t('messages.preview.other');
  }
  return last.mine && last.type !== 'call_missed' ? t('messages.preview.mine', { text }) : text;
}

function shortTime(iso: string | undefined, locale: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** S13 : liste des conversations (aperçu, non-lus), actualisation par geste, repli périodique. */
export function MessagesListScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { colors, radius, space } = useTheme();
  const { status, error, conversations, refresh, loadMore, loadingMore } = useConversations();
  const [refreshing, setRefreshing] = useState(false);

  const open = (c: Conversation) =>
    router.push({
      pathname: '/conversation/[id]',
      params: {
        id: c.id,
        name: c.profile?.display_name ?? '',
        photo: c.profile ? (primaryPhotoUrl(c.profile) ?? '') : '',
        peerId: c.profile?.user_id ?? '',
      },
    } as never);

  const visible = conversations.filter((c) => c.profile !== null);

  return (
    <ScreenContainer testID="screen-messages">
      <Text variant="title" header style={{ marginBottom: space[2] }}>
        {t('messages.title')}
      </Text>
      <AsyncView
        testID="messages"
        status={status}
        error={error}
        onRetry={() => void refresh()}
        empty={visible.length === 0}
        emptyTitle={t('messages.empty.title')}
        emptyDescription={t('messages.empty.body')}
        emptyActionLabel={t('messages.empty.action')}
        onEmptyAction={() => router.push('/discover' as never)}
        emptyIcon="MessageCircle"
      >
        <FlatList
          testID="messages-list"
          data={visible}
          keyExtractor={(c) => c.id}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator testID="messages-loading-more" color={colors.primary} style={{ paddingVertical: space[3] }} /> : undefined}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              colors={[colors.primary]}
              onRefresh={async () => {
                setRefreshing(true);
                await refresh({ silent: true });
                setRefreshing(false);
              }}
            />
          }
          renderItem={({ item }) => {
            const name = item.profile?.display_name ?? '';
            const preview = previewText(t, item.last_message);
            const unread = item.unread > 0;
            return (
              <Pressable
                testID={`conversation-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={unread ? t(item.unread === 1 ? 'messages.row.unread.one' : 'messages.row.unread', { name, count: item.unread, preview }) : t('messages.row', { name, preview })}
                onPress={() => open(item)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  minHeight: ROW_MIN_HEIGHT,
                  paddingVertical: space[2],
                  opacity: pressed ? stateOpacity.pressed : 1,
                })}
              >
                <Avatar uri={item.profile ? primaryPhotoUrl(item.profile) : null} name={name} size={AVATAR_SIZE} />
                <View style={{ flex: 1, gap: space[1] }}>
                  <Text variant="body" numberOfLines={1} style={{ fontWeight: unread ? fontWeight.bold : fontWeight.semibold }}>
                    {name}
                  </Text>
                  {/* Non lu : graisse ET pastille numérique, jamais la couleur seule. */}
                  <Text variant="bodySmall" tone={unread ? 'text' : 'textMuted'} numberOfLines={2} style={{ fontWeight: unread ? fontWeight.semibold : undefined }}>
                    {preview}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: space[1], minWidth: MIN_TARGET }}>
                  <Text variant="caption" tone="textMuted">
                    {shortTime(item.last_message?.created_at, locale)}
                  </Text>
                  {unread ? (
                    <View
                      testID={`unread-${item.id}`}
                      accessible={false}
                      style={{ minWidth: space[5], height: space[5], borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[1] }}
                    >
                      <Text variant="captionStrong" tone="onPrimary">
                        {item.unread > 99 ? '99+' : item.unread}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: borderWidth.hairline, backgroundColor: colors.border, marginLeft: AVATAR_SIZE + space[3] }} />}
        />
      </AsyncView>
    </ScreenContainer>
  );
}
