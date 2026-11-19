# 05 - Suivi de l'application de la nouvelle identité (direction D « Prune »)

Liste de contrôle vivante : une case cochée veut dire « fait, testé, vérifié à l'écran ». Les écrans reprennent le plan de [`04-handoff-analyse.md`](04-handoff-analyse.md). Les composants sont décrits dans [`03-composants.md`](03-composants.md), les jetons dans [`02-tokens.md`](02-tokens.md).

## 1. Fondation (terminée)

- [x] Direction D active, jetons à source unique (`design/tokens.json`), composants de base, icônes Lucide, garde ESLint.
- [x] **Poppins** : `expo-font` et `@expo-google-fonts/poppins` installés. Quatre graisses chargées, une famille par graisse (`typography.fontFamily` dans `tokens.json`, généré dans `tokens.ts`). `Text` choisit la famille d'après la graisse de la variante ou d'un `fontWeight` passé en style ; police du système avant chargement et en cas d'échec ; chargement dans `app/_layout.tsx` sans bloquer le premier rendu (écran de démarrage natif inchangé).
- [x] **Poids des polices** (fichiers `.ttf`, mesurés) : 400 = 158 240 octets (154,5 Ko), 500 = 156 520 (152,8 Ko), 600 = 155 232 (151,6 Ko), 700 = 153 944 (150,3 Ko). Total embarqué : 623 936 octets, soit environ **609 Ko**. L'ExtraBold 800 (152 764 octets, 149 Ko) n'est pas chargé : aucune variante de l'échelle ne l'utilise et le mot-symbole du kit est en 700. À ajouter seulement si un titre d'affichage le demande (ajouter la clé `800` à `fontFamily` et son import dans `src/theme/fontAssets.ts`). Les imports se font par graisse (`@expo-google-fonts/poppins/400Regular`) : l'import racine embarquerait les 18 variantes (environ 2,7 Mo). À mesurer sur un Android d'entrée de gamme avant l'ouverture.
- [x] **Site de présentation** : `web/assets/tokens.css` reçoit `--font-brand: Poppins, system-ui, sans-serif` et la classe `.font-brand`, sans `@font-face` ni police distante. `--font-sans` (corps du site de présentation) reste la police du système : le site de présentation fonctionne hors ligne.
- [x] **Logo** : `src/ui/Logo.tsx` (variantes couleur, blanc, mono ; dispositions symbole et horizontale ; `size` = hauteur en pt, largeur du symbole dérivée du cadre `390 x 350`). Tracés et dégradés du kit dans `src/ui/brandArt.ts`, seul fichier de `src/` (avec `tokens.ts`) exempté du test « aucune couleur en dur ». Mot-symbole en vrai texte (`Text`, Poppins Bold, couleur par jeton). Démo : écran « Composants », sections Logo et Typographie.
- [x] **Icône d'application** : `mobile/assets/icon.png` remplacé par `assets/brand/ayelo-app-icon-1024.png` (1024 x 1024). Identifiants de bundle et champs EAS inchangés.
- [ ] **Actifs natifs à régénérer à partir du symbole** (aucun outil de rastérisation SVG sur la machine, et on n'en ajoute pas) :
  - [ ] Premier plan de l'icône adaptative Android : `assets/android-icon-foreground.png`, 1024 x 1024, PNG transparent, symbole dans le cercle central de 66 % (environ 676 px) ; aujourd'hui 512 x 512, ancien dessin.
  - [ ] Fond adaptatif : `assets/android-icon-background.png` (aujourd'hui 512 x 512, ancien dessin) ; plus simple : une couleur unie `#C2006B` (jeton `primary`, déjà posée par le générateur dans `app.json`) et retirer l'image.
  - [ ] Icône monochrome Android : `assets/android-icon-monochrome.png`, 1024 x 1024, symbole en une seule couleur sur transparent, même zone de sécurité (aujourd'hui 432 x 432).
  - [ ] Icône de notification Android : à créer, 96 x 96, blanc sur transparent, forme du symbole sans dégradé ; la déclarer dans le plugin `expo-notifications` (`icon`). La couleur `#C2006B` est déjà générée.
  - [ ] Favicon web : `assets/favicon.png`, 48 x 48 (et 32 x 32 si besoin), symbole seul ; vérifier la lisibilité à 24, 32 et 48 px comme le demande la charte.
  - [ ] Image de l'écran de démarrage : `assets/splash-icon.png`, 1024 x 1024 transparent (symbole centré, affiché à 200 pt de large), puis l'ajouter au plugin `expo-splash-screen` (`image`, `imageWidth`). Le test `buildConfig.test.ts` exige aujourd'hui l'absence d'image : à adapter dans la même modification. Le fond clair et le fond sombre viennent déjà des jetons.
- [ ] **Logo : points ouverts** : vérification juridique du nom et du dessin (antériorités) avant exploitation commerciale ; les fichiers blanc et monochrome du kit référencent des dégradés qu'ils ne définissent pas (rendu vide) : les variantes de `Logo.tsx` sont donc refaites à partir du maître (blanc : mêmes dégradés, mot-symbole blanc ; mono : une encre, cœur évidé) et à faire valider par le propriétaire.

## 2. Écrans (à faire, dans cet ordre)

Pour chaque écran : maquette du kit comparée au produit réel (`04-handoff-analyse.md`), jetons et composants uniquement, clair et sombre, 320 pt et 390 pt, police agrandie à 200 %, captures dans `docs/design/captures/`, tests.

- [x] **Accueil** (`app/(public)`, S01) : logo horizontal, signature, boutons ; pas de connexion sociale.
- [x] **Connexion** : champs, erreurs, lien de réinitialisation.
- [x] **Inscription** : e-mail et mot de passe, date de naissance en trois champs, consentements, vérification de l'e-mail.
- [x] **Préférences et profil de base** : seulement les champs pris en charge par l'API (genres, âge, pays, intentions, profils vérifiés), photos.
- [x] **Découverte** : carte de profil, actions, fiche détaillée, blocage et signalement.
- [x] **Match** : écran de correspondance.
- [x] **Messagerie** : liste, conversation, appels masqués tant que non livrés.
- [x] **Profil et sécurité** : onglet profil, réglages, vérification du profil, signalement, suppression du compte.
- [x] **Paywall** : offres, crédits, mentions de renouvellement lisibles.
- [x] **Écrans secondaires** (2026-11-14) : édition du profil, filtres, réglages (notifications, confidentialité, consentements, bloqués, sessions), compte et sécurité (suppression, export, aide, sanctions, contestation, mentions légales, mot de passe oublié et nouveau, confirmation d'e-mail, suivi de vérification). Captures `etape-reglages-*` et `onboarding-reel-*` dans `docs/design/captures/` (390 pt clair et sombre, 320 pt, texte à 200 % simulé sur le web).
  - Limites connues : titres très longs coupés en milieu de mot à 320 pt avec le texte à 200 % (« Consentements », « Vos préférences ») ; message vide de « Aide et assistance » plus grand que le titre de section (`EmptyState` en `h2`) ; 200 % non vérifié en natif.

## 3. Transversal

- [ ] Poids de Poppins et fluidité mesurés sur un Android d'entrée de gamme (les polices sont chargées après le premier rendu : vérifier le saut de police visible sur les écrans longs).
- [ ] Interligne : les jetons de ligne sont inchangés ; Poppins est plus haut que Roboto, à contrôler à 200 % de police.
- [x] `fontWeight` passés en style remplacés par des variantes de texte (lot 5 des corrections de revue) : plus aucun `fontWeight` en chaîne dans `src/` ni `app/`.

## 4. Revues de design et limites connues (2026-11-16)

Deux passes de relecture de tous les écrans (lecture seule), six lots de corrections (commits `491b1a0`, `5db5372`, `bdd6154`, `52a140c`, `9ee9e48`, puis le lot 6). **Tout ce qui suit n'a été vérifié que par des tests Jest (simulations d'expo-router, d'`AccessibilityInfo`, de `StatusBar`) et par lecture du code, jamais sur appareil ni dans un navigateur :**

- **Garde de sortie de l'édition du profil** : `usePreventRemove` (expo-router 58) ; l'événement `beforeRemove` n'existe plus dans cette version. Le test passe par une simulation fidèle au contrat de la bibliothèque (`__tests__/helpers/routerMock.ts`), pas par une vraie pile de navigation.
- **Barre d'état** : icônes claires seulement tant que l'écran a le focus (`useIsFocused`) ; effet réel sur iOS et Android non vu.
- **Focus d'accessibilité** (retour du focus après le panneau de confirmation des sessions, annonces iOS, régions vives Android) : VoiceOver et TalkBack non testés. Retour du focus câblé seulement pour les sessions, pas pour les consentements.
- **Largeurs et texte à 200 %** : retour à la ligne de « Annuler / Signaler » (découverte), libellés d'onglets plafonnés à 1,4 fois, pastille de non-lus, bannières à action en colonne, lignes à bouton sous le texte : calculés ou testés par style, pas rendus.
- **Clavier Android** : la zone de saisie de la conversation et les champs de l'aide ne sont pas vérifiés avec la barre d'espace réduite (mode bord à bord).
- **Perte de saisie** : ouvrir un texte légal depuis les consentements d'inscription (route racine hors de la pile publique) vide les cases cochées si l'adresse légale n'est pas configurée ; revenir de « nouveau mot de passe » vers « mot de passe oublié » vide l'adresse. Limite acceptée, non corrigée.
- **Photos** : grille en une colonne dès 360 pt de large (seuil du hook `useCompactLayout`, auparavant 359 pt).
- **Non traités** : fusion de `NavRow` et `ListRow`, file de trois toasts, jetons pour les opacités de `Stepper`, ouverture des pages légales par l'application quand une adresse est configurée.
