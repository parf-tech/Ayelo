import React, { useId } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../../theme';

/** Cadre de dessin du décor ; `slice` le recadre pour couvrir tout l'écran, sans jamais le déformer. */
const VIEWBOX = { width: 390, height: 844 } as const;
/** Part de la hauteur occupée par la photographie quand elle existe ; un fondu la raccorde au fond prune. */
const HERO_HEIGHT_RATIO = 0.62;
const HERO_HEIGHT = `${HERO_HEIGHT_RATIO * 100}%` as const;

export type WelcomeBackdropProps = {
  /**
   * EMPLACEMENT POUR UNE PHOTOGRAPHIE SOUS LICENCE (aucune n'est livrée : aucune photo sous licence n'existe,
   * voir docs/design/04-handoff-analyse.md, section 2 et décision 4). Quand une source est fournie, elle couvre le haut
   * de l'écran (`cover`), un fondu du fond prune garde le texte lisible, et le dégradé reste par-dessus.
   * Sans source : dégradé seul, sans visage. Ne jamais brancher ici une image générée ou sans licence commerciale vérifiée.
   */
  heroImage?: ImageSourcePropType;
  /** Description de la photographie pour les lecteurs d'écran ; sans elle, l'image est décorative et masquée. */
  heroImageLabel?: string;
};

/**
 * Décor plein cadre de l'accueil, dessiné avec react-native-svg : lueurs douces (accent chaud en haut à droite, rose
 * en bas à gauche), un trait courbe et une vague en pied de page. Toutes les couleurs viennent des jetons
 * (`brand`, `primary`, `accent`) avec une opacité faible : le texte clair garde plus de 4,5:1 sur tout le décor.
 * Statique : aucune animation, donc rien à adapter à la réduction des animations.
 */
export function WelcomeBackdrop({ heroImage, heroImageLabel }: WelcomeBackdropProps) {
  const { colors } = useTheme();
  const uid = useId().replace(/\W/g, '');
  const id = (name: string) => `${uid}-${name}`;

  return (
    <View testID="welcome-backdrop-art" style={StyleSheet.absoluteFill}>
      {heroImage ? (
        <>
          <Image
            testID="welcome-hero-image"
            source={heroImage}
            resizeMode="cover"
            accessible={Boolean(heroImageLabel)}
            accessibilityLabel={heroImageLabel}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HERO_HEIGHT }}
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HERO_HEIGHT }}>
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={id('fade')} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.45" stopColor={colors.brand} stopOpacity={0} />
                  <Stop offset="1" stopColor={colors.brand} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id('fade')})`} />
            </Svg>
          </View>
        </>
      ) : null}
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <RadialGradient id={id('warm')} cx="330" cy="110" r="320" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.32} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={id('rose')} cx="30" cy="560" r="340" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.34} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={id('wave')} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.5} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0.5} />
          </LinearGradient>
          <LinearGradient id={id('arc')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.55} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0.1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} fill={`url(#${id('warm')})`} />
        <Rect x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} fill={`url(#${id('rose')})`} />
        <Path
          d="M-20 250 C 40 90, 230 40, 330 120 C 380 160, 400 230, 420 260"
          fill="none"
          stroke={`url(#${id('arc')})`}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M0 770 C 90 725, 190 805, 290 765 C 340 745, 370 735, 390 742 L390 844 L0 844 Z"
          fill={`url(#${id('wave')})`}
        />
      </Svg>
    </View>
  );
}
