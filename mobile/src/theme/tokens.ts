// Tokens du design system (docs/07-DESIGN-SYSTEM.md). Palette provisoire : la marque n'est pas définie.
// Seul fichier autorisé à contenir des valeurs de couleur (test __tests__/no-hardcoded-colors.test.ts).

export type ColorTokens = {
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  like: string;
  dislike: string;
  verified: string;
  border: string;
  /** Contour de composant (champ, case, piste d'interrupteur) : >= 3:1 (WCAG 1.4.11). `border` reste pour les séparateurs décoratifs. */
  borderStrong: string;
  danger: string;
  warning: string;
  success: string;
  // Extensions techniques (états de composants).
  disabledBg: string;
  disabledText: string;
  skeleton: string;
  overlay: string;
};

export const colors: { light: ColorTokens; dark: ColorTokens } = {
  light: {
    bg: '#FFFFFF',
    surface: '#F6F4F2',
    text: '#1B1A19',
    textMuted: '#5E5A56',
    primary: '#C2410C',
    onPrimary: '#FFFFFF',
    like: '#16A34A',
    dislike: '#DC2626',
    verified: '#2563EB',
    border: '#E4E0DC',
    borderStrong: '#85807B',
    danger: '#B91C1C',
    warning: '#B45309',
    success: '#15803D',
    disabledBg: '#E4E0DC',
    disabledText: '#5E5A56',
    skeleton: '#E4E0DC',
    overlay: '#1B1A19',
  },
  dark: {
    bg: '#121110',
    surface: '#1E1C1A',
    text: '#F3F1EE',
    textMuted: '#A8A29E',
    primary: '#FB923C',
    onPrimary: '#1B1A19',
    like: '#4ADE80',
    dislike: '#F87171',
    verified: '#60A5FA',
    border: '#3A3633',
    borderStrong: '#7F7973',
    danger: '#F87171',
    warning: '#FBBF24',
    success: '#4ADE80',
    disabledBg: '#3A3633',
    disabledText: '#A8A29E',
    skeleton: '#3A3633',
    overlay: '#000000',
  },
};

export const space = [0, 4, 8, 12, 16, 24, 32, 48] as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export type TypeToken = {
  size: number;
  weight: '400' | '600' | '700';
  line: number;
};

export const type: Record<'title' | 'h2' | 'body' | 'bodySmall' | 'caption', TypeToken> = {
  title: { size: 28, weight: '700', line: 34 },
  h2: { size: 22, weight: '600', line: 28 },
  body: { size: 16, weight: '400', line: 22 },
  // 14/20 : texte juridique et mentions obligatoires (renouvellement d'abonnement, consentements).
  bodySmall: { size: 14, weight: '400', line: 20 },
  caption: { size: 13, weight: '400', line: 18 },
};

/** Taille minimale d'une cible tactile (docs/06 : >= 44 pt). */
export const MIN_TARGET = 44;

/** Largeur maximale du contenu (tablettes : mise en page centrée). */
export const MAX_CONTENT_WIDTH = 560;
