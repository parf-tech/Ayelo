import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  variant?: 'line' | 'card' | 'circle';
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Placeholder de chargement. Pulsation désactivée si « réduire les animations » est actif. */
export function Skeleton({ width, height, variant = 'line', testID, style }: SkeletonProps) {
  const { colors, radius } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);

  const dims: ViewStyle =
    variant === 'circle'
      ? { width: width ?? 48, height: height ?? 48, borderRadius: radius.pill }
      : variant === 'card'
        ? { width: width ?? '100%', height: height ?? 160, borderRadius: radius.lg }
        : { width: width ?? '100%', height: height ?? 16, borderRadius: radius.sm };

  return (
    <Animated.View
      testID={testID ?? 'skeleton'}
      accessible
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={[{ backgroundColor: colors.skeleton, opacity }, dims, style]}
    />
  );
}
