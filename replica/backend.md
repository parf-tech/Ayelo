# Backend : checklist `replica-backend`

Date : 2026-11-07. Référence d'architecture : `docs/08-SOFTWARE-ARCHITECTURE.md`, `docs/09-DATABASE-SCHEMA.md`, `docs/10-API-SPECIFICATIONS.md` (le fichier `replica/architecture.md` n'existe pas : ces documents en tiennent lieu). Les preuves sont des fichiers lus ou des tests rejoués ; « non vérifié » veut dire écrit mais jamais exécuté.

## Écarts avec le skill (choix d'architecture déjà arrêtés)

- **Pile :** Laravel 12 + PostgreSQL + Sanctum, pas Supabase. L'autorisation passe par des Policies Laravel et des contrôles dans chaque requête, pas par des politiques RLS.
- **Paiements :** application mobile avec achats intégrés des stores, donc **RevenueCat** (webhook idempotent), pas Stripe Checkout. Stripe ne s'applique pas aux achats d'abonnement dans l'app (règles Apple et Google).
- **E-mail :** transactionnel par SMTP configurable (`MAIL_*`), journal en local. Prestataire (Resend ou Postmark) non choisi.
- **Interdits du skill respectés :** aucune API privée de l'application d'origine n'est appelée ; aucun compte ni clé n'a été créé par Claude ; `.env.example` ne contient aucune valeur secrète.

## Authentification

- [x] Inscription par e-mail avec contrôle d'âge, vérification d'e-mail, mot de passe oublié et réinitialisation, sessions listables et révocables (tests `AuthFlowTest`, `AccountFlowTest`).
- [x] Google et Apple : vérification du JWT RS256 par JWKS, sur le compte de développeur du propriétaire (test avec clés locales ; **vrais JWKS non vérifiés**).
- [x] Jetons Sanctum (jeton porteur, pas de cookie) ; déconnexion et « déconnexion partout » (`SessionController`).
- [x] Rôles du personnel (administrateur, modérateur, support) avec une matrice unique `Permissions` ; panneau Filament avec 2FA obligatoire.
- [x] Suppression de compte qui supprime : demande avec ré-authentification ou page web publique, anonymisation après 30 jours (tâche planifiée), export de données.

## Base de données

- [x] Migrations versionnées (`backend/database/migrations`), schéma de référence testé (33 tests SQL).
- [x] Règles d'accès sur chaque ressource (Policies, filtres par propriétaire) ; test du second utilisateur dans `SecurityHardeningTest`, `MessagingTest`, `Admin/PermissionsTest`.
- [x] Journal d'audit immuable (déclencheurs PostgreSQL + tests de refus).
- [~] Jeu de données fictif : `DatabaseSeeder` présent ; couverture réaliste non vérifiée.
- [ ] Sauvegardes : procédure et procès-verbal de restauration écrits (`docs/runbooks/restauration.md`), **jamais exécutés**.

## Paiements (RevenueCat)

- [x] Webhook authentifié par secret (`hash_equals`), événement stocké et rejoué si l'utilisateur n'existait pas encore (`billing:replay-unknown`), traitement idempotent dans une transaction.
- [x] Statut d'abonnement en base, mis à jour par le webhook, lu par l'application ; le client n'est jamais cru.
- [ ] Événements réels : le format est supposé (ADR 002), aucun événement RevenueCat réel reçu.
- [ ] Résiliation en un clic : elle se fait dans le store (obligation des stores) ; l'écran d'information côté application est à vérifier.

## E-mail et tâches

- [x] E-mails traduits (fr, en) pour vérification et réinitialisation.
- [x] Tâches planifiées : expiration des sanctions, anonymisation, purge des exports et des dépôts abandonnés, balayage des médias orphelins, rejeu des événements de facturation.
- [ ] Expéditeur sur le domaine du produit, SPF/DKIM/DMARC : dépend du choix du prestataire et du domaine (propriétaire).
- [ ] Journal des échecs de tâches (dead-letter) : file Redis jamais exécutée contre un vrai Redis.

## Intégrations

| intégration | API officielle | état |
| --- | --- | --- |
| Stockage objet | Cloudflare R2 (S3), URL présignées | code écrit, **jamais exécuté contre un vrai bucket** |
| Temps réel | Reverb | événements testés par simulation, **aucune connexion réelle** |
| Notifications | FCM | envoi isolé derrière une interface, **jamais exécuté** |
| Appels | LiveKit | jetons testés, **aucun appel établi** |
| Facturation | RevenueCat | voir ci-dessus |
| Connexion sociale | Google, Apple | vérification locale testée, vérification réelle à faire |

Les portées OAuth demandées sont l'identité de base seulement (aucune API Calendar ou équivalente : pas de vérification Google à lancer pour cela).

## Liste de sécurité

- [x] Secrets seulement dans l'environnement ; `.env*` ignorés par Git (`!.env.example`, `!.env.prod.example`) ; `gitleaks` en CI sur l'historique complet.
- [x] Entrées validées côté serveur sur les routes qui en reçoivent (les contrôleurs sans `validate()` sont en lecture seule, ou authentifiés par secret comme le webhook).
- [x] Autorisation sur chaque lecture et écriture, testée avec un second utilisateur.
- [x] Limites de débit sur connexion, inscription, contrôle d'âge, OAuth, mot de passe oublié, renvoi d'e-mail, dépôts de médias, messages, appels ; 429 testés (`SecurityHardeningRound2Test`).
- [x] Signature ou secret du webhook vérifié.
- [x] Dépôts de médias : type, taille et dimensions contrôlés, image ré-encodée sans EXIF vers une nouvelle clé, stockage objet séparé, lecture bornée.
- [~] Pas de donnée utilisateur dans les URLs ni les journaux : URL sans donnée personnelle relues dans les routes ; contenu des journaux d'application non audité.
- [x] Dépendances auditées : `composer audit` propre, `npm audit --omit=dev` sans faille haute ni critique (2026-11-06).
- [~] Politique de confidentialité : `docs/legal/02-politique-confidentialite.md` nomme les prestataires ; relecture juridique par marché non faite.

## Suites

- Revues de sécurité : `docs/reviews/code-security-2.md` et `code-security-2-suivi.md`. Les agents en cours corrigent encore le verrou de connexion, N-09, N-13, F-06, le contrat OpenAPI et les décisions Q1 à Q3.
- Prochaine étape du skill : `/replica-test`.

## Passe de vérification : jeu fictif, RevenueCat, dead-letter, journaux, JWKS (2026-11-07)

Preuve : `backend/tests/Feature/BackendChecklistTest.php` (20 tests passent ; 2 tests réseau facultatifs, `RUN_NETWORK_TESTS=1`).

- [x] Jeu de données fictif : `DatabaseSeeder` + `DemoDataSeeder` (40 membres sur 12 pays, 3 genres, 5 intentions ; 12 affinités, conversations et messages ; 4 signalements, 2 sanctions ; 5 abonnements, 1 achat de crédits ; 1 compte de personnel par rôle créé par `StaffAccounts`). Adresses en `@example.test`, mots de passe aléatoires jamais écrits ni affichés, refus en production, rechargement sans doublon. Testé sur la base de test (contraintes du schéma respectées).
- [x] Webhook RevenueCat, revue F-13 : un événement `environment = SANDBOX` est acquitté mais jamais appliqué en production ; un événement plus ancien (`event_timestamp_ms`) livré après un plus récent pour le même abonnement est ignoré (colonne `subscriptions.last_event_ms`, migration `2026_11_07_100000`) ; idempotence conservée. Testé. Réserve : la colonne n'est pas dans `docs/schema/001_initial.sql` (migration Laravel seulement). Le champ `environment` et `event_timestamp_ms` suivent la documentation connue de RevenueCat, **toujours non confirmés par un événement réel** (la ligne « événements réels » reste non cochée).
- [~] Journal des échecs de tâches : table `failed_jobs` présente (migration `0001_01_01_000002`), purge `queue:prune-failed --hours=168` planifiée, écouteur `Queue::failing` (`QueueDeadLetterServiceProvider`) qui journalise en `critical` le nom du travail et la classe d'exception seulement. Testé avec la file `sync` et l'événement `JobFailed` ; **toujours jamais exécuté contre un vrai Redis** (donc non coché dans la section « E-mail et tâches »).
- [x] Journaux sans donnée personnelle : processeur `App\Logging\RedactSensitiveData` appliqué à tous les canaux de `config/logging.php` (hors repli `emergency`) : e-mails, jetons porteurs, clés `password`/`token`/`secret`/`authorization`, longues chaînes hexadécimales ou base64. Testé, y compris sur les canaux `single` et `stack` réels. Réserves : les exceptions du contexte (et leur message) ne sont pas modifiées ; le contenu réel des journaux de production n'a pas été audité (la ligne « Pas de donnée utilisateur dans les URLs ni les journaux » reste `[~]`).
- [x] Vrais JWKS Google et Apple : le code `JwtOAuthVerifier` récupère et analyse (`JWK::parseKeySet`) les clés réelles de `googleapis.com` et `appleid.apple.com` (RS256, `kid` présent) : test réseau passé le 2026-11-07. Ce qui reste non vérifié : un vrai `id_token` signé par Google ou Apple (aucun compte de développeur).
