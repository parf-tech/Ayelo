# Revue design 1 : application mobile, panneau d'administration, pages publiques

Date : 2026-11-07. Périmètre : `mobile/src` (thème, composants `ui/`, écrans `features/`, i18n fr/en), `mobile/app.json`, panneau Filament (`backend/app/Filament`, `backend/app/Providers/AdminPanelProvider.php`), pages et e-mails web (`backend/resources/views`, `docs/legal`). Revue en lecture seule, sans exécution sur appareil : tout ce qui touche au rendu natif (VoiceOver, TalkBack, Dynamic Type, polices système) est une déduction du code et doit être confirmé sur un iPhone, un Android et un petit téléphone avant de clore le point.

Légende : P0 = bloquant pour la revue des boutiques ou pour l'accessibilité de base ; P1 = à corriger avant la bêta publique ; P2 = amélioration planifiable. Les chemins sont relatifs à la racine du dépôt.

## 1. Synthèse

Le socle est sain. Les jetons de couleur sont centralisés et testés (`mobile/__tests__/theme.test.ts` vérifie 4,5:1 sur 13 paires et interdit les couleurs en dur), les composants `ui/` portent déjà rôle, état et libellé d'accessibilité, les états chargement, erreur et vide passent par `AsyncView`, le mode sombre est complet, la cible tactile minimale de 44 pt est une constante appliquée partout, et le flux de signalement, de blocage, de vérification et de confidentialité existe de bout en bout. Le panneau d'administration est plus mûr que la moyenne (selfie masqué derrière un clic journalisé, téléphone et score de risque retirés de la requête pour le support, motif obligatoire sur les sanctions).

Les écarts sérieux sont de quatre sortes. Premièrement, les pages web publiques exigées par les boutiques n'existent pas (`backend/routes/web.php` : « Aucune route web publique »), alors que les textes juridiques sont des brouillons à trous et que l'écran Premium désactive les liens CGU et confidentialité tant que les variables d'environnement manquent. Deuxièmement, un défaut de composant (`ListRow` non cliquable qui regroupe ses enfants pour les lecteurs d'écran) rend inaccessibles sous VoiceOver les boutons Acheter, Débloquer et Fermer la session. Troisièmement, les bordures des champs et l'état « éteint » des interrupteurs sont presque invisibles (contraste 1,2:1 à 1,3:1 en clair), car le test de contraste ne couvre que le texte. Quatrièmement, le parcours d'abonnement respecte l'esprit des règles Apple et Google (renouvellement automatique mentionné, résiliation expliquée, restauration présente) mais pas la lettre : prix, durée et renouvellement ne sont pas groupés près du bouton, le chemin de résiliation dépend d'un appel réseau, et des messages techniques destinés aux développeurs s'affichent à l'utilisateur.

## 2. Dix constats principaux

1. P0. Aucune page web publique (CGU, confidentialité, règles, suppression de compte, support) ; textes juridiques en brouillon avec crochets ; l'écran Premium désactive les liens si l'URL est absente.
2. P0. `ListRow` sans `onPress` est un groupe accessible : les boutons Acheter (Crédits), Débloquer (Bloqués) et Fermer la session (Sessions) sont inatteignables sous VoiceOver.
3. P0. Contraste non textuel : bordure des champs 1,20:1, interrupteur éteint 1,31:1 (clair), 1,58:1 (sombre) ; WCAG 1.4.11 demande 3:1.
4. P0. Paywall : renouvellement en légende 13 pt grisée, séparée du bouton ; aucun montant ni période dans le bouton ; liens CGU et confidentialité potentiellement morts ; textes de développeur (RevenueCat, Expo Go) montrés à l'utilisateur.
5. P1. « Gérer mon abonnement » n'apparaît que si l'appel de statut réussit et que Premium est actif ; un Premium offert par l'équipe mène à une page de boutique vide.
6. P1. Suppression de compte : déconnexion immédiate qui efface la confirmation et le délai de grâce, aucune mention de l'abonnement à résilier, aucune dernière confirmation.
7. P1. Consentements et CGU acceptés sans lien vers les textes ; l'âge est demandé après les consentements de données sensibles.
8. P1. Signaler et bloquer demandent quatre touches depuis la pile de découverte ; aucun accès depuis la carte.
9. P1. Pas de thème de navigation : flash blanc entre écrans en mode sombre ; pas d'écran de démarrage ; icônes en caractères Unicode (rendu emoji possible).
10. P1. Back-office : états affichés en valeurs brutes (`open`, `active`), file de signalements sans contexte ni délai visible, aperçu média en deux clics et un nouvel onglet, confirmation sur « Approuver » (action fréquente) mais pas sur « Rejeter » (destructive).

## 3. Constats P0

### P0-1. Pages web publiques absentes, textes légaux non publiables

Preuves. `backend/routes/web.php` ne déclare aucune route. `backend/resources/views/welcome.blade.php` est le gabarit Laravel par défaut (82 Ko, charge `fonts.bunny.net`), non routé. `docs/release/01-checklist-stores.md:29-31` note la page de suppression comme « à publier ». `docs/legal/*.md` portent « BROUILLON » et des champs `[Nom]`, `[Dénomination de la société…]` (`01-conditions-utilisation.md:6,8`). `mobile/src/features/legal/links.ts:21-24` lit `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_COMMUNITY_RULES_URL` et retourne `null` sinon. Les conditions (§8) promettent une suppression « sur [page web] » qui n'existe pas. Apple exige une URL de politique de confidentialité et de conditions fonctionnelle (guideline 3.1.2 pour les abonnements, 5.1.1) ; Google Play exige une URL web de demande de suppression de compte dans la fiche et la section Sécurité des données.

Correctif. Publier cinq pages statiques servies par Caddy (`infra/caddy/Caddyfile`), sans Laravel : `/legal/terms`, `/legal/privacy`, `/legal/community`, `/account/delete`, `/support`. Chaque page est bilingue (sélecteur de langue en haut, `lang` correct, `hreflang`), utilise les mêmes jetons que l'application (voir 8.3), tient sur un seul fichier HTML sans script, et respecte `prefers-color-scheme`. La page `/account/delete` explique les deux voies (dans l'application, ou par e-mail de demande avec lien de confirmation valable une heure, comme `backend/lang/fr/mail.php`), annonce le délai de 30 jours, ce qui est conservé (signalements, sanctions) et rappelle qu'un abonnement se résilie séparément dans la boutique. Ajouter une vérification de build qui échoue si les trois variables `EXPO_PUBLIC_*_URL` sont absentes en profil production, afin que l'état « Lien non configuré » ne puisse jamais partir en boutique. Faire valider les textes par le juriste avant publication et retirer le mot « brouillon » seulement à ce moment.

Écart connexe : `docs/legal/03-regles-communaute.md` affirme « 3 touches » pour signaler depuis un profil ; depuis la pile de découverte il en faut quatre (constat P1-4).

### P0-2. `ListRow` regroupe ses enfants interactifs

Preuves. `mobile/src/ui/ListRow.tsx:67-77` : sans `onPress`, la ligne est rendue dans une `View accessible`. Sur iOS, un élément `accessible` est une feuille pour VoiceOver : les enfants ne sont plus focalisables. Or trois écrans y placent un bouton dans `trailing` : `mobile/src/features/premium/CreditsScreen.tsx:58-67` (Acheter), `mobile/src/features/settings/BlockedScreen.tsx:56-65` (Débloquer), `mobile/src/features/settings/SessionsScreen.tsx:88` (Fermer la session). Un utilisateur de VoiceOver ne peut donc ni acheter de crédits, ni débloquer quelqu'un, ni fermer une session. Sous TalkBack le comportement est plus tolérant mais le focus reste ambigu.

Correctif. Dans `ListRow`, rendre la `View` non cliquable avec `accessible={false}` lorsque `trailing` contient un contrôle (ajouter une prop `trailingInteractive?: boolean`, ou plus simplement ne poser `accessible` que si `accessibilityLabel` est fourni et qu'il n'y a pas de `trailing`). Pour les lignes qui doivent se lire d'un bloc puis exposer leur bouton, utiliser `accessibilityElementsHidden` sur le texte seul et laisser le bouton porter le libellé complet (« Acheter 50 crédits, 9,99 € »). Ajouter un test de rendu qui vérifie qu'aucun `Button` n'a un ancêtre `accessible`.

### P0-3. Contraste des composants (WCAG 1.4.11)

Calcul sur les jetons de `mobile/src/theme/tokens.ts` (ratio de luminance WCAG 2.x) :

- Clair : `border` #E4E0DC sur `bg` #FFFFFF = 1,31:1 ; sur `surface` #F6F4F2 = 1,20:1. Sombre : #3A3633 sur #121110 = 1,58:1 ; sur #1E1C1A = 1,42:1.
- `TextField` (`mobile/src/ui/TextField.tsx:46,61`) dessine son contour avec `border` sur fond `surface` : le champ de saisie est quasi invisible hors focus. Même défaut pour `Chip` non sélectionné, `ChoiceCard` non sélectionnée, `ScreenContainer` pied de page, `DateSelector`.
- `SwitchRow` (`mobile/src/ui/SwitchRow.tsx:48-49`) : piste éteinte = `border`, pastille = `surface`. L'état éteint des réglages de confidentialité se distingue à peine de l'état actif sous faible luminosité, et seule la couleur porte l'information.
- `like` #16A34A sur blanc = 3,30:1 (suffisant pour une bordure, insuffisant pour du texte ; ne jamais l'utiliser comme `tone` de texte) ; sur `surface` = 3,00:1, à la limite.
- Les paires texte du test existant passent toutes : `text` 17,4:1, `textMuted` 6,8:1 (6,2:1 sur surface), `primary` sur blanc 5,18:1 (4,72:1 sur surface), `danger` 6,47:1, `warning` 5,02:1, `success` 5,02:1, `onPrimary` sur `primary` 5,18:1 ; sombre : `primary` 8,3:1, `textMuted` 7,5:1, `disabledText` 4,74:1.

Correctif. Ajouter un jeton `borderStrong` pour tout contour de composant, et garder `border` pour les séparateurs décoratifs. Valeurs vérifiées : clair #85807B (3,91:1 sur blanc, 3,56:1 sur surface), sombre #7F7973 (4,39:1 sur bg, 3,95:1 sur surface). Remplacer `colors.border` par `colors.borderStrong` dans `TextField`, `Chip`, `ChoiceCard`, `CheckboxField` (cadre), `DateSelector`, `SwitchRow` (`trackColor.false`), le contour des champs de saisie du chat (`ConversationScreen.tsx:210`). Pour l'interrupteur, ajouter en plus une marque redondante : le libellé d'état (« Activé » / « Désactivé ») dans `accessibilityValue` et, visuellement, la pastille en `bg` avec contour. Étendre `theme.test.ts` avec les paires non textuelles à 3:1 (`borderStrong` sur `bg` et sur `surface`, `like` et `dislike` sur `bg`).

### P0-4. Parcours Premium : conformité Apple 3.1.2 et Google, et fuites de texte technique

Ce qui est bien fait. Prix issus du store (`PremiumScreen.tsx:32`), mention du renouvellement automatique (`premium.renewal`), bouton Restaurer (`:123`), explication de la résiliation (`premium.manage.info`), confirmation d'achat attendue du serveur (`PurchaseResultScreen.tsx:28-31`), absence de simulation d'achat.

Écarts.

- Hiérarchie. Le renouvellement est une légende de 13 pt en `textMuted` (`PremiumScreen.tsx:104-106`), placée sous les cartes et sous deux boutons fantômes, alors que le bouton d'achat est fixé en pied d'écran (`:46-54`). Apple demande que durée, prix et renouvellement soient clairs et visibles, et non relégués ; le bouton ne rappelle ni montant ni période. Spécification : dans le pied d'écran, au-dessus du bouton, une ligne de 15 pt non grisée « 12 mois, 59,99 €. Renouvellement automatique jusqu'à résiliation. » reconstruite avec la carte sélectionnée ; bouton « S'abonner, 59,99 € » ; sous le bouton, la légende complète à 13 pt avec liens CGU et confidentialité cliquables dans le texte. Le montant par mois (« soit 5,00 € par mois ») s'affiche en second sur les cartes de 3 et 12 mois si le store fournit les valeurs numériques.
- Aucune carte présélectionnée (`:21`, `:99-103`) : le bouton principal reste grisé à l'ouverture. Présélectionner l'offre la plus longue ou celle recommandée par le serveur, avec un badge textuel « Meilleur prix » (pas seulement une couleur).
- Liens légaux. `:107-122` rend « Conditions d'utilisation (Lien non configuré) » en bouton désactivé si l'URL manque. Avec P0-1, c'est un motif de rejet. Les deux boutons fantômes ont aussi un padding horizontal de 24 pt qui les décale du bord de contenu.
- Messages de développeur montrés à l'utilisateur : `premium.unavailable.expo_go`, `.missing_key` (« clé RevenueCat absente »), `.not_installed` (`mobile/src/i18n/areas/premium.fr.ts:26-31`), `error.config` qui cite `EXPO_PUBLIC_API_URL` (`mobile/src/i18n/fr.ts:105`), `welcome.demo` et les clés `home.*`, `demo.*` toujours dans le bundle. Remplacer, en production, par un seul message : « Les achats sont momentanément indisponibles. Réessayez plus tard. » et garder le détail dans les journaux ; supprimer les clés mortes.
- Double souscription. Quand Premium est actif, le bouton S'abonner reste actif en pied d'écran (`:46-54`). Le masquer ou le remplacer par « Changer d'offre » via la gestion en boutique.
- Texte `premium.purchaseError` (« Vous n'avez pas été débité si l'écran de paiement ne s'est pas terminé ») est une double négation difficile. Proposition : « L'achat n'a pas abouti. Si le paiement a été effectué, il sera pris en compte dans quelques minutes ; sinon, aucun montant n'est prélevé. »
- Sous-titre `premium.subtitle` : « Likes illimités, coups de cœur, retour en arrière et conversations sans crédit » mélange anglicisme et termes de l'interface (le bouton s'appelle « J'aime », la bannière « Limite de likes atteinte » : `discover.quota.title`). Choisir « J'aime » partout (voir 6.3).

## 4. Constats P1

### P1-1. Chemin de résiliation fiable (« Gérer mon abonnement »)

Preuves. `SettingsScreen.tsx:29-31` n'affiche la ligne que si `billing.status()` réussit et renvoie `premium === true` ; une erreur réseau la masque en silence (commentaire ligne 29). `PremiumScreen.tsx:82-86` la place dans la branche `status?.premium`. `ManageSubscription.tsx` choisit la boutique d'après `store` ou la plateforme. Un Premium accordé par l'équipe (action « Offrir le Premium », `MemberResource`/`ViewMember`) n'a pas de boutique : le lien ouvre la page d'abonnements de l'appareil, sans rien dedans.

Correctif. (a) Toujours afficher une ligne « Gérer mon abonnement » dans Réglages, section Compte, indépendante de l'état réseau ; si le statut est inconnu, elle ouvre quand même la page de la boutique de la plateforme. (b) Si `subscription.store` indique un octroi interne, remplacer le lien par un texte « Premium offert jusqu'au {date}. Rien à résilier. ». (c) Sur l'écran Premium, ajouter la même entrée sous le bandeau « Premium actif jusqu'au… », et en ouverture de la section Crédits un rappel court. (d) Libellé : « Gérer mon abonnement » en premier, « résilier » dans la description (« Résiliation dans l'App Store ou Google Play, prise en compte à la fin de la période payée »). Le titre actuel « Gérer ou résilier mon abonnement » (32 caractères) est tronqué par `numberOfLines={1}` dans `ListRow.tsx:45` sur un petit écran.

### P1-2. Suppression de compte

Preuves. `DeleteAccountScreen.tsx:36-37` appelle `signOut()` juste après avoir posé le bandeau de succès et le délai de grâce (`:35-36`, `:61-64`) : la garde d'authentification démonte l'écran, l'utilisateur ne voit jamais « supprimé dans N jours ». Le texte `delete.warning` (« définitive après un délai de réflexion ») ne dit ni la durée ni comment annuler. Aucune dernière confirmation (la saisie du mot de passe fait office) ni mention de l'abonnement actif, alors que les CGU (§7) précisent que supprimer le compte ne le résilie pas. Pour un compte social, l'écran renvoie au support (`:40`), ce qui est une impasse si un jour la connexion Google ou Apple est ajoutée (la coche Apple « révocation des jetons » est ouverte dans la checklist).

Correctif. Écran de fin avant déconnexion : « Demande enregistrée. Votre profil est masqué. Suppression définitive le {date}. Pour annuler, reconnectez-vous avant cette date. » (à confirmer côté backend que la reconnexion annule bien), bouton unique « Me déconnecter ». Si Premium est actif, afficher avant le champ mot de passe un encadré « Votre abonnement continue d'être facturé tant que vous ne le résiliez pas dans la boutique » avec le lien `ManageSubscription`. Reformuler l'avertissement : « Votre profil, vos photos et vos conversations seront supprimés au bout de 30 jours. Ils sont masqués dès maintenant. » Ajouter un libellé de bouton explicite (« Supprimer mon compte ») plutôt que « Supprimer définitivement » qui n'est pas exact pendant la période de grâce.

### P1-3. Consentements, textes légaux et ordre du parcours d'inscription

Preuves. `ConsentsScreen.tsx:58-89` : quatre cases, sans lien vers les CGU ni la politique, alors que la case dit « J'ai pris connaissance de la politique de confidentialité » (`mobile/src/i18n/fr.ts:consents.privacy.label`). L'accueil (`WelcomeScreen.tsx`) n'en contient pas non plus. L'ordre actuel est Accueil, Consentements (dont données sensibles), Date de naissance, Compte : les consentements de traitement de données sensibles sont recueillis avant le contrôle d'âge.

Correctif. Dans chaque description de case, un lien texte souligné « Lire les conditions » / « Lire la politique » ouvrant la page web (P0-1), de 44 pt de hauteur. Déplacer la date de naissance en premier (écran neutre : « Quelle est votre date de naissance ? »), puis les consentements ; un refus d'âge ne collecte alors aucun consentement ni donnée. Sur `AgeRefusedScreen`, le texte « pour le moment » (`ageRefused.body`) suggère de réessayer avec une autre date ; préférer « Nous ne pouvons pas créer de compte avec ces informations. » (sans promesse de nouvel essai).

### P1-4. Découvrabilité du signalement et du blocage

Preuves. Dans la pile (`DiscoverScreen.tsx`, `SwipeCard.tsx`), aucun contrôle de sécurité : il faut toucher la carte, puis le bouton « ⋯ » (`ProfileDetailScreen.tsx:129-139`), puis « Signaler », puis un motif : quatre touches. Depuis la conversation, c'est trois touches (`ConversationScreen.tsx:244,266`). Le signalement envoie dès le toucher du motif, sans écran de confirmation (`ReportScreen.tsx:71-82`) ; le champ « Détails » est placé au-dessus des motifs, ce qui est inhabituel et facile à manquer. Les motifs sont de longs boutons secondaires pleine largeur (six cibles de 48 pt), lisibles mais lourds.

Correctif. Ajouter un bouton discret « ⋯ » (icône, 44 par 44) en haut à droite de la carte de découverte, ouvrant la même feuille (Signaler, Bloquer). Dans `ReportScreen`, utiliser des cartes radio (`ChoiceCard`) puis un bouton d'envoi « Envoyer le signalement », détails en dessous ; conserver l'envoi en un geste seulement pour `minor_suspected` si la politique le demande. Afficher après envoi un panneau « Merci. Voulez-vous aussi bloquer cette personne ? » avec un bouton Bloquer. Pour la conversation, proposer le signalement d'un message précis (appui long, déjà utilisé pour supprimer) : l'API accepte `context_type: 'message'` (`ReportScreen.tsx:12`) mais aucun écran ne l'utilise.

### P1-5. Accessibilité des écrans clés

- Carte de découverte (`SwipeCard.tsx:70-71`) : le libellé dit « Utilisez les boutons pour aimer ou passer » (`discover.card`) tandis que l'indice dit « Glissez la carte vers la droite » (`discover.swipeHint`) : deux consignes contradictoires, la seconde inutilisable avec VoiceOver. Le libellé n'inclut ni l'intention de recherche ni le badge vérifié, que les voyants lisent. Proposition : libellé « {nom}, {âge} ans, {ville}. {intention}. Profil vérifié. » ; indice « Actions disponibles : aimer, passer, coup de cœur, voir le profil. » ; ajouter une action « Signaler ou bloquer » aux `accessibilityActions`.
- Chronomètre d'appel (`CallScreen.tsx:122`) : `accessibilityLiveRegion="polite"` sur un texte qui change chaque seconde. Les lecteurs d'écran annoncent la durée en continu. Retirer la région vivante sur la durée (garder l'annonce lors des changements d'état : sonnerie, connecté, terminé).
- Boutons Couper le micro, Caméra, Haut-parleur (`CallScreen.tsx:88-92`) : `onPress={() => undefined}`. Quand les médias sont disponibles, ils sont actifs et ne font rien. Les désactiver ou les masquer tant qu'ils ne sont pas câblés, et leur ajouter `accessibilityState={{ selected }}`.
- Sélecteur de date de naissance (`DateSelector.tsx`) : trois colonnes défilantes de 31, 12 et environ 80 boutons radio, hauteur de ligne fixe 44 pt (`:20`). Un utilisateur de lecteur d'écran doit parcourir jusqu'à 120 éléments ; à Dynamic Type 200 % les libellés sont rognés. Offrir en alternative trois champs numériques JJ / MM / AAAA (`keyboardType="number-pad"`, `autoComplete="birthdate-day"` etc.) et ne garder les colonnes que comme assistance visuelle, ou utiliser le sélecteur natif `@react-native-community/datetimepicker` (module natif, hors Expo Go, à arbitrer).
- Interrupteur (`SwitchRow.tsx`) : seule la bascule (51 par 31 pt sur iOS) est tactile ; la ligne de 56 pt n'est pas cliquable. Envelopper la ligne dans un `Pressable` qui inverse la valeur, et exposer la description via `accessibilityHint`.
- Toast (`Toast.tsx:20,39`) : 4 s fixes, y compris avec un bouton d'action (« Voir » le nouveau match, `AppShell.tsx:92-99`). Il disparaît avant qu'un lecteur d'écran l'ait lu. Porter la durée à 8 s quand une action existe, et ne jamais l'auto-fermer si l'accessibilité vocale est active (`AccessibilityInfo.isScreenReaderEnabled`). Il est positionné à `insets.bottom + 16` (`:57`) et recouvre donc la barre d'onglets et les boutons de pied d'écran (S'abonner, Continuer) pendant son affichage ; le remonter de la hauteur de la barre d'onglets ou le placer en haut.
- Message de match : `MatchScreen` est une nouvelle page, mais le titre « C'est un match ! » n'est pas annoncé de façon dédiée ; utiliser `AccessibilityInfo.announceForAccessibility` à l'ouverture.
- Mouvement réduit : seul `Skeleton.tsx:13-33` consulte `isReduceMotionEnabled`. L'animation de sortie de carte (`SwipeCard.tsx`, 180 ms) et les transitions `slide_from_right` (`AreaLayout.tsx`) doivent aussi respecter le réglage (durée nulle ou fondu).

### P1-6. Thème, navigation et démarrage

- Aucun thème de navigation : `grep` ne trouve ni `ThemeProvider` de `@react-navigation/native` ni `sceneStyle`. `Tabs` et `Stack` utilisent donc le thème clair par défaut ; en mode sombre, les transitions et le fond des scènes laissent apparaître du gris clair avant que `ScreenContainer` peigne `bg`. Correctif : dans `MainTabs.tsx` et `AreaLayout.tsx`, passer `sceneStyle` / `contentStyle: { backgroundColor: colors.bg }` et envelopper l'arbre dans un `ThemeProvider` de React Navigation construit depuis nos jetons.
- `app.json` n'a ni écran de démarrage configuré (seul `assets/splash-icon.png` existe) ni fond sombre : flash blanc au lancement en mode sombre. Ajouter le plugin `expo-splash-screen` avec `backgroundColor` clair et `dark.backgroundColor` #121110. Le fond d'icône adaptative Android est codé en dur (#C2410C, `app.json`) : acceptable, mais il doit suivre la marque quand elle sera définie.
- `app.json` : `"orientation": "portrait"` avec `"supportsTablet": true`. Apple valide les applications iPad exigeant le plein écran ou toutes les orientations ; vérifier le message de validation d'App Store Connect et, si nécessaire, passer `ios.requireFullScreen: true` ou autoriser les orientations. Aucun `bundleIdentifier` ni `package` : à fixer avant la première soumission.
- Icônes : onglets et actions utilisent des caractères Unicode (`MainTabs.tsx:37,47,55` pour ♥ ✉ ☺ ; `ConversationScreen.tsx:231,238` pour ☎ et ▶ ; ✕ ★ ♥ ⋯ ‹ › ailleurs). ✉ et ▶ ont une forme emoji sur iOS et Android qui ignore `color` et change selon la police ; ▶ pour un appel vidéo se lit comme « lecture ». Remplacer par `@expo/vector-icons` (Ionicons, déjà dans Expo) derrière un composant `Icon` et un `IconButton` 44 par 44 (voir 8.2).
- Navigation : le bouton « Retour » est un bouton fantôme de 48 pt avec 24 pt de padding horizontal (`Button.tsx`), donc son texte est décalé de 24 pt vers l'intérieur par rapport au bord du contenu (`ScreenHeader.tsx`, `BackButton.tsx`). Aligner avec une marge négative de `space[5]` ou créer `IconButton` de retour (chevron).

### P1-7. Petits écrans, grande police, tablette

- `DiscoverScreen.tsx:129` n'est pas défilant : titre, filtres, pile, trois boutons et « Annuler mon dernier choix » se partagent la hauteur. Sur un écran de 568 pt de haut, la carte (positionnée en absolu, `flex: 1`) descend à environ 250 pt, et à police agrandie elle peut disparaître. Correctifs : passer « Annuler » en icône dans la rangée d'actions (`undo` à gauche, quatre actions de 44 pt), imposer `minHeight: 320` à la pile avec défilement de l'écran en dessous de ce seuil.
- En-tête de conversation (`ConversationScreen.tsx:220-245`) : Retour (≈100 pt), avatar 36, titre, jusqu'à trois boutons de ≈68 pt chacun. Sur 320 pt de large le titre est réduit à rien. Passer à des `IconButton` 44 pt et placer Retour en chevron.
- `ListRow.tsx:45` fixe `numberOfLines={1}` sur le libellé : « Sanctions et contestations », « Gérer ou résilier mon abonnement » sont tronqués en français sur petit écran ou grande police. Autoriser 2 lignes. `Button.tsx:83` limite aussi à 2 lignes ; vérifier « Envoyer la contestation » et « Voir les offres Premium » à 200 %.
- Pastille de non-lus 24 pt fixe (`MessagesListScreen.tsx:119`) et pastille de bannière 24 pt avec interligne 16 (`Banner.tsx:75-86`) : rognées à grande police. Utiliser `minHeight` et `lineHeight` dérivés du jeton.
- `type.caption` à 13 pt porte du contenu critique : renouvellement d'abonnement, consentements, dates. Relever à 14 pt, ou réserver `caption` aux métadonnées et créer une variante `bodySmall` 14/20 pour le texte juridique.
- Tablette : `MAX_CONTENT_WIDTH = 560` centre bien le contenu ; la barre d'onglets reste pleine largeur (acceptable). Prévoir en P2 une disposition deux colonnes (liste de conversations et conversation) à partir de 900 pt.
- Clavier : `ScreenContainer.tsx:29` utilise `KeyboardAvoidingView` avec `behavior` seulement sur iOS ; Android repose sur `adjustResize` d'Expo (valeur par défaut, à ne pas changer). Les formulaires n'enchaînent pas les champs : aucun `returnKeyType` ni `onSubmitEditing` dans `AuthFormScreen.tsx`. Ajouter `returnKeyType="next"` sur l'e-mail et `"done"` sur le mot de passe avec soumission.

### P1-8. Contenu rassurant et exactitude des promesses

`verify.subtitle` (« prouve que vous êtes bien la personne des photos », `verification.fr.ts`) promet plus que les CGU (§6 : le badge signifie une revue de photo, « pas une garantie d'identité »). Aligner : « Un selfie dans la pose demandée permet à l'équipe de comparer avec vos photos. Le badge indique que cette comparaison a eu lieu ; il ne garantit pas l'identité. » Les poses sont fournies par le serveur en français uniquement (`backend/app/Services/ProfileVerification.php:15`, affichées par `VerificationScreen.tsx` via `data.data?.pose`) : un utilisateur en anglais lit « pouce levé ». Renvoyer un code de pose et le traduire côté application (`verify.pose.thumbs_up`, etc.).

### P1-9. Back-office de modération (Filament)

Points forts à conserver : selfie jamais dans la liste, affichage après clic et journal (`VerificationRequestResource.php`, `ViewVerificationRequest.php:326-332`), URL signée à courte durée, téléphone et score de risque exclus de la requête pour le support (`MemberResource.php:49-62`), e-mail masqué à qui n'a pas le droit (`MediaItemResource.php:50`), motif obligatoire sur sanctions et crédits, confirmation sur Bannir, mention du risque sur « Lever la suspension préventive », idempotence des ajustements de crédits.

Écarts d'ergonomie de file.

- États bruts. `ReportResource.php:53-54` affiche `reported.status` et `status` comme badges sans traduction ni couleur (« open », « active ») ; idem `VerificationRequestResource.php:260`, `SupportTicketResource.php:236`, `AuditEntryResource.php:146` (code d'action brut). Ajouter `formatStateUsing(fn ($s) => __('admin.status.'.$s))` et un `color()` par état, via un petit trait partagé ; sinon un modérateur francophone lit de l'anglais technique et ne distingue pas les états par la couleur.
- File sans contexte. La fiche de signalement (`ReportResource.php:67-87`) montre motif, détails et score de risque, mais ni lien vers le profil et les photos du signalé, ni extrait de la conversation signalée, ni historique des signalements déjà reçus pour ce compte. Ajouter un lien vers la fiche utilisateur, un panneau « Contexte » (dix messages autour du message signalé, lecture journalisée comme le selfie) et le nombre de signalements ouverts sur la même cible, avec regroupement pour traiter les doublons d'un coup.
- Délais invisibles. La doc fixe des délais de 24 h et 2 h ; la colonne « Reçu » n'affiche que `since()` (`ReportResource.php:55`). Ajouter une colonne « Délai » colorée (orange à 75 % du délai, rouge dépassé) et `getNavigationBadgeColor()` rouge s'il existe un signalement critique ouvert. Les tuiles du tableau de bord (`AdminStatsWidget.php:289-308`) doivent pointer vers la file filtrée (`->url(...)`).
- Enchaînement. Après une décision sur la fiche, `ReportActions` redirige vers la liste (`ViewReport.php`). Ajouter « Décider et passer au suivant » qui ouvre le plus ancien signalement du même niveau de priorité. Pas d'attribution ni de verrou : deux modérateurs peuvent ouvrir le même signalement ou média. Reprendre le champ « Attribué à » déjà utilisé pour les tickets (`SupportTicketResource.php:237`) sur signalements et médias, avec action « Prendre ».
- Médias. L'aperçu produit une notification persistante contenant un lien « Ouvrir l'image » dans un nouvel onglet (`MediaItemResource.php:56-70`) : deux clics et un onglet par photo, sans vue d'ensemble. Remplacer par une modale d'aperçu avec l'image (URL signée générée à l'ouverture, journal conservé), précédent/suivant, et boutons Approuver/Rejeter dans la modale. Par défaut, flouter l'image et exiger un clic « Afficher » (protection du modérateur face aux contenus explicites), avec rappel de pause après N éléments.
- Confirmations inversées. `Approuver` demande une confirmation (`MediaItemResource.php:73`) alors que c'est l'action la plus fréquente et la plus réversible en pratique, tandis que `Rejeter` supprime le fichier du stockage (`:78`) et ne demande qu'un motif sans confirmation explicite. Retirer la confirmation d'Approuver (ou l'offrir en action groupée sans confirmation) et ajouter `requiresConfirmation()` à Rejeter avec le texte actuel « Le fichier sera supprimé du stockage. Cette action est irréversible. ». Même logique pour `Suspendre` sur signalement (`ReportActions.php:40-46`) : la modale à formulaire vaut confirmation, mais afficher dans la description le nom du compte et la durée choisie.
- Langue. `StaffLocale.php:13` force `fr`, alors que le commentaire de la classe parle de modération « fr / en » ; la plupart des libellés sont d'ailleurs codés en français (`->label('Priorité')`, etc.) et seuls quelques-uns passent par `__('admin.*')`. Soit assumer un back-office français (supprimer la mention fr/en), soit passer tous les libellés par `lang/*/admin.php`.
- Données personnelles. La liste des utilisateurs affiche l'e-mail complet à tout rôle ayant `USERS_VIEW` (`MemberResource.php:68`) et les e-mails des attributaires. Proposer un masquage dans les listes (`j***@exemple.org`) avec dévoilement par clic journalisé sur la fiche, comme pour le selfie.
- Identité visuelle. `AdminPanelProvider.php:101-102` : indigo et « Ayelo · Administration ». Garder une couleur distincte de l'application est un bon réflexe (on reconnaît l'outil interne), mais ajouter un bandeau d'environnement (production en rouge, préproduction en orange), un `favicon`, et `->unsavedChangesAlerts()` pour les notes de décision. `->globalSearch(false)` (`:103`) empêche de rejoindre un compte par identifiant depuis n'importe quelle page ; réactiver la recherche globale restreinte aux utilisateurs.

### P1-10. E-mails transactionnels

`backend/resources/views/mail/*.blade.php` sont du texte brut sans nom d'application, sans bouton, sans pied de page ni signature (`verify-email.blade.php`, 75 octets, seulement trois lignes). Le sujet « Confirmez votre adresse e-mail » (`lang/fr/mail.php`) n'indique pas l'expéditeur. Créer un gabarit HTML minimal (une colonne de 560 px, bouton principal avec contraste 4,5:1, lien en clair en dessous pour les clients qui bloquent les boutons, alternative texte, mention « Vous n'êtes pas à l'origine de cette demande ? » avec lien support) et choisir la langue d'après `users.locale` plutôt que celle du serveur.

## 5. Constats P2

- Inscription : le parcours d'accueil ne contient aucune marque ni illustration (`WelcomeScreen.tsx`) ; `docs/07-DESIGN-SYSTEM.md:3` indique que palette et nom sont provisoires. Prévoir le remplacement des jetons et d'une illustration d'accueil avant le lancement ; la structure (un seul fichier `tokens.ts`) le permet sans toucher aux écrans.
- Genre : trois valeurs (Homme, Femme, Autre) sans « Préfère ne pas dire » (`gender.*`). À arbitrer avec le produit ; à tout le moins le champ Autre ne doit pas être décisif pour le filtrage.
- Chat : pas d'horodatage ni de séparateurs de date dans les bulles (`ConversationScreen.tsx:121-141`) ; les bulles sont des `Pressable` sans `accessibilityRole` ; l'accusé « Remis » et « Lu » utilisent le même glyphe « ✓✓ » (`:15`), seul le texte les distingue (acceptable car le texte est présent, mais ajouter une couleur de `primary` pour « Lu »). Les pièces jointes ne sont pas prises en charge (`conversation.media.unsupported`) : prévoir le message lorsque l'autre personne envoie une photo.
- Photos : réordonner par « ‹ » et « › » (`PhotosManager.tsx:187-200`) est accessible mais peu découvrable ; ajouter une mention « Première photo = photo principale » et le nombre `photos.count`.
- Statut de photo : texte coloré par `success` ou `warning` ; la mention existe en toutes lettres, bien. Ajouter une explication du délai de modération.
- Écran Profil : quatre boutons pleine largeur de poids visuel équivalent (`ProfileTabScreen.tsx:90-96`). Passer en liste de lignes `ListRow` groupées (Modifier, Vérifier, Premium, Paramètres) avec un seul bouton principal en haut si le profil est incomplet.
- Écran de chargement d'authentification : valeurs 16 et 48 codées en pixels (`AreaLayout.tsx:13`).
- Boîtes de dialogue en ligne : `accessibilityViewIsModal` est posé sur une `View` en flux (`ProfileDetailScreen.tsx:155`) où il n'a pas d'effet ; la feuille n'est pas fermable en touchant à l'extérieur. Voir 8.2 pour un vrai composant.
- Dialogues d'état : bandeaux de sanction (`sanctions.banner`) en toast de 8 s ; prévoir un bandeau persistant en haut du profil jusqu'à lecture.
- Compte à rebours de renvoi d'e-mail (`verifyEmail.resendWait`) : vérifier qu'il n'annonce pas chaque seconde aux lecteurs d'écran, comme le chronomètre d'appel.

## 6. Internationalisation et rédaction

### 6.1 Complétude et parité

La parité des clés fr et en est imposée par le typage (`mobile/src/i18n/translate.ts` : `Record<TranslationKey, string>`) et par `__tests__/i18n.test.tsx`. La recherche de chaînes en dur dans les `.tsx` (libellés, `placeholder`, `accessibilityLabel` littéraux) ne trouve rien en dehors des glyphes d'icône (« ✕ », « ★ », « ♥ », « ⋯ », « ☎ », « ▶ », « ‹ », « › »), dont le libellé accessible est bien traduit. Restent hors i18n : les poses de vérification (serveur, français uniquement), la liste de 32 pays (traduite via `country.*`, mais « Congo » et « RD Congo » à clarifier), les libellés du back-office (français uniquement, voir P1-9), et les messages d'e-mail (`backend/lang`, langue du serveur).

### 6.2 Pluriels

Aucune gestion des pluriels : `messages.unread` donne « 1 messages non lus » (`mobile/src/i18n/areas/messages.fr.ts:6`) et « 1 unread messages » en anglais (l'étiquette de l'onglet Messages, `MainTabs.tsx:44`) ; `delete.grace` donne « dans 1 jours » ; `premium.plan.other` produit « {months} mois » (invariable en français, correct). Les crédits résolvent le singulier à la main (`credits.pack.one` / `.many`, `CreditsScreen.tsx:207`). Spécification : étendre `translate()` avec `Intl.PluralRules(locale)` et des clés `key.one`, `key.other` (`key.zero` si utile), sélectionnées quand `params.count` est fourni ; migrer `messages.unread`, `delete.grace`, `sessions.*`, `photos.count`, `credits.pack.*`. Test : pour chaque clé `.one` exiger la clé `.other` dans les deux langues.

### 6.3 Ton et micro-textes

Le ton est cohérent (vouvoiement, phrases courtes, pas de jargon sauf les exceptions ci-dessus). À corriger :

- « Likes » (`discover.quota.title`, `premium.subtitle`) contre « J'aime » (bouton). Choisir « J'aime » et « coup de cœur », en anglais « like » et « super like ».
- « Mentions légales » (`settings.legal`, `legal.title`) désigne en droit français l'identification de l'éditeur ; l'écran contient CGU, confidentialité et règles. Titre proposé : « Informations légales » ou « Conditions et confidentialité ». La note `legal.draftNote` (« Les textes juridiques sont fournis par l'éditeur et validés par un juriste ») est une information interne à retirer de l'interface, comme `legal.notConfigured`.
- « Supprimer la conversation » (`conversation.hide`) pour une action qui masque seulement ; l'autre personne la garde. Libellé : « Masquer la conversation » ; toast « Conversation masquée. »
- « Rompre le match » : acceptable, « Annuler le match » est plus courant ; ajouter une phrase de conséquence dans la confirmation (la conversation sera fermée).
- `delete.done` : « Vous allez être déconnecté » est au masculin. Préférer une tournure neutre : « Déconnexion en cours. »
- « Ouvert(e) » (`intent.lets_find_out.description`) : écriture à parenthèses ; reformuler « Je reste ouvert à tout, sans idée précise pour l'instant. » ou accepter la forme épicène du produit.
- Typographie française : aucun espace insécable avant « : », « ? », « ! », « » » ni après « « » (0 occurrence dans `fr.ts` et les fichiers `areas/*.fr.ts`) ; « Crédits « Conversation » : 3 » peut se couper avant les deux-points. Remplacer par U+00A0 (ou U+202F avant `? ! ;`) lors d'une passe automatisée. Apostrophes mixtes : droites dans `fr.ts` (« J'accepte »), typographiques dans `areas/*.fr.ts` (« l’abonnement »). Choisir l'apostrophe typographique ’ et l'imposer par un test.
- Messages d'erreur : « Impossible de charger » (`state.error.title`) est bon ; `error.server` « Un problème est survenu de notre côté » est bon. Éviter « L'adresse du serveur n'est pas configurée (EXPO_PUBLIC_API_URL) » en production.
- Expansion du texte : l'anglais est plus court en moyenne ; le français dépasse l'anglais de 15 à 30 % (« Gérer ou résilier mon abonnement » contre « Manage or cancel my subscription », à peu près égal, mais « Comportement lors d'une rencontre » contre « Behavior during a meeting »). Valider les écrans à 130 % de largeur et à Dynamic Type 150 % ; les boutons à 2 lignes sont acceptables, les libellés de ligne de liste à 1 ligne ne le sont pas (voir P1-7).

## 7. États vide, chargement, erreur : inventaire

- Couverts par `AsyncView` (squelettes, hors ligne distinct, « Réessayer », vide avec action) : découverte, messages, conversation, profil, profil public, photos, préférences, filtres, confidentialité, notifications, sessions, bloqués, sanctions, support, Premium, crédits, vérification. Bon niveau.
- Écrans sans `AsyncView` mais avec données ou attente : export des données (`ExportScreen`, avec région vivante et état en attente), résultat d'achat (squelette et états explicites, bien), appels (états de phase), vérification d'e-mail. À examiner à l'écran en cas d'échec réseau : `PurchaseResultScreen` gère le délai dépassé, c'est le bon modèle.
- Squelettes : `AsyncView` utilise des cartes de 64 pt génériques ; pour la découverte, l'état de chargement (`DiscoverScreen.tsx:181-183`) est un rectangle de 400 pt, sans forme de carte (photo plus pied). Adapter pour éviter le saut de mise en page.
- États vides : textes et actions corrects (« Vous avez tout vu pour le moment », « Modifier les filtres »). Ajouter une illustration légère via la prop `illustration` déjà prévue.
- Erreur de la pile de découverte pour profil absent (`needsProfile`) : bon, avec action vers le profil.

## 8. Système de design : jetons et composants

### 8.1 Cohérence des jetons

Bon : un seul fichier de couleurs, interdit ailleurs par test ; échelle d'espacement `space` et rayons `radius` ; `MIN_TARGET` et `MAX_CONTENT_WIDTH` ; clair et sombre symétriques. Écarts :

- Typographie : quatre variantes seulement (`title` 28, `h2` 22, `body` 16, `caption` 13). Les graisses sont surchargées 31 fois en ligne (`style={{ fontWeight: '600' }}`, dans `src/features`, `src/ui`, `src/navigation`) et les tailles 12 et 20 apparaissent en dur (`MainTabs.tsx:10,29`), 16 dans `TextField.tsx:90` et `ConversationScreen.tsx:208`. Ajouter les variantes `label` (16, 600, 22), `bodySmall` (14, 400, 20), `captionStrong` (13, 600, 18) et une prop `weight` bornée ; supprimer les surcharges.
- Espacement : valeurs magiques 16, 48 (`AreaLayout.tsx:13`), 24, 26, 36, 56, 96, 120, 140 pour avatars, glyphes, largeurs minimales, ainsi que `left: 16, right: 16` dans `Toast.tsx:87`. Ajouter des jetons de taille : `size = { icon: 24, avatarSm: 36, avatarMd: 48, avatarLg: 120, avatarXl: 140, fab: 56 }`.
- Absents : élévation (ombres des feuilles de menu), mouvement (`motion = { fast: 120, base: 180, slow: 300, reduced: 0 }` et une fonction `useMotion()` qui renvoie 0 si le réglage système l'exige), z-index, états de focus pour clavier physique et accès par commutateur (contour 2 px `primary`), opacités d'état (`pressed: 0.78` et `0.8` et `0.7` coexistent : `Button.tsx:64`, `Chip.tsx:33`, `ListRow.tsx:86`).
- Couleurs : ajouter `borderStrong` (P0-3), `info` distinct de `verified` (le bandeau d'information réutilise `verified`, `Banner.tsx:32-34`, ce qui lie la couleur du badge de vérification à l'information générale), `onSuccess`, `onWarning` et `onInfo` si les pastilles de bandeau changent de fond.

### 8.2 Réutilisation des composants

Duplication à résorber :

- Feuille de menu « ⋯ » écrite à la main deux fois (`ProfileDetailScreen.tsx:152-175`, `ConversationScreen.tsx:247-278`) avec le même style de carte et la même séquence (liste, puis confirmation en ligne). Extraire `ActionSheet` (modale réelle avec `accessibilityViewIsModal`, fermeture au toucher extérieur et à l'échap, retour du focus sur le déclencheur) et `ConfirmPanel` (titre, corps, action destructive, annuler), réutilisé par suppression de photo (`PhotosManager.tsx:182-183`), suppression de message (`ConversationScreen.tsx:158-174`), fermeture de session, retrait de consentement.
- Bouton d'icône : plusieurs `Button variant="ghost" label="⋯"` imitent un bouton d'icône avec 24 pt de padding de chaque côté. Créer `IconButton` (44 par 44, icône, `accessibilityLabel` obligatoire au niveau du type).
- En-têtes : trois variantes (`ScreenHeader`, `BackButton`, en-tête sur mesure de la conversation). Étendre `ScreenHeader` avec `leadingAvatar` et `trailing` multiples.
- Cartes de choix : `ChoiceCard`, `CheckboxField` et `Chip` partagent bordure, fond et état sélectionné avec trois implémentations. Extraire une base `SelectableSurface`.
- Lignes de liste avec action : `ListRow` + `Button` en `trailing` répété trois fois, avec le défaut P0-2. Offrir une prop `action={{ label, accessibilityLabel, onPress, loading }}` qui gère l'accessibilité.
- Icône : composant `Icon` centralisant le jeu d'icônes.

### 8.3 Spécification d'un jeu de jetons partageable avec les pages web

Fichier `design/tokens.json` unique, généré en `tokens.ts` pour l'application et en `tokens.css` (variables `--color-*`) pour les pages statiques et la feuille de style du panneau (`->viteTheme()` Filament) :

```
color.light: bg #FFFFFF, surface #F6F4F2, text #1B1A19, textMuted #5E5A56,
  primary #C2410C, onPrimary #FFFFFF, border #E4E0DC, borderStrong #85807B,
  danger #B91C1C, warning #B45309, success #15803D, info #1D4ED8
color.dark: bg #121110, surface #1E1C1A, text #F3F1EE, textMuted #A8A29E,
  primary #FB923C, onPrimary #1B1A19, border #3A3633, borderStrong #7F7973,
  danger #F87171, warning #FBBF24, success #4ADE80, info #60A5FA
space: 0, 4, 8, 12, 16, 24, 32, 48
radius: sm 8, md 12, lg 20, pill 999
type: title 28/34/700, h2 22/28/600, label 16/22/600, body 16/22/400,
  bodySmall 14/20/400, caption 13/18/400
size: icon 24, target 44, avatar 36/48/120/140, contentMax 560
motion: fast 120, base 180, slow 300 (0 si réduction demandée)
```

`info` #1D4ED8 donne 6,70:1 sur blanc (valeur à vérifier par le test de contraste avant adoption ; le jeton actuel `verified` #2563EB mesure 5,17:1).

## 9. Gains rapides (moins d'une heure chacun)

1. Retirer `legal.draftNote` et `legal.notConfigured` de l'interface ou les conditionner à `__DEV__` (`LegalScreen.tsx:41-43`, `settings.fr.ts`). 10 minutes.
2. Ajouter `borderStrong` aux jetons et l'utiliser dans `TextField`, `SwitchRow`, `Chip`, `ChoiceCard`, plus deux paires dans `theme.test.ts`. 40 minutes.
3. Corriger `ListRow` (P0-2) : `accessible` seulement sans `trailing`. 15 minutes plus un test.
4. Supprimer `accessibilityLiveRegion` du chronomètre d'appel (`CallScreen.tsx:122`) et désactiver Micro / Caméra / Haut-parleur tant qu'ils ne sont pas câblés (`:88-92`). 15 minutes.
5. Définir `sceneStyle` et `contentStyle` avec `colors.bg` dans `MainTabs.tsx` et `AreaLayout.tsx`. 15 minutes.
6. Remplacer les messages `premium.unavailable.*` et `error.config` par un texte générique hors `__DEV__`. 20 minutes.
7. Supprimer les clés `home.*`, `demo.*`, `welcome.demo` du bundle de production (ou les isoler dans un fichier chargé seulement en développement). 20 minutes.
8. Toujours afficher « Gérer mon abonnement » dans Réglages et autoriser deux lignes dans `ListRow` (`numberOfLines={2}`). 30 minutes.
9. Présélectionner l'offre Premium la plus longue et afficher le montant dans le bouton (« S'abonner, {prix} »). 40 minutes.
10. Porter la durée des toasts à 8 s quand une action existe et les remonter au-dessus de la barre d'onglets (`Toast.tsx:20,57`). 20 minutes.
11. Passer les espaces avant `: ? ! »` en insécables dans `fr.ts` et `areas/*.fr.ts` par un script, et unifier l'apostrophe. 45 minutes.
12. Ajouter `returnKeyType` et `onSubmitEditing` dans `AuthFormScreen.tsx`. 20 minutes.
13. Back-office : traduire et colorer les badges de statut (trait partagé), `getNavigationBadgeColor`, `url()` sur les tuiles du tableau de bord, `requiresConfirmation()` sur Rejeter média et retrait sur Approuver. 50 minutes.
14. Remplacer les glyphes ✉ ☺ ☎ ▶ par des icônes Ionicons dans `MainTabs.tsx` et `ConversationScreen.tsx` (sans créer encore `IconButton`). 45 minutes.
15. Corriger les textes : « Likes » vers « J'aime », « Mentions légales » vers « Informations légales », « Supprimer la conversation » vers « Masquer la conversation », `premium.purchaseError` reformulé. 30 minutes.

## 10. Ordre de traitement conseillé

Avant toute soumission : P0-1 (pages web et textes validés), P0-2, P0-3, P0-4 et gains rapides 1 à 6. Avant la bêta publique : P1-1 à P1-3 et P1-5 (accessibilité) ; P1-4 (signalement) et P1-9 (back-office) dans le même sprint car le premier alimente le second. Le reste du P1 et le système de jetons partagés (8.3) accompagnent la définition de la marque, déjà annoncée comme provisoire dans `docs/07-DESIGN-SYSTEM.md`.

Vérifications à faire sur appareil pour confirmer les points déduits du code : parcours VoiceOver sur Crédits, Bloqués et Sessions ; Dynamic Type à 200 % sur Découvrir, Premium et l'en-tête de conversation ; mode sombre avec transitions d'écran ; iPhone SE (largeur 320 pt) ; lancement à froid en mode sombre ; validation iPad d'App Store Connect avec l'orientation portrait seule.
