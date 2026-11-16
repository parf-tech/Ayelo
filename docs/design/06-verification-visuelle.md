# 06 - Vérification visuelle de l'application redessinée (navigateur)

Date : 2026-11-16. Vérification en lecture seule : aucun fichier source modifié. Les captures sont dans `docs/design/captures/final-<écran>-<variante>.png` (57 fichiers).

## 1. Méthode

- **Environnement** : `scripts/dev-preview.ps1` (PostgreSQL 54350, API Laravel 8000, photos fictives 8001) puis `npx expo start --web --port 8089` avec `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000`. Membre `apercu@example.test`. PHP 8.5 WinGet (`PHP_PGSQL_BIN`) avec un `php.ini` activant intl, gd, exif (`PHPRC`).
- **Navigateur** : Chrome piloté par les outils chrome-devtools (MCP). Émulation de bureau (`isMobile: false`, sans tactile), densité 1. Ce n'est pas un téléphone : pas de geste, pas de clavier virtuel, pas de zone de sécurité, barres de défilement classiques visibles.
- **Variantes** :
  - 390 x 844, clair (référence).
  - 320 x 568, clair (`emulate viewport`).
  - Sombre : `emulate colorScheme=dark` à 390 x 844. Chaque appel `emulate` sans `colorScheme` remet le thème automatique (le système était en sombre) : toujours passer `colorScheme` explicitement.
  - **200 % du texte, simulé** : script injecté qui multiplie par 2 `font-size` et `line-height` (en px) de chaque élément portant du texte (les valeurs d'origine sont mémorisées puis restaurées). **Ce n'est pas le vrai agrandissement de police d'Android ou d'iOS** : le web de React Native renvoie toujours `fontScale = 1`. Conséquences : les plafonds `maxFontSizeMultiplier` (libellés d'onglets, cartes, pastilles) ne s'appliquent pas, les branches `useCompactLayout` (`isLarge`, `isXL`) et le pied de page défilant de `ScreenContainer` (`fontScale >= 1,3`) ne sont pas exercés, et le texte dans les champs de saisie n'est pas agrandi. Les captures 200 % sont donc un test de contrainte pessimiste, pas une preuve du rendu natif.
  - Session web : le jeton n'est pas conservé au rechargement complet (retour à l'accueil). La navigation s'est donc faite dans l'application (clics, puis `history.pushState` + `popstate` pour les routes sans entrée dans l'interface).
- **Écrans atteints autrement que par l'interface** : `match` (route `/match?name=Aminata&conversationId=...` avec paramètres choisis, pas une vraie affinité réciproque). Le toast a été obtenu en faisant répondre 500 à `POST /swipes` côté navigateur (patch de `fetch`) et en allongeant les minuteries (x20) pour que la capture ait le temps d'être prise.
- **Effets de bord** : trois sessions de connexion créées dans la base jetable (supprimée à l'arrêt). Un clic sur « Gérer mon abonnement » a ouvert un onglet Google Play (lien externe de l'application), fermé aussitôt. Un clic sur « Annuler mon dernier choix » (un `__go('Annuler')` mal ciblé) a déclenché la bannière « Réservé aux abonnés Premium » : elle a servi de capture de bannière.

## 2. Tableau écran x variante x verdict

Légende : OK = rien de gênant vu ; DEF = défaut réel (numéro de la section 3) ; SIM = constat issu de la simulation 200 % (à confirmer en natif) ; - = non capturé.

| Écran | 390 clair | 320 | Sombre | 200 % (simulé) | Remarques |
|---|---|---|---|---|---|
| Accueil | OK | OK (contenu défile, pied fixe) | OK | SIM : pied de page très haut, titre sur 3 lignes, lisible | DEF-1 (focus bouton principal) |
| Connexion | OK | DEF-11 | OK | SIM : pied de page 40 % de l'écran | Bannière d'erreur : OK |
| Inscription : date de naissance | OK | - | - | - | |
| Mot de passe oublié | OK | - | - | - | |
| Découverte (pile de cartes) | OK, DEF-4 | DEF-3 avec bannière | OK | SIM, DEF-3 avec bannière | Tab bar : OK |
| Fiche de profil | OK, DEF-6, DEF-14 | - | - | - | |
| Match (par URL) | OK | - | - | - | |
| Liste des messages | OK | - | - | - | |
| Conversation | OK | OK | OK | SIM : en-tête et bandeau mangent la zone de messages | DEF-6 |
| Onglet profil | OK, DEF-15 | - | - | - | |
| Réglages (index) | OK | OK | OK | SIM, DEF-5 (« Paramètre-s ») | |
| Notifications | DEF-10 (web) | - | - | - | |
| Confidentialité | DEF-10 (web) | - | - | - | |
| Sessions et appareils | OK, DEF-8 | - | - | - | Panneau de confirmation : OK |
| Personnes bloquées | DEF-12 | - | - | - | |
| Premium | OK, DEF-8, DEF-9 | DEF-2 | OK | SIM, DEF-5 (« Abonneme-nt ») | 360 x 740 : justes |
| Crédits | OK, DEF-13 | - | - | - | |
| Édition du profil | OK, DEF-7 | OK | OK | SIM : lisible | |
| Filtres | OK | - | - | - | |
| Vérification (accueil et statut) | OK | - | - | - | |
| Aide et assistance | DEF-12 | - | - | - | |
| Consentements | - | OK | - | - | |
| Toast au-dessus de la barre d'onglets | OK | - | - | - | écart de 16 pt avec la barre, recouvre les actions |
| Bannière avec libellé d'action long | OK | OK (libellé sur 2 lignes) | - | SIM, DEF-3 | |
| Barre d'onglets | OK | OK | OK | SIM : libellés coupés (plafond 1,4 non simulé) | voir 2.1 |

### 2.1 Barre d'onglets, focus, cibles, console

- **Barre d'onglets** (390 x 844) : trois onglets de 130 x 55 pt, icônes Lucide (couches, bulle, silhouette), onglet actif = icône pleine + trait supérieur + libellé magenta en gras (donc pas la couleur seule), pastille de non-lus « 2 » / « 3 » sur Messages, libellés lisibles à 320. Conforme à la charte.
- **Charte** : Poppins chargée (400, 600, 700 vues dans `document.fonts`), icônes SVG Lucide (trait arrondi), prune `#4B0F5B` (fond d'accueil, carte de match, contour de focus) et magenta `#C2006B` (boutons primaires, mesuré `rgb(194, 0, 107)`). En sombre, le bouton primaire passe en rose clair avec texte sombre (jeton sombre, voulu).
- **Cibles tactiles** : toutes les cibles mesurées à 390 pt (connexion, découverte, conversation, filtres) font au moins 44 x 44. Aucune cible sous 44 repérée.
- **Bouton retour** : même chevron nu 44 x 44, en (24, 24), sur tous les écrans empilés. Cohérent.
- **Anneau de focus** : voir DEF-1. Contour blanc 1,6 px décalé de 1,6 px sur « J'ai déjà un compte » (visible, double filet) ; contour prune sur fond prune pour « Créer mon compte » (quasi invisible). En sombre, l'anneau rose du bouton principal est visible.
- **Texte sur image** : le blanc sur le fondu prune des cartes reste lisible (« Dina, 19 », « Tunis, Tunisie », pastille d'intention). Seules des illustrations unies existent : le pire cas (photo claire) n'a pas pu être vu.
- **Console** (navigateur, 22 écrans parcourus dans une session) : aucune erreur de script. Messages constatés : `[warn] expo-notifications : push token non pris en charge sur le web` (au chargement), `[warn] Animated: useNativeDriver is not supported` (dès la première animation), `[issue] A form field element should have an id or name attribute` (11 occurrences, champs de saisie web), `[verbose] Password field is not contained in a form` (connexion), `[error] 401` x 2 (mauvais identifiants, volontaire), `[error] 402` (annulation du dernier choix hors Premium, attendu), `[error] ERR_INTERNET_DISCONNECTED` (essai hors ligne, volontaire). Seul message lié à l'application hors web : `[warn] Blocked aria-hidden on an element because its descendant retained focus` (x2, voir DEF-16).

## 3. Défauts réels

### P1

**DEF-1. Anneau de focus invisible sur « Créer mon compte » (accueil, clair).** Le bouton principal de l'accueil n'est pas en `tone="onBrand"` : son contour de focus prend `colors[focus.color]` (prune) sur le fond prune pleine page. Mesuré : `outline: rgb(75, 15, 91) solid 1.6px` sur un fond prune ; le secondaire, lui, a un contour blanc. Capture : `final-welcome-focus-primaire-clair-390.png` (comparer `final-welcome-focus-clair-390.png`). Clavier externe, Switch Control. Piste : `mobile/src/features/welcome/WelcomeScreen.tsx:56` (le bouton principal n'a pas `tone="onBrand"`), `mobile/src/ui/Button.tsx:50` (`useFocusRing(tone === 'onBrand' ? colors.onBrand : undefined)`).

**DEF-2. Écran Premium à 320 x 568 : le pied de page déborde et les liens légaux sont hors écran.** Le pied de page est plafonné à 45 % de la hauteur (256 px) mais son contenu fait 368 px et ne défile pas (le défilement n'existe que pour `fontScale >= 1,3`). Les liens « Conditions d'utilisation » (haut à 585 px) et « Politique de confidentialité » (633 px) sont sous le bord de l'écran (568) et la fin du texte de renouvellement est coupée. Ce sont des mentions obligatoires d'un abonnement. À 360 x 740 (taille Android courante) le dernier lien touche le bord bas (bas à 756 pour 740). Captures : `final-premium-clair-320.png`, `final-premium-clair-360.png`. Piste : `mobile/src/ui/ScreenContainer.tsx:89-114` (`maxHeight` sans défilement hors `largeFont`), contenu du pied dans `mobile/src/features/premium/PremiumScreen.tsx`.

**DEF-3. Découverte : la carte s'écrase quand une bannière s'affiche.** Le conteneur `discover-deck` est en `flex: 1` sans hauteur minimale. À 320 x 568 avec la bannière « Réservé aux abonnés Premium », la carte tombe à une tranche d'environ 50 px : le nom disparaît, la pastille « On verra bien » est coupée. En 200 % simulé (390 pt) la carte mesure 2 px et les boutons du bas passent sous la barre d'onglets. Valable pour toute bannière au-dessus de la carte (erreur, hors ligne). Captures : `final-discover-banniere-clair-320.png`, `final-discover-banniere-clair-200pct.png`. Piste : `mobile/src/features/discover/DiscoverScreen.tsx` (zone `discover-deck`, autour de la ligne 201), `mobile/src/features/discover/SwipeCard.tsx`.

### P2

**DEF-4. Fondu de la carte en bandes visibles.** Le fondu prune est fait de 10 bandes semi-transparentes ; à 390 pt les marches se voient nettement sous l'illustration (surtout sur un fond uni). Sur une vraie photo, l'effet sera moins marqué mais reste probable sur les ciels et les murs unis. Capture : `final-discover-clair-390.png`. Piste : `mobile/src/features/discover/Scrim.tsx` (`SCRIM_BANDS = 10`).

**DEF-5. Titres `h1` coupés en milieu de mot avec le texte très grand.** À 200 % simulé, même à 390 pt : « Paramètre / s » (Réglages), « Abonneme / nt Premium », « Modifier mon profil » sur 3 lignes. La limite connue (05-suivi, 320 pt) existe donc aussi à 390 pt. Le titre n'a pas de plafond d'agrandissement. À confirmer en natif (simulation sans plafonds). Captures : `final-settings-clair-200pct.png`, `final-premium-clair-200pct.png`. Piste : variante `title` de `mobile/src/ui/Text.tsx` (ajouter un plafond ou `adjustsFontSizeToFit`).

**DEF-6. Bouton « … » : deux styles.** Fiche de profil : bouton rond cerclé (`variant="tonal"`, `mobile/src/features/discover/ProfileDetailScreen.tsx:151`). Conversation : points nus, sans fond (`mobile/src/features/messages/ConversationScreen.tsx:263`, variante par défaut). Même icône, même rôle, deux apparences. Captures : `final-profile-detail-clair-390.png`, `final-conversation-clair-390.png`.

**DEF-7. Libellé « Genre » plus léger que les autres libellés de champ (édition du profil).** « Prénom ou pseudo », « Présentation », « Pays de résidence » sont en semi-gras ; « Genre » (`<Text variant="label">`) est en graisse moyenne. Capture : `final-profile-edit-clair-390.png`. Piste : `mobile/src/features/profile/ProfileEditScreen.tsx:168` face au libellé de `mobile/src/ui/TextField.tsx`.

**DEF-8. Boutons lien décalés de la gouttière.** « Fermer la session » (sessions) commence à x = 57 pour un texte de carte à 41 ; « Conditions d'utilisation » et « Politique de confidentialité » (pied du Premium) à x = 48 pour une gouttière de 24. Le remplissage interne des boutons `ghost` décale le texte sans que la mise en page le compense. Captures : `final-sessions-clair-390.png`, `final-premium-clair-390.png`. Piste : `mobile/src/ui/Button.tsx` (variante `ghost`), pieds de page concernés.

**DEF-9. Bannière « Premium » : avertissement et phrase tautologique.** Le message « Réservé aux abonnés Premium. Cette action fait partie de l'abonnement Premium. » répète la même chose deux fois, et une incitation commerciale s'affiche avec l'icône d'avertissement ambrée. Capture : `final-discover-banniere-clair-390.png`. Piste : clé i18n du verrou Premium dans `mobile/src/i18n/areas/discover.*.ts` et variante de `Banner` utilisée par `DiscoverScreen.tsx`.

**DEF-10. Interrupteurs actifs : pouce vert sarcelle (web).** Piste de rendu : `SwitchRow` ne passe que `thumbColor={colors.surface}` ; sur le web de React Native la couleur du pouce actif vient de `activeThumbColor` (défaut `#009688`, mesuré `rgb(0, 150, 136)`) : pouce sarcelle sur piste magenta, hors palette. Probablement sans effet en natif (non vérifié). Captures : `final-notifications-clair-390.png`, `final-privacy-clair-390.png`. Piste : `mobile/src/ui/SwitchRow.tsx:78-79`.

**DEF-11. Formulaires à 320 x 568 : le pied de page occupe 38 % de l'écran.** Sur la connexion, bouton + « Mot de passe oublié ? » + « Créer un compte » prennent 215 px sur 568 : le champ mot de passe est coupé sans clavier ouvert (la zone défile, mais avec le clavier il ne resterait presque rien). Même cause à 200 % simulé (40 %). Capture : `final-login-clair-320.png`. Piste : `mobile/src/ui/ScreenContainer.tsx` (pied de page), contenu du pied de `mobile/src/features/auth/`.

**DEF-12. États vides sans repère visuel.** « Personnes bloquées » : deux lignes de texte centrées, sans icône ni illustration, au milieu d'une page vide. « Aide et assistance » : « Aucune demande pour le moment. » est plus grand et plus gras que le titre de section « Vos demandes » (limite déjà notée, `EmptyState` en `h2`). Captures : `final-blocked-clair-390.png`, `final-support-clair-390.png`.

### P3

**DEF-13. Barre d'accent des bannières effilée aux coins.** La bordure gauche épaisse avec un coin arrondi se rétrécit en pointe aux angles (visible sur Crédits, vérification, sessions). Capture : `final-credits-clair-390.png`. Piste : `mobile/src/ui/Banner.tsx`.

**DEF-14. Fiche de profil sur le web : la photo dépasse la colonne de la largeur de la barre de défilement.** La photo (342 pt = 390 - 48) ignore la barre de défilement de 15 px alors que la carte « À propos » s'arrête à 351. Sans effet en natif (pas de barre). Capture : `final-profile-detail-bas-clair-390.png`.

**DEF-15. Onglet profil : « Vérifier mon profil » proposé à un profil déjà vérifié.** Le badge « Profil vérifié » et la ligne « Vérifier mon profil » coexistent ; l'écran suivant dit « Votre profil est déjà vérifié ». Capture : `final-profile-tab-clair-390.png`.

**DEF-16. Avertissement navigateur `aria-hidden` avec focus conservé.** Ouvrir une conversation depuis la liste (ou revenir) laisse le focus sur un bouton d'un écran masqué par `aria-hidden` (2 occurrences). Vient de l'empilement web de la navigation ; sans effet en natif. À surveiller pour la version web.

Notes de détail non classées en défaut : « Annuler mon dernier choix » passe sur 2 lignes à 390 pt et sur 4 lignes à 200 % simulé ; le toast est à 16 pt des bords contre 24 pt de gouttière de page ; la ligne « Appels » reste dans Notifications alors que les appels sont masqués (à confirmer côté produit).

## 4. Ce qui n'a pas pu être vérifié

- **Vraies photos** : seules des illustrations SVG unies avec une initiale (texte « Aperçu - photo fictive N » parfois visible en filigrane sous le fondu, c'est un artefact de l'aperçu). Lisibilité du texte sur photo claire ou chargée, carrousel de plusieurs photos, chargement d'image : non vus.
- **Match** : écran atteint par URL avec des paramètres choisis, pas par une vraie affinité réciproque.
- **Texte à 200 %** : simulation CSS uniquement (voir section 1) ; plafonds d'agrandissement, bascules en colonne (`isLarge`, `isXL`) et pied de page défilant non exercés. Texte des champs de saisie non agrandi.
- **Natif** : barre d'état, zones de sécurité, clavier (Android et iOS), gestes de balayage des cartes (seuls les boutons ont été utilisés), retours haptiques, lecteurs d'écran (VoiceOver, TalkBack), `usePreventRemove` de l'édition du profil, retour du focus après le panneau des sessions.
- **Écrans non vus** : inscription (compte, consentements, âge refusé), onboarding (intention, photos, préférences, profil, confirmation d'e-mail), signalement, détail des menus « … », mentions légales, nouveau mot de passe, contestation, suppression et export, préférences de rencontre, appels, paiement réel et état Premium, états d'erreur plein écran. Les routes de réglages ont été ouvertes sans erreur de console, sans être regardées. Mode sombre non capturé pour les écrans autres que ceux du tableau.
- **Survol, clavier complet, tactile** : pas de survol testé ; clavier seulement sur l'accueil (Tab) ; l'émulation n'est pas tactile.
- **Temps réel, push, achats, appels** : désactivés par l'environnement d'aperçu (bandeau « Mises à jour automatiques indisponibles » visible dans la conversation).

## 5. Nettoyage

Expo (port 8089, PID 31540 et enfants) arrêté, puis `scripts/dev-preview.ps1 -Stop` (API, serveur de photos, PostgreSQL 54350, base jetable supprimée). Ports 8000, 8001, 8089, 54350 fermés (vérifié par connexion TCP). Le port 54330 (tests) n'a pas été touché : il était déjà fermé au départ. `mobile/tsconfig.json` reste modifié par Expo (comme annoncé). Aucun commit.

## 6. Suivi des correctifs

Corrigés après ce rapport (vérifiés par tests : Jest 797 réussis, `tsc` et `eslint` sans erreur, `tokens:check` à jour) :

- **DEF-01 (P1)** : l'anneau de focus du bouton principal de l'accueil est blanc (`tone="onBrand"`), comme celui du bouton secondaire. Test : `publicScreens.test.tsx`.
- **DEF-02 (P1)** : le pied de page défile aussi sur écran court (hauteur inférieure à 640 pt), pas seulement avec un texte agrandi (`footerScrolls` dans `ScreenContainer`, repris par `OnboardingFrame`). Sur 320 x 568, les liens légaux de Premium sont atteignables en faisant défiler le pied de page. Test : `publicScreens.test.tsx`.
- **DEF-03 (P1)** : la pile de cartes garde une hauteur minimale de 200 pt avec une bannière ; sur écran court ou texte agrandi, la rangée « Annuler / Signaler » s'efface tant que la bannière est ouverte et revient à sa fermeture. Tests : `discover.test.tsx`.
- **DEF-04 (P2)** : le fondu des cartes passe de 10 à 20 bandes (opacité 0,2 par bande ; le contrat de lisibilité 0,65 à 80 % de hauteur reste testé).
- **DEF-06 (P2)** : le bouton « … » de la conversation reprend le style tonal de la fiche de profil.
- **DEF-07 (P2)** : le libellé « Genre » passe en `labelStrong`, comme les autres libellés de champ.
- **DEF-09 (P2)** : la bannière « Premium requis » n'affiche plus deux phrases qui se répètent et passe en variante d'information (icône neutre) ; la bannière de quota reste un avertissement.

Non corrigés, avec la raison :

- **DEF-05** (titres coupés en milieu de mot à 200 % simulé) : artefact probable de la simulation CSS (doublement de la taille sans le plafond `maxFontSizeMultiplier` natif) ; à confirmer sur appareil.
- **DEF-08** (boutons fantômes en retrait de la gouttière) : le retrait fait partie de la zone de toucher du bouton en pastille ; à trancher avec le design.
- **DEF-10** (pouce du commutateur sarcelle sur le web) : `activeThumbColor` n'existe que sur le web et n'est pas dans les types React Native ; le rendu natif utilise `thumbColor`.
- **DEF-11** (connexion 320 x 568 : champ du mot de passe coupé sans clavier) : l'écran défile ; non traité.
- **DEF-12** (états vides sobres), **DEF-13** à **DEF-16** (P3) et les notes de détail : non traités.
