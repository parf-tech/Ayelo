# Phase 0 : synthèse de l'audit UI/UX d'Ayelo

Date : 2026-11-08. Livrable de la phase 0 de `PROMPT-UIUX-EXPERT.md`. Cette synthèse consolide quatre rapports détaillés, à lire pour les preuves (fichier et ligne) : [`00-audit-ui.md`](00-audit-ui.md) (écrans et composants), [`00-a11y.md`](00-a11y.md) (accessibilité, contrastes calculés), [`00-parcours-personas.md`](00-parcours-personas.md) (parcours, personas, plan de recherche), [`00-concurrents.md`](00-concurrents.md) (12 applications, sources).

## Ce qui a été vu, et ce qui ne l'a pas été

- **Vu rendu** : l'application tourne dans un navigateur via `react-native-web` (serveur Expo sur le port 8081, fenêtre de 390 pt). Quatre captures sont dans [`captures/`](captures/) : accueil, date de naissance, connexion, démonstration des composants en sombre. Aucune erreur console.
- **Jamais vu** : un téléphone réel, un lecteur d'écran (VoiceOver, TalkBack), la police système à 150 ou 200 %, l'écran de 320 pt, les gestes de la carte, les appels, les notifications. Il n'y a ni émulateur ni appareil sur ce poste. Les largeurs et hauteurs marquées « estimé » dans les rapports sont des calculs, pas des mesures.
- **Conséquence** : tout constat « estimé » ou « hypothèse » reste à confirmer sur un Android d'entrée de gamme (320 pt, police à 200 %) et sur un iPhone SE avant de le déclarer corrigé.

## Verdict

L'interface est **structurellement saine et honnête** : jetons centralisés (test qui interdit les couleurs en dur), états de chargement et d'erreur gérés, aucun motif sombre trouvé, paywall transparent. Elle n'est **pas encore au niveau d'un produit de confiance** : identité de marque absente (pas de logo, glyphes Unicode à la place des icônes), trois défauts d'accessibilité bloquants, des promesses non tenues (appels, « Vérifié »), et un parcours d'inscription trop long (environ 28 touches pour 11 annoncées).

## P0 : à corriger avant toute bêta ouverte

| # | Constat | Preuve | Correction | Effort |
|---|---|---|---|---|
| 1 | `EmptyState` est `accessible` et enveloppe son bouton : le lecteur d'écran n'atteint plus « Modifier les filtres », « Découvrir », « Mon profil » | `ui/EmptyState.tsx:21-40` ; même bug déjà corrigé dans `ListRow` | retirer `accessible` du conteneur | 1 h |
| 2 | Le sélecteur de date de naissance coûte 125 à 145 arrêts au lecteur d'écran, et le rendu montre trois listes de 4 valeurs sans valeur sélectionnée visible | `ui/DateSelector.tsx` ; capture `date-naissance-clair-390.png` | trois champs numériques JJ / MM / AAAA avec validation | 0,5 j |
| 3 | En-tête de conversation d'environ 374 pt de large fixe : le nom s'écrase et le menu signaler / bloquer peut sortir de l'écran, même à 390 pt (estimé) | `ConversationScreen.tsx:220-245` | en-tête sur deux lignes, menu en feuille | 0,5 j |
| 4 | Pieds de page hors défilement trop hauts à 320 pt et 200 % de police : les libellés de bouton sont coupés (estimé) | `Button.tsx:83` (`numberOfLines={2}`), connexion, Premium, consentements, accueil | pieds de page qui défilent ou se compactent en grande police | 0,5 j |
| 5 | « Vérifié » promet trop : le texte dit que le selfie « prouve que vous êtes bien la personne », la promesse validée dit « pas une garantie d'identité » ; le badge n'a aucune explication | `i18n/areas/verification.fr.ts` | reformuler et ajouter une explication au toucher du badge ; validation juridique | 1 h + juriste |
| 6 | Les boutons d'appel sont actifs alors que l'écran d'appel annonce « média indisponible » et affiche « prototype D0 requis » aux utilisateurs | `ConversationScreen.tsx:226-243`, `calls.fr.ts:14-15` | masquer les boutons tant que le média n'existe pas | 1 h |
| 7 | Sans `EXPO_PUBLIC_TERMS_URL` ni `PRIVACY_URL`, les liens légaux ouvrent un écran de repli vide : risque de rejet par les stores | `features/legal/` ; `npm run check:env` ne couvre que la production | bloquer le profil de production sans ces adresses (déjà vérifié) et publier les pages `web/` | 0,5 j + juriste |
| 8 | Lien « Voir les composants (développement) » visible aux utilisateurs sur l'accueil | capture `accueil-clair-390.png` | l'afficher seulement si `__DEV__` | 10 min |
| 9 | Contrastes clairs insuffisants en texte : « J'aime » `#16A34A` à 3,30:1, refus `#DC2626` à 4,40:1 sur surface | `00-a11y.md` §1 (valeurs calculées) | `like` `#137538`, `dislike` `#C81E1E` | 10 min |
| 10 | Interrupteur de 31 pt de large et ligne non cliquable ; carte suivante cachée mais lisible au lecteur d'écran ; aucune annonce iOS ; texte « Delete » en anglais qui ne correspond pas au libellé | `SwitchRow`, `DiscoverScreen`, `00-a11y.md` §2 | voir les corrections de code dans `00-a11y.md` §5 | 1 j |

## P1 les plus rentables

- **Parcours** : inscription en 28 touches environ ; aucun bouton Google ni Apple sur l'accueil et l'inscription (prévus par les docs, SDK absents) ; permission de notification demandée sans écran d'explication ; un crédit dépensé à l'écriture à un non-match sans confirmation ; annulation de suppression impossible depuis l'application (le support est derrière la connexion).
- **Interface** : 12 glyphes Unicode servent d'icônes (31 endroits) ; 4 variantes d'en-tête ; 3 opacités « enfoncé » ; 223 styles en ligne pour 2 fichiers `StyleSheet` ; `SwipeCard` anime avec `useNativeDriver:false` (3 endroits), donc sur le fil JavaScript, ce qui coûte en fluidité sur Android d'entrée de gamme.
- **Confidentialité** : nom et URL de photo du profil passent dans les paramètres de route (contraire au prompt §7).
- **Texte** : aucun pluriel géré (« 1 jours ») ; textes envoyés par le serveur non traduits ; menus qui s'ouvrent en haut du défilement.
- **Confiance** : badge « vérifié » réutilise la couleur primaire au lieu du jeton `verified` ; bannière anti-arnaque affichée seulement quand le serveur détecte une demande d'argent (`money_request`), pas dès la première conversation.

Les 17 P1 et 15 P2 complets, avec preuves, sont dans `00-audit-ui.md` ; les 15 P1 et 9 P2 d'accessibilité dans `00-a11y.md`.

## Gains rapides (moins d'une heure chacun)

1. Masquer le lien « composants » hors développement. 2. Corriger `like` et `dislike`. 3. Retirer `accessible` d'`EmptyState`. 4. Masquer les boutons d'appel. 5. Reformuler le texte de « Vérifié ». 6. Passer le badge vérifié sur le jeton `verified`. 7. Remplacer « Afficher le mot de passe » par une icône œil avec libellé accessible. 8. Pluriels et espaces insécables dans les textes français. 9. Toasts sans disparition tant qu'une action est proposée. 10. `returnKeyType` et `onSubmitEditing` sur les formulaires.

## Ce que les concurrents confirment (sources dans `00-concurrents.md`)

- **À adopter** : un avertissement anti-arnaque visible et contextuel ; un prix, une durée et une date de reconduction près du bouton ; une vérification expliquée avec ses limites.
- **À éviter** : essai gratuit qui bascule en abonnement hebdomadaire cher (Hily, une seule source) ; suspension après paiement (plaintes de 2,3 sur 5 pour AfroIntroductions) ; promesse d'identité vérifiée non tenue.
- **Place à prendre pour Ayelo** : la confiance pour la diaspora, la sensibilisation aux arnaques, la tarification honnête. Une critique d'App Store de Chat&Yamo (02/09/2025) demande le paiement par Mobile Money : question ouverte du dépôt, non tranchée.

## Décisions pour le propriétaire (consolidées, avec recommandation)

| # | Décision | Recommandation |
|---|---|---|
| 1 | **Appels** : masquer les boutons tant que le média n'existe pas | oui |
| 2 | **Connexion Google et Apple** : prévue par les docs, SDK absents, ré-authentification déjà préparée | décider avant la bêta : elle réduit fortement la friction d'inscription ; coût : comptes développeur Apple et Google |
| 3 | **Genre** sans « préfère ne pas dire », orientation déductible, consentement sensible obligatoire | question à poser au juriste ; ne pas trancher côté design |
| 4 | **Date de naissance** : trois champs numériques (sans dépendance) | oui |
| 5 | **Paywall** : plan de 12 mois présélectionné, ou aucune présélection | acceptable si le prix total et la durée restent lisibles ; sinon aucune présélection |
| 6 | **Anti-arnaque** : bandeau fixe au premier jour, ou seulement sur signal | bandeau fixe le premier jour, alerte contextuelle ensuite après avis du juriste |
| 7 | **Vérification** : selfie seul, ou selfie plus pièce d'identité facultative avec badge distinct | selfie plus pièce facultative, avec phrase de limite claire ; le juriste valide la conservation des données biométriques |
| 8 | **Paiement local (Mobile Money)** : achats intégrés seulement, ou aussi Mobile Money hors boutiques | à étudier avec une estimation de revenu par marché ; non tranché |
| 9 | **Orientation de l'écran** : portrait seul ou paysage autorisé | paysage autorisé pour l'accessibilité |
| 10 | **Menus** : vraie feuille modale native ou menus en ligne | `Modal` natif (piège le focus sur les deux plateformes) |
| 11 | **Icônes** : adopter un jeu SVG (`react-native-svg` plus Lucide) | oui, prérequis pour fermer plusieurs critères d'accessibilité ; ajout de dépendance à valider |
| 12 | **Autres bibliothèques** : `react-native-reanimated`, `react-native-gesture-handler`, `expo-image`, `expo-haptics`, `expo-font` | aucune tant que les phases 3 et 5 ne les justifient pas ; `expo-image` est la plus rentable |
| 13 | **Refus d'âge** : lien d'assistance ou rien | rien par défaut (neutre) |
| 14 | **Direction de marque et logo** | choisir après la phase 1 ; ne pas finaliser le logo avant la recherche d'antériorité du nom |
| 15 | **Questions du rapport parcours** à trancher en premier : connexion sociale, position du paywall, délais de modération annoncés, genre, appels, annulation de suppression | voir `00-parcours-personas.md`, 15 questions |

## Hypothèses à valider (liste complète dans chaque rapport)

- Largeurs et hauteurs estimées à 320 pt et 200 % de police : à mesurer sur Android réel.
- Rendu des glyphes `☺ ☎ ▶ ✉ ★ ♥` sur Samsung, Xiaomi, Tecno ou Infinix, et Pixel.
- Comportement de `accessible` parent sous VoiceOver et TalkBack.
- Part des utilisateurs en grande police et en réseau lent sur les marchés des vagues 1 et 2 : inconnue.
- Délai de traitement des signalements à afficher : à confirmer avant publication.
- Les trois personas viennent des documents du dépôt, pas d'entretiens : validation par 5 à 8 entretiens et un test modéré (plan dans `00-parcours-personas.md`).

## Risques

- **Nom** : « Ayelo » reste sans recherche d'antériorité (AILO, Aylo) ; une direction de logo ne doit pas partir avant.
- **Sensibilité** : l'orientation est déductible du genre et de la recherche ; certains marchés de la vague 2 ont des risques légaux. Aucune décision d'interface prise ici.
- **Rendu natif** : tout ce qui n'a pas été vu sur un appareil peut se révéler différent.

## Suite proposée

1. **Toi** : répondre aux décisions 1 à 15 (surtout 2, 3, 5, 7, 8, 11).
2. **Correction des P0 faciles** (gains rapides 1 à 6, plus le sélecteur de date) : environ 1 à 2 jours, avec tests et captures avant/après dans le navigateur.
3. **Phases 1 et 2 en parallèle** : trois directions de marque (sans logo final) et fichier unique de jetons (`design/tokens.json`) qui génère `tokens.ts` et `tokens.css`, avec les jetons manquants (élévation, mouvement, focus, états).
4. **Mesure sur appareil** : un Android d'entrée de gamme et un iPhone SE, police à 200 %, avec VoiceOver et TalkBack (plans de test dans `00-a11y.md`).
