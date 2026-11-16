import React, { useEffect } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useI18n } from '../i18n';
import { borderWidth, iconSize, MIN_TARGET, useTheme } from '../theme';
import type { ColorTokens } from '../theme/tokens';
import { announce } from './a11y/announce';
import { Icon, IconName } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';
import { useFocusRing } from './hooks/useFocusRing';

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
  /**
   * Annonce l'apparition (erreur, avertissement, succès) aux lecteurs d'écran iOS. Défaut vrai ; faux quand l'appelant
   * déplace déjà le focus sur la bannière (le message serait lu deux fois).
   */
  announceOnShow?: boolean;
} & DismissProps;

const ICONS: Record<BannerVariant, IconName> = {
  success: 'CircleCheck',
  error: 'CircleX',
  warning: 'TriangleAlert',
  info: 'Info',
};

/** Types dont l'apparition est annoncée aux lecteurs d'écran (iOS n'a pas de région vivante). `info` reste silencieux. */
const ANNOUNCED: readonly BannerVariant[] = ['error', 'warning', 'success'];

/** Clé de traduction du type, lue avant le message (« Erreur. Échec de l'envoi »). */
export function bannerTypeKey(variant: BannerVariant) {
  return `ui.banner.${variant}` as const;
}

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

/** Bouton d'action de la bannière : cible >= 44 pt, anneau de focus visible. */
function BannerAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { space } = useTheme();
  const { handlers, ringStyle } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      style={[{ minHeight: MIN_TARGET, minWidth: MIN_TARGET, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: space[2] }, ringStyle]}
    >
      <Text variant="bodyStrong" tone="primary">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Bannière en ligne (jamais bloquante). Le variant n'est pas porté par la couleur seule : pictogramme Lucide + texte,
 * et le lecteur d'écran lit le type avant le message (« Erreur. … »). L'apparition d'une erreur, d'un avertissement ou
 * d'un succès est annoncée (iOS), la région vivante couvre Android.
 */
export function Banner({
  message,
  variant = 'info',
  actionLabel,
  onAction,
  onDismiss,
  dismissLabel,
  testID,
  style,
  announceOnShow = true,
}: BannerProps) {
  const { colors, radius, space } = useTheme();
  const { t } = useI18n();
  const accent = accentFor(variant, colors);
  const spoken = `${t(bannerTypeKey(variant))}. ${message}`;

  useEffect(() => {
    if (announceOnShow && ANNOUNCED.includes(variant)) announce(spoken);
  }, [variant, spoken, announceOnShow]);

  return (
    <View
      testID={testID}
      accessibilityRole={variant === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={variant === 'error' ? 'assertive' : 'polite'}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space[2],
          padding: space[3],
          borderRadius: radius.md,
          borderWidth: borderWidth.hairline,
          // Barre d'état à gauche : 5 pt (4 + 1), jetons d'espacement et de trait.
          borderLeftWidth: space[1] + borderWidth.hairline,
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
          minWidth: iconSize.md + space[1] * 2,
          minHeight: iconSize.md + space[1] * 2,
          borderRadius: radius.pill,
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={ICONS[variant]} size="md" tone="onPrimary" testID={testID ? `${testID}-icon` : 'banner-icon'} />
      </View>
      {/* Message puis action en colonne : une action longue passe SOUS le texte au lieu de l'écraser (spec 6.6, AC-BAN-8). */}
      <View style={{ flex: 1, gap: space[1], paddingTop: space[1] }}>
        <Text variant="body" accessibilityLabel={spoken}>
          {message}
        </Text>
        {actionLabel && onAction ? <BannerAction label={actionLabel} onPress={onAction} /> : null}
      </View>
      {onDismiss ? (
        <IconButton
          icon="X"
          accessibilityLabel={dismissLabel}
          onPress={onDismiss}
          testID={testID ? `${testID}-dismiss` : undefined}
        />
      ) : null}
    </View>
  );
}
