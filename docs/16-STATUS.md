# 16 : État d'avancement réel

Date : 2026-11-06 (mise à jour le 2026-11-07, après les lots 6 à 9, le pentest n°1, les revues CTO n°1 et design n°1). Ce document dit ce qui **existe et a été vérifié**, ce qui existe sans être vérifié, et ce qui n'existe pas. Il prime sur les statuts optimistes des autres documents.

## Preuves disponibles

| preuve | résultat |
| --- | --- |
| Tests backend (Pest, PostgreSQL 16) | **Mesuré le 2026-11-07 (PHP 8.4.27, `memory_limit=1G`) : 515 tests Pest réussis, 2 ignorés (tests réseau facultatifs), 0 échec, 3373 assertions.** Le PHP 8.5 téléchargé en début de journée est bloqué par Smart App Control ; les tests tournent avec `C:\Users\pc\tools\php84`. **Rejoué le 2026-11-13 (PHP 8.5.12 de WinGet, `intl`, `gd` et `exif` activés par un `php.ini` local) : 519 réussis, 2 ignorés, 0 échec, 3393 assertions.** |
| Tests du schéma SQL (PostgreSQL 16.15) | 33 tests, 0 échec (mesuré) |
| CI GitHub | trois workflows verts sur le commit `5dce604` : `backend` (Pest sur PostgreSQL 16, `composer audit`, contrat OpenAPI à jour), `schema` (33 tests SQL, gitleaks historique complet), `mobile` (types, lint, 300 tests, bundle Android, audit de production) |
| Contrôle de secrets (gitleaks, historique complet) | **exécuté uniquement par la CI** (workflow `schema`), jamais en local (binaire absent du poste, téléchargement non autorisé). Dernier résultat connu : propre ; 4 faux positifs (mots de passe factices dans les tests) exclus par `.gitleaks.toml`, limité à `backend/tests` et `mobile/__tests__`. À rejouer sur l'historique du commit final |
| Audit des dépendances PHP | `composer audit` rejoué le 2026-11-06 : aucune faille signalée |
| Revue de sécurité du code, 2e ronde | `reviews/code-security-2.md` ; correctifs des constats hauts et moyens appliqués (N-01 à N-08, N-10, N-11, F-08, F-10, F-23, puis lot 2 partiel : N-09, N-13, N-14) avec un test par constat (`SecurityHardeningRound2Test`) ; suivi dans `reviews/code-security-2-suivi.md`. Lots 3 à 9 depuis (N-09, N-10, N-13, N-14 traités avec des résidus écrits ; lots 6 à 8 : F-11, F-18 à F-30). Restent ouverts ou à décider : F-02 et F-09 résiduels, N-12 (voir `DECISIONS-PROPRIETAIRE.md`), F-06 / F-16 / F-22 résiduels. Troisième relecture ciblée N-01 / N-02 non faite |
| Mobile (Jest, typecheck, lint, bundle) | **393 tests Jest sur 21 suites (mesuré le 2026-11-07)** ; typecheck et lint propres à la dernière exécution ; `expo export --platform android` compilait avec 300 tests (rejoué par le CTO le 2026-11-06, non rejoué depuis les ajouts push et accessibilité). `npm audit --omit=dev` rejoué le 2026-11-06 : 22 vulnérabilités (1 basse, 21 modérées), aucune haute ni critique (transitives, outils de build ; le correctif proposé est un retour à Expo 52, refusé) |

## Backend : fait et testé

| module | contenu | épopée |
| --- | --- | --- |
| Socle | Laravel 12, PostgreSQL, Sanctum à clés uuid, format d'erreur unique, limites de débit par appareil / compte | A1, A2 |
| Authentification | contrôle d'âge avant compte (jeton chiffré lié à l'appareil, refus mémorisé 90 jours), inscription, connexion, déconnexion, vérification d'e-mail, mot de passe oublié, sessions, Google / Apple (vérification JWT RS256 par JWKS), Argon2id | A3 |
| Profils | création / mise à jour, confidentialité, préférences, pays de résidence limité à un changement par semaine, profil public avec politique de visibilité | A6 |
| Médias | URL présignées, relecture de l'objet déposé, file de modération, réordonnancement, suppression | A6 |
| Découverte | filtres, pagination par curseur, swipes, quotas, matchs avec verrou consultatif, annulation Premium | A7 |
| Messagerie | conversations, messages idempotents, lu / remis / saisie, médias approuvés, masquage, ouverture hors match par crédit ou Premium, détection simple de demande d'argent | A9 |
| Temps réel | Reverb, canaux privés `user.{id}` et `conversation.{id}` autorisés par participation | A9 |
| Notifications | préférences, jeton par appareil, envoi FCM isolé derrière une interface | A9 |
| Sécurité | blocage, signalements (quota, priorité, suspension préventive d'un mineur suspecté, seuil de 3 signalements), sanctions, contestation | A11 |
| Compte | suppression avec ré-authentification, page web publique de demande, anonymisation après 30 jours (planifiée), export, consentements, support | A13, A16 |
| Facturation | webhook RevenueCat idempotent, abonnements, crédits, remboursements, statut | B1 |
| Vérification de profil | demande, consentement biométrique, décision, suppression du selfie | B2 |
| Appels (serveur) | sonnerie, réponse, refus, fin, manqué, durée maximale, jetons LiveKit | D (signalisation) |

71 routes sont implémentées (`17-IMPLEMENTED-ROUTES.md`).

## En cours au moment de la rédaction

| lot | responsable | état |
| --- | --- | --- |
| Administration Filament | livrée côté code (515 tests Pest mesurés le 2026-11-07) ; rendu navigateur et 2FA avec une vraie application non vérifiés | voir spec 009 |
| Écrans mobiles de la phase 2 | livrés côté code (393 tests Jest) ; jamais vus sur appareil | voir spec 010 |

## Non fait

| élément | raison |
| --- | --- |
| Stories, invitations vidéo, notes vocales, cadeaux, proximité | phases C et E, décidées après lancement |
| Vérification du téléphone par SMS, connexion TikTok | phase B, hors périmètre du lancement tant que le coût des SMS n'est pas validé |
| Modération automatique des images et filtrage de texte au-delà de la détection simple | prestataire non choisi (ADR 005) |
| Transcodage vidéo | sans objet tant que les vidéos de profil ne sont pas ouvertes |
| Redis en production | configuré dans le code (Predis) mais jamais exécuté contre un vrai Redis |
| i18n côté serveur au-delà des e-mails | seuls les e-mails sont traduits (fr, en) ; les messages d'API sont en français |
| Contrat OpenAPI | produit : `docs/openapi.json` (67 opérations), vérifié à jour par la CI ; types TypeScript générés et utilisés par la couche API du mobile (`mobile/src/api/generated.ts`, authentification, profil, découverte, messages) ; écarts de la spec corrigés à la source (annotations des contrôleurs et du présentateur de profil : réponse de `POST /swipes`, énumérations de profil, de message et de média, préférences, consentements, création de conversation) ; restent des surcharges locales `Refine` pour `platform`, `locale` des routes d'authentification, `Conversation.status` et `Me.email` ; la génération de `docs/openapi.json` demande une base PostgreSQL (extension `pdo_pgsql`) ou, à défaut, une base SQLite vide dotée des tables `users`, `profiles` et `media` |

## Non vérifié (écrit mais jamais exécuté)

- **Stockage objet réel (Cloudflare R2)** : le code S3 existe mais seul un faux stockage en mémoire est testé.
- **FCM** : l'envoi réel n'a jamais été exécuté ; seule la désactivation sans configuration est testée.
- **Reverb réel** : les événements sont testés par simulation ; aucune connexion WebSocket réelle n'a été établie.
- **RevenueCat réel** : le format des événements est supposé (ADR 002) ; aucun événement réel reçu.
- **Google / Apple réels** : la vérification est testée avec des clés générées localement, pas avec les vrais JWKS.
- **LiveKit réel** : les jetons sont décodés par les tests ; aucun appel établi.
- **Applications mobiles** : jamais lancées sur appareil ni émulateur.
- **Docker Compose, Caddyfile et image PHP** : non testés (Docker absent du poste de développement). Durcissement de production relu et complété le 2026-11-07 (en-têtes dont CSP pour l'hôte d'administration, liste blanche d'IP échec fermé, Redis protégé par mot de passe, variables limitées pour Caddy, Reverb sans événements client) **par lecture seulement** : ni `docker compose config`, ni `caddy validate`, ni la CSP dans un navigateur n'ont été exécutés.
- **Restauration PostgreSQL** : exercice pas à pas et modèle de procès-verbal écrits (`runbooks/restauration.md`), **jamais exécutés**.
- **Charge et concurrence réelle** : le verrou de match n'est testé que séquentiellement.

## Ce que l'équipe ne peut pas faire seule (dépend du propriétaire ou d'un tiers)

1. Ouvrir les comptes Apple Developer et Google Play (identité, entité juridique) ; réunir 12 testeurs pour le test fermé Google (14 jours).
2. Faire valider la matrice juridique par marché par un juriste (RGPD / DSA, Loi 25, PIPEDA, CCPA, lois africaines, retrait d'images intimes).
3. Choisir et payer l'hébergement (VPS, R2, LiveKit Cloud) ; fournir les clés (RevenueCat, FCM, Google / Apple, R2).
4. Budgéter la modération humaine (le plus gros poste réel non chiffré).
5. Valider le nom et faire la recherche de marque.
6. Prototype D0 des appels sur appareils réels, puis soumission aux stores.
7. Décisions d'exploitation : politique de confidentialité, CGU, adresse de contact du support, procédure de signalement aux autorités.

## Revues réalisées (dossier `docs/reviews/`)

| revue | fichiers | état |
| --- | --- | --- |
| Sécurité du code, rondes 1 et 2 | `code-security-1.md`, `code-security-1-suivi.md`, `code-security-2.md`, `code-security-2-suivi.md` | constats hauts et moyens traités, résidus écrits ; la suite complète n'a pas été rejouée depuis les lots 6 à 9 |
| CTO n°1 (due diligence technique) | `cto-1.md`, `cto-1-suivi.md` (infra), `cto-1-suivi-perf.md` (performance), `cto-1-suivi-mobile.md` (push et configuration des stores) | **verdict : NO-GO pour un lancement public ; GO conditionnel pour une bêta fermée de quelques centaines d'utilisateurs, une fois remplis les neuf bloquants « B » de la section 9** (déploiement de préproduction, restauration PostgreSQL prouvée, dimensionnement et test de charge, Redis et files, supervision, mobile push et `app.json`, recette sandbox des services externes, parcours Maestro, corrections de performance). Les bloquants 1, 2, 5, 7 et 8 ne sont pas faisables sans serveur, appareil ou service externe |
| Design n°1 (mobile et back-office) | `design-1.md`, `design-1-suivi.md` (mobile), `design-1-suivi-admin.md` (Filament) | P0 et gains rapides mobiles traités ; rendu natif (VoiceOver, TalkBack, Dynamic Type) non vérifié sur appareil ; P0-1 (pages juridiques publiées) hors code |
| Pentest n°1 | `pentest-1.md`, `pentest-1-suivi.md`, `pentest-1-suivi-infra.md` | P-01 à P-08 corrigés avec tests ; P-15 : actions CI épinglées par SHA, images Docker non épinglées ; P-09 à P-14 ouverts |

La liste unique de tout ce qui reste ouvert est dans `reviews/restant.md`.

## Gates

| gate | état |
| --- | --- |
| G0 cadrage | franchi |
| G1 conception | franchi (3 relectures, CI verte) |
| G2 module | franchi pour les modules backend ci-dessus (tests verts), pas encore pour l'administration ni le mobile |
| G3 sécurité | **non franchi** : revue de sécurité du code faite (9 constats hauts, traités : voir `reviews/code-security-1-suivi.md`) ; seconde revue faite et corrigée en grande partie, `composer audit` et `npm audit` rejoués ; manquent : décisions du propriétaire sur F-02 / F-09 / N-12, attestation d'appareil, troisième relecture ciblée, matrice juridique |
| G4 intégration (E2E) | **non franchi** : aucun test de bout en bout mobile / backend |
| G5 pré-production | **non franchi** : aucun déploiement, aucune sauvegarde restaurée |
| G6 stores et appels | **non franchi** |
| G7 lancement | **non franchi** |
