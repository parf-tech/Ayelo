# Suivi des lots de composants (phase 3)

Référence : `03-composants.md`, section 7 (ordre de construction). Mise à jour : 2026-11-12. Un lot est « fait » quand les tests Jest, `typecheck`, `lint` et `tokens:check` sont verts et que le rendu a été constaté dans l'aperçu navigateur. Les critères marqués [Appareil] (téléphone réel, lecteur d'écran) ne sont **pas** constatés : ils restent à faire pour chaque lot.

Vérifications du lot 1 : `npm run tokens:check`, `npm run typecheck`, `npm run lint` verts ; `npx jest --testTimeout=30000` : 25 suites, 562 tests verts (base : 23 suites, 456 tests).

## Lot 0. Prérequis : fait en partie

- [x] Jetons de la phase 2 fusionnés (`tokens.ts` généré : `focus`, `motion`, `stateOpacity`, `iconSize`, `hitSlop`, `MIN_TARGET`).
- [x] `react-native-svg` 15.16.0 et `lucide-react-native` 1.70.0 installés (aucun simulacre Jest nécessaire pour `react-native-svg`).
- [x] `ui/a11y/announce.ts` (iOS seulement, chaînes vides ignorées, antirebond 500 ms) ; `ui/a11y/focus.ts` (`focusNode`, sans erreur sur référence nulle).
- [x] `ui/hooks/useReduceMotion.ts` (`null` tant qu'inconnu, suivi en direct), `useMotion.ts`, `useFocusRing.ts`, `useCompactLayout.ts` (seuils 360, 320, 1,3, 1,75). Exportés par `ui/hooks/index.ts` et `ui/index.ts`.
- [x] Variantes `h3`, `label`, `captionStrong` et tons `onAccent`, `like`, `dislike` de `Text` (jetons de type déjà générés).
- [x] Aides de test `__tests__/helpers/a11y.ts` : `mockScreenReader`, `mockReduceMotion`, `mockFontScale`, `mockWindow`, `spyAnnounce`. Tests : `__tests__/uiHooks.test.tsx` (22).
- [ ] Domaine i18n `ui.*` (`i18n/areas/ui.fr.ts` et `ui.en.ts`) : non fait, aucun texte fixe nécessaire avant le lot 2 (les étiquettes d'`IconButton` viennent de l'appelant).
- [ ] Pluriels dans `translate` (`Intl.PluralRules`, P1-6 de l'audit UI) : non fait, aucun composant des lots 0 et 1 n'en dépend ; à faire avant `Badge` et `ProfileCard`.

## Lot 1. Icônes : fait

- [x] `src/ui/icons.ts` : 49 icônes importées une à une (`lucide-react-native/icons/<nom>`), noms de fichiers vérifiés dans le paquet installé (`ellipsis`, pas `more-horizontal`). Liste : table 4.3 + `ShieldCheck` (section 3).
- [x] `src/ui/Icon.tsx` : taille `iconSize`, ton = rôle de couleur de jeton, `filled`, décorative par défaut (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`), nom inconnu : erreur en développement.
- [x] `src/ui/IconButton.tsx` : `accessibilityLabel` obligatoire (type + erreur en développement si vide), cible 44 pt (48 pour `lg`) sans `hitSlop`, appuyé, focus, désactivé, chargement, basculé, `expanded`, badge point ou compteur caché.
- [x] Test du registre (liste figée = spec, chaque icône se rend) : `__tests__/icons.test.tsx` (84 tests, AC-ICON-1 à 4 et 7, AC-IBTN-1 à 5).
- [x] Garde ESLint : `no-restricted-imports` dans `eslint.config.js` (racine et tout `lucide-react-native/*` interdits ; seul `src/ui/icons.ts` peut importer `lucide-react-native/icons/<nom>`). Contrôlé par un fichier d'essai qui échoue au lint, puis supprimé.
- [x] Garde Jest AC-ICON-7 (même fichier de test) : racine interdite, sous-chemins seulement dans `icons.ts`, une importation par entrée du registre, `react-native-svg` seulement dans `icons.ts` ou `ui/illustrations/`.
- [x] `jest.config.js` : `moduleNameMapper` vers la build CommonJS de `lucide-react-native` (Jest ne charge pas les `.mjs`).
- [x] `ComponentsDemoScreen` (toujours réservé au développement) : grille des 49 icônes, tailles, tons, `IconButton` dans tous les états ; clés `demo.*` fr et en.
- [x] Aperçu navigateur 390 x 844, clair et sombre : captures `captures/lot-icones-clair-*.png` et `lot-icones-sombre-*.png`, aucune erreur en console (seuls des avertissements existants : notifications web, `useNativeDriver`).
- [x] Poids : le bundle web de développement (7,2 Mo, tout le site) ne contient que 53 modules d'icône sur 4 644 (49 + 4 alias Lucide), aucune icône hors registre.
- [ ] [Appareil] AC-ICON-5 (lisibilité à 16 pt, 1x et 2x, Android d'entrée de gamme) et AC-IBTN-6 (3 boutons côte à côte à 320 pt) : à constater sur téléphone.
- [ ] AC-ICON-6 : seuil de 150 Ko de JavaScript supplémentaire non mesuré (il faut un `npx expo export --platform android` avant et après ; hors de ce lot).

Écarts et demandes :
- Pas de jeton `iconStroke` dans `design/tokens.json` : `ICON_STROKE_WIDTH` réutilise `borderWidth.strong` (2). Demande de jeton à ouvrir.
- `Icon` accepte une `accessibilityLabel` facultative (icône « image » accessible), alors que la spec 4.1 la refuse. Par défaut l'icône reste décorative. À trancher.
- `IconTone` ajoute `disabledText` (icône d'un bouton désactivé) à la liste de la spec.
- `IconSize` accepte `xl` (jeton `iconSize.xl`, 32) en plus de `sm`, `md`, `lg`.
- Pas de remplacement des glyphes Unicode dans les écrans : prévu aux lots suivants (table 9.1).

## Lot 2. Briques simples : à faire

`Button` (neutral, icône, taille, focus, `disabledReason`), `Avatar`, `Skeleton`, `Badge`.

## Lot 3. Surfaces et champs : à faire

`SelectableSurface` et enveloppes, `Banner` et dérivés, `TextField`, `SwitchRow`, `ListRow`, `EmptyState`.

## Lot 4. Couches : à faire

`BottomSheet`, `ActionSheet`, `ConfirmPanel`, `Badge verified` interactif, `Toast` v2.

## Lot 5. Navigation : à faire

`ScreenHeader`, `useGoBack`, `TabBar`.

## Lot 6. Écrans de contenu : à faire

`ProfileCard`, `MessageBubble`, `DateSeparator`, `Select`, `CountryPicker`, `RangeSlider`.

## Lot 7. Monétisation et appels : à faire

`PlanCard`, `PriceSummary`, `RenewalDisclosure`, `PaywallLinks`, `CallEntryButtons`, `InCallControls`.
