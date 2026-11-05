import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { MIN_TARGET, useTheme } from '../theme';
import type { ColorTokens } from '../theme/tokens';
import { Text } from './Text';

export type BannerVariant = 'success' | 'error' | 'warning' | 'info';

type DismissProps =
  | { onDismiss: () => void; dismissLabel: string }
  | { onDismiss?: undefined; dismissLabel?: undefined };

export type BannerProps = {
  message: string;
  variant?: BannerVariant;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
} & DismissProps;

const GLYPHS: Record<BannerVariant, string> = { success: '✓', error: '✕', warning: '!', info: 'i' };

function accentFor(variant: BannerVariant, colors: ColorTokens): string {
  switch (variant) {
    case 'success':
      return colors.success;
    case 'error':
      return colors.danger;
    case 'warning':
      return colors.warning;
    case 'info':
    default:
      return colors.verified;
  }
}

/** Bannière en ligne (jamais bloquante). Le variant n'est pas porté par la couleur seule : glyphe + texte. */
export function Banner({
  message,
  variant = 'info',
  actionLabel,
  onAction,
  onDismiss,
  dismissLabel,
  testID,
  style,
}: BannerProps) {
  const { colors, radius, space } = useTheme();
  const accent = accentFor(variant, colors);

  return (
    <View
      testID={testID}
      accessibilityRole={variant === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={variant === 'error' ? 'assertive' : 'polite'}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          padding: space[3],
          borderRadius: radius.md,
          borderWidth: 1,
          borderLeftWidth: 5,
          borderColor: accent,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.pill,
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: space[3],
        }}
      >
        <Text variant="caption" tone="onPrimary" style={{ fontWeight: '700', lineHeight: 16 }}>
          {GLYPHS[variant]}
        </Text>
      </View>
      <Text variant="body" style={{ flex: 1 }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={{ minHeight: MIN_TARGET, minWidth: MIN_TARGET, justifyContent: 'center', paddingHorizontal: space[2] }}
        >
          <Text variant="body" tone="primary" style={{ fontWeight: '600' }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onDismiss}
          style={{ minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text variant="body" tone="textMuted" aria-hidden>
            ✕
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
