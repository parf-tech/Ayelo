import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { AuthProvider } from '../src/auth/AuthProvider';
import { I18nProvider } from '../src/i18n';
import { AreaLayout } from '../src/navigation/AreaLayout';
import { MainTabs } from '../src/navigation/MainTabs';
import { colors, ThemeProvider } from '../src/theme';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';

const mockCaptured: { stack?: Record<string, unknown>; tabs?: Record<string, unknown> } = {};

jest.mock('expo-router', () => {
  const { View } = require('react-native');
  const Stack = Object.assign(
    ({ screenOptions }: { screenOptions: Record<string, unknown> }) => {
      mockCaptured.stack = screenOptions;
      return <View testID="stack" />;
    },
    { Screen: () => null },
  );
  const Tabs = Object.assign(
    ({ screenOptions }: { screenOptions: Record<string, unknown> }) => {
      mockCaptured.tabs = screenOptions;
      return <View testID="tabs" />;
    },
    { Screen: () => null },
  );
  return { Stack, Tabs, Redirect: () => null, useIsFocused: () => true };
});

jest.mock('../src/features/messages/ConversationsProvider', () => ({ useConversations: () => ({ unreadTotal: 0 }) }));

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  delete mockCaptured.stack;
  delete mockCaptured.tabs;
});

describe('thème de navigation (pas de flash blanc en mode sombre)', () => {
  it('la pile et les onglets peignent le fond du thème sombre', async () => {
    await render(
      <ThemeProvider scheme="dark">
        <I18nProvider initialLocale="fr">
          <AuthProvider>
            <AreaLayout area="public" />
            <MainTabs />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>,
    );
    await screen.findByTestId('stack');
    expect(mockCaptured.stack).toMatchObject({ contentStyle: { backgroundColor: colors.dark.bg } });
    expect(mockCaptured.tabs).toMatchObject({ sceneStyle: { backgroundColor: colors.dark.bg } });
  });
});
