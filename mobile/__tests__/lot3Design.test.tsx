import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { DiscoverScreen } from '../src/features/discover/DiscoverScreen';
import { MatchScreen } from '../src/features/discover/MatchScreen';
import { ProfileDetailScreen } from '../src/features/discover/ProfileDetailScreen';
import { SCRIM_TEXT_MIN_ALPHA, scrimAlphaAt } from '../src/features/discover/Scrim';
import { SWIPE_DISTANCE } from '../src/features/discover/swipe';
import { ReportScreen } from '../src/features/safety/ReportScreen';
import { resetDeviceIdCacheForTests } from '../src/storage/deviceId';
import { tokenStore } from '../src/storage/tokenStore';
import { colors } from '../src/theme';
import { installFakeApi } from './helpers/fakeApi';
import { media, meFixture, publicProfile, selfProfile } from './helpers/fixtures';
import { resetRouterMocks, router } from './helpers/routerMock';
import { renderShell } from './helpers/shell';

// Revue design, lot 3 : découverte, match, fiche d'un profil, signalement.

const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  ...require('./helpers/routerMock').expoRouterMock,
  useLocalSearchParams: () => mockParams.current,
}));

const ME = meFixture();
const user = () => userEvent.setup();
const AWA = publicProfile('p1', 'Awa');
const BINTA = publicProfile('p2', 'Binta', { age: 31 });

function deck(profiles = [AWA, BINTA]): Record<string, [number, unknown]> {
  return { 'GET /me': [200, ME], 'GET /discover': [200, { data: profiles, next_cursor: null }] };
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  tokenStore.resetCacheForTests();
  resetDeviceIdCacheForTests();
  resetRouterMocks();
  mockParams.current = {};
});

afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => undefined);
});

/** Événement de geste minimal (historique tactile) pour piloter le PanResponder de la carte sans appareil. */
function touchEvent(x: number, y: number, stamp: number, previous: { x: number; y: number }) {
  const touch = {
    touchActive: true,
    startPageX: 0,
    startPageY: 0,
    startTimeStamp: 1,
    currentPageX: x,
    currentPageY: y,
    currentTimeStamp: stamp,
    previousPageX: previous.x,
    previousPageY: previous.y,
    previousTimeStamp: stamp - 1,
  };
  return { nativeEvent: { touches: [] }, touchHistory: { indexOfSingleActiveTouch: 0, mostRecentTimeStamp: stamp, numberActiveTouches: 1, touchBank: [touch] } };
}

async function dragCard(card: { props: Record<string, (event: unknown) => void> }, dx: number) {
  await act(async () => {
    card.props.onResponderGrant?.(touchEvent(0, 0, 10, { x: 0, y: 0 }));
    card.props.onResponderMove?.(touchEvent(dx, 0, 20, { x: 0, y: 0 }));
    card.props.onResponderRelease?.(touchEvent(dx, 0, 30, { x: dx, y: 0 }));
  });
}

describe('S10 Carte : geste et « réduire les animations »', () => {
  it('animations réduites : la carte part d’un coup (aucune animation lancée), le like est envoyé', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const spring = jest.spyOn(Animated, 'spring');
    const fake = installFakeApi({ ...deck(), 'POST /swipes': [201, { status: 'recorded', matched: false }] } as never);
    await renderShell(<DiscoverScreen />);
    const card = await screen.findByTestId('swipe-card');
    await dragCard(card as never, SWIPE_DISTANCE + 40);
    await waitFor(() => expect(fake.called('POST /swipes')).toHaveLength(1));
    expect(fake.called('POST /swipes')[0]?.body).toEqual({ target_id: 'p1', action: 'like' });
    expect(timing).not.toHaveBeenCalled();
    expect(spring).not.toHaveBeenCalled();
  });

  it('animations réduites : un geste trop court ramène la carte d’un coup, sans ressort', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const spring = jest.spyOn(Animated, 'spring');
    const fake = installFakeApi(deck());
    await renderShell(<DiscoverScreen />);
    const card = await screen.findByTestId('swipe-card');
    await dragCard(card as never, 40);
    expect(spring).not.toHaveBeenCalled();
    expect(fake.called('POST /swipes')).toHaveLength(0);
  });

  it('animations permises : même geste, sortie animée de `motion.duration.base` hors de l’écran, puis le like part', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    const fake = installFakeApi({ ...deck(), 'POST /swipes': [201, { status: 'recorded', matched: false }] } as never);
    await renderShell(<DiscoverScreen />);
    const card = await screen.findByTestId('swipe-card');
    // Laisse le réglage système (promesse) arriver jusqu'au composant avant le geste.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await dragCard(card as never, SWIPE_DISTANCE + 40);
    // Déterministe (ne dépend pas de l'horloge) : l'animation lancée porte la durée du jeton et sort la carte à droite.
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 180, toValue: expect.objectContaining({ x: 700 }) }));
    await waitFor(() => expect(fake.called('POST /swipes')).toHaveLength(1), { timeout: 3000 });
  });

  it('étiquette de la carte : nom, profil vérifié et intention ; la consigne de geste est dans l’indication', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /discover': [200, { data: [publicProfile('p1', 'Awa', { verified: true })], next_cursor: null }] } as never);
    await renderShell(<DiscoverScreen />);
    const card = await screen.findByTestId('swipe-card');
    expect(card.props.accessibilityLabel).toMatch(/^Awa, 28 ans\. Paris\. Profil vérifié\. /);
    expect(card.props.accessibilityLabel).not.toMatch(/Glissez|boutons/);
    expect(card.props.accessibilityHint).toMatch(/Glissez/);
    // Le badge est une icône, plus un caractère texte.
    expect(screen.queryByText(/✓/)).toBeNull();
    expect(screen.getByText('Profil vérifié')).toBeOnTheScreen();
  });
});

describe('S10 Carte : fondu prune lisible', () => {
  /** Contraste WCAG du blanc (texte) sur la couleur de marque mélangée à une photo blanche (pire cas) à l'opacité `alpha`. */
  function whiteOnScrim(alpha: number): number {
    const brand = [0x4b, 0x0f, 0x5b];
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = (rgb: number[]) => 0.2126 * channel(rgb[0]!) + 0.7152 * channel(rgb[1]!) + 0.0722 * channel(rgb[2]!);
    const blended = brand.map((v) => v * alpha + 255 * (1 - alpha));
    return (1 + 0.05) / (lum(blended) + 0.05);
  }

  it('le texte, jusqu’à 80 % de la hauteur du fondu (texte agrandi), reste à 4,5:1 au moins sur une photo blanche', () => {
    expect(colors.light.brand.toLowerCase()).toBe('#4b0f5b');
    for (const fraction of [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.8]) {
      const alpha = scrimAlphaAt(fraction);
      expect(alpha).toBeGreaterThanOrEqual(SCRIM_TEXT_MIN_ALPHA);
      expect(whiteOnScrim(alpha)).toBeGreaterThanOrEqual(4.5);
    }
    expect(scrimAlphaAt(1.01)).toBe(0);
  });
});

describe('S10 Découverte : chargement, erreur hors ligne et fin de pile', () => {
  it('chargement : un seul squelette en forme de carte, annoncé « Chargement »', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /discover': (() => new Promise(() => undefined)) as never } as never);
    await renderShell(<DiscoverScreen />);
    const loading = await screen.findByTestId('discover-loading');
    expect(loading.props.accessibilityLabel).toBe('Chargement');
    expect(screen.getAllByTestId('skeleton')).toHaveLength(1);
    expect(StyleSheet.flatten(screen.getAllByTestId('skeleton')[0]!.props.style).flex).toBe(1);
  });

  it('erreur réseau : titre « hors ligne », pictogramme et bouton Réessayer', async () => {
    installFakeApi({
      'GET /me': [200, ME],
      'GET /discover': (() => {
        throw new TypeError('Network request failed');
      }) as never,
    } as never);
    await renderShell(<DiscoverScreen />);
    expect(await screen.findByTestId('discover-error')).toBeOnTheScreen();
    expect(screen.getByTestId('async-error-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('async-retry')).toBeOnTheScreen();
  });

  it('fin de pile : pictogramme décoratif au-dessus du titre', async () => {
    installFakeApi(deck([]));
    await renderShell(<DiscoverScreen />);
    expect(await screen.findByText('Vous avez tout vu pour le moment')).toBeOnTheScreen();
    expect(screen.getByTestId('async-empty-icon', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('S10 Annuler : toujours disponible (le serveur annule le dernier choix, même d’une session précédente)', () => {
  it('actif au départ, inerte pendant une requête, actif de nouveau ensuite', async () => {
    installFakeApi({
      ...deck(),
      'POST /swipes': [201, { status: 'recorded', matched: false }],
      'POST /swipes/undo': [200, { target_id: 'p1' }],
      'GET /profiles/p1': [200, AWA],
    } as never);
    await renderShell(<DiscoverScreen />);
    await screen.findByLabelText(/Awa, 28 ans/);
    expect(screen.getByTestId('swipe-undo')).toBeEnabled();
    const u = user();
    await u.press(screen.getByTestId('swipe-dislike'));
    await screen.findByLabelText(/Binta, 31 ans/);
    await u.press(screen.getByTestId('swipe-undo'));
    expect(await screen.findByLabelText(/Awa, 28 ans/)).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByTestId('swipe-undo')).toBeEnabled());
  });

  it('pendant l’envoi, le bouton concerné montre l’attente et les autres sont inertes', async () => {
    let release: (value: [number, unknown]) => void = () => undefined;
    installFakeApi({
      ...deck(),
      'POST /swipes': (() => new Promise<[number, unknown]>((resolve) => (release = resolve))) as never,
    } as never);
    await renderShell(<DiscoverScreen />);
    await screen.findByLabelText(/Awa, 28 ans/);
    void user().press(screen.getByTestId('swipe-like'));
    await waitFor(() => expect(screen.getByTestId('swipe-like')).toBeBusy());
    expect(screen.getByTestId('swipe-dislike')).toBeDisabled();
    expect(screen.getByTestId('swipe-undo')).toBeDisabled();
    await act(async () => release([201, { status: 'recorded', matched: false }]));
    await waitFor(() => expect(screen.getByTestId('swipe-like')).not.toBeBusy());
  });
});

describe('S11 Menu du profil : en ligne, pas modal', () => {
  beforeEach(() => {
    mockParams.current = { id: 'p1' };
  });

  it('ne piège pas VoiceOver (aucun accessibilityViewIsModal) et ses lignes ont rôle bouton et libellé', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /profiles/p1': [200, AWA] } as never);
    await renderShell(<ProfileDetailScreen />);
    await screen.findByText('Awa, 28');
    await user().press(screen.getByTestId('detail-menu'));
    expect(screen.getByTestId('detail-menu')).toBeExpanded();
    const sheet = screen.getByTestId('detail-menu-sheet');
    expect(sheet.props.accessibilityViewIsModal).toBeUndefined();
    for (const testID of ['detail-write', 'detail-report', 'detail-block']) {
      expect(screen.getByTestId(testID).props.accessibilityRole).toBe('button');
    }
    // Le bouton « … » reste atteignable pour refermer le menu.
    await user().press(screen.getByTestId('detail-menu'));
    expect(screen.queryByTestId('detail-menu-sheet')).toBeNull();
  });

  it('galerie : photos annoncées comme images, couleurs non inversées', async () => {
    installFakeApi({ 'GET /me': [200, ME], 'GET /profiles/p1': [200, publicProfile('p1', 'Awa', { media: [media('a', 0), media('b', 1)] })] } as never);
    await renderShell(<ProfileDetailScreen />);
    await screen.findByText('Awa, 28');
    const photo = screen.getAllByLabelText(/Photo/)[0]!;
    expect(photo.props.accessibilityRole).toBe('image');
    expect(photo.props.accessibilityIgnoresInvertColors).toBe(true);
  });
});

describe('S12 Match : anneaux circulaires avec ou sans ma photo', () => {
  /** Style de l'anneau (bordure de 2 pt) qui entoure l'avatar `testID`. */
  function ringOf(testID: string) {
    let element: ReturnType<typeof screen.getByTestId> | null = screen.getByTestId(testID);
    for (let depth = 0; element && depth < 5; depth += 1) {
      const style = StyleSheet.flatten(element.props.style) as Record<string, number> | undefined;
      if (style?.borderWidth === 2) return style;
      element = element.parent;
    }
    return undefined;
  }

  it('rayon « pill » sur l’anneau de la photo seule (140 pt) comme sur les deux photos (112 pt)', async () => {
    mockParams.current = { name: 'Awa', photo: 'https://cdn.example.test/awa.jpg', conversationId: 'c9' };
    installFakeApi({ 'GET /me': [200, meFixture({ profile: selfProfile({ media: [] }) })] } as never);
    const { unmount } = await renderShell(<MatchScreen />);
    await screen.findByText('C’est un match !');
    expect(ringOf('match-avatar')?.borderRadius).toBe(999);
    unmount();

    installFakeApi({ 'GET /me': [200, ME] } as never);
    await renderShell(<MatchScreen />);
    await screen.findByText('C’est un match !');
    expect(ringOf('match-avatar-self')?.borderRadius).toBe(999);
    expect(ringOf('match-avatar')?.borderRadius).toBe(999);
  });

  it('le titre est annoncé (région vive) ; « Continuer » sans pile précédente remplace par la découverte', async () => {
    mockParams.current = { name: 'Awa', photo: '', conversationId: 'c9' };
    installFakeApi({ 'GET /me': [200, ME] } as never);
    await renderShell(<MatchScreen />);
    const title = await screen.findByText('C’est un match !');
    expect(title.props.accessibilityLiveRegion).toBe('polite');
    (router.canGoBack as jest.Mock).mockReturnValueOnce(false);
    await user().press(screen.getByTestId('match-continue'));
    expect(router.replace).toHaveBeenCalledWith('/discover');
  });
});

describe('S58 Signalement : retour après envoi', () => {
  it('sans écran précédent, on revient à la découverte au lieu de laisser le formulaire ouvert', async () => {
    mockParams.current = { reportedId: 'p1', name: 'Awa' };
    installFakeApi({ 'GET /me': [200, ME], 'POST /reports': [201, { id: 'r1', status: 'received' }] } as never);
    await renderShell(<ReportScreen />);
    const u = user();
    await u.press(screen.getByTestId('report-other'));
    (router.canGoBack as jest.Mock).mockReturnValueOnce(false);
    await u.press(screen.getByTestId('report-send'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/discover'));
    expect(router.back).not.toHaveBeenCalled();
  });
});
