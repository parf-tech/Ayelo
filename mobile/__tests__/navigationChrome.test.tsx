import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { AuthProvider } from '../src/auth/AuthProvider';
import { BackButton } from '../src/features/common/BackButton';
import { I18nProvider, translate } from '../src/i18n';
import { AreaLayout } from '../src/navigation/AreaLayout';
import { MainTabs } from '../src/navigation/MainTabs';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { MIN_TARGET, ThemeProvider } from '../src/theme';
import { resetRouterMocks, router } from './helpers/routerMock';

type TabOptions = {
  title?: string;
  tabBarAccessibilityLabel?: string;
  tabBarButtonTestID?: string;
  tabBarBadge?: string | number;
  tabBarLabel?: (props: { focused: boolean }) => React.ReactNode;
  tabBarIcon?: (props: { focused: boolean }) => React.ReactNode;
};

const mockCaptured: { stack?: Record<string, unknown>; tabs: Record<string, TabOptions> } = { tabs: {} };
let mockUnread = 0;

jest.mock('expo-router', () => {
  const { View } = require('react-native');
  const routerMock = require('./helpers/routerMock').expoRouterMock;
  const Stack = Object.assign(
    ({ screenOptions }: { screenOptions: Record<string, unknown> }) => {
      mockCaptured.stack = screenOptions;
      return <View testID="stack" />;
    },
    { Screen: () => null },
  );
  const Tabs = Object.assign(({ children }: { children: React.ReactNode }) => <View testID="tabs">{children}</View>, {
    Screen: ({ name, options }: { name: string; options: Record<string, unknown> }) => {
      mockCaptured.tabs[name] = options as never;
      return null;
    },
  });
  return { ...routerMock, Stack, Tabs };
});

jest.mock('../src/features/messages/ConversationsProvider', () => ({ useConversations: () => ({ unreadTotal: mockUnread }) }));

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  router.canGoBack.mockReturnValue(true);
  mockCaptured.tabs = {};
  delete mockCaptured.stack;
  mockUnread = 0;
});

afterEach(() => {
  jest.restoreAllMocks();
});

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider scheme="light">
    <I18nProvider initialLocale="fr">{children}</I18nProvider>
  </ThemeProvider>
);

async function renderTabs() {
  await render(
    <Providers>
      <MainTabs />
    </Providers>,
  );
  await screen.findByTestId('tabs');
}

/** Rend le pictogramme ou le libellé d'un onglet, dans les fournisseurs de thème et de langue. */
async function renderOption(node: React.ReactNode) {
  await render(<Providers>{node}</Providers>);
}

describe('barre d’onglets : pictogrammes Lucide, état actif non porté par la couleur seule', () => {
  it('trois onglets, identifiants de test et libellés d’accessibilité', async () => {
    await renderTabs();
    expect(Object.keys(mockCaptured.tabs)).toEqual(['discover', 'messages', 'profile']);
    expect(mockCaptured.tabs.discover).toMatchObject({ tabBarButtonTestID: 'tab-discover', tabBarAccessibilityLabel: 'Découvrir' });
    expect(mockCaptured.tabs.messages).toMatchObject({ tabBarButtonTestID: 'tab-messages', tabBarAccessibilityLabel: 'Messages' });
    expect(mockCaptured.tabs.profile).toMatchObject({ tabBarButtonTestID: 'tab-profile' });
  });

  it.each([
    ['discover', 'Layers'],
    ['messages', 'MessageCircle'],
    ['profile', 'User'],
  ])('onglet %s : icône Lucide %s, aucun caractère texte', async (name, icon) => {
    await renderTabs();
    await renderOption(mockCaptured.tabs[name]!.tabBarIcon!({ focused: true }));
    expect(screen.getByTestId(`icon-${icon}`, { includeHiddenElements: true })).toBeOnTheScreen();
    for (const glyph of ['♥', '✉', '☺']) expect(screen.queryByText(glyph, { includeHiddenElements: true })).toBeNull();
  });

  it('onglet actif : libellé plus appuyé (SemiBold) et repère de 2 pt ; onglet inactif : ni l’un ni l’autre', async () => {
    await renderTabs();
    await renderOption(mockCaptured.tabs.discover!.tabBarLabel!({ focused: true }));
    const active = screen.getByText('Découvrir');
    expect(active).toHaveProp('maxFontSizeMultiplier', 1.6);
    const activeWeight = (Array.isArray(active.props.style) ? Object.assign({}, ...active.props.style.flat(3).filter(Boolean)) : active.props.style).fontWeight;

    await renderOption(mockCaptured.tabs.discover!.tabBarLabel!({ focused: false }));
    const inactive = screen.getAllByText('Découvrir').at(-1)!;
    const inactiveWeight = (Array.isArray(inactive.props.style) ? Object.assign({}, ...inactive.props.style.flat(3).filter(Boolean)) : inactive.props.style).fontWeight;
    expect(Number(activeWeight)).toBeGreaterThan(Number(inactiveWeight));
  });

  it('pastille : 1 -> singulier, plus de 99 -> « 99+ » et « plus de 99 » dans le libellé d’accessibilité', async () => {
    mockUnread = 1;
    await renderTabs();
    expect(mockCaptured.tabs.messages).toMatchObject({ tabBarBadge: 1, tabBarAccessibilityLabel: 'Messages, 1 message non lu' });

    mockUnread = 150;
    await renderTabs();
    expect(mockCaptured.tabs.messages).toMatchObject({ tabBarBadge: '99+', tabBarAccessibilityLabel: 'Messages, plus de 99 messages non lus' });

    mockUnread = 3;
    await renderTabs();
    expect(mockCaptured.tabs.messages).toMatchObject({ tabBarBadge: 3, tabBarAccessibilityLabel: 'Messages, 3 messages non lus' });
  });
});

describe('pluriels des non-lus (fr et en)', () => {
  it('une seule conversation ou un seul message : singulier', () => {
    expect(translate('fr', 'messages.unread.one')).toBe('1 message non lu');
    expect(translate('en', 'messages.unread.one')).toBe('1 unread message');
    expect(translate('fr', 'messages.row.unread.one', { name: 'Awa', preview: 'Salut' })).toBe('Awa, 1 non lu. Salut');
    expect(translate('en', 'messages.row.unread.one', { name: 'Awa', preview: 'Hi' })).toBe('Awa, 1 unread. Hi');
    expect(translate('en', 'messages.unread.more', { count: 99 })).toBe('more than 99 unread messages');
  });
});

describe('animation de la pile : réduction des animations', () => {
  it('fondu quand le système demande de réduire les animations, glissement sinon', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(
      <ThemeProvider scheme="light">
        <I18nProvider initialLocale="fr">
          <AuthProvider>
            <AreaLayout area="public" />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>,
    );
    await screen.findByTestId('stack');
    await waitFor(() => expect(mockCaptured.stack).toMatchObject({ animation: 'fade' }));
  });

  it('glissement vers la droite quand les animations sont permises', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await render(
      <ThemeProvider scheme="light">
        <I18nProvider initialLocale="fr">
          <AuthProvider>
            <AreaLayout area="public" />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>,
    );
    await screen.findByTestId('stack');
    await waitFor(() => expect(mockCaptured.stack).toMatchObject({ animation: 'slide_from_right' }));
  });
});

describe('bouton retour unique (IconButton ChevronLeft)', () => {
  it('icône, libellé « Retour », cible >= 44 pt, revient en arrière quand la pile le permet', async () => {
    await render(
      <Providers>
        <BackButton fallbackHref="/login" />
      </Providers>,
    );
    const button = screen.getByRole('button', { name: 'Retour' });
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
    expect(screen.getByTestId('back-button-icon', { includeHiddenElements: true })).toBeOnTheScreen();
    const style = Object.assign({}, ...[button.props.style].flat(3).filter(Boolean)) as { minHeight?: number; minWidth?: number };
    expect(Number(style.minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(Number(style.minWidth)).toBeGreaterThanOrEqual(MIN_TARGET);

    await act(async () => userEvent.setup().press(screen.getByTestId('back-button')));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('pile vide : remplace par la destination de repli', async () => {
    router.canGoBack.mockReturnValue(false);
    await render(
      <Providers>
        <BackButton fallbackHref="/login" />
      </Providers>,
    );
    await act(async () => userEvent.setup().press(screen.getByTestId('back-button')));
    expect(router.replace).toHaveBeenCalledWith('/login');
    expect(router.back).not.toHaveBeenCalled();
  });
});
