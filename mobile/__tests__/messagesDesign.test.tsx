import { act, screen } from '@testing-library/react-native';
import React from 'react';
import { ConversationScreen } from '../src/features/messages/ConversationScreen';
import { dayKey, dayLabel, formatTime } from '../src/features/messages/messageTime';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { emptyBody, installFakeApi } from './helpers/fakeApi';
import { conversation, meFixture, message, publicProfile } from './helpers/fixtures';
import { resetRouterMocks } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => mockParams.current,
}));
jest.mock('../src/config/features', () => ({ CALLS_ENABLED: false }));

const NOW = new Date(2026, 10, 12, 15, 0, 0); // 12 novembre 2026, heure locale

describe('messageTime', () => {
  it('dayKey : vide pour une date absente ou invalide, identique pour deux heures du même jour', () => {
    expect(dayKey(undefined)).toBe('');
    expect(dayKey('pas une date')).toBe('');
    expect(dayKey(new Date(2026, 10, 12, 1).toISOString())).toBe(dayKey(new Date(2026, 10, 12, 23).toISOString()));
  });

  it('dayLabel : aujourd’hui, hier, puis date longue (année seulement si elle diffère)', () => {
    expect(dayLabel(new Date(2026, 10, 12, 9).toISOString(), 'fr', NOW)).toEqual({ kind: 'today' });
    expect(dayLabel(new Date(2026, 10, 11, 23).toISOString(), 'fr', NOW)).toEqual({ kind: 'yesterday' });
    const sameYear = dayLabel(new Date(2026, 2, 3, 12).toISOString(), 'fr', NOW);
    expect(sameYear).toMatchObject({ kind: 'date' });
    expect((sameYear as { text: string }).text).not.toMatch(/2026/);
    const otherYear = dayLabel(new Date(2025, 2, 3, 12).toISOString(), 'fr', NOW);
    expect((otherYear as { text: string }).text).toMatch(/2025/);
    expect(dayLabel('nope', 'fr', NOW)).toBeNull();
  });

  it('formatTime : heure locale courte, vide si invalide', () => {
    expect(formatTime(new Date(2026, 10, 12, 14, 5).toISOString(), 'fr')).toMatch(/14.05/);
    expect(formatTime('nope', 'fr')).toBe('');
  });
});

describe('Conversation : séparateurs de jour et heures', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
    tokenStore.resetCacheForTests();
    resetDeviceIdCacheForTests();
    resetRouterMocks();
    mockParams.current = { id: 'c1', name: 'Awa', peerId: 'u2' };
  });
  afterEach(async () => {
    await act(async () => undefined);
  });

  it('un séparateur par jour, au-dessus du plus ancien message du jour ; une heure par message', async () => {
    const day = (d: number, h: number) => new Date(2026, 0, d, h, 30).toISOString();
    installFakeApi({
      'GET /me': [200, meFixture()],
      'GET /conversations': [200, { data: [conversation('c1', publicProfile('u2', 'Awa'))] }],
      'GET /conversations/c1/messages': [
        200,
        {
          data: [
            message('m3', 'u2', 'Trois', { created_at: day(2, 10) }),
            message('m2', 'u1', 'Deux', { created_at: day(1, 18) }),
            message('m1', 'u2', 'Un', { created_at: day(1, 9) }),
          ],
          next_cursor: null,
        },
      ],
      'POST /conversations/c1/delivered': emptyBody(),
      'POST /conversations/c1/read': emptyBody(),
    } as never);
    await renderShell(<ConversationScreen />, { conversations: true });
    expect(await screen.findByText('Trois')).toBeOnTheScreen();

    // Deux jours : un séparateur sous « Un » (plus ancien du 1er) et un sous « Trois » (seul du 2).
    expect(screen.getByTestId('day-m1')).toBeOnTheScreen();
    expect(screen.getByTestId('day-m3')).toBeOnTheScreen();
    expect(screen.queryByTestId('day-m2')).not.toBeOnTheScreen();
    for (const id of ['m1', 'm2', 'm3']) expect(screen.getByTestId(`time-${id}`)).toBeOnTheScreen();
  });
});
