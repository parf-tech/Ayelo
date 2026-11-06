import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import type { Conversation, ConversationLastMessage } from '../../api/types';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import { AsyncView, Avatar, ListRow, ScreenContainer, Text } from '../../ui';
import { primaryPhotoUrl } from '../discover/swipe';
import { useConversations } from './ConversationsProvider';

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
  const { status, error, conversations, refresh } = useConversations();
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
      >
        <FlatList
          testID="messages-list"
          data={visible}
          keyExtractor={(c) => c.id}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh({ silent: true });
            setRefreshing(false);
          }}
          renderItem={({ item }) => {
            const name = item.profile?.display_name ?? '';
            const preview = previewText(t, item.last_message);
            return (
              <ListRow
                testID={`conversation-${item.id}`}
                label={name}
                description={preview}
                accessibilityLabel={
                  item.unread > 0 ? t('messages.row.unread', { name, count: item.unread, preview }) : t('messages.row', { name, preview })
                }
                leading={<Avatar uri={item.profile ? primaryPhotoUrl(item.profile) : null} name={name} />}
                trailing={
                  <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                    <Text variant="caption" tone="textMuted">
                      {shortTime(item.last_message?.created_at, locale)}
                    </Text>
                    {item.unread > 0 ? (
                      <View
                        testID={`unread-${item.id}`}
                        accessible={false}
                        style={{ minWidth: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}
                      >
                        <Text variant="caption" tone="onPrimary" style={{ fontWeight: '700' }}>
                          {item.unread > 99 ? '99+' : item.unread}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                }
                onPress={() => open(item)}
              />
            );
          }}
        />
      </AsyncView>
    </ScreenContainer>
  );
}
