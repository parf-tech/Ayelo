# Phase 2 : fondations, jetons de design

Date : 2026-11-08. Livrable de la phase 2 de `PROMPT-UIUX-EXPERT.md` (section 5). S'appuie sur `01-direction.md` (direction B « Lagune », provisoire), `01-decisions.md` et `00-a11y.md` section 1. Principes appliqués : 7 (cohérence mesurable : tout vient de jetons, aucune valeur en dur), 5 (accessibilité par défaut : contrastes calculés à chaque génération), 8 (mouvement utile : durées et courbes issues des jetons, mode « réduire les animations »).

## 1. Une seule source

`design/tokens.json` est la source. `design/build-tokens.mjs` (Node ESM, sans dépendance) génère :

| Sortie | Contenu |
|---|---|
| `mobile/src/theme/tokens.ts` | Couleurs de la direction active (clair et sombre), espacement, rayons, typographie, élévation, mouvement, z-index, focus, opacités, icônes, zone de toucher. En-tête « Fichier généré, ne pas modifier ». |
| `web/assets/tokens.css` | Les mêmes jetons en variables CSS (`--color-*`, `--space-*`, `--radius-*`, `--type-*`, `--elevation-*`, `--motion-*`, `--z-*`, `--focus-*`, `--opacity-*`, `--icon-*`), bloc sombre `prefers-color-scheme` et bloc `prefers-reduced-motion`. La copie manuelle est supprimée. |
| `mobile/app.json` (4 valeurs) | Fond d'icône adaptative et couleur de notification = `primary` clair ; fond d'écran de démarrage = `bg` clair, et `bg` sombre pour le mode sombre. Identifiants de paquet et champs EAS inchangés. |

Garde-fous : `npm run tokens:check` (CI et test Jest `tokensSync.test.ts`) échoue si un fichier généré diffère de la sortie du générateur ; le test existant `theme.test.ts` garantit toujours que `tokens.ts` est le seul fichier de `mobile/src` et `mobile/app` qui contient une couleur.

## 2. Tables des jetons

### 2.1 Couleurs (direction active B ; A et C dans `tokens.json`)

Les noms existants sont conservés. Nouveaux : `accent`, `onAccent`, `info`, `focusRing`, `scrim`, `passNeutral` (et `todoBg`, réservé au web). Un alias s'écrit `"=role"` dans `tokens.json`.

| Jeton | Rôle | Clair | Sombre |
|---|---|---|---|
| `bg` | Fond d'écran | `#FBFAF6` | `#0B1413` |
| `surface` | Cartes, champs, bulles reçues | `#EDF3F0` | `#142120` |
| `text` | Texte principal | `#12201F` | `#E9F2F0` |
| `textMuted` | Texte secondaire | `#465856` | `#9FB6B2` |
| `primary` | Action principale, lien | `#0B6468` | `#4FC9C4` |
| `onPrimary` | Texte sur `primary` et `danger` | `#FFFFFF` | `#06201F` |
| `accent` (nouveau) | Mise en avant douce | `#E3A92B` | `#F0BE55` |
| `onAccent` (nouveau) | Texte sur `accent` | `#1A1405` | `#1A1405` |
| `border` | Séparateur décoratif | `#D4DFDB` | `#243735` |
| `borderStrong` | Contour de composant (3:1) | `#677C79` | `#7C9692` |
| `like` | J'aime | `#17703B` | `#5AD98A` |
| `dislike` | Refus (contexte destructeur ou erreur) | `#B3261E` | `#FF8A80` |
| `passNeutral` (nouveau) | Bouton « Passer » neutre, alias de `textMuted` | `#465856` | `#9FB6B2` |
| `verified` | Badge vérifié (indigo, distinct du primaire) | `#3446C4` | `#8FA6FF` |
| `info` (nouveau) | Information, alias de `verified` | `#3446C4` | `#8FA6FF` |
| `warning` | Avertissement | `#8A5A00` | `#F0BE55` |
| `success` | Succès | `#17703B` | `#5AD98A` |
| `danger` | Erreur, destructeur | `#B3261E` | `#FF8A80` |
| `focusRing` (nouveau) | Anneau de focus | `#0B6468` | `#4FC9C4` |
| `scrim` (nouveau) | Voile de modale (alpha 50 % clair, 60 % sombre) | `#12201F80` | `#00000099` |
| `disabledBg`, `skeleton` | Alias de `border` | `#D4DFDB` | `#243735` |
| `disabledText` | Alias de `textMuted` | `#465856` | `#9FB6B2` |
| `overlay` | Teinte opaque (préférer `scrim`) | `#12201F` | `#000000` |
| `todoBg` (web seul) | Marqueur « à compléter » | `#FDE68A` | `#5B3A06` |

Rayons par direction : A 8 / 14 / 24, **B 10 / 16 / 28 (actif)**, C 4 / 6 / 10, `pill` 999.

### 2.2 Typographie

Polices du système. Graisses nommées : `regular` 400, `medium` 500, `semibold` 600, `bold` 700. Le rôle `TypeVariant` du composant `Text` n'est pas encore étendu : les trois variantes ajoutées (`h3`, `label`, `captionStrong`) existent dans `type` mais ne sont pas encore proposées par `<Text variant>`.

| Variante | Taille / interligne | Graisse | Usage |
|---|---|---|---|
| `title` | 28 / 34 | bold | Titre d'écran |
| `h2` | 22 / 28 | semibold | Titre de section |
| `h3` (nouveau) | 18 / 24 | semibold | Sous-titre |
| `body` | 16 / 24 (était 22) | regular | Texte courant |
| `bodySmall` | 14 / 20 | regular | Texte juridique, mentions obligatoires |
| `caption` | 13 / 18 | regular | Légende, aide |
| `label` (nouveau) | 14 / 20 | medium | Étiquette de champ |
| `captionStrong` (nouveau) | 13 / 18 | semibold | Statut, badge |

### 2.3 Autres jetons

| Famille | Valeurs |
|---|---|
| Espacement `space` | 0, 4, 8, 12, 16, 24, 32, 48 |
| `borderWidth` (nouveau) | hairline 1, strong 2 (le contour de champ à 2 pt est une condition de B, 01-direction.md section 10 ; non appliqué aux composants) |
| `MIN_TARGET` | 44 |
| `MAX_CONTENT_WIDTH` | 560 (application) ; 760 pour le web (`--size-content-max`) |
| `hitSlop` (nouveau) | 8 de chaque côté (un glyphe de 28 atteint 44) |
| `iconSize` (nouveau) | sm 16, md 20, lg 24, xl 32 |
| `stateOpacity` (nouveau) | pressed 0,8 ; hover 0,92 ; disabled 0,4 ; skeleton 0,45 |
| `focus` (nouveau) | largeur 2 pt, décalage 2 pt, couleur `focusRing` |
| `zIndex` (nouveau) | base 0, raised 10, sticky 100, overlay 200, modal 300, toast 400 |
| `motion.duration` (nouveau) | fast 120, base 180, slow 300 (ms) |
| `motion.easing` (nouveau) | standard (0,2 ; 0 ; 0 ; 1), enter (0 ; 0 ; 0 ; 1), exit (0,3 ; 0 ; 1 ; 1) |
| `reduceMotion` (nouveau) | Plus de translation, d'échelle ni de rebond ; fondu seul, durée plafonnée à 120 ms. CSS : les durées passent à 120 ms au maximum sous `prefers-reduced-motion`. |
| `elevation` (nouveau) | 0 : aucune ombre (repos, direction B). 1 : toast, `0 1px 2px` à 8 %, Android 1. 2 : feuille, menu, `0 4px 8px` à 12 %, Android 4. 3 : dialogue, `0 8px 16px` à 16 %, Android 8. |

Changements de valeur par rapport à l'existant, tous issus de la direction B : `primary`, `bg`, `surface`, `text`, `textMuted`, `verified` et les couleurs d'état ; rayons 8 / 12 / 20 devenus 10 / 16 / 28 ; interligne du corps 22 devenu 24 (déjà celui du site de présentation). Les opacités d'appui 0,7 / 0,78 / 0,8 des composants de `mobile/src/ui` sont remplacées par `stateOpacity.pressed` (0,8) ; aucun autre changement de code.

## 3. Contrastes

Formule WCAG 2.2 (`01-direction.md` section 3), recalculée à chaque génération pour les trois directions, clair et sombre : 72 paires par direction, 216 au total. Seuils : texte 4,5:1, contrôles, contours de composant et anneau de focus 3:1. Un rapport sous le seuil fait échouer la génération avec le nom de la paire et le rapport (exemple : `[B/light] contraste textMuted sur bg = 3.912:1 (minimum 4.5:1)`).

Résultat : **aucune paire en échec**. Les valeurs de B recalculées par le générateur coïncident avec celles de `01-direction.md` (par exemple `text` sur `bg` 16,06 clair et 16,40 sombre).

| Direction | Mode | Marge minimale texte | Marge minimale contrôle |
|---|---|---|---|
| A | clair | 5,00 (primary sur surface) | 4,19 (borderStrong sur surface) |
| A | sombre | 5,60 (disabledText sur disabledBg) | 4,22 (borderStrong sur surface) |
| **B** | clair | **5,27** (warning sur surface) | **3,94** (borderStrong sur surface) |
| **B** | sombre | **5,86** (disabledText sur disabledBg) | **5,23** (borderStrong sur surface) |
| C | clair | 5,53 (disabledText sur disabledBg) | 4,20 (borderStrong sur surface) |
| C | sombre | 5,54 (disabledText sur disabledBg) | 4,86 (borderStrong sur surface) |

Paires de B retenues (clair / sombre) : `text`/`bg` 16,06 / 16,40 ; `textMuted`/`surface` 6,69 / 7,73 ; `primary`/`bg` 6,62 / 9,33 ; `onPrimary`/`primary` 6,91 / 8,50 ; `onPrimary`/`danger` 6,54 / 7,45 ; `onAccent`/`accent` 8,70 / 10,65 ; `like`/`surface` 5,47 / 9,25 ; `dislike`/`surface` 5,81 / 7,25 ; `verified` et `info`/`surface` 6,63 / 7,15 ; `focusRing`/`surface` 6,15 / 8,27 ; `passNeutral`/`surface` 6,69 / 7,73 ; `borderStrong`/`bg` 4,25 / 5,90. Le tableau complet s'obtient avec `node design/build-tokens.mjs --report`.

Pour information, hors exigence : `accent`/`bg` 2,02 en clair, 10,86 en sombre (l'accent ne porte jamais seul une information) ; `border`/`bg` 1,31 en clair (séparateur décoratif).

## 4. Ajouter un jeton

1. Couleur : ajouter le rôle dans `colorRoles` (avec `doc`, et `"platforms": ["web"]` s'il ne concerne que le web), puis une valeur claire et sombre dans **chacune des trois directions** (ou dans `colorShared`). Si le rôle sert de texte ou de contrôle, ajouter ses paires à `contrast.text` ou `contrast.control`.
2. Autre famille : ajouter la clé dans `tokens.json`, la valider dans `validate()` et la rendre dans `renderTs()` et `renderCss()` de `build-tokens.mjs`.
3. `npm run tokens` (depuis `mobile/`), puis `npm run tokens:test`, `npm run typecheck`, `npm test`. Ne jamais éditer `tokens.ts` ni `tokens.css`.
4. Les noms existants ne se retirent pas : un jeton obsolète se déprécie d'abord (commentaire `doc`), puis se supprime quand plus aucun fichier ne l'utilise.

## 5. Changer de direction

Modifier `"activeDirection"` (`"A"`, `"B"` ou `"C"`) dans `design/tokens.json`, puis `npm run tokens`. Couleurs, rayons, `tokens.ts`, `tokens.css` et les quatre couleurs de `app.json` suivent. Un test (`tokens.test.mjs`) vérifie que la direction C produit un jeu valide.

## 6. Ce qui n'est PAS fait

- **Aucun rendu** : pas d'aperçu sur appareil, émulateur ni navigateur pour cette phase (captures `phase2-*.png` non produites). Les rayons 10 / 16 / 28 et l'interligne 24 modifient la mise en page ; à vérifier à l'œil.
- **Images natives** : `assets/icon.png` et les images d'icône adaptative (avant-plan, arrière-plan, monochrome) ne sont pas régénérées ; seules les couleurs d'`app.json` suivent. Aucun logo (décision 14).
- **Composants non remis en forme** : boutons en pilule, contour de champ à 2 pt, bouton « Passer » en `passNeutral`, badge de forme propre, `Text` avec les variantes `h3`, `label`, `captionStrong`, anneau de focus 2 pt côté application : jetons prêts, usage en phase 3.
- **`web/assets/site.css`** garde ses valeurs en dur d'épaisseur de focus (2 px) et de tailles de titre ; il utilise déjà les variables de couleur, d'espacement et de rayon.
- **Police** : polices du système uniquement. Pas de comparaison avec une police de marque ni de mesure de poids ou de licence (reporté, `01-direction.md` section 5.2). Android n'a pas de graisse 600 (Roboto) : la résolution de `semibold` vers 500 ou 700 par plateforme n'est pas faite.
- **200 % de police** et écran de 320 pt : pas de test de ces cas dans cette phase.
- **Mouvement** : les jetons existent ; `Skeleton` garde ses 800 ms et son 0,45 en dur, aucune animation existante n'est migrée.
- **Élévation** : niveaux définis, aucun composant ne les utilise (B n'a pas d'ombre au repos).
- **Direction** : B reste provisoire (test de préférence, recherche d'antériorité du nom) ; `verified` à revalider avec le nouveau primaire est fait pour le contraste (6,63 / 7,15) mais pas pour la perception en tritanopie (`01-direction.md` section 6).
