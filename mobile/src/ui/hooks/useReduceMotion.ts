import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Réglage système « réduire les animations », suivi en direct.
 * Renvoie `null` tant que le réglage est inconnu : on n'anime pas avant de savoir.
 */
export function useReduceMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then((enabled) => {
        if (mounted) setReduced(Boolean(enabled));
      })
      .catch(() => {
        if (mounted) setReduced(true);
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (mounted) setReduced(Boolean(enabled));
    });
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}
