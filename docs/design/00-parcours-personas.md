# 00 : Parcours critiques, personas de travail et plan de recherche (phase 0, volet UX)

Version 1, 2026-11-08. Livrable de la phase 0 du `PROMPT-UIUX-EXPERT.md` (volet parcours et utilisateurs). Il complète, sans le remplacer, le futur `00-audit.md` (écarts P0, P1, P2 et analyse concurrentielle, non traités ici).

## 0. Portée, méthode et limites

Sources lues : `docs/01`, `03`, `04`, `05`, `06`, `10`, `12`, `16`, `DECISIONS-PROPRIETAIRE.md`, `docs/legal/*`, `docs/openapi.json` (consulté pour les routes), le code de `mobile/app`, `mobile/src/flow`, `mobile/src/features/*`, `mobile/src/push`, `mobile/app.json`, et `web/`. Aucun fichier source n'a été modifié.

Étiquettes utilisées : **fait (source)** pour ce qui est lu dans le dépôt ; **hypothèse** pour tout le reste ; **inconnu** quand ni le dépôt ni le propriétaire ne le disent.

Limites, à lire avant tout chiffre :
- L'application n'a **jamais été lancée sur un appareil ni un émulateur** (fait, `docs/16`). Tout ce qui suit vient de la lecture du code et des textes ; rien n'a été vu à l'écran. Les nombres de touches sont des **estimations par lecture du code**, à confirmer sur appareil.
- Aucune donnée d'usage n'existe : le produit n'est pas lancé. Toute affirmation sur le comportement d'utilisateurs réels est une hypothèse.
- Aucun SDK d'analyse ni de rapport de plantage n'est présent dans `mobile/src`, `mobile/app` ou `mobile/package.json` (recherche faite : fait). Les événements de la section 4 sont donc **à spécifier**, pas à brancher sans décision du propriétaire (question Q9).
- Les textes juridiques sont des brouillons non validés (fait, `docs/legal/00-LISEZ-MOI.md`). Les obligations citées sont des **pistes** à confirmer par un juriste, pas des avis.

### 0.1 Écarts entre documents et code relevés en chemin (à arbitrer)

| # | Écart | Source docs | Constat code | Gravité UX |
| --- | --- | --- | --- | --- |
| E1 | Ordre date de naissance et consentements : le schéma F01 écrit S63 puis S68 ; l'inventaire dit que S68 est atteint depuis S63 | `04` F01, `05` S68 | Le code fait **S68 puis S63 puis S02** (`signupMachine.ts`, revue design-1 P1-3). F17 des docs est cohérent avec le code | Faible (docs à corriger) |
| E2 | Connexion Google / Apple / TikTok à l'accueil, à la connexion et à l'inscription | `04` F00 et F01, `05` S01 et S02, `03` FR-A-2 | **Aucun bouton social** sur S01, ni sur S02 (`WelcomeScreen.tsx`, `AuthFormScreen.tsx`). Le module `src/auth/oauthLogin.ts` existe mais n'est utilisé que pour la ré-authentification de la suppression et de l'export | Élevée pour la vague 2 (hypothèse : l'e-mail et un mot de passe de 10 caractères coûtent cher sur mobile) |
| E3 | Clics d'inscription : environ 11 | `04` F01 | Environ 28 touches minimum (section 2.1) | Élevée |
| E4 | Signalement « en 3 taps, cible unique » | `01`, `03` règle transverse, `04` F11 | 3 touches depuis la carte de découverte et pendant un appel ; **4 touches** depuis le détail du profil et depuis la conversation (menu ⋯, Signaler, motif, Envoyer). Le choix « Envoyer le signalement » explicite est voulu (`ReportScreen.tsx`) | Moyenne |
| E5 | Liens CGU et confidentialité sur l'accueil | `05` S01 | Absents de S01 ; présents sur S63 (consentements), le paywall et les réglages | Moyenne (obligation des stores à vérifier) |
| E6 | Historique des transactions (S34, FR-G-4) | `05`, `03` | Aucun écran | Moyenne |
| E7 | Appels : permissions micro et caméra expliquées puis demandées au moment de l'appel (FR-E-4) ; interface d'appel complète | `03`, `06` | Le moteur média est « non disponible » (`mediaEngine.ts`) ; l'écran d'appel affiche seulement avatar, durée, signaler, raccrocher, plus une bannière d'indisponibilité. Aucune permission n'est donc demandée | Critique pour la promesse « vidéo avant échange de coordonnées » |
| E8 | Permission de notification expliquée avant la demande système | `06` « Permissions » | `registerForPush` demande la permission système **dès la fin de l'onboarding**, sans écran d'explication (`registerPush.ts`, `PushRegistration.tsx`) | Moyenne |
| E9 | Dépense d'un crédit « Conversation » | `10` : « ouvrir (non-match) : consomme un crédit » | `ProfileDetailScreen.tsx` (`writeTo`) ouvre la conversation **sans confirmer** la dépense ni afficher le solde | Élevée (confiance et honnêteté) |
| E10 | Annulation d'une suppression de compte | `delete.cancelHint` : « contactez le support » | Les sessions sont révoquées à la demande ; l'écran de support est dans la zone connectée. Voie de sortie à clarifier (hypothèse : impasse) | Élevée |
| E11 | Page web de suppression (FR-I-15) | `03` | `web/account/delete.html` et `confirm-deletion.html` existent, mais le formulaire cible `https://api.example.invalid/...` et les pages portent `[Nom de l'application]` et un bandeau « version provisoire » : non branché | Bloquant magasin |

## 1. Vue d'ensemble des 8 parcours

| # | Parcours | Écrans (docs) | Entrée | Sortie de succès | Risque principal |
| --- | --- | --- | --- | --- | --- |
| P1 | Inscription avec contrôle d'âge | S01, S68, S63, S02, S03, S64 | Accueil | Compte créé, e-mail envoyé | Longueur, méfiance sur les données sensibles |
| P2 | Premier profil | S03, S04, S05, S06, S07 | Compte créé | Découverte affichée, profil en revue | Photo, attente de l'approbation, 28 touches cumulées |
| P3 | Découverte et match | S10, S09, S11, S12 | Onglet Découvrir | Match avec conversation créée | Pile vide, quota, qualité des profils |
| P4 | Première conversation | S13, S14 | Match, ou « Écrire » depuis un profil | Premier message envoyé et réponse reçue | Page blanche, arnaque, crédit |
| P5 | Appel | S14, S15, S16, S17, S18 | Conversation issue d'un match | Appel de plus de 1 minute | Média non branché, réseau, permissions |
| P6 | Passage Premium | S30, S31, S32 | Profil, quota, super-like, annulation | Premium ou crédits confirmés par le serveur | Défiance, prix, validation en retard |
| P7 | Signalement et blocage | S11, S14, S17, S58, S54 | Menu ⋯, carte, appel | Signalement envoyé ou personne bloquée | Nombre de touches, peur de représailles |
| P8 | Suppression et export | S50, S55, S67, web | Réglages | Demande enregistrée, archive téléchargée | Impasses, promesses non tenues |

Ordre de risque de décrochage proposé (hypothèse, à valider par la section 5) : P1 puis P2 (cumul), puis P4, P6, P3, P5, P7, P8.

---

## 2. Parcours détaillés

Chaque parcours donne : un tableau d'étapes (prévu contre constaté), puis friction, risques de décrochage, moments de confiance, obligations, métrique de succès, événements d'analyse. Les routes sont celles d'expo-router (les groupes `(public)` et `(app)` ne figurent pas dans l'URL). Les fichiers sont sous `mobile/`.

### 2.1 P1 : Inscription avec contrôle d'âge

Objectif utilisateur : ouvrir un compte sans se sentir fiché. Objectif produit : un compte majeur, avec consentements valides, et un refus d'âge sans fuite d'information.

| # | Étape | Écran, route, fichier | Prévu (docs) | Constaté (code) | Friction |
| --- | --- | --- | --- | --- | --- |
| 1 | Accueil | S01, `/`, `src/features/welcome/WelcomeScreen.tsx` | Logo, valeur, boutons sociaux, liens CGU | Nom en texte, titre « Rencontrez des personnes qui cherchent la même chose que vous. », phrase anti-arnaque, 2 boutons (Créer un compte, Se connecter), bascule de langue. Pas de logo (dette connue), pas de bouton social, pas de lien légal | Aucune preuve visuelle de confiance ; 2 boutons de même poids hiérarchique à vérifier |
| 2 | Date de naissance | S68, `/signup/birthdate`, `BirthdateScreen.tsx` | Sélecteur de date, message d'âge minimum | 3 sélecteurs jour, mois, année ; bouton désactivé tant que incomplet ; texte « réservé aux personnes majeures » ; appel `POST /auth/age-check` ; jeton d'âge de 10 min | Sélecteur lourd (VoiceOver, dette connue) ; année à faire défiler (départ à N-25) ; attente réseau sans estimation ; erreur réseau avec bouton Réessayer (bien) |
| 2b | Refus | S64, `/signup/age-refused`, `AgeRefusedScreen.tsx` | Message neutre, rien créé, refus mémorisé | Titre « Inscription impossible », « Nous ne pouvons pas créer de compte pour le moment. » ; retour matériel renvoie à l'accueil ; état terminal | Le « pour le moment » peut suggérer de réessayer ; l'écran ne dit pas pourquoi (voulu). Aucune sortie utile (hypothèse : un faux positif, par exemple une erreur de saisie, n'a pas de recours visible) |
| 3 | Consentements | S63, `/signup/consents`, `ConsentsScreen.tsx` | Cases distinctes, textes bilingues | 4 cases : CGU, confidentialité, données sensibles (obligatoires), nouveautés (facultatif) ; 2 boutons « Lire » ouvrent les textes ; Continuer désactivé jusqu'aux 3 obligatoires | 4 cases + 2 lectures facultatives ; texte « données sensibles » long (hypothèse : lu par peu) ; message « il manque… » seulement en pied |
| 4 | Compte | S02, `/signup/account`, `AuthFormScreen.tsx` (mode inscription) | E-mail ou Google ou Apple | E-mail + mot de passe (10 caractères minimum, lettres et chiffres) ; bascule vers connexion ; jeton d'âge vérifié à l'envoi (`error.age_token_expired` sinon retour à S68) | Mot de passe de 10 caractères sur mobile (hypothèse : abandon élevé sur clavier lent) ; aucun bouton social (E2) ; si le jeton expire pendant la saisie (10 min), retour en arrière |
| 5 | Vérification d'e-mail | S03, `/onboarding/verify-email`, `VerifyEmailScreen.tsx` | Lien à usage unique, 24 h | Non bloquant : « Continuer, je confirmerai plus tard » ; « J'ai confirmé » (recharge `/me`) ; renvoi avec attente de 60 s ; lien profond `/verify-email` | Bon (non bloquant). Inconnu : quelles fonctions exigent l'e-mail vérifié (le code ne les liste pas) ; l'utilisateur doit quitter l'app pour son courrier |

Chiffrage (estimation par lecture du code, section 0) :
- Champs obligatoires de P1 seul : 3 (date) + 3 cases + 2 (e-mail, mot de passe) = 8 ; touches : 1 (accueil) + 4 (date : 3 choix et Continuer) + 4 (3 cases et Continuer) + 3 (2 champs et Valider) + 1 (passer l'e-mail) = environ 13.
- Écrans avant le premier profil : 5. Attentes réseau : 2 (age-check, register) plus la vérification d'e-mail hors application.
- Les docs annoncent environ 11 clics pour tout F01 (inscription et onboarding) ; le code en demande environ 28 (P1 et P2 cumulés, voir 2.2).

Risques de décrochage (hypothèses) :
1. Demande de date de naissance avant toute valeur montrée : l'utilisateur ne sait pas encore ce que l'app lui apporte. Contre-mesure possible : montrer une preuve de confiance avant (à tester).
2. Case « données sensibles » : la formulation médicale peut inquiéter les profils discrets (persona C).
3. Mot de passe, pas de connexion sociale (E2).
4. Réseau lent : `age-check` et `register` sans état de progression détaillé ; la perte de connexion pendant S02 ne conserve pas le jeton si l'app est tuée (l'état est en mémoire seulement : `SignupFlowProvider.tsx`, fait). Une app tuée oblige à tout recommencer.

Moments de confiance : refus d'âge neutre ; consentements séparés avec « facultatif » explicite ; phrase anti-arnaque sur l'accueil ; vérification d'e-mail non bloquante.

Obligations magasin et légales (pistes) :
- Âge : contrôle déclaratif avant création du compte ; classe d'âge du magasin à renseigner ; la suffisance du déclaratif est une question ouverte au juriste (`docs/legal/04`, ligne « Âge »). Le refus mémorisé (appareil 90 jours, IP 30 minutes, décision Q1 option B) a des limites connues (`DECISIONS-PROPRIETAIRE.md`, Q1) ; l'option C (attestation d'appareil) est à faire avant le lancement public.
- Consentement explicite aux données sensibles (RGPD article 9, piste) ; consentements enregistrés et révocables (FR-I-14, implémenté côté serveur, écran `/settings/consents`).
- Si une connexion tierce est ajoutée un jour, vérifier la règle d'Apple sur « Se connecter avec Apple » (à confirmer dans les règles de revue actuelles).
- Transparence des données collectées (étiquettes de confidentialité des magasins) : à aligner sur `docs/legal/02`.

Métrique de succès : taux d'inscription terminée, défini comme part des ouvertures d'écran S68 qui aboutissent à un compte créé, par cohorte d'installation. Seconde métrique : temps médian entre `signup_started` et `account_created`. Cibles : **inconnues** (aucune donnée) ; à fixer avec le propriétaire (`docs/01` : « à fixer »).

Événements d'analyse (voir la convention en section 4) : `app_first_open`, `welcome_viewed`, `signup_started`, `age_gate_submitted` (résultat : passed, refused, error ; jamais la date), `age_gate_refused_viewed`, `consents_viewed`, `consent_toggled` (type, sans valeur personnelle), `consents_accepted` (marketing oui ou non), `account_form_submitted` (mode, résultat, code d'erreur), `account_created`, `age_token_expired`, `email_verification_viewed`, `email_verification_skipped`, `email_verified`, `email_resend_tapped`.

### 2.2 P2 : Premier profil

Objectif utilisateur : être présenté correctement sans perdre de temps. Objectif produit : un profil visible (au moins une photo approuvée) et des préférences de découverte.

| # | Étape | Écran, route, fichier | Prévu (docs) | Constaté (code) | Friction |
| --- | --- | --- | --- | --- | --- |
| 1 | Profil de base | S04, `/onboarding/profile`, `onboarding/BasicProfileScreen.tsx` | Nom, genre, pays, ville | Nom (2 à 40), genre (3 cartes : Homme, Femme, Autre), pays de résidence et pays d'origine (deux sélecteurs avec recherche), ville ; progression 1 sur 4 | 5 champs obligatoires ; 2 recherches de pays ; « Autre » sans « préfère ne pas dire » (dette connue) ; nom : un seul champ (hypothèse : prénom d'usage, plusieurs noms et scripts non traités) |
| 2 | Intention | S05, `/onboarding/intent`, `IntentScreen.tsx` | 5 cartes | 5 cartes avec description ; Continuer envoie `PUT /me/profile` ; erreur sur le pays de résidence renvoie à S04 | 1 choix et 1 envoi ; textes courts et bons ; attente réseau sur Continuer |
| 3 | Photos | S06, `/onboarding/photos`, `photos/PhotosScreen.tsx`, `PhotosManager.tsx` | 1 à 6 photos, état « en revue » | Sélecteur système (pas de permission de bibliothèque), envoi présigné, statut par photo, réordonner par flèches ‹ ›, suppression confirmée ; Continuer exige au moins une photo (en revue ou approuvée) | Aucun conseil de qualité de photo ni exemple ; envoi lourd sur réseau lent (la compression est celle du sélecteur, qualité 0,8 : fait) ; réordonner par petites flèches ; note « vérifiées avant d'être visibles » |
| 4 | Préférences | S07, `/onboarding/preferences`, `preferences/PreferencesScreen.tsx`, `PreferenceFields.tsx` | Genre recherché, âge, pays, origine, intentions | Valeurs préremplies par le serveur ; genre recherché (puces), âge min et max (boutons − et +), pays, origines, intentions, interrupteur « vérifiés seulement » ; « Terminer » appelle `completeOnboarding` | Changer l'âge d'une tranche exige **une touche par année** (hypothèse : fastidieux) ; beaucoup de puces de pays ; l'écran sert aussi de filtre (S09), cohérent |
| 5 | Arrivée | `/discover` (S10) | Découverte | Redirection automatique ; demande de permission de notification dès l'arrivée (E8) | Le profil est **invisible** tant qu'aucune photo n'est approuvée (`profileTab.notVisible`, affiché seulement dans l'onglet Profil) : l'utilisateur voit les autres mais n'existe pas pour eux ; durée d'approbation **inconnue** (modération non dotée en personnel : fait, `docs/legal/00`) |

Chiffrage : champs obligatoires de P2 : nom, genre, 2 pays, ville, intention, 1 photo = 7 ; touches : environ 9 (profil, avec 2 recherches de pays) + 2 (intention) + 3 (photo : ajouter, choisir, continuer) + 1 (terminer) = environ 15. Cumul avec P1 : environ 28 touches et 15 champs, 8 écrans de saisie (hors e-mail). Barre de progression : 4 étapes, ne compte pas S03 (voulu).

Risques de décrochage (hypothèses) : l'étape photo (pudeur, absence de bonne photo, crainte d'exposition de la famille ou de la communauté) ; l'attente d'approbation sans notification promise ; l'inscription ressentie comme longue avant d'avoir vu un seul profil ; abandon à mi-parcours : le code reprend à `/onboarding/verify-email` puis saute vers profil ou photos selon `state.user.profile` (fait), mais le brouillon de S04 est en mémoire (`OnboardingProvider`) : app tuée avant S05, saisie perdue.

Moments de confiance : intention affichée avec des phrases rassurantes (« à mon rythme ») ; consentement biométrique séparé pour la vérification (P7 voisin) ; photo vérifiée avant publication (modération annoncée).

Obligations : toute photo invisible tant qu'elle n'est pas approuvée (FR-B-8, implémenté) ; modération humaine cible 24 h (non dotée en personnel : budget ouvert, `docs/16`, point 4) ; données sensibles déduites du genre et du genre recherché (`docs/legal/00`) : champ « Autre » et « préfère ne pas dire » à trancher (question Q8) ; photos : pas de visages de personnes réelles dans les livrables de design.

Métrique de succès : part des comptes créés qui atteignent « profil visible » (au moins une photo approuvée) sous 24 h, et temps médian de création à première carte vue. Seconde : part des profils avec photo approuvée et au moins 3 photos. Cibles : inconnues.

Événements : `onboarding_step_viewed` (étape), `onboarding_step_completed` (étape, durée), `onboarding_abandoned` (dernière étape, détecté à la reprise), `country_picker_used` (champ, nombre de caractères tapés, sans contenu), `profile_saved`, `photo_pick_started`, `photo_upload_succeeded` (durée, taille en classes), `photo_upload_failed` (code), `photo_status_changed` (approved, rejected, délai), `preferences_changed` (champs modifiés, sans valeurs), `onboarding_completed`, `push_permission_prompted`, `push_permission_result` (granted, denied).

### 2.3 P3 : Découverte et match

Objectif utilisateur : voir des personnes crédibles qui cherchent la même chose. Objectif produit : likes, matchs, première conversation.

| # | Étape | Écran, route, fichier | Prévu (docs) | Constaté (code) | Friction |
| --- | --- | --- | --- | --- | --- |
| 1 | Pile de cartes | S10, `/discover`, `discover/DiscoverScreen.tsx`, `SwipeCard.tsx` | Swipe droite = like, gauche = non, haut = super-like ; boutons équivalents ; annulation Premium ; 3 cartes préchargées | Geste + 3 boutons glyphes (✕ ★ ♥) ; annuler et signaler en bas ; lots de 10 avec préchargement à 3 restantes ; état vide avec « élargir les filtres » ; état « profil requis » (403) | Glyphes à rendu variable (dette) ; super-like et annulation bloqués par Premium avec bannière (bien : non culpabilisant) ; le squelette n'a pas la forme d'une carte (dette) ; pas d'indicateur de vérification visible hors détail (à vérifier sur appareil) |
| 2 | Filtres | S09, `/filters`, `discover/FiltersScreen.tsx` | Âge, pays (y compris autre), origine, intention, vérifié | Mêmes champs que les préférences, sans genre ; « Appliquer » et « Réinitialiser » ; puce • sur le bouton quand actifs | Mêmes contrôles à pas de 1 an ; filtre en mémoire seulement (perdu au redémarrage : `DiscoverFiltersProvider`) |
| 3 | Détail du profil | S11, `/user/[id]`, `discover/ProfileDetailScreen.tsx` | Galerie, vidéo, bio, menu bloquer, signaler | Galerie horizontale, « ✓ Vérifié » en texte, ville et pays, origine, intention, bio ; menu ⋯ : Écrire, Signaler, Bloquer (confirmé) ; boutons ✕ ★ ♥ | « ✓ Vérifié » en simple texte (hypothèse : badge peu saillant pour un argument central) ; pas de vidéo (phase B) ; bio vide : texte neutre |
| 4 | Like | `POST /swipes` | 1 geste | Quota gratuit de 50 likes par jour (fait, `backend/config/discovery.php`) ; au-delà, bannière avec accès à Premium ; erreur réseau : toast, la carte revient | Le quota est silencieux jusqu'au blocage (hypothèse : pas d'indicateur de restant) |
| 5 | Match | S12, `/match`, `discover/MatchScreen.tsx` | Animation, Écrire, Continuer | Avatar, « C'est un match ! », texte avec le prénom, 2 boutons (Écrire, Continuer) ; **aucune animation** (dette) | Pas d'annonce pour lecteur d'écran (dette connue) ; pas de suggestion de premier message |

Chiffrage : 1 geste jusqu'au match (conforme aux docs). Un seul bouton primaire par écran de match (bien). Attente : chaque swipe est un appel réseau ; pas d'état « envoi » visible (la carte part tout de suite, `remove` optimiste).

Risques de décrochage (hypothèses) : pile vide dans une ville ou un pays peu peuplé (marché petit au lancement : problème d'amorçage, **inconnu** : taille de base d'utilisateurs, voir Q4) ; filtre par origine trop restrictif ; manque de preuve de sérieux sur la carte ; fatigue de swipe sans match ; profil de l'utilisateur invisible (P2).

Moments de confiance : badge vérifié, intention affichée, origine et pays de résidence affichés ; bloquer et signaler sur la carte elle-même ; message neutre quand on refuse (aucun jugement : principe 2).

Obligations : signalement et blocage accessibles (UGC) ; pas de reproposition d'un profil bloqué (FR-C-4, serveur) ; promesse « vérifié » limitée à une comparaison de photo (CGU §6, brouillon) : le libellé « Vérifié » doit être expliqué (« pas une garantie d'identité ») là où il apparaît.

Métrique de succès : part des nouveaux comptes avec profil visible qui obtiennent un premier match sous 7 jours ; taux de match par 100 likes envoyés. Cibles : inconnues.

Événements : `discover_viewed`, `card_impression` (rang, vérifié oui ou non), `swipe` (action, source : geste, bouton, détail), `swipe_blocked` (raison : quota, premium), `match_created` (délai depuis l'inscription), `match_screen_action` (write, continue), `filters_opened`, `filters_applied` (champs modifiés), `discover_empty_viewed`, `profile_detail_opened`, `profile_gallery_swiped`.

### 2.4 P4 : Première conversation

Objectif utilisateur : engager sans maladresse et sans risque. Objectif produit : messages par utilisateur actif (`docs/01`).

| # | Étape | Écran, route, fichier | Prévu (docs) | Constaté (code) | Friction |
| --- | --- | --- | --- | --- | --- |
| 1 | Entrée | Depuis S12 « Écrire » ou S13 `/messages` ou S11 menu ⋯ « Écrire » | 2 clics pour écrire | S12 vers `/conversation/[id]` en 1 touche ; depuis un profil non apparié : `POST /conversations`, qui consomme un crédit sauf Premium | **Crédit dépensé sans confirmation ni solde affiché (E9)** ; si crédit insuffisant : bannière avec accès aux packs |
| 2 | Liste | S13, `/messages`, `messages/MessagesListScreen.tsx` | Avatar, aperçu, non lu, présence | Avatar, aperçu, heure, pastille de non-lus, tirer pour actualiser, état vide avec lien vers Découvrir | Pas de présence (en ligne) visible dans la liste ; aperçu du message dans la liste (cohérent avec « aucun aperçu en notification par défaut », à distinguer) |
| 3 | Fil | S14, `/conversation/[id]`, `messages/ConversationScreen.tsx` | Bulles, accusés, appel, cadeau | Bulles, envoi optimiste avec renvoi, accusés (✓, ✓✓), « écrit… », bannière de sécurité quand le serveur détecte une demande d'argent, menu ⋯ (Signaler, Bloquer, Rompre le match, Masquer), appels ☎ ▶ si le match est la source | Fil vide : texte « conversation.empty » seulement, sans aide (hypothèse : angoisse de la page blanche) ; pas d'horodatage ni de séparateur de date (dette) ; boutons d'appel en glyphes ; statut de connexion temps réel affiché en légende |
| 4 | Sécurité | bannière `safety-banner` | Alerte « demande d'argent » (FR-I-6) | Bannière d'avertissement avec action « Signaler » et bouton de fermeture, déclenchée par `safety_hint === 'money_request'` à l'envoi (fait, `useThread.ts`) | La détection par mots-clés est simple (`docs/16`) ; l'avertissement apparaît **à la réponse du serveur à mon envoi**, pas à la réception d'un message reçu (hypothèse à vérifier : un message d'arnaque reçu est-il signalé au destinataire ?) |

Chiffrage : 2 touches pour écrire depuis un match (conforme) ; 4 depuis un profil non apparié (⋯, Écrire, saisir, Envoyer), avec dépense de crédit.

Risques de décrochage (hypothèses) : première phrase difficile à écrire ; absence de réponse (inconnu : taux de réponse) ; arnaque ou demande de numéro hors de l'app ; crédit dépensé sans réponse ; fil sans repère temporel ; notifications push non activées (permission refusée silencieusement) donc réponses non vues.

Moments de confiance : bannière « Ne versez jamais d'argent… » liée à une action Signaler ; accusé de lecture ; possibilité de rompre le match ou de masquer ; explication du badge et des conseils de rencontre (aujourd'hui seulement dans les règles de la communauté, `docs/legal/03`, pas dans le fil : hypothèse d'opportunité).

Obligations : signalement et blocage accessibles dans la conversation (FR-I-1) ; anti-spam (10 nouvelles conversations par jour, gratuit : fait, `docs/10`) ; contenus de messages conservés selon la politique (anonymisation à 30 jours) ; pas d'aperçu de message dans les notifications par défaut (principe de la section 7 du prompt ; **à vérifier** dans `push` et côté serveur).

Métrique de succès : part des matchs qui échangent au moins 1 message de chaque côté sous 48 h ; messages envoyés par utilisateur actif (`docs/01`). Contre-métrique : part des conversations signalées par 100 conversations.

Événements : `conversation_opened` (source : match, profil, liste), `conversation_credit_spent` (si confirmation ajoutée), `message_sent` (type, délai depuis le match, longueur en classes), `message_failed`, `message_retried`, `message_received_read`, `first_reply_received` (délai), `safety_banner_shown` (type), `safety_banner_action` (report, dismiss), `conversation_menu_opened`, `match_unmatched`, `conversation_hidden`, `push_opened` (type).

### 2.5 P5 : Appel

Objectif utilisateur : confirmer qu'une personne est réelle avant de donner un numéro (proposition de valeur n°3, `docs/01`). Objectif produit : usage de l'appel parmi les matchs.

| # | Étape | Écran, route, fichier | Prévu (docs) | Constaté (code) | Friction |
| --- | --- | --- | --- | --- | --- |
| 1 | Lancer | boutons ☎ ▶ du fil, `POST /calls` | 1 clic ; refusé hors match (403) | Boutons visibles seulement si `unlocked_by === 'match'` ; pas de confirmation ni de choix expliqué entre audio et vidéo hormis les glyphes | Glyphes ambigus ; **aucune explication de permission** (E7) |
| 2 | Sonnerie sortante | S15, `/call`, `calls/CallScreen.tsx` | Avatar, « sonne… », raccrocher | Avatar, nom, « appel sortant », bouton Annuler ; sonnerie de 30 s (+3 s de marge) | Aucun son de sonnerie ni retour (le média n'est pas branché) |
| 3 | Appel entrant | S16, même écran, `CallProvider.tsx` | Notification plein écran app fermée (FR-E-10) | Événement temps réel `call.incoming` quand l'app est ouverte ; plein écran avec Accepter et Refuser ; **rien** quand l'app est fermée (prototype D0 absent) | Appels manqués si app fermée ; push d'appel non implémenté |
| 4 | En appel | S17, même écran | Vidéo, micro, caméra, haut-parleur, signaler, raccrocher, avertissement 2 min avant la fin (20 min max) | Avatar, durée, **Signaler** et **Raccrocher** ; bannière « média indisponible » ; aucun micro, caméra, haut-parleur, ni vidéo ; pas d'avertissement de fin | La promesse centrale (vidéo avant échange de coordonnées) n'est **pas livrée** (E7) |
| 5 | Fin | S18, même écran puis `/messages` | Résumé d'appel manqué dans le fil | Raisons (terminé, refusé, manqué, annulé, occupé, échec) ; message « appel manqué » dans le fil | Reconnexion réseau (30 s) : non traitée |

Chiffrage : 1 touche pour appeler, 1 pour accepter (docs). Écrans : 1 (mode par phase).

Risques de décrochage (hypothèses) : appel qui n'aboutit pas (média non branché, réseau mobile instable, CGNAT, vidéo 480p sur données chères) ; peur d'être vu (certaines personnes refusent la vidéo : persona C) ; manque d'alternative audio explicite ; l'appel sans vidéo vaut échec de promesse.

Moments de confiance : seuls les matchs peuvent s'appeler ; bouton Signaler visible en appel (3 touches : call-report, motif, Envoyer) ; pas d'enregistrement (FR-E-7) à **dire** à l'écran.

Obligations : demande de permission micro et caméra avec texte d'usage (déjà dans `app.json` pour iOS : fait) et explication préalable (FR-E-4) ; push VoIP et CallKit côté iOS, notification plein écran côté Android (FR-E-10, prototype D0 obligatoire, `DECISIONS-PROPRIETAIRE.md` C2) ; coût de LiveKit à maîtriser (20 minutes, 480p, LiveKit Cloud au départ : décision E2) ; mode économie de données (FR-B-9).

Métrique de succès : part des matchs avec conversation de plus de 5 messages qui font un appel de plus de 60 secondes ; taux de réussite de connexion de l'appel (sonnerie vers actif) ; durée médiane. **Non mesurable aujourd'hui** (média absent).

Événements : `call_started` (type, source), `call_ringing_timeout`, `call_accepted`, `call_declined`, `call_connected` (délai de connexion, qualité en classes), `call_reconnecting`, `call_failed` (code), `call_ended` (raison, durée), `call_report_tapped`, `call_permission_prompted`, `call_permission_result`.

### 2.6 P6 : Passage Premium

Objectif utilisateur : savoir exactement ce qu'on achète, à quel prix, et comment arrêter. Objectif produit : conversion (hypothèse de départ du propriétaire dans `docs/12` : 2 à 4 %, **hypothèse non validée**).

| # | Étape | Écran, route, fichier | Prévu (docs) | Constaté (code) | Friction |
| --- | --- | --- | --- | --- | --- |
| 1 | Déclencheurs | Onglet Profil (bouton Premium), bannière de quota, bannière super-like, annulation du dernier refus, crédit manquant à l'écriture | Profil ou quota atteint | Tous présents ; position non bloquante (la décision « bloquant ou discret » reste ouverte au propriétaire, `docs/06`) | Aucune présentation des avantages avant le blocage (hypothèse) |
| 2 | Offres | S30, `/premium`, `premium/PremiumScreen.tsx` | Plans 1, 3, 12 mois, avantages, restaurer, prix, durée, renouvellement, liens CGU et confidentialité | Cartes radio (prix du store via RevenueCat, prix par mois calculé, mention « meilleur prix » textuelle), offre la plus longue présélectionnée, résumé « plan et prix », bouton « S'abonner pour {prix} », texte de renouvellement détaillé (au moins 24 h avant), liens CGU et confidentialité, Restaurer, Gérer mon abonnement, lien vers les crédits | Bon respect de la liste Apple ; la liste des **avantages** n'est pas détaillée à l'écran (seulement un sous-titre : à vérifier sur appareil) ; présélection de l'offre la plus longue (hypothèse : peut être perçue comme une poussée, à justifier par le principe 2) ; sans store disponible : bannière + achat désactivé |
| 3 | Achat | Feuille native du store | Feuille native | `provider.purchase` (RevenueCat) | Hors de notre contrôle |
| 4 | Validation | S32, `/premium/result`, `premium/PurchaseResultScreen.tsx` | Écran « validation en cours » en cas de retard du webhook | Sondage toutes les 3 s, 10 essais, puis écran « délai » avec Vérifier à nouveau et Contacter le support ; succès affiché seulement après confirmation du **serveur** | 30 s d'attente maximum avant l'écran de délai ; l'utilisateur a payé et ne voit pas encore son avantage (moment de peur) |
| 5 | Packs | S31, `/premium/credits`, `premium/CreditsScreen.tsx` | Packs « Conversation » | Liste des packs avec prix et bouton Acheter ; solde affiché | Le solde n'est pas rappelé dans le fil ; pas d'historique (E6) |
| 6 | Gérer | `ManageSubscription.tsx`, aussi dans Réglages et à la suppression | Gérer ou annuler | Lien direct vers la page d'abonnements du store ; Premium offert géré à part | Bon (accès direct, sans rétention) |

Chiffrage : 3 touches nominales (docs) ; code : 3 à 5 (Profil, Premium, éventuel choix de plan, S'abonner). Attente : validation serveur jusqu'à 30 s.

Risques de décrochage (hypothèses) : défiance sur les arnaques à l'abonnement (persona A et B) ; prix en monnaie non locale ou trop élevé en vague 2 (le propriétaire demande une étude de marché, `docs/12`) ; absence de paiement local (Mobile Money encore ouvert, Q5) ; restauration confuse après changement de téléphone ; Premium offert pour les uns et payant pour les autres.

Moments de confiance : prix, durée et renouvellement visibles à côté du bouton ; résiliation directe ; confirmation seulement quand le serveur a validé ; aucun faux compte à rebours, aucune culpabilisation au refus (conforme aux principes).

Obligations magasin (piste, à confirmer dans les règles de revue en vigueur) : prix, durée, renouvellement automatique et gestion visibles ; bouton de restauration ; achats intégrés obligatoires pour les biens numériques, pas de lien externe de paiement dans l'app ; description claire de l'abonnement ; droit de rétractation et information sur les prix par pays (`docs/legal/04`, vague 1, ligne « Consommation ») ; suppression de compte n'annule pas l'abonnement (rappelé dans l'écran de suppression : fait).

Métrique de succès : conversion gratuit vers payant à 30 jours (hypothèse 2 à 4 % à valider) ; taux d'achats validés par le serveur sous 30 s ; taux de remboursement inférieur à 3 % (cible du propriétaire dans `docs/12`).

Événements : `paywall_viewed` (déclencheur : quota, super-like, undo, crédit, profil), `plan_selected`, `purchase_started`, `purchase_result` (purchased, cancelled, pending, error), `purchase_validation_result` (confirmed, timeout, délai), `restore_tapped`, `restore_result`, `manage_subscription_tapped`, `credits_viewed`, `credit_pack_purchase_started`, `credit_pack_purchased`, `premium_gate_dismissed`.

### 2.7 P7 : Signalement et blocage

Objectif utilisateur : se protéger vite et sans représailles. Objectif produit : traiter les signalements dans les délais cibles (24 h, 2 h pour mineur suspecté) ; la sécurité n'est jamais payante.

| # | Étape | Écran, route, fichier | Prévu (docs) | Constaté (code) | Friction |
| --- | --- | --- | --- | --- | --- |
| 1a | Depuis la carte | S10, bouton « Signaler » en pied | Menu, 3 taps | 1 touche vers `/report` | 3 touches au total (conforme) |
| 1b | Depuis le détail | S11, ⋯ puis Signaler | Idem | 2 touches vers `/report` | 4 touches au total |
| 1c | Depuis le fil | S14, ⋯ puis Signaler (ou bannière) | Idem | 2 touches vers `/report` | 4 touches au total |
| 1d | Depuis l'appel | S17, bouton Signaler | Idem | 1 touche | 3 touches au total |
| 2 | Motif | S58, `/report`, `safety/ReportScreen.tsx` | Motifs, détails | 6 cartes radio : demande d'argent, harcèlement, comportement lors d'une rencontre, faux profil ou spam, personne qui semble mineure, autre ; détails facultatifs (1 000 caractères) ; **Envoyer** explicite et désactivé sans motif | Le détail facultatif est un champ libre sous les motifs (peu de friction) ; pas de retour sur ce qui se passe ensuite (délai de traitement non montré, hypothèse) |
| 3 | Confirmation | Toast « signalement envoyé » (ou « déjà signalé ») puis retour | Message neutre si déjà signalé | Conforme | Pas de proposition de bloquer après le signalement (hypothèse d'amélioration) |
| 4 | Blocage | ⋯ puis Bloquer (carte de confirmation avec conséquence) ; fil : confirmer | Bloquer avec confirmation | Détail : confirmation avec texte « ne pourra plus vous voir ni vous écrire » ; fil : confirmation générique | Pas de blocage depuis la carte de découverte (seulement signaler) |
| 5 | Gestion | S54, `/settings/blocked`, `settings/BlockedScreen.tsx` | Débloquer | Liste avec débloquer | Pas de retour sur les signalements envoyés ; pas de notification de décision (inconnu : le plaignant est-il informé ?) |

Chiffrage : 3 à 4 touches pour signaler (E4) ; 2 à 3 pour bloquer ; aucun champ obligatoire sauf le motif.

Risques de décrochage (hypothèses) : peur de représailles ou de l'effet « dénonciateur » dans une communauté où tout le monde se connaît (persona C) ; ne pas savoir quoi choisir (6 motifs) ; ne rien voir après l'envoi ; abus par comptes jetables (Q2 des décisions, option B retenue) ; signaler un mineur suspecté sans consigne sur la suite.

Moments de confiance : le signalement le plus rapide possible ; confidentialité affirmée (« reste confidentiel ») ; confirmation de la conséquence d'un blocage ; message neutre si déjà signalé.

Obligations : signalement et blocage de tout contenu généré par les utilisateurs (UGC) exigés par les magasins ; protection des mineurs (zéro tolérance, motif dédié, revue prioritaire 2 h : cible, non dotée en personnel) ; DSA (piste vague 1 : mécanisme de notification, motivation des décisions, point de contact, `docs/legal/04`) ; contestation unique d'une sanction (`/settings/appeal`).

Métrique de succès : temps médian de traitement d'un signalement (`docs/01`) ; part des signalements envoyés par rapport aux ouvertures de l'écran (abandon de S58) ; taux de signalements « mineur suspecté » traités sous 2 h. Contre-métrique : taux de contestations acceptées (abus).

Événements : `report_entry_tapped` (source : card, detail, conversation, call, banner), `report_reason_selected` (motif), `report_submitted` (motif, avec ou sans détails, touches jusqu'à l'envoi), `report_abandoned`, `report_result` (sent, already_reported, error), `block_tapped` (source), `block_confirmed`, `unblock_confirmed`, `sanction_viewed`, `appeal_submitted`.

### 2.8 P8 : Suppression de compte et export

Objectif utilisateur : partir ou récupérer ses données sans obstacle. Objectif produit : conformité (magasins, RGPD) sans impasse.

| # | Étape | Écran, route, fichier | Prévu (docs) | Constaté (code) | Friction |
| --- | --- | --- | --- | --- | --- |
| 1 | Entrée | S50, `/settings`, `settings/SettingsScreen.tsx` | Réglages, S55 | Accès : Profil, Paramètres, Supprimer mon compte (ligne rouge en bas) : 3 touches | Chemin trouvable (bien) |
| 2 | Avertissement | S55, `/settings/delete-account`, `settings/DeleteAccountScreen.tsx` | Avertissements, ré-authentification | Bandeau (profil masqué tout de suite, suppression définitive à 30 jours), rappel d'abonnement avec accès direct à la gestion, champ mot de passe, bouton rouge | Compte social : le code renvoie à un message et au support si aucun SDK n'est branché (cas réel aujourd'hui : aucun bouton social, donc pas de compte social créable : fait, E2) |
| 3 | Confirmation | même écran | Confirmation lisible | Écran de succès : « Demande enregistrée. Votre profil est masqué. » + 30 jours + comment annuler (« contactez le support ») + rappel d'abonnement + Se déconnecter | **Sessions révoquées** dès la demande ; l'écran de support est derrière la connexion ; l'accueil réaffiche la notice **en mémoire seulement** (hypothèse : après redémarrage l'utilisateur ne sait plus comment annuler) |
| 4 | Web | `web/account/delete.html`, `web/confirm-deletion.html` | Page publique avec confirmation par e-mail (FR-I-15) | Pages et formulaires présents, **non branchés** (URL d'API fictive), textes provisoires | Bloquant pour la soumission (E11) |
| 5 | Export | S67, `/settings/export`, `settings/ExportScreen.tsx` | Demander, être notifié, télécharger | Ré-authentification par mot de passe, demande, sondage toutes les 5 s, bouton Télécharger (ouvre le lien signé dans le navigateur), expiration à 7 jours (politique de confidentialité), une demande par jour | Pas de notification quand c'est prêt (le docs en prévoit une) ; attente à l'écran ; téléchargement hors app (lien externe) |

Chiffrage : suppression : 3 touches d'accès + 1 champ + 1 bouton = 5 ; export : 3 touches + 1 champ + 1 bouton + attente + téléchargement.

Risques de décrochage (hypothèses) : peur que la suppression soit fictive (personne qui se méfie de la rétention) ; abonnement qui continue ; impossibilité d'annuler après coup ; export long à lire ; mot de passe oublié au moment de supprimer (la réinitialisation existe : lien hors app).

Moments de confiance : délai de grâce de 30 jours expliqué ; rappel de résilier l'abonnement dans le store ; aucune offre de rétention ; export sous 7 jours avec expiration annoncée.

Obligations : suppression de compte **dans l'app et sur le web** (magasins) ; export à la demande (RGPD, piste) ; durées de conservation à fixer par le juriste (sauvegardes 14 jours plus 3 mensuelles : écart déclaré dans `docs/legal/00` ; date de naissance réduite à l'année : à valider ; signalements et sanctions conservés un an) ; les durées annoncées à l'utilisateur doivent correspondre aux faits.

Métrique de succès : part des demandes de suppression terminées sans contact support ; temps jusqu'à confirmation ; taux d'abonnements actifs au moment d'une suppression (signal de risque de litige) ; part des exports livrés sous 5 minutes.

Événements : `settings_opened`, `delete_account_viewed`, `delete_account_submitted` (résultat), `delete_account_completed` (jours de grâce), `delete_subscription_manage_tapped`, `delete_cancel_contact_attempted`, `export_requested`, `export_ready_viewed`, `export_downloaded`, `export_expired`.

---

## 3. Moments de vérité

Un moment de vérité est un instant où l'utilisateur décide de rester, de payer, de se confier ou de partir. Classés par risque pour la confiance.

| # | Moment | Parcours | Pourquoi (fait ou hypothèse) | Condition de réussite à concevoir |
| --- | --- | --- | --- | --- |
| M1 | Première demande de la date de naissance | P1 | Fait : premier écran après l'accueil, avant toute valeur ; hypothèse : sentiment de contrôle policier | Dire pourquoi, dire que la date n'est pas affichée, ne jamais juger |
| M2 | Case « données sensibles » | P1 | Fait : libellé explicite sur orientation et vie affective ; hypothèse : alarme pour les profils discrets | Texte court, bénéfice clair, retrait facile (déjà dans `/settings/consents`) |
| M3 | Première photo envoyée | P2 | Hypothèse : exposition à la famille et à la communauté | Expliquer qui voit quoi, quand ; options de visibilité ; temps d'approbation honnête |
| M4 | Attente d'approbation de la photo | P2 | Fait : profil invisible jusqu'à approbation ; délai inconnu | Dire quand, notifier à l'issue, permettre de naviguer en attendant |
| M5 | Première carte vue | P3 | Hypothèse : jugement en 3 secondes de la qualité et du sérieux de l'app | Cartes de qualité (vérifié visible, intention, origine), jamais une pile vide |
| M6 | Premier match | P3 | Fait : écran sans animation, un seul message | Célébration légère, premier message facilité, accès sans impasse |
| M7 | Premier message et première réponse | P4 | Hypothèse : rupture d'élan si pas de réponse en 24 h | Aide à l'amorce sans scénario imposé ; rappel utile |
| M8 | Première demande d'argent reçue | P4 | Fait : bannière présente à l'envoi ; hypothèse : le moment où la confiance est gagnée ou perdue | Avertir à la **réception** aussi (à vérifier), signaler en un geste, ne pas accuser |
| M9 | Premier appel (ou sa promesse) | P5 | Fait : média non branché | Ne pas promettre ce qui ne marche pas ; permissions expliquées ; repli audio |
| M10 | Prix affiché au paywall | P6 | Fait : texte de renouvellement détaillé ; hypothèse : seuil de défiance | Prix, durée, renouvellement à côté du bouton ; aucune pression |
| M11 | Écran « validation en cours » après paiement | P6 | Fait : jusqu'à 30 s ; moment de peur après avoir payé | Rassurer, montrer qu'on ne perd rien, issue claire en cas de délai |
| M12 | Premier signalement | P7 | Hypothèse : peur de représailles ; fait : 3 à 4 touches | Rapidité, confidentialité, retour visible |
| M13 | Demande de suppression | P8 | Fait : sessions révoquées, annulation par le support | Aucun obstacle, aucune rétention, annulation possible et dite |

---

## 4. Convention d'événements d'analyse (à valider avant tout branchement)

Aucun SDK n'existe (section 0). Cette convention fixe les noms et les règles ; elle ne choisit pas d'outil.

- Nommage : `domaine_action` en minuscules et soulignés (`paywall_viewed`). Propriétés : `surface`, `step`, `result`, `error_code`, `duration_ms` (en classes si la précision permet de recouper), `locale`, `app_version`, `platform`, `market_wave` (1, 2, 3 ; jamais le pays si la base légale n'est pas validée).
- **Jamais** : date de naissance, e-mail, nom, genre recherché, orientation, texte de message, contenu de signalement, identifiants d'autres utilisateurs, localisation précise. Les propriétés des parcours P1, P3, P4, P7 doivent pouvoir se calculer sans ces valeurs.
- Identifiant : identifiant d'installation pseudonyme avant la connexion, identifiant interne après ; pas de croisement avec la publicité. Consentement : l'analyse non strictement nécessaire est une décision à valider avec le juriste (ePrivacy et RGPD, piste) et peut exiger un consentement séparé, à placer sur S63 ou plus tard (Q9).
- Mesure côté serveur quand possible (match créé, signalement envoyé, achat validé) : plus fiable que le client et sans SDK.
- Budget : un événement client ne doit jamais bloquer l'interface ni échouer bruyamment (réseau lent, principe 4).

Entonnoir cible (une ligne par étape, pour comparer les étapes entre elles) : `app_first_open`, `signup_started`, `age_gate_submitted(passed)`, `consents_accepted`, `account_created`, `onboarding_step_completed(profile)`, `photo_upload_succeeded`, `onboarding_completed`, `profile_visible`, `first_card_viewed`, `first_swipe`, `match_created`, `first_message_sent`, `first_reply_received`, `paywall_viewed`, `purchase_validation_result(confirmed)`.

---

## 5. Personas de travail

Règle : seuls les faits du dépôt sont affirmés ; tout le reste est marqué **hypothèse** et sert à orienter les entretiens. Ces personas ne sont pas des études de marché ; ils servent à décider quoi tester. Les noms sont des étiquettes de travail, pas des personnes.

### Persona A : « Le membre de la diaspora en recherche sérieuse » (vague 1)

Faits (source) : célibataire majeur d'origine africaine ou de la diaspora, vivant dans un pays de la vague 1 (France, Belgique, Suisse, Canada francophone) ; langue de base le français, anglais prévu (`docs/01`, E1) ; intentions les plus proches de ce profil : Mariage, Relation durable, « On verra bien » (`docs/01`, `05` S05) ; filtre par origine, pays de résidence et intention disponibles ; l'application cherche à faire passer du texte à la vidéo avant l'échange de coordonnées (`docs/01`) ; la monétisation passe par les achats intégrés des magasins (`docs/12`) ; le propriétaire dispose d'un iPhone (D6), donc iOS est testable.

| Rubrique | Contenu |
| --- | --- |
| Contexte | Appareil : hypothèse, smartphone récent ou milieu de gamme, iOS ou Android. Réseau : hypothèse, Wi-Fi et 4G ou 5G stables ; les données ne sont pas un frein. Langue : français ; hypothèse : aussi une langue d'origine, saisie du nom parfois non occidentale |
| Objectifs | Hypothèses : trouver une relation sérieuse avec quelqu'un qui partage une origine ou une culture ; éviter les applications généralistes jugées superficielles ; avancer vers la vidéo puis la rencontre |
| Peurs | Arnaques sentimentales (fait : demande d'argent est le premier motif de signalement et une règle de la communauté) ; faux profils et photos réutilisées (fait : signal de détection FR-I-4) ; hypothèse : exposition à la famille ou à la communauté ; hypothèse : perte de temps et de crédibilité en cas de profils peu sérieux |
| Jobs-to-be-done (hypothèses) | « Quand je cherche une relation durable, je veux voir seulement des personnes qui cherchent la même chose, pour ne pas perdre de temps. » « Quand je commence à parler, je veux m'assurer que la personne est réelle avant de donner mon numéro. » « Quand on me demande de payer, je veux comprendre précisément ce que j'achète. » |
| Implications de design | La vérification et l'intention doivent être lisibles sur la carte ; le chemin texte vers vidéo doit être guidé et honnête (aujourd'hui non livré) ; avantages Premium et prix sans surprise ; explications courtes sur le badge « vérifié » (promesse limitée) ; premier message facilité sans scénario imposé |

### Persona B : « Le résident contraint par le réseau et le paiement » (vague 2)

Faits (source) : vit en Afrique francophone (Côte d'Ivoire, Sénégal, Cameroun, Bénin) ; le fondateur est en Côte d'Ivoire (`prompt` §2, `DECISIONS-PROPRIETAIRE.md`) ; les adresses IP des réseaux mobiles africains sont partagées (CGNAT : limites par compte et appareil d'abord, `docs/10`) ; moyens de paiement locaux limités, Mobile Money encore ouvert (`docs/12`, `prompt` principe 6) ; la vidéo doit être allégée pour les réseaux lents (D3, FR-B-9 : 240p, 360p, 480p et économie de données) ; l'application vise Android 8+ et iOS 15+ (`docs/06`, « à confirmer ») ; cadre juridique non étudié, risques possibles sur certains contenus (`docs/legal/04`, vague 2).

| Rubrique | Contenu |
| --- | --- |
| Contexte | Appareil : hypothèse, Android d'entrée de gamme ou de milieu de gamme, stockage limité. Réseau : fait partiel (CGNAT, vidéo allégée) ; hypothèse : 3G ou 4G intermittente, données mobiles chères et achetées par petits forfaits. Langue : français ; hypothèse : français courant mêlé à des langues locales à l'oral |
| Objectifs | Hypothèses : rencontrer des personnes sérieuses dans son pays ou à l'étranger (mariage, relation durable) ; rester discret vis-à-vis de l'entourage |
| Peurs | Arnaques (hypothèse : exposé aux demandes d'argent des deux côtés) ; coût des données ; exposition à la famille ou à la communauté ; hypothèse : risque légal ou social selon le pays (point de vigilance fort du prompt §4 principe 6) |
| Jobs-to-be-done (hypothèses) | « Quand ma connexion est lente, je veux pouvoir utiliser l'application sans qu'elle consomme mes données. » « Quand je veux payer, je veux un moyen que je possède (la carte bancaire internationale n'est peut-être pas disponible). » « Quand je discute, je veux savoir si la personne est vraiment qui elle dit être. » |
| Implications de design | Légèreté (images à plusieurs tailles, squelettes, réessais, pas de perte de saisie) ; sélection de pays et saisie du nom adaptées ; connexion par compte tiers à envisager pour réduire la saisie (E2) ; l'achat intégré peut être le seul chemin autorisé tant que Mobile Money reste ouvert (Q5) ; audio comme repli de la vidéo ; textes simples, polices lisibles à grande taille ; discrétion (notifications sans aperçu, masquage du profil) |

### Persona C : « La personne prudente et discrète » (transversal, toutes vagues)

Faits (source) : l'orientation sexuelle est déductible du genre et du genre recherché, donc donnée sensible (`docs/legal/00`) ; certains marchés ont des risques légaux sur les relations entre personnes de même sexe (`docs/legal/04`, vague 2) ; réglages de confidentialité existants : masquer le profil, la distance, la dernière connexion (`/settings/privacy`) ; blocage et signalement partout ; pas d'aperçu de message dans les notifications par défaut (principe du prompt §7) ; consentement séparé pour les données sensibles et pour la biométrie de vérification ; export et suppression de compte avec délai de grâce de 30 jours.

| Rubrique | Contenu |
| --- | --- |
| Contexte | Appareil et réseau : hypothèse, variable ; peut partager le téléphone avec un proche. Langue : français ou anglais. Âge, genre et origine : hypothèse, ne sont pas définis (cette personne existe dans toutes les catégories) |
| Objectifs | Hypothèses : rencontrer sans être identifié par la famille, les collègues ou la communauté ; garder le contrôle de ses données ; pouvoir partir sans trace |
| Peurs | Outing ou exposition publique (hypothèse) ; fuite de données ; messages ou photos montrés sans accord ; rencontre dangereuse ; harcèlement après un refus |
| Jobs-to-be-done (hypothèses) | « Quand je m'inscris, je veux savoir qui verra mon profil et quelles données sont utilisées. » « Quand je reçois une notification, je ne veux pas que son contenu s'affiche sur l'écran verrouillé. » « Quand je veux partir, je veux supprimer mon compte et être sûr(e) que c'est fait. » « Quand quelqu'un me dérange, je veux le bloquer ou le signaler sans qu'il le sache. » |
| Implications de design | Confidentialité visible dès l'inscription (qui voit quoi) ; réglages de discrétion accessibles sans fouiller ; textes de consentement courts, non médicaux ; notifications sans aperçu ; blocage et signalement confidentiels, sans notification à l'autre ; suppression et export sans impasse (E10, E11) ; ne pas déduire ni afficher l'orientation ; champ de genre à trancher avec le propriétaire et le juriste (Q8) ; **aucune décision seule** sur les restrictions par pays (prompt §7) |

Limite commune : ces trois personas ne couvrent pas les marchés de la vague 3 ni les anglophones, qui n'ont pas de faits suffisants dans le dépôt (inconnu : leur poids au lancement).

---

## 6. Plan de recherche de validation

Objectif : valider ou réfuter les hypothèses de la section 5 et du parcours (en particulier longueur d'inscription, peur des arnaques, étape photo, confiance dans le paywall, discrétion), avant les phases 4 à 7.

### 6.1 Format et calendrier

Hypothèse de calendrier : 2 semaines de recrutement, 1 semaine d'entretiens, 1 semaine de synthèse (`design:research-synthesis`). Aucun entretien ne commence sans validation du propriétaire (décision Q12 sur le budget et les incitations). Les entretiens sont menés par une personne formée, avec un second rôle d'observateur ; l'équipe de développement n'anime pas.

Matériel : une **version de test** de l'application (EAS) connectée à un serveur isolé avec données fictives ; ou, à défaut, un prototype cliquable. Deux points sont **non testables aujourd'hui** : les appels (média non branché) et l'achat réel (RevenueCat non éprouvé, `docs/16`). Pour les tester, il faut un prototype d'appel (prototype D0) et un paywall en environnement de test des magasins ; sinon ces deux tâches se font sur maquette ou « magicien d'Oz » en le disant au participant.

### 6.2 Entretiens : 8 au maximum (cible 5 à 8)

| Groupe | Nombre | Profil |
| --- | --- | --- |
| France ou Belgique | 4 | 2 personnes cherchant mariage ou relation durable (profil A) ; 1 personne ayant déjà utilisé une application de rencontres spécialisée diaspora ; 1 personne discrète (profil C) |
| Côte d'Ivoire, Sénégal ou Cameroun | 4 | 1 par pays plus 1 supplémentaire ; Android d'entrée de gamme obligatoire pour 2 d'entre eux ; 1 personne discrète (profil C) ; mix de villes et de niveaux d'usage des données |

Critères communs de recrutement :
- 18 ans et plus (preuve simple : déclaration, pas de pièce d'identité) ; célibataire ou séparé(e), prêt(e) à utiliser une application de rencontres.
- Origine africaine ou diaspora, selon la définition du produit (`docs/01`) ; ne pas demander l'orientation ni la religion ; laisser le participant se décrire.
- Équilibre hommes et femmes (au moins 3 de chaque genre sur 8 ; « autre » accepté sans question) ; âges variés (18 à 55 ans environ ; hypothèse de tranche).
- Exclusions : employés, partenaires, famille ou amis de l'équipe ; professionnels de l'UX et du marketing ; personnes ayant participé à une étude de rencontres dans les 6 derniers mois.
- Usage : a utilisé au moins une fois une application de rencontres ou de messagerie ; ne pas exiger de l'expérience.
- Langue : français (interface en français) ; version anglaise à tester plus tard.
- Appareil : le sien (Android et iOS), pour voir les vraies conditions ; réseau réel du participant.
- France et Belgique : recrutement via panels, réseaux associatifs, centres communautaires (liste à constituer avec le propriétaire). Côte d'Ivoire, Sénégal, Cameroun : recrutement via partenaires locaux de confiance ; sessions à distance (audio et partage d'écran) ou en présentiel sur site neutre ; un facilitateur local (langue et contexte).

### 6.3 Consentement et protection des données

Éléments à valider par le juriste (ils relèvent de `docs/legal/04` et des lois nationales, non lues par l'équipe) :
- Information écrite préalable, claire, en français : qui mène l'étude, pourquoi, quelles données (voix, écran, réponses), combien de temps, qui y accède, comment se retirer.
- Consentements **séparés** : participation, enregistrement audio ou vidéo, enregistrement de l'écran, usage d'extraits dans des documents internes. Refus d'enregistrer accepté sans pénalité ; prise de notes à la place.
- Droit de se retirer à tout moment et de demander la suppression des enregistrements ; aucun lien de cause à effet avec l'incitation.
- Données minimales : pseudonyme (P1 à P8) ; pas de nom dans les notes ; pas de pièce d'identité ; ne **pas** collecter ni déduire l'orientation, la santé, la religion ou la situation légale du participant.
- Stockage chiffré, accès limité à l'équipe de recherche, localisation du stockage à décider (UE de préférence pour les participants de France et de Belgique ; autres pays : voir juriste) ; durée de conservation à fixer (proposition, hypothèse : suppression des enregistrements après synthèse, au plus 6 mois, notes pseudonymisées conservées).
- **Aucune donnée réelle** de participant dans le serveur de test : comptes fictifs, photos fournies, aucune vraie mise en relation entre participants, aucune notification réelle ; les participants ne se voient pas entre eux.
- Sujets sensibles (arnaques vécues, rencontres négatives) : prévenir, laisser sauter une question, orienter vers un soutien si une personne rapporte un préjudice ; ne jamais exiger de détails personnels.
- Incitation : montant et mode de paiement locaux à décider (Q12) ; ne pas lier l'incitation à un avis positif ni à un achat réel.
- Mineurs : exclusion stricte ; en cas de doute sur l'âge, arrêter la session.

### 6.4 Script de test modéré : 10 tâches (60 minutes)

Ordre : accueil de 5 minutes (consentements, rappel « on teste l'application, pas vous »), tâches, entretien de clôture de 10 minutes. Consigne : penser à voix haute. Les durées sont des repères. Chaque tâche note : réussite (oui, avec aide, non), nombre de touches, erreurs, citations, moments d'hésitation, confiance perçue de 1 à 7.

| # | Tâche (consigne au participant) | Parcours | Ce qu'on observe | Hypothèse testée |
| --- | --- | --- | --- | --- |
| T1 | « Vous ouvrez l'application pour la première fois. Dites-moi ce que c'est et à qui elle s'adresse. » (5 secondes, puis relecture) | P1 | Compréhension de la promesse, confiance, réaction à l'absence de logo | L'accueil suffit à comprendre l'offre et à inspirer confiance |
| T2 | « Créez un compte. » | P1 | Date de naissance, consentements, mot de passe, e-mail ; temps ; points d'hésitation ; lecture ou non des textes | L'ordre et la longueur sont acceptables ; la case « données sensibles » inquiète |
| T3 | « Complétez votre profil comme pour une vraie présentation, avec une photo de test fournie. » | P2 | Choix de pays, nom, ville, intention, photo ; questions sur qui verra quoi | Étape photo et exposition de la communauté |
| T4 | « Réglez vos préférences pour ne voir que des personnes qui cherchent une relation sérieuse. » | P2, P3 | Bouton − et + pour l'âge, puces de pays ; compréhension du filtre | Les contrôles d'âge au pas de 1 sont fastidieux |
| T5 | « Parcourez quelques profils et dites lesquels vous semblent dignes de confiance, et pourquoi. » | P3 | Lecture de la carte et du détail, sens du badge « vérifié », signaux de confiance | La carte porte assez de confiance |
| T6 | « Vous avez un match. Écrivez un premier message. » | P3, P4 | Écran de match, amorce, peur de la page blanche | L'amorce est difficile ; le match est peu célébré |
| T7 | « La personne vous écrit : “Peux-tu m’envoyer 50 euros pour mon billet ?”. Que faites-vous ? » (message fictif, bannière montrée selon le cas) | P4, P7 | Lecture de la bannière, signalement, blocage, nombre de touches, ressenti | La bannière informe sans accuser ; 3 à 4 touches suffisent |
| T8 | « Vous voulez continuer au-delà de la limite de likes. Qu’est-ce que Premium ? Combien ça coûte, quand ça se renouvelle, comment arrêter ? » (environnement de test) | P6 | Lecture du prix et du renouvellement, repérage de « Gérer », restauration, confiance | Prix et résiliation compris sans aide |
| T9 | « Faites vérifier votre profil. Qu’est-ce que cela prouve, selon vous ? » (selfie fictif) | P7 voisin | Compréhension du badge, consentement biométrique, délai attendu | La promesse « pas une garantie d'identité » est comprise |
| T10 | « Vous voulez partir : supprimez votre compte et demandez une copie de vos données. » (compte fictif) | P8 | Chemin trouvé, ré-authentification, compréhension du délai de 30 jours, annulation | Le chemin est clair ; l'impasse du support se confirme |

Le script comporte un bloc de sondage sur l'appel (hors tâche, faute de média) : « Comment utiliseriez-vous l'appel avant de donner un numéro ? Quelle serait la limite acceptable ? » (audio ou vidéo, durée, bruit). Questions de clôture : trois mots pour l'application ; à qui ne la confieriez-vous pas ; ce qui vous fait peur le plus ; qu'attendez-vous d'une bannière anti-arnaque ; quelles données vous gênent ; comment payeriez-vous (Mobile Money, carte, autre) sans suggérer de réponse.

### 6.5 Trois métriques à mesure non modérée

Outils à choisir plus tard (décision de dépendances, `prompt` §7). Seuils indiqués = **hypothèses de travail**, pas des cibles validées.

| # | Métrique | Méthode non modérée | Mesure | Seuil de travail (hypothèse) |
| --- | --- | --- | --- | --- |
| M-A | Réussite et durée de l'inscription jusqu'à la première carte vue | Test à distance sur la version de test, sur l'appareil du participant (50 personnes si faisable, hypothèse de taille) ; chronométrage par événements (section 4) | Part de participants qui terminent ; temps médian ; étape où ils s'arrêtent ; erreurs | À fixer avec le propriétaire après la première mesure ; comparer avant et après les changements des phases 4 |
| M-B | First-click sur « Où signaler cette personne ? » | Test de premier clic sur captures (carte, profil, conversation, appel) | Part de premiers clics corrects ; délai | Hypothèse : au moins 80 % de bons premiers clics sur chaque surface |
| M-C | Compréhension du paywall et note de confiance | Questionnaire de 3 questions après affichage du paywall (prix, durée de renouvellement, comment résilier), plus l'item « Je me fierais à cette application, de 1 à 7 » | Part de réponses justes aux 3 questions ; moyenne de confiance | Hypothèse : au moins 90 % de réponses justes ; à comparer par groupe (France, Belgique, Afrique) |

### 6.6 Synthèse et sortie

Sorties : une synthèse par hypothèse (confirmée, infirmée, nuancée, inconnue), un tableau de priorités avec les P0, P1, P2 du futur `00-audit.md`, et une mise à jour des personas (suppression des hypothèses non confirmées). Les extraits utilisés dans des documents sont pseudonymisés ; aucun visage ni voix de participant n'est publié en dehors de l'équipe de recherche sans consentement spécifique.

---

## 7. Hypothèses à valider (récapitulatif)

| # | Hypothèse | Validation |
| --- | --- | --- |
| H1 | Environ 28 touches pour s'inscrire est trop long pour la vague 2 | Mesure M-A, T2 à T4 |
| H2 | Pas de connexion sociale freine l'inscription sur mobile | T2, entretien, mesure M-A |
| H3 | La date de naissance en premier crée une défiance | T1 et T2 |
| H4 | La case « données sensibles » inquiète les profils discrets | T2, entretien persona C |
| H5 | L'étape photo est le principal point d'abandon, surtout pour la peur d'exposition | T3, entretien |
| H6 | L'attente d'approbation de la photo fait décrocher | Mesure serveur de délai, entretien |
| H7 | La carte de découverte ne porte pas assez de confiance (badge peu saillant) | T5 |
| H8 | Dépenser un crédit sans confirmation détruit la confiance | T6 et T8, entretien |
| H9 | Un fil vide fait perdre le premier message | T6 |
| H10 | Une bannière anti-arnaque qui informe sans accuser est acceptée | T7 |
| H11 | 3 à 4 touches suffisent pour signaler ; la peur de représailles est plus forte que le nombre de touches | T7, M-B |
| H12 | Les utilisateurs de la vague 2 ne peuvent pas payer par les magasins | Entretiens Afrique, Q5 |
| H13 | La présélection de l'offre la plus longue est perçue comme une poussée | T8 |
| H14 | L'appel est jugé indispensable avant le numéro | Sondage entretien |
| H15 | Le chemin « annuler la suppression par le support » est une impasse | T10 |

---

## 8. Les 15 questions les plus utiles à poser au propriétaire

Triées par valeur décisionnelle. Chaque question donne l'enjeu et une recommandation de départ (à confirmer ou à refuser).

| # | Question | Enjeu | Recommandation de départ |
| --- | --- | --- | --- |
| Q1 | Quelle est la **priorité du lancement** : réussir d'abord la vague 1 (France, Belgique, Suisse, Canada) ou lancer plus tôt en Afrique francophone ? | Toute la hiérarchie des personas A et B, le réseau, le paiement, la modération | Vague 1 d'abord (conforme à E1), avec une version légère pour la vague 2 préparée en parallèle |
| Q2 | Combien de **personnes réelles** pouvez-vous réunir pour les 5 à 8 entretiens, par pays, et par quels réseaux ? | Faisabilité du plan de recherche | 4 en France ou Belgique, 4 en Afrique via un partenaire local de confiance |
| Q3 | La **connexion Google et Apple** est-elle exigée à la sortie de la bêta (E2) ? | Longueur d'inscription, vague 2 | Oui pour Google et Apple (déjà prévu côté serveur) ; TikTok non |
| Q4 | Quelle est la taille de base visée au lancement dans chaque ville, et quelle stratégie contre la **pile vide** ? | Qualité de la découverte, rétention | Lancement en une ou deux villes denses, liste d'attente, ouverture progressive |
| Q5 | Autorisez-vous le **Mobile Money** ou un paiement local hors achats intégrés (hors app, règles différentes), et dans quels pays ? | Persona B, revenus en vague 2 | Achats intégrés seulement au lancement ; Mobile Money à étudier avec le juriste après la vague 1 |
| Q6 | Le **paywall** est-il discret (comme aujourd'hui) ou bloquant à partir d'un seuil ? Souhaitez-vous une période d'essai ? | Conversion contre confiance | Discret, jamais bloquant pour la sécurité ; essai à tester seulement avec un message clair |
| Q7 | Quel **délai promis** pour l'approbation d'une photo, d'un signalement et d'une vérification, et qui modère (budget, personnes, heures) ? | Promesses affichées, confiance, risque store | 24 h avec message honnête ; ne rien promettre tant que le budget (spec 011 T024) n'est pas arrêté |
| Q8 | **Genre** : ajoutez-vous « préfère ne pas dire », et que fait-on de la déduction de l'orientation ? | Persona C, risque légal | Ajouter l'option ; ne jamais afficher ni déduire ; avis du juriste avant le lancement |
| Q9 | Autorisez-vous des **analyses d'usage** (outil, consentement, hébergement) ? | Mesure de tous les parcours | Mesure serveur d'abord ; outil client seulement après décision légale et consentement séparé |
| Q10 | **Appels** : sont-ils encore une promesse du lancement si le prototype D0 échoue ? Quel repli (audio seul, appel externe) ? | Persona A, promesse de confiance | Garder l'appel pour les matchs ; en cas d'échec, audio seul ; ne pas afficher de boutons sans effet |
| Q11 | **Restrictions par pays** (fonctions, visibilité) pour les marchés à risque légal : qui décide et quand ? | Persona C, vague 2 | Décision du propriétaire avec le juriste ; aucun choix du design seul |
| Q12 | **Budget et incitations** de la recherche (montant, mode de paiement local) et qui fait la facilitation en Afrique ? | Plan de recherche | Un budget forfaitaire et un facilitateur local rémunéré |
| Q13 | Quelle **marque visuelle** peut être fixée avant la recherche d'antériorité (AILO, Aylo), et le logo est-il bloqué ? | Phase 1, accueil sans logo | Direction sans logo définitif ; accueil minimal honnête |
| Q14 | Quelles **cibles** de succès (inscription terminée, profil visible, match en 7 jours, conversion) voulez-vous poser, et sur quelle durée ? | Métriques de chaque parcours | Mesurer 4 semaines puis fixer ; ne pas figer des chiffres sans donnée |
| Q15 | **Suppression et annulation** : acceptez-vous une annulation en libre-service pendant les 30 jours (reconnexion qui annule) et une page web de suppression branchée avant tout envoi aux magasins ? | Persona C, magasins | Oui aux deux ; décrire la procédure dans l'app, sans dépendre du support connecté |

---

## 9. Prochaine étape proposée

1. Faire relire cette phase par le propriétaire ; arbitrer Q1 à Q15, au moins Q3, Q6, Q7, Q8, Q10 et Q15 qui conditionnent la phase 4.
2. Exécuter la phase 0 restante (`00-audit.md`) avec un rendu sur appareil, pour confirmer les nombres de touches et les écarts E1 à E11.
3. Préparer la version de test et le recrutement en parallèle (section 6).

Risques : les chiffres de friction viennent de la lecture du code ; l'absence de rendu sur appareil peut en modifier plusieurs. Les obligations légales citées sont des pistes. Aucune statistique n'est inventée.
