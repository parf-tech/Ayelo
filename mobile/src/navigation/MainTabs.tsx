import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useConversations } from '../features/messages/ConversationsProvider';
import { useI18n } from '../i18n';
import { borderWidth, fontFamilyFor, useFontsReady, useTheme } from '../theme';
import { Icon, TAB_BAR_MIN_HEIGHT, Text, useToastBottomOffset, type IconName } from '../ui';

/** Plafond d'agrandissement du libellé d'onglet : au-delà, la barre déborderait (spec 5.8, AC-TAB-5). */
const TAB_LABEL_MAX_FONT_MULTIPLIER = 1.6;
/** Largeur du repère de l'onglet actif (un trait, en plus de la couleur et du poids du libellé). */
const TAB_MARKER_WIDTH = 24;
/** Au-delà, la pastille affiche « 99+ » et le libellé d'accessibilité dit « plus de 99 ». */
const BADGE_MAX_COUNT = 99;

/** Pictogramme Lucide de l'onglet : plein et en couleur primaire quand il est actif, avec un repère de 2 pt au-dessus. */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const { colors, radius, space } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        accessible={false}
        importantForAccessibility="no"
        style={{
          position: 'absolute',
          top: -space[2],
          width: TAB_MARKER_WIDTH,
          height: borderWidth.strong,
          borderRadius: radius.pill,
          backgroundColor: focused ? colors.primary : 'transparent',
        }}
      />
      <Icon name={name} size="lg" tone={focused ? 'primary' : 'textMuted'} filled={focused} />
    </View>
  );
}

/** Libellé d'onglet : Poppins, SemiBold quand l'onglet est actif, agrandissement plafonné. */
function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      variant={focused ? 'captionStrong' : 'caption'}
      tone={focused ? 'primary' : 'textMuted'}
      maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_MULTIPLIER}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

/** Barre d'onglets : Découvrir (S10), Messages (S13, pastille de non-lus), Mon profil (S59). */
export function MainTabs() {
  const { t } = useI18n();
  const { colors, type } = useTheme();
  const fontsReady = useFontsReady();
  const { unreadTotal } = useConversations();

  // Les toasts se posent au-dessus de la barre d'onglets tant qu'elle est affichée.
  useToastBottomOffset(TAB_BAR_MIN_HEIGHT);

  const unreadLabel =
    unreadTotal > BADGE_MAX_COUNT
      ? t('messages.unread.more', { count: BADGE_MAX_COUNT })
      : unreadTotal === 1
        ? t('messages.unread.one')
        : t('messages.unread', { count: unreadTotal });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, minHeight: TAB_BAR_MIN_HEIGHT },
        tabBarLabelStyle: { fontSize: type.caption.size },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: t('tabs.discover'),
          tabBarAccessibilityLabel: t('tabs.discover'),
          tabBarButtonTestID: 'tab-discover',
          tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.discover')} focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon name="Layers" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages'),
          tabBarAccessibilityLabel: unreadTotal > 0 ? `${t('tabs.messages')}, ${unreadLabel}` : t('tabs.messages'),
          tabBarButtonTestID: 'tab-messages',
          tabBarBadge: unreadTotal > 0 ? (unreadTotal > BADGE_MAX_COUNT ? `${BADGE_MAX_COUNT}+` : unreadTotal) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.onPrimary,
            ...(fontsReady ? { fontFamily: fontFamilyFor(type.captionStrong.weight) } : null),
          },
          tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.messages')} focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon name="MessageCircle" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarButtonTestID: 'tab-profile',
          tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.profile')} focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon name="User" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
