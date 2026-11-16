import React from 'react';
import { View } from 'react-native';
import { borderWidth, iconSize, useTheme } from '../theme';
import type { ColorTokens } from '../theme/tokens';
import { ICON_REGISTRY, IconName } from './icons';

export type { IconName } from './icons';
export type IconSize = keyof typeof iconSize;
/** Rôles de couleur autorisés pour un trait d'icône (sous-ensemble de ColorTokens : une autre couleur ne compile pas). */
export type IconTone = keyof Pick<
  ColorTokens,
  | 'text'
  | 'textMuted'
  | 'primary'
  | 'onPrimary'
  | 'onAccent'
  | 'onBrand'
  | 'danger'
  | 'success'
  | 'warning'
  | 'verified'
  | 'like'
  | 'dislike'
  | 'disabledText'
>;

/**
 * Épaisseur du trait. Aucun jeton `iconStroke` n'existe encore dans design/tokens.json : on réutilise
 * `borderWidth.strong` (2, trait par défaut de Lucide) en attendant une demande de jeton.
 */
export const ICON_STROKE_WIDTH = borderWidth.strong;

export type IconProps = {
  name: IconName;
  /** Défaut `md` (jeton iconSize.md). */
  size?: IconSize;
  /** Rôle de couleur, défaut `text`. */
  tone?: IconTone;
  /** Remplit la forme avec la couleur du trait (cœur actif, étoile active). */
  filled?: boolean;
  /**
   * Icône qui porte du sens sans texte voisin. Par défaut l'icône est décorative et exclue de l'arbre
   * d'accessibilité ; avec une étiquette, elle devient une image accessible.
   */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Pictogramme du jeu Lucide (registre `ui/icons.ts`), à taille et couleur de jetons.
 * Décoratif par défaut : un libellé visible ou un `IconButton` accompagne toujours l'icône (R9).
 */
export function Icon({ name, size = 'md', tone = 'text', filled = false, accessibilityLabel, testID }: IconProps) {
  const { colors } = useTheme();
  const dimension = iconSize[size];
  const Glyph = (ICON_REGISTRY as Record<string, (typeof ICON_REGISTRY)[IconName] | undefined>)[name];
  if (!Glyph && __DEV__) throw new Error(`Icon : nom d'icône inconnu « ${String(name)} »`);

  const labelled = Boolean(accessibilityLabel);
  const color = colors[tone];
  const a11y = labelled
    ? ({ accessible: true, accessibilityRole: 'image', accessibilityLabel } as const)
    : ({
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      } as const);

  return (
    <View
      testID={testID ?? `icon-${name}`}
      pointerEvents="none"
      style={{ width: dimension, height: dimension, alignItems: 'center', justifyContent: 'center' }}
      {...a11y}
    >
      {Glyph ? (
        <Glyph color={color} size={dimension} strokeWidth={ICON_STROKE_WIDTH} fill={filled ? color : 'none'} />
      ) : null}
    </View>
  );
}
