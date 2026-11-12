/**
 * ARTWORK DE MARQUE : seul fichier de src/ avec des couleurs en dur, hors src/theme/tokens.ts.
 *
 * Origine : kit d'identité officiel (mobile/assets/brand/ayelo-symbole.svg et ayelo-logo.svg, maître vectoriel
 * du kit, 1400 x 420). Les dégradés et les couleurs du dessin font partie du logo : ce ne sont pas des jetons
 * d'interface et ils ne changent pas avec la direction de design ni avec le mode sombre.
 * Statut : dessin provisoire. La vérification juridique du nom et du logo (antériorités) est en attente
 * (voir docs/design/04-handoff-analyse.md et docs/design/brand/charte_ayelo.txt).
 *
 * Exemption ciblée : __tests__/theme.test.ts ignore exactement ce fichier ; ESLint n'a pas de règle de couleur.
 * Les tracés ci-dessous viennent du kit sans modification ; ils ne contiennent ni script ni référence externe
 * (uniquement des commandes M, C, L, Z).
 */

/** Cadre du symbole (ayelo-symbole.svg) : « 40 0 390 350 ». Les marges (>= 25 unités) valent au moins la hauteur des trois points (20). */
export const SYMBOL_VIEWBOX = { x: 40, y: 0, width: 390, height: 350 } as const;

/** Rapport largeur / hauteur du symbole ; ne jamais l'étirer (charte). */
export const SYMBOL_RATIO = SYMBOL_VIEWBOX.width / SYMBOL_VIEWBOX.height;

/** Maître horizontal : corps du mot-symbole 174, ligne de base y = 220, crénage -8, graisse 700 (ayelo-logo.svg). */
export const WORDMARK = { fontSize: 174, baseline: 220, letterSpacing: -8, startX: 430 } as const;

/** Hauteur des trois points (diamètre), base de la zone de protection de la charte. */
export const DOT_HEIGHT = 20;

export const GRADIENTS = {
  warm: [
    { offset: 0, color: '#FFB21A' },
    { offset: 0.55, color: '#FF713D' },
    { offset: 1, color: '#F01883' },
  ],
  pink: [
    { offset: 0, color: '#FF168C' },
    { offset: 1, color: '#B90072' },
  ],
  inner: [
    { offset: 0, color: '#6D0A63' },
    { offset: 1, color: '#3E0B4F' },
  ],
} as const;

export type GradientName = keyof typeof GRADIENTS;

/** Dégradé de chaque forme. */
export const GRADIENT_OF = { back: 'warm', front: 'pink', heart: 'inner' } as const satisfies Record<string, GradientName>;

/** Variantes du logo : couleur, blanc (sur fond de marque), monochrome (une seule encre). */
export type LogoVariant = 'color' | 'white' | 'mono';

export const LOGO_VARIANTS: readonly LogoVariant[] = ['color', 'white', 'mono'];

/** Vrai pour la variante destinée aux fonds de marque. */
export const isOnBrandVariant = (variant: LogoVariant): boolean => variant === 'white';

export const PATHS = {
  /** Bulle arrière : conversation chaleureuse. */
  backBubble:
    'M72 150 C72 76 132 25 207 25 C258 25 301 52 327 93 C350 129 348 173 327 207 C307 239 273 258 232 260 L173 315 L178 249 C112 231 72 198 72 150Z',
  /** Bulle avant. */
  frontBubble:
    'M157 159 C157 91 207 48 270 48 C316 48 353 71 377 107 C401 143 396 185 371 216 C348 245 310 259 267 260 L218 315 L222 252 C181 233 157 201 157 159Z',
  /** Noyau en forme de cœur. */
  heart:
    'M270 105 C247 75 199 82 187 119 C175 157 205 184 270 231 C335 184 365 157 353 119 C341 82 293 75 270 105Z',
} as const;

export const HEART_STROKE_WIDTH = 10;

/** Trois points blancs : le premier échange. */
export const DOTS = [
  { cx: 225, cy: 151, r: 10 },
  { cx: 270, cy: 151, r: 10 },
  { cx: 315, cy: 151, r: 10 },
] as const;

/** Couleurs fixes du dessin (versions couleur et blanche du kit). */
export const ART_COLORS = {
  dot: '#FFFFFF',
  /** Contour du cœur, version couleur. */
  heartStrokeColor: '#FFFFFF',
  /** Contour du cœur, version blanche (ayelo-logo-blanc.svg) : violet de marque sur la bulle rose. */
  heartStrokeWhite: '#4B0F5B',
  /** Masque du logo monochrome : blanc = visible, noir = évidé. */
  maskShow: '#FFFFFF',
  maskHide: '#000000',
} as const;
