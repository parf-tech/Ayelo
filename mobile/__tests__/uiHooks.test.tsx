import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { colors, focus, motion, ThemeProvider } from '../src/theme';
import { announce, resetAnnounceDebounce } from '../src/ui/a11y/announce';
import { focusNode } from '../src/ui/a11y/focus';
import { useCompactLayout } from '../src/ui/hooks/useCompactLayout';
import { useFocusRing } from '../src/ui/hooks/useFocusRing';
import { useMotion } from '../src/ui/hooks/useMotion';
import { useReduceMotion } from '../src/ui/hooks/useReduceMotion';
import { mockFontScale, mockReduceMotion, mockWindow, spyAnnounce } from './helpers/a11y';

const originalOS = Platform.OS;
function setOS(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
});

describe('announce', () => {
  beforeEach(() => resetAnnounceDebounce());

  it('iOS : appelle announceForAccessibility', () => {
    setOS('ios');
    const spy = spyAnnounce();
    announce('Message envoyé');
    expect(spy).toHaveBeenCalledWith('Message envoyé');
  });

  it('Android : ne fait rien (la région vivante suffit)', () => {
    setOS('android');
    const spy = spyAnnounce();
    announce('Message envoyé');
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignore les chaînes vides', () => {
    setOS('ios');
    const spy = spyAnnounce();
    announce('');
    announce('   ');
    expect(spy).not.toHaveBeenCalled();
  });

  it('antirebond de 500 ms sur un même message, pas sur un message différent', () => {
    setOS('ios');
    jest.useFakeTimers({ now: 1_000_000 });
    const spy = spyAnnounce();
    announce('Erreur');
    announce('Erreur');
    expect(spy).toHaveBeenCalledTimes(1);
    announce('Autre');
    expect(spy).toHaveBeenCalledTimes(2);
    jest.setSystemTime(1_000_000 + 600);
    announce('Autre');
    expect(spy).toHaveBeenCalledTimes(3);
  });
});

describe('focusNode', () => {
  it('ne plante pas avec une référence nulle ou vide', () => {
    const set = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
    expect(() => focusNode(null)).not.toThrow();
    expect(() => focusNode(undefined)).not.toThrow();
    expect(() => focusNode({ current: null })).not.toThrow();
    expect(set).not.toHaveBeenCalled();
  });

  it('ne plante pas avec un nœud non monté', () => {
    jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
    expect(() => focusNode({ current: {} })).not.toThrow();
  });
});

describe('useReduceMotion', () => {
  it('renvoie null tant que le réglage est inconnu, puis la valeur système', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => undefined));
    const { result } = await renderHook(() => useReduceMotion());
    expect(result.current).toBeNull();
  });

  it('suit reduceMotionChanged en direct et se désabonne', async () => {
    mockReduceMotion(false);
    const remove = jest.fn();
    let listener: (enabled: boolean) => void = () => undefined;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, cb: (e: boolean) => void) => {
      if (event === 'reduceMotionChanged') listener = cb;
      return { remove };
    }) as never);
    const { result, unmount } = await renderHook(() => useReduceMotion());
    await act(async () => {});
    expect(result.current).toBe(false);
    await act(async () => listener(true));
    expect(result.current).toBe(true);
    await unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('retombe sur « réduit » si la lecture échoue', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('indisponible'));
    const { result } = await renderHook(() => useReduceMotion());
    await act(async () => {});
    expect(result.current).toBe(true);
  });
});

describe('useMotion', () => {
  it('durées des jetons quand le mouvement est permis', async () => {
    mockReduceMotion(false);
    const { result } = await renderHook(() => useMotion());
    await act(async () => {});
    expect(result.current.reduced).toBe(false);
    expect(result.current.duration('fast')).toBe(motion.duration.fast);
    expect(result.current.duration('base')).toBe(motion.duration.base);
    expect(result.current.duration('slow')).toBe(motion.duration.slow);
  });

  it('durées à 0 quand le mouvement est réduit', async () => {
    mockReduceMotion(true);
    const { result } = await renderHook(() => useMotion());
    await act(async () => {});
    expect(result.current.reduced).toBe(true);
    expect(result.current.duration('slow')).toBe(0);
  });

  it('durées à 0 tant que le réglage est inconnu', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => undefined));
    const { result } = await renderHook(() => useMotion());
    expect(result.current.reduced).toBe(true);
    expect(result.current.duration('base')).toBe(0);
  });
});

describe('useFocusRing', () => {
  const wrapperFor = (scheme: 'light' | 'dark') =>
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <ThemeProvider scheme={scheme}>{children}</ThemeProvider>;
    };

  it('sans focus : aucun contour ; au focus : contour du jeton ; au blur : retiré', async () => {
    const { result } = await renderHook(() => useFocusRing(), { wrapper: wrapperFor('light') });
    expect(result.current.focused).toBe(false);
    expect(result.current.ringStyle).toEqual({});
    await act(async () => result.current.handlers.onFocus());
    expect(result.current.focused).toBe(true);
    expect(result.current.ringStyle).toMatchObject({
      outlineWidth: focus.width,
      outlineOffset: focus.offset,
      outlineColor: colors.light.focusRing,
    });
    await act(async () => result.current.handlers.onBlur());
    expect(result.current.focused).toBe(false);
    expect(result.current.ringStyle).toEqual({});
  });

  it('utilise la couleur de focus du thème sombre', async () => {
    const { result } = await renderHook(() => useFocusRing(), { wrapper: wrapperFor('dark') });
    await act(async () => result.current.handlers.onFocus());
    expect(result.current.ringStyle).toMatchObject({ outlineColor: colors.dark.focusRing });
  });
});

describe('useCompactLayout', () => {
  it('390 pt, texte normal : ni étroit ni agrandi', async () => {
    mockWindow(390, 844, 1);
    const { result } = await renderHook(() => useCompactLayout());
    expect(result.current).toMatchObject({
      width: 390,
      fontScale: 1,
      isNarrow: false,
      isTiny: false,
      isLarge: false,
      isXL: false,
    });
  });

  it('360 pt : étroit mais pas minuscule', async () => {
    mockWindow(360, 780, 1);
    const { result } = await renderHook(() => useCompactLayout());
    expect(result.current.isNarrow).toBe(true);
    expect(result.current.isTiny).toBe(false);
  });

  it('320 pt : étroit et minuscule', async () => {
    mockWindow(320, 640, 1);
    const { result } = await renderHook(() => useCompactLayout());
    expect(result.current.isNarrow).toBe(true);
    expect(result.current.isTiny).toBe(true);
  });

  it.each([
    [1.29, false, false],
    [1.3, true, false],
    [1.74, true, false],
    [1.75, true, true],
    [2, true, true],
  ])('fontScale %s : isLarge=%s isXL=%s', async (scale, large, xl) => {
    mockFontScale(scale);
    const { result } = await renderHook(() => useCompactLayout());
    expect(result.current.isLarge).toBe(large);
    expect(result.current.isXL).toBe(xl);
    expect(result.current.fontScale).toBe(scale);
  });
});
