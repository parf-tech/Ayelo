# Phase 1 : direction de marque d'Ayelo, trois directions comparées

Date : 2026-11-08. Livrable de la phase 1 de `PROMPT-UIUX-EXPERT.md` (section 5). S'appuie sur `00-audit.md`, `00-a11y.md`, `00-concurrents.md` et `01-decisions.md` (décision 14 : aucune direction ne devient définitive avant la recherche d'antériorité du nom). Aperçu visuel autonome et hors ligne : [`previews/directions.html`](previews/directions.html) (clair et sombre, 390 pt, palettes avec rapports de contraste calculés, échelle typographique, cinq maquettes par direction). Aucun fichier source de l'application n'a été modifié.

## 1. Résumé

- Trois directions réellement différentes sont proposées : **A Terre cuite** (le terracotta actuel, affiné), **B Lagune** (sarcelle profonde, papier chaud, accent ocre), **C Encre et safran** (encre bleu-noir, papier, safran en touches, titres en serif système).
- Toutes passent les seuils : texte 4,5:1, contrôles et anneau de focus 3:1, en clair et en sombre, **calculé par formule** (section 3). Aucune ne dépend d'une police à télécharger : 0 Ko de police.
- Notes (grille de la section 9) : A 24 sur 35, B 30 sur 35, C 29 sur 35.
- **Recommandation : B Lagune**, à confirmer par le propriétaire. Elle porte le mieux les deux principes qui définissent le produit (confiance d'abord, chaleur sans cliché) et se distingue le plus nettement du terracotta crème devenu un lieu commun. C Encre et safran est une alternative sérieuse (meilleure lisibilité au soleil, marges d'accessibilité les plus larges) ; A n'est retenue que si le propriétaire privilégie la continuité avec l'existant.
- **Aucune direction n'est finale.** Le nom « Ayelo » est sous vérification d'antériorité (AILO, Aylo). Aucun logo ni mot-symbole n'est dessiné ici : les maquettes montrent un cadre en pointillés avec le mot « Ayelo » en police système, repère neutre, explicitement provisoire.
- Ce qui reste au propriétaire : choisir la direction (ou demander une variante), valider la police (système en V1 recommandé), valider la décision « Passer en couleur neutre », lancer la recherche d'antériorité avant tout logo. Liste complète en section 11.

## 2. Garde-fous respectés

| Règle | Application |
|---|---|
| Pas de logo ni de mot-symbole | Un cadre en pointillés « Ayelo » en police système, avec la mention « repère typographique provisoire ». Aucune lettrine, aucune icône d'application, aucun monogramme. |
| Pas de photo de personne réelle | Les maquettes utilisent un espace réservé (silhouette générique sur un aplat) et des formes abstraites. Le prénom « Amina » est fictif et signalé comme tel. |
| Pas de marque copiée | Aucune couleur, forme, geste ou slogan repris d'une application citée. Voir section 8 pour la méthode de différenciation. |
| Pas de motif « africain » décoratif, pas de drapeau | Aucun tissage, aucune frise, aucune carte du continent, aucune combinaison vert, jaune, rouge en aplat. Voir section 7. |
| Faits, hypothèses, inconnus | Étiquetés à chaque fois que la source n'est pas le dépôt. |
| Dépendances | Aucune ajoutée. `react-native-svg` et Lucide restent planifiés en phase 3 (décision 11). |

## 3. Méthode de vérification des couleurs

**Contraste.** Formule WCAG 2.2 : canal `c = v/255`, `lin = c/12,92` si `c <= 0,04045`, sinon `((c+0,055)/1,055)^2,4` ; luminance `L = 0,2126 R + 0,7152 G + 0,0722 B` ; rapport `(L1 + 0,05)/(L2 + 0,05)` avec `L1 >= L2`. Calculé par script, arrondi au centième. Seuils : texte et glyphes porteurs de sens 4,5:1 ; contours de contrôles, anneau de focus et composants graphiques 3:1. Le jeton `border` (séparateur décoratif) n'est pas exigé à 3:1 (même règle que `00-a11y.md` section 1.2, note a) ; `borderStrong` l'est.

**Vision des couleurs altérée.** Simulation par les matrices de Machado, Oliveira et Fernandes (2009), sévérité maximale, puis distance de couleur CIE76 en espace Lab (une distance inférieure à environ 10 est difficile à distinguer, indicatif). Le résultat guide ; il ne remplace pas un test avec des personnes concernées. La règle de fond de `00-a11y.md` reste : **jamais la couleur seule** (glyphe et libellé en plus).

**Soleil.** Un téléphone en plein soleil ajoute un voile de lumière réfléchie sur l'écran. Modèle simplifié : `(L1 + 0,05 + g)/(L2 + 0,05 + g)` avec `g = 0,15`. C'est une **hypothèse de modèle, pas une mesure** ; elle sert à comparer les directions entre elles. À confirmer sur appareil, dehors, avec la luminosité automatique.

**Limites.** Rien n'a été rendu sur un téléphone. L'aperçu HTML a été ouvert dans un navigateur de bureau seulement. Les rendus de police varient selon le constructeur.

## 4. Jetons sémantiques communs aux trois directions

La direction ne change que les valeurs, pas la structure. C'est la condition pour que la phase 2 (`design/tokens.json`) démarre sans attendre le choix de marque.

| Jeton | Rôle | Différence avec `tokens.ts` actuel |
|---|---|---|
| `bg`, `surface` | Fond, cartes, champs, bulles reçues | Inchangé |
| `text`, `muted` | Texte principal et secondaire | Inchangé |
| `primary`, `onPrimary` | Action principale, lien, bulle envoyée, texte dessus | Inchangé |
| `accent`, `onAccent` | **Nouveau.** Mise en avant douce (puce d'intention, match, plan choisi). Ne porte jamais une information seule ; n'est pas exigé à 3:1 contre le fond car le texte `onAccent` porte le sens | Nouveau |
| `border`, `borderStrong` | Séparateur décoratif, contour de contrôle (3:1 exigé) | Inchangé |
| `like`, `dislike` | J'aime, refus (déjà corrigés dans `00-a11y.md` 1.4) | Valeurs revues par direction |
| `verified` | Badge vérifié, bandeau d'information | Le badge doit utiliser ce jeton (audit P1) |
| `warning`, `success`, `danger` | États | Revus pour la marge |
| `focus` | **Nouveau.** Anneau de focus 2 pt | Absent aujourd'hui |

Proposition applicable à toute direction : le bouton **Passer** prend la couleur `muted` (contour neutre), et non `dislike`. Raison : le principe 2 du prompt maître (« un non est neutre »), et le tableau de daltonisme (section 6) montre que le rouge et le vert se confondent en protanopie et en deutéranopie dans toutes les directions. Le jeton `dislike` reste pour les contextes destructeurs ou d'erreur. Les maquettes l'appliquent.

## 5. Les trois directions

### 5.1 Direction A : Terre cuite

**Mots-clés** : chaleureux, terrien, humain, rassurant, simple.

**Ce qu'elle dit.** « Une personne vous accueille. » La couleur de l'argile cuite évoque le foyer et le concret, pas la technologie. Elle prolonge l'existant : c'est la direction qui coûte le moins en continuité.

**Palette (jetons sémantiques).**

| Jeton | Rôle | Clair | Sombre |
|---|---|---|---|
| `bg` | Fond d’écran | `#FFFCF9` | `#14100E` |
| `surface` | Cartes, champs, bulles reçues | `#F6F0EA` | `#211B18` |
| `text` | Texte principal | `#1F1A17` | `#F5EEE8` |
| `muted` | Texte secondaire, aides, onglets inactifs | `#5C5049` | `#B6A9A0` |
| `primary` | Action principale (fond) et lien (texte) | `#B93C0A` | `#FF9A55` |
| `onPrimary` | Texte et glyphes sur primary | `#FFFFFF` | `#1F1A17` |
| `accent` | Mise en avant douce (match, plan choisi), jamais seule porteuse d’information | `#F6C99A` | `#4A2A16` |
| `onAccent` | Texte sur accent | `#2A1608` | `#FBE3CC` |
| `border` | Séparateurs décoratifs | `#E3D9D0` | `#3A302B` |
| `borderStrong` | Contours de contrôles (champ, case, puce) | `#7D7168` | `#8A7C72` |
| `like` | J’aime (texte, contour, glyphe) | `#137538` | `#5AD98A` |
| `dislike` | Passer (texte, contour, glyphe) | `#C81E1E` | `#FF8A80` |
| `verified` | Badge vérifié | `#1D4ED8` | `#7FB0FF` |
| `warning` | Avertissement (alerte anti-arnaque contextuelle) | `#8F4A05` | `#FBBF24` |
| `success` | Succès | `#137538` | `#5AD98A` |
| `danger` | Erreur, action destructrice | `#B42318` | `#FF8A80` |
| `focus` | Anneau de focus 2 pt | `#B93C0A` | `#FF9A55` |

Le primaire `#B93C0A` est le `#C2410C` actuel assombri de 4 % (valeur déjà proposée par `00-a11y.md` 1.4), qui gagne de la marge sur surface.

**Contrastes calculés.**

| Paire | Seuil | Clair | Sombre |
|---|---|---|---|
| text / bg | 4,50:1 | 16,86 | 16,46 |
| text / surface | 4,50:1 | 15,24 | 14,80 |
| muted / bg | 4,50:1 | 7,61 | 8,26 |
| muted / surface | 4,50:1 | 6,88 | 7,43 |
| primary (texte, lien) / bg | 4,50:1 | 5,53 | 9,01 |
| primary (texte) / surface | 4,50:1 | 5,00 | 8,10 |
| onPrimary / primary (bouton, bulle envoyee) | 4,50:1 | 5,65 | 8,21 |
| onAccent / accent | 4,50:1 | 11,29 | 10,38 |
| like (texte) / surface | 4,50:1 | 5,12 | 9,50 |
| dislike (texte) / surface | 4,50:1 | 5,07 | 7,45 |
| verified (texte) / surface | 4,50:1 | 5,93 | 7,74 |
| warning (texte) / surface | 4,50:1 | 5,90 | 10,19 |
| success (texte) / surface | 4,50:1 | 5,12 | 9,50 |
| danger (texte) / surface | 4,50:1 | 5,81 | 7,45 |
| borderStrong / bg (cadre de champ) | 3,00:1 | 4,63 | 4,69 |
| borderStrong / surface | 3,00:1 | 4,19 | 4,22 |
| focus / bg (anneau 2 pt) | 3,00:1 | 5,53 | 9,01 |
| focus / surface | 3,00:1 | 5,00 | 8,10 |
| primary / bg (composant plein) | 3,00:1 | 5,53 | 9,01 |
| accent / bg (information, non exigé) | info | 1,50 | 1,47 |

**Typographie.** Police système seulement (San Francisco sur iOS, Roboto ou la police du constructeur sur Android) : 0 Ko. Échelle des jetons actuels : 28/34 (titre), 22/28, 16/24, 14/20, 13/18. Titres en graisse 700 avec un léger resserrement (-0,01 em). Pas de police de marque : le gain de personnalité serait faible face au coût de chargement.

**Forme.** Rayons 8 / 14 / 24 pt, boutons à 14 pt, cartes à 24 pt. Élévation douce à deux niveaux (ombre diffuse). Contours de 1 pt.

**Photographie et illustration.** Photos naturelles, lumière du jour, cadrage au niveau du visage, sans filtre appliqué par l'application. Illustrations : deux ou trois formes en arche et un disque, couleurs du système (primaire, accent). Aucune scène de couple, aucune silhouette stylisée.

**Icônes** (compatibles Lucide, traits). Trait de 2 pt, extrémités et jonctions arrondies, cœur plein à l'état actif.

**Mouvement.** Doux et arrondi : ressort léger, 180 à 300 ms, léger dépassement acceptable sur la carte et le match ; tout est supprimé ou remplacé par un fondu si « réduire les animations » est actif.

**Ton, exemples.**
- Accueil : « Rencontrez des personnes qui cherchent la même chose que vous. »
- Match : « C'est un match ! Dites bonjour. »
- Fin de pile : « Vous avez tout vu pour le moment. Revenez plus tard. »

**Tests.**

| Critère | Résultat |
|---|---|
| Confiance | Moyenne. La chaleur domine ; la preuve de sérieux doit venir du contenu (badge, bandeau, prix honnêtes). |
| Chaleur | Très bonne. |
| Lisibilité, plein soleil (modèle, `g = 0,15`) | Voir tableau ci-dessous : primaire en lien 5,53 nominal, 3,51 avec voile. Marge la plus étroite des trois sur le primaire. |
| Poids | 0 Ko de police. Les ombres d'élévation coûtent un peu plus à dessiner sur un GPU faible (hypothèse, à mesurer avec le budget de 60 images/s). |
| Différenciation | Faible. Le terracotta sur crème est une tendance très répandue (impression de conception, non sourcée) et se rapproche des teintes chaudes courantes dans les rencontres (de mémoire, non sourcé dans le dépôt). |
| Adéquation culturelle | Bonne : couleur de terre sans lien à un pays ni à un drapeau. |
| Accessibilité | Toutes les paires exigées passent. Risque propre : primaire et avertissement (deux orange-brun voisins) se confondent en protanopie (distance 1 en clair). Le glyphe et le libellé du bandeau sauvent la lecture ; la couleur seule ne suffit pas. |

| Paire | Rapport nominal | Rapport avec voile de reflet (modèle) |
|---|---|---|
| text / bg | 16,86 | 5,58 |
| muted / bg | 7,61 | 4,13 |
| primary (texte) / bg | 5,53 | 3,51 |
| onPrimary / primary | 5,65 | 3,57 |
| borderStrong / bg | 4,63 | 3,17 |

### 5.2 Direction B : Lagune

**Mots-clés** : calme, fiable, lumineux, posé, ouvert.

**Ce qu'elle dit.** « Vous pouvez vous poser. » Une sarcelle profonde (ni vert vif ni bleu technologique) évoque l'eau calme, la clarté ; le papier chaud et l'ocre tempèrent la froideur. Pensée pour un produit dont la promesse est la confiance et dont le risque est l'arnaque : un fond serein rend le bandeau d'alerte plus lisible parce qu'il n'est pas noyé dans une couleur de marque saturée.

**Palette (jetons sémantiques).**

| Jeton | Rôle | Clair | Sombre |
|---|---|---|---|
| `bg` | Fond d’écran | `#FBFAF6` | `#0B1413` |
| `surface` | Cartes, champs, bulles reçues | `#EDF3F0` | `#142120` |
| `text` | Texte principal | `#12201F` | `#E9F2F0` |
| `muted` | Texte secondaire, aides, onglets inactifs | `#465856` | `#9FB6B2` |
| `primary` | Action principale (fond) et lien (texte) | `#0B6468` | `#4FC9C4` |
| `onPrimary` | Texte et glyphes sur primary | `#FFFFFF` | `#06201F` |
| `accent` | Mise en avant douce (match, plan choisi), jamais seule porteuse d’information | `#E3A92B` | `#F0BE55` |
| `onAccent` | Texte sur accent | `#1A1405` | `#1A1405` |
| `border` | Séparateurs décoratifs | `#D4DFDB` | `#243735` |
| `borderStrong` | Contours de contrôles (champ, case, puce) | `#677C79` | `#7C9692` |
| `like` | J’aime (texte, contour, glyphe) | `#17703B` | `#5AD98A` |
| `dislike` | Passer (texte, contour, glyphe) | `#B3261E` | `#FF8A80` |
| `verified` | Badge vérifié | `#3446C4` | `#8FA6FF` |
| `warning` | Avertissement (alerte anti-arnaque contextuelle) | `#8A5A00` | `#F0BE55` |
| `success` | Succès | `#17703B` | `#5AD98A` |
| `danger` | Erreur, action destructrice | `#B3261E` | `#FF8A80` |
| `focus` | Anneau de focus 2 pt | `#0B6468` | `#4FC9C4` |

Le jeton `verified` passe à un indigo (`#3446C4`) pour qu'il reste distinct de la sarcelle du primaire. Sous tritanopie, indigo et sarcelle se rapprochent (section 6) : le badge garde une forme propre (pastille avec coche) et un libellé.

**Contrastes calculés.**

| Paire | Seuil | Clair | Sombre |
|---|---|---|---|
| text / bg | 4,50:1 | 16,06 | 16,40 |
| text / surface | 4,50:1 | 14,92 | 14,53 |
| muted / bg | 4,50:1 | 7,20 | 8,73 |
| muted / surface | 4,50:1 | 6,69 | 7,73 |
| primary (texte, lien) / bg | 4,50:1 | 6,62 | 9,33 |
| primary (texte) / surface | 4,50:1 | 6,15 | 8,27 |
| onPrimary / primary (bouton, bulle envoyee) | 4,50:1 | 6,91 | 8,50 |
| onAccent / accent | 4,50:1 | 8,70 | 10,65 |
| like (texte) / surface | 4,50:1 | 5,47 | 9,25 |
| dislike (texte) / surface | 4,50:1 | 5,81 | 7,25 |
| verified (texte) / surface | 4,50:1 | 6,63 | 7,15 |
| warning (texte) / surface | 4,50:1 | 5,27 | 9,62 |
| success (texte) / surface | 4,50:1 | 5,47 | 9,25 |
| danger (texte) / surface | 4,50:1 | 5,81 | 7,25 |
| borderStrong / bg (cadre de champ) | 3,00:1 | 4,25 | 5,90 |
| borderStrong / surface | 3,00:1 | 3,94 | 5,23 |
| focus / bg (anneau 2 pt) | 3,00:1 | 6,62 | 9,33 |
| focus / surface | 3,00:1 | 6,15 | 8,27 |
| primary / bg (composant plein) | 3,00:1 | 6,62 | 9,33 |
| accent / bg (information, non exigé) | info | 2,02 | 10,86 |

**Typographie.** Police système : 0 Ko. Titres en graisse 600 sur iOS ; sur Android, Roboto n'a pas de graisse 600 : le jeton doit résoudre vers 500 ou 700 selon la plateforme (à fixer en phase 2). Interlignes généreux (24 pt pour 16 pt). Option de police de marque, à examiner en phase 2 seulement : **Figtree** (licence SIL OFL 1.1, à reconfirmer sur la page officielle avant tout ajout), deux graisses statiques, poids estimé de quelques dizaines de Ko chacune (**hypothèse, à mesurer**) ; non recommandée en V1.

**Forme.** Rayons 10 / 16 / 28 pt, boutons en pilule. **Aucune ombre** : la hiérarchie vient d'un contour de 1 pt et d'un léger changement de fond. Moins de dessin pour le GPU, rendu stable en plein soleil (une ombre se perd, un contour non).

**Photographie et illustration.** Photos naturelles, lumière du jour, diversité de contextes (travail, famille, ville, voyage) sans mise en scène de couple. Illustrations : cercles qui se chevauchent et une vague très simple, en aplats de la palette, utilisées aux états vides et à l'accueil seulement.

**Icônes** (compatibles Lucide). Trait de 1,75 pt, extrémités arrondies, légèrement plus aérées ; badge vérifié en pastille avec coche.

**Mouvement.** Posé : fondus et glissements courts, 180 à 300 ms, courbe sans dépassement. Le match est une apparition douce de l'accent ocre, jamais un feu d'artifice. Mouvement réduit : fondu seul.

**Ton, exemples.**
- Accueil : « Rencontrez des personnes qui cherchent la même chose que vous. »
- Match : « C'est un match ! Prenez le temps de vous écrire. »
- Abonnement refusé ou annulé : « Rien n'a été prélevé. Vous pouvez reprendre quand vous voulez. »

**Tests.**

| Critère | Résultat |
|---|---|
| Confiance | Très bonne : couleur sobre, plat, peu de décor. Hypothèse (à valider en entretien) : la sarcelle est associée au calme et au sérieux. |
| Chaleur | Bonne, grâce au papier chaud (`#FBFAF6`) et à l'ocre. |
| Lisibilité, plein soleil (modèle) | Voir tableau : primaire 6,62 nominal, 3,83 avec voile. Le contour de champ tombe à 2,99 avec voile : prévoir un contour de 2 pt pour les champs. |
| Poids | 0 Ko de police ; pas d'ombre ; le plus léger des trois. |
| Différenciation | Bonne. La sarcelle profonde avec ocre est peu courante parmi les rencontres étudiées (hypothèse : à vérifier en alignant les icônes des 12 applications de `00-concurrents.md` sur une page de boutique). |
| Adéquation culturelle | Bonne, avec une vigilance : sarcelle et ocre sont voisins du vert et du jaune de plusieurs drapeaux d'Afrique francophone. Le risque de lecture « drapeau » est faible (la sarcelle n'est pas un vert franc, aucun rouge dans la marque, l'ocre sert en touches) mais il est à faire valider en entretien. |
| Accessibilité | Toutes les paires exigées passent, marge minimale de texte 5,27 (avertissement sur surface). Faiblesse : distance indigo et sarcelle de 17 en tritanopie. |

| Paire | Rapport nominal | Rapport avec voile de reflet (modèle) |
|---|---|---|
| text / bg | 16,06 | 5,43 |
| muted / bg | 7,20 | 3,99 |
| primary (texte) / bg | 6,62 | 3,83 |
| onPrimary / primary | 6,91 | 3,98 |
| borderStrong / bg | 4,25 | 2,99 |

### 5.3 Direction C : Encre et safran

**Mots-clés** : éditorial, net, contrasté, sobre, assumé.

**Ce qu'elle dit.** « Direct et sans détour. » Une encre bleu-noir sur papier, le safran en touches, des titres en serif. Elle assume une personnalité de revue plus que d'application de masse. C'est la plus lisible en plein soleil.

**Palette (jetons sémantiques).**

| Jeton | Rôle | Clair | Sombre |
|---|---|---|---|
| `bg` | Fond d’écran | `#FFFEFB` | `#0F0D14` |
| `surface` | Cartes, champs, bulles reçues | `#F3F1EC` | `#1B1823` |
| `text` | Texte principal | `#17141F` | `#F4F1FA` |
| `muted` | Texte secondaire, aides, onglets inactifs | `#53505C` | `#AAA5B8` |
| `primary` | Action principale (fond) et lien (texte) | `#1F1B2E` | `#FFB81F` |
| `onPrimary` | Texte et glyphes sur primary | `#FFFFFF` | `#17141F` |
| `accent` | Mise en avant douce (match, plan choisi), jamais seule porteuse d’information | `#F2A900` | `#3A3350` |
| `onAccent` | Texte sur accent | `#17141F` | `#F4F1FA` |
| `border` | Séparateurs décoratifs | `#DCD8CF` | `#322D40` |
| `borderStrong` | Contours de contrôles (champ, case, puce) | `#757180` | `#8A8498` |
| `like` | J’aime (texte, contour, glyphe) | `#166534` | `#5AD98A` |
| `dislike` | Passer (texte, contour, glyphe) | `#B91C1C` | `#FF8A80` |
| `verified` | Badge vérifié | `#1E40AF` | `#8FA6FF` |
| `warning` | Avertissement (alerte anti-arnaque contextuelle) | `#8A5300` | `#FF9E7A` |
| `success` | Succès | `#166534` | `#5AD98A` |
| `danger` | Erreur, action destructrice | `#B91C1C` | `#FF8A80` |
| `focus` | Anneau de focus 2 pt | `#1F1B2E` | `#FFB81F` |

Particularité : le **primaire change de teinte entre clair et sombre** (encre en clair, safran en sombre) pour garder un bouton à fort contraste ; la fonction reste identique. Ce n'est pas une inversion mécanique.

**Contrastes calculés.**

| Paire | Seuil | Clair | Sombre |
|---|---|---|---|
| text / bg | 4,50:1 | 18,01 | 17,29 |
| text / surface | 4,50:1 | 16,09 | 15,65 |
| muted / bg | 4,50:1 | 7,80 | 8,07 |
| muted / surface | 4,50:1 | 6,97 | 7,31 |
| primary (texte, lien) / bg | 4,50:1 | 16,60 | 11,15 |
| primary (texte) / surface | 4,50:1 | 14,83 | 10,09 |
| onPrimary / primary (bouton, bulle envoyee) | 4,50:1 | 16,74 | 10,49 |
| onAccent / accent | 4,50:1 | 9,04 | 10,63 |
| like (texte) / surface | 4,50:1 | 6,32 | 9,76 |
| dislike (texte) / surface | 4,50:1 | 5,73 | 7,66 |
| verified (texte) / surface | 4,50:1 | 7,73 | 7,55 |
| warning (texte) / surface | 4,50:1 | 5,61 | 8,68 |
| success (texte) / surface | 4,50:1 | 6,32 | 9,76 |
| danger (texte) / surface | 4,50:1 | 5,73 | 7,66 |
| borderStrong / bg (cadre de champ) | 3,00:1 | 4,70 | 5,36 |
| borderStrong / surface | 3,00:1 | 4,20 | 4,86 |
| focus / bg (anneau 2 pt) | 3,00:1 | 16,60 | 11,15 |
| focus / surface | 3,00:1 | 14,83 | 10,09 |
| primary / bg (composant plein) | 3,00:1 | 16,60 | 11,15 |
| accent / bg (information, non exigé) | info | 1,99 | 1,63 |

**Typographie.** Titres en **serif système** (Georgia sur iOS, Noto Serif sur la plupart des Android) graisse 700 ; texte courant en sans-serif système. 0 Ko. Risque : le serif système varie selon le constructeur et peut être absent ou très différent sur des téléphones d'entrée de gamme (à tester sur Tecno, Infinix, Samsung A, Xiaomi). Option de police de marque pour les titres : **Source Serif 4** (licence SIL OFL, à reconfirmer), une graisse, poids estimé de quelques dizaines de Ko (**hypothèse à mesurer**) ; non recommandée en V1.

**Forme.** Rayons 4 / 6 / 10 pt, boutons à 6 pt. **Aucune ombre**, contours de 2 pt, boutons pleins à contour de la même couleur. Aspect imprimé, très stable en plein soleil.

**Photographie et illustration.** Photos naturelles, cadrage plus serré, cartes avec bandeau de texte plein sous la photo (déjà le cas dans `SwipeCard`). Illustrations : un bloc encre et un demi-disque safran, aplats, géométrie nue.

**Icônes** (compatibles Lucide). Trait de 2,25 pt, jonctions en pointe (miter), extrémités nettes ; réglable par propriétés sans icône personnalisée.

**Mouvement.** Net : 120 à 180 ms, aucune oscillation, arrêt franc. Le match apparaît par un cadre safran qui se remplit. Mouvement réduit : suppression.

**Ton, exemples.**
- Accueil : « Rencontrez des personnes qui cherchent la même chose que vous. »
- Match : « Match. Écrivez en premier si vous voulez. »
- Erreur réseau : « Pas de connexion. Votre message sera envoyé dès le retour du réseau. »

**Tests.**

| Critère | Résultat |
|---|---|
| Confiance | Bonne : ton sobre, contraste fort. Un peu austère. |
| Chaleur | Moyenne : tenue par le papier, le safran et le ton, pas par la forme. |
| Lisibilité, plein soleil (modèle) | Meilleure : primaire en lien 16,60 nominal, 5,60 avec voile. |
| Poids | 0 Ko de police ; pas d'ombre. Le serif système peut ajouter une variabilité de rendu. |
| Différenciation | Bonne : encre et safran, titres en serif, peu courants dans les rencontres de mémoire (non sourcé). |
| Adéquation culturelle | Plus réservée : serif et noir et or évoquent l'édition européenne ; hypothèse à tester auprès de la diaspora et des marchés de la vague 2. Pas de drapeau ni de motif. |
| Accessibilité | Marges les plus larges (texte minimal sur surface 5,61 ; contour de champ 4,20). Faiblesse : primaire et avertissement trop proches en sombre sous tritanopie (distance 12). |

| Paire | Rapport nominal | Rapport avec voile de reflet (modèle) |
|---|---|---|
| text / bg | 18,01 | 5,73 |
| muted / bg | 7,80 | 4,20 |
| primary (texte) / bg | 16,60 | 5,60 |
| onPrimary / primary | 16,74 | 5,64 |
| borderStrong / bg | 4,70 | 3,21 |

## 6. Vision des couleurs altérée (indicatif)

Distance de couleur CIE76 entre deux jetons, après simulation. En dessous d'environ 10 : difficile à distinguer.

| Paire | Direction | Mode | Normal | Protanopie | Deutéranopie | Tritanopie |
|---|---|---|---|---|---|---|
| like / dislike | A | clair | 106 | 11 | 28 | 114 |
| like / dislike | A | sombre | 96 | 25 | 6 | 99 |
| like / dislike | B | clair | 95 | 12 | 26 | 104 |
| like / dislike | B | sombre | 96 | 25 | 6 | 99 |
| like / dislike | C | clair | 97 | 8 | 29 | 106 |
| like / dislike | C | sombre | 96 | 25 | 6 | 99 |
| primary / warning | A | clair | 24 | 1 | 9 | 30 |
| primary / warning | A | sombre | 35 | 33 | 23 | 19 |
| primary / warning | B | clair | 70 | 53 | 61 | 60 |
| primary / warning | B | sombre | 78 | 63 | 70 | 76 |
| primary / warning | C | clair | 69 | 63 | 69 | 49 |
| primary / warning | C | sombre | 47 | 50 | 39 | 12 |
| success / danger | A | clair | 99 | 14 | 25 | 106 |
| success / danger | A | sombre | 96 | 25 | 6 | 99 |
| success / danger | B | clair | 95 | 12 | 26 | 104 |
| success / danger | B | sombre | 96 | 25 | 6 | 99 |
| success / danger | C | clair | 97 | 8 | 29 | 106 |
| success / danger | C | sombre | 96 | 25 | 6 | 99 |
| verified / primary | A | clair | 127 | 114 | 131 | 101 |
| verified / primary | A | sombre | 99 | 88 | 101 | 85 |
| verified / primary | B | clair | 83 | 60 | 60 | 17 |
| verified / primary | B | sombre | 63 | 42 | 38 | 24 |
| verified / primary | C | clair | 59 | 54 | 58 | 33 |
| verified / primary | C | sombre | 125 | 122 | 125 | 63 |

Lecture :
- **Rouge et vert (`like` et `dislike`, `success` et `danger`)** : proches en protanopie (8 à 25) et en deutéranopie (6 à 29) dans **toutes** les directions, en clair comme en sombre. Cause : ce sont des couleurs de signal dans un système sémantique. Réponse : glyphe et libellé toujours présents (déjà la règle), et bouton Passer neutre (section 4).
- **A, primaire et avertissement** : indistinguables en protanopie en clair (1). C'est un défaut de la direction : deux orange-brun voisins. Réponse possible : avertissement vers un jaune-olive plus clair ou supprimer l'avertissement de couleur au profit d'un contour double. Non retenu ici pour ne pas déformer A.
- **B, vérifié et primaire** : indigo et sarcelle se rapprochent en tritanopie (17 en clair, 24 en sombre). Le badge a une forme propre.
- **C, primaire et avertissement en sombre** : safran et corail proches en tritanopie (12). L'avertissement porte un glyphe et un titre « Attention ».

## 7. Culture et inclusion (faits, hypothèses, inconnus)

- **Fait (dépôt)** : public cible = diaspora et communautés africaines ; marchés France, Belgique, Suisse, Canada, puis Côte d'Ivoire, Sénégal, Cameroun, Bénin (`PROMPT-UIUX-EXPERT.md`, section 2).
- **Règle retenue** : aucun motif « africain » décoratif (tissages, frises), aucune carte du continent, aucune combinaison de drapeau, aucune silhouette stylisée de couple. La culture se montre par le contenu (origine, pays de résidence, intentions, langues), pas par un habillage. Raison : le décor générique est un cliché et regroupe des cultures entières (un avis cité dans `00-concurrents.md` pour Muzz critique déjà les filtres d'ethnicité jugés réducteurs).
- **Couleur** : aucune des trois directions n'utilise vert, jaune et rouge ensemble dans la marque. B et C emploient un accent jaune-ocre ou jaune-safran en touches : à faire valider en entretien auprès de personnes de plusieurs pays (**hypothèse à valider**).
- **Photographie** : la diversité de teintes de peau, d'âges, de contextes est une exigence de la bibliothèque d'images (pas de banque d'images unique, pas d'éclaircissement). Les images d'illustration de l'application doivent être libres de droits ou générées, sans visage réel identifiable.
- **Inconnu** : préférences chromatiques réelles de la diaspora et des marchés de la vague 2 ; aucune donnée dans le dépôt. À explorer en entretien (5 à 8 personnes), par un test de préférence entre les trois aperçus.

## 8. Différenciation (méthode, sans imitation)

Le dépôt (`00-concurrents.md`) documente le positionnement, la vérification et les prix des concurrents, **pas leur identité visuelle**. Les couleurs de marque des concurrents ne sont donc pas sourcées ici ; toute affirmation de proximité chromatique ci-dessus est de mémoire et à vérifier. Méthode : placer les icônes d'application contemporaines des douze applications citées côte à côte avec chaque direction (page de boutique) et écarter toute direction trop proche.

| Application (fiche de `00-concurrents.md`) | Ce que le dépôt en dit | Ce que la direction d'Ayelo évite de reprendre |
|---|---|---|
| Tinder (2.8) | Généraliste de masse, vérification facultative | Un geste ou un symbole de marque unique porté par la couleur |
| Bumble (2.9) | Les femmes écrivent en premier, match qui expire en 24 h | Un aplat jaune dominant ; le compteur qui culpabilise (principe 2) |
| Hinge (2.10) | « Conçue pour être effacée », profils de personnalité | Le discours de retrait ; aucune formule reprise |
| Badoo (2.7) | Rencontres et amitiés, détecteurs de faux comptes | Les crédits en plus de l'abonnement |
| Meetic (2.11) | France, relations sérieuses | Le ton de formule premium |
| Muzz (2.5) | Mariage, communauté musulmane, selfie obligatoire | Les marqueurs religieux ; l'idée de vérification est reprise en mécanisme, pas en identité |
| Hily (2.6) | Questionnaire, essai qui bascule en forfait cher | Les motifs sombres (essai piège, J'aime floutés) |
| AfroIntroductions (2.2) | Panafricain, 2,3 sur 5 sur Trustpilot, faux profils | L'absence de preuve de vérification visible |
| Chat&Yamo (2.1) | Application d'origine, Afrique et diaspora, 4,2 sur 1,1 mille | Tout élément repris de sa présentation |

**Différenciation sourcée d'Ayelo** (sections 4 et 7 de `00-concurrents.md`) : confiance expliquée avec ses limites, bandeau anti-arnaque contextuel, prix honnête, recours de modération visible. La direction visuelle sert ces quatre preuves : B et C leur donnent un fond calme ou net où elles se lisent, A les noie davantage dans la chaleur de la marque.

## 9. Notation (1 mauvais, 5 excellent)

| Critère | A Terre cuite | B Lagune | C Encre et safran | Justification |
|---|---|---|---|---|
| Confiance | 3 | 5 | 4 | A : orange-brun chaleureux mais sans signal de sérieux propre, la confiance repose sur le contenu. B : sarcelle profonde, famille de couleurs associée au calme et au sérieux (hypothèse à valider), fond papier. C : encre sobre, ton posé, un peu austère. |
| Chaleur | 5 | 4 | 3 | A : tons de terre, ombres douces, angles arrondis. B : papier chaud et ocre compensent le froid de la sarcelle. C : contrasté et éditorial, le safran réchauffe en touches seulement. |
| Lisibilité (Android d’entrée de gamme, plein soleil) | 3 | 4 | 5 | Texte courant 15 à 18:1 partout. Écart sur le primaire en fond et en lien : A 5,53, B 6,62, C 16,60 (clair). Avec le voile de reflet du modèle, C garde la plus grande marge. Les trois évitent le texte clair sur fond clair. Pas de mesure sur appareil. |
| Poids (Ko) | 4 | 5 | 5 | Les trois : polices système, 0 Ko de police, couleurs en jetons. A : ombres douces (élévation) un peu plus coûteuses à dessiner sur GPU faible. B et C : aucune ombre, traits fins ou épais. C : le serif système varie d’un téléphone à l’autre (à tester). |
| Différenciation | 2 | 4 | 4 | Le dépôt (00-concurrents.md) ne documente aucune couleur de marque : la différenciation sourcée est celle de la confiance, des prix et de la vérification. Côté couleur, de mémoire et à vérifier : le terracotta et crème est une tendance très répandue, proche des teintes chaudes courantes en rencontres ; la sarcelle profonde et l’encre safran sont peu utilisées dans les 12 applications étudiées (à confirmer par captures). |
| Adéquation culturelle (Afrique francophone, diaspora) | 4 | 4 | 3 | Aucune ne s’appuie sur un motif dit africain ni sur un drapeau. A : couleur de terre universelle, sans lien à un pays. B : sarcelle et ocre, proches du vert et du jaune de plusieurs drapeaux, risque de lecture « drapeau » faible car la sarcelle n’est pas un vert franc et le rouge est absent de la marque. C : serif éditorial et noir et or, plus européen ; hypothèse à tester en entretien. |
| Accessibilité (marges, daltonisme, sombre) | 3 | 4 | 5 | Toutes les paires exigées passent. Marges minimales (texte sur surface, clair) : A 5,00, B 5,27, C 5,61. A : primaire et avertissement quasi identiques en protanopie (écart de couleur 1 sur 100 en clair). B : vérifié (indigo) et primaire (sarcelle) proches en tritanopie. C : le primaire change de teinte entre clair et sombre, la fonction reste identique. |
| **Total sur 35** | **24** | **30** | **29** | |

Les notes sont un jugement de conception, pas une mesure. Sensibilité : si la lisibilité compte double, B et C sont à égalité (34) devant A (27) ; si la chaleur compte double, B (34) passe devant A (29) et C (32). B reste première ou à égalité dans les deux cas.

## 10. Recommandation

**B Lagune**, pour trois raisons :
1. **La confiance est la promesse du produit** (principe 1) et le principal espace vacant face aux concurrents (`00-concurrents.md`, section 7) : B donne le fond le plus calme à la vérification, au bandeau d'alerte et au paywall honnête.
2. **Chaleur sans cliché** : papier chaud et ocre, sans terracotta crème ni motif.
3. **Plus léger** : aucune ombre, aucune police, contours fins.

Conditions pour que B tienne : contour de champ à 2 pt (le contour fin tombe à 2,99:1 avec le voile de reflet du modèle), graisse de titre résolue par plateforme, `verified` indigo et badge à forme propre, entretien sur la lecture « vert et jaune ». **C** est le meilleur choix si le propriétaire veut maximiser la lisibilité au soleil et assumer un ton éditorial ; **A** si la continuité prime sur la distinction.

## 11. Décisions

**Décidé** (par délégation, `01-decisions.md` n° 14, et sans engager la marque) :
- Phase 1 lancée avec trois directions ; aucune n'est définitive avant la recherche d'antériorité du nom ; le logo reste provisoire.
- Les jetons sémantiques de la section 4 sont la base de la phase 2, indépendamment du choix de teinte.
- Méthode de vérification (formule, seuils, simulation, modèle de soleil) : retenue comme standard de contrôle pour la suite.

**À décider par le propriétaire** (décisions réservées, section 7 du prompt maître) :

| # | Question | Options | Recommandation |
|---|---|---|---|
| 1 | Direction de marque | A, B, C, ou variante (par exemple B avec contours de C) | B |
| 2 | Police de marque | Système seule en V1 ; ou police de marque légère après mesure en phase 2 | Système en V1, ré-évaluer en phase 2 |
| 3 | Bouton Passer en couleur neutre | Oui ; ou rouge `dislike` | Oui (principe 2, daltonisme) |
| 4 | Jeton `verified` | Indigo distinct du primaire (B) ; ou garder le bleu actuel | Indigo, avec badge à forme propre |
| 5 | Test de préférence | 5 à 8 entretiens avec les trois aperçus, dont des personnes de la vague 2 | Oui avant de figer la direction |
| 6 | Logo et mot-symbole | Aucun avant la recherche d'antériorité (AILO, Aylo) ; brief de logo ensuite | Attendre ; la recherche d'antériorité est un préalable |
| 7 | Accent jaune-ocre ou safran | Garder en touches ; ou le supprimer si le test culturel révèle une lecture « drapeau » | Garder en touches, tester |

## 12. Hypothèses à valider

1. La sarcelle profonde évoque la confiance et le calme (B) : à tester en entretien.
2. Le noir et or, le serif éditorial (C) sont compris comme sérieux et non comme distants.
3. Le terracotta sur crème (A) est perçu comme trop courant : à vérifier avec l'alignement d'icônes de boutique.
4. Le voile de reflet `g = 0,15` est représentatif : mesurer sur appareil, dehors.
5. Le serif système rend correctement sur les téléphones d'entrée de gamme visés (C).
6. Les marchés de la vague 2 ne lisent pas le vert ou le jaune ocre comme un drapeau.

## 13. Risques

- **Nom** : toute direction dépend d'un nom non encore sécurisé. Le coût d'un changement de nom doit rester sur le logo seulement, d'où l'absence de logo ici.
- **Rendu natif** : couleurs, graisses et serif non vus sur appareil.
- **Fragmentation Android** : graisses 600 absentes de Roboto, polices constructeur variables.
- **Mode sombre au soleil** : le mode sombre est moins lisible en plein soleil (hypothèse courante, non mesurée ici) ; le mode clair doit rester le défaut en extérieur, sans forcer l'utilisateur.

## 14. Poids estimé

| Élément | Poids |
|---|---|
| Palette, jetons, rayons | 0 Ko (code) |
| Polices | 0 Ko (système) ; police de marque optionnelle : de l'ordre de quelques dizaines de Ko par graisse (hypothèse, à mesurer) |
| Icônes Lucide | À mesurer en phase 3 (arborescence élaguée, uniquement les icônes utilisées) |
| Illustrations (formes SVG) | Moins de 1 Ko chacune (hypothèse) |
| Aperçu HTML | 78 Ko, hors ligne, sans ressource externe (mesuré) |

## 15. Suite proposée

1. Le propriétaire répond aux décisions 1 à 7.
2. Phase 2 : `design/tokens.json` avec les jetons de la section 4 et les valeurs de la direction retenue (ou des valeurs provisoires de A tant que la réponse manque, échangeables par fichier), plus élévation, mouvement, focus, états.
3. Recherche d'antériorité du nom, puis brief de logo.
4. Mesure sur appareil : soleil, 200 % de police, serif Android.

## Sources et limites

- Dépôt : `PROMPT-UIUX-EXPERT.md`, `00-audit.md`, `00-a11y.md`, `00-concurrents.md`, `01-decisions.md`.
- Méthodes connues, non reconsultées pendant ce travail : WCAG 2.2 (formules de contraste, w3.org/TR/WCAG22) ; Machado, Oliveira, Fernandes, « A Physiologically-based Model for Simulation of Color Vision Deficiency » (2009) ; licences Lucide (ISC), Figtree et Source Serif 4 (SIL OFL) : à reconfirmer sur les dépôts officiels avant tout ajout.
- Aucune recherche web n'a été faite pour ce livrable ; aucune couleur de marque d'un concurrent n'est donc sourcée.
