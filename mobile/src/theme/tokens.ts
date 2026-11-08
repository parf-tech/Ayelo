// Fichier généré, ne pas modifier.
// Source unique : design/tokens.json. Générateur : design/build-tokens.mjs (npm run tokens, depuis mobile/).
// Direction active : B (Lagune). Pour changer de direction, modifier activeDirection dans tokens.json.
// Seul fichier de mobile/ autorisé à contenir des valeurs de couleur (test __tests__/theme.test.ts).

export type ColorTokens = {
  /** Mise en avant douce (match, plan choisi). Ne porte jamais seule une information ; le texte onAccent porte le sens. */
  accent: string;
  /** Fond d'écran. */
  bg: string;
  /** Séparateur décoratif (non exigé à 3:1, WCAG 1.4.11). */
  border: string;
  /** Contour de composant (champ, case, piste d'interrupteur) : >= 3:1 (WCAG 1.4.11). `border` reste pour les séparateurs décoratifs. */
  borderStrong: string;
  /** Erreur, action destructrice. */
  danger: string;
  /** Fond d'un composant désactivé. */
  disabledBg: string;
  /** Texte d'un composant désactivé (reste lisible à 4,5:1). */
  disabledText: string;
  /** Refus (texte, contour, glyphe). Le bouton « Passer » utilise passNeutral. */
  dislike: string;
  /** Anneau de focus, 2 pt. */
  focusRing: string;
  /** Information (bandeau, lien d'aide). Égal à verified dans les trois directions. */
  info: string;
  /** J'aime (texte, contour, glyphe). */
  like: string;
  /** Texte et glyphes sur accent. */
  onAccent: string;
  /** Texte et glyphes sur primary (et sur danger). */
  onPrimary: string;
  /** Teinte opaque de fond de modale ; préférer scrim. */
  overlay: string;
  /** Bouton « Passer » neutre : ni rouge ni vert (principe 2, daltonisme). */
  passNeutral: string;
  /** Action principale (fond), lien (texte), bulle envoyée. */
  primary: string;
  /** Voile semi-transparent derrière une modale ou une feuille (hexadécimal à 8 chiffres, alpha à la fin). */
  scrim: string;
  /** Fond des squelettes et des substituts de photo. */
  skeleton: string;
  /** Succès. */
  success: string;
  /** Cartes, champs, bulles reçues. */
  surface: string;
  /** Texte principal. */
  text: string;
  /** Texte secondaire, aides, onglets inactifs. */
  textMuted: string;
  /** Badge vérifié. */
  verified: string;
  /** Avertissement (alerte anti-arnaque contextuelle). */
  warning: string;
};

export const direction = { id: 'B', name: 'Lagune' } as const;

export const colors: { light: ColorTokens; dark: ColorTokens } = {
  light: {
    accent: '#E3A92B',
    bg: '#FBFAF6',
    border: '#D4DFDB',
    borderStrong: '#677C79',
    danger: '#B3261E',
    disabledBg: '#D4DFDB',
    disabledText: '#465856',
    dislike: '#B3261E',
    focusRing: '#0B6468',
    info: '#3446C4',
    like: '#17703B',
    onAccent: '#1A1405',
    onPrimary: '#FFFFFF',
    overlay: '#12201F',
    passNeutral: '#465856',
    primary: '#0B6468',
    scrim: '#12201F80',
    skeleton: '#D4DFDB',
    success: '#17703B',
    surface: '#EDF3F0',
    text: '#12201F',
    textMuted: '#465856',
    verified: '#3446C4',
    warning: '#8A5A00',
  },
  dark: {
    accent: '#F0BE55',
    bg: '#0B1413',
    border: '#243735',
    borderStrong: '#7C9692',
    danger: '#FF8A80',
    disabledBg: '#243735',
    disabledText: '#9FB6B2',
    dislike: '#FF8A80',
    focusRing: '#4FC9C4',
    info: '#8FA6FF',
    like: '#5AD98A',
    onAccent: '#1A1405',
    onPrimary: '#06201F',
    overlay: '#000000',
    passNeutral: '#9FB6B2',
    primary: '#4FC9C4',
    scrim: '#00000099',
    skeleton: '#243735',
    success: '#5AD98A',
    surface: '#142120',
    text: '#E9F2F0',
    textMuted: '#9FB6B2',
    verified: '#8FA6FF',
    warning: '#F0BE55',
  },
};

export const space = [0, 4, 8, 12, 16, 24, 32, 48] as const;

export const radius = { sm: 10, md: 16, lg: 28, pill: 999 } as const;

export const borderWidth = { hairline: 1, strong: 2 } as const;

export type TypeToken = {
  size: number;
  weight: '400' | '500' | '600' | '700';
  line: number;
};

export type TypeVariant = 'title' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'label' | 'captionStrong';

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;

export const type: Record<TypeVariant, TypeToken> = {
  /** Titre d'écran. */
  title: { size: 28, weight: '700', line: 34 },
  /** Titre de section. */
  h2: { size: 22, weight: '600', line: 28 },
  /** Sous-titre. */
  h3: { size: 18, weight: '600', line: 24 },
  /** Texte courant. */
  body: { size: 16, weight: '400', line: 24 },
  /** Texte juridique et mentions obligatoires (renouvellement, consentements). */
  bodySmall: { size: 14, weight: '400', line: 20 },
  /** Légende, aide, horodatage. */
  caption: { size: 13, weight: '400', line: 18 },
  /** Étiquette de champ et de contrôle. */
  label: { size: 14, weight: '500', line: 20 },
  /** Légende appuyée (statut, badge). */
  captionStrong: { size: 13, weight: '600', line: 18 },
};

/** Taille minimale d'une cible tactile (docs/06 : >= 44 pt). */
export const MIN_TARGET = 44;

/** Largeur maximale du contenu (tablettes : mise en page centrée). */
export const MAX_CONTENT_WIDTH = 560;

export type ElevationToken = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  /** Ombre Android. */
  elevation: number;
};

/** Niveaux d'élévation : 0 au repos, 1 à 3 pour les éléments flottants (toast, feuille, dialogue). */
export const elevation: Record<0 | 1 | 2 | 3, ElevationToken> = {
  0: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  1: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  2: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  3: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
};

/** Mouvement : durées en ms, courbes de Bézier (x1, y1, x2, y2). */
export const motion = {
  duration: { fast: 120, base: 180, slow: 300 },
  easing: { standard: [0.2, 0, 0, 1], enter: [0, 0, 0, 1], exit: [0.3, 0, 1, 1] },
} as const;

/** Si le système demande de réduire les animations : plus de translation, d'échelle ni de rebond ; un fondu seul est permis et sa durée est plafonnée. */
export const reduceMotion = { transform: 'none', fadeOnly: true, maxDurationMs: 120 } as const;

export const zIndex = { base: 0, raised: 10, sticky: 100, overlay: 200, modal: 300, toast: 400 } as const;

/** Anneau de focus : épaisseur et décalage en pt, couleur = jeton de couleur. */
export const focus = { width: 2, offset: 2, color: 'focusRing' } as const;

/** Opacités d'état. */
export const stateOpacity = { pressed: 0.8, hover: 0.92, disabled: 0.4, skeleton: 0.45 } as const;

/** Tailles d'icône en pt. */
export const iconSize = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

/** Zone de toucher étendue autour d'un petit glyphe (pt de chaque côté). */
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
