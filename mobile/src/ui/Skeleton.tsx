import React, { useEffect, useState } from 'react';
import { Animated, DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { useI18n } from '../i18n';
import { stateOpacity, useTheme } from '../theme';
import { useReduceMotion } from './hooks';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  variant?: 'line' | 'card' | 'circle';
  testID?: string;
  /** Libellé lu seul (défaut : « Chargement »). Dans un groupe déjà libellé, le parent masque les briques. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Durée d'une demi-pulsation (ms). Aucun jeton `motion.pulse` n'existe encore : constante décorative, hors des durées d'interaction. */
const PULSE_MS = 800;
/** Dimensions par défaut d'une brique (pt) : cercle, carte, ligne. */
const DEFAULT_CIRCLE = 48;
const DEFAULT_CARD_HEIGHT = 160;
const DEFAULT_LINE_HEIGHT = 16;

/** Placeholder de chargement. Pulsation désactivée si « réduire les animations » est actif. */
export function Skeleton({ width, height, variant = 'line', testID, accessibilityLabel, style }: SkeletonProps) {
  const { colors, radius } = useTheme();
  const { t } = useI18n();
  const [opacity] = useState(() => new Animated.Value(1));
  // null = réglage système pas encore connu : on n'anime pas avant de savoir. Suit aussi un changement en cours d'utilisation.
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion !== false) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: stateOpacity.skeleton, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);

  const dims: ViewStyle =
    variant === 'circle'
      ? { width: width ?? DEFAULT_CIRCLE, height: height ?? DEFAULT_CIRCLE, borderRadius: radius.pill }
      : variant === 'card'
        ? { width: width ?? '100%', height: height ?? DEFAULT_CARD_HEIGHT, borderRadius: radius.lg }
        : { width: width ?? '100%', height: height ?? DEFAULT_LINE_HEIGHT, borderRadius: radius.sm };

  return (
    <Animated.View
      testID={testID ?? 'skeleton'}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? t('common.loading')}
      accessibilityState={{ busy: true }}
      style={[{ backgroundColor: colors.skeleton, opacity }, dims, style]}
    />
  );
}
