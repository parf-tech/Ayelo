import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../theme';
import type { ColorTokens } from '../theme/tokens';

export type TextVariant = 'title' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'label' | 'captionStrong';
export type TextTone = keyof Pick<
  ColorTokens,
  'text' | 'textMuted' | 'primary' | 'danger' | 'success' | 'warning' | 'onPrimary' | 'onAccent' | 'like' | 'dislike' | 'verified'
>;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  /** Titre de section pour les lecteurs d'écran. */
  header?: boolean;
  align?: 'left' | 'center' | 'right';
};

/** Texte typé par les tokens (taille, graisse, interligne, couleur). Redimensionnable par défaut. */
export function Text({ variant = 'body', tone = 'text', header, align, style, ...rest }: TextProps) {
  const { colors, type } = useTheme();
  const token = type[variant];
  return (
    <RNText
      accessibilityRole={header ? 'header' : rest.accessibilityRole}
      style={[
        {
          color: colors[tone],
          fontSize: token.size,
          fontWeight: token.weight,
          lineHeight: token.line,
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    />
  );
}
