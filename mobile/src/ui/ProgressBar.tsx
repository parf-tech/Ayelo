import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';

export type ProgressBarProps = {
  /** Étape en cours (1..total). */
  current: number;
  total: number;
  /** Texte lu par les lecteurs d'écran, ex. « Étape 1 sur 2 ». */
  label: string;
  testID?: string;
};

/** Barre de progression d'onboarding. */
export function ProgressBar({ current, total, label, testID }: ProgressBarProps) {
  const { colors, radius } = useTheme();
  const ratio = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: current }}
      style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' }}
    >
      <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: colors.primary }} />
    </View>
  );
}
