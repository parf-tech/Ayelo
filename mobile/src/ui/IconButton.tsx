import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { borderWidth, iconSize, MIN_TARGET, stateOpacity, useTheme } from '../theme';
import { Icon, IconName, IconTone } from './Icon';
import { Text } from './Text';
import { useFocusRing } from './hooks/useFocusRing';

export type IconButtonVariant = 'plain' | 'tonal' | 'filled' | 'danger';
export type IconButtonSize = 'md' | 'lg';

export type IconButtonBadge =
  | { kind: 'dot' }
  | { kind: 'count'; count: number; accessibilityLabel: string };

export type IconButtonProps = {
  icon: IconName;
  /** Obligatoire : le nom de l'action (« Fermer »), jamais celui du dessin (« croix »). Non vide. */
  accessibilityLabel: string;
  onPress: () => void;
  /** Défaut `plain`. */
  variant?: IconButtonVariant;
  /** `md` : icône 20 dans une cible de 44 ; `lg` : icône 24 dans une cible de 48. Défaut `md`. */
  size?: IconButtonSize;
  /** Bouton basculé (favori, filtre actif) : trait plein, fond surface, état `selected`. */
  selected?: boolean;
  /** Bouton qui ouvre un menu : état `expanded`. */
  expanded?: boolean;
  loading?: boolean;
  disabled?: boolean;
  badge?: IconButtonBadge;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Plafond d'agrandissement du chiffre de la pastille (spec R2). */
const BADGE_MAX_FONT_MULTIPLIER = 1.6;
const BADGE_MAX_COUNT = 99;

/**
 * Bouton d'icône sans texte visible. Cible >= 44 pt sans hitSlop, états appuyé, focus, désactivé, chargement
 * et basculé issus des jetons. Aucun retour haptique.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  size = 'md',
  selected,
  expanded,
  loading = false,
  disabled = false,
  badge,
  accessibilityHint,
  testID,
  style,
}: IconButtonProps) {
  const { colors, radius, space } = useTheme();
  const { handlers, ringStyle } = useFocusRing();

  if (!accessibilityLabel.trim() && __DEV__) {
    throw new Error('IconButton : accessibilityLabel est obligatoire et ne peut pas être vide');
  }

  const id = testID ?? `icon-button-${icon}`;
  const inactive = disabled || loading;
  const target = size === 'lg' ? MIN_TARGET + 4 : MIN_TARGET;
  const glyphSize = size === 'lg' ? 'lg' : 'md';

  const solid = variant === 'filled' || variant === 'tonal';
  let backgroundColor: string = 'transparent';
  let tone: IconTone = variant === 'danger' ? 'danger' : 'text';
  let borderColor: string = 'transparent';
  if (variant === 'filled') {
    backgroundColor = colors.primary;
    tone = 'onPrimary';
  } else if (variant === 'tonal') {
    backgroundColor = colors.surface;
    borderColor = colors.borderStrong;
  }
  if (selected) backgroundColor = colors.surface;
  if (disabled && solid) {
    backgroundColor = colors.disabledBg;
    tone = 'disabledText';
    borderColor = 'transparent';
  }

  const label =
    badge?.kind === 'count' && badge.accessibilityLabel
      ? `${accessibilityLabel}, ${badge.accessibilityLabel}`
      : accessibilityLabel;

  const accessibilityState = {
    disabled: inactive,
    busy: loading,
    ...(selected === undefined ? null : { selected }),
    ...(expanded === undefined ? null : { expanded }),
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      disabled={inactive}
      onPress={onPress}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      testID={id}
      style={({ pressed }) => [
        {
          minHeight: target,
          minWidth: target,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: solid || selected ? radius.pill : radius.sm,
          borderWidth: borderColor === 'transparent' ? 0 : borderWidth.hairline,
          borderColor,
          backgroundColor,
          opacity: disabled && !solid ? stateOpacity.disabled : pressed && !inactive ? stateOpacity.pressed : 1,
        },
        ringStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          testID={`${id}-spinner`}
          size={iconSize[glyphSize]}
          color={colors[tone]}
        />
      ) : (
        <Icon name={icon} size={glyphSize} tone={tone} filled={Boolean(selected)} testID={`${id}-icon`} />
      )}
      {badge ? (
        <View
          testID={`${id}-badge`}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            {
              position: 'absolute',
              top: space[1],
              right: space[1],
              backgroundColor: colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              borderWidth: borderWidth.strong,
              borderColor: colors.bg,
            },
            badge.kind === 'dot'
              ? { width: space[2] + borderWidth.strong * 2, height: space[2] + borderWidth.strong * 2 }
              : { minWidth: space[4] + borderWidth.strong * 2, paddingHorizontal: space[1] },
          ]}
        >
          {badge.kind === 'count' ? (
            <Text variant="captionStrong" tone="onPrimary" maxFontSizeMultiplier={BADGE_MAX_FONT_MULTIPLIER}>
              {badge.count > BADGE_MAX_COUNT ? `${BADGE_MAX_COUNT}+` : String(badge.count)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
