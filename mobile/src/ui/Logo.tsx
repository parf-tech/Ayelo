import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import {
  ART_COLORS,
  DOTS,
  DOT_HEIGHT,
  GRADIENTS,
  GRADIENT_OF,
  GradientName,
  HEART_STROKE_WIDTH,
  LogoVariant,
  isOnBrandVariant,
  PATHS,
  SYMBOL_RATIO,
  SYMBOL_VIEWBOX,
  WORDMARK,
} from './brandArt';
import { Text } from './Text';

export type { LogoVariant };
export type LogoLayout = 'symbol' | 'horizontal';

export type LogoProps = {
  /** Couleur : fond clair ou sombre (mot-symbole suit le texte). Blanc : sur fond de marque. Mono : une seule couleur d'encre. */
  variant?: LogoVariant;
  /** `symbol` : les deux bulles seules (petites tailles). `horizontal` : symbole + mot-symbole. */
  layout?: LogoLayout;
  /** Hauteur en pt. La largeur du symbole en découle (rapport du cadre, jamais étiré). */
  size?: number;
  accessibilityLabel?: string;
  testID?: string;
};

const GRADIENT_NAMES = Object.keys(GRADIENTS) as GradientName[];

/** Ligne de base de la police dans une ligne de 1,4 em (ascendante 1,05 em) : 0,35 em sous le centre de la ligne. */
const BASELINE_BELOW_CENTER = 0.35;

/**
 * Logo Ayelo : deux bulles qui forment un cœur, trois points. Dessin repris du kit d'identité (src/ui/brandArt.ts) ;
 * le mot-symbole est du vrai texte (composant Text, Poppins Bold, couleur par jeton), pas du texte SVG.
 *
 * Les fichiers blanc et monochrome du kit référencent des dégradés qu'ils ne définissent pas : le rendu y serait
 * vide. La version blanche reprend donc les dégradés du maître (comme l'intention du fichier blanc), et la mono est
 * redessinée en une seule couleur d'encre (bulle avant pleine, cœur évidé par un masque, bulle arrière atténuée).
 */
export function Logo({ variant = 'color', layout = 'symbol', size = 48, accessibilityLabel, testID }: LogoProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const uid = useId().replace(/\W/g, '');
  const gid = (name: string) => `${uid}-${name}`;
  const width = size * SYMBOL_RATIO;
  const label = accessibilityLabel ?? t('brand.logoLabel');
  const mono = variant === 'mono';
  const onBrand = isOnBrandVariant(variant);
  const ink = colors.text;
  const wordColor = onBrand ? colors.onBrand : colors.text;
  const { x, y, width: vw, height: vh } = SYMBOL_VIEWBOX;
  const k = size / vh;
  const fontSize = WORDMARK.fontSize * k;
  // Centre de la ligne de texte au centre du cadre (y = vh / 2) : la ligne de base tombe 0,35 em plus bas ;
  // on la remonte à la ligne de base du maître (y = 220 sur 350).
  const shiftY = (WORDMARK.baseline - vh / 2) * k - BASELINE_BELOW_CENTER * fontSize;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID}
      style={{ flexDirection: 'row', alignItems: 'center', height: size }}
    >
      <Svg
        testID={testID ? `${testID}-symbol` : undefined}
        width={width}
        height={size}
        viewBox={`${x} ${y} ${vw} ${vh}`}
      >
        <Defs>
          {mono ? (
            <Mask id={gid('cut')} x={x} y={y} width={vw} height={vh} maskUnits="userSpaceOnUse">
              <Rect x={x} y={y} width={vw} height={vh} fill={ART_COLORS.maskShow} />
              <Path d={PATHS.heart} fill={ART_COLORS.maskHide} />
            </Mask>
          ) : (
            GRADIENT_NAMES.map((name) => (
              <LinearGradient key={name} id={gid(name)} x1="0" y1="0" x2="1" y2="1">
                {GRADIENTS[name].map((s) => (
                  <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
                ))}
              </LinearGradient>
            ))
          )}
        </Defs>
        {mono ? (
          <G>
            <Path d={PATHS.backBubble} fill={ink} fillOpacity={0.35} />
            <Path d={PATHS.frontBubble} fill={ink} mask={`url(#${gid('cut')})`} />
            {DOTS.map((d) => (
              <Circle key={d.cx} cx={d.cx} cy={d.cy} r={d.r} fill={ink} />
            ))}
          </G>
        ) : (
          <G>
            <Path d={PATHS.backBubble} fill={`url(#${gid(GRADIENT_OF.back)})`} />
            <Path d={PATHS.frontBubble} fill={`url(#${gid(GRADIENT_OF.front)})`} />
            <Path
              d={PATHS.heart}
              fill={`url(#${gid(GRADIENT_OF.heart)})`}
              stroke={onBrand ? ART_COLORS.heartStrokeWhite : ART_COLORS.heartStrokeColor}
              strokeWidth={HEART_STROKE_WIDTH}
              strokeLinejoin="round"
            />
            {DOTS.map((d) => (
              <Circle key={d.cx} cx={d.cx} cy={d.cy} r={d.r} fill={ART_COLORS.dot} />
            ))}
          </G>
        )}
      </Svg>
      {layout === 'horizontal' ? (
        <Text
          variant="title"
          accessible={false}
          importantForAccessibility="no"
          allowFontScaling={false}
          numberOfLines={1}
          testID={testID ? `${testID}-wordmark` : undefined}
          style={{
            color: wordColor,
            fontWeight: '700',
            fontSize,
            lineHeight: fontSize * 1.4,
            letterSpacing: fontSize * (WORDMARK.letterSpacing / WORDMARK.fontSize),
            includeFontPadding: false,
            // Zone de protection à droite : au moins la hauteur des trois points (charte).
            marginEnd: DOT_HEIGHT * k,
            transform: [{ translateY: shiftY }],
          }}
        >
          Ayelo
        </Text>
      ) : null}
    </View>
  );
}
