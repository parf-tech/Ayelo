# Audit UI de l'application mobile (phase 0, lecture du code)

Date : 2026-11-08. Périmètre : `mobile/app` (routes, fichiers de 3 à 9 lignes qui réexportent un écran) et `mobile/src/{features,ui,navigation,theme,i18n}`. Référence : `docs/design/PROMPT-UIUX-EXPERT.md`, principes de la section 4 (notés P1 à P8 ci-dessous pour ne pas les confondre avec les priorités) et critères de la section 8.

## 0. Limites de cet audit (à lire d'abord)

- **Rien n'a été vu à l'écran.** Aucun émulateur, aucun appareil, aucune capture. Tout vient de la lecture du code, des jetons et de calculs. Les mesures de largeur, de hauteur et de retour à la ligne ci-dessous sont des **estimations par calcul** (étiquette : *estimé*). Un rendu réel peut les infirmer ; chacune est à confirmer sur un téléphone de 320 pt de large avec la police système à 200 %.
- Les contrastes sont **calculés** (formule WCAG 2.x sur les valeurs de `tokens.ts`), donc fiables pour les paires listées. Ils ne couvrent pas les superpositions sur photo (texte sur image), qui n'existent pas dans le code actuel.
- Les 393 tests Jest ne voient pas le rendu (rappel de la section 3 du prompt) et n'ont pas servi de preuve.
- Les étiquettes de priorité : **P0** = bloque la revue des magasins, l'accessibilité ou la confiance ; **P1** = à corriger avant la bêta publique ; **P2** = finition et dette. Les constats déjà connus dans `docs/reviews/design-1-suivi.md` sont marqués *(connu)*.
- Rien n'a été modifié hors de ce fichier. Les textes juridiques, le logo, la police et le jeu d'icônes sont des décisions du propriétaire (section 9).

## 1. Synthèse

| Mesure | Valeur |
|---|---|
| Routes d'écran sous `mobile/app` | 44 fichiers d'écran, 5 de mise en page |
| Composants partagés `mobile/src/ui` | 17 (+ `ScreenHeader`, `BackButton`, `LanguageToggle` dans `features/common`) |
| Styles en ligne (`style={{`) dans `features` | 223 ; `StyleSheet.create` seulement dans `ui/Button.tsx` et `ui/Toast.tsx` |
| Fichiers d'écran qui utilisent `AsyncView` | 20 ; les autres gèrent l'erreur par bannière locale |
| `fontWeight` écrits à la main hors de `Text` | plus de 30 occurrences (`'600'`, `'700'`) |
| Opacités « enfoncé » différentes | 3 valeurs (0,7 / 0,78 / 0,8) dans 6 composants |
| Glyphes Unicode utilisés comme icônes | 12 symboles distincts, 31 emplacements (section 5.1) |
| Variantes d'en-tête | 4 (section 5.2) |
| Constats | 7 P0, 17 P1, 15 P2 |

Verdict : le socle (tokens, 17 composants, `AsyncView`, étiquettes d'accessibilité, parité fr/en) est solide pour une base non vue. Les risques sérieux sont (1) un défaut d'accessibilité structurel dans `EmptyState`, (2) des mises en page à largeur ou hauteur fixes qui devraient casser à 320 pt et à 200 %, (3) trois endroits où l'interface promet plus que le produit ne tient (vérifié, appels, textes juridiques). Aucun motif sombre franc n'a été trouvé ; deux points de confiance sont à trancher (section 6).

## 2. Constats P0

| ID | Constat et preuve | Principe | Correctif concret |
|---|---|---|---|
| P0-1 | **`EmptyState` masque son bouton aux lecteurs d'écran.** Le conteneur est `accessible` avec un `accessibilityLabel` titre + description (`ui/EmptyState.tsx:21-24`) et contient le `Button` d'action (`:36-40`). Sur iOS et Android, un parent `accessible` regroupe ses enfants : le bouton n'est plus focalisable. C'est le défaut déjà corrigé dans `ListRow` (suivi design-1, P0-2), non reporté ici. Touche toutes les actions de vue vide : « Modifier les filtres » (`DiscoverScreen.tsx:175-179`), « Découvrir » (`MessagesListScreen.tsx:82-86`), « Mon profil » (`DiscoverScreen.tsx:163-168`). | P5 | Retirer `accessible` et `accessibilityLabel` du conteneur ; grouper seulement le bloc texte (un `View accessible` autour du titre et de la description) ; garder le bouton hors de ce groupe. Ajouter un test qui cherche le bouton par rôle. |
| P0-2 | **L'en-tête de conversation dépasse la largeur d'écran** (*estimé*). Une seule ligne porte : `Retour` (bouton fantôme, 24 pt de marge de chaque côté + libellé, soit environ 100 pt), l'avatar de 36 pt, le nom (`flex: 1`, une ligne), puis `☎`, `▶`, `⋯` (trois boutons d'environ 66 pt chacun), avec 5 écarts de 8 pt (`ConversationScreen.tsx:220-245`). Somme fixe : environ 374 pt. Largeur utile : 272 pt à 320 pt, 312 pt à 360 pt, 342 pt à 390 pt. Les `Pressable` ne rétrécissent pas par défaut : le nom tombe à zéro et le menu `⋯` (signaler, bloquer, rompre) risque d'être poussé hors écran, **y compris sur 390 pt**, quand les appels sont proposés. Sans appels (`canCall` faux) : environ 222 pt, le nom garde environ 50 pt. | P1, P5 | Remplacer par l'en-tête unifié (section 5.2) : retour en icône 44 × 44, avatar, nom sur 2 lignes avec `minWidth: 0`, appels regroupés dans le menu ou deux icônes 44 × 44 maximum. Vérifier à 320 pt et 200 %. |
| P0-3 | **Pieds d'écran non défilants trop hauts à 320 pt et 200 %** (*estimé*). `ScreenContainer` place `footer` hors du `ScrollView` (`ui/ScreenContainer.tsx:41-53`). À 200 % de police, chaque `Button` passe sur deux lignes (`Button.tsx:83`, `numberOfLines={2}`) soit environ 112 pt. Pieds concernés : connexion et inscription, trois lignes (`AuthFormScreen.tsx:120-150`) ; Premium, résumé + bouton + légende de renouvellement de 230 caractères en 14 pt + deux liens (`PremiumScreen.tsx:55-77`), environ 450 pt sur un écran utile de 570 pt ; consentements (`ConsentsScreen.tsx:41-50`) ; accueil, trois boutons (`WelcomeScreen.tsx:28-45`). Avec le clavier ouvert (champs de connexion), le formulaire n'a plus de place. Échec de WCAG 1.4.4 et 1.4.10 (reflux). | P5 | Dans `ScreenContainer`, mesurer le pied (`onLayout`) : s'il dépasse 40 % de la hauteur, le rendre dans le flux défilant. Sur Premium, garder dans le pied le résumé et le bouton ; passer la légende de renouvellement et les liens dans le contenu, juste au-dessus du pied. |
| P0-4 | **« Vérifié » promet plus que le produit.** `verify.subtitle` dit qu'un selfie « prouve que vous êtes bien la personne des photos » (`i18n/areas/verification.fr.ts:~5`). Le prompt (section 2) fixe la promesse : comparaison de photo, « pas une garantie d'identité ». Le badge « ✓ Vérifié » est affiché sans explication sur la carte (`SwipeCard.tsx:119-123`), le détail (`ProfileDetailScreen.tsx:207-211`) et le profil (`ProfileTabScreen.tsx:70-74`). | P1, P2 | Reformuler (« comparaison avec vos photos, ce n'est pas une garantie d'identité »). Ajouter une feuille « Ce que signifie Vérifié » ouverte par le badge. Tout texte de ce type passe par le juriste (décision D2). |
| P0-5 | **Les appels sont proposés alors que le média n'existe pas.** Boutons `☎` et `▶` actifs dès qu'un match est débloqué (`ConversationScreen.tsx:226-243`) ; l'écran d'appel affiche ensuite « L'audio et la vidéo ne sont pas disponibles dans cette version (prototype D0 requis). Seule la sonnerie est transmise » (`CallScreen.tsx:54-56` ; `i18n/areas/calls.fr.ts:14-15`). Jargon interne (« prototype D0 ») visible de l'utilisateur, et fonction annoncée mais vide. | P1, P2 | Masquer les boutons d'appel tant que `mediaAvailable` est faux (indicateur de fonction), ou les désactiver avec une phrase claire. Supprimer « prototype D0 » du texte. |
| P0-6 | **Textes juridiques : repli sans contenu en production si l'adresse manque.** Sans `EXPO_PUBLIC_TERMS_URL` ou `_PRIVACY_URL`, le lien ouvre `LegalFallbackScreen` (`useLegalOpener.ts`, `legal/LegalFallbackScreen.tsx:27-29`) qui n'affiche aucun texte. Les magasins exigent une politique de confidentialité accessible dans l'application et dans la fiche. Le contrôle `npm run check:env` existe pour `production` (suivi design-1, P0-1) ; il reste à le brancher sur le profil EAS réel. Aucune adresse n'est configurée dans le dépôt (`.env.example:25` pour l'e-mail est vide). | Magasins | Bloquer le profil `production` tant que `terms`, `privacy` et `supportEmail` sont vides. Dépend de la décision du juriste (D2). |
| P0-7 | **Cible de l'interrupteur et ligne non cliquable** *(connu)*. `SwitchRow` ne rend cliquable que le `Switch` natif (environ 51 × 31 pt sur iOS), pas la ligne (`ui/SwitchRow.tsx:19-51`). Sous la règle du dépôt (44 pt) c'est un défaut ; sous WCAG 2.2 AA (2.5.8, 24 pt) c'est acceptable. Classé P0 uniquement parce que la règle interne du projet est 44 pt et que 8 écrans de réglages en dépendent. | P5 | Envelopper la ligne dans un `Pressable` (rôle `switch`, état `checked`), `Switch` décoratif (`accessible={false}`), `minHeight` 56. |

## 3. Constats P1 et P2

### 3.1 P1 (avant la bêta publique)

| ID | Constat et preuve | Correctif |
|---|---|---|
| P1-1 | **Troncature des boutons à 200 %** : `numberOfLines={2}` dans `Button` (`ui/Button.tsx:83`) coupe les libellés français longs (« Envoyer pour vérification », « Restaurer mes achats ») sur 3 lignes réelles. | Retirer `numberOfLines`, laisser la hauteur croître (`minHeight` déjà posé). |
| P1-2 | **Colonne « mois » du sélecteur de date à hauteur de ligne fixe** : `ROW_HEIGHT = MIN_TARGET` (44) et `flex: 2` (`ui/DateSelector.tsx:20-21, 56, 135-141`). « Septembre » à 200 % (environ 144 pt) dépasse la colonne (environ 116 pt, *estimé*) et se coupe. Liste imbriquée dans un défilement, 31 + 12 + environ 100 radios pour VoiceOver *(connu)*. | Remplacer par trois champs numériques ou une feuille de choix native ; à défaut, `minHeight` au lieu de `height` et colonne mois à pleine largeur. |
| P1-3 | **Animation du geste en `useNativeDriver: false`** à trois endroits (`SwipeCard.tsx:39, 47, 51`) : le thread JavaScript pilote la carte, saccades probables sur Android d'entrée de gamme (objectif 60 images/s). Aucun repère visuel « J'aime / Passer » pendant le glissement ; aucun mode « sans mouvement » sur la carte (seul `Skeleton` le respecte, `ui/Skeleton.tsx:22`). | Phase 5 : `react-native-reanimated` + `gesture-handler` (décision D5). En attendant : `rotate` sur `transform` natif impossible avec `Animated.event` sur `dx` ; limiter à `translateX` natif. |
| P1-4 | **Données de profil dans les paramètres de route** : nom et URL de photo passés par `router.push` (`DiscoverScreen.tsx:79-85`, `ProfileDetailScreen.tsx:50-53, 75-78, 111-114`, `MessagesListScreen.tsx:60-68`, `CallScreen.tsx:94`, `MatchScreen.tsx:27`). La section 7 du prompt interdit les données de profil dans les URL. `navigation/deepLinks.ts` empêche l'entrée par lien externe, mais l'état de navigation et le web les conservent. | Passer l'identifiant seul ; relire le profil depuis le cache de `ConversationsProvider` ou une requête. |
| P1-5 | **Toast qui recouvre la barre d'onglets et disparaît en 4 s avec action** *(connu)* : `bottom: insets.bottom + 16` (`ui/Toast.tsx:57`), `DEFAULT_TOAST_DURATION_MS = 4000` (`:20`). Le toast « Voir » du match (`AppShell.tsx:32-39`) peut disparaître avant lecture (WCAG 2.2.1). | Positionner au-dessus de la barre (mesurer la hauteur de l'onglet), 6 s minimum si action, pause au toucher. |
| P1-6 | **Chiffres, pluriels et langues** : aucun gestionnaire de pluriel (`i18n/translate.ts:14-19`) ; « Suppression définitive dans {days} jours » (`settings.fr.ts:83`), « {count} messages non lus » (`messages.fr.ts:6`) donnent « 1 jours » et « 1 messages ». Motifs de sanction, de refus de vérification et pose du selfie sont des textes du serveur affichés tels quels (`SanctionsScreen.tsx:54`, `VerificationStatusScreen.tsx:46`, `VerificationScreen.tsx:93-97`), donc non traduits. | Ajouter une forme plurielle (`Intl.PluralRules`) dans `translate`. Demander des codes de motif au backend et traduire côté client. |
| P1-7 | **Aucun état « restreint » dédié.** Un compte suspendu reçoit un toast d'erreur de 8 s (`AppShell.tsx:40-48`) et le message `error.account_restricted` (« Ce compte n'est pas disponible. ») ; seul `DiscoverScreen` traite un 403 de profil incomplet (`:132`). Pas d'écran « Votre compte est limité, voici pourquoi et comment contester ». | Écran d'état de compte unique (motif, durée, contester) vers lequel `AsyncView` redirige sur `account_restricted`. |
| P1-8 | **Signalement : bouton d'envoi hors du pied et aucune suite** : après les motifs et le champ de détails, le bouton est en bas du défilement (`ReportScreen.tsx:83-95`) ; le message de réussite ne dit ni le délai de traitement ni propose de bloquer (`report.sent`). | Mettre « Envoyer le signalement » en pied ; après envoi, proposer « Bloquer cette personne » et indiquer le délai cible (24 h, hypothèse du prompt à valider). |
| P1-9 | **Confirmations sans conséquence dans la conversation** : « Bloquer » et « Rompre le match » demandent seulement « Confirmer » (`ConversationScreen.tsx:249-263`) ; l'écran de profil, lui, détaille la conséquence (`ProfileDetailScreen.tsx:158-166`). Le panneau s'ouvre en haut du défilement, la personne qui touche un bouton plus bas ne le voit pas (même schéma dans `SessionsScreen.tsx:60-69` et `ConsentSettingsScreen.tsx:57-63`). | Composant `ConfirmPanel` ou feuille modale : titre, conséquence, bouton destructeur nommé (« Bloquer Aminata »), annuler. Focalisation automatique. |
| P1-10 | **Menu en ligne au lieu d'une feuille** : `⋯` ouvre un cadre dans le flux qui pousse le contenu (`ProfileDetailScreen.tsx:152-175`, `ConversationScreen.tsx:247-278`), `accessibilityViewIsModal` posé sur une vue non modale (`ProfileDetailScreen.tsx:155`). Signaler et Bloquer en bouton fantôme, sans distinction de gravité. | Composant `ActionSheet` (composant manquant, section 3 du prompt). |
| P1-11 | **« Écrire » caché dans un menu** : sur le détail du profil, l'action la plus utile (écrire) est dans `⋯` (`ProfileDetailScreen.tsx:169`), alors que trois boutons secondaires de même poids (refuser, coup de cœur, J'aime) occupent le bas de page (`:225-229`), hors pied fixe. Aucune action primaire (principe 3). | Pied fixe : J'aime en primaire, passer en secondaire, `⋯` en icône. « Écrire » visible si le match existe. |
| P1-12 | **Bouton « Annuler mon dernier choix » visible pour tous, puis paywall** (`DiscoverScreen.tsx:222`, `:114` : le 402 ouvre la bannière Premium après le toucher). Piège de confiance léger : la fonction paraît gratuite. | Afficher le cadenas ou « Premium » sur le bouton avant le toucher si le statut est connu. |
| P1-13 | **Badge « Vérifié » en couleur primaire**, la même que l'intention, les liens et la sélection (`SwipeCard.tsx:120`, `ProfileDetailScreen.tsx:208`, `ProfileTabScreen.tsx:71`), alors que le jeton `verified` (bleu) existe et n'est utilisé que par la bannière d'information (`Banner.tsx:34`). Le badge et l'intention se confondent. | Composant `Badge` (manquant) avec jeton `verified` et icône de coche. |
| P1-14 | **Pays : 34 puces × 2 sur un seul écran** (`PreferenceFields.tsx:113-124, 175-183`) = 68 cibles de 44 pt, sans recherche, avec réutilisation sur les filtres. À 320 pt, plus de 25 rangées de puces. Dans l'édition de profil, deux `CountryPicker` listent 8 cartes chacun plus une recherche (`ProfileEditScreen.tsx:140-147`). | Sélecteur de pays en feuille avec recherche, puces seulement pour les pays choisis (composant `Select/CountryPicker` manquant). |
| P1-15 | **Pas de « préfère ne pas dire » pour le genre** (`BasicProfileScreen.tsx:69-77`) et orientation déductible de `seeking_genders` (`PreferenceFields.tsx:68-84`) ; consentement « données sensibles » obligatoire pour s'inscrire (`ConsentsScreen.tsx:78-85`). Question de conformité (consentement libre, article 9 RGPD) et de risque légal par pays. Non tranché ici. | Décision D3 (propriétaire + juriste). |
| P1-16 | **Visuel de marque absent** : l'accueil n'affiche que le nom en texte (`WelcomeScreen.tsx:58-71`), pas de logo ; `assets/splash-icon.png` est le visuel d'exemple d'Expo *(connu)* ; les couleurs d'icône et de notification sont recopiées en dur dans `app.json` (`#C2410C`, `#FFFFFF`, `#121110`), hors du fichier de jetons. | Phase 1 et 2 ; générer `app.json` depuis `tokens.json`. |
| P1-17 | **Chat sans repères** : pas d'horodatage ni de séparateur de date dans les bulles (`ConversationScreen.tsx:121-141`), état d'envoi noté par le même glyphe `✓✓` pour « remis » et « lu » (`:15`) ; seul le texte les distingue. Champ de saisie de 44 pt contre 48 pt pour le bouton voisin (`:203` / `Button.tsx:54`). | Composant `MessageBubble`, séparateurs de jour, icônes d'état distinctes. |

### 3.2 P2 (finition et dette)

| ID | Constat et preuve | Correctif |
|---|---|---|
| P2-1 | **Images sans taille ni cache** : 6 `Image` de React Native, aucune `expo-image`, aucun `resizeMode`, aucune miniature : `SwipeCard.tsx:106`, `ProfileDetailScreen.tsx:190`, `PhotosManager.tsx:168, 220`, `VerificationScreen.tsx:120`, `ui/Avatar.tsx:18`. Une photo de profil complète est téléchargée pour un avatar de 48 pt (`MessagesListScreen.tsx:112`). Le type `ProfileMedia` n'expose qu'une `url`. | Demander des variantes de taille au backend (hors périmètre), `expo-image` pour le cache disque (décision D5). |
| P2-2 | `MessagesListScreen` : `FlatList` avec `keyExtractor` mais sans `getItemLayout` (lignes de hauteur variable : acceptable), `renderItem` et `onRefresh` en ligne (`:96-101`), compteur de non-lus en dur (`:122` : 24, 6). `ConversationScreen` : `renderMessage` recréé à chaque rendu, sans `memo` (`:81`), pas d'`extraData` explicite. | `memo` sur les lignes, `useCallback`. |
| P2-3 | **Chargement générique** : `AsyncView` affiche toujours 4 cartes de 64 pt (`ui/AsyncView.tsx:52-54`), même pour une pile de cartes ou un profil ; `Skeleton` de découverte à 400 pt fixe (`DiscoverScreen.tsx:188`). Chaque `Skeleton` annonce « barre de progression » (`ui/Skeleton.tsx:59`). | Squelettes par forme (carte, ligne, profil) ; `accessible={false}` sur les enfants. |
| P2-4 | **Bouton principal grisé sans explication** : « Continuer » de la date de naissance (`BirthdateScreen.tsx:86`), « Envoyer pour vérification » (`VerificationScreen.tsx:72`), « Enregistrer » (`ProfileEditScreen.tsx:105`). Le signalement, lui, explique (`ReportScreen.tsx:91-95`). | Phrase d'aide sous le bouton ou `accessibilityHint`. |
| P2-5 | **Libellés des champs lus deux fois** : `TextField` pose une étiquette visible et la même chaîne dans `accessibilityLabel` du `TextInput` (`ui/TextField.tsx:50, 67`) ; le texte visible reste un arrêt de focus séparé. | `accessible={false}` sur l'étiquette visible ou `accessibilityLabelledBy`. |
| P2-6 | **`ConsentSettingsScreen` : deux lignes mortes** « Conditions » et « Confidentialité » sans lien (`:76-77`). | Brancher `useLegalOpener`. |
| P2-7 | **Messages de pied de formulaire en plusieurs variantes** : l'erreur de champ vit tantôt dans `TextField`, tantôt en `Text` libre (`BasicProfileScreen.tsx:78-82`, `IntentScreen.tsx:104-108`, `PhotosScreen.tsx:41-45`, `VerificationScreen.tsx:112-116`). | Composant `FieldError` commun. |
| P2-8 | **Photos : trois boutons-glyphes par vignette** (`‹ › ✕`, `PhotosManager.tsx:187-209`), ~64 pt chacun, passent à la ligne dans une vignette de ~130 pt à 320 pt (*estimé*). Réordonnancement au bouton : accessible mais lourd. | Menu `⋯` par vignette, ou glisser-déposer (phase 5). |
| P2-9 | **`CallScreen`** : « Refuser » est un bouton `danger` (rouge) comme « Raccrocher » (`:77, 97`) ; le refus est une action neutre. | Variante secondaire pour refuser. |
| P2-10 | **`ListRow` : chevron `›` et valeur en légende** sans taille d'icône (`ui/ListRow.tsx:60-64`) ; ligne statique `accessible` sans rôle (`:73-77`). | Icône chevron SVG ; rôle `text`. |
| P2-11 | **Page de démonstration** hors développement seulement (`WelcomeScreen.tsx:37`), mais couvre 7 des 17 composants et aucun état (ni `Chip`, `SwitchRow`, `ProgressBar`, `DateSelector`, `CheckboxField`). | Étendre à l'étape 3 du prompt. |
| P2-12 | **Étiquette `Retour` en texte** partout (`ScreenHeader.tsx:21-26`, `BackButton.tsx:13-18`), sans chevron ; occupe 100 pt de largeur. | Icône 44 × 44 + libellé d'accessibilité. |
| P2-13 | **Pas de logo ni d'illustration dans les états vides** (`EmptyState.tsx:10-11` prévoit un emplacement, jamais rempli) *(connu)*. | Phase 3. |
| P2-14 | **Variantes de largeur** : `maxWidth: '80%'` des bulles (`ConversationScreen.tsx:129`), `'48%'` des vignettes (`PhotosManager.tsx:131`), `width: '100%'` partout : sans jeton de mise en page. | Jetons de largeur de contenu (`tokens.json`). |
| P2-15 | **Deux textes juridiques en `__DEV__`** (`LegalScreen.tsx:32, 39`) : bon, mais l'écran de repli n'a pas de variante production sans adresse (voir P0-6). | Voir P0-6. |

## 4. Audit écran par écran

Légende des colonnes : **Action** = action principale et hiérarchie (a) ; **États** = chargement, vide, erreur, hors ligne, restreint (b) ; **Valeurs en dur** = couleurs, espacements, tailles, graisses, opacités, durées en dehors de `tokens.ts` (c) ; **Cibles et 320 pt** = cibles de moins de 44 pt et risques de retour à la ligne à 320 pt et 200 % (d, f) ; **Autres** = composants à partager (e), textes (g), animation et performance (h), confiance (i). « OK » veut dire : rien relevé à la lecture. `AsyncView` gère l'erreur réseau comme « hors ligne » (`ui/AsyncView.tsx:60-66`) ; aucun écran n'a de signal hors ligne global.

### 4.1 Accueil, connexion, inscription

| Écran (fichier) | Action | États | Valeurs en dur | Cibles et 320 pt | Autres |
|---|---|---|---|---|---|
| S01 Accueil (`WelcomeScreen.tsx`) | Deux boutons : créer (primaire), se connecter (secondaire). Hiérarchie claire. Pas de logo (`:58-71`). | Sans objet. Bandeau de suppression avec fermeture (`:48-57`). | OK (tokens). | Pied de 2 à 3 boutons non défilant (`:28-45`) : voir P0-3. `LanguageToggle` aligné à droite (`:47`). | Le nom `app.name` est affiché deux fois : une fois en titre de marque, une fois avec `welcome.title` en 28 pt (`:59-64`) : deux titres de même corps. Mention anti-arnaque en légende de 13 pt, sous le fold probable (`:68-70`) : à promouvoir (P1). |
| S02 Connexion et inscription (`AuthFormScreen.tsx`) | Soumettre = primaire ; « Mot de passe oublié » et « Créer un compte » = fantômes dans le pied (`:120-148`). OK. | Pas d'`AsyncView` : erreurs en bannière (`:160-169`), chargement sur le bouton. Hors ligne = message `error.network` via `apiErrorMessage` (`:103`). | OK. `flexWrap` + texte caption + bouton fantôme sur une même ligne (`:137`). | Pied de 3 lignes : P0-3. Clavier + pied à 200 %. | Pas de connexion sociale visible alors que `SocialReauth` existe pour la suppression : écart de parcours à confirmer. |
| S61 Mot de passe oublié (`ForgotPasswordScreen.tsx`) | OK, un bouton. Même réponse que le compte existe ou non. | Erreur en bannière. | OK. | OK. | `BackButton` + titre : en-tête variante A. |
| Réinitialisation (`ResetPasswordScreen.tsx`) | OK. | Idem. | OK. | Pas de bouton retour (`:64`), pas d'accès au changement de langue. | Champ « code » à coller visible même quand le jeton arrive du lien (`:76-85`) : bruit. |
| Date de naissance S68 (`BirthdateScreen.tsx`) | « Continuer » désactivé tant que la date est incomplète (`:82-88`), sans explication (P2-4). | Erreur sur `DateSelector` et bannière avec « Réessayer » (`:102-111`). | `initialScrollYear` calculé (`:123`, 25 ans) : valeur de produit, pas de style. | Colonnes de hauteur fixe : P1-2. | Âge minimum affiché (`birthdate.minAge`) : bien. Refus d'âge neutre vers S64 (`:60-65`). |
| S63 Consentements (`ConsentsScreen.tsx`) | « Continuer » désactivé, avec phrase `consents.missing` dans le pied (`:43-47`) : bon. | Sans objet. | OK. | 4 cases de 56 pt + 2 liens fantômes entre les cases (`:68, 77`) : OK ; pied avec légende. | Le consentement « données sensibles » est obligatoire : P1-15. |
| S64 Refus d'âge (`AgeRefusedScreen.tsx`) | Un seul bouton « Fermer ». Neutre. | Sans objet. | OK. | OK. | Aucune ouverture d'aide ni de contact : choix de neutralité à confirmer (D4). Retour Android bloqué vers l'accueil (`:20-26`) : bon. |
| S03 E-mail à vérifier (`VerifyEmailScreen.tsx`) | « J'ai confirmé » primaire, « Renvoyer » secondaire avec compte à rebours 60 s (`:104-113`), « Plus tard » fantôme en pied. | Bannière de statut. | `RESEND_COOLDOWN_SECONDS = 60` exporté (`:9`) : bien. | OK. | Non bloquant : bon pour la confiance. |
| Lien d'e-mail (`VerifyEmailLinkScreen.tsx`) | OK. | `idle`, `working`, `done`, `error` gérés à la main (`:21`). | OK. | OK. | `Skeleton` seul pendant 3 s : OK. |

### 4.2 Onboarding

| Écran | Action | États | Valeurs en dur | Cibles et 320 pt | Autres |
|---|---|---|---|---|---|
| S04 Profil (`BasicProfileScreen.tsx`) | « Continuer » en pied. Barre de progression sur 4 étapes (`:44`). | Validation locale. Aucun état réseau. | OK. | 3 cartes de genre + 2 sélecteurs de pays de 8 cartes + 2 champs : page très longue (P1-14). Pas de bouton retour (première étape). | Pays de résidence : aucune explication du verrouillage serveur (`ProfileEditScreen.tsx:90`). `textContentType="givenName"` pour un champ de nom d'affichage (`:62`). |
| S05 Intention (`IntentScreen.tsx`) | « Continuer » ; 5 cartes avec descriptions. | Bannière d'erreur, chargement sur bouton. | OK. | Barre de progression **au-dessus** du bouton retour (`:71-72`) : ordre différent de S04. | Descriptions bien dosées. « Mariage » en premier : ordre produit, à valider. |
| S06 Photos (`PhotosScreen.tsx`, `PhotosManager.tsx`) | « Continuer » exige une photo. | `AsyncView` (`PhotosManager.tsx:151-159`) ; envoi : « en cours », « échec » avec réessayer. | Opacité 0,6 de l'aperçu (`:220`) ; `tileWidth '48%'` (`:131`) ; poids `'600'` (`:176, 221`). | Boutons-glyphes `‹ › ✕` (P2-8). Aucun appareil photo (bibliothèque seulement, `pickImage('library')`). | `Image` sans taille (P2-1). Message d'examen `photos.reviewNote` en légende. |
| S07 Préférences (`PreferencesScreen.tsx`, `PreferenceFields.tsx`) | « Terminer » (onboarding) ou « Enregistrer ». | `AsyncView` (`:61`). | Poids `'600'` ×4 (`PreferenceFields.tsx:70, 88, 127, 168`) ; `−` `+` en glyphes (`:45-46`). | `Stepper` : 2 boutons de 62 pt, OK. | Âge min/max au pas de 1 (81 appuis pour parcourir) : une plage à curseur (`RangeSlider`, manquant) est plus adaptée. |

### 4.3 Découverte, match

| Écran | Action | États | Valeurs en dur | Cibles et 320 pt | Autres |
|---|---|---|---|---|---|
| S10 Découvrir (`DiscoverScreen.tsx`) | Trois boutons de même poids (secondaires) : refuser, coup de cœur, J'aime (`:193-219`). Pas de primaire ; « Signaler » toujours visible (`:223-230`) : bon pour la confiance. | `AsyncView` : chargement, erreur, vide avec « Modifier les filtres » (`:170-180`) ; 403 profil incomplet (`:162-168`) ; quota et Premium en bannière (`:149-160`). Pas de signal hors ligne propre. | `minWidth: 56` ×3 (`:200, 209, 218`) ; hauteur de squelette 400 (`:188`) ; `•` ajouté dans le libellé des filtres actifs (`:143`) : indicateur par un glyphe dans une chaîne. Couleur de bordure `dislike`/`like` posée en ligne (`:200, 218`) mais libellé en primaire : incohérence. | Hauteur : titre 48 + bouton + trois boutons 48 + deux fantômes 48 + barre d'onglets 56 + zones sûres. Sur un écran de 568 pt, la carte garde ~300 pt à 100 %, moins à 200 % (*estimé*). `Filtres` + titre sur la même ligne (`:136-147`) : à 200 % le titre passe sur 2 lignes. | Animation : P1-3. Aucun repère « J'aime / Passer ». `Animated.ValueXY` recréé à chaque nouvelle clé. Annuler : P1-12. |
| Carte (`SwipeCard.tsx`) | Toucher = ouvrir le profil ; glisser = décider. | Photo absente : texte « Pas de photo » (`:108-112`). | Seuils 6 (`:38, 41`), 700 (`:50`), 180 ms (`:51`), ±200 / `8deg` (`:60`), `scale 0.96` (`:102`) ; poids `'700'` (`:120`). | Nom sur une ligne avec `numberOfLines={1}` + badge « ✓ Vérifié » (`:116-123`) : à 200 % le nom se réduit à quelques lettres (*estimé*). Pays d'**origine** absent de la carte (seule la résidence, `:126`), alors que la découverte se fait par origine. | Actions d'accessibilité complètes (`:74-90`) : bon. Verrou « interactive » pour la carte du dessous. |
| S09 Filtres (`FiltersScreen.tsx`) | « Appliquer » primaire, « Réinitialiser » fantôme. | `AsyncView`. | OK. | Même page longue de puces que S07 (P1-14). | Réinitialiser ferme l'écran sans confirmation : OK. |
| S11 Détail (`ProfileDetailScreen.tsx`) | Aucune action primaire (P1-11). | `AsyncView` (`:176`), photo absente (`:202-206`), notice d'erreur (`:142-151`). | `aspectRatio 3/4` ×2, `galleryWidth` calculé par `useWindowDimensions` (`:29`) : bon ; poids `'600'`/`'700'` (`:208, 216`). | `⋯` OK (48 pt). Galerie horizontale : indicateur « 1 sur 3 » en texte (`:198-201`) ; pas d'indicateur de page visuel. | Menu en ligne (P1-10). Rôle `header` du titre : le nom devient h1. |
| S12 Match (`MatchScreen.tsx`) | « Écrire » primaire, « Continuer » secondaire. | Sans objet. | Avatar 140 (`:40`). | OK. | Célébration sans mouvement ni retour haptique (phase 5) ; aucune annonce `accessibilityLiveRegion` à l'arrivée *(connu)*. |

### 4.4 Messages et appels

| Écran | Action | États | Valeurs en dur | Cibles et 320 pt | Autres |
|---|---|---|---|---|---|
| S13 Messages (`MessagesListScreen.tsx`) | Ouvrir une conversation. | `AsyncView` + pagination + tirer pour actualiser (`:77-100`). Le vide propose « Découvrir ». | Pastille 24 × 24, marge 6 (`:122`). | OK ; l'heure et la pastille dans `trailing` réduisent le libellé à ~120 pt à 320 pt (*estimé*). | Aperçu du dernier message affiché : bon dans l'application ; vérifier qu'il n'est pas repris dans les notifications. |
| S14 Conversation (`ConversationScreen.tsx`) | Envoyer (primaire) à côté du champ. | `AsyncView` pour l'historique ; "closed" ; hors ligne : texte `conversation.realtime.off` (`:293-297`) ; envoi : sending, failed avec réessayer/supprimer. | `maxHeight: 120`, `fontSize: 16` (`:204, 208`), `maxWidth '80%'` (`:129`), avatar 36 (`:222`). | **En-tête : P0-2.** Champ `minHeight` 44 vs bouton 48. | Bulle `Pressable` pour tous les messages même sans action (`:122`) : bruit de focus. Avis anti-arnaque conditionné au serveur (`thread.safetyHint`, `:280-291`) : pas de rappel statique à la première conversation. |
| S15 à S18 Appel (`CallScreen.tsx`) | Entrant : accepter (primaire) + refuser (danger). Sortant : annuler. | Phases `outgoing`, `incoming`, `active`, `ended`. | Avatar 120 (`:112`). | OK. | P0-5 (média) ; P2-9. Le chronomètre n'est pas une région vivante : bien (`:121`). |

### 4.5 Premium

| Écran | Action | États | Valeurs en dur | Cibles et 320 pt | Autres |
|---|---|---|---|---|---|
| S30 Offres (`PremiumScreen.tsx`) | « S'abonner, {prix} » primaire, restaurer et crédits en secondaire/fantôme. Prix, durée et renouvellement dans le pied (`:55-77`) : bon. | `AsyncView` (`:90`) ; achat indisponible (`:84-86`) ; abonné de boutique (`:111`). | `bodySmall` 14 pt pour la légende : bon. | **Pied trop haut : P0-3.** | Plan le plus long présélectionné avec « Meilleur prix » (`:40-41`) : décision déjà prise (suivi design-1) ; à garder sous revue (D6). Aucun essai gratuit évoqué ; le prix total de l'offre de 12 mois est dans la description de la carte, bien. |
| S31 Crédits (`CreditsScreen.tsx`) | « Acheter » par ligne (bouton dans `trailing`). | `AsyncView`. | OK. | Bouton ~110 pt à droite du libellé ; OK. | Aucune mention légale à côté du prix (consommable : pas de renouvellement) : correct. |
| S32 Résultat (`PurchaseResultScreen.tsx`) | « Terminé » ou « Vérifier / Support ». | Validation, confirmé, délai dépassé ; attend le serveur (`:29-30`) : excellent pour l'honnêteté. | `POLL_INTERVAL_MS = 3000`, `MAX_ATTEMPTS = 10` exportés : bien. | OK. | `Skeleton` pendant 30 s au plus. |

### 4.6 Profil, vérification, sécurité

| Écran | Action | États | Valeurs en dur | Cibles et 320 pt | Autres |
|---|---|---|---|---|---|
| S59 Mon profil (`ProfileTabScreen.tsx`) | « Modifier » primaire + 3 secondaires (`:92-95`). OK. | `AsyncView` (`:46`). | Avatar 120 (`:63`). | OK. | Badge Premium en `success` (`:76`) : couleur de succès pour un statut ; badge « Vérifié » en primaire (P1-13). |
| S60 Édition (`ProfileEditScreen.tsx`) | « Enregistrer » en pied. | `AsyncView` (`:109`). | OK. | Page très longue (P1-14), `PhotosManager` imbriqué (`:152`). | Pas de compteur de caractères pour la bio de 500 (`:122`). Rien n'indique le verrou du pays de résidence avant l'enregistrement. |
| S40 Vérification (`VerificationScreen.tsx`) | « Envoyer pour vérification » en pied, grisé sans selfie. | `AsyncView` (`:81`). | OK. | Aperçu `aspectRatio 3/4` pleine largeur (`:124`). | P0-4 ; la pose est un texte du serveur non traduit (P1-6). Consentement biométrique distinct : bon. |
| S41 État (`VerificationStatusScreen.tsx`) | Réessayer ou actualiser. | `AsyncView`, interrogation toutes les 30 s (`:24`). | `30000` en dur. | OK. | Motif de refus du serveur (P1-6). |
| S58 Signalement (`ReportScreen.tsx`) | « Envoyer » en bas du défilement. | Erreur en bannière. | OK. | Page : 6 cartes + champ + bouton. | P1-8. Le contexte `message` et `story` est prévu (`:12`) mais aucun écran ne l'utilise. |

### 4.7 Réglages

| Écran | Action | États | Valeurs en dur | Cibles et 320 pt | Autres |
|---|---|---|---|---|---|
| S50 Réglages (`SettingsScreen.tsx`) | Liste de 13 lignes en 3 sections ; « Supprimer le compte » en rouge dans la liste (`:72`), **sans séparation** des actions courantes. « Se déconnecter » en secondaire. | Statut de facturation en tâche de fond (`:31`). | `Constants.expoConfig?.version ?? '0.0.0'` (`:76`). | `LanguageToggle` dans une ligne `space-between` (`:56-61`) : bouton fantôme étroit. | Ligne de langue non alignée avec les autres lignes (`ListRow`). |
| S51 Confidentialité (`PrivacyScreen.tsx`), S52 Notifications (`NotificationsScreen.tsx`), Consentements (`ConsentSettingsScreen.tsx`) | Bascules. | `AsyncView`. Bascule optimiste avec retour arrière (`PrivacyScreen.tsx:25-35`). | OK. | `SwitchRow` : P0-7. | P2-6. Révocation du consentement sensible bien confirmée (`ConsentSettingsScreen.tsx:57-63`), avec panneau en haut de page (P1-9). |
| S53 Sessions (`SessionsScreen.tsx`) | Fermer une session (fantôme dans la ligne). | `AsyncView`. | OK. | Bouton « Fermer la session » ~170 pt dans la ligne : le libellé de session reste ~90 pt à 320 pt (*estimé*). | Confirmation en haut de page (P1-9). |
| S54 Bloqués (`BlockedScreen.tsx`) | Débloquer (secondaire). | `AsyncView`. | OK. | Avatar d'initiale seulement. | OK. |
| S55 Suppression (`DeleteAccountScreen.tsx`) | « Supprimer mon compte » en pied (danger). Conséquence dite en bannière : 30 jours, masqué dès maintenant (`settings.fr.ts:81-82`). | Étape de confirmation avec délai de grâce (`:70-88`). | OK. | OK. | Conforme à l'exigence des magasins (suppression dans l'application). L'annulation par reconnexion n'est pas promise (suivi design-1, P1-2). |
| S67 Export (`ExportScreen.tsx`) | « Demander mon export ». | États `pending`, `ready`, `expired`, `failed` (`:119-144`), interrogation toutes les 5 s. | `EXPO_POLL_MS` exporté. | OK. | Le mot de passe est redemandé : bien. |
| S56 Support (`SupportScreen.tsx`) | « Envoyer ». | `AsyncView` pour la liste (`:67-83`). | Bornes 3/120/5/4000 en dur (`:29-30`). | OK. | Le courriel du support est conditionnel (P0-6). |
| S57 Mentions légales (`LegalScreen.tsx`), repli (`LegalFallbackScreen.tsx`) | Ouvrir un texte. | Erreur d'ouverture en bannière (`:26`). | OK. | OK. | P0-6. |
| S65 Sanctions (`SanctionsScreen.tsx`), S66 Contestation (`AppealScreen.tsx`) | « Contester » (secondaire) ; « Envoyer » en pied. | `AsyncView`. | Carte `padding space[4]`, `borderWidth 1` (`:51`) : dupliquée ailleurs (section 5.5). | OK. | Motif non traduit (P1-6). |

## 5. Inventaires

### 5.1 Glyphes Unicode utilisés comme icônes

| Glyphe | Rôle | Emplacements |
|---|---|---|
| `♥` | Onglet Découvrir ; bouton J'aime | `navigation/MainTabs.tsx:38` ; `DiscoverScreen.tsx:214` ; `ProfileDetailScreen.tsx:228` |
| `✉` | Onglet Messages | `MainTabs.tsx:48` |
| `☺` | Onglet Profil | `MainTabs.tsx:56` |
| `★` | Coup de cœur | `DiscoverScreen.tsx:205` ; `ProfileDetailScreen.tsx:227` |
| `✕` | Refuser ; fermer une bannière ; supprimer une photo | `DiscoverScreen.tsx:196` ; `ProfileDetailScreen.tsx:226` ; `ui/Banner.tsx:111` ; `PhotosManager.tsx:206` ; glyphe d'erreur `ui/Banner.tsx:22` |
| `✓` | Coche (case, puce, bannière de succès, badge Vérifié, envoyé) | `ui/CheckboxField.tsx:72` ; `ui/Chip.tsx:39` ; `ui/Banner.tsx:22` ; `SwipeCard.tsx:121` ; `ProfileDetailScreen.tsx:209` ; `ProfileTabScreen.tsx:72` ; `ConversationScreen.tsx:15` |
| `✓✓` | Remis, lu (même glyphe) | `ConversationScreen.tsx:15` |
| `…` `!` `i` | Envoi en cours, échec, information | `ConversationScreen.tsx:15` ; `ui/Banner.tsx:22` |
| `☎` | Appel audio | `ConversationScreen.tsx:231` |
| `▶` | Appel vidéo (symbole de lecture : sens ambigu) | `ConversationScreen.tsx:238` |
| `⋯` | Menu | `ProfileDetailScreen.tsx:132` ; `ConversationScreen.tsx:244` |
| `‹` `›` | Déplacer une photo ; chevron de ligne | `PhotosManager.tsx:190, 198` ; `ui/ListRow.tsx:62` |
| `−` `+` | Pas d'âge | `PreferenceFields.tsx:45-46` |
| `•` | Filtres actifs, dans la chaîne | `DiscoverScreen.tsx:143` |

Risques : rendu variable selon la police du fabricant (le prompt le note déjà) ; `☺` et `☎` peuvent s'afficher en emoji coloré sur certains Android, ce qui ignore la couleur de l'onglet ; `▶` sera lu comme « lecture » sans étiquette (l'étiquette d'accessibilité existe, `ConversationScreen.tsx:237`) ; aucun glyphe n'est dimensionné par un jeton (20 pt en dur dans `MainTabs.tsx:10`). Plusieurs sont portés par un `Button` de 48 pt de haut, donc l'icône est lisible seulement par le texte du glyphe.

### 5.2 En-têtes d'écran

| Variante | Où | Particularités |
|---|---|---|
| A. `BackButton` + titre `title` | Connexion, inscription, date, consentements, mot de passe oublié, intention, photos, préférences (mode inscription), page de démonstration (8 écrans, `features/common/BackButton.tsx`) | Marge haute du titre différente d'un écran à l'autre : `space[2]` (`AuthFormScreen.tsx:153`), aucune (`IntentScreen.tsx:73`), `space[5]` (`ResetPasswordScreen.tsx:64`) ; la barre de progression est avant le retour (`IntentScreen.tsx:71-72`) mais seule sur S04 (`BasicProfileScreen.tsx:44`). |
| B. `ScreenHeader` | 22 écrans : réglages, premium, filtres, profil, vérification, signalement, détail (`features/common/ScreenHeader.tsx`) | Retour fantôme à gauche, `right` facultatif, titre `title` de 28 pt dessous ; valeur de repli par défaut `/discover` (`:11`) ; deux composants quasi identiques (`BackButton` et le bouton de `ScreenHeader`) avec le même `testID` `back-button`. |
| C. En-tête propre à la conversation | `ConversationScreen.tsx:220-245` | Retour + avatar + nom en `h2` + trois actions ; seul en-tête avec `h2`. Défaut P0-2. |
| D. Titre seul d'onglet | Découvrir (avec bouton Filtres, `DiscoverScreen.tsx:136-147`), Messages (`MessagesListScreen.tsx:74`), Mon profil (`ProfileTabScreen.tsx:43`) | Pas de retour (racine). Pas d'en-tête sur appel, match, refus d'âge, accueil. |

L'en-tête natif de la pile est coupé (`AreaLayout.tsx:34`, `headerShown: false`), donc il n'y a pas de titre de page pour les lecteurs d'écran en dehors du `Text header` de chaque écran, et le geste « retour » iOS n'affiche pas de titre précédent.

### 5.3 Opacités « enfoncé » et états

| Composant | Valeur | Ligne |
|---|---|---|
| `Button` | 0,78 | `ui/Button.tsx:64` |
| `CheckboxField` | 0,8 | `ui/CheckboxField.tsx:49` |
| `Chip` | 0,8 (non protégé par `disabled`) | `ui/Chip.tsx:33` |
| `ChoiceCard` | 0,8 | `ui/ChoiceCard.tsx:37` |
| `DateSelector` | 0,7 | `ui/DateSelector.tsx:140` |
| `ListRow` | 0,7 | `ui/ListRow.tsx:90` |
| Autres opacités | `Skeleton` 0,45 (`:41`), aperçu d'envoi 0,6 (`PhotosManager.tsx:220`) | |
| Aucun état enfoncé | `SwitchRow`, `SwipeCard`, `Banner` (boutons), bulles de message, `TextField` (bouton afficher/masquer) | |
| Aucun état focus (clavier, lecteur d'écran à commutateur) | tous les composants ; seul `TextField` change de bordure (`ui/TextField.tsx:46, 59`) | |

### 5.4 Valeurs en dur (hors `tokens.ts`)

| Catégorie | Occurrences (extraits) |
|---|---|
| Couleurs | `app.json` : `#C2410C` (icône adaptative, notification), `#FFFFFF`, `#121110` (écran de démarrage). Aucune dans `src` (le test les interdit). |
| Tailles de police | `fontSize: 16` : `ui/TextField.tsx:90`, `ConversationScreen.tsx:208` ; `20` : `MainTabs.tsx:10` ; `12` : `MainTabs.tsx:30` (sous le plancher de 13 pt de `caption`). |
| Graisses | `'600'` / `'700'` écrits à la main dans 22 fichiers (`grep fontWeight`) alors que `Text` ne propose que `title`, `h2`, `body`, `bodySmall`, `caption` : il manque des variantes `label` et `emphasis`. |
| Espacements et dimensions | `Button`: `MIN_TARGET + 4`, `hitSlop 4`, `borderWidth 1.5` (`:49, 54, 61`) ; `+ 12` pour 56 pt dans `CheckboxField.tsx:41`, `ChoiceCard.tsx:29`, `ListRow.tsx:38`, `SwitchRow.tsx:23` ; `26`/`24`/`12` pour coche, radio, pastille (`CheckboxField.tsx:58`, `ChoiceCard.tsx:56, 67`, `Banner.tsx:75`) ; `height: 6` (`ProgressBar.tsx:25`) ; `gap: 16`, `marginTop: 48` (`AreaLayout.tsx:14`) ; `16` (`Toast.tsx:57, 87`) ; `minHeight: 56` (`MainTabs.tsx:29`) ; `160` (`Skeleton.tsx:53`) ; `64` (`AsyncView.tsx:55`) ; `minWidth: 56` (`DiscoverScreen.tsx:200` et autres) ; avatars 36/120/140 ; `borderLeftWidth: 5` (`Banner.tsx:64`). |
| Durées | Squelette 800 ms (`Skeleton.tsx:41-42`) ; carte 180 ms (`SwipeCard.tsx:51`) ; toast 4000 et 8000 ms (`Toast.tsx:20`, `AppShell.tsx:44`) ; 30 000 ms (`VerificationStatusScreen.tsx:24`) ; 60 000 ms (`ConversationsProvider.tsx:109`). Aucun jeton de mouvement. |
| z-index, élévation, ombre | Aucun usage. Le toast est un `View` en `position: absolute` rendu en dernier (`Toast.tsx:57`) ; une feuille ou un modal futur n'a pas de niveau défini. |
| Pourcentages de largeur | `'80%'`, `'48%'`, `'100%'` (voir P2-14). |

### 5.5 Styles dupliqués et composants à partager

| Duplication | Emplacements | Composant cible |
|---|---|---|
| Cadre « carte » (bordure 1, rayon `md`, fond `surface`, marge `space[2]` ou `space[4]`) | `ProfileDetailScreen.tsx:156`, `ConversationScreen.tsx:248`, `PhotosManager.tsx:165`, `SanctionsScreen.tsx:51`, `VerificationScreen.tsx:89` | `Card` |
| Menu `⋯` en ligne avec confirmation | `ProfileDetailScreen.tsx:152-175`, `ConversationScreen.tsx:247-278`, `SessionsScreen.tsx:60-69`, `ConsentSettingsScreen.tsx:57-63`, `PhotosManager.tsx:179-184` | `ActionSheet` + `ConfirmPanel` |
| Bannière d'erreur fermable (même attributs répétés : `onDismiss`, `dismissLabel={t('ui.banner.dismiss')}`, `style={{ marginBottom: space[3] }}`) | 14 occurrences | `ErrorBanner` ou `Banner` avec fermeture par défaut |
| Bouton-glyphe de 48 pt en `Button` avec `label="✕"` | 9 occurrences (section 5.1) | `IconButton` 44 × 44 |
| Bouton fantôme servant de lien ou d'étiquette de menu | 46 occurrences de `variant="ghost"` | `LinkButton`, `MenuItem` |
| Badge textuel en `Text` + `fontWeight '700'` | `SwipeCard.tsx:120`, `ProfileDetailScreen.tsx:208`, `ProfileTabScreen.tsx:71, 76`, `PhotosManager.tsx:176` | `Badge` |
| Pied en pile de boutons (`<View style={{ gap: space[2] }}>`) | accueil, connexion, filtres, match, appels, Premium, sessions… | `FooterActions` |
| Titre de section / étiquette de champ en `Text` + `fontWeight '600'` | `PreferenceFields.tsx:70, 88, 127, 168`, `ProfileEditScreen.tsx:125, 133`, `SettingsScreen.tsx:57` | variante `label` de `Text` |
| Message d'erreur de champ sous un groupe | `BasicProfileScreen.tsx:78-82`, `IntentScreen.tsx:104-108`, `PhotosScreen.tsx:41-45`, `VerificationScreen.tsx:112-116` | `FieldError` |

### 5.6 Contrastes calculés (WCAG 2.x)

Valeurs du clair puis du sombre. Le seuil est 4,5:1 pour le texte et 3:1 pour les composants.

| Paire | Clair | Sombre | Verdict |
|---|---|---|---|
| texte / fond | 17,38 | 16,73 | OK |
| texte atténué / fond | 6,83 | 7,48 | OK |
| texte atténué / surface | 6,23 | 6,74 | OK |
| primaire / fond (texte et lien) | 5,18 | 8,33 | OK |
| primaire / surface | 4,72 | 7,51 | OK, marge faible en clair |
| texte sur primaire (`onPrimary`) | 5,18 | 7,68 | OK |
| bordure forte / fond | 3,91 | 4,39 | OK (composants) |
| bordure forte / surface | 3,56 | 3,95 | OK |
| bordure décorative / fond | 1,31 | 1,58 | Acceptable pour les séparateurs, **pas** pour un contour de composant ; `SwipeCard` et les vignettes photo l'utilisent (`SwipeCard.tsx:100`, `PhotosManager.tsx:165`) comme cadre seul |
| J'aime / fond | **3,30** | 10,82 | Passe comme graphique (3:1), **échoue comme texte** : ne jamais l'utiliser pour un libellé en clair |
| refus / fond | 4,83 | 6,82 | OK |
| vérifié / fond | 5,17 | 7,42 | OK |
| danger / surface | 5,90 | 6,14 | OK |
| avertissement / surface | 4,58 | 10,18 | OK, marge faible en clair |
| succès / surface | 4,57 | 9,75 | OK, marge faible en clair |
| texte désactivé / fond désactivé | 5,21 | 4,74 | OK |
| texte sur danger | 6,47 | 6,28 | OK |

Réserve : la couleur de la bordure de bouton `J'aime` et `Refuser` (`DiscoverScreen.tsx:200, 218`) est correcte seule, mais le glyphe intérieur est en primaire : le sens vert / rouge de la bordure n'est pas relayé par le glyphe (cœur, croix) pour les personnes daltoniennes ; le glyphe seul porte le sens, ce qui est correct.

## 6. Confiance et motifs sombres (principe 2)

| Point | Constat | Verdict |
|---|---|---|
| Prix, durée, renouvellement près du bouton | Présents dans le pied de Premium (`PremiumScreen.tsx:55-77`), restauration visible, gestion de l'abonnement en un toucher sans offre de rétention (`ManageSubscription.tsx:36`) | Conforme |
| Succès d'achat | Affiché seulement après confirmation du serveur (`PurchaseResultScreen.tsx:29-30`) | Conforme |
| Compte à rebours, rareté, culpabilisation | Aucun trouvé | Conforme |
| Plan le plus long présélectionné | `PremiumScreen.tsx:40-41` | À trancher (D6) : pratique courante, mais préselectionner l'offre la plus chère est un choix par défaut orienté ; le prix total est lisible |
| Annuler le dernier choix puis paywall | P1-12 | Écart léger |
| Appels annoncés sans média | P0-5 | Écart |
| « Vérifié » | P0-4 | Écart |
| Refus de l'autre (passer) | Aucun message culpabilisant, aucun nombre de « refus » montré | Conforme |
| Signalement et blocage partout | Découverte (`DiscoverScreen.tsx:223-230`), détail (`:170-171`), conversation (`:266-267`), appel (`CallScreen.tsx:89-96`) | Conforme ; le signalement depuis un **message** précis n'existe pas |
| Anti-arnaque | Accueil (légende de 13 pt), bandeau dans la conversation sur signal serveur | Insuffisant : pas de rappel à la première conversation ni au premier message |
| Suppression de compte | Dans l'application, 3 touchers depuis Profil, délai de grâce expliqué | Conforme |
| Compte suspendu | Pas d'écran dédié (P1-7) | Écart |
| Données sensibles | P1-15 | À trancher (D3) |

## 7. Gains rapides (moins d'une heure chacun)

| # | Action | Fichier | Réduit |
|---|---|---|---|
| 1 | Sortir le `Button` d'action de la vue accessible dans `EmptyState` | `ui/EmptyState.tsx:21-40` | P0-1 |
| 2 | Retirer `numberOfLines={2}` du `Button` | `ui/Button.tsx:83` | P1-1 |
| 3 | Masquer `☎` et `▶` quand `calls.mediaAvailable` est faux | `ConversationScreen.tsx:226-243` | P0-5 |
| 4 | Retirer « prototype D0 requis » du texte utilisateur (fr et en) | `i18n/areas/calls.{fr,en}.ts:14-15` | P0-5 |
| 5 | Mettre « Envoyer le signalement » dans le pied de l'écran | `ReportScreen.tsx:83-95` | P1-8 |
| 6 | Un jeton `opacity.pressed` (0,8) importé par les 6 composants | `theme/tokens.ts` + `ui/*` | cohérence (5.3) |
| 7 | Une variante `label` (taille 16, graisse 600) dans `Text` et remplacement des `fontWeight` | `ui/Text.tsx`, 22 fichiers | 5.4 |
| 8 | Mettre `accessible={false}` sur les enfants de `Skeleton` dans `AsyncView` | `ui/AsyncView.tsx:52-54` | P2-3 |
| 9 | Passer le toast à 6 s avec action et le remonter au-dessus de la barre d'onglets | `ui/Toast.tsx:20, 57` | P1-5 |
| 10 | Brancher « Conditions » et « Confidentialité » dans `ConsentSettingsScreen` | `ConsentSettingsScreen.tsx:76-77` | P2-6 |
| 11 | Utiliser le jeton `verified` pour le badge | `SwipeCard.tsx:120`, `ProfileDetailScreen.tsx:208`, `ProfileTabScreen.tsx:71` | P1-13 |
| 12 | Plurielles `{days}`, `{count}` par `Intl.PluralRules` dans `translate` | `i18n/translate.ts:14-19` | P1-6 |
| 13 | Retirer `accessibilityViewIsModal` d'un menu en ligne | `ProfileDetailScreen.tsx:155` | P1-10 |
| 14 | Ajouter un `accessibilityHint` aux boutons principaux désactivés | `BirthdateScreen.tsx:86`, `VerificationScreen.tsx:72` | P2-4 |
| 15 | Afficher le pays d'origine sur la carte | `SwipeCard.tsx:125-127` | principe 6 |

## 8. Ce qui est bien fait (à ne pas casser)

- Jetons uniques et test qui interdit les couleurs en dur dans `src`.
- `Button` : cible de 48 pt, `hitSlop`, `accessibilityState` (`disabled`, `busy`), libellé de chargement distinct (`ui/Button.tsx:40-47`).
- `Banner` : ne repose pas sur la couleur seule (glyphe + texte), région vivante assertive pour l'erreur (`ui/Banner.tsx:55-56`).
- `ListRow` : correction du parent `accessible` (le bon modèle à recopier dans `EmptyState`).
- `Skeleton` : respecte « réduire les animations » et n'anime pas avant de connaître le réglage (`ui/Skeleton.tsx:17-47`).
- Âge : contrôle avant le compte, refus neutre, jeton court, retour bloqué (`AgeRefusedScreen.tsx:20-26`).
- Achat : le serveur confirme, jamais le magasin ; gestion de l'abonnement sans détour.
- Découverte : actions d'accessibilité complètes sur la carte (`SwipeCard.tsx:74-90`) et boutons équivalents.
- Liens profonds en liste blanche (`navigation/deepLinks.ts`).

## 9. Décisions pour le propriétaire

| # | Question | Options | Recommandation |
|---|---|---|---|
| D1 | Fonction d'appel avant le média réel (P0-5) | (a) masquer les boutons ; (b) les garder avec explication ; (c) bloquer la sortie en bêta | (a) : on ne montre pas ce qui ne fonctionne pas |
| D2 | Textes juridiques et formulation de « Vérifié » (P0-4, P0-6) | Rédaction par le juriste avant toute soumission | Bloquer le profil de production sans adresses ; faire valider la phrase « pas une garantie d'identité » |
| D3 | Genre sans « préfère ne pas dire », orientation déductible, consentement sensible obligatoire (P1-15) | (a) ajouter la valeur et la rendre non filtrante ; (b) statu quo ; (c) retirer l'obligation et dégrader la fonction | Question à poser au juriste avant tout choix ; ne pas trancher côté design |
| D4 | Écran de refus d'âge : proposer ou non un lien d'aide | (a) aucun (neutre) ; (b) lien « Contacter l'assistance » | (a) par défaut ; (b) seulement si le juriste le valide |
| D5 | Bibliothèques (réserve de la section 7 du prompt) : `react-native-svg` + jeu d'icônes, `react-native-reanimated`, `react-native-gesture-handler`, `expo-image`, `expo-haptics` | Installer ou non | Aucune installation tant que la phase 3 et la phase 5 ne les justifient pas ; `expo-image` est la plus rentable pour la fluidité (P2-1) |
| D6 | Plan de 12 mois présélectionné | (a) conserver ; (b) aucune présélection ; (c) présélectionner le mensuel | (a) acceptable si le prix total et la durée restent lisibles ; sinon (b) |
| D7 | Anti-arnaque : rappel à la première conversation | (a) bandeau statique non fermable le premier jour ; (b) sur signal seulement | (a) : principe 1 |

## 10. Hypothèses à valider

- Les hauteurs et largeurs *estimées* (P0-2, P0-3, sections 4.3 et 4.7) sont à mesurer sur un téléphone Android de 320 pt de large, police système à 200 %, puis sur un iPhone SE.
- Le rendu des glyphes `☺ ☎ ▶ ✉ ★ ♥` varie selon les fabricants : à vérifier sur au moins 3 familles d'appareils (Samsung, Xiaomi/Tecno ou Infinix, Pixel).
- La part d'utilisateurs en police agrandie et en réseau lent sur les marchés des vagues 1 et 2 est **inconnue** : aucune donnée dans le dépôt.
- Le délai de traitement des signalements (24 h, cible du prompt) est **à confirmer** avant tout affichage.
- Les comportements de `accessible` parent (EmptyState) sont documentés par React Native mais n'ont pas été testés ici avec VoiceOver ou TalkBack.

## 11. Suite proposée

1. Valider ce constat, répondre à D1 à D7.
2. Corriger les gains rapides 1 à 5 (accessibilité et honnêteté), puis relancer les tests.
3. Mesurer sur appareil les points *estimés* (hypothèses), avec captures avant/après.
4. Lancer la phase 1 (direction de marque) en parallèle de la phase 2 (jetons : mouvement, élévation, opacité d'état, z-index, focus, taille d'icône).
