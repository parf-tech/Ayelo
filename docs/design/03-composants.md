# Phase 3 : composants d'Ayelo (spécification prête à développer)

Date : 2026-11-08. Livrable de la phase 3 de `PROMPT-UIUX-EXPERT.md` (section 5). S'appuie sur `01-decisions.md` (décisions 1, 3, 4, 5, 6, 7, 10, 11, 12, 13), `01-direction.md` (direction B « Lagune » retenue, provisoire), `00-audit.md`, `00-audit-ui.md` et `00-a11y.md`. Aucun fichier source n'a été modifié pour écrire ce document, et **aucune dépendance n'est installée**.

## 0. Comment lire ce document

**Statut.** Spécification de conception. Rien de ce qui suit n'a été rendu sur un téléphone ni sous VoiceOver ou TalkBack ; les critères d'acceptation sont donc répartis en deux familles : **[Jest]** (vérifiable par `npx jest` avec `@testing-library/react-native`, sans voir le rendu) et **[Appareil]** (à constater sur un Android d'entrée de gamme de 320 pt et un iPhone SE, avec capture, avant de déclarer le composant livré). Un composant n'est « livré » que lorsque les deux familles sont vertes.

**Jetons par nom, jamais par valeur.** Un autre agent régénère `design/tokens.json` et `mobile/src/theme/tokens.ts` pendant la rédaction. Ce document cite les jetons par leur **nom** (`colors.primary`, `space[4]`, `radius.md`, `motion.base`) et ne contient aucune valeur de couleur. La section 1 liste les noms attendus ; un nom qui n'existerait pas dans `tokens.json` à la fin de la phase 2 est à rapprocher du nom réel par renommage mécanique (le tableau de la section 1 sert de contrôle), pas à recréer en dur dans un composant.

**État du code relevé le 2026-11-08 (après le lot 1).** `mobile/src/ui` contient : `Text`, `Button` (libellé qui passe à la ligne), `TextField` (propriétés `invalid`, `inputRef`, `passwordToggleLabels`), `ChoiceCard`, `CheckboxField`, `Chip`, `SwitchRow` (ligne cliquable), `ListRow`, `Avatar`, `Banner`, `Toast`, `Skeleton`, `EmptyState` (sans conteneur accessible), `AsyncView`, `ProgressBar`, `ScreenContainer` (pied plafonné), `VerifiedBadge` (explication dépliée en ligne) ; `DateSelector` est supprimé. `src/config/features.ts` exporte `CALLS_ENABLED = false`. Chiffres de migration relevés par recherche : 233 occurrences de `style={{` (231 dans `features/`, réparties dans 51 fichiers) ; 54 usages de `<Banner` dont 14 répétitions identiques de la bannière d'erreur fermable ; 46 `variant="ghost"` ; 17 `fontWeight` écrits à la main dans `features/` ; 88 `marginBottom: space[...]`, 55 `gap: space[...]`, 44 `marginTop: space[...]`, 23 `flexDirection: 'row'`. L'audit avait compté 223 styles en ligne avant le lot 1 : l'écart est un recomptage, pas une régression à confirmer.

**Étiquettes.** *Fait (source)*, *hypothèse à valider*, *inconnu*. Les textes juridiques et de sécurité donnés en exemple sont des **propositions** à valider par le juriste ; ils ne valent pas décision.

**Principes cités** : P1 à P8 sont les huit principes de conception de la section 4 du prompt maître (P1 confiance d'abord, P2 honnêteté, P3 une action principale par écran, P4 légèreté, P5 accessibilité par défaut, P6 culture et inclusion, P7 cohérence mesurable, P8 mouvement utile). Les identifiants D1 à D15 renvoient à `01-decisions.md`.

## 1. Jetons requis par les composants

Ce tableau est la **liste de contrôle** entre ce document et `design/tokens.json`. Les noms de la colonne « Existe dans `tokens.ts` actuel » sont ceux du fichier au 2026-11-08 ; les autres sont attendus de la phase 2 (section 5 du prompt maître : élévation, mouvement, z-index, focus, états, tailles d'icône, largeurs).

| Famille | Noms utilisés dans ce document | Existe dans `tokens.ts` actuel |
|---|---|---|
| Couleurs de surface et de texte | `colors.bg`, `colors.surface`, `colors.text`, `colors.textMuted` (la direction l'appelle `muted` : un seul des deux noms à garder) | oui |
| Couleurs d'action | `colors.primary`, `colors.onPrimary` | oui |
| Mise en avant douce | `colors.accent`, `colors.onAccent` | non (phase 1, section 4) |
| Contours | `colors.border` (séparateur décoratif), `colors.borderStrong` (contour de contrôle, 3:1 exigé) | oui |
| Sémantiques | `colors.like`, `colors.dislike`, `colors.verified`, `colors.danger`, `colors.warning`, `colors.success` | oui |
| États | `colors.disabledBg`, `colors.disabledText`, `colors.skeleton`, `colors.overlay` | oui |
| Focus | `colors.focus`, `focus.width`, `focus.offset` | non |
| Espacement | `space[0]` à `space[7]` | oui |
| Rayons | `radius.sm`, `radius.md`, `radius.lg`, `radius.pill`, et `radius.control` (rayon des boutons et champs : pilule en direction B, `radius.md` ailleurs) | `radius.control` non |
| Typographie | `type.title`, `type.h2`, `type.body`, `type.bodySmall`, `type.caption`, et deux nouvelles variantes `type.label` (corps de `body`, graisse semi-grasse) et `type.labelSmall` (corps de `caption`, graisse semi-grasse) pour remplacer les `fontWeight` écrits à la main | variantes `label` non |
| Mouvement | `motion.fast` (120 ms), `motion.base` (180 ms), `motion.slow` (300 ms), `motion.pulse` (durée d'un demi-cycle de squelette), `motion.easing.standard`, `motion.easing.enter`, `motion.easing.exit` | non |
| Opacité d'état | `opacity.pressed`, `opacity.disabled`, `opacity.scrim` | non (trois valeurs en dur différentes aujourd'hui) |
| Élévation et couches | `elevation.none` (direction B : aucune ombre), `zIndex.tabBar`, `zIndex.toast`, `zIndex.sheet` | non |
| Icônes | `iconSize.sm` (16), `iconSize.md` (20), `iconSize.lg` (24), `iconStroke` (trait de la direction B) | non |
| Cibles et largeurs | `MIN_TARGET` (44), `MAX_CONTENT_WIDTH` (560), `layout.tabBarMinHeight`, `layout.bubbleMaxWidth` (part de la largeur), `layout.sheetMaxHeightRatio`, `avatarSize.sm|md|lg|xl` | `MIN_TARGET` et `MAX_CONTENT_WIDTH` oui ; le reste non |

Règle de fond : un composant qui a besoin d'une valeur que ce tableau ne couvre pas **ouvre une demande de jeton** au lieu d'écrire un nombre. Le test existant qui interdit les couleurs en dur dans `src` reste en place ; un test jumeau pour les `fontWeight` et les durées d'animation est proposé en section 9 (migration).

## 2. Règles transverses (s'appliquent à tous les composants)

**R1. Cible tactile.** Toute zone qui reçoit un appui mesure au moins `MIN_TARGET` (44 pt) dans les deux dimensions, `minHeight` et `minWidth`, jamais `height`. Deux cibles voisines sont séparées d'au moins `space[2]`. `hitSlop` n'est **pas** utilisé pour atteindre 44 pt (il fait se recouvrir les zones voisines) ; la zone visible ou son conteneur fait 44 pt.

**R2. Texte qui grandit.** Aucun libellé de bouton, de champ, de puce ou de ligne n'est tronqué par `numberOfLines`. Les conteneurs utilisent `minHeight`, `flexShrink: 1` et `flexWrap: 'wrap'`. Exceptions documentées et testées : nom sur carte (2 lignes, le nom complet est dans l'étiquette d'accessibilité), libellé d'onglet (plafond `maxFontSizeMultiplier` de 1,6, le nom complet est dans l'étiquette), pastille de compteur (plafond de 1,6). Aucune taille de police n'est écrite en dur : toute taille vient de `type.*`.

**R3. Rangée de trois éléments ou plus.** Elle porte `flexWrap: 'wrap'` ou bascule en colonne quand `useCompactLayout().isNarrow` (largeur de 360 pt ou moins) ou `isLarge` (agrandissement de 1,3 ou plus) est vrai.

**R4. États par jetons.** Appui : `opacity.pressed` (une seule valeur pour tous les composants). Désactivé : couleurs `colors.disabledBg` et `colors.disabledText` pour les composants pleins, `opacity.disabled` pour les composants transparents, plus l'état d'accessibilité `disabled`. Focus : voir R5. Aucun composant n'écrit une opacité numérique.

**R5. Focus visible (WCAG 2.4.7).** Chaque contrôle focalisable (clavier externe, Switch Control, Switch Access) dessine un contour de `focus.width` en `colors.focus`, décalé de `focus.offset`, quand il reçoit le focus. Mise en œuvre par le crochet `useFocusRing()` (section 2.1). Les propriétés de style `outlineWidth`, `outlineColor`, `outlineOffset`, `outlineStyle` existent depuis React Native 0.77 sous l'architecture Fabric (*hypothèse à valider sur 0.88 et sur `react-native-web`*) ; repli : un `View` englobant de `focus.width` avec bordure transparente qui prend `colors.focus` au focus.

**R6. Mouvement (P8).** Toute durée et toute courbe vient de `motion.*`. Le mouvement ne sert qu'à expliquer un changement d'état. Si « réduire les animations » est actif (`useReduceMotion()`), les déplacements, rotations et ressorts sont supprimés ; un fondu de `motion.fast` ou un changement instantané les remplace. Le réglage est suivi **en direct** (écouteur `reduceMotionChanged`), pas lu une fois. Les animations utilisent `useNativeDriver: true` (transform et opacity seulement).

**R7. Annonces (iOS n'a pas de région vivante).** Tout changement d'état important que l'utilisateur ne provoque pas par un geste sur l'élément lui-même (erreur, succès, toast, résultat de recherche, nouveau message) passe par `announce(message)`. Sous Android, `accessibilityLiveRegion` est posé **et** `announce` n'est pas appelé (pour éviter la double lecture), conformément à `00-a11y.md` P0-2.

**R8. Groupes d'accessibilité.** Un conteneur `accessible` ne contient **jamais** de contrôle interactif : il avalerait le bouton sous iOS (défaut déjà corrigé pour `ListRow` et `EmptyState`). Le groupe porte le texte seulement ; les boutons sont ses frères.

**R9. Pas la couleur seule.** Tout état (sélectionné, erreur, vérifié, lu, échec, actif) a un second indice : forme d'icône, coche, texte ou position. Vérifié et lu : icône et libellé.

**R10. Textes.** Aucun texte en dur. Les textes fixes d'un composant partagé vivent sous le préfixe `ui.<composant>.*` dans `i18n/areas/ui.fr.ts` et `ui.en.ts` (nouveau domaine, sur le modèle de `birthdate.*`, pour ne pas toucher `fr.ts` et `en.ts`). Parité fr/en typée. Les textes qui dépendent d'un nombre utilisent les formes plurielles (`_one`, `_other`) : cela suppose d'abord de corriger `translate` avec `Intl.PluralRules` (P1-6 de l'audit UI). Le français est de 15 à 30 % plus long : chaque exemple ci-dessous donne le texte français le plus long.

**R11. testID.** Le composant reçoit `testID` ; ses parties dérivent `<testID>-<partie>`. Sans `testID`, un nom par défaut stable est fourni (indiqué par composant). Les identifiants n'embarquent jamais de donnée personnelle (jamais le nom d'une personne) : on utilise l'identifiant technique.

**R12. Hors ligne et erreur.** Un composant qui dépend du réseau expose un état d'erreur et un état de reprise ; il ne reste jamais en chargement sans fin.

**R13. Pas de logique de routage dans `ui/`.** Les composants de `ui/` reçoivent des fonctions (`onBack`, `onPress`) ; seuls les composants de `features/` importent `expo-router`.

**R14. Un composant existe une fois (P7).** Toute duplication de plus de deux occurrences identiques devient un composant partagé (section 9).

### 2.1 Crochets et utilitaires partagés (à construire d'abord)

| Fichier proposé | Contenu | Utilisé par |
|---|---|---|
| `ui/a11y/announce.ts` | `announce(message: string): void` : sous iOS `AccessibilityInfo.announceForAccessibility`, sous Android rien (la région vivante suffit) ; ignore les chaînes vides ; antirebond de 500 ms sur un même message | Banner, Toast, TextField, CountryPicker, ProfileCard, MessageBubble |
| `ui/a11y/focus.ts` | `focusNode(ref)` : `AccessibilityInfo.setAccessibilityFocus(findNodeHandle(ref))`, sans erreur si la référence est nulle | feuilles, ScreenHeader, formulaires |
| `ui/hooks/useReduceMotion.ts` | Renvoie `boolean \| null` (`null` tant que le réglage est inconnu : on n'anime pas avant de savoir) ; écoute `reduceMotionChanged` | tous les composants animés |
| `ui/hooks/useMotion.ts` | `useMotion(): { reduced: boolean; duration(name: 'fast' \| 'base' \| 'slow'): number }` : `duration` renvoie 0 si le mouvement est réduit | feuilles, Toast, Skeleton |
| `ui/hooks/useFocusRing.ts` | `{ focused, handlers: { onFocus, onBlur }, ringStyle }` | Button, IconButton, SelectableSurface, ListRow, SwitchRow, TabBar |
| `ui/hooks/useCompactLayout.ts` | `{ fontScale, width, isNarrow (largeur <= 360), isTiny (largeur <= 320), isLarge (fontScale >= 1,3), isXL (fontScale >= 1,75) }` à partir de `useWindowDimensions` | tout composant qui bascule en colonne |
| `ui/Text.tsx` (extension) | variantes `label` et `labelSmall`, tons supplémentaires `onAccent`, `like`, `dislike` | tous |
| `__tests__/helpers/a11y.ts` | `mockScreenReader(enabled)`, `mockReduceMotion(enabled)`, `mockFontScale(n)`, `mockWindow(width, height)`, `spyAnnounce()` ; reprend le motif de `ui.test.tsx` (Dimensions et `fontScale` simulés) et de `jest.setup.ts` (réduire les animations simulé) | tous les tests |

**Limite des tests Jest.** Jest ne calcule aucune mise en page : on ne peut pas y mesurer qu'un texte ne déborde pas. Les critères [Jest] vérifient des **propriétés structurelles** (absence de `numberOfLines`, présence de `minHeight`, de `flexWrap`, ordre des nœuds, rôles, états, appels de `announce`) ; ce qui touche au rendu réel est marqué [Appareil].

## 3. Dépendances nécessaires

Les deux premières sont **approuvées par le propriétaire (décision 11 de `01-decisions.md`) et à installer pendant cette phase 3, pas avant**. Rien n'est installé par ce document. Les autres bibliothèques de la décision 12 restent hors périmètre.

| Paquet | Rôle | Licence | Poids | Maintenance | Statut |
|---|---|---|---|---|---|
| `react-native-svg` | dessin des icônes et des illustrations d'états vides | MIT (*à reconfirmer sur le dépôt officiel avant installation*) | module natif : alourdit le binaire de l'application ; **chiffre inconnu**, à mesurer (voir ci-dessous) | très répandu, versionné avec Expo | **approuvé, décision 11 ; installé (15.16.0)** |
| `lucide-react-native` | jeu d'icônes (trait uniforme, plus de 1 000 icônes) ; on n'en livre qu'une trentaine | ISC (*à reconfirmer*) | un module JavaScript par icône, de l'ordre de quelques centaines d'octets chacun (*hypothèse à mesurer*) ; **risque** : l'import « barrel » peut embarquer toutes les icônes si le bundler ne les élague pas | très actif, mais des icônes sont renommées d'une version à l'autre | **approuvé, décision 11 ; 1.70.0, installation en cours** |

**État de l'installation (information du coordinateur, au moment de la rédaction).** `react-native-svg` **15.16.0** (version compatible Expo) est installé dans `mobile/` ; `lucide-react-native` **1.70.0** est en cours d'installation (licence ISC, dépendances homologues React ^19 et `react-native-svg` ^15 satisfaites, 33 Mo décompressés, `sideEffects: false`, exports de paquet `./icons/*`). Ce document ne les installe pas ; la procédure ci-dessous reste la référence pour les autres postes et pour une réinstallation.

**Règle impérative : import icône par icône (critère d'acceptation).** Metro **ne fait pas d'élagage d'arbre** : un import depuis la racine du paquet (`from 'lucide-react-native'`) embarquerait **toutes** les icônes dans le bundle. Donc :
1. Les icônes s'importent **une à une par le chemin par icône** : `lucide-react-native/icons/<nom>` (le nom exact du fichier, probablement en minuscules séparées par des tirets, est à relever dans le paquet installé avant d'écrire le module).
2. **Un seul module d'enveloppe**, `mobile/src/ui/icons.ts`, importe chaque icône utilisée par ce chemin et ne ré-exporte **que** celles-là (liste de départ : `Heart`, `MessageCircle`, `User`, `Flag`, `Ban`, `MoreHorizontal` (ou son nom actuel `Ellipsis`, voir 4.3), `ChevronLeft`, `Check`, `X`, `Star`, `ShieldCheck`, `Eye`, `EyeOff`, `Phone`, `Video`, puis le reste de la table 4.3). Ce module remplace le « registre » : `ICON_REGISTRY` est construit dans `ui/icons.ts`.
3. **Aucun autre fichier** n'importe `lucide-react-native` ni `react-native-svg` pour des icônes (R13 étendue). 
4. **Garde automatique** : règle ESLint `no-restricted-imports` interdisant l'importation de `lucide-react-native` (chemin exact de la racine, avec `patterns` autorisant `lucide-react-native/icons/*`) partout ; dérogation `eslint-disable` interdite. Un test Jest équivalent (voir AC-ICON-7) échoue si un fichier de `mobile/src` ou `mobile/app` contient une importation de la racine.
5. Aperçu navigateur (`npx expo start --web`) : aucune étape supplémentaire n'est nécessaire (`react-native-svg` fonctionne sur `react-native-web`).

**Procédure d'installation (référence).**
1. `npx expo install react-native-svg` : Expo choisit la version compatible avec le SDK 58 (ne pas fixer la version à la main).
2. `lucide-react-native` n'est pas géré par `expo install` : l'installer avec une **version exacte** (sans `^`), publiée depuis au moins deux semaines, après avoir lu ses dépendances homologues (`react-native-svg` et React 19) ; consigner la version dans `docs/design/`.
3. Un module natif s'ajoute : il exige une nouvelle build de développement ou de production (pas de mise à jour à distance). L'application n'étant pas publiée, le coût est nul aujourd'hui ; il ne le sera plus après.
4. Mesurer avant et après : `npx expo export --platform android` puis comparer la taille du bundle JavaScript Hermes, et la taille de l'APK de test. Consigner les deux chiffres dans le suivi. Seuil proposé (*hypothèse de conception*) : plus de 150 Ko de JavaScript supplémentaire = bloquer et passer à l'alternative A.
5. Jest : `react-native-svg` se rend en nœuds hôtes ; si la transformation échoue, ajouter un simulacre dans `jest.setup.ts`. Les tests ne dépendent pas des éléments internes du SVG : `Icon` porte un `testID` sur son conteneur.
6. Aperçu navigateur (`npx expo start --web`) : `react-native-svg` fonctionne sur `react-native-web` ; à vérifier à l'installation.

**Isolation (condition du choix).** Aucun écran n'importe `lucide-react-native` ni `react-native-svg` : seul `ui/icons.ts` importe les icônes (les illustrations d'états vides, dans `ui/illustrations/`, sont les seuls autres fichiers à importer `react-native-svg`). Ainsi, changer de bibliothèque d'icônes est un changement d'un fichier.

**Alternatives sans bibliothèque d'icônes**, par ordre de préférence si la mesure est mauvaise :
- **A. `react-native-svg` seul, tracés copiés.** Un fichier `ui/icons/paths.ts` contient les tracés SVG (données de chemin) des ~35 icônes retenues, avec la mention de licence du jeu d'origine dans `docs/` (obligation de conserver l'avis de la licence ISC). Poids : quelques Ko. Coût : mise à jour manuelle, aucun risque d'embarquer 1 000 icônes. C'est la voie de repli recommandée.
- **B. Import par icône** (`lucide-react-native/…/icons/<nom>`) plutôt que le barrel : chemin exact à vérifier dans le paquet installé.
- **C. Police d'icônes** : exige `expo-font` (décision 12 : reporté) ; écartée.
- **D. Images PNG par densité** : lourdes, non teintables en mode sombre sans `tintColor` ; écartée.
- **E. Garder les glyphes Unicode** : écartée (rendu variable, `☺ ☎` en emoji coloré sur certains Android, aucun jeton de taille).

## 4. Icônes : `Icon` et `IconButton`

### 4.1 `Icon`

**Rôle.** Dessiner un pictogramme du jeu retenu, à une taille et une couleur de jeton, **décoratif par défaut**. L'icône n'est jamais seule porteuse d'une information : un libellé visible ou une étiquette d'accessibilité l'accompagne (R9).

**Anatomie.** Un `View` conteneur (carré de la taille choisie, `testID`), contenant le SVG fourni par la bibliothèque. Trait : `iconStroke` ; au format 16 pt le trait passe à une valeur plus épaisse pour rester lisible (*hypothèse de conception, à confirmer sur appareil à 1x*).

**Variantes.** `size` : `sm` (16, glyphe de ligne de texte, puce, badge), `md` (20, bouton d'icône, champ), `lg` (24, onglet, en-tête, état vide compact). `tone` : un nom de couleur de jeton parmi `text`, `textMuted`, `primary`, `onPrimary`, `onAccent`, `danger`, `success`, `warning`, `verified`, `like`, `dislike`. `filled` : remplit la forme avec la couleur du trait (cœur actif, étoile active, onglet actif). Aucune autre couleur n'est acceptée.

**États.** Sans état propre. Un parent désactivé passe `tone="textMuted"` ou la couleur désactivée ; l'icône ne gère pas `disabled`.

**320 pt et 200 %.** La taille d'une icône **ne grandit pas** avec la police (elle n'est pas du texte) ; les conteneurs qui contiennent icône et texte utilisent `minHeight` et centrent verticalement. Un `IconButton` reste à 44 pt.

**Accessibilité.** `accessible={false}`, `importantForAccessibility="no-hide-descendants"`, `accessibilityElementsHidden`. Pas de prop `accessibilityLabel` sur `Icon` (compilation refusée) : une icône qui porte du sens passe par `IconButton`, `Badge` ou un texte voisin.

**Mouvement.** Aucun. Un changement d'icône (cœur vide vers plein) est instantané ; avec mouvement non réduit, un fondu de `motion.fast` est permis sur le seul passage `filled`.

**Textes.** Aucun.

**Cas limites.** Nom d'icône inconnu : en développement, erreur explicite ; en production, rien n'est rendu (pas d'espace vide qui casse la mise en page : le conteneur garde sa taille). Pas de miroir RTL en V1 (français et anglais seuls) ; les chevrons sont écrits en dur gauche / droite.

**testID.** Défaut `icon-<name>`.

**Props.**

```ts
import type { ColorTokens } from '../theme/tokens';

export type IconName = keyof typeof ICON_REGISTRY; // registre construit dans src/ui/icons.ts (import icône par icône)
export type IconSize = 'sm' | 'md' | 'lg';
export type IconTone =
  | 'text' | 'textMuted' | 'primary' | 'onPrimary' | 'onAccent'
  | 'danger' | 'success' | 'warning' | 'verified' | 'like' | 'dislike';

export interface IconProps {
  name: IconName;
  size?: IconSize;           // défaut 'md'
  tone?: IconTone;           // défaut 'text'
  filled?: boolean;          // défaut false
  testID?: string;           // défaut `icon-${name}`
}
// Contrainte de type : IconTone doit rester un sous-ensemble de keyof ColorTokens.
```

**Critères d'acceptation.**
- AC-ICON-1 [Jest] : le rendu d'une icône est exclu de l'arbre d'accessibilité (`getByRole` ne la trouve pas ; le nœud porte `accessibilityElementsHidden`).
- AC-ICON-2 [Jest] : `size="sm|md|lg"` donne un conteneur de 16, 20, 24 (valeurs lues dans les jetons `iconSize`, pas dans le test).
- AC-ICON-3 [Jest] : la couleur du trait est celle du jeton demandé en clair et en sombre ; une couleur inconnue ne compile pas (`tsc`).
- AC-ICON-4 [Jest] : un test de registre vérifie que **chaque** nom du tableau de la section 4.3 existe dans `ICON_REGISTRY` et que le registre ne contient aucune entrée inutilisée (liste figée, mise à jour avec le code).
- AC-ICON-5 [Appareil] : chaque icône est reconnaissable à 16 pt sur un écran de densité 1x et 2x ; rendu identique sur Samsung, Xiaomi ou Tecno, Pixel et iPhone.
- AC-ICON-6 [Appareil] : `lucide-react-native` n'ajoute pas plus que le seuil de la section 3 au bundle.
- AC-ICON-7 [Jest + ESLint] : (a) la règle `no-restricted-imports` sur la racine `lucide-react-native` est active et `npm run lint` échoue sur un import racine ; (b) un test Jest lit les sources de `mobile/src` et `mobile/app` et échoue si une importation `from 'lucide-react-native'` (racine exacte) existe, ou si une importation `lucide-react-native/icons/…` apparaît ailleurs que dans `src/ui/icons.ts` ; (c) `src/ui/icons.ts` n'exporte que des icônes de la table 4.3.

### 4.2 `IconButton`

**Rôle.** Un bouton qui n'a pas de texte visible : fermer, menu, retour, afficher le mot de passe, appeler, plus, moins. Remplace les 9 boutons-glyphes écrits avec `Button label="✕"`.

**Anatomie.** `Pressable` de 44 × 44 pt minimum, `Icon` centrée (20 ou 24 pt), fond selon la variante, contour de focus (R5), pastille facultative (point ou compteur) en coin supérieur droit.

**Variantes.** `plain` (icône seule sur le fond de l'écran), `tonal` (fond `colors.surface`, contour `colors.borderStrong` si le bouton est le seul indice sur une photo ou un fond de surface), `filled` (fond `colors.primary`, icône `colors.onPrimary`), `danger` (icône `colors.danger`, jamais fond plein sans confirmation en aval). Forme : cercle (`radius.pill`) pour `tonal` et `filled`.

**États.**

| État | Rendu |
|---|---|
| Repos | selon la variante |
| Appuyé | `opacity.pressed` |
| Focus | contour `focus.width` en `colors.focus` |
| Désactivé | `colors.disabledText` sur `colors.disabledBg` pour `filled` et `tonal`, `opacity.disabled` pour `plain` ; état d'accessibilité `disabled` |
| Chargement | l'icône est remplacée par un `ActivityIndicator` de même taille, `accessibilityState.busy`, appuis ignorés, étiquette inchangée |
| Basculé (`selected`) | trait plein et fond `colors.surface` ; état d'accessibilité `selected` (exemple : favori, filtre actif) |
| Erreur | sans objet |

**Tailles.** `md` : icône 20 pt dans une cible de 44 pt. `lg` : icône 24 pt dans une cible de 48 pt (actions principales de la découverte). Les boutons voisins sont à `space[2]` au moins.

**320 pt et 200 %.** Taille fixe (ce n'est pas du texte) ; aucune troncature possible. Dans un en-tête, trois `IconButton` au plus (3 × 44 + 2 × `space[2]` tient dans 320 pt avec le bouton retour).

**Accessibilité.** `accessibilityRole="button"`. `accessibilityLabel` **obligatoire**, imposé par le type (chaîne non vide ; un test échoue sur une chaîne vide). Le nom est l'action (« Fermer », « Plus d'actions »), pas le dessin (« croix »). `expanded` (booléen facultatif) pour un bouton qui ouvre un menu : `accessibilityState.expanded`. `hint` facultatif. Un bouton basculé annonce `selected`.

**Mouvement.** Appui : opacité seulement (R4). Aucune animation d'échelle.

**Textes (étiquettes types).**

| Usage | fr | en |
|---|---|---|
| Fermer | Fermer | Close |
| Retour | Retour | Back |
| Menu | Plus d'actions | More actions |
| Mot de passe masqué | Afficher le mot de passe | Show password |
| Mot de passe visible | Masquer le mot de passe | Hide password |
| Appel audio | Appeler {name} | Call {name} |
| Appel vidéo | Appel vidéo avec {name} | Video call with {name} |
| Augmenter | Augmenter l'âge minimum | Increase minimum age |

**Cas limites.** Nom très long dans l'étiquette (« Appel vidéo avec … ») : lu en entier, rien d'affiché. Hors ligne : l'appelant passe `disabled`. Pas d'icône fournie : refus de compiler.

**testID.** `icon-button-<icon>` par défaut ; pastille `<testID>-badge`.

**Props.**

```ts
export interface IconButtonProps {
  icon: IconName;
  accessibilityLabel: string;     // obligatoire, non vide
  onPress: () => void;
  variant?: 'plain' | 'tonal' | 'filled' | 'danger'; // défaut 'plain'
  size?: 'md' | 'lg';             // défaut 'md'
  selected?: boolean;             // bascule, ajoute filled sur l'icône
  expanded?: boolean;             // bouton qui ouvre un menu
  loading?: boolean;
  disabled?: boolean;
  badge?: { kind: 'dot' } | { kind: 'count'; count: number; accessibilityLabel: string };
  accessibilityHint?: string;
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-IBTN-1 [Jest] : rôle `button`, nom accessible égal à `accessibilityLabel`, `minHeight` et `minWidth` supérieurs ou égaux à `MIN_TARGET`, sans `hitSlop`.
- AC-IBTN-2 [Jest] : `disabled` et `loading` ignorent l'appui ; `loading` expose `busy`.
- AC-IBTN-3 [Jest] : `selected` expose `accessibilityState.selected`, `expanded` expose `expanded`.
- AC-IBTN-4 [Jest] : le focus (événement `focus` simulé) applique le contour de `focus.width` en `colors.focus`.
- AC-IBTN-5 [Jest] : un `IconButton` avec badge `count` ne duplique pas le compteur dans l'arbre (le compteur est caché, son texte est dans l'étiquette fournie).
- AC-IBTN-6 [Appareil] : 3 `IconButton` côte à côte sont atteignables un à un au doigt sans appui parasite sur un écran de 320 pt.

### 4.3 Correspondance des glyphes Unicode vers les icônes

Source : `00-audit-ui.md`, section 5.1 (12 familles de glyphes, 31 emplacements). Les noms de la colonne « Icône » sont ceux de **Lucide** dans leur forme actuelle ; plusieurs icônes y ont été renommées (par exemple `AlertCircle` devient `CircleAlert`, `CheckCircle` devient `CircleCheck`, `MoreHorizontal` devient `Ellipsis`, `Loader2` devient `LoaderCircle`) et la bibliothèque garde souvent des alias : **vérifier chaque nom dans la version installée** avant d'écrire le registre.

| Glyphe actuel | Emplacements (audit 5.1) | Rôle | Icône | Remarque de conception |
|---|---|---|---|---|
| `♥` | onglet Découvrir ; bouton J'aime (découverte et détail) | J'aime | `Heart` (`filled` à l'état actif) | **Onglet Découvrir : `Layers`** (pile de cartes), pas `Heart`, pour ne pas avoir deux cœurs sur l'écran de découverte (onglet et bouton J'aime) |
| `✉` | onglet Messages | Conversations | `MessageCircle` | `Mail` évoque le courriel électronique, pas une conversation |
| `☺` | onglet Profil | Mon profil | `User` | `☺` s'affichait en emoji coloré sur certains Android |
| `★` | Coup de cœur (découverte et détail) | Super J'aime | `Star` (`filled` à l'état actif) | Le libellé visible reste « Coup de cœur » |
| `✕` | refuser ; fermer une bannière ; supprimer une photo ; erreur de bannière | Passer, fermer | `X` ; **supprimer une photo : `Trash2`** ; **erreur de bannière : `CircleX`** | Passer : icône `X` + libellé visible « Passer », bouton neutre |
| `✓` | case, puce, bannière de succès, badge Vérifié, message envoyé | Coche | `Check` ; **badge Vérifié : `BadgeCheck`** ; **bannière de succès : `CircleCheck`** | Le badge a une forme propre (pastille avec coche), utile sous tritanopie |
| `✓✓` | message remis, message lu (même glyphe) | État d'envoi | **remis : `CheckCheck`** ; **lu : `CheckCheck` + libellé « Lu »** ; envoyé : `Check` ; en cours : `Clock` ; échec : `CircleAlert` | Deux états distincts par la forme **et** le libellé ; voir `MessageBubble` |
| `…` `!` `i` | envoi en cours ; échec ; information (bannière) | État | `Clock` ; `CircleAlert` ; **avertissement : `TriangleAlert`** ; **information : `Info`** | Quatre formes de bannière différentes, pas seulement quatre couleurs |
| `☎` | appel audio | Appeler | `Phone` | Masqué tant que `CALLS_ENABLED` est faux |
| `▶` | appel vidéo | Appel vidéo | `Video` | `▶` se lit « lecture » ; l'étiquette dit « appel vidéo » |
| `⋯` | menu (détail, conversation) | Plus d'actions | `Ellipsis` (ancien nom `MoreHorizontal` : utiliser le nom du fichier présent dans `lucide-react-native/icons/` installé) | Cible de 44 pt, `expanded` |
| `‹` `›` | déplacer une photo ; chevron de ligne | Précédent, suivant | `ChevronLeft`, `ChevronRight` | Retour d'en-tête : `ChevronLeft` |
| `−` `+` | pas d'âge | Diminuer, augmenter | `Minus`, `Plus` | Utilisés par le `RangeSlider` pour l'alternative sans glisser |
| `•` | filtres actifs, dans la chaîne de libellé | Indicateur | **aucune icône** : point `Badge kind="dot"` sur l'`IconButton` des filtres | Le libellé ne contient plus de caractère décoratif |

Icônes **nouvelles** que les composants de ce document utilisent en plus : `SlidersHorizontal` (filtres), `Search`, `Eye` et `EyeOff` (mot de passe), `Send` (envoyer un message), `Flag` (signaler), `Ban` (bloquer), `ShieldAlert` (conseil de sécurité), `MapPin` (résidence), `Globe` (origine), `Undo2` (annuler le dernier choix), `Lock` (fonction Premium), `Sparkles` (Premium), `Camera`, `ImagePlus`, `Pencil`, `ChevronDown` (sélecteur), `Mic`, `MicOff`, `VideoOff`, `Volume2`, `PhoneOff`, `SwitchCamera`, `Copy`, `WifiOff` (hors ligne), `Play` et `Pause` (lecture des notes vocales et des vidéos en conversation, ajoutées le 2026-11-22). Total prévu : environ 40 entrées dans `ICON_REGISTRY` ; la liste exacte est celle du test AC-ICON-4.

**Décision de conception (à confirmer par le propriétaire).** Les drapeaux ne sont **pas** utilisés comme icônes de pays (litiges de territoires, principe 6 ; décision 14 : aucun motif de drapeau dans la marque) ; les pays sont désignés par leur nom.

## 5. Nouveaux composants (A)

Chaque fiche suit le même plan : rôle, anatomie, variantes, états, tailles et comportement à 320 pt et 200 %, accessibilité, mouvement, textes, cas limites, `testID`, contrat de props, critères d'acceptation. Les règles R1 à R14 (section 2) s'appliquent sans être répétées.

### 5.1 `BottomSheet` (base des feuilles)

**Rôle.** Panneau modal ancré en bas qui affiche un contenu libre (explication du badge, sélecteur de pays, filtres rapides). C'est aussi la base interne d'`ActionSheet` et de `ConfirmPanel` (décision 10 : `Modal` natif, aucune dépendance). Remplace les « menus en ligne » qui poussent le contenu et qui ne piègent pas le focus.

**Anatomie.** `Modal` natif (`transparent`, `animationType="none"`, `statusBarTranslucent`) contenant : (1) un fond d'atténuation plein écran (`colors.overlay` à `opacity.scrim`) qui est un bouton de fermeture ; (2) la feuille : coins supérieurs `radius.lg`, fond `colors.bg`, contour supérieur `colors.border` (direction B : aucune ombre, `elevation.none`) ; (3) un en-tête : titre (`Text variant="h2" header`, passe à la ligne, jamais tronqué) et `IconButton` « Fermer » ; (4) le contenu défilant ; (5) un pied facultatif collé en bas (boutons), zone sûre incluse.

**Variantes.** `dismissible` vrai (défaut : le fond, le bouton Fermer, le retour Android et le geste d'échappement iOS ferment) ou faux (confirmation en cours : seul un bouton explicite ferme). Sur largeur supérieure à `MAX_CONTENT_WIDTH` (iPad), la feuille est centrée, sa largeur est `MAX_CONTENT_WIDTH`. Pas de poignée de glissement (aucun geste de glisser pour fermer en V1 : pas de `gesture-handler`, décision 12 ; une poignée suggérerait un geste qui n'existe pas).

**États.** Fermée (rien n'est monté), entrée, ouverte, sortie, `busy` (le fond ne ferme plus, le retour Android est ignoré, le bouton Fermer est désactivé), erreur (une `Banner` d'erreur en tête du contenu, fournie par l'appelant).

**Tailles, 320 pt, 200 %.** Hauteur maximale = `layout.sheetMaxHeightRatio` de la fenêtre, moins la zone sûre haute ; au-delà, le contenu défile (un `ScrollView` avec `keyboardShouldPersistTaps="handled"`). Le titre passe sur autant de lignes que nécessaire ; à 200 % il peut occuper 3 lignes sans pousser le bouton Fermer hors de l'écran (la rangée du titre est en `flexWrap`/`flexShrink`). Un clavier ouvert réduit la hauteur utile (`KeyboardAvoidingView`, `padding` sous iOS).

**Accessibilité.**
- Le piège du focus vient de `Modal` : sous iOS, le contenu présenté dans un contrôleur de vue modal est le seul exposé à VoiceOver ; sous Android, `Modal` est une fenêtre de dialogue, TalkBack y reste. *Hypothèse à valider sur appareil* (c'est le comportement documenté, non testé ici).
- À l'ouverture (`onShow`), le focus d'accessibilité va au **titre** (`focusNode(titleRef)`), pas au premier bouton (éviter une activation accidentelle d'une action destructrice).
- À la fermeture, le focus est rendu au déclencheur : `triggerRef` en prop ; si la référence est perdue (liste recyclée), il va au titre de l'écran.
- Échappement : Android, `onRequestClose` ; iOS, `onAccessibilityEscape` sur la feuille (geste « Z » à deux doigts de VoiceOver) ; dans les deux cas, le bouton visible « Fermer » existe.
- `accessibilityViewIsModal` sur la feuille (iOS) en plus.
- Le fond d'atténuation a `accessibilityRole="button"` et l'étiquette « Fermer », mais n'est **pas** dans l'ordre de focus avant le contenu : il est le dernier élément (VoiceOver : `accessibilityElementsHidden` sur lui tant que `dismissible` est faux).
- Rôle de la feuille : conteneur avec `accessibilityLabel` = titre.

**Mouvement.** Entrée : fond en fondu (`motion.base`), feuille en glissement vertical (`motion.base`, `motion.easing.enter`). Sortie : `motion.fast`, `motion.easing.exit`. Mouvement réduit : fondu seul en `motion.fast` ou instantané, aucune translation. La fermeture attend la fin de la sortie avant de démonter le `Modal` (sinon la sortie est coupée).

**Textes.**

| Clé | fr | en |
|---|---|---|
| `ui.sheet.close` | Fermer | Close |
| `ui.sheet.cancel` | Annuler | Cancel |

**Cas limites.**
- Une seule feuille à la fois : ouvrir une feuille depuis une autre est interdit (iOS ne présente pas deux modales en même temps). Voir `ActionSheet` pour l'enchaînement ouvrir-fermer-ouvrir.
- Rotation : portrait seul (décision 9) ; si le paysage est un jour autorisé, la hauteur maximale est recalculée à chaque changement de fenêtre.
- Un toast déclenché pendant qu'une feuille est ouverte s'affiche **derrière** la fenêtre modale : l'appelant affiche l'erreur dans la feuille (prop `error` d'`ActionSheet`/`ConfirmPanel`, ou une `Banner` en tête de contenu) ; le toast est différé jusqu'à la fermeture (voir 5.13).
- Contenu vide : une feuille sans contenu n'est pas permise (titre obligatoire).

**testID.** `<testID>` (feuille), `<testID>-backdrop`, `<testID>-title`, `<testID>-close`, `<testID>-body`, `<testID>-footer`. Défaut : `bottom-sheet`.

**Props.**

```ts
export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;                      // fond, Fermer, retour Android, échappement iOS
  title: string;                            // obligatoire : le titre nomme la feuille
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissible?: boolean;                    // défaut true
  busy?: boolean;                           // défaut false
  triggerRef?: React.RefObject<unknown>;    // reçoit le focus à la fermeture
  closeLabel?: string;                      // défaut t('ui.sheet.close')
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-SHEET-1 [Jest] : `visible=false` ne monte pas le contenu ; `visible=true` monte un `Modal` avec le titre en rôle `header`.
- AC-SHEET-2 [Jest] : l'appui sur le fond, sur « Fermer » et l'événement `onRequestClose` appellent chacun `onClose` une fois.
- AC-SHEET-3 [Jest] : avec `dismissible={false}` ou `busy`, aucun de ces trois chemins n'appelle `onClose`.
- AC-SHEET-4 [Jest] : à `onShow`, `AccessibilityInfo.setAccessibilityFocus` est appelé avec le nœud du titre ; à la fermeture, avec le nœud du déclencheur s'il est fourni.
- AC-SHEET-5 [Jest] : `onAccessibilityEscape` appelle `onClose`.
- AC-SHEET-6 [Jest] : avec le mouvement réduit simulé, aucune animation de translation n'est créée (durée 0 ou fondu).
- AC-SHEET-7 [Jest] : le titre ne porte pas `numberOfLines` ; le pied est rendu hors du `ScrollView`.
- AC-SHEET-8 [Appareil] : VoiceOver et TalkBack ne parcourent pas l'écran situé derrière la feuille ; le bouton Fermer reste visible à 320 pt et 200 % ; le contenu défile.

### 5.2 `ActionSheet`

**Rôle.** Liste d'actions sur un objet (menu « Plus d'actions » d'une conversation, d'un profil, d'un message). Remplace les menus `⋯` en ligne (5 occurrences, `00-audit-ui.md` 5.5) et corrige le menu qui s'ouvre en haut du défilement alors que le doigt est en bas.

**Anatomie.** `BottomSheet` (titre = nom de l'objet ou « Actions »), puis une liste d'`ActionSheetItem` de 56 pt minimum (icône `md`, libellé, description facultative), puis un séparateur, puis **Annuler** en dernier. Les actions destructrices sont regroupées après les actions courantes, séparées par un trait, avec une icône **et** la couleur `colors.danger` (R9).

**Variantes.** Élément `default` ou `destructive`. Élément avec `description` (une phrase). Élément `disabled` avec raison (la raison est lue en `accessibilityHint`).

**États d'un élément.** Repos, appuyé (`opacity.pressed`), focus (contour), désactivé, chargement (l'élément est remplacé par un indicateur, la feuille passe `busy`).

**320 pt et 200 %.** Les libellés passent à la ligne ; l'élément grandit (`minHeight`, jamais `height`). Si la liste dépasse la hauteur maximale, elle défile ; **Annuler** reste visible (dans le pied).

**Accessibilité.** Chaque élément est un bouton ; le titre est l'en-tête de la feuille. L'ordre : titre, actions courantes, actions destructrices, Annuler. L'élément destructeur ne reçoit **jamais** le focus initial. Une action qui ouvre une confirmation (bloquer, rompre) l'annonce dans son libellé (« Bloquer, demande confirmation » est évitée : on ne lit pas de méta-information, la confirmation suffit).

**Enchaîner une action puis une confirmation.** Choisir un élément ferme d'abord la feuille ; `onPress` de l'élément s'exécute **après** la fermeture complète (iOS : `onDismiss` du `Modal` ; Android, où `onDismiss` n'existe pas : après le démontage, au tour de boucle suivant). Sinon, l'ouverture immédiate d'un `ConfirmPanel` échoue silencieusement sous iOS. L'appelant ne gère rien : c'est le composant qui retient l'action choisie.

**Mouvement.** Celui de `BottomSheet`. Pas de mouvement propre aux éléments.

**Textes (menu de conversation).**

| Libellé | fr | en |
|---|---|---|
| Signaler | Signaler cette personne | Report this person |
| Bloquer | Bloquer {name} | Block {name} |
| Rompre | Rompre le match | End the match |
| Annuler | Annuler | Cancel |
| Titre | Actions pour {name} | Actions for {name} |

**Cas limites.** Nom très long dans « Bloquer {name} » : le libellé passe à la ligne. Aucune action disponible (hors ligne) : les éléments sont désactivés avec la raison, jamais une feuille vide. Appui sur Annuler pendant `busy` : ignoré.

**testID.** `<testID>-item-<key>`, `<testID>-cancel`. Défaut : `action-sheet`.

**Props.**

```ts
export interface ActionSheetItem {
  key: string;                                // stable, sert au testID
  label: string;
  description?: string;
  icon?: IconName;
  tone?: 'default' | 'destructive';           // défaut 'default'
  disabled?: boolean;
  disabledReason?: string;                    // lu en accessibilityHint
  onPress: () => void;                        // exécuté après la fermeture complète
}

export interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: ActionSheetItem[];                   // au moins un
  cancelLabel?: string;                       // défaut t('ui.sheet.cancel')
  busy?: boolean;
  error?: string;                             // affiché en Banner d'erreur dans la feuille
  triggerRef?: React.RefObject<unknown>;
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-AS-1 [Jest] : l'ordre de rendu est titre, éléments `default`, éléments `destructive`, Annuler.
- AC-AS-2 [Jest] : l'appui sur un élément appelle `onClose` immédiatement et son `onPress` **après** `onDismiss` du `Modal` (simulé), jamais avant.
- AC-AS-3 [Jest] : un élément `destructive` porte une icône ; son nom accessible contient son libellé seul.
- AC-AS-4 [Jest] : un élément `disabled` expose `disabled`, sa raison dans l'indication, et n'appelle pas `onPress`.
- AC-AS-5 [Jest] : le focus initial est sur le titre, jamais sur un élément destructeur.
- AC-AS-6 [Appareil] : à 200 %, les libellés français les plus longs (« Signaler cette personne », « Rompre le match ») passent à la ligne sans coupure ; Annuler reste atteignable sans défilement.

### 5.3 `ConfirmPanel`

**Rôle.** Confirmer une action qui a une conséquence (bloquer, rompre, fermer une session, révoquer un consentement sensible, supprimer un message). Principe 3 : action destructrice **séparée et confirmée avec la conséquence**. Remplace les confirmations « Confirmer » sans explication (`00-audit-ui.md` P1-9).

**Anatomie.** `BottomSheet` (téléphone) ; sur largeur supérieure à `MAX_CONTENT_WIDTH`, carte centrée. Contenu : titre (la question, avec le nom), **phrase de conséquence** (obligatoire, `Text variant="body"`, `colors.textMuted` interdit pour ce texte : il doit être lisible, on utilise `colors.text`), bannière d'erreur éventuelle, puis les deux boutons empilés pleine largeur.

**Variantes.** `tone="destructive"` : bouton de confirmation `variant="danger"` nommé par l'action et l'objet (« Bloquer Aminata »), icône. `tone="default"` : bouton `primary` (ex. « Quitter sans enregistrer »).

**Ordre et hiérarchie.** Confirmer en haut, Annuler dessous (variante `secondary`), écart `space[3]` ; ou l'inverse sur Android si les conventions de la plateforme l'imposent (décision d'ordre à confirmer sur appareil). Le bouton destructeur n'est **pas** le bouton de focus initial. Aucune confirmation ne se déclenche à l'ouverture.

**États.** Ouvert ; chargement (le bouton de confirmation passe en `loading`, Annuler est désactivé, le fond et le retour Android ne ferment plus) ; erreur (la `Banner` d'erreur apparaît dans le panneau, le panneau reste ouvert, les boutons sont réactivés).

**320 pt et 200 %.** Les boutons passent à la ligne et grandissent ; la conséquence défile avec le contenu ; pied non défilant plafonné par la règle de pied de `ScreenContainer` (45 % de la hauteur de l'écran).

**Accessibilité.** Même base que `BottomSheet`. Le titre est lu en premier, puis la phrase de conséquence (un seul élément texte : titre en en-tête, conséquence juste après), puis Confirmer, puis Annuler. L'erreur est annoncée (R7). Aucun minuteur : la confirmation ne disparaît pas seule.

**Mouvement.** Celui de `BottomSheet`. Aucun effet sur le bouton destructeur (pas de secousse, pas de rouge clignotant).

**Textes.**

| Cas | Élément | fr (plus long) | en |
|---|---|---|---|
| Bloquer | titre | Bloquer {name} ? | Block {name}? |
| Bloquer | conséquence | Cette personne ne verra plus votre profil et ne pourra plus vous écrire. Vous pourrez annuler ce blocage à tout moment dans Réglages, Personnes bloquées. | This person will no longer see your profile and won't be able to message you. You can undo this at any time in Settings, Blocked people. |
| Bloquer | confirmer | Bloquer {name} | Block {name} |
| Rompre le match | titre / conséquence | Rompre le match avec {name} ? / La conversation sera fermée pour vous deux. | End the match with {name}? / The conversation will be closed for both of you. |
| Annuler | bouton | Annuler | Cancel |

Les conséquences ci-dessus sont des **propositions** : elles doivent être alignées mot à mot sur ce que le serveur fait réellement (textes existants du détail de profil, `00-audit-ui.md` P1-9) et validées par le juriste pour tout ce qui touche aux données (suppression, consentements).

**Cas limites.** `name` vide (profil supprimé) : le titre devient « Bloquer cette personne ? » (clé de repli). Nom très long : passe à la ligne, jamais tronqué. Double appui sur Confirmer : un seul appel (`loading` bloque). Réseau absent au moment de confirmer : erreur dans le panneau avec « Réessayer ».

**testID.** `<testID>-confirm`, `<testID>-cancel`, `<testID>-consequence`, `<testID>-error`. Défaut : `confirm-panel`.

**Props.**

```ts
export interface ConfirmPanelProps {
  visible: boolean;
  title: string;
  consequence: string;                      // obligatoire, une à trois phrases
  confirmLabel: string;                     // nomme l'action et l'objet
  cancelLabel?: string;                     // défaut t('ui.sheet.cancel')
  tone?: 'default' | 'destructive';         // défaut 'destructive'
  icon?: IconName;
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
  triggerRef?: React.RefObject<unknown>;
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-CP-1 [Jest] : `consequence` vide ne compile pas ; un rendu sans conséquence échoue au test.
- AC-CP-2 [Jest] : le bouton destructeur est `variant="danger"`, son libellé contient le nom de l'objet, il n'a pas le focus initial.
- AC-CP-3 [Jest] : en `loading`, Annuler est désactivé, le fond ne ferme pas, `onConfirm` n'est pas rappelé au second appui.
- AC-CP-4 [Jest] : `error` affiche une `Banner` d'erreur dans le panneau, annoncée via `announce` (iOS) ou région vivante (Android).
- AC-CP-5 [Jest] : le panneau ne se ferme jamais seul (aucun minuteur).
- AC-CP-6 [Appareil] : conséquence lisible à 200 % et 320 pt sans coupure ; les deux boutons sont visibles ou atteignables par défilement du contenu seul.

### 5.4 `Badge`

**Rôle.** Petit repère d'état ou de compte : **Vérifié**, **Premium**, **intention**, **compteur de non-lus**, **point d'activité**. Remplace les 5 « badges textuels » en `Text` à `fontWeight` écrit à la main (`00-audit-ui.md` 5.5) et le badge qui confondait vérifié et primaire (P1-13).

**Anatomie.** Pastille (`radius.pill`) : icône `sm` facultative + libellé (`type.labelSmall`). Le contenu et la couleur dépendent du `kind`.

**Variantes.**

| `kind` | Contenu | Fond | Texte et icône | Interactif |
|---|---|---|---|---|
| `verified` | icône `BadgeCheck` + « Vérifié » | `colors.surface` avec contour `colors.verified` | `colors.verified` | optionnel : ouvre l'explication |
| `premium` | icône `Sparkles` + « Premium » | `colors.accent` | `colors.onAccent` | non |
| `intent` | libellé de l'intention (« Mariage ») | `colors.accent` | `colors.onAccent` | non |
| `count` | nombre ; « 99+ » au-delà de 99 | `colors.primary` | `colors.onPrimary` | non |
| `dot` | aucun texte ; point de 10 pt | `colors.primary` | sans objet | non |

La couleur n'est jamais le seul indice (R9) : `verified` a une forme d'icône propre et un libellé ; `premium` et `intent` ont un libellé ; `count` a un nombre ; `dot` est toujours accompagné d'une information textuelle portée par son parent (l'étiquette du bouton « Filtres, actifs »). Les contrastes texte / fond de chaque paire sont ceux de `01-direction.md` section 5.2 (texte à 4,5:1 minimum) ; le test de contraste automatique (`00-a11y.md` P1-9) couvre les paires `verified` / `surface`, `onAccent` / `accent`, `onPrimary` / `primary`.

**`verified` et son explication.** Le badge utilise le jeton `colors.verified` (et non `colors.primary`, correction P1-13). Sa version **interactive** (`interactive`) ouvre une `BottomSheet` « Profil vérifié » dont le texte est celui de la décision 7 : « Ce badge confirme que votre selfie correspond à vos photos. Ce n'est pas une garantie d'identité. » (validation juridique requise, P0-4 de l'audit). Sur la carte de découverte, le badge est **non interactif** (la carte entière ouvre le profil) ; sur le détail du profil et sur « Mon profil », il est interactif. Cela remplace l'explication dépliée en ligne de `VerifiedBadge`, qui déformait la mise en page.

**États.** Repos ; appuyé (version interactive : `opacity.pressed`) ; focus (version interactive) ; la variante `count` à zéro n'est **pas rendue**.

**Tailles, 320 pt, 200 %.** Pastille sans hauteur fixe : `minHeight` de 24 pt, `paddingHorizontal: space[2]`, `minWidth` égal à `minHeight` pour `count` (cercle pour 1 chiffre, pilule ensuite). La version interactive est enveloppée dans une zone de 44 pt (`minHeight: MIN_TARGET`). Le texte du badge a un plafond `maxFontSizeMultiplier` de 1,6 (exception R2 documentée : la pastille est contrainte par son contenant) ; le libellé complet figure dans l'étiquette du parent. Dans une rangée avec le nom, le badge passe à la ligne sous le nom (R3).

**Accessibilité.**
- `verified` non interactif : décoratif **dans** la phrase du parent (« Aminata, 28 ans, profil vérifié, … »). Rendu `accessible={false}`.
- `verified` interactif : bouton, nom « Profil vérifié », indication « Touchez deux fois pour savoir ce que ce badge confirme. », `expanded` selon l'ouverture de la feuille.
- `count` : **caché** de l'arbre d'accessibilité ; le parent (onglet, ligne) compose « Messages, 3 messages non lus » avec un pluriel correct.
- `premium`, `intent` : lus comme texte ordinaire dans le parent.

**Mouvement.** Apparition du compteur : aucune animation (un changement de nombre n'est pas un événement de mouvement). Les changements sont annoncés par le parent, pas par le badge.

**Textes.**

| Clé | fr | en |
|---|---|---|
| `ui.badge.verified` | Vérifié | Verified |
| `ui.badge.verifiedHint` | Touchez deux fois pour savoir ce que ce badge confirme. | Double-tap to learn what this badge confirms. |
| `ui.badge.verifiedTitle` | Profil vérifié | Verified profile |
| `ui.badge.verifiedBody` | Ce badge confirme que votre selfie correspond à vos photos. Ce n'est pas une garantie d'identité. | This badge confirms that your selfie matches your photos. It is not a guarantee of identity. |
| `ui.badge.premium` | Premium | Premium |
| `ui.badge.unread_one` / `_other` | {count} message non lu / {count} messages non lus | {count} unread message / {count} unread messages |

**Cas limites.** Compteur 0 : rien. Compteur négatif ou non entier : traité comme 0. Intention absente : le badge `intent` n'est pas rendu. Le libellé d'intention est le texte traduit (« On verra bien », 13 caractères, pas de troncature). Premium est un statut de compte ; son affichage **à d'autres utilisateurs** est une décision de produit non prise : par défaut, `premium` n'apparaît que sur « Mon profil ».

**testID.** `<testID>`, `<testID>-label`, `<testID>-sheet` (feuille d'explication). Défauts : `badge-verified`, `badge-premium`, `badge-intent`, `badge-count`, `badge-dot`.

**Props.**

```ts
export type BadgeProps =
  | { kind: 'verified'; interactive?: boolean; onPress?: () => void; testID?: string }
  | { kind: 'premium'; testID?: string }
  | { kind: 'intent'; label: string; testID?: string }
  | { kind: 'count'; count: number; testID?: string }       // max affiché 99+
  | { kind: 'dot'; testID?: string };
```

**Critères d'acceptation.**
- AC-BDG-1 [Jest] : `verified` utilise `colors.verified` pour le texte et l'icône, `colors.primary` n'apparaît pas dans son style.
- AC-BDG-2 [Jest] : `count` de 0 ne rend rien ; 7 rend « 7 » ; 100 rend « 99+ » ; il est caché de l'arbre d'accessibilité.
- AC-BDG-3 [Jest] : `verified` interactif est un bouton de 44 pt minimum avec `expanded` ; l'appui ouvre une feuille dont le corps contient exactement la clé `ui.badge.verifiedBody` en français et en anglais.
- AC-BDG-4 [Jest] : `verified` non interactif n'est pas focalisable.
- AC-BDG-5 [Jest] : la pastille n'a aucune hauteur fixe (`minHeight` seulement).
- AC-BDG-6 [Appareil] : à 200 %, le badge passe sous le nom sans le couper ; le point `dot` reste visible sur l'icône de filtres.

### 5.5 `MessageBubble` et `DateSeparator`

**Rôle.** Afficher un message de conversation avec son expéditeur, son heure et son état d'envoi, de façon lisible au lecteur d'écran. Corrige `00-audit-ui.md` P1-17 et `00-a11y.md` 1.3.1 (l'expéditeur n'est connu que par l'alignement et la couleur ; aucun horodatage ; `✓✓` pour remis et lu).

**Anatomie.** Rangée alignée à droite (message envoyé) ou à gauche (message reçu) ; bulle (`radius.lg`, coins du côté de l'expéditeur réduits à `radius.sm` pour les messages groupés) ; texte (`type.body`) ; sous la bulle, en `type.caption` : l'heure et l'état. Message envoyé : fond `colors.primary`, texte `colors.onPrimary`. Message reçu : fond `colors.surface`, contour `colors.border`, texte `colors.text`. Largeur maximale : `layout.bubbleMaxWidth` de la largeur de la liste.

**Groupement.** Messages consécutifs du même expéditeur à moins de 5 minutes d'écart : `position` = `first`, `middle`, `last`, `single` ; l'heure n'est affichée que sous le **dernier** de la série ; le groupement n'enlève rien à l'étiquette d'accessibilité, où l'heure figure toujours.

**États d'envoi** (messages envoyés seulement).

| État | Icône | Texte | Quand l'afficher |
|---|---|---|---|
| `sending` | `Clock` | « Envoi en cours » (visible sous la bulle) | toujours |
| `sent` | `Check` | « Envoyé » | dernier message envoyé de la série |
| `delivered` | `CheckCheck` | « Remis » | dernier message envoyé |
| `read` | `CheckCheck` | « Lu » | dernier message envoyé |
| `failed` | `CircleAlert`, `colors.danger` | « Échec de l'envoi » + boutons « Réessayer » et « Supprimer » | toujours |

`delivered` et `read` ont la **même forme** d'icône : c'est le **texte** « Remis » / « Lu » qui les distingue (R9), affiché uniquement sous le dernier message envoyé. Les états précédents (vers le haut de la conversation) sont implicites.

**Séparateur de date.** `DateSeparator` : texte centré (`type.caption`, `colors.textMuted`) entre deux jours ; « Aujourd'hui », « Hier », sinon date complète (jour de la semaine et date ; l'année si elle n'est pas l'année en cours). Rôle d'en-tête de section (`accessibilityRole="header"`) pour la navigation par titres. Dans la liste **inversée** de la conversation, le séparateur d'un jour est rendu *après* (visuellement au-dessus) le dernier message de ce jour dans l'ordre inversé des données.

**Appui long et actions.** Seuls les messages qui ont des actions sont des `Pressable` (corrige le bruit de focus de tous les messages) :
- message reçu : « Copier », « Signaler ce message » (le contexte `message` est prévu par `ReportScreen` mais aucun écran ne l'utilise aujourd'hui) ;
- message envoyé : « Copier » ; si `failed` : « Réessayer », « Supprimer ».

L'appui long ouvre une `ActionSheet` avec ces actions. Les **mêmes** actions sont exposées en actions personnalisées d'accessibilité (`accessibilityActions`) : le lecteur d'écran n'a pas besoin d'appui long (WCAG 2.5.1).

**320 pt et 200 %.** La bulle s'élargit jusqu'à `layout.bubbleMaxWidth` puis le texte passe à la ligne ; un mot ou une adresse très long se coupe au besoin (`flexShrink: 1`, pas de défilement horizontal). L'heure et l'état passent sur deux lignes si la place manque. Hauteur : `minHeight` seulement.

**Accessibilité.** Un seul élément par message (groupe `accessible`, sans bouton enfant : les boutons « Réessayer » et « Supprimer » sont ses frères, R8). Étiquette :
- reçu : « Message de {name}, {time}. {text} »
- envoyé : « Votre message, {time}, {state}. {text} » (l'état est omis s'il n'est pas affiché)

L'ordre de balayage de la liste inversée est **inconnu** à ce jour (`00-a11y.md` 2.4.3) : [Appareil]. L'annonce d'un message entrant se fait au niveau de l'écran (`announce`, « Nouveau message de {name} »), pas dans la bulle.

**Mouvement.** Arrivée d'un nouveau message : fondu de `motion.fast`, sans translation ; mouvement réduit : instantané. Passage `sending` vers `sent` : changement d'icône instantané.

**Textes.**

| Clé | fr (plus long) | en |
|---|---|---|
| `ui.message.a11yReceived` | Message de {name}, {time}. {text} | Message from {name}, {time}. {text} |
| `ui.message.a11ySent` | Votre message, {time}, {state}. {text} | Your message, {time}, {state}. {text} |
| `ui.message.state.sending` | envoi en cours | sending |
| `ui.message.state.sent` | envoyé | sent |
| `ui.message.state.delivered` | remis | delivered |
| `ui.message.state.read` | lu | read |
| `ui.message.state.failed` | échec de l'envoi | failed to send |
| `ui.message.retry` | Réessayer l'envoi | Retry sending |
| `ui.message.discard` | Supprimer le message en échec | Delete the failed message |
| `ui.message.copy` | Copier le message | Copy message |
| `ui.message.report` | Signaler ce message | Report this message |
| `ui.date.today` / `yesterday` | Aujourd'hui / Hier | Today / Yesterday |

Note : le bouton visible « Supprimer » et son nom accessible doivent contenir le même mot (WCAG 2.5.3 ; défaut actuel en anglais, `00-a11y.md` 2.2). Heure : format court local (« 14 h 32 » en français, « 2:32 PM » en anglais) fourni par un formateur partagé, jamais construit à la main.

**Cas limites.**
- Message de plusieurs milliers de caractères : la bulle s'étend, aucune coupe en V1.
- Message vide ou espaces seuls : non rendu (ne doit pas arriver, le serveur refuse).
- Un seul emoji ou texte sans espace : la bulle reste dans sa largeur maximale.
- Nom de l'interlocuteur absent : « Message de cette personne ».
- Hors ligne : les messages envoyés restent `sending` puis passent à `failed` après le délai défini par l'écran ; une `Banner` hors ligne en tête de l'écran explique la situation (voir 6.6).
- Liens dans le texte : **pas** de détection automatique de liens (risque d'hameçonnage ; un lien ne s'ouvre que par décision explicite, hors périmètre).

**testID.** `message-<id>`, `message-<id>-time`, `message-<id>-status`, `message-<id>-retry`, `message-<id>-discard`, `date-separator-<yyyy-mm-dd>`. `<id>` est l'identifiant technique.

**Props.**

```ts
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageBubbleProps {
  id: string;
  text: string;
  mine: boolean;
  peerName?: string;                       // pour l'étiquette des messages reçus
  timeLabel: string;                       // heure déjà formatée pour l'écran
  timeLabelA11y?: string;                  // lecture de l'heure si différente
  status?: MessageStatus;                  // messages envoyés seulement
  showTime?: boolean;                      // dernier de la série
  showStatus?: boolean;                    // dernier message envoyé
  position?: 'single' | 'first' | 'middle' | 'last';
  onCopy?: () => void;
  onReport?: () => void;
  onRetry?: () => void;
  onDiscard?: () => void;
  testID?: string;
}

export interface DateSeparatorProps {
  dateKey: string;                         // 'YYYY-MM-DD'
  label: string;                           // 'Aujourd'hui', 'Hier' ou date
}
```

**Critères d'acceptation.**
- AC-MSG-1 [Jest] : l'étiquette d'un message reçu est exactement « Message de {name}, {time}. {text} » ; celle d'un message envoyé « Votre message, {time}, {état}. {text} ».
- AC-MSG-2 [Jest] : un message sans action n'est pas un `Pressable` ; un message avec actions expose `accessibilityActions` identiques aux entrées de l'`ActionSheet` de l'appui long.
- AC-MSG-3 [Jest] : `delivered` et `read` rendent la même icône et deux textes différents.
- AC-MSG-4 [Jest] : `failed` rend « Réessayer » et « Supprimer » comme boutons frères de la bulle ; chacun a au moins 44 pt ; chacun appelle son rappel.
- AC-MSG-5 [Jest] : l'heure n'est visible que si `showTime` ; l'étiquette l'inclut toujours.
- AC-MSG-6 [Jest] : `DateSeparator` a le rôle d'en-tête ; le libellé « Aujourd'hui » / « Hier » est utilisé pour les deux derniers jours.
- AC-MSG-7 [Jest] : le texte n'a pas de `numberOfLines`.
- AC-MSG-8 [Appareil] : l'ordre de balayage de la liste inversée est cohérent sous VoiceOver et TalkBack ; une bulle de 500 caractères ne déborde pas à 320 pt et 200 %.

### 5.6 `Select` et `CountryPicker`

**Rôle.** Choisir une ou plusieurs valeurs dans une longue liste. Résout le « problème des 68 puces » : aujourd'hui `PreferenceFields.tsx` affiche 34 puces de pays d'origine et 34 de pays de résidence sur la même page (68 cibles de 44 pt, sans recherche, à plus de 25 rangées à 320 pt), réutilisées dans les filtres ; l'édition de profil a deux sélecteurs de 8 cartes. `Select` est le composant générique ; `CountryPicker` en est la spécialisation pays.

**Anatomie.**
1. **Déclencheur** : un champ en lecture (même cadre que `TextField` : étiquette visible au-dessus, cadre `colors.borderStrong`, `minHeight` de `MIN_TARGET + 4`), valeur ou texte d'invite, icône `ChevronDown` à droite. Rôle bouton.
2. **Feuille** (`BottomSheet`) : titre, champ de **recherche** (`TextField` avec icône `Search` et bouton d'effacement `X`), liste défilante de lignes, pied avec le bouton « Terminé » (mode multiple).
3. **Sélection visible hors de la feuille** (mode multiple) : sous le déclencheur, les valeurs choisies sous forme de puces **retirables** (`Chip` avec `X`), 3 au plus, puis « +{n} » qui ouvre la feuille. Les 34 puces permanentes disparaissent.

**Variantes.** `mode="single"` : un appui sur une ligne choisit et ferme. `mode="multiple"` : cases à cocher, « Terminé ({count}) » ferme. `searchable` vrai par défaut dès que la liste a plus de 8 éléments. Options regroupées facultativement (« Pays proches des filtres précédents » est **hors périmètre** : aucun regroupement en V1).

**Recherche.** Insensible à la casse et aux accents (normalisation `NFD` sans diacritiques) ; compare au libellé de la langue active et aux `searchTerms` facultatifs de l'option (exemples : « Ivory Coast » pour « Côte d'Ivoire », « RDC » pour « Congo (RDC) »). Mise à jour à chaque frappe sans appel réseau. Le nombre de résultats est annoncé (R7) avec un antirebond de 500 ms : « {count} pays trouvés ».

**États.**

| État | Rendu |
|---|---|
| Déclencheur au repos, vide | invite (« Choisir un pays ») en `colors.textMuted` |
| Déclencheur rempli | valeur en `colors.text` ; en multiple et sans choix : « Tous les pays » |
| Déclencheur appuyé, focus, désactivé | comme `TextField` (R4, R5) |
| Déclencheur en erreur | cadre et étiquette en `colors.danger`, message sous le champ avec icône `CircleAlert` |
| Ligne choisie | cadre 2 pt `colors.primary`, indicateur (case ou radio) plein, texte semi-gras (R9) |
| Recherche sans résultat | `EmptyState` compact : « Aucun pays ne correspond à « {query} ». » avec le bouton « Effacer la recherche » |
| Chargement des options | `Skeleton` de lignes (si les options viennent du réseau) |

**Tailles, 320 pt, 200 %.** Ligne de la liste : `minHeight` de 56 pt, texte qui passe à la ligne. Le champ de recherche reste en tête de feuille (non défilant) ; le pied « Terminé » reste visible. `FlatList` avec `keyboardShouldPersistTaps="handled"` ; pas de `getItemLayout` (hauteur de ligne variable avec la police).

**Accessibilité.**
- Déclencheur : rôle `button`, nom « {étiquette}, {valeur ou invite} », indication « Ouvre la liste », `expanded` selon la feuille.
- Ligne : rôle `radio` (single) ou `checkbox` (multiple), `checked` ; **aucun** `radiogroup` autour de cases à cocher (contradiction sémantique corrigée en `00-a11y.md` P1-15).
- Focus initial de la feuille : le titre, puis le champ de recherche. **Pas** d'ouverture automatique du clavier (il cacherait la liste ; l'utilisateur de lecteur d'écran y accède en un balayage).
- Après un choix en mode single : fermeture, focus rendu au déclencheur, annonce « {valeur} sélectionné ».
- Puce retirable : bouton « Retirer {valeur} ».

**Mouvement.** Celui de `BottomSheet`. Aucun mouvement dans la liste.

**Textes.**

| Clé | fr (plus long) | en |
|---|---|---|
| `ui.select.placeholder` | Choisir une valeur | Choose a value |
| `ui.select.search` | Rechercher | Search |
| `ui.select.noResults` | Aucun résultat pour « {query} ». | No results for "{query}". |
| `ui.select.clearSearch` | Effacer la recherche | Clear search |
| `ui.select.done` | Terminé | Done |
| `ui.select.doneCount` | Terminé ({count}) | Done ({count}) |
| `ui.select.clearAll` | Tout effacer | Clear all |
| `ui.select.resultCount_one` / `_other` | {count} résultat / {count} résultats | {count} result / {count} results |
| `ui.select.remove` | Retirer {value} | Remove {value} |
| `ui.countryPicker.originLabel` | Pays d'origine | Country of origin |
| `ui.countryPicker.residenceLabel` | Pays de résidence | Country of residence |
| `ui.countryPicker.search` | Rechercher un pays | Search for a country |
| `ui.countryPicker.placeholder` | Choisir un pays | Choose a country |
| `ui.countryPicker.all` | Tous les pays | All countries |
| `ui.countryPicker.found_one` / `_other` | {count} pays trouvé / {count} pays trouvés | {count} country found / {count} countries found |

**Cas limites.**
- Liste de 250 pays : `FlatList` virtualisée, `initialNumToRender` modéré.
- Valeur courante absente de la liste (pays retiré du référentiel) : affichée telle quelle avec avertissement discret ; ne bloque pas l'enregistrement.
- Pays de résidence **verrouillé** par le serveur après l'inscription : le déclencheur passe `disabled` avec une phrase d'explication visible (aujourd'hui, rien ne l'indique avant l'enregistrement, `00-audit-ui.md` 4.7).
- Données de pays : la liste vient du référentiel existant de l'application ; ce composant ne la définit pas. **Pas de drapeaux** (voir 4.3).
- Hors ligne : sans effet, la liste est locale.
- Sélection maximale éventuelle (`maxSelected`) : quand atteinte, les lignes non choisies sont désactivées avec une phrase d'aide visible (« Vous pouvez choisir {max} pays au plus. »).

**testID.** `<testID>-trigger`, `<testID>-sheet`, `<testID>-search`, `<testID>-option-<value>`, `<testID>-done`, `<testID>-clear-all`, `<testID>-selected-<value>`, `<testID>-no-results`. Défaut `country-picker` / `select`.

**Props.**

```ts
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  searchTerms?: string[];
}

type SelectBase<T extends string> = {
  label: string;                         // étiquette visible du champ
  options: SelectOption<T>[];
  placeholder?: string;
  searchable?: boolean;                  // défaut : options.length > 8
  disabled?: boolean;
  disabledReason?: string;               // phrase visible sous le champ
  error?: string;
  sheetTitle?: string;                   // défaut : label
  testID?: string;
};

export type SelectProps<T extends string = string> =
  | (SelectBase<T> & { mode: 'single'; value: T | null; onChange: (value: T) => void })
  | (SelectBase<T> & { mode: 'multiple'; value: T[]; onChange: (value: T[]) => void; maxSelected?: number; emptyLabel?: string });

// CountryPicker = Select avec options de pays, libellés ui.countryPicker.* et emptyLabel 'Tous les pays'.
export type CountryPickerProps = Omit<SelectProps<string>, 'options'> & { countries?: SelectOption[] };
```

**Critères d'acceptation.**
- AC-SEL-1 [Jest] : la page de préférences ne rend plus de `Chip` de pays en permanence (au plus 3 puces de sélection par sélecteur) ; l'ancien nombre de 68 cibles tombe à 2 déclencheurs + les puces choisies.
- AC-SEL-2 [Jest] : la recherche « cote » trouve « Côte d'Ivoire » ; « IVORY » le trouve par `searchTerms` ; la casse et les accents sont ignorés.
- AC-SEL-3 [Jest] : en mode `single`, choisir ferme la feuille, rend le focus au déclencheur et appelle `onChange` une fois ; en `multiple`, la feuille reste ouverte jusqu'à « Terminé ».
- AC-SEL-4 [Jest] : le nombre de résultats est annoncé via `announce` (iOS), une seule fois par rafale de frappes (antirebond).
- AC-SEL-5 [Jest] : lignes en rôle `radio` / `checkbox` selon le mode, sans `radiogroup` en mode multiple ; chaque ligne a `minHeight` de 56 et aucun `numberOfLines`.
- AC-SEL-6 [Jest] : `disabled` expose l'état et la raison est rendue en texte visible.
- AC-SEL-7 [Jest] : zéro résultat rend l'état vide avec « Effacer la recherche » atteignable.
- AC-SEL-8 [Appareil] : à 320 pt et 200 %, la feuille de 34 pays défile sans lag ; le clavier ne masque pas « Terminé ».

### 5.7 `RangeSlider`

**Rôle.** Choisir une plage de nombres (l'âge des profils recherchés dans les préférences et les filtres). Aujourd'hui : deux compteurs à pas de 1 (jusqu'à 81 appuis pour parcourir la plage, `00-audit-ui.md` 4.2) sans rôle ajustable.

**Anatomie.** Rangée de lecture « {min} à {max} ans » (au-dessus, `type.label`), piste de 4 pt, segment sélectionné en `colors.primary`, reste de la piste en `colors.border`, deux **poignées** de 28 pt visibles dans des zones de 44 × 44 pt, contour `colors.borderStrong` (3:1) ; en dessous, les **boutons de précision** « − » et « + » de chaque borne (`IconButton` `Minus`, `Plus`).

**Pourquoi des boutons de précision.** WCAG 2.5.7 exige une alternative au glisser à pointeur unique ; la décision 12 écarte `gesture-handler`. Le curseur est donc construit avec `PanResponder` (cœur de React Native, aucune dépendance) et conserve les deux boutons, qui servent aussi à l'accès par commutateur et au contrôle vocal. Un appui sur la piste déplace la poignée **la plus proche** d'un pas.

**Variantes.** `steppers` (défaut vrai) affiche les boutons. `step` (défaut 1). `minGap` (écart minimal entre bornes, défaut 0). Format de valeur personnalisable (`formatValue`, par défaut « {n} ans »).

**États.**

| État | Rendu |
|---|---|
| Repos | piste, segment, deux poignées |
| Poignée active (en glissement) | poignée en contour 2 pt `colors.primary`, légère mise à l'échelle (`motion.fast`, supprimée si mouvement réduit) |
| Focus (une poignée) | contour `focus.width` autour de la zone de 44 pt |
| Borne atteinte | le bouton « − » ou « + » concerné est désactivé |
| Désactivé | poignées `colors.disabledBg`, segment `colors.disabledText`, état d'accessibilité `disabled` |
| Erreur | sans objet (les bornes sont contraintes) |

**Tailles, 320 pt, 200 %.** La piste occupe la largeur disponible moins `space[4]` de marge de chaque côté pour que les poignées ne sortent pas de l'écran (34 pt de marge minimum). La rangée de lecture passe à la ligne. Les boutons de précision passent sous la piste en colonne à `isNarrow` ; chaque cible reste à 44 pt.

**Accessibilité.** Chaque poignée est un élément distinct, rôle `adjustable`, nom « Âge minimum » / « Âge maximum », `accessibilityValue={{ min, max, now, text: '25 ans' }}` où `min` et `max` sont les limites **autorisées pour cette poignée** (la borne de l'autre poignée moins `minGap`), actions `increment` et `decrement` (pas = `step`, et un pas de 5 sur appui long de la même action est **inutile** : les boutons de précision existent). Chaque changement est annoncé (R7). L'ordre : lecture, poignée minimale, poignée maximale, boutons. Les poignées ne se croisent jamais.

**Mouvement.** Pendant le glissement, la poignée suit le doigt sans animation. Mise à l'échelle de la poignée active : `motion.fast`, supprimée si réduit. Le choix de la poignée à déplacer, quand elles sont superposées, suit la direction du glissement (vers la gauche : la minimale ; vers la droite : la maximale).

**Textes.**

| Clé | fr (plus long) | en |
|---|---|---|
| `ui.range.age` | {min} à {max} ans | {min} to {max} years |
| `ui.range.minAge` | Âge minimum | Minimum age |
| `ui.range.maxAge` | Âge maximum | Maximum age |
| `ui.range.valueYears_one` / `_other` | {n} an / {n} ans | {n} year / {n} years |
| `ui.range.decreaseMin` | Diminuer l'âge minimum | Decrease minimum age |
| `ui.range.increaseMin` | Augmenter l'âge minimum | Increase minimum age |
| `ui.range.decreaseMax` | Diminuer l'âge maximum | Decrease maximum age |
| `ui.range.increaseMax` | Augmenter l'âge maximum | Increase maximum age |

**Cas limites.** Limites de l'application : l'âge minimal d'un compte est 18 ans (produit) et la borne haute est celle du serveur ; le composant reçoit `min` et `max` et ne les invente pas. Les deux bornes égales avec `minGap` à 0 : permis, les poignées sont superposées (zones de 44 pt qui se recouvrent ; le choix suit la direction). Valeur initiale hors des limites : ramenée aux limites. Très petit écran : la marge de la piste ne descend pas sous `space[4]`.

**testID.** `<testID>`, `<testID>-readout`, `<testID>-thumb-min`, `<testID>-thumb-max`, `<testID>-min-decrease`, `<testID>-min-increase`, `<testID>-max-decrease`, `<testID>-max-increase`. Défaut `range-slider`.

**Props.**

```ts
export interface RangeSliderProps {
  min: number;                           // limite basse autorisée
  max: number;                           // limite haute autorisée
  value: [number, number];
  onValueChange: (value: [number, number]) => void;   // à chaque changement
  step?: number;                         // défaut 1
  minGap?: number;                       // défaut 0
  steppers?: boolean;                    // défaut true
  minLabel: string;                      // 'Âge minimum'
  maxLabel: string;                      // 'Âge maximum'
  formatValue?: (n: number) => string;   // défaut: ui.range.valueYears
  formatReadout?: (min: number, max: number) => string; // défaut: ui.range.age
  disabled?: boolean;
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-RNG-1 [Jest] : chaque poignée a le rôle `adjustable`, un nom, `accessibilityValue` avec `now` et `text` ; l'action `increment` fait `value + step`, `decrement` l'inverse ; les poignées ne se croisent pas.
- AC-RNG-2 [Jest] : aux limites, `increment` / `decrement` sont sans effet et les boutons de précision concernés sont désactivés.
- AC-RNG-3 [Jest] : chaque bouton de précision a au moins 44 pt et un nom propre ; chaque changement appelle `announce` (iOS).
- AC-RNG-4 [Jest] : valeur initiale hors limites ramenée dans les limites ; `step` non entier respecté.
- AC-RNG-5 [Jest] : un geste de glissement simulé (`PanResponder`) appelle `onValueChange` avec des valeurs arrondies au pas.
- AC-RNG-6 [Appareil] : le glissement suit le doigt à 60 images/s sur Android d'entrée de gamme (`PanResponder` tourne sur le fil JavaScript : *hypothèse à valider*) ; sinon, retomber sur les boutons de précision seuls et revoir en phase 5.
- AC-RNG-7 [Appareil] : VoiceOver (« réglable », balayage haut/bas) et TalkBack ajustent chaque poignée.

### 5.8 `TabBar`

**Rôle.** Navigation principale à trois onglets : Découvrir, Messages, Mon profil. Remplace la barre par défaut dont les icônes sont des glyphes (`♥ ✉ ☺`), la hauteur fixe à 56 pt et le libellé à 12 pt écrit en dur.

**Anatomie.** Conteneur (fond `colors.bg`, trait supérieur `colors.border`, marge basse = zone sûre) ; trois onglets de largeur égale ; chaque onglet : icône `lg`, libellé (`type.caption`, `type.labelSmall` si actif), pastille facultative sur l'icône. Onglet actif : icône pleine, couleur `colors.primary`, libellé semi-gras **et** un repère de 2 pt en haut de l'onglet (R9 : pas la couleur seule). Onglet inactif : `colors.textMuted`.

**Intégration.** Branché dans `expo-router` par l'option `tabBar` de `Tabs` ; `tabBarHideOnKeyboard` actif. Le composant est dans `ui/` et reçoit une liste d'onglets décrite par des données (pas d'import de `expo-router`, R13) ; `navigation/MainTabs.tsx` fait l'adaptation.

**Variantes.** Aucune. Les trois onglets ont la même structure.

**États d'un onglet.** Repos (inactif), actif, appuyé (`opacity.pressed`), focus (contour), avec pastille, désactivé (non prévu : aucun onglet n'est désactivable).

**Tailles, 320 pt, 200 %.** Hauteur = `minHeight` de `layout.tabBarMinHeight` (au moins 56 pt avec libellé), jamais fixe. Chaque onglet fait au moins 44 pt en largeur et en hauteur (à 320 pt : 106 pt par onglet). Le libellé a un plafond de `maxFontSizeMultiplier` à 1,6 (exception R2 documentée : la barre est contrainte par la plateforme) ; au-delà, le libellé reste complet dans l'étiquette d'accessibilité et sous la loupe de contenu de VoiceOver. Les mots français les plus longs (« Messages », « Mon profil ») tiennent sur une ligne à 320 pt jusqu'à environ 1,6 ; au-delà, le libellé passe sur deux lignes et la barre grandit. [Appareil].

**Accessibilité.** Conteneur `accessibilityRole="tablist"`. Chaque onglet : rôle `tab`, `accessibilityState={{ selected }}`, nom = libellé ; pour Messages avec non-lus : « Messages, 3 messages non lus » (pluriel correct, nombre en clair, jamais « 99+ » : au-delà de 99, « plus de 99 messages non lus »). Le lecteur d'écran annonce lui-même « onglet, 2 sur 3 » ; ne pas l'écrire à la main. La pastille est cachée de l'arbre d'accessibilité (voir `Badge count`). Après un changement d'onglet, le focus va au titre du nouvel écran (`ScreenHeader`, `autoFocusTitle`).

**Mouvement.** Changement d'onglet : bascule d'icône pleine/contour et du repère, `motion.fast`, sans translation ; mouvement réduit : instantané.

**Toast au-dessus de la barre.** La barre publie sa hauteur mesurée (`onLayout`) au `ToastProvider` par `setBottomOffset(height)` ; elle remet 0 au démontage. Voir 5.13.

**Textes.**

| Clé | fr | en |
|---|---|---|
| `tabs.discover` | Découvrir | Discover |
| `tabs.messages` | Messages | Messages |
| `tabs.profile` | Mon profil | My profile |
| `ui.tabbar.unread_one` / `_other` | {count} message non lu / {count} messages non lus | {count} unread message / {count} unread messages |

(les trois premières clés existent déjà.)

**Cas limites.** Aucun message non lu : pas de pastille, étiquette sans mention. Plus de 99 : pastille « 99+ », étiquette « plus de 99 messages non lus ». Clavier ouvert (Android) : barre masquée. iPad : barre centrée à `MAX_CONTENT_WIDTH`. Hors ligne : sans effet sur la barre.

**testID.** `tab-discover`, `tab-messages`, `tab-profile` (conservés pour les tests existants), `tab-messages-badge`, `tabbar`.

**Props.**

```ts
export interface TabBarItem {
  key: 'discover' | 'messages' | 'profile';
  label: string;
  icon: IconName;                        // 'Layers' | 'MessageCircle' | 'User'
  badgeCount?: number;
  accessibilityLabel?: string;           // défaut : label (+ non-lus)
  testID?: string;
}

export interface TabBarProps {
  items: TabBarItem[];                   // exactement 3
  activeKey: TabBarItem['key'];
  onSelect: (key: TabBarItem['key']) => void;
  onHeightChange?: (height: number) => void;   // publie la hauteur au ToastProvider
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-TAB-1 [Jest] : trois onglets en rôle `tab` dans un `tablist` ; seul l'actif a `selected`.
- AC-TAB-2 [Jest] : chaque onglet a `minHeight` et `minWidth` supérieurs ou égaux à `MIN_TARGET`, aucune hauteur fixe.
- AC-TAB-3 [Jest] : l'onglet Messages avec 3 non lus a le nom « Messages, 3 messages non lus » ; avec 1 : « 1 message non lu » ; avec 150 : « plus de 99 messages non lus ».
- AC-TAB-4 [Jest] : l'onglet actif affiche l'icône pleine **et** un repère ; l'inactif ni l'un ni l'autre.
- AC-TAB-5 [Jest] : le libellé porte `maxFontSizeMultiplier`, pas `numberOfLines`.
- AC-TAB-6 [Jest] : `onHeightChange` est appelé après `onLayout`.
- AC-TAB-7 [Appareil] : à 320 pt et 200 %, aucun libellé n'est coupé ni chevauché ; le toast s'affiche au-dessus de la barre.

### 5.9 `ProfileCard`

**Rôle.** Présenter un profil dans la pile de découverte, avec ce qui fait la confiance et la découverte par origine : photo, vérifié, origine, résidence, intention. Corrige : pays d'origine absent de la carte, étiquette d'accessibilité incomplète, carte du dessous lisible par le lecteur d'écran, nom tronqué à 200 %, squelette sans forme de carte.

**Anatomie.** Cadre (`radius.lg`, contour `colors.border`, fond `colors.surface`) contenant : (1) **photo** en tête, ratio 3:4 plafonné par la hauteur disponible, `accessible={false}` et `accessibilityIgnoresInvertColors` ; (2) **bande de texte pleine** sous la photo — le texte n'est jamais posé sur la photo (aucun problème de contraste sur image, `00-a11y.md` note b) ; (3) dans la bande, dans cet ordre : nom et âge (`type.h2`, deux lignes au plus), `Badge verified` (non interactif), ligne **origine** (`Globe` + « Originaire de {pays} »), ligne **résidence** (`MapPin` + « Vit à {ville}, {pays} »), `Badge intent`.

**Actions de la découverte (sous la carte, composant frère `ProfileActions`).** Dans l'ordre visuel et de focus : **Passer**, **Coup de cœur**, **J'aime**.
- **Passer** : `Button variant="neutral"` (nouvelle variante, voir 6.1) : contour `colors.borderStrong`, texte `colors.text`, icône `X`. **Ni rouge ni vert**, ni `dislike` : un « non » est neutre (P2, décision de `01-direction.md` section 4).
- **Coup de cœur** : `IconButton` `lg` `tonal`, icône `Star`, libellé « Coup de cœur ».
- **J'aime** : `Button variant="primary"` avec icône `Heart` : c'est l'**action principale unique** de l'écran (P3). Les jetons `colors.like` et `colors.dislike` restent réservés aux retours visuels du geste (phase 5) et aux libellés d'état ; les boutons n'en dépendent pas. *Choix de conception, révisable par le propriétaire.*
- Écart entre boutons : `space[3]`. À `isNarrow` ou `isLarge`, J'aime passe pleine largeur au-dessus des deux autres (R3).

**Variantes.** `interactive` vrai (carte du dessus) ou faux (carte du dessous : cachée du lecteur d'écran). `density="regular"` ou `"compact"` : `compact` est choisi automatiquement quand `isLarge` et la hauteur de fenêtre est inférieure à 700 pt ; il réduit le ratio de la photo à 1:1 et passe l'origine et la résidence sur une seule ligne.

**États.**

| État | Rendu |
|---|---|
| Repos | photo, bande |
| Appuyée | `opacity.pressed` sur la carte entière |
| Focus | contour `focus.width` autour de la carte |
| Photo en chargement | fond `colors.skeleton` |
| Photo absente ou échec | fond `colors.skeleton`, initiale (`Avatar`) ou icône `User`, texte « Pas de photo » en `colors.textMuted` |
| Chargement du profil | `ProfileCardSkeleton` : bloc photo de même ratio et de même rayon, 3 lignes de largeurs 60 %, 40 %, 30 % (forme de la carte, plus de 4 rectangles génériques) |
| Action en cours | boutons désactivés ; la carte est verrouillée |
| Erreur | l'écran affiche une `Banner` d'erreur au-dessus de la carte ; la carte reste |

**Tailles, 320 pt, 200 %.** Largeur = largeur de contenu moins 2 × `space[4]`, plafonnée à `MAX_CONTENT_WIDTH`. À 320 × 568 et police 100 % la carte remplit la hauteur restante (photo `flex: 1`, `minHeight` de 200 pt) ; à 200 %, la bande seule peut occuper 200 pt : l'écran de découverte défile verticalement (la carte et ses boutons dans le défilement), le geste horizontal de glisser reste sur la carte. Nom : deux lignes puis coupure (R2, exception documentée), le nom complet est dans l'étiquette.

**Accessibilité.**
- La carte du dessus est **un seul** élément : rôle `button`, étiquette composée dans cet ordre : **nom, âge, profil vérifié, origine, résidence, intention**. Exemple : « Aminata, 28 ans, profil vérifié, originaire du Sénégal, vit à Lyon, France, cherche une relation durable. » L'ordre vise la décision de confiance d'abord (vérifié), puis la découverte par origine.
- Indication : « Touchez deux fois pour ouvrir le profil. »
- Actions personnalisées (corrige les 5 existantes) : `activate` (ouvrir), `like` (J'aime), `dislike` (Passer), `super_like` (Coup de cœur), `report` (Signaler).
- La carte du dessous est entièrement cachée : `importantForAccessibility="no-hide-descendants"`, `accessibilityElementsHidden`.
- Ordre de focus : titre de l'écran, carte, Passer, Coup de cœur, J'aime, Annuler le dernier choix (si présent), Signaler. Après une action, le focus passe à la carte suivante et son étiquette est annoncée (R7) ; en fin de pile : « Vous avez tout vu pour le moment. »
- Les boutons sont frères de la carte (R8).

**Mouvement.** Phase 5 : départ de la carte, retour élastique, repères J'aime / Passer. Dès cette phase, le contrat est : toute animation de la carte respecte `useReduceMotion` (aucune rotation, départ immédiat ou fondu) et utilise le pilote natif pour `translateX`/`opacity` ; la rotation sur `Animated.event` du déplacement reste un point à traiter en phase 5 (`00-audit-ui.md` P1-3).

**Textes.**

| Clé | fr (plus long) | en |
|---|---|---|
| `ui.profileCard.origin` | Originaire de {country} | From {country} |
| `ui.profileCard.residence` | Vit à {city}, {country} | Lives in {city}, {country} |
| `ui.profileCard.residenceNoCity` | Vit en {country} | Lives in {country} |
| `ui.profileCard.noPhoto` | Pas de photo | No photo |
| `ui.profileCard.a11y` | {name}, {age} ans, {verified}{origin}, {residence}, {intent}. | {name}, {age}, {verified}{origin}, {residence}, {intent}. |
| `ui.profileCard.a11yVerified` | profil vérifié, | verified profile, |
| `ui.profileCard.hint` | Touchez deux fois pour ouvrir le profil. | Double-tap to open the profile. |
| `discover.action.pass` | Passer | Pass |
| `discover.action.like` | J'aime | Like |
| `discover.action.superLike` | Coup de cœur | Super like |
| `ui.profileCard.end` | Vous avez tout vu pour le moment. | You've seen everyone for now. |

(« Passer », « J'aime » et « Coup de cœur » existent déjà sous leurs clés de découverte ; seules les clés `ui.profileCard.*` sont nouvelles.)

**Cas limites.**
- Prénom très long ou prénoms composés (« Marie-Antoinette Nyambura-Ouédraogo ») : deux lignes, puis coupure ; étiquette complète.
- Noms en plusieurs écritures (arabe, amharique, etc.) : aucune hypothèse sur la première lettre ; la police du système est utilisée ; l'initiale de l'avatar est le premier *graphème* (voir 6.5).
- Pas de ville de résidence : « Vit en {pays} ». Pas d'origine renseignée : la ligne d'origine n'est pas rendue (et n'apparaît pas dans l'étiquette).
- Intention absente (profil ancien) : le badge n'est pas rendu.
- Photo qui échoue : repli sans bloquer l'ouverture du profil.
- Hors ligne : la carte déjà chargée reste affichée ; les actions échouent avec la `Banner` hors ligne de l'écran.
- Âge : toujours un nombre entier ≥ 18, calculé côté serveur ; le composant ne calcule rien.

**testID.** `profile-card`, `profile-card-photo`, `profile-card-name`, `profile-card-verified`, `profile-card-origin`, `profile-card-residence`, `profile-card-intent`, `profile-card-no-photo`, `profile-actions`, `profile-action-pass`, `profile-action-super-like`, `profile-action-like`. Squelette : `profile-card-skeleton`. (Conserver les `testID` des tests existants de la découverte par un alias au premier passage.)

**Props.**

```ts
export interface ProfileCardProps {
  id: string;
  name: string;
  age: number;
  photoUri?: string | null;
  verified: boolean;
  originCountry?: string;                // nom affiché, pas un code
  residenceCity?: string;
  residenceCountry: string;
  intentLabel?: string;                  // libellé traduit de l'intention
  interactive?: boolean;                 // défaut true ; false = carte du dessous
  density?: 'regular' | 'compact';
  onOpen: () => void;
  onLike: () => void;
  onPass: () => void;
  onSuperLike: () => void;
  onReport: () => void;
  testID?: string;
}

export interface ProfileActionsProps {
  disabled?: boolean;
  onPass: () => void;
  onSuperLike: () => void;
  onLike: () => void;
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-PC-1 [Jest] : l'étiquette de la carte interactive contient, dans cet ordre, nom, âge, « profil vérifié » (si vérifié), origine, résidence, intention ; une donnée absente est omise sans virgule double.
- AC-PC-2 [Jest] : la carte `interactive={false}` et tous ses enfants sont cachés de l'arbre d'accessibilité.
- AC-PC-3 [Jest] : les cinq actions personnalisées existent avec leurs noms ; chacune appelle le bon rappel.
- AC-PC-4 [Jest] : le texte du nom a `numberOfLines` à 2 au plus et l'étiquette contient le nom complet ; aucun autre texte n'est tronqué.
- AC-PC-5 [Jest] : « Passer » est un bouton `neutral` (couleurs `borderStrong` et `text`, jamais `dislike`) avec le libellé visible « Passer » ; « J'aime » est le seul bouton `primary` des actions ; la couleur n'est pas le seul indice (icône + texte).
- AC-PC-6 [Jest] : le badge « Vérifié » utilise `colors.verified`.
- AC-PC-7 [Jest] : `ProfileCardSkeleton` rend un bloc photo de ratio 3:4 et trois lignes, un seul nœud d'accessibilité « Chargement ».
- AC-PC-8 [Jest] : sans photo, « Pas de photo » est rendu et la carte reste ouvrable.
- AC-PC-9 [Appareil] : à 320 × 568 et 200 %, le nom, le badge, l'origine, la résidence, l'intention et les trois boutons sont tous atteignables (défilement vertical admis) ; aucune coupure de libellé.

### 5.10 `CallControls`

**Rôle.** Commandes d'appel audio et vidéo : entrée depuis la conversation, et commandes pendant l'appel. **Désactivées par `CALLS_ENABLED`** (`src/config/features.ts`, décision 1 : « on ne montre pas ce qui ne fonctionne pas »). Le code reste construit, testé et masqué.

**Anatomie.** Deux composants :
- `CallEntryButtons` : deux `IconButton` (`Phone`, `Video`) pour l'en-tête de conversation, 44 pt. **Ne rend rien** tant que `CALLS_ENABLED` est faux.
- `InCallControls` : rangée de boutons ronds de 56 pt avec **libellé visible** sous l'icône (`type.caption`) : micro (`Mic` / `MicOff`), caméra (`Video` / `VideoOff`), haut-parleur (`Volume2`), changer de caméra (`SwitchCamera`), et le bouton de fin. Phase entrante : **Accepter** (`primary`) et **Refuser** (`variant="neutral"`, **pas** `danger` : refuser est une action neutre, `00-audit-ui.md` P2-9). Phase active et sortante : **Raccrocher** (`danger`, `PhoneOff`) en dernier de l'ordre de focus, de façon prévisible.

**Garde de fonctionnalité.**
- `CallEntryButtons` lit `CALLS_ENABLED` lui-même : aucun écran ne peut l'afficher par erreur.
- `InCallControls` **ne** dépend **pas** de l'indicateur : il ne doit jamais laisser un utilisateur sans moyen de refuser ou raccrocher s'il est monté. La garde correcte se place **en amont** : tant que `CALLS_ENABLED` est faux, `CallProvider` ne doit pas ouvrir l'écran d'appel pour un appel entrant (point ouvert noté dans `01-lot1-suivi-b.md`, à traiter avec le moteur média).

**États d'un bouton basculable.** Repos (micro actif), basculé (micro coupé : icône barrée **et** étiquette qui change), appuyé, focus, désactivé (pendant la connexion), erreur (permission refusée : voir cas limites).

**Tailles, 320 pt, 200 %.** Cinq boutons de 56 pt + écarts ne tiennent pas sur une ligne à 320 pt : la rangée passe à la ligne (`flexWrap`, R3), trois par ligne ; les libellés (« Haut-parleur », « Changer de caméra ») passent sur deux lignes à 200 %. Le bouton de fin reste toujours visible (pied non défilant, plafonné à 45 % de la hauteur).

**Accessibilité.** Boutons natifs, `accessibilityRole="button"` ; l'étiquette **change** avec l'état (« Couper le micro » ↔ « Réactiver le micro ») et `selected` reflète l'état coupé. Le statut d'appel (« Sonnerie… », « Connecté », « Appel terminé ») est une région vivante polie et annoncé (R7) ; le **chronomètre n'est pas annoncé** chaque seconde. Un appel entrant est annoncé une fois.

**Mouvement.** Aucun mouvement propre ; la sonnerie n'est pas animée. Mouvement réduit : sans effet.

**Textes.**

| Clé | fr (plus long) | en |
|---|---|---|
| `calls.entry.audio` | Appel audio avec {name} | Audio call with {name} |
| `calls.entry.video` | Appel vidéo avec {name} | Video call with {name} |
| `calls.control.muteOn` / `muteOff` | Couper le micro / Réactiver le micro | Mute / Unmute |
| `calls.control.cameraOff` / `cameraOn` | Couper la caméra / Activer la caméra | Turn camera off / Turn camera on |
| `calls.control.speaker` | Haut-parleur | Speaker |
| `calls.control.flip` | Changer de caméra | Switch camera |
| `calls.control.accept` | Accepter | Accept |
| `calls.control.decline` | Refuser | Decline |
| `calls.control.hangup` | Raccrocher | Hang up |

**Cas limites.** Permission micro ou caméra refusée : le bouton concerné passe `disabled` avec un texte visible expliquant comment l'activer, jamais une erreur silencieuse. Pas de réseau : l'appel échoue avec une `Banner`, les boutons restent atteignables. Deux appuis rapides sur Raccrocher : un seul effet. Nom de l'interlocuteur très long : l'étiquette du bouton le contient en entier, rien n'est tronqué.

**testID.** `call-entry-audio`, `call-entry-video`, `call-control-mute`, `call-control-camera`, `call-control-speaker`, `call-control-flip`, `call-control-accept`, `call-control-decline`, `call-control-hangup`.

**Props.**

```ts
export interface CallEntryButtonsProps {
  peerName: string;
  disabled?: boolean;
  onAudio: () => void;
  onVideo: () => void;
}

export type CallPhase = 'incoming' | 'outgoing' | 'active';

export interface InCallControlsProps {
  phase: CallPhase;
  muted: boolean;
  cameraOn: boolean;
  speakerOn: boolean;
  videoCall: boolean;                    // masque les commandes caméra pour un appel audio
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onFlipCamera: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-CALL-1 [Jest] : avec `CALLS_ENABLED` faux (valeur par défaut), `CallEntryButtons` ne rend rien ; avec un simulacre du module à `true` (`jest.mock('../src/config/features', …)`), il rend deux boutons de 44 pt.
- AC-CALL-2 [Jest] : le fichier de l'en-tête de conversation n'affiche jamais les boutons d'appel quand l'indicateur est faux (test de non-régression de `messages.test.tsx`).
- AC-CALL-3 [Jest] : l'étiquette du bouton micro change avec `muted` et expose `selected`.
- AC-CALL-4 [Jest] : « Refuser » n'utilise pas la variante `danger` ; « Raccrocher » est le dernier bouton dans l'ordre de l'arbre.
- AC-CALL-5 [Jest] : `InCallControls` rend toujours accepter/refuser en phase entrante, indépendamment de l'indicateur.
- AC-CALL-6 [Appareil] : à 320 pt et 200 %, tous les boutons sont visibles ; le bouton de fin n'est jamais hors écran.

### 5.11 `ScreenHeader` unifié

**Rôle.** Un seul en-tête pour tous les écrans. Remplace les **4 variantes** actuelles (`00-audit-ui.md` 5.2) : A `BackButton` + titre (8 écrans, marge haute différente d'un écran à l'autre, barre de progression avant ou après le retour), B `ScreenHeader` (22 écrans, deux composants quasi identiques avec le même `testID` `back-button`), C en-tête propre à la conversation (le seul qui déborde à 320 pt), D titre seul d'onglet (Découvrir, Messages, Mon profil).

**Anatomie.**
- Rangée 1 (hauteur `minHeight` de `MIN_TARGET`) : à gauche **retour** (`IconButton` `ChevronLeft`, étiquette « Retour ») ou **fermer** (`X`) ou rien ; à droite jusqu'à **2 actions** (`IconButton`).
- Rangée 2, facultative : `ProgressBar` d'onboarding **toujours ici**, entre la rangée 1 et le titre (position unique pour tous les écrans d'inscription).
- Rangée 3 : titre (`Text` en-tête) puis sous-titre facultatif (`type.caption`, `colors.textMuted`).
- Marges : `space[2]` au-dessus de la rangée 1, `space[3]` sous l'en-tête. Valeurs identiques partout (plus de marges propres à chaque écran).

**Variantes.**

| `variant` | Usage | Titre |
|---|---|---|
| `large` (défaut) | écrans empilés (réglages, Premium, filtres, vérification, signalement, inscription) | `type.title`, sous la rangée 1 |
| `inline` | racines d'onglet (Découvrir, Messages, Mon profil) | `type.h2` dans la rangée 1, pas de retour |
| `identity` | conversation | avatar + nom (`type.h2`, deux lignes ; état « écrit… » ou présence plus tard) à la place du titre |

**États.** Repos ; retour appuyé, focus (R4, R5) ; retour absent sur les écrans racine ; actions désactivées pendant un envoi ; titre en cours de chargement (squelette d'une ligne si le titre dépend d'une donnée, jamais un texte vide).

**320 pt et 200 %.** La rangée 1 ne contient **jamais plus de 3 cibles** (retour + 2 actions) : 3 × 44 pt + 2 × `space[2]` tiennent dans 320 pt. Le titre `large` passe à la ligne sans plafond. En `identity`, avatar et nom passent sur une **seconde rangée** sous les actions dès `isNarrow` ou `isLarge` ; le menu `Ellipsis` est toujours dans la rangée 1 et ne sort jamais de l'écran (corrige `00-audit-ui.md` P0-2). Les appels, quand `CALLS_ENABLED` est vrai, sont les deux actions de droite ; le menu est alors une troisième action (trois cibles à droite au maximum, retour inclus : 4 cibles sont admises seulement en `identity` à `isTiny` avec rangée supplémentaire).

**Accessibilité.** Le titre est un en-tête (`accessibilityRole="header"`). Ordre de focus : retour, actions de droite, titre (ordre visuel de haut en bas). Au premier affichage de l'écran, et à chaque changement d'onglet, le focus d'accessibilité va au titre (`autoFocusTitle`, défaut vrai), y compris sous TalkBack, ce qui répond au manque de titre natif (`headerShown: false`, `00-a11y.md` 2.4.2). Le bouton retour garde le `testID` `back-button` (un seul composant le porte désormais). Le retour utilise le geste système en plus du bouton ; sans historique, repli sur `fallbackHref` fourni par l'appelant.

**Mouvement.** Aucun mouvement propre ; la transition d'écran appartient à la pile de navigation. Titre qui change (ex. chargement vers valeur) : instantané.

**Navigation (R13).** `ScreenHeader` ne connaît pas le routeur : il reçoit `onBack`. Le crochet `useGoBack(fallbackHref)` de `features/common` fournit `() => (router.canGoBack() ? router.back() : router.replace(fallbackHref))` ; les anciens `BackButton` et `ScreenHeader` de `features/common` deviennent des enveloppes d'une ligne puis sont supprimés.

**Textes.**

| Clé | fr | en |
|---|---|---|
| `common.back` | Retour | Back |
| `ui.header.close` | Fermer | Close |
| `ui.header.step` | Étape {current} sur {total} | Step {current} of {total} |

**Cas limites.** Titre très long (« Conditions d'utilisation et politique de confidentialité ») : plusieurs lignes, jamais tronqué. Nom de conversation très long : deux lignes puis coupure dans la rangée `identity`, nom complet dans l'étiquette de l'avatar-et-nom. Pas d'avatar : initiale ou icône `User` (6.5). Hors ligne : l'en-tête ne change pas ; la `Banner` hors ligne est dans le contenu. Premier écran sans historique (lien profond, redémarrage) : retour vers `fallbackHref`, pas vers l'accueil par défaut implicite.

**testID.** `screen-header`, `back-button`, `screen-header-title`, `screen-header-subtitle`, `screen-header-action-<key>`, `screen-header-progress`, `screen-header-identity`.

**Props.**

```ts
export interface ScreenHeaderAction {
  key: string;
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  expanded?: boolean;
  disabled?: boolean;
  badge?: { kind: 'dot' };
}

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  variant?: 'large' | 'inline' | 'identity';       // défaut 'large'
  leading?: 'back' | 'close' | 'none';             // défaut 'back' (sauf inline : 'none')
  onBack?: () => void;                             // obligatoire si leading !== 'none'
  actions?: ScreenHeaderAction[];                  // 2 au plus (3 en identity)
  progress?: { current: number; total: number };
  identity?: { name: string; avatarUri?: string | null; status?: string };
  autoFocusTitle?: boolean;                        // défaut true
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-HDR-1 [Jest] : une seule instance de `back-button` par écran ; rôle `button`, nom « Retour », `minHeight` et `minWidth` ≥ `MIN_TARGET`.
- AC-HDR-2 [Jest] : le titre a le rôle `header` et aucun `numberOfLines` en `large` et `inline`.
- AC-HDR-3 [Jest] : la barre de progression est toujours placée entre la rangée 1 et le titre.
- AC-HDR-4 [Jest] : à `width` 320 et `fontScale` 2 simulés, l'en-tête `identity` rend le nom dans une seconde rangée et le menu dans la première ; la rangée 1 a `flexWrap`.
- AC-HDR-5 [Jest] : le focus d'accessibilité va au titre au montage quand `autoFocusTitle`.
- AC-HDR-6 [Jest] : plus de trois cibles dans la rangée 1 ne compile pas (type) ou lève en développement.
- AC-HDR-7 [Jest] : les 22 écrans de la variante B et les 8 de la variante A sont migrés : une recherche de `BackButton` dans `features/` ne trouve plus que le crochet `useGoBack`.
- AC-HDR-8 [Appareil] : à 320 pt et 200 %, aucun bouton n'est hors écran dans la conversation.

### 5.12 `SelectableSurface` (base de `ChoiceCard`, `Chip`, `CheckboxField`)

**Rôle.** Une seule implémentation de la surface sélectionnable : les trois composants actuels dupliquent l'appui (0,8 en dur), le contour (2 pt sélectionné, 1 pt sinon), le rôle et l'état, la cible de 56 pt (« `+ 12` » écrit à la main) et le coin du `Chip` non protégé par `disabled`. La base garantit R1, R4, R5 et R9 une fois. Elle sert aussi à `PlanCard` (5.14), aux lignes de `Select` (5.6) et aux cartes d'intention.

**Anatomie.** `Pressable` unique (le rôle et l'état sont sur lui) contenant : contenu (libellé, description facultative, `children`) et **indicateur** facultatif.

**Variantes.**

| `shape` | Rôle d'accessibilité | Indicateur | Dérivé de | `minHeight` |
|---|---|---|---|---|
| `card` | `radio` | pastille ronde avec point | `ChoiceCard` | `MIN_TARGET` + marge (56) |
| `pill` | `checkbox` | coche `Check` (`sm`) dans le libellé | `Chip` | `MIN_TARGET` |
| `row` | `checkbox` | case carrée avec coche | `CheckboxField` | 56 |

`role` peut être imposé (une `row` à choix unique devient `radio`). L'indicateur est toujours un second indice en plus du contour et de la couleur (R9).

**États.**

| État | Rendu |
|---|---|
| Repos | contour 1 pt `colors.borderStrong`, fond `colors.surface` |
| Sélectionné | contour `focus.width` (2 pt) `colors.primary`, indicateur plein, libellé semi-gras (`type.label`) |
| Appuyé | `opacity.pressed` (toutes formes, y compris `pill` et `disabled` n'y est plus sensible) |
| Focus | contour `focus.width` en `colors.focus` décalé de `focus.offset` (distinct du contour de sélection) |
| Désactivé | fond `colors.disabledBg`, texte `colors.textMuted`, état d'accessibilité `disabled`, aucun retour d'appui |
| Erreur | contour `colors.danger` + message en dessous porté par le parent (`invalid`) |
| Chargement | sans objet |

**320 pt et 200 %.** `minHeight` seulement ; le libellé passe à la ligne ; `pill` retourne à la ligne dans une rangée `flexWrap` ; `card` et `row` occupent la largeur. L'indicateur garde sa taille.

**Accessibilité.** `accessibilityRole` selon le tableau, `accessibilityState={{ checked, selected, disabled }}` (les deux, comme aujourd'hui, pour `radio`), nom = libellé (+ description : « libellé. description »). L'indicateur est caché (`accessible={false}`, `importantForAccessibility="no-hide-descendants"`). Aucun `radiogroup` autour de cases à cocher.

**Mouvement.** Changement de sélection : contour et indicateur en `motion.fast` (fondu), instantané si réduit.

**Textes.** Les libellés viennent des appelants (intentions, genres, pays, plans). Exemples fr les plus longs : « Relation durable », « On verra bien », « Je ne souhaite pas répondre » (valeur de genre éventuelle : sujet **hors design**, décision 3 : statu quo).

**Cas limites.** Libellé très long : passe à la ligne. Description très longue (consentements) : visible en entier. `onPress` appelé deux fois rapidement : géré par l'appelant (l'état contrôlé gagne). `selected` et `disabled` ensemble : le contour de sélection reste visible, atténué par les couleurs de désactivation.

**testID.** Hérité de l'appelant, parties `<testID>-indicator`.

**Props.**

```ts
export interface SelectableSurfaceProps {
  shape: 'card' | 'pill' | 'row';
  role?: 'radio' | 'checkbox';           // défaut selon la forme
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  invalid?: boolean;
  accessibilityLabel?: string;           // défaut : libellé + description
  children?: React.ReactNode;            // contenu additionnel (prix d'un plan, etc.)
  testID?: string;
  style?: StyleProp<ViewStyle>;
}
// ChoiceCard, Chip et CheckboxField conservent leurs props actuelles : ce sont des enveloppes d'une ligne.
```

**Critères d'acceptation.**
- AC-SS-1 [Jest] : les trois enveloppes conservent leurs tests existants (rôle, `checked`, `disabled`, libellé) sans modification.
- AC-SS-2 [Jest] : la valeur d'opacité d'appui est identique pour les trois (`opacity.pressed`) et `Chip` désactivé n'a plus d'effet d'appui.
- AC-SS-3 [Jest] : `minHeight` ≥ `MIN_TARGET` ; aucune valeur `+ 12` littérale ne subsiste dans les trois fichiers (test par recherche de source, comme le test des couleurs).
- AC-SS-4 [Jest] : l'état sélectionné rend l'indicateur **et** le contour de sélection ; un test d'instantané ne s'appuie pas sur la seule couleur.
- AC-SS-5 [Jest] : le focus (événement simulé) ajoute un contour distinct du contour de sélection.
- AC-SS-6 [Appareil] : un `pill` sélectionné reste lisible en protanopie et en deutéranopie (coche + semi-gras).

### 5.13 `Toast` v2

**Rôle.** Message bref, non bloquant, après une action ou un événement (match, erreur réseau, compte limité). Corrige : disparition en 4 s même avec une action (WCAG 2.2.1), recouvrement de la barre d'onglets et du focus (2.4.11), absence d'annonce sous iOS, un seul toast à la fois (un message perdu).

**Anatomie.** `Banner` (même apparence, icône de variante, texte, action facultative, bouton Fermer `IconButton`) positionnée en bas, au-dessus de la barre d'onglets et du clavier, dans le `ToastProvider` (rendu en dernier, `zIndex.toast`, `pointerEvents="box-none"`).

**Règles de durée (remplacent `DEFAULT_TOAST_DURATION_MS = 4000`).**

| Cas | Comportement |
|---|---|
| Toast **avec action** (ex. « Voir » après un match) | **persistant** : reste jusqu'à l'action, la fermeture ou son remplacement par un toast plus prioritaire |
| Toast d'**erreur** sans action | 10 s au moins, fermeture manuelle |
| Toast d'information ou de succès sans action | 6 s (au lieu de 4) ; 10 s si un lecteur d'écran est actif (`isScreenReaderEnabled`) |
| Appui ou focus sur le toast | le minuteur est suspendu ; il repart à la sortie du focus |

*Hypothèse de conception à valider par test avec un utilisateur de lecteur d'écran* : 6 et 10 s sont des plafonds raisonnables, pas des mesures. Un toast persistant est aussi retiré quand la route qui l'a produit n'est plus affichée **si** l'appelant le demande (`dismissOnNavigate`, défaut faux).

**File d'attente.** Un toast visible à la fois, jusqu'à **3** en attente, par ordre de priorité : erreur, puis toast avec action, puis information. Un toast de même `id` remplace le précédent (pas de doublon). Un message jamais lu ne disparaît pas parce qu'un autre arrive : il attend son tour.

**Position.** `bottom` = zone sûre basse + hauteur publiée par la barre d'onglets (`setBottomOffset`, voir 5.8) + `space[3]` ; si le clavier est ouvert : au-dessus du clavier (écouteurs `keyboardDidShow` / `keyboardDidHide`). Largeur : `left` et `right` à `space[4]`, plafonnée à `MAX_CONTENT_WIDTH` et centrée. Un toast ne masque jamais l'élément qui a le focus : si le focus clavier est sous le toast, le toast remonte (*à vérifier sur appareil*).

**Toast pendant une feuille ouverte.** Une `Modal` couvre le toast : l'appelant affiche l'erreur *dans* la feuille ; tout toast demandé pendant qu'une feuille est ouverte est mis en attente et affiché à la fermeture (le fournisseur connaît l'état par `registerModalOpen(boolean)` appelé par `BottomSheet`).

**États.** Entrant, visible, suspendu (focus), sortant. Variantes : `success`, `error`, `warning`, `info` (icônes `CircleCheck`, `CircleX`, `TriangleAlert`, `Info`).

**Annonce (R7).** À l'apparition : `announce(`${typeLabel}. ${message}`)` sous iOS ; sous Android, région vivante `assertive` pour `error`, `polite` sinon. Aucune annonce répétée au remplacement par le même message.

**Mouvement.** Entrée : fondu et glissement vertical court (`motion.base`, `motion.easing.enter`) ; sortie : fondu (`motion.fast`, `motion.easing.exit`) ; mouvement réduit : fondu seul ou instantané.

**320 pt et 200 %.** Le texte passe à la ligne (plusieurs lignes), le toast grandit vers le haut ; l'action passe sous le texte (comme `Banner`) ; le bouton Fermer reste visible à droite en haut. Si le toast dépasse 40 % de la hauteur de l'écran, il défile en interne.

**Textes.**

| Clé | fr | en |
|---|---|---|
| `ui.toast.dismiss` | Fermer la notification | Dismiss notification |
| `ui.toast.matchAction` | Voir | View |
| `ui.banner.error` / `success` / `warning` / `info` | Erreur / Succès / Attention / Information | Error / Success / Warning / Information |

**Cas limites.** Message de plus de 200 caractères : affiché en entier (défilement interne), jamais coupé. Toast d'action dont l'action échoue : un second toast d'erreur remplace. App en arrière-plan : les minuteurs continuent ; au retour, les toasts périmés (non persistants) sont retirés. Hors ligne : un toast de reconnexion remplace un toast hors ligne identique (même `id`).

**testID.** `toast` (conservé), `toast-action`, `toast-dismiss`, `toast-queue-count` (développement seulement).

**Props (API du fournisseur).**

```ts
export interface ToastOptions {
  id?: string;                           // même id = remplacement
  message: string;
  variant?: BannerVariant;               // défaut 'info'
  actionLabel?: string;
  onAction?: () => void;
  persistent?: boolean;                  // défaut : vrai si actionLabel
  durationMs?: number;                   // ignoré si persistant
  dismissOnNavigate?: boolean;           // défaut false
}

export interface ToastApi {
  show: (options: ToastOptions) => string;     // renvoie l'id
  hide: (id?: string) => void;
  setBottomOffset: (px: number) => void;       // publié par TabBar
  registerModalOpen: (open: boolean) => void;  // publié par BottomSheet
}
```

**Critères d'acceptation.**
- AC-TST-1 [Jest] : un toast avec `actionLabel` n'est pas retiré après 60 s simulées ; sans action, il disparaît après 6 s (10 s en erreur ou lecteur d'écran actif).
- AC-TST-2 [Jest] : deux toasts consécutifs s'affichent l'un après l'autre sans perte ; l'erreur passe avant l'information ; la file ne dépasse pas 3.
- AC-TST-3 [Jest] : même `id` remplace sans doublon ; `hide(id)` retire le bon toast.
- AC-TST-4 [Jest] : `setBottomOffset(56)` place le toast à `insets.bottom + 56 + space[3]` au moins ; `0` ramène à la valeur sans onglets.
- AC-TST-5 [Jest] : `announce` est appelé une fois par toast (iOS simulé) ; en Android, la région vivante est `assertive` pour l'erreur.
- AC-TST-6 [Jest] : en mouvement réduit, aucune animation de translation n'est créée.
- AC-TST-7 [Jest] : `registerModalOpen(true)` met un toast en attente ; `registerModalOpen(false)` l'affiche.
- AC-TST-8 [Appareil] : le toast ne recouvre ni la barre d'onglets ni le bouton focalisé ; lisible à 200 % sur 320 pt.

### 5.14 Blocs de paywall (`PlanCard`, `PriceSummary`, `RenewalDisclosure`, `PaywallLinks`)

**Rôle.** Présenter l'abonnement Premium **honnêtement** (P2, décision 5 : plan de 12 mois présélectionné *à condition* que le prix total, la durée, la date de reconduction et l'option mensuelle restent visibles avec le même poids ; aucun faux compte à rebours ; aucune pression). Conformité des magasins : prix, durée, renouvellement, restauration, gestion, liens légaux. La structure empêche l'oubli : le bouton d'achat ne se rend pas sans résumé de prix.

**Composition de l'écran** (de haut en bas, dans le contenu défilant) :
1. Avantages (liste courte).
2. Une `PlanCard` par offre, au même format et au même poids.
3. `RenewalDisclosure` : texte de reconduction complet, `type.bodySmall` (14 pt, jamais moins).
4. `PaywallLinks` : « Restaurer mes achats », « Gérer mon abonnement », « Conditions », « Confidentialité ».

Dans le **pied fixe**, plafonné à 45 % de la hauteur : `PriceSummary` (une phrase) + le bouton d'achat. La légende longue n'est **pas** dans le pied (corrige `00-audit-ui.md` P0-3 : ~450 pt de pied à 200 %).

**`PlanCard`** (construit sur `SelectableSurface shape="card"`, rôle `radio`).
- Anatomie : durée (« 12 mois »), **prix total de la période** en première ligne (« {total} pour 12 mois »), prix par mois en seconde ligne (« soit {parMois} par mois ») au même corps de texte, `Badge` « Meilleur prix » *uniquement si le calcul à partir des prix de la boutique le justifie* (`savingsPercent` fourni par le calcul, jamais écrit en dur ni arrondi en faveur de l'offre), et, si la boutique l'indique, la mention d'essai (« Essai gratuit de {n} jours, puis {total} ») avec la même graisse que le prix.
- Les plans ont le même format ; le plan présélectionné diffère par le seul état sélectionné (contour et indicateur), **pas** par la taille, la couleur de fond ou le poids du texte. L'option mensuelle n'est jamais atténuée.
- États : repos, sélectionné, appuyé, focus, désactivé (achat en cours), chargement (`Skeleton` de forme `PlanCard`), indisponible (offre non chargée).
- Étiquette d'accessibilité : « {durée}, {total} pour {durée}, soit {parMois} par mois{, meilleur prix}{, essai gratuit de n jours} ».

**`PriceSummary`.** Une phrase juste au-dessus du bouton : « {plan} : {total} pour {durée}, renouvelé automatiquement le {date}. ». Les trois informations (prix, durée, date de reconduction) sont **obligatoires** dans les props.

**`RenewalDisclosure`.** Texte de reconduction : prix, durée, renouvellement automatique, date, moyen de résilier, magasin. Exemple fr (plus long) : « Abonnement de 12 mois à {total}. Il se renouvelle automatiquement chaque année au même prix, le {date}, sauf si vous le résiliez avant cette date dans les réglages de {store}. Vous pouvez le résilier à tout moment ; l'accès Premium reste actif jusqu'à la fin de la période payée. » *(texte à valider par le juriste ; les exigences exactes de l'App Store et de Google Play sont à relire sur leurs pages officielles avant publication.)*

**Bouton d'achat.** Libellé « S'abonner, {total} » (existant). État `loading` pendant l'achat (`loadingLabel` « Achat en cours »), annoncé. L'écran de résultat attend la confirmation du serveur (`PurchaseResultScreen`, déjà conforme).

**`PaywallLinks`.** « Restaurer mes achats » (`Button ghost`, toujours visible, jamais derrière un menu), « Gérer mon abonnement » (ouvre la gestion de la boutique ; affiché si l'utilisateur est abonné, mais le lien existe aussi hors abonnement via les réglages de la boutique), « Conditions d'utilisation » et « Politique de confidentialité » (`useLegalOpener`, avec l'écran de repli explicite si l'adresse manque). Chaque lien : cible de 44 pt, nom accessible explicite.

**États de l'écran.** Chargement des offres (squelettes de `PlanCard`), offres indisponibles (`EmptyState` avec « Réessayer »), achat en cours, abonné (bloc `ManageSubscription`), erreur d'achat (`Banner` d'erreur, achat non débité : « Rien n'a été prélevé. »), hors ligne (`Banner` hors ligne, bouton désactivé avec raison).

**Ce qu'il ne faut jamais ajouter (liste de refus de conception).** Compte à rebours ou « offre limitée », plan mensuel grisé ou petit, case « essai gratuit » précochée, prix barré inventé, « plus que X places », culpabilisation au refus (« Non merci, je préfère rester seul(e) »), bouton de fermeture caché ou minuscule, achat avant lecture du résumé de prix.

**320 pt et 200 %.** Les plans sont en colonne pleine largeur (pas de grille) ; textes en plusieurs lignes ; la divulgation défile ; pied limité à 45 %.

**Textes.**

| Clé | fr (plus long) | en |
|---|---|---|
| `ui.plan.total` | {total} pour {duration} | {total} for {duration} |
| `ui.plan.perMonth` | soit {perMonth} par mois | that's {perMonth} per month |
| `ui.plan.bestValue` | Meilleur prix | Best value |
| `ui.plan.trial` | Essai gratuit de {days} jours, puis {total} | {days}-day free trial, then {total} |
| `ui.plan.a11y` | {duration}, {total} pour {duration}, soit {perMonth} par mois | {duration}, {total} for {duration}, that's {perMonth} per month |
| `ui.paywall.summary` | {plan} : {total} pour {duration}, renouvelé automatiquement le {date}. | {plan}: {total} for {duration}, renews automatically on {date}. |
| `ui.paywall.subscribe` | S'abonner, {total} | Subscribe, {total} |
| `ui.paywall.purchasing` | Achat en cours | Purchase in progress |
| `ui.paywall.restore` | Restaurer mes achats | Restore purchases |
| `ui.paywall.manage` | Gérer mon abonnement | Manage subscription |
| `ui.paywall.terms` | Conditions d'utilisation | Terms of use |
| `ui.paywall.privacy` | Politique de confidentialité | Privacy policy |
| `ui.paywall.noCharge` | Rien n'a été prélevé. | You have not been charged. |

**Cas limites.** Prix localisés par la boutique (devise, séparateurs) : affichés tels que fournis, jamais reconstruits. Une seule offre disponible : une seule carte, présélectionnée. Prix par mois non calculable : ligne omise, jamais estimée. Date de reconduction inconnue (achat pas encore confirmé) : le résumé affiche « renouvelé automatiquement à la fin de la période », jamais une date inventée. Déjà abonné via l'autre plateforme : message explicatif, pas de second achat. Boutique indisponible (émulateur, Expo Go) : `EmptyState`.

**testID.** `plan-card-<planId>`, `plan-card-<planId>-total`, `plan-card-<planId>-per-month`, `plan-card-<planId>-best-value`, `price-summary`, `renewal-disclosure`, `paywall-subscribe`, `paywall-restore`, `paywall-manage`, `paywall-terms`, `paywall-privacy`.

**Props.**

```ts
export interface PlanCardProps {
  planId: string;
  duration: string;                      // '12 mois' (libellé traduit)
  totalPrice: string;                    // déjà localisé par la boutique
  perMonthPrice?: string;
  bestValuePercent?: number;             // fourni par un calcul vérifié, sinon absent
  trialDays?: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  testID?: string;
}

export interface PriceSummaryProps {
  planName: string;
  totalPrice: string;
  duration: string;
  renewalDate?: string;                  // absent = formulation sans date
}

export interface RenewalDisclosureProps {
  totalPrice: string;
  duration: string;
  renewalDate?: string;
  storeName: string;                     // 'l'App Store' | 'Google Play'
}

export interface PaywallLinksProps {
  onRestore: () => void;
  onManage?: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
  restoring?: boolean;
}
```

**Critères d'acceptation.**
- AC-PW-1 [Jest] : toutes les `PlanCard` d'un même écran ont le même `minHeight`, la même `type` de texte pour le prix total et le prix mensuel, et aucune ne reçoit une opacité ou une couleur de texte différente selon qu'elle est sélectionnée ou non (seuls le contour et l'indicateur changent).
- AC-PW-2 [Jest] : le bouton d'achat n'est pas rendu sans `PriceSummary` (le composant d'écran échoue au rendu en développement) ; `PriceSummary` exige prix, durée et nom du plan.
- AC-PW-3 [Jest] : `RenewalDisclosure` a un corps de texte de `type.bodySmall` au moins (14 pt) et n'a pas de `numberOfLines`.
- AC-PW-4 [Jest] : « Restaurer mes achats » est toujours rendu, y compris pendant le chargement des offres et sur l'écran d'erreur.
- AC-PW-5 [Jest] : `bestValuePercent` absent = pas de badge ; une recherche de source ne trouve ni compte à rebours ni minuteur dans `features/premium/`.
- AC-PW-6 [Jest] : l'achat en cours désactive les plans et le bouton, annonce « Achat en cours » et conserve le bouton Restaurer actif.
- AC-PW-7 [Jest] : étiquette de `PlanCard` conforme au modèle, avec prix mensuel et essai quand ils existent.
- AC-PW-8 [Appareil] : à 320 pt et 200 %, le prix total, la durée et la reconduction du plan sélectionné sont visibles au-dessus du bouton sans coupure ; le pied ne dépasse pas 45 % de la hauteur.

## 6. Composants existants à corriger (B)

Chaque fiche donne l'**écart constaté** (code du 2026-11-08), puis la cible. Les props actuelles sont conservées quand c'est possible : les ajouts sont facultatifs, pour que la migration des écrans soit mécanique.

### 6.1 `Button`

**Écart constaté.** Libellé qui passe à la ligne (corrigé au lot 1) ; `hitSlop={4}` qui fait se recouvrir les zones voisines ; opacité d'appui 0,78 en dur ; `borderWidth: 1.5`, `MIN_TARGET + 4`, `fontWeight: '600'` en dur ; aucun état de focus ; aucune icône ; pas de variante neutre (le bouton « Passer » ne peut être ni rouge ni primaire) ; les boutons désactivés n'expliquent pas pourquoi ; rayon fixe `radius.md` (la direction B demande des boutons en pilule).

**Rôle.** Déclencher une action. Un seul bouton `primary` par écran (P3).

**Anatomie.** `Pressable` : [icône `sm`/`md` facultative] [libellé `type.label`, centré, passe à la ligne] ; indicateur de chargement qui remplace l'icône (ou précède le libellé s'il n'y a pas d'icône) sans changer la largeur du bouton.

**Variantes.**

| Variante | Fond | Texte et icône | Contour | Usage |
|---|---|---|---|---|
| `primary` | `colors.primary` | `colors.onPrimary` | aucun | action principale |
| `secondary` | transparent | `colors.primary` | 2 pt `colors.primary` (le contour fin tombe sous 3:1 en plein soleil, `01-direction.md` section 5.2) | action alternative |
| `neutral` (nouveau) | transparent | `colors.text` | 2 pt `colors.borderStrong` | « Passer », « Refuser », « Annuler » : action neutre |
| `ghost` | transparent | `colors.primary` | aucun | lien et action tertiaire |
| `danger` | `colors.danger` | `colors.onPrimary` | aucun | action destructrice **confirmée** seulement |

*Contrôle à faire en phase 2* : la paire `onPrimary` sur `danger` doit atteindre 4,5:1 dans les deux thèmes (test de contraste automatique, `00-a11y.md` P1-9) ; sinon un jeton `onDanger` est créé.

**États.**

| État | Rendu |
|---|---|
| Repos | selon la variante |
| Appuyé | `opacity.pressed` |
| Focus | contour `focus.width` en `colors.focus`, décalage `focus.offset` |
| Désactivé | fond `colors.disabledBg` et texte `colors.disabledText` (`ghost` : transparent + `colors.disabledText`), état d'accessibilité `disabled`, **`disabledReason`** lu en indication |
| Chargement | spinner + libellé (ou `loadingLabel`), `busy`, appuis ignorés, largeur inchangée |
| Erreur | sans objet (l'erreur est portée par l'écran) |

**Tailles.** `md` (défaut) : `minHeight` de `MIN_TARGET + 4` (48), `paddingHorizontal: space[5]`, `paddingVertical: space[3]`. `sm` : `minHeight` de `MIN_TARGET` (44), `paddingHorizontal: space[4]`, pour les boutons dans une ligne. `fullWidth` (défaut faux) : s'étire. Rayon : `radius.control`. `minWidth` de `MIN_TARGET`. **Retirer `hitSlop`** (R1).

**320 pt et 200 %.** Aucun `numberOfLines` ; le libellé passe à autant de lignes que nécessaire (« Envoyer pour vérification » sur 3 lignes à 200 % sur 320 pt) ; la hauteur grandit (`minHeight`). Une rangée de deux boutons passe en colonne dès `isNarrow` ou `isLarge` (R3) : c'est `FooterActions` (section 9.2) qui le fait, pas le bouton. Avec `radius.control` en pilule, un libellé sur 3 lignes garde au moins `space[5]` de marge latérale : [Appareil] pour confirmer que les coins n'écrasent pas le texte.

**Accessibilité.** Rôle `button`, nom = `accessibilityLabel ?? label` (ou `loadingLabel` en chargement), `disabled` et `busy`. `disabledReason` devient l'`accessibilityHint` quand le bouton est désactivé et la raison est **aussi** affichée par l'écran en texte visible (P2-4 de l'audit : le texte visible sous le bouton, pas seulement l'indication). `expanded` facultatif pour un bouton qui ouvre un menu.

**Mouvement.** Aucun (appui par opacité). Le spinner système est un indicateur essentiel, conservé même en mouvement réduit.

**Textes (libellés longs).** fr : « Envoyer pour vérification », « Restaurer mes achats », « Créer mon compte gratuitement » ; en : « Submit for verification », « Restore purchases ».

**Cas limites.** Libellé vide : refusé par le type (chaîne non vide). Libellé d'un seul mot très long (« Authentification ») : se coupe au besoin plutôt que de déborder (`flexShrink: 1`). `icon` seul sans libellé : interdit, c'est `IconButton`. Double appui : ignoré pendant `loading`.

**testID.** Hérité ; `<testID>-spinner` conservé.

**Props.**

```ts
export type ButtonVariant = 'primary' | 'secondary' | 'neutral' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;               // défaut 'primary'
  size?: 'md' | 'sm';                    // défaut 'md'
  icon?: IconName;                       // à gauche du libellé
  fullWidth?: boolean;                   // défaut false
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  expanded?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}
```

**Critères d'acceptation.**
- AC-BTN-1 [Jest] : les tests existants de `Button` restent verts (rôle, couleurs claires et sombres, `disabled`, `loading`, appel unique).
- AC-BTN-2 [Jest] : plus de `hitSlop` ; `minHeight` ≥ 48 en `md` et ≥ 44 en `sm` ; `minWidth` ≥ `MIN_TARGET`.
- AC-BTN-3 [Jest] : le texte n'a pas de `numberOfLines` ; il a `flexShrink: 1`.
- AC-BTN-4 [Jest] : `neutral` utilise `colors.borderStrong` (contour) et `colors.text` (texte), jamais `colors.dislike`.
- AC-BTN-5 [Jest] : `disabled` avec `disabledReason` expose la raison en `accessibilityHint`.
- AC-BTN-6 [Jest] : le focus simulé ajoute un contour `focus.width` / `colors.focus` ; l'opacité d'appui vaut `opacity.pressed`.
- AC-BTN-7 [Jest] : en `loading`, la largeur du conteneur ne change pas (le spinner prend la place de l'icône ou une zone réservée).
- AC-BTN-8 [Jest] : plus aucune valeur numérique de `borderWidth` ni `fontWeight` littérale dans `Button.tsx` (test par recherche de source).
- AC-BTN-9 [Appareil] : à 320 pt et 200 %, aucun libellé n'est coupé ; le contour de focus est visible au clavier externe sur iOS et Android.

### 6.2 `TextField`

**Écart constaté.** Étiquette en `caption` et `fontWeight` en dur ; `fontSize: 16` en dur dans l'entrée ; le message d'erreur n'est transmis que par `accessibilityHint` (peut être désactivé dans VoiceOver, silencieux sous iOS : `00-a11y.md` 1.3.1, 3.3.1) ; pas de compteur ; le texte « Afficher » du bouton de mot de passe n'a pas d'icône ni d'état ; l'erreur n'est pas annoncée ; helper masqué quand il y a une erreur ; pas de marque « facultatif » ; l'étiquette est lue deux fois (`P2-5`) ; 2 pt de contour en focus et en erreur : bon, à conserver.

**Rôle.** Saisie de texte, mot de passe, multiligne.

**Anatomie.** (1) étiquette visible *au-dessus* (jamais flottante, jamais seulement un placeholder) avec la marque « (facultatif) » quand le champ est facultatif ; (2) cadre : `minHeight` de `MIN_TARGET + 4`, contour 1 pt `colors.borderStrong`, 2 pt au focus (`colors.primary`) et en erreur (`colors.danger`), fond `colors.surface`, rayon `radius.control` ; dans le cadre : icône de tête facultative, entrée (corps `type.body`), actions de queue (effacer `X`, mot de passe `Eye`/`EyeOff` en `IconButton`) ; (3) sous le cadre, de haut en bas : **message d'erreur** (icône `CircleAlert` + texte `colors.danger`), **aide** (`type.caption`, `colors.textMuted`), **compteur** (« 123/500 », aligné à droite).

L'aide reste **toujours visible** même s'il y a une erreur (la règle du mot de passe, par exemple, ne disparaît pas au moment où l'on en a besoin) ; l'erreur s'affiche au-dessus.

**Variantes.** `multiline` (hauteur minimale de 96 pt, extensible), `secureTextEntry` (avec bascule), `optional`, avec ou sans compteur (`maxLength`), `invalid` sans message (le message est porté par le parent, déjà utilisé par la date de naissance).

**États.**

| État | Rendu |
|---|---|
| Repos | contour 1 pt `colors.borderStrong` |
| Focus | contour 2 pt `colors.primary` ; pas de contour de focus additionnel (le contour de focus **est** celui-ci) |
| Rempli | texte `colors.text` |
| Erreur | contour 2 pt `colors.danger`, étiquette `colors.danger`, message avec icône |
| Désactivé | fond `colors.disabledBg`, texte `colors.disabledText`, `disabled` |
| Lecture seule | pas d'état séparé en V1 |
| Chargement (validation asynchrone) | non prévu en V1 |

**Compteur.** Visible dès que `maxLength` est fourni. Son étiquette d'accessibilité : « {count} caractères sur {max} » ; **annonce** (R7) seulement aux seuils de 90 % et de 100 %, jamais à chaque frappe.

**320 pt et 200 %.** Étiquette, aide, erreur passent à la ligne sans plafond ; l'entrée garde `minHeight` ; le compteur passe sous l'aide s'il ne tient pas à droite. La rangée de trois champs de date (Jour, Mois, Année) conserve sa propre règle (colonne à `isNarrow` si besoin).

**Accessibilité.**
- Nom de l'entrée : l'étiquette ; **avec erreur** : « {étiquette}, {erreur} » (l'erreur est dans le nom, pas dans l'indication seulement). Indication : l'aide.
- L'étiquette visible est masquée de l'arbre (`accessible={false}`) pour éviter la double lecture.
- À l'apparition de l'erreur : `announce(`${label}. ${error}`)` (iOS) ; région vivante polie (Android).
- À la soumission avec des erreurs, le formulaire déplace le focus sur le **premier champ en erreur** : aide `useFocusFirstInvalid(refs)` (nécessite `inputRef`, déjà présent).
- `returnKeyType` et `onSubmitEditing` doivent être renseignés par les formulaires (P1-2 de `00-a11y.md`).
- Bascule du mot de passe : `IconButton` (`Eye`/`EyeOff`), étiquette qui change (« Afficher le mot de passe » / « Masquer le mot de passe »), `selected` quand le mot de passe est visible ; plus de texte « Afficher » de 13 pt.

**Mouvement.** Contour au focus et en erreur : changement instantané (pas de transition). Pas d'animation du compteur.

**Textes.**

| Clé | fr (plus long) | en |
|---|---|---|
| `ui.field.optional` | (facultatif) | (optional) |
| `ui.field.counter` | {count}/{max} | {count}/{max} |
| `ui.field.counterA11y` | {count} caractères sur {max} | {count} of {max} characters |
| `ui.field.clear` | Effacer | Clear |
| `auth.password.show` / `hide` | Afficher le mot de passe / Masquer le mot de passe | Show password / Hide password |
| Exemple d'erreur | Saisissez une adresse e-mail valide, par exemple prenom@exemple.fr. | Enter a valid email address, for example name@example.com. |

(le texte d'erreur doit dire *comment corriger*, WCAG 3.3.3.)

**Cas limites.** Texte collé de 10 000 caractères : coupé à `maxLength` ; le compteur annonce la limite. Mot de passe : gestionnaire de mots de passe non bloqué (`autoComplete`, collage permis). Texte saisi dans une autre écriture : aucune restriction de caractères sauf règle serveur. Clavier ouvert à 320 pt : le champ est dans une zone défilante avec `keyboardShouldPersistTaps="handled"`. Hors ligne : sans effet.

**testID.** `<id>` (entrée), `<id>-label`, `<id>-error`, `<id>-helper`, `<id>-counter`, `<id>-toggle` (mot de passe), `<id>-clear`.

**Props (ajouts à l'interface actuelle, tout est facultatif).**

```ts
export interface TextFieldProps /* étend les props actuelles */ {
  optional?: boolean;                    // ajoute la marque « (facultatif) »
  maxLength?: number;                    // affiche le compteur
  showCounter?: boolean;                 // défaut : maxLength !== undefined
  leadingIcon?: IconName;
  clearable?: boolean;                   // IconButton « Effacer » quand value non vide
  // conservés : label, value, onChangeText, error, helper, disabled, multiline, invalid,
  //             passwordToggleLabels, inputRef, testID, containerStyle, returnKeyType, onSubmitEditing…
}
```

**Critères d'acceptation.**
- AC-TF-1 [Jest] : tests existants (libellé, erreur, désactivé, mot de passe, `invalid`) restent verts.
- AC-TF-2 [Jest] : avec `error`, le nom accessible de l'entrée est « {label}, {error} » ; `announce` est appelé une fois à l'apparition (iOS simulé) ; l'étiquette visible n'est pas un nœud d'accessibilité.
- AC-TF-3 [Jest] : l'aide reste rendue quand l'erreur est présente ; l'erreur précède l'aide dans l'arbre.
- AC-TF-4 [Jest] : le message d'erreur contient une icône et du texte (couleur non seule).
- AC-TF-5 [Jest] : avec `maxLength`, le compteur affiche « n/max », son étiquette est « n caractères sur max », et `announce` n'est appelé qu'à 90 % et à 100 %.
- AC-TF-6 [Jest] : la bascule du mot de passe est un `IconButton` de 44 pt ; son nom change avec l'état ; `selected` est vrai quand le mot de passe est affiché.
- AC-TF-7 [Jest] : aucune taille de police ni graisse littérale ; l'entrée prend sa taille dans `type.body`.
- AC-TF-8 [Jest] : `optional` ajoute « (facultatif) » à l'étiquette visible **et** au nom accessible.
- AC-TF-9 [Appareil] : saisie en 200 % sur 320 pt : étiquette, erreur et aide lisibles, rien n'est coupé ; le focus clavier externe est visible.

### 6.3 `SwitchRow`

**Écart constaté.** Corrigé au lot 1 : la ligne est un `Pressable` (hauteur 56) qui bascule la valeur ; le `Switch` natif est le seul nœud d'accessibilité (nom = étiquette, indication = description) et le texte visuel est caché de l'arbre. Reste : (a) le nœud accessible est le petit `Switch` natif (~51 × 31 pt sous iOS), donc le focus de Switch Control et de Voice Access cible une zone plus petite que la ligne ; (b) aucun état de focus ni d'appui ; (c) pas d'état « en cours » pour une bascule optimiste ; (d) bordure et rayon en dur.

**Rôle.** Activer ou désactiver un réglage (confidentialité, notifications, consentements, filtre « profils vérifiés »).

**Anatomie.** Ligne : texte à gauche (étiquette `type.label`, description `type.caption` `colors.textMuted`), interrupteur à droite ; trait inférieur `colors.border`.

**Cible (conception).** **La ligne entière est l'élément d'accessibilité** : rôle `switch`, `accessibilityState={{ checked, disabled, busy }}`, nom « {étiquette} », indication = description. Le `Switch` natif devient **décoratif** (`accessible={false}`, `importantForAccessibility="no-hide-descendants"`). C'est le modèle de `00-a11y.md` P1-7 ; il donne un élément de 56 pt de haut à tous les outils d'assistance. Le comportement actuel du lot 1 est correct pour VoiceOver et TalkBack ; ce changement vise Switch Control et Voice Access (« Appuyer sur Notifications »). *À confirmer sur appareil avant de remplacer.*

**Variantes.** Avec ou sans description. Avec `loading` (bascule en cours côté serveur). Avec `disabledReason` (réglage verrouillé).

**États.**

| État | Rendu |
|---|---|
| Repos, activé | piste `colors.primary`, poignée `colors.surface` |
| Repos, désactivé (valeur fausse) | piste `colors.borderStrong`, poignée `colors.surface` (la position de la poignée est le second indice, R9) |
| Appuyé | `opacity.pressed` sur la ligne |
| Focus | contour `focus.width` sur la ligne |
| Inactif (`disabled`) | `opacity.disabled`, état d'accessibilité `disabled`, raison visible |
| Chargement | le `Switch` est remplacé par un indicateur ; `busy` ; appuis ignorés |
| Erreur | l'écran reprend la valeur précédente (retour arrière optimiste) et affiche une `Banner` d'erreur ; la ligne ne change pas d'apparence |

**320 pt et 200 %.** Étiquette et description passent à la ligne et poussent la hauteur (`minHeight` de `MIN_TARGET + 12`) ; l'interrupteur reste à droite, aligné au centre vertical de la ligne, taille fixe ; il ne se réduit pas.

**Accessibilité.** Une seule vocalisation : « {étiquette}, interrupteur, activé ». L'annonce du changement est faite par le lecteur d'écran lui-même ; la description est dans l'indication. En cas d'échec de la bascule, la `Banner` d'erreur est annoncée (R7).

**Mouvement.** Poignée du `Switch` natif (plateforme). Réduit : géré par la plateforme.

**Textes.** fr : « Afficher mon profil dans la découverte », description « Votre profil n'apparaît plus aux autres personnes tant que cette option est désactivée. » (exemple de description longue ; *à aligner sur le réglage réel*) ; en : « Show my profile in Discover ».

**Cas limites.** Description de 3 lignes à 200 % : la ligne grandit. Réglage lié à un consentement sensible : la révocation passe par un `ConfirmPanel` (5.3), pas par une bascule directe. Hors ligne : la bascule échoue avec la `Banner` hors ligne, valeur précédente restaurée.

**testID.** `<testID>` (conservé sur le `Switch` actuel : au premier passage, garder `<testID>` sur l'élément accessible et `<testID>-row` sur la ligne), `<testID>-description`.

**Props.**

```ts
export interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;                     // nouveau
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-SW-1 [Jest] : un appui sur le **libellé** bascule la valeur ; un appui sur le `Switch` bascule aussi ; un appel de `onValueChange` par appui.
- AC-SW-2 [Jest] : il n'y a qu'un nœud d'accessibilité par ligne, de rôle `switch`, avec `checked` ; son nom est le libellé ; l'indication est la description.
- AC-SW-3 [Jest] : `minHeight` de la ligne ≥ `MIN_TARGET + 12`.
- AC-SW-4 [Jest] : `disabled` ignore l'appui, expose l'état et rend la raison en texte visible ; `loading` expose `busy` et ignore l'appui.
- AC-SW-5 [Jest] : le focus simulé dessine le contour ; l'appui utilise `opacity.pressed`.
- AC-SW-6 [Appareil] : Switch Control iOS et Voice Access Android atteignent la ligne en un arrêt et la basculent.

### 6.4 `ListRow`

**Écart constaté.** Chevron `›` en glyphe ; opacité d'appui 0,7 ; `numberOfLines={2}` sur le libellé et la description (coupure à 200 %) ; ligne statique `accessible` sans rôle ; aucune zone de focus ; valeur à droite en `caption` ; la ligne de langue et d'autres lignes de réglages ne l'utilisent pas.

**Rôle.** Ligne de liste (réglages, conversations, sessions, personnes bloquées) : cible de 56 pt, chevron si elle mène quelque part.

**Anatomie.** [leading : avatar ou icône `md`] [libellé `type.label` + description `type.caption`] [valeur] [trailing : badge, bouton] [chevron `ChevronRight` si `onPress`].

**Variantes.** `tone="default" | "danger"` (la gravité vient de la couleur **et** d'une icône `leading` facultative, R9) ; avec ou sans `onPress` ; avec `trailing` (le contrôle de droite est un frère du groupe, jamais enfermé : déjà géré, à conserver).

**États.** Repos, appuyé (`opacity.pressed`), focus (contour), désactivé (`disabled` + raison), chargement (`Skeleton` de ligne via `AsyncView`), erreur (sans objet : l'écran).

**320 pt et 200 %.** **Retirer** `numberOfLines={2}` : libellé et description passent à autant de lignes que nécessaire (`previewLines?: number` n'existe que pour les lignes de conversation, où l'aperçu du message est limité à 2 lignes et le texte complet est dans l'étiquette). La valeur passe sous le libellé à `isLarge` si elle ne tient pas à droite. Le chevron garde sa taille.

**Accessibilité.** Cliquable : un seul bouton « {libellé}. {description} », valeur lue en dernier (« {libellé}, {valeur} »). Statique sans `trailing` : `accessible` groupé, rôle `text`. Statique avec `trailing` : non groupé (chaque enfant atteignable). Le chevron est caché. Conversation : l'étiquette est « {nom}, {aperçu}, {heure}, {n} messages non lus ».

**Mouvement.** Aucun.

**Textes.** fr : « Conditions d'utilisation », « Gérer mes sessions », valeur « Français » ; danger : « Supprimer mon compte ».

**Cas limites.** Libellé de 80 caractères : 3 lignes. Aucun avatar : voir 6.5. Valeur très longue : passe sous le libellé. Hors ligne : la ligne reste cliquable ; l'écran cible affiche son propre état hors ligne.

**testID.** Hérité ; `<testID>-chevron` (développement).

**Props (ajouts facultatifs).**

```ts
export interface ListRowProps /* étend les props actuelles */ {
  leadingIcon?: IconName;                // alternative à leading
  disabled?: boolean;
  disabledReason?: string;
  previewLines?: number;                 // seulement pour l'aperçu d'un message
}
```

**Critères d'acceptation.**
- AC-LR-1 [Jest] : les tests existants (rôle, étiquette, `trailing` atteignable) restent verts.
- AC-LR-2 [Jest] : le libellé et la description n'ont pas de `numberOfLines` sauf avec `previewLines`.
- AC-LR-3 [Jest] : le chevron est une `Icon`, cachée de l'arbre d'accessibilité.
- AC-LR-4 [Jest] : `minHeight` ≥ `MIN_TARGET + 12` ; l'opacité d'appui vaut `opacity.pressed`.
- AC-LR-5 [Jest] : `tone="danger"` colore en `colors.danger` et est accompagné d'une icône ou d'un libellé explicite.
- AC-LR-6 [Appareil] : les libellés les plus longs de Réglages passent à la ligne à 200 % sur 320 pt, rien n'est coupé.

### 6.5 `Avatar`

**Écart constaté.** `Image` sans gestion d'échec ; l'initiale est `name.trim().charAt(0)` (casse les caractères hors plan de base et les emoji) ; tailles libres (36, 48, 120, 140 écrites à la main) ; aucun contour ni anneau ; aucun état « en ligne » ; décoratif (bon) mais pas d'option pour le rendre actionnable.

**Rôle.** Représenter une personne : photo, sinon initiale, sinon icône. Prévu pour accueillir l'anneau de story et la présence plus tard, **sans** les afficher aujourd'hui.

**Anatomie.** Cercle (`radius.pill`), fond `colors.skeleton`, contenu : photo ou initiale (`type.label`, `colors.textMuted`) ou icône `User` ; anneau facultatif (contour autour du cercle avec un écart de `space[1]`) ; point de présence facultatif en bas à droite.

**Variantes.** Tailles : `sm` (jeton `avatarSize.sm`), `md` (48), `lg` (72), `xl` (120, match et appel). **Anneau de story** (futur) : `ring="unseen" | "seen"` → contour 3 pt, `colors.primary` pour une story non vue, `colors.borderStrong` pour une story vue ; ces deux états sont aussi distingués par l'étiquette d'accessibilité (« story non vue ») car la couleur ne suffit pas (R9) ; avec `onPress`, l'avatar devient un bouton de 44 pt minimum. **Présence** (futur) : `presence="online" | "away"` → point de 12 pt `colors.success` ou `colors.warning` avec contour `colors.bg` ; étiquette « en ligne » ; **n'est rendu que si l'utilisateur concerné autorise l'affichage de sa présence** (confidentialité, réglage à créer ; absent = rien).

**États.** Photo en chargement (fond `colors.skeleton`, initiale), photo chargée (fondu de `motion.base`, supprimé si mouvement réduit), photo en échec (initiale ou icône), sans photo (initiale ou icône), focus/appuyé (seulement avec `onPress`).

**320 pt et 200 %.** Taille fixe en points (ce n'est pas du texte) ; l'initiale grandit avec la police dans les limites du cercle (plafond `maxFontSizeMultiplier` de 1,3 sur l'initiale pour qu'elle reste dans le cercle).

**Accessibilité.** Décoratif par défaut : `accessible={false}` (le nom est dans le texte voisin). Avec `onPress` : bouton avec `accessibilityLabel` obligatoire (« Voir la story de {name} », « Voir le profil de {name} »). `accessibilityIgnoresInvertColors`.

**Mouvement.** Fondu d'apparition de la photo (`motion.base`) ; rien d'autre.

**Initiale.** Premier *graphème* du nom : `Array.from(name.trim())[0]` en minuscules/majuscules selon la langue (`toLocaleUpperCase(locale)`). Nom vide ou fait de symboles : icône `User`. Aucune hypothèse sur l'écriture (latin, arabe, caractères accentués).

**Textes.** `ui.avatar.story` « Voir la story de {name} » / « View {name}'s story » ; `ui.avatar.storySeen` « story déjà vue » ; `ui.avatar.online` « en ligne » / « online ».

**Cas limites.** Nom très long : sans effet sur l'avatar. Pas d'avatar et pas de nom : icône `User`. URL de photo invalide ou 404 : repli sans erreur visible. Hors ligne : la photo en cache éventuelle ou l'initiale. Image volumineuse : le backend devrait servir une miniature (P2-1 de l'audit, hors périmètre ; `expo-image` examiné en phase 5).

**testID.** Hérité ; `<testID>-ring`, `<testID>-presence`, `<testID>-initial`.

**Props.**

```ts
export interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';      // défaut 'md' ; le nombre brut reste accepté pendant la migration
  ring?: 'none' | 'unseen' | 'seen';     // défaut 'none' (non utilisé en V1)
  presence?: 'online' | 'away';          // défaut absent (non utilisé en V1)
  onPress?: () => void;
  accessibilityLabel?: string;           // obligatoire si onPress
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-AV-1 [Jest] : avec `uri`, une image décorative est rendue ; sans `uri`, l'initiale ; sans nom, l'icône.
- AC-AV-2 [Jest] : l'initiale d'un nom commençant par un caractère hors plan de base (par exemple un emoji ou une lettre à deux unités) est un seul graphème entier.
- AC-AV-3 [Jest] : l'événement d'erreur de l'image bascule sur l'initiale.
- AC-AV-4 [Jest] : sans `onPress`, l'avatar n'est pas dans l'arbre d'accessibilité ; avec `onPress`, bouton ≥ 44 pt avec le nom fourni (type : `accessibilityLabel` requis).
- AC-AV-5 [Jest] : `ring` et `presence` absents ne rendent rien ; avec `ring="unseen"` l'étiquette mentionne l'état.
- AC-AV-6 [Jest] : plus aucune taille littérale hors jetons (migration des tailles 36, 120, 140).

### 6.6 `Banner`

**Écart constaté.** Pastille de glyphe `✓ ✕ ! i` de 24 × 24 pt fixe (déborde à 200 %) ; le type n'est pas lu par le lecteur d'écran (seul le message l'est) ; `accessibilityRole="alert"` sur une `View` non accessible : ignoré sous iOS ; aucune annonce sous iOS ; bouton de fermeture avec `✕` ; texte de fermeture à fournir à chaque usage → **14 répétitions identiques** de `<Banner variant="error" message onDismiss dismissLabel={t('ui.banner.dismiss')} style={{ marginBottom: space[3] }} />` (AuthFormScreen, ConversationScreen, IntentScreen, PhotosManager, PreferencesScreen, ProfileEditScreen, BlockedScreen, ConsentSettingsScreen, ExportScreen, NotificationsScreen, PrivacyScreen, SessionsScreen, SupportScreen, WelcomeScreen).

**Rôle.** Message en ligne, jamais bloquant : erreur, succès, avertissement, information, conseil de sécurité, hors ligne.

**Anatomie.** Cadre (`radius.md`, contour 1 pt et **barre gauche de 5 pt** de la couleur de la variante, fond `colors.surface`) contenant : icône de variante (`Icon` `md`), bloc texte (titre facultatif en `type.label`, message en `type.body`), bouton Fermer (`IconButton`) en haut à droite, et sous le texte, **alignée à gauche**, l'action facultative (`Button variant="ghost" size="sm"`).

| Variante | Icône | Couleur d'accent | Annonce Android |
|---|---|---|---|
| `error` | `CircleX` | `colors.danger` | `assertive` |
| `warning` | `TriangleAlert` | `colors.warning` | `polite` |
| `success` | `CircleCheck` | `colors.success` | `polite` |
| `info` | `Info` | `colors.verified` | `polite` |
| `safety` (nouveau) | `ShieldAlert` | `colors.warning` | `polite` |

La variante est portée par **la forme de l'icône et le mot lu** en plus de la couleur (R9).

**Structure d'accessibilité (R8).** Le conteneur n'est **pas** `accessible`. Le **bloc texte** (icône + titre + message) est un seul élément `accessible` d'étiquette « {type}. {message} » (« Erreur. Impossible d'envoyer le message. ») ; l'action et le bouton Fermer sont **frères** de ce bloc, donc atteignables. Cela évite le défaut d'`EmptyState`. Sous iOS, `announce(`${type}. ${message}`)` est appelé quand le message change (R7) ; sous Android, `accessibilityLiveRegion` sur le bloc texte.

**Fermeture par défaut.** `dismissLabel` devient facultatif : par défaut `t('ui.banner.dismiss')`.

**Préréglages (remplacent les 14 duplications).**
- `ErrorBanner` : `<ErrorBanner message={banner} onDismiss={…} testID="…" />`. Ne rend **rien** si `message` est vide (supprime les `{banner ? … : null}`), marge inférieure standard `space[3]` (`inset="bottom"`, défaut ; `inset="none"` pour désactiver), `variant="error"` et fermeture avec libellé par défaut.
- `OfflineBanner` : `Banner variant="warning"` avec `WifiOff`, lit l'état réseau (`@react-native-community/netinfo`, déjà dépendance du projet) ; texte « Vous êtes hors ligne. Les actions reprendront au retour du réseau. » ; masquée dès que le réseau revient (avec annonce « Connexion rétablie »). *Message à aligner sur le comportement réel de la file d'envoi.*
- `SafetyBanner` : `variant="safety"`, titre « Conseil de sécurité », message « Ne versez jamais d'argent à une personne rencontrée en ligne. », bouton Fermer qui devient actif après lecture (décision 6 : bandeau fixe à la première conversation, refermable après lecture). Variante **contextuelle** quand le serveur détecte une demande d'argent : `warning` avec action « En savoir plus » et « Signaler ».

**États.** Visible, avec action, avec fermeture, sans titre. Jamais `loading`. L'état « appuyé » ne concerne que l'action et le bouton Fermer (`opacity.pressed`, focus).

**320 pt et 200 %.** Plus de pastille de hauteur fixe : l'icône est un `Icon` (taille fixe) dans une zone de `minHeight`. Le texte passe à la ligne sans plafond ; l'action passe sous le texte ; le bouton Fermer reste à droite en haut. Largeur : toute la largeur du contenu.

**Mouvement.** Apparition : fondu de `motion.fast`, pas de translation (la bannière est dans le flux). Mouvement réduit : instantané. Elle ne pousse pas le contenu de façon animée.

**Textes.**

| Clé | fr | en |
|---|---|---|
| `ui.banner.dismiss` | Fermer | Dismiss |
| `ui.banner.error` / `success` / `warning` / `info` / `safety` | Erreur / Succès / Attention / Information / Conseil de sécurité | Error / Success / Warning / Information / Safety tip |
| `ui.banner.offline` | Vous êtes hors ligne. Les actions reprendront au retour du réseau. | You're offline. Actions will resume when you're back online. |
| `ui.banner.backOnline` | Connexion rétablie. | Back online. |

**Cas limites.** Message vide : rien n'est rendu. Message de 500 caractères : affiché en entier. Plusieurs bannières empilées : au plus une bannière d'erreur par zone ; la plus récente remplace. Nom de variante inconnu : `info`. Bannière dans une feuille : ne déclenche pas de toast.

**testID.** Hérité ; `<testID>-icon`, `<testID>-message`, `<testID>-action`, `<testID>-dismiss`. Défauts : `banner`, `error-banner`, `offline-banner`, `safety-banner`.

**Props.**

```ts
export type BannerVariant = 'success' | 'error' | 'warning' | 'info' | 'safety';

export type BannerProps = {
  message: string;
  title?: string;
  variant?: BannerVariant;               // défaut 'info'
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;                // affiche le bouton Fermer
  dismissLabel?: string;                 // défaut t('ui.banner.dismiss')
  inset?: 'bottom' | 'none';             // défaut 'none' pour Banner, 'bottom' pour ErrorBanner
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export type ErrorBannerProps = {
  message?: string;                      // vide ou absent = rien
  onDismiss?: () => void;
  inset?: 'bottom' | 'none';
  testID?: string;
};
```

**Critères d'acceptation.**
- AC-BAN-1 [Jest] : tests existants de `Banner` verts (variantes, action, fermeture, annonce d'erreur).
- AC-BAN-2 [Jest] : le bloc texte a pour nom « {type}. {message} » ; l'action et le bouton Fermer sont des boutons atteignables (`getByRole('button')`) et **ne sont pas** descendants d'un nœud `accessible`.
- AC-BAN-3 [Jest] : chaque variante rend une icône différente (par nom) ; la couleur d'accent suit le jeton de la variante.
- AC-BAN-4 [Jest] : `announce` est appelé avec « {type}. {message} » quand le message change (iOS simulé), pas deux fois pour le même message.
- AC-BAN-5 [Jest] : `ErrorBanner` sans message ne rend rien ; avec message, applique la marge standard et le libellé de fermeture par défaut ; les 14 usages sont remplacés (recherche de `dismissLabel={t('ui.banner.dismiss')}` dans `features/` : zéro résultat).
- AC-BAN-6 [Jest] : aucune hauteur ni largeur fixe de 24 pt dans `Banner.tsx` ; l'icône est un `Icon`.
- AC-BAN-7 [Jest] : `SafetyBanner` rend exactement le texte de la décision 6 en français et en anglais ; son bouton Fermer est présent.
- AC-BAN-8 [Appareil] : à 200 % sur 320 pt, un message de 3 lignes + action + fermeture ne se coupe pas.

### 6.7 `Skeleton` (forme de carte)

**Écart constaté.** Pulsation correcte et respect de « réduire les animations » (à conserver), mais : réglage lu une seule fois ; durée 800 ms en dur ; chaque barre annonce « barre de progression » (autant d'éléments que de barres) ; `AsyncView` affiche toujours 4 cartes de 64 pt ; le squelette de découverte est un bloc de 400 pt fixe ; aucune forme de carte de profil, de ligne de conversation ou de plan.

**Rôle.** Remplir l'espace en attendant une donnée, avec la **forme** de ce qui va arriver, pour limiter le saut de mise en page.

**Anatomie.** Briques `Skeleton` (`line`, `card`, `circle`, fond `colors.skeleton`) et **groupes préfabriqués** : `SkeletonProfileCard` (bloc photo 3:4 en `radius.lg`, puis 3 lignes de 60, 40 et 30 % de largeur), `SkeletonListRow` (cercle `avatarSize.md` + 2 lignes), `SkeletonConversation` (5 bulles alternées gauche/droite de largeurs variées), `SkeletonPlanCard` (carte de la hauteur d'une `PlanCard`), `SkeletonLines` (n lignes).

**Variantes.** `AsyncView` reçoit `skeleton: 'list' | 'card' | 'profile' | 'conversation' | 'plans' | 'lines'` (défaut `'list'`), qui remplace les 4 cartes fixes.

**États.** Pulsation (opacité de 1 à une valeur basse et retour, `motion.pulse` par demi-cycle) ; fixe si le mouvement est réduit ; **suivi en direct** du réglage (`useReduceMotion`, R6). Pas d'état d'erreur (c'est `AsyncView`).

**320 pt et 200 %.** Les largeurs sont en pourcentage ; les hauteurs de ligne suivent `type.body` × `fontScale` (une ligne de squelette de texte suit la taille de police pour que la mise en page ne saute pas) ; la carte de profil garde son ratio.

**Accessibilité.** **Un seul** nœud pour tout le groupe : conteneur `accessible`, rôle `progressbar`, `accessibilityState={{ busy: true }}`, étiquette « Chargement » ; **toutes les briques enfants** sont cachées (`accessible={false}`, `importantForAccessibility="no-hide-descendants"`). Annonce du chargement : région vivante polie une fois au montage, jamais en boucle.

**Mouvement.** Pulsation de `motion.pulse` (aucun flash : un cycle de plus de 1,5 s, WCAG 2.3.1) ; nulle en mouvement réduit.

**Textes.** `ui.loading` « Chargement » / « Loading ».

**Cas limites.** Chargement de plus de 10 s : `AsyncView` bascule sur l'état d'erreur ou de nouvelle tentative, le squelette ne reste pas indéfiniment. Réseau lent : le squelette reste, avec la forme. Pas de squelette pour une action ponctuelle (utiliser `loading` du bouton).

**testID.** `skeleton` (défaut conservé), `skeleton-profile-card`, `skeleton-list-row`, `skeleton-conversation`, `skeleton-plan-card`, `skeleton-lines`.

**Props.**

```ts
export type SkeletonKind = 'list' | 'card' | 'profile' | 'conversation' | 'plans' | 'lines';

export interface SkeletonProps { /* inchangé : width, height, variant: 'line' | 'card' | 'circle', testID, style */ }

export interface SkeletonGroupProps {
  kind: SkeletonKind;
  count?: number;                        // lignes ou rangées, défaut selon kind
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-SK-1 [Jest] : un groupe expose **un seul** nœud `progressbar` « Chargement » ; ses enfants sont cachés.
- AC-SK-2 [Jest] : `SkeletonProfileCard` rend un bloc de ratio 3:4 et 3 lignes de largeurs 60 %, 40 % et 30 %.
- AC-SK-3 [Jest] : avec le mouvement réduit simulé, aucune boucle d'animation n'est démarrée ; un basculement du réglage en cours d'utilisation (événement `reduceMotionChanged`) arrête ou démarre la boucle.
- AC-SK-4 [Jest] : `AsyncView` avec `skeleton="profile"` rend `skeleton-profile-card` et non les 4 cartes.
- AC-SK-5 [Jest] : la durée de pulsation vient de `motion.pulse` (aucune valeur numérique littérale dans le fichier).
- AC-SK-6 [Appareil] : pas de saut de mise en page visible entre le squelette de découverte et la carte réelle.

### 6.8 `EmptyState` (emplacement d'illustration)

**Écart constaté.** Corrigé au lot 1 : plus de conteneur `accessible` (le bouton est atteignable). Reste : l'emplacement `illustration` n'est jamais rempli (aucune illustration dans l'application) ; une seule forme d'état (vide) alors que les écrans ont besoin de vide, erreur, hors ligne et restreint ; pas de gestion de la grande police quand l'illustration prend la place du bouton.

**Rôle.** Expliquer pourquoi un écran est vide et quoi faire ensuite (P1 : montrer la protection là où elle est utile ; P2 : ton honnête, jamais culpabilisant).

**Anatomie.** Illustration (facultative) → titre (`Text variant="h2" header`) → description (`type.body`, `colors.textMuted`) → action principale (`Button secondary`) → lien secondaire facultatif (`Button ghost`).

**Variantes.** `kind` : `empty` (rien à montrer), `error` (échec, action « Réessayer »), `offline` (pas de réseau), `restricted` (compte limité : motif, durée, « Contester »). `compact` : sans illustration, pour les listes et les feuilles (recherche sans résultat).

**Guide de l'emplacement d'illustration.**
- **Contenu** : formes géométriques simples en aplat, dessinées en SVG (`react-native-svg`) : cercles qui se chevauchent, arche, vague ; 2 à 3 formes et au plus 3 couleurs de jetons (`colors.primary`, `colors.accent`, `colors.border`). Pas de dégradé, pas d'ombre.
- **Interdits** : photo ou illustration de personne (banque d'images, silhouette de couple, mains qui se tiennent, visages), cœurs et cliché romantique, drapeaux, motifs « africains » décoratifs (principe 6 et `01-direction.md` section 7), logo ou mot-symbole (aucun logo avant la recherche d'antériorité), mascotte.
- **Taille** : zone de 160 × 120 pt au plus, centrée, `viewBox` fixe, `preserveAspectRatio` conservé ; chaque SVG pèse moins de 1 Ko de données de tracé (*hypothèse, à mesurer*).
- **Couleurs** : uniquement par `tone`/jetons ; adaptation automatique au mode sombre.
- **Fournisseur** : un composant `EmptyIllustration kind="discover" | "messages" | "filters" | "offline" | "generic"` ; l'écran ne passe pas de SVG libre sans revue de conception.
- **Accessibilité** : décorative (`accessible={false}`) ; jamais porteuse d'information.
- **Grande police** : à `isXL` et si la hauteur de fenêtre est inférieure à 700 pt, l'illustration est **masquée** pour que le bouton reste visible sans défilement excessif.

**États.** Repos ; action en cours (`loading` sur le bouton) ; pour `error`/`offline`, le bouton « Réessayer » est toujours présent.

**320 pt et 200 %.** Contenu centré, largeur de texte plafonnée à `MAX_CONTENT_WIDTH`, marges `space[6]` ; titre et description passent à la ligne sans plafond.

**Accessibilité.** Pas de conteneur `accessible` (R8). Titre en-tête, description lue ensuite, bouton atteignable. Quand l'état occupe tout l'écran, le focus d'accessibilité va au titre au montage. L'apparition d'un état d'erreur ou hors ligne est annoncée (R7).

**Mouvement.** Aucun mouvement sur l'illustration (statique).

**Textes (exemples, plus long en français).**

| Cas | Titre fr | Description fr | Action fr | Titre en |
|---|---|---|---|---|
| Fin de pile | Vous avez tout vu pour le moment | Revenez plus tard ou élargissez vos filtres pour voir plus de profils. | Modifier les filtres | You've seen everyone for now |
| Messages vides | Aucune conversation pour le moment | Quand vous aurez un match, votre conversation apparaîtra ici. | Découvrir | No conversations yet |
| Hors ligne | Pas de connexion | Vérifiez votre réseau, puis réessayez. | Réessayer | No connection |
| Erreur | Une erreur est survenue | Cela ne vient pas de vous. Réessayez dans un instant. | Réessayer | Something went wrong |
| Recherche sans résultat | Aucun résultat | Essayez un autre mot. | Effacer la recherche | No results |

(la formule « pour le moment » est conservée comme texte d'état vide, voir `01-lot1-suivi-b.md` ; le texte du refus d'âge, lui, la retire — décision 13.)

**Cas limites.** Titre de 60 caractères : plusieurs lignes. Pas d'action (état purement informatif) : pas de bouton. Hors ligne et réseau revenu : l'écran relance la requête automatiquement et masque l'état.

**testID.** `<testID>`, `<testID>-title`, `<testID>-description`, `<testID>-action`, `<testID>-illustration`. Défaut `empty-state`.

**Props.**

```ts
export interface EmptyStateProps {
  title: string;
  description?: string;
  kind?: 'empty' | 'error' | 'offline' | 'restricted';   // défaut 'empty'
  compact?: boolean;
  illustration?: React.ReactNode | 'discover' | 'messages' | 'filters' | 'offline' | 'generic';
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  testID?: string;
}
```

**Critères d'acceptation.**
- AC-ES-1 [Jest] : le bouton d'action est atteignable par `getByRole('button')` et n'est pas descendant d'un nœud `accessible` (non-régression du lot 1).
- AC-ES-2 [Jest] : le titre a le rôle d'en-tête ; l'illustration est cachée de l'arbre.
- AC-ES-3 [Jest] : `kind="error"` et `"offline"` rendent le bouton « Réessayer » dès que `onAction` est fourni.
- AC-ES-4 [Jest] : avec `fontScale` simulé à 2 et fenêtre de 568 pt de haut, l'illustration n'est pas rendue ; avec `fontScale` 1, elle l'est.
- AC-ES-5 [Jest] : `illustration="discover"` ne rend que des `Path`/`Circle`/`Rect` (pas d'`Image`) ; aucun fichier image n'est ajouté pour les états vides.
- AC-ES-6 [Appareil] : à 320 pt et 200 %, le titre, la description et le bouton sont visibles ou atteignables par défilement ; l'illustration respecte le guide (revue de conception).

### 6.9 `Text` et variantes typographiques

**Écart constaté.** `Text` n'offre que `title`, `h2`, `body`, `bodySmall`, `caption` : 17 `fontWeight` écrits à la main dans `features/` (`'600'`, `'700'`) ; `fontSize: 16` en dur dans `TextField` et `ConversationScreen`, `fontSize: 12` dans la barre d'onglets (sous le plancher de 13 pt de `caption`).

**Correction.** Ajouter `label` (corps de `body`, semi-gras) et `labelSmall` (corps de `caption`, semi-gras) ; ajouter les tons `onAccent`, `like`, `dislike` ; ne jamais descendre sous `caption`. Sur Android, la graisse 600 n'existe pas dans Roboto : les jetons de graisse résolvent par plateforme (phase 2, `01-direction.md` section 5.2) ; `Text` lit la graisse dans le jeton, jamais `fontWeight` en dur.

**Critères d'acceptation.**
- AC-TXT-1 [Jest] : un test de source échoue si `fontWeight:` apparaît dans `features/` ou `ui/` hors `Text.tsx` ; un second échoue si `fontSize:` apparaît hors `Text.tsx` et `theme/`.
- AC-TXT-2 [Jest] : `Text variant="label"` rend le corps de `type.label` ; `header` donne le rôle d'en-tête.

## 7. Ordre de construction (dépendances entre composants)

Principe : on construit du bas vers le haut. Un lot = un composant ou un petit groupe, livré avec ses tests, `npm run typecheck`, `npm run lint`, `npx jest` verts, la parité fr/en, la mise à jour de `ComponentsDemoScreen` (page de démonstration, réservée au développement, qui montre chaque état en clair, en sombre, à 320 pt et à grande police), la mise à jour de `docs/reviews/design-1-suivi.md`, et une capture avant/après dans l'aperçu navigateur (390 pt et 320 pt). Aucun lot ne change le comportement d'un écran au-delà des corrections listées dans la fiche.

| Lot | Contenu | Dépend de | Taille (*hypothèse*) |
|---|---|---|---|
| 0. Prérequis | Jetons de la phase 2 fusionnés (noms de la section 1) ; installation de `react-native-svg` et `lucide-react-native` (section 3) ; crochets et utilitaires (`announce`, `focusNode`, `useReduceMotion`, `useMotion`, `useFocusRing`, `useCompactLayout`) ; variantes `label`/`labelSmall` de `Text` ; domaine i18n `ui.*` ; pluriels dans `translate` (`Intl.PluralRules`) ; aides de test (`helpers/a11y.ts`) | phase 2 | M |
| 1. Icônes | `Icon` + registre + test du registre ; `IconButton` | 0 | M |
| 2. Briques simples | `Button` (neutral, icône, taille, focus, `disabledReason`) ; `Avatar` (graphème, échec, tailles) ; `Skeleton` (groupes, suivi du réglage) ; `Badge` sauf la version interactive de `verified` | 1 | M |
| 3. Surfaces et champs | `SelectableSurface` + enveloppes `ChoiceCard`, `Chip`, `CheckboxField` ; `Banner` + `ErrorBanner`, `OfflineBanner`, `SafetyBanner` ; `TextField` ; `SwitchRow` ; `ListRow` ; `EmptyState` + `EmptyIllustration` | 1, 2 | L |
| 4. Couches | `BottomSheet` ; `ActionSheet` ; `ConfirmPanel` ; `Badge verified` interactif (feuille d'explication) ; `Toast` v2 (file, persistance, position, annonce, `registerModalOpen`) | 1, 2, 3 | L |
| 5. Navigation | `ScreenHeader` + `useGoBack` ; `TabBar` (et branchement du décalage du toast) | 1, 2, 4 | M |
| 6. Écrans de contenu | `ProfileCard`, `ProfileActions`, `ProfileCardSkeleton` ; `MessageBubble`, `DateSeparator` ; `Select` / `CountryPicker` ; `RangeSlider` | 1 à 5 | L |
| 7. Monétisation et appels | `PlanCard`, `PriceSummary`, `RenewalDisclosure`, `PaywallLinks` ; `CallEntryButtons`, `InCallControls` (construits mais masqués) | 3, 4, 6 | M |

Graphe des dépendances directes (A → B : B dépend de A) :

- `Icon` → `IconButton`, `Badge`, `Banner`, `Button` (icône), `TextField` (icône, bascule), `TabBar`, `EmptyState`, `Select`, `MessageBubble`, `ProfileCard`, `CallControls`.
- `IconButton` → `Banner` (Fermer), `Toast`, `BottomSheet` (Fermer), `ScreenHeader`, `TextField`, `RangeSlider`.
- `SelectableSurface` → `ChoiceCard`, `Chip`, `CheckboxField`, `PlanCard`, `Select` (lignes et puces).
- `BottomSheet` → `ActionSheet`, `ConfirmPanel`, `Badge verified` interactif, `Select`.
- `ActionSheet` → `MessageBubble` (appui long), menus du détail de profil et de la conversation.
- `Banner` → `Toast`, `ErrorBanner`, `OfflineBanner`, `SafetyBanner`, états d'erreur de `ConfirmPanel`.
- `Toast` ← `TabBar` (décalage), `BottomSheet` (modale ouverte).
- `Avatar` → `ScreenHeader` (`identity`), `ListRow`, `ProfileCard` (repli sans photo).
- `Skeleton` → `AsyncView`, `ProfileCardSkeleton`, `PlanCard` (chargement).

Pourquoi cet ordre : les icônes bloquent six autres composants (les glyphes sont partout) ; les surfaces et champs corrigent les défauts d'accessibilité les plus larges (8 écrans de réglages, 5 écrans de formulaire) ; les couches (feuilles) sont le prérequis de tout menu et de toute confirmation ; l'en-tête et la barre d'onglets viennent après car ils consomment `IconButton`, `Avatar`, `Badge` et le décalage du toast ; `ProfileCard`, `MessageBubble` et `Select` regroupent les écrans les plus utilisés et ont besoin des couches ; la monétisation se construit tard car elle s'appuie sur la même base, mais elle est surveillée dès la phase 4 (parcours Premium, `04-ecrans-*`).

**Parallélisme possible.** Après le lot 1, les lots 2 et 3 peuvent être menés par deux personnes sur des fichiers distincts. Les lots 4 à 7 ne le permettent qu'à l'intérieur d'un lot (`ProfileCard`, `MessageBubble`, `Select`, `RangeSlider` sont indépendants entre eux).

**Exemple de test type** (style du dépôt : `renderThemed`, `userEvent`, `flatStyle`).

```tsx
it('IconButton : nom, cible de 44 pt, appui, désactivé', async () => {
  const onPress = jest.fn();
  await renderThemed(<IconButton icon="X" accessibilityLabel="Fermer" onPress={onPress} />);
  const button = screen.getByRole('button', { name: 'Fermer' });
  const style = flat(button.props.style);
  expect(Number(style.minHeight)).toBeGreaterThanOrEqual(MIN_TARGET);
  expect(Number(style.minWidth)).toBeGreaterThanOrEqual(MIN_TARGET);
  expect(button.props.hitSlop).toBeUndefined();
  await userEvent.setup().press(button);
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

## 8. Porte de sortie d'un composant (reprend la section 8 du prompt maître)

Un composant n'est accepté que si toutes ces cases sont vraies, constatées et non supposées :

1. Fiche complète : rôle, anatomie, variantes, états, tailles, 320 pt et 200 %, accessibilité, mouvement, textes fr et en, cas limites, `testID`, props.
2. Aucune couleur, aucun texte, aucune durée, aucune taille de police ni graisse en dur ; parité fr/en typée.
3. Contrastes : paires couvertes par le test de contraste automatique (texte 4,5:1, composants 3:1), en clair et en sombre.
4. Cibles de 44 pt ; `minHeight` plutôt que `height` ; aucun `numberOfLines` hors exceptions documentées.
5. Nom, rôle et état annoncés ; ordre de focus ; aucun conteneur `accessible` autour d'un contrôle ; annonces sous iOS.
6. Focus visible ; appui par `opacity.pressed` ; mouvement par `motion.*` et réductible en direct.
7. Critères [Jest] de la fiche verts ; critères [Appareil] constatés avec capture, ou **explicitement marqués non constatés** dans le suivi (jamais « livré » sans capture).
8. Poids : taille du bundle mesurée avant et après le lot 0 et le lot 1 ; aucune image ajoutée sans justification.
9. Mise à jour de `ComponentsDemoScreen` et de `docs/reviews/design-1-suivi.md`.
10. Aucune dépendance autre que celles de la section 3.

## 9. Plan de migration vers les composants partagés

**Constat chiffré** (recherche du 2026-11-08 dans `mobile/src`, à refaire au démarrage de chaque lot) : 233 occurrences de `style={{` (231 dans `features/`, 51 fichiers) ; 46 `variant="ghost"` ; 14 bannières d'erreur identiques ; 17 `fontWeight` à la main ; 88 `marginBottom: space[…]`, 55 `gap: space[…]`, 44 `marginTop: space[…]`, 23 `flexDirection: 'row'`, 17 `alignItems: 'center'`, 10 `padding: space[…]`, 8 `borderWidth: 1` ; 31 emplacements de glyphes ; 5 menus en ligne avec confirmation ; 4 variantes d'en-tête.

**Méthode (pour chaque lot de migration).**
1. **Test de caractérisation d'abord** : le test existant de l'écran reste vert ; si l'écran n'en a pas, en écrire un qui fige le comportement avant le remplacement.
2. Remplacer, rien d'autre. Les corrections de comportement sont celles de la fiche du composant.
3. Garder les `testID` actuels (alias) pendant un lot ; les supprimer quand la recherche de l'ancien identifiant ne trouve plus rien.
4. Lancer `typecheck`, `lint`, `jest` ; capturer avant/après à 390 pt et 320 pt.
5. Supprimer l'ancien composant dès que la recherche de son nom ne trouve plus aucun usage (pas de code mort).

### 9.1 Table de remplacement

| Motif dupliqué ou ancien composant | Nombre relevé | Remplacement | Lot |
|---|---|---|---|
| Bannière d'erreur fermable avec `dismissLabel={t('ui.banner.dismiss')}` et marge `space[3]` | 14 (AuthFormScreen, ConversationScreen, IntentScreen, PhotosManager, PreferencesScreen, ProfileEditScreen, BlockedScreen, ConsentSettingsScreen, ExportScreen, NotificationsScreen, PrivacyScreen, SessionsScreen, SupportScreen, WelcomeScreen) | `ErrorBanner` | 3 |
| Autres `<Banner` (54 au total, 40 restantes : succès, information, avertissement, avec action) | 40 | `Banner` corrigée (aucun changement d'appel) ; `SafetyBanner` et `OfflineBanner` aux endroits prévus | 3 |
| Bouton-glyphe `Button label="✕"` etc. | 9 | `IconButton` | 1 |
| Glyphes Unicode d'icône | 31 emplacements, 12 familles | `Icon` (table 4.3) | 1 |
| Badge textuel en `Text` + `fontWeight` | 5 | `Badge` | 2 |
| `fontWeight` à la main | 17 | `Text variant="label"` / `labelSmall` | 0 |
| `fontSize` à la main (`TextField`, conversation, onglets) | 4 | variantes de `Text` / `type.*` | 0 |
| Cadre « carte » (bordure 1, rayon, fond `surface`) | 5 (ProfileDetailScreen, ConversationScreen, PhotosManager, SanctionsScreen, VerificationScreen) | `Card` (9.2) | 3 |
| Menu `⋯` en ligne avec confirmation | 5 (ProfileDetailScreen, ConversationScreen, SessionsScreen, ConsentSettingsScreen, PhotosManager) | `ActionSheet` + `ConfirmPanel` | 4 |
| `Button variant="ghost"` utilisé comme lien, entrée de menu ou retour | 46 | triés : retour → `ScreenHeader` ; entrée de menu → `ActionSheetItem` ; lien → `Button variant="ghost" size="sm"` ; reste inchangé | 4–5 |
| Pied de page en pile de boutons `<View style={{ gap: space[2] }}>` | accueil, connexion, filtres, match, appels, Premium, sessions… | `FooterActions` (9.2) | 3 |
| Message d'erreur de champ sous un groupe | 4 (BasicProfileScreen, IntentScreen, PhotosScreen, VerificationScreen) | `FieldError` (même rendu que l'erreur de `TextField`) | 3 |
| En-tête : `BackButton` (8 écrans), `ScreenHeader` (22), conversation, titres d'onglet (3) | 34 | `ScreenHeader` | 5 |
| Barre d'onglets à glyphes | 1 | `TabBar` | 5 |
| 68 puces de pays (34 × 2, plus 2 sélecteurs de 8 cartes) | PreferenceFields, FiltersScreen, ProfileEditScreen | `CountryPicker` | 6 |
| Compteurs d'âge − / + | PreferenceFields | `RangeSlider` | 6 |
| Bulles `Pressable` pour tous les messages | ConversationScreen | `MessageBubble`, `DateSeparator` | 6 |
| Squelettes génériques (4 cartes) et squelette de découverte à 400 pt | AsyncView, DiscoverScreen | `SkeletonGroup` | 2 |
| Pastilles de non-lus (24 × 24) | MessagesListScreen | `Badge count` | 2 |
| `Toast` à 4 s | AppShell et écrans | `Toast` v2 | 4 |
| Blocs d'abonnement | PremiumScreen, CreditsScreen, ManageSubscription | blocs de paywall | 7 |
| Boutons d'appel | ConversationScreen, CallScreen | `CallEntryButtons`, `InCallControls` | 7 |

### 9.2 Primitives de mise en page (pour vider les 233 styles en ligne)

Le gros des styles en ligne n'est pas du design : ce sont des marges, des écarts et des rangées. Sans primitives, on ne peut pas les supprimer. À créer (une seule fois, dans `ui/`, avec leurs tests) :

| Primitive | Remplace | Contrat |
|---|---|---|
| `Stack` | `style={{ gap: space[n] }}`, `marginBottom`/`marginTop` répétés | `direction?: 'column' | 'row'` (défaut colonne), `gap?: 0..7` (index du jeton `space`), `wrap?: boolean`, `align?`, `justify?`, `padding?: 0..7` ; un enfant de `Stack` n'a plus de marge propre |
| `Card` | cadre « carte » (5 sites) | fond `colors.surface`, contour 1 pt `colors.border`, rayon `radius.md`, `padding` `space[4]` ; `tone="default" \| "warning" \| "danger"` |
| `FooterActions` | pile de boutons de pied | `Stack` en colonne avec `gap` `space[2]` ; passe en colonne pleine largeur à `isNarrow`/`isLarge` (R3) ; premier bouton = primaire ; refuse deux boutons `primary` |
| `FieldError` | erreurs de groupe | icône `CircleAlert` + texte `colors.danger`, annoncé (R7) |
| `Section` | titre de section + contenu | `Text variant="label" header` + `Stack` |
| `Divider` | `borderBottomWidth` répétés | trait `colors.border` |

Avec ces six primitives, une recherche des trois motifs dominants (`marginBottom: space`, `gap: space`, `marginTop: space`) tombe à zéro hors des primitives. Les styles qui restent (taille d'image particulière, transformation d'animation) sont des cas légitimes à justifier.

### 9.3 Vagues de migration (ordre des parcours de la phase 4)

| Vague | Écrans | Remplacements principaux |
|---|---|---|
| 1. Inscription et âge | accueil, connexion, inscription, mot de passe oublié, réinitialisation, date de naissance, consentements, refus d'âge, e-mail à vérifier, profil, intention, photos, préférences | `ScreenHeader` (variante A), `ErrorBanner`, `FooterActions`, `TextField`, `SelectableSurface`, `Icon` |
| 2. Découverte | découverte, carte, filtres, détail du profil, préférences (filtres) | `ProfileCard`, `ProfileActions`, `CountryPicker`, `RangeSlider`, `Badge`, `ActionSheet`, `Skeleton` |
| 3. Match et conversation | match, liste de messages, conversation | `ScreenHeader` `identity`, `MessageBubble`, `DateSeparator`, `ListRow`, `Badge count`, `ActionSheet`, `ConfirmPanel`, `SafetyBanner`, `OfflineBanner`, `Toast` |
| 4. Premium | offres, crédits, résultat | blocs de paywall, `SelectableSurface` |
| 5. Sécurité | signalement, bloqués, vérification, sanctions, contestation | `ConfirmPanel`, `Banner`, `Card`, `Badge verified` |
| 6. Profil et réglages | mon profil, édition, réglages, confidentialité, notifications, consentements, sessions, support, légal | `ScreenHeader`, `SwitchRow`, `ListRow`, `ConfirmPanel` |
| 7. Appels | appel entrant, sortant, actif | `InCallControls` (masqués tant que `CALLS_ENABLED` est faux) |
| 8. Suppression et export | suppression, export | `ConfirmPanel`, `TextField`, `Banner` |

### 9.4 Cliquet contre le retour en arrière

- Un test `__tests__/inline-styles.test.ts` (sur le modèle de `no-hardcoded-colors.test.ts`) compte les occurrences de `style={{` dans `features/` et échoue si le nombre dépasse la valeur de `__tests__/baselines/inline-styles.json` ; la valeur de départ est **231** ; chaque lot de migration la **baisse** (jamais ne la monte). Cible de fin de phase 7 : l'ordre de **40 ou moins**, chiffre de conception (*hypothèse*) à réviser selon ce que la migration laisse de cas légitimes.
- Même mécanisme, tolérance zéro, pour `fontWeight:` et `fontSize:` hors `Text` et `theme/`, pour les durées d'animation littérales (`duration: <nombre>`) hors `useMotion`, et pour `hitSlop` hors cas documentés.
- Règle ESLint (`no-restricted-syntax`) en avertissement sur `numberOfLines` dans `ui/` hors liste d'exceptions (nom de carte, libellé d'onglet, pastille, aperçu de message).
- La liste des exceptions est dans le test, pas dans la tête de l'équipe.

## 10. Décisions pour le propriétaire, hypothèses, risques

### 10.1 Décisions (réservées au propriétaire, avec recommandation)

| # | Question | Options | Recommandation |
|---|---|---|---|
| 1 | Installer `react-native-svg` et `lucide-react-native` (**déjà décidé**, décision 11) : confirmer le **seuil de poids** et l'**alternative de repli** si le seuil est dépassé | seuil de 150 Ko de JavaScript ; repli A (tracés copiés) | Garder le seuil et le repli A ; décider après la mesure du lot 0 |
| 2 | Icône de l'onglet Découvrir | `Layers` (pile de cartes) ou `Heart` | `Layers` : évite deux cœurs sur l'écran de découverte |
| 3 | « J'aime » en bouton primaire, « Passer » en bouton neutre, `like`/`dislike` réservés aux retours de geste | oui ; ou J'aime avec contour `like` | Oui (une action principale par écran, un « non » neutre) |
| 4 | Afficher « Premium » à d'autres utilisateurs | non (défaut, seulement « Mon profil ») ; oui | Non tant que la décision de produit n'est pas prise |
| 5 | Pas de drapeaux dans le sélecteur de pays | sans drapeau ; avec drapeau | Sans drapeau (territoires contestés, principe 6) |
| 6 | Durées de toast (6 s, 10 s en erreur, persistant avec action) | valeurs proposées ; autres | Valeurs proposées, à tester avec un utilisateur de lecteur d'écran |
| 7 | Ordre Confirmer / Annuler dans `ConfirmPanel` | Confirmer au-dessus ; Annuler au-dessus | Confirmer au-dessus, destructeur jamais en focus initial ; à confirmer sur appareil |
| 8 | Présence « en ligne » et anneau de story | non rendus en V1 ; prévus par l'API | Conserver l'API, rien d'affiché ; la présence exige un réglage de confidentialité |
| 9 | Nouveaux jetons demandés à la phase 2 : `radius.control`, `type.label`, `type.labelSmall`, `opacity.scrim`, `layout.*`, `avatarSize.*`, `motion.pulse` | accepter ; ajuster les noms | Accepter (liste de contrôle en section 1) |
| 10 | Plafond de taille de police des libellés d'onglet et des pastilles (1,6) | plafonné avec libellé complet à la voix ; sans plafond | Plafonné (exception documentée de WCAG 1.4.4, à valider sur appareil) |
| 11 | Appels entrants tant que `CALLS_ENABLED` est faux | fournisseur d'appels inactif ; écran d'appel sans média | Fournisseur inactif (aucune sonnerie sans média) |
| 12 | Textes juridiques et de sécurité en exemple (badge vérifié, conséquence du blocage, divulgation de renouvellement) | validation juriste | Obligatoire avant toute publication |

### 10.2 Hypothèses à valider

1. `Modal` piège le focus de VoiceOver et de TalkBack comme documenté (à tester sur appareil).
2. `PanResponder` suffit pour le curseur à 60 images/s sur Android d'entrée de gamme.
3. Les propriétés `outline*` fonctionnent sur React Native 0.88 (Fabric) et `react-native-web`.
4. `lucide-react-native` n'embarque que les icônes importées (sinon : import par icône ou repli A).
5. Les graisses 600 se résolvent correctement sur Android (jeton de graisse par plateforme).
6. Un libellé d'onglet plafonné à 1,6 reste acceptable ; les personnes en police maximale lisent le nom complet à la voix.
7. L'ordre de balayage de la liste inversée de la conversation est cohérent (sinon liste non inversée avec `maintainVisibleContentPosition`).
8. Les durées de toast conviennent aux utilisateurs de lecteur d'écran.
9. Les tracés d'illustration pèsent moins de 1 Ko chacun.
10. Les textes français proposés tiennent à 320 pt et 200 % (mesure sur appareil).

### 10.3 Risques

- **Dépendance native** : `react-native-svg` exige une nouvelle build ; hors Expo Go selon la configuration. Faire le lot 0 avant toute publication.
- **Renommages d'icônes** de la bibliothèque d'une version à l'autre : vérifier chaque nom à l'installation, fixer la version, tester le registre.
- **Migration large** : 233 styles en ligne et 34 en-têtes touchent presque tous les écrans ; le risque de régression est contenu par les tests de caractérisation et par les lots courts.
- **Régression de test** : les tests existants citent des `testID` et des textes ; conserver les alias le temps d'un lot.
- **Nom du produit** : aucune illustration, aucun mot-symbole, aucun logo n'est dessiné ici (antériorité du nom, décision 14).
- **Rendu non vu** : tout ce document est écrit sans rendu sur appareil. Aucune case [Appareil] n'est cochée.

### 10.4 Suite proposée

1. Le propriétaire répond aux décisions 1 à 12 (surtout 1, 2, 3, 12).
2. Phase 2 terminée : `tokens.json` fusionné avec les noms de la section 1.
3. Lot 0 : installation des deux dépendances, crochets, `Text`, i18n `ui.*`, pluriels, mesure du poids.
4. Lots 1 à 7 dans l'ordre de la section 7, en même temps que les vagues de migration de la section 9.3 et que la phase 4 (parcours et écrans).
5. Mesure sur appareil (Android d'entrée de gamme à 320 pt et 200 %, iPhone SE, VoiceOver, TalkBack) pour clore les critères [Appareil].
