# 05 - Suivi de l'application de la nouvelle identité (direction D « Prune »)

Liste de contrôle vivante : une case cochée veut dire « fait, testé, vérifié à l'écran ». Les écrans reprennent le plan de [`04-handoff-analyse.md`](04-handoff-analyse.md). Les composants sont décrits dans [`03-composants.md`](03-composants.md), les jetons dans [`02-tokens.md`](02-tokens.md).

## 1. Fondation (terminée)

- [x] Direction D active, jetons à source unique (`design/tokens.json`), composants de base, icônes Lucide, garde ESLint.
- [x] **Poppins** : `expo-font` et `@expo-google-fonts/poppins` installés. Quatre graisses chargées, une famille par graisse (`typography.fontFamily` dans `tokens.json`, généré dans `tokens.ts`). `Text` choisit la famille d'après la graisse de la variante ou d'un `fontWeight` passé en style ; police du système avant chargement et en cas d'échec ; chargement dans `app/_layout.tsx` sans bloquer le premier rendu (écran de démarrage natif inchangé).
- [x] **Poids des polices** (fichiers `.ttf`, mesurés) : 400 = 158 240 octets (154,5 Ko), 500 = 156 520 (152,8 Ko), 600 = 155 232 (151,6 Ko), 700 = 153 944 (150,3 Ko). Total embarqué : 623 936 octets, soit environ **609 Ko**. L'ExtraBold 800 (152 764 octets, 149 Ko) n'est pas chargé : aucune variante de l'échelle ne l'utilise et le mot-symbole du kit est en 700. À ajouter seulement si un titre d'affichage le demande (ajouter la clé `800` à `fontFamily` et son import dans `src/theme/fontAssets.ts`). Les imports se font par graisse (`@expo-google-fonts/poppins/400Regular`) : l'import racine embarquerait les 18 variantes (environ 2,7 Mo). À mesurer sur un Android d'entrée de gamme avant l'ouverture.
- [x] **Web public** : `web/assets/tokens.css` reçoit `--font-brand: Poppins, system-ui, sans-serif` et la classe `.font-brand`, sans `@font-face` ni police distante. `--font-sans` (corps du site) reste la police du système : le site fonctionne hors ligne.
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

- [ ] **Accueil** (`app/(public)`, S01) : logo horizontal, signature, boutons ; pas de connexion sociale.
- [ ] **Connexion** : champs, erreurs, lien de réinitialisation.
- [ ] **Inscription** : e-mail et mot de passe, date de naissance en trois champs, consentements, vérification de l'e-mail.
- [ ] **Préférences et profil de base** : seulement les champs pris en charge par l'API (genres, âge, pays, intentions, profils vérifiés), photos.
- [ ] **Découverte** : carte de profil, actions, fiche détaillée, blocage et signalement.
- [ ] **Match** : écran de correspondance.
- [ ] **Messagerie** : liste, conversation, appels masqués tant que non livrés.
- [ ] **Profil et sécurité** : onglet profil, réglages, vérification du profil, signalement, suppression du compte.
- [ ] **Paywall** : offres, crédits, mentions de renouvellement lisibles.

## 3. Transversal

- [ ] Poids de Poppins et fluidité mesurés sur un Android d'entrée de gamme (les polices sont chargées après le premier rendu : vérifier le saut de police visible sur les écrans longs).
- [ ] Interligne : les jetons de ligne sont inchangés ; Poppins est plus haut que Roboto, à contrôler à 200 % de police.
- [ ] Remplacer les `fontWeight` passés en style par de vraies variantes quand les écrans sont repris (le composant `Text` les convertit déjà en famille).
