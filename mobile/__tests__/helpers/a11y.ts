import { AccessibilityInfo, Dimensions, PixelRatio, ScaledSize } from 'react-native';

/** Aides de test d'accessibilité (spec 03-composants, 2.1). Les spies sont restaurés par `jest.restoreAllMocks()`. */

export function mockScreenReader(enabled: boolean) {
  return jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(enabled);
}

export function mockReduceMotion(enabled: boolean) {
  return jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(enabled);
}

/** Simule la taille de la fenêtre (useWindowDimensions lit Dimensions.get('window')). */
export function mockWindow(width: number, height: number, fontScale = 1) {
  const size: ScaledSize = { width, height, scale: 2, fontScale };
  jest.spyOn(Dimensions, 'get').mockImplementation(() => size);
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(fontScale);
}

/** Simule l'agrandissement du texte sans changer la largeur (390 x 844 par défaut). */
export function mockFontScale(fontScale: number, width = 390, height = 844) {
  mockWindow(width, height, fontScale);
}

export function spyAnnounce() {
  return jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
}
