# Plan de test : Ayelo (clone de Chat&Yamo, application mobile + backend Laravel)

Build : `e4f6954` + les corrections de cette passe (BUG-001 à BUG-003)  Date : 2026-11-17  Env : local, données de démonstration (`PreviewSeeder`), PostgreSQL 16 jetable, API Laravel réelle, application servie par Expo web (390 x 844, `fr-FR`).

Règle : on teste notre clone, jamais l'application d'origine. Les flux viennent de `replica/recon.md` (F01 à F08).

## Comment lire ce plan

- **Colonne `auto`** : `e2e` = spécification Playwright dans `e2e/` (navigateur réel contre l'API réelle), `pest` = test backend existant, `jest` = test mobile existant (composants, avec API simulée), `manual` = à faire à la main ou sur appareil, `n/a` = non applicable.
- **Colonne `result`** : `pass e2e` / `fail e2e` = spécification Playwright exécutée le 2026-11-17 (suite complète : 37 réussis, 1 ignoré, 1 échec transitoire rejoué avec succès) ; `pass pest` / `pass jest` = test existant, suite complète verte le 2026-11-17 (Pest 519, Jest 803) ; `manual` = non fait ; `non fait` = prévu par le plan, aucune spécification écrite ni exécutée dans cette passe. Une cellule vide n'a pas été exécutée.
- Un test Jest n'exerce pas le vrai backend : il ne compte que comme couverture du comportement de l'écran. Un test Pest n'exerce pas l'écran. Seuls les cas `e2e` traversent les deux.
- Cas d'environnement : l'aperçu local n'a ni stockage de photos, ni temps réel, ni push, ni achats, ni appels (voir `docs/runbooks/apercu-local.md`). Ces cas sont `manual` et restent non vérifiés tant qu'ils ne sont pas faits sur appareil avec de vrais services.

## Portée réelle par rapport à la recon

| flux | dans le produit | remarque |
| --- | --- | --- |
| F01 inscription | oui | contrôle d'âge, consentements, compte, vérification d'e-mail, intention, profil, photos, préférences |
| F02 trouver et contacter | oui | découverte, filtres, fiche, like, affinité, conversation |
| F03 appel vidéo | code présent, **écran masqué** (`CALLS_ENABLED=false`) | le backend et les jetons sont testés ; aucun appel n'a été établi |
| F04 invitation vidéo | **non implémenté** | aucune route ni écran (`grep` sur `backend/routes` : aucun résultat). Écart de périmètre à trancher, pas un bogue |
| F05 Premium | oui (paywall, restauration, gestion) | achat réel impossible hors appareil avec compte de test des stores |
| F06 signaler ou bloquer | oui | |
| F07 supprimer le compte | oui | délai de grâce de 30 jours |
| F08 masquer le profil | oui, dans Confidentialité | |

## F01 Inscription

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | inscription | happy | accueil, « Créer mon compte », date de naissance majeure, consentements, e-mail et mot de passe | compte créé, étape de vérification d'e-mail | e2e (jusqu'au compte) ; pest `crée un compte avec la date de naissance du jeton…` | pass e2e (connexion sans erreur de console ni 5xx ; création du compte + connexion API) ; pass pest |
| F01-H2 | inscription | happy | lien de vérification reçu, saisie du code | e-mail vérifié une seule fois | pest `envoie un e-mail de vérification…` ; e-mail réel : manual | pass pest ; e-mail réel : manual |
| F01-H3 | onboarding | happy | intention, profil, photos, préférences | arrivée dans la découverte | jest `onboardingDesign`, `profileFlow` ; **dépôt de photo : manual** (pas de stockage en aperçu) | pass jest ; photos : manual |
| F01-E1 | inscription | edge : âge inférieur à 18 | saisir une date de naissance de mineur | refus neutre, pas de compte, refus mémorisé pour l'appareil | e2e ; pest `refuse un mineur avec un message neutre…` | pass e2e (fichier `zz-`) ; pass pest |
| F01-E2 | inscription | edge : exactement 18 ans aujourd'hui / demain | | accepté / refusé | pest `accepte exactement 18 ans aujourd’hui…` | pass pest |
| F01-E3 | inscription | edge : e-mail déjà pris | s'inscrire avec `apercu@example.test` | message d'erreur sans fuite d'information inutile, aucun doublon | e2e ; pest `refuse un e-mail déjà utilisé` | pass pest ; e2e non fait |
| F01-E4 | inscription | edge : mot de passe faible ou trop court | 9 caractères, sans chiffre | refus avec message de champ | e2e ; pest `exige les consentements obligatoires et un mot de passe solide` | pass pest ; e2e non fait |
| F01-E5 | inscription | edge : double clic sur « Créer le compte » | deux clics rapprochés | un seul compte, pas d'erreur 5xx | e2e (compte jetable) | pass e2e (double clic : une seule requête `POST /auth/register`) |
| F01-E6 | inscription | edge : emoji, accents, très long nom | nom `Zoé 🌍` puis 200 caractères | accepté / tronqué à la limite avec message | e2e ; jest `profileFlow` | pass jest ; e2e non fait |
| F01-E7 | inscription | edge : retour arrière en cours de parcours | retour depuis les consentements | l'état précédent est conservé ; **limite connue : les consentements cochés sont perdus à l'ouverture d'un texte légal** | e2e ; jest `flow.test.ts` | pass jest ; retour arrière e2e non fait |
| F01-E8 | inscription | edge : actualisation de la page en cours de parcours | recharger sur les consentements | retour à l'accueil sans erreur (la session web est perdue au rechargement) | e2e | pass e2e |
| F01-E9 | inscription | edge : jeton d'âge falsifié, expiré, d'un autre appareil | | refus | pest (3 tests) | pass pest |
| F01-E10 | inscription | edge : réseau coupé | couper le réseau pendant l'envoi | message d'erreur réseau, bouton réactivé | e2e | pass e2e |
| F01-E11 | inscription | edge : clavier seul, étiquettes de lecteur d'écran | Tab, Entrée | focus visible, champs étiquetés | e2e (axe + Tab) ; VoiceOver et TalkBack : manual | pass e2e (Tab, focus visible) ; lecteurs d'écran : manual |
| F01-N1 | connexion | negative : mauvais mot de passe | | message identique pour e-mail inconnu et mauvais mot de passe | e2e ; pest `renvoie la même erreur…` | pass e2e ; pass pest |
| F01-N2 | connexion | negative : 6e tentative en 15 minutes | | 429 avec message d'attente | pest `limite les tentatives de connexion à 5 par 15 minutes` ; e2e : non (épuiserait la limite de l'aperçu) | pass pest |
| F01-N3 | connexion | negative : compte en cours de suppression | | connexion refusée | pest `autorise la connexion d’un compte suspendu…` | pass pest |
| F01-N4 | connexion | negative : session expirée | jeton révoqué côté serveur puis une action | retour à la connexion avec un message | e2e | **fail e2e puis pass** : BUG-001 (corrigé) |
| F01-N5 | mot de passe oublié | negative : e-mail inconnu | | même réponse que pour un e-mail connu | e2e ; pest `répond de la même façon…` | pass e2e ; pass pest |

## F02 Trouver et contacter une personne

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F02-H1 | découverte | happy | se connecter, ouvrir la découverte | une carte profil avec nom, âge, photo (illustration) | e2e | pass e2e |
| F02-H2 | fiche profil | happy | ouvrir la fiche depuis la carte | détails, menu « … » | e2e | pass e2e |
| F02-H3 | like et affinité | happy | « J'aime » sur un profil qui a déjà aimé | écran d'affinité, bouton « Écrire » | e2e (si le jeu de données le permet) ; pest `crée exactement un match et une conversation…` | non fait e2e (affinité réciproque impossible à provoquer avec un seul membre connectable) ; pass pest |
| F02-H4 | messagerie | happy | ouvrir une conversation, envoyer un message | message affiché, enregistré côté serveur | e2e ; pest `envoie un message…` | pass e2e (liste des 3 conversations) ; message envoyé, affiché et relu côté serveur : pass e2e (F02-H4b) ; pass pest |
| F02-H5 | choix | happy | « Passer » sur la carte du dessus | choix enregistré côté serveur (`POST /swipes`), carte suivante | e2e | pass e2e |
| F02-H6 | filtres | happy | filtrer par pays de résidence et d'origine (Pays-Bas) | la pile change ; sans correspondance : état vide avec « Modifier les filtres » (couvre F02-E1) | e2e ; pest `filtre par pays, origine, intention, âge et genre recherché` | pass e2e ; pass pest |
| F02-E1 | filtres | edge : aucun résultat | filtre sans correspondance | état vide avec action « élargir » | e2e (dans F02-H6) | pass e2e |
| F02-E2 | messagerie | edge : message vide, très long, emoji | | vide refusé, long limité, emoji conservé | e2e ; pest `valide le contenu…` | pass e2e (au-delà de 2000 caractères : 422, jamais 5xx) ; pass pest |
| F02-E3 | messagerie | edge : double clic sur « Envoyer » | | un seul message (idempotence `client_id`) | e2e ; pest `est idempotent…` | pass e2e (une seule requête, un seul message) ; pass pest |
| F02-E4 | messagerie | edge : deux onglets en même temps | écrire dans l'un, recharger l'autre | l'autre voit le message après rafraîchissement | e2e (pas de temps réel en aperçu) | pass e2e (le message est visible depuis un second appareil connecté séparément ; pas de temps réel en aperçu) |
| F02-E5 | découverte | edge : quota de likes | épuiser les likes gratuits | bannière « limite atteinte » avec accès Premium | jest `discover.test` ; pest `limite les likes d’un compte gratuit…` ; e2e : non (quota non atteignable sans 100+ actions) | pass jest ; pass pest ; e2e non fait |
| F02-E6 | conversation | edge : conversation sans crédit | ouvrir hors match sans crédit | refus avec proposition d'achat | pest `exige un crédit ou un Premium…` ; jest `messages.test` | pass pest ; pass jest |
| F02-E7 | données d'autrui | edge : second utilisateur | lire la conversation ou le profil d'un tiers par l'API | 403 / 404, aucune donnée | pest `refuse l’accès aux messages d’une conversation dont on n’est pas membre`, `affiche le profil d’un autre utilisateur seulement s’il est visible…` ; e2e (appel API direct) | pass e2e (compte tiers : 403/404, aucune donnée) ; pass pest |
| F02-E8 | conversation | edge : réseau lent ou coupé à l'envoi | | message en échec avec « Réessayer », rien de perdu | e2e | non fait |
| F02-E9 | découverte | edge : fuseaux horaires et changement d'heure | dernière connexion, heures des messages | heures locales, stockage en UTC | jest ; **manual** (changement d'heure) | manual |
| F02-E10 | tous | edge : largeur mobile 320 pt, texte à 200 % | | pas de débordement | e2e 320 pt ; 200 % : manual sur appareil | pass e2e à 320 pt (aucun débordement horizontal sur 8 écrans) ; 200 % : manual |
| F02-E11 | tous | edge : clavier seul, lecteur d'écran | | focus visible, noms accessibles | e2e (axe) ; lecteurs : manual | pass e2e (axe : voir BUG-002 et BUG-003, corrigés) ; lecteurs d'écran : manual |
| F02-N1 | profil bloqué | negative : écrire à un utilisateur bloqué | | impossible des deux côtés | pest `interdit d’écrire après un blocage…` | pass pest |
| F02-N2 | profil supprimé | negative : profil supprimé ou masqué | | introuvable, pas d'erreur 500 | pest `refuse d’ouvrir une conversation avec un profil masqué ou bloqué` | pass pest |

## F03 Appel vidéo (écran masqué)

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F03-H1 | appel | happy | démarrer, accepter, raccrocher | appel établi | pest (jetons, états) ; **aucun appel réel établi : manual avec LiveKit** | pass pest ; aucun appel réel : manual |
| F03-E1 | appel | edge : bouton d'appel absent tant que `CALLS_ENABLED=false` | ouvrir une conversation | aucun bouton d'appel, aucun appel entrant géré | e2e ; jest `calls.test` | pass e2e ; pass jest |
| F03-N1 | appel | negative : appel à un utilisateur bloqué, appel à un non-participant | | refusé | pest `refuse un appel à un utilisateur bloqué…` | pass pest |
| F03-N2 | appel | negative : permission caméra ou micro refusée | | message clair | manual (appareil) | manual |

## F04 Invitation vidéo : non implémenté

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F04-X1 | invitation | écart | chercher un écran ou une route d'invitation | aucun : fonction absente | e2e (aucun lien « Invitations » visible) | pass e2e (aucune invitation dans l'interface) |

## F05 Premium

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F05-H1 | paywall | happy | Profil, Premium | offres affichées, achat désactivé avec explication (aucun store en aperçu) | e2e | pass e2e (paywall affiché sans erreur, restauration visible) |
| F05-H2 | abonnement | happy | achat sandbox, retour | statut Premium mis à jour par le webhook | pest `active un abonnement Premium…` ; **achat réel : manual** | pass pest ; achat réel : manual |
| F05-E1 | webhook | edge : même événement deux fois, ordre inversé | | traité une fois | pest `traite deux fois le même événement une seule fois`, ordre dans `BackendChecklistTest` | pass pest |
| F05-E2 | abonnement | edge : déjà abonné, restauration d'achat | | pas de second achat ; restauration possible | jest `premium.test` ; manual | pass jest ; manual |
| F05-N1 | achat | negative : carte refusée, achat annulé | | aucun changement de statut | **manual (store)** | manual |
| F05-N2 | webhook | negative : sans secret, mauvais secret | | 401, rien d'appliqué | pest `refuse un webhook sans secret ou avec un mauvais secret` | pass pest |

## F06 Signaler ou bloquer

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F06-H1 | blocage | happy | fiche, menu, « Bloquer », confirmer | profil disparu de la découverte, présent dans « Profils bloqués » | e2e ; pest `bloque : le profil disparaît…` | pass e2e (blocage depuis la fiche, présent dans « Personnes bloquées », déblocage, état serveur relu) ; pass pest |
| F06-H2 | déblocage | happy | « Profils bloqués », débloquer | retiré de la liste | e2e | pass e2e (dans F06-H1) |
| F06-H3 | signalement | happy | fiche, menu, « Signaler », motif, envoyer | confirmation | e2e ; pest `enregistre un signalement…` | pass e2e (un échec transitoire dans la suite complète : écran « hors ligne » par lenteur du serveur d'aperçu ; 4/4 en isolation) ; pass pest |
| F06-E1 | signalement | edge : deux fois le même signalement, 20 par jour | | pas de doublon, plafond | pest | pass pest |
| F06-E2 | blocage | edge : double clic, blocage répété | | opération idempotente | pest ; e2e | pass e2e (double clic sans erreur) ; pass pest |
| F06-E3 | signalement | edge : commentaire très long, emoji | | limite et accepté | e2e | pass e2e (5000 caractères : refusé par le contrat à 1000, jamais 5xx) |
| F06-N1 | blocage | negative : se bloquer soi-même | | refusé | pest | pass e2e (API : refusé) ; pass pest |
| F06-N2 | signalement | negative : mineur suspecté | | suspension préventive | pest `suspend préventivement…` | pass pest |

## F07 Supprimer son compte

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F07-H1 | suppression | happy | Réglages, Supprimer mon compte, mot de passe, confirmer | suppression programmée (30 jours), retour à l'accueil, connexion refusée ensuite | e2e (compte jetable) ; pest `exige le mot de passe, masque le profil, ferme les sessions…` | pass e2e (compte jetable par l'API : 202, session fermée, connexion refusée `account_restricted`) ; pass pest |
| F07-H2 | export | happy | demander l'export avec le mot de passe | demande acceptée (202), une par jour | pest `génère un export JSON…` ; e2e (202) | **ignoré (fixme)** : `POST /me/export` répond 500 dans l'aperçu (file synchrone, stockage objet absent) ; pass pest ; jamais exécuté contre un vrai stockage |
| F07-E1 | suppression | edge : abonnement actif non annulé | | rappel d'annuler dans le store | jest `accountDesign`, `lot3Account` ; manual | pass jest ; manual |
| F07-E2 | suppression | edge : double clic sur confirmer | | une seule demande | e2e | non fait |
| F07-N1 | suppression | negative : mauvais mot de passe | | 403 `invalid_credentials`, compte intact | e2e ; pest | pass e2e (export : 403 avec un mauvais mot de passe) ; suppression : pass e2e (F07-N1b, 403 `invalid_credentials`, compte intact) |
| F07-N2 | suppression | negative : trop d'échecs | | 429 `rate_limited` avec `Retry-After` | pest ; e2e : non (limite) | pass e2e (429 avec `Retry-After`) ; pass pest |
| F07-N3 | suppression | negative : compte social sans mot de passe | | jeton frais du fournisseur exigé | pest `ré-authentifie un compte social…` ; manual (vrai Google/Apple) | pass pest ; manual |

## F08 Masquer son profil

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F08-H1 | visibilité | happy | Réglages, Confidentialité, désactiver « Afficher mon profil » | profil absent de la découverte des autres | e2e (réglage et API) ; pest `gère la confidentialité et les préférences` | pass e2e (interrupteur → `PATCH /me/privacy` 200 → `profile.is_visible=false` relu par l'API) ; pass pest |
| F08-E1 | visibilité | edge : retrait du consentement aux données sensibles | | profil masqué automatiquement | pest `historise les consentements et masque le profil…` | pass pest |
| F08-E2 | visibilité | edge : réactivation | | profil à nouveau visible | e2e | pass e2e (réactivation relue par l'API) |

## Hors périmètre de ce plan

Administration Filament, verrou de connexion du personnel, files de modération (testés par Pest) ; services externes réels (R2, Reverb, FCM, LiveKit, RevenueCat, Google, Apple) : jamais exécutés, listés dans `replica/backend.md`.

## Synthèse de la passe (2026-11-17)

- **Spécifications e2e** : 39 tests dans `e2e/` (F01, F02, F03/F04/F05, F06, F07, F08, accessibilité et largeur 390 et 320 pt, refus d'âge). Dernière suite complète : 37 réussis, 1 ignoré (`F07-H2`, limite d'environnement), 1 échec transitoire (`F06-H3`, écran « hors ligne » par lenteur du serveur d'aperçu) qui réussit seul (4 sur 4) ; `F02-E4` corrigé ensuite (il ne vérifiait pas ce que son titre annonçait) et rejoué avec succès.
- **Bogues** : 3 trouvés, 3 corrigés, tous S3 (`replica/bugs.md`). Aucun S1 ni S2. Les trois sont passés de rouge à vert dans le navigateur après correction.
- **Suites existantes** : Pest 519 réussis (2 ignorés) ; Jest 803 réussis sur 42 suites ; `tsc` et `eslint` sans erreur.
- **Audit d'accessibilité** (axe, WCAG 2 A et AA, gravité sérieuse ou critique) : propre sur 8 écrans à 390 et 320 pt après correction ; pas de débordement horizontal à 320 pt.

## Ce qui n'a pas été testé

- Cas marqués `non fait` ou `manual` ci-dessus.
- **Dépôt de photo, vidéo, stockage objet, export réel** (aperçu sans stockage) ; **temps réel, notifications push, achats, appels** (services absents de l'aperçu).
- **Inscription complète** : le parcours e2e va jusqu'à la création du compte (date de naissance, consentements, e-mail et mot de passe). Vérification d'e-mail, onboarding (intention, profil, photos, préférences) non parcourus dans le navigateur.
- **Appareils réels** : rendu natif Android et iOS, gestes de balayage, clavier, VoiceOver et TalkBack, texte à 200 % (seul le web a été exercé ; il n'a ni zone de sécurité ni échelle de police).
- **Changement d'heure et fuseaux** ; **réseau lent** (seul le réseau coupé a été testé).
- Les tests Jest utilisent une API simulée : ils ne comptent pas comme tests du backend. Les tests Pest n'exercent pas les écrans.
