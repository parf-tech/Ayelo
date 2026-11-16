import React from 'react';
import { StyleSheet, Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { fontFamilyFor, useFontsReady, useTheme } from '../theme';
import type { ColorTokens } from '../theme/tokens';

export type TextVariant = 'title' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'label' | 'captionStrong';
export type TextTone = keyof Pick<
  ColorTokens,
  'text' | 'textMuted' | 'primary' | 'danger' | 'success' | 'warning' | 'onPrimary' | 'onAccent' | 'onBrand' | 'like' | 'dislike' | 'verified'
>;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  /** Titre de section pour les lecteurs d'écran. */
  header?: boolean;
  align?: 'left' | 'center' | 'right';
};

/**
 * Texte typé par les tokens (taille, graisse, interligne, couleur). Redimensionnable par défaut.
 * Police : une fois Poppins chargée, la famille est choisie d'après la graisse (celle de la variante, ou le
 * `fontWeight` passé en style) car React Native ne synthétise pas les graisses d'une police personnalisée.
 * Avant chargement (ou si le chargement échoue) : police du système avec `fontWeight`.
 */
export function Text({ variant = 'body', tone = 'text', header, align, style, ...rest }: TextProps) {
  const { colors, type } = useTheme();
  const fontsReady = useFontsReady();
  const token = type[variant];
  const { fontWeight, ...flat }: TextStyle = StyleSheet.flatten(style) ?? {};
  const weight = fontWeight ?? token.weight;
  const font: TextStyle = fontsReady ? { fontFamily: fontFamilyFor(weight) } : { fontWeight: weight };
  return (
    <RNText
      {...rest}
      // Après `rest` : un titre reste un titre même si un rôle explicite est passé ; hors titre, le rôle explicite s'applique.
      accessibilityRole={header ? 'header' : rest.accessibilityRole}
      style={[
        {
          color: colors[tone],
          fontSize: token.size,
          lineHeight: token.line,
          textAlign: align,
        },
        font,
        flat,
      ]}
    />
  );
}
