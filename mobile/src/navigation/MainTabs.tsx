import { Tabs } from 'expo-router';
import React from 'react';
import { ColorValue, Text as RNText } from 'react-native';
import { useConversations } from '../features/messages/ConversationsProvider';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

function Glyph({ symbol, color }: { symbol: string; color: ColorValue }) {
  return (
    <RNText accessible={false} importantForAccessibility="no" style={{ color, fontSize: 20 }}>
      {symbol}
    </RNText>
  );
}

/** Barre d'onglets : Découvrir (S10), Messages (S13, pastille de non-lus), Mon profil (S59). */
export function MainTabs() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { unreadTotal } = useConversations();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, minHeight: 56 },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: t('tabs.discover'),
          tabBarAccessibilityLabel: t('tabs.discover'),
          tabBarIcon: ({ color }) => <Glyph symbol="♥" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages'),
          tabBarAccessibilityLabel: unreadTotal > 0 ? `${t('tabs.messages')}, ${t('messages.unread', { count: unreadTotal })}` : t('tabs.messages'),
          tabBarBadge: unreadTotal > 0 ? (unreadTotal > 99 ? '99+' : unreadTotal) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary },
          tabBarIcon: ({ color }) => <Glyph symbol="✉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarIcon: ({ color }) => <Glyph symbol="☺" color={color} />,
        }}
      />
    </Tabs>
  );
}
