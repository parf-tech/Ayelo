import { AccessibilityInfo, Platform } from 'react-native';

/** Délai pendant lequel un même message n'est pas annoncé deux fois. */
export const ANNOUNCE_DEBOUNCE_MS = 500;

let lastMessage = '';
let lastAt = 0;

/**
 * Annonce un changement d'état aux lecteurs d'écran (spec 03-composants, R7).
 * iOS : `announceForAccessibility`. Android : rien, `accessibilityLiveRegion` suffit et évite la double lecture.
 * Les chaînes vides sont ignorées ; un même message n'est pas répété avant 500 ms.
 */
export function announce(message: string): void {
  const text = message.trim();
  if (!text || Platform.OS !== 'ios') return;
  const now = Date.now();
  if (text === lastMessage && now - lastAt < ANNOUNCE_DEBOUNCE_MS) return;
  lastMessage = text;
  lastAt = now;
  AccessibilityInfo.announceForAccessibility(text);
}

/** Réinitialise l'antirebond (tests). */
export function resetAnnounceDebounce(): void {
  lastMessage = '';
  lastAt = 0;
}
