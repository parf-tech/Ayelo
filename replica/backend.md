# Backend : checklist `replica-backend`

Date : 2026-11-07. Référence d'architecture : `docs/08-SOFTWARE-ARCHITECTURE.md`, `docs/09-DATABASE-SCHEMA.md`, `docs/10-API-SPECIFICATIONS.md` (le fichier `replica/architecture.md` n'existe pas : ces documents en tiennent lieu). Les preuves sont des fichiers lus ou des tests rejoués ; « non vérifié » veut dire écrit mais jamais exécuté.

## Écarts avec le skill (choix d'architecture déjà arrêtés)

- **Pile :** Laravel 12 + PostgreSQL + Sanctum, pas Supabase. L'autorisation passe par des Policies Laravel et des contrôles dans chaque requête, pas par des politiques RLS.
- **Paiements :** application mobile avec achats intégrés des stores, donc **RevenueCat** (webhook idempotent), pas Stripe Checkout. Stripe ne s'applique pas aux achats d'abonnement dans l'app (règles Apple et Google).
- **E-mail :** transactionnel via Resend SMTP (`MAIL_*`), journal en local. Domaine `ayelo.fr` et DNS configurés ; la vérification Resend et la clé SMTP de production restent à finaliser.
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
- [~] Expéditeur sur `ayelo.fr` configuré chez Resend ; DKIM et un CNAME de retour sont encore en attente de vérification, et aucun envoi réel n'a été testé.
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

- Revues de sécurité : `docs/reviews/code-security-2.md` et `code-security-2-suivi.md`. Le verrou de connexion, N-09, N-13, F-06, le contrat OpenAPI et les décisions Q1 à Q3 ont été traités (voir la passe du 2026-11-17 en bas de ce fichier).
- Prochaine étape du skill : `/replica-test`.

## Passe de vérification : jeu fictif, RevenueCat, dead-letter, journaux, JWKS (2026-11-07)

Preuve : `backend/tests/Feature/BackendChecklistTest.php` (20 tests passent ; 2 tests réseau facultatifs, `RUN_NETWORK_TESTS=1`).

- [x] Jeu de données fictif : `DatabaseSeeder` + `DemoDataSeeder` (40 membres sur 12 pays, 3 genres, 5 intentions ; 12 affinités, conversations et messages ; 4 signalements, 2 sanctions ; 5 abonnements, 1 achat de crédits ; 1 compte de personnel par rôle créé par `StaffAccounts`). Adresses en `@example.test`, mots de passe aléatoires jamais écrits ni affichés, refus en production, rechargement sans doublon. Testé sur la base de test (contraintes du schéma respectées).
- [x] Webhook RevenueCat, revue F-13 : un événement `environment = SANDBOX` est acquitté mais jamais appliqué en production ; un événement plus ancien (`event_timestamp_ms`) livré après un plus récent pour le même abonnement est ignoré (colonne `subscriptions.last_event_ms`, migration `2026_11_07_100000`) ; idempotence conservée. Testé. Réserve : la colonne n'est pas dans `docs/schema/001_initial.sql` (migration Laravel seulement). Le champ `environment` et `event_timestamp_ms` suivent la documentation connue de RevenueCat, **toujours non confirmés par un événement réel** (la ligne « événements réels » reste non cochée).
- [~] Journal des échecs de tâches : table `failed_jobs` présente (migration `0001_01_01_000002`), purge `queue:prune-failed --hours=168` planifiée, écouteur `Queue::failing` (`QueueDeadLetterServiceProvider`) qui journalise en `critical` le nom du travail et la classe d'exception seulement. Testé avec la file `sync` et l'événement `JobFailed` ; **toujours jamais exécuté contre un vrai Redis** (donc non coché dans la section « E-mail et tâches »).
- [x] Journaux sans donnée personnelle : processeur `App\Logging\RedactSensitiveData` appliqué à tous les canaux de `config/logging.php` (hors repli `emergency`) : e-mails, jetons porteurs, clés `password`/`token`/`secret`/`authorization`, longues chaînes hexadécimales ou base64. Testé, y compris sur les canaux `single` et `stack` réels. Réserves : les exceptions du contexte (et leur message) ne sont pas modifiées ; le contenu réel des journaux de production n'a pas été audité (la ligne « Pas de donnée utilisateur dans les URLs ni les journaux » reste `[~]`).
- [x] Vrais JWKS Google et Apple : le code `JwtOAuthVerifier` récupère et analyse (`JWK::parseKeySet`) les clés réelles de `googleapis.com` et `appleid.apple.com` (RS256, `kid` présent) : test réseau passé le 2026-11-07. Ce qui reste non vérifié : un vrai `id_token` signé par Google ou Apple (aucun compte de développeur).

## Passe de stabilisation : contrat OpenAPI, ré-authentification, aperçu local (2026-11-17)

Preuve : suite Pest complète rejouée le 2026-11-17 sur PostgreSQL 16 (port 54330), PHP 8.5.12 : **519 réussis, 2 ignorés (tests réseau facultatifs), 0 échec, 3393 assertions** (246 s). Condition d'exécution : la variable `OPENSSL_CONF` doit pointer vers `C:/Program Files/Git/usr/ssl/openssl.cnf` (ce que fait `backend/scripts/php-pgsql.ps1`) ; sans elle, 19 tests RSA échouent sur `openssl_pkey_export`, ce qui n'est pas un défaut du code.

- [x] **Ré-authentification (suppression et export de compte)** : `AccountController::reauthenticate()` ne renvoie plus de réponse, elle lève `ReauthenticationRefused` (403 `invalid_credentials` ou `invalid_oauth_token`) ou `ReauthenticationThrottled` (429 `rate_limited` avec `Retry-After`). Le format d'erreur reste `{ error: { code, message } }`. Ces exceptions ne sont pas journalisées (`dontReport`). Les compteurs d'échecs (5 par 15 minutes pour un couple compte et IP, 20 par compte) sont inchangés.
- [x] **Contrat OpenAPI** : les quatre routes qui sortaient avec un schéma faux (200 vide pour les routes de ré-authentification, corps de requête absent, 202 des suppressions web, authentification de diffusion) sont documentées à la source : extension Scramble `ReauthenticationExceptionResponses`, transformateur `ReauthenticationRequestBody`, route `POST /broadcasting/auth` (`BroadcastAuthController`). `docs/openapi.json` compte 67 opérations ; `backend/tests/Unit/OpenApiContractTest.php` (5 tests) vérifie ces schémas. Les types du mobile sont générés (`npm run api:types`), jamais modifiés à la main.
- [x] **Scramble en dépendance de développement seulement** : l'enregistrement du transformateur est protégé par `class_exists(Scramble::class)` ; l'image de production (`composer --no-dev`) n'en dépend pas. Garde de production : `APP_DEBUG=true` avec `APP_ENV=production` interrompt le démarrage.
- [x] **Aperçu local des écrans connectés** : `CORS_DEV_ORIGINS` n'est lu que si `APP_ENV=local` (tests `CorsTest`), `PreviewSeeder` et `scripts/dev-preview.ps1` s'exécutent sur une base jetable séparée (port 54350). Procédure : `docs/runbooks/apercu-local.md`. L'aperçu navigateur a servi à la vérification visuelle (`docs/design/06-verification-visuelle.md`).

Toujours non vérifié, sans changement depuis la passe du 2026-11-07 : événements RevenueCat réels, Cloudflare R2, Reverb, FCM, LiveKit, vrai `id_token` Google ou Apple, Redis réel pour la file et les échecs de tâches, exécution d'une restauration de sauvegarde, expéditeur et SPF/DKIM/DMARC, relecture juridique de la politique de confidentialité, audit du contenu réel des journaux de production. `composer audit` n'a pas pu être rejoué dans cette passe (`composer` absent du poste) : le dernier résultat propre date du 2026-11-06 et ne couvre pas la dépendance de développement `dedoc/scramble` ajoutée depuis ; la CI (`composer audit`) reste la référence.

## Passe de déploiement : 401 sans `Accept`, client S3, contrôle de configuration, script (2026-11-18)

Preuve : suite Pest complète rejouée en un seul passage sur PostgreSQL 16 (port 54330), PHP 8.5.12 de WinGet avec un `php.ini` complet (`intl`, `gd`, `exif`, `zip`, `sodium`) : **548 réussis, 2 ignorés (tests réseau facultatifs), 0 échec, 3456 assertions** (277 s). Nouveau fichier : `backend/tests/Feature/DeployReadinessTest.php` (29 tests, écrits avant le code et vus en échec). Contrat OpenAPI régénéré par `scramble:export` : identique à `docs/openapi.json`. Laravel Pint propre sur `app/`, `config/`, `bootstrap/` et le nouveau test. Remarque d'environnement : `tools/php84` est bloqué par Smart App Control (curl, openssl, pdo_pgsql) et `backend/scripts/php-pgsql.ps1` échoue à cause de l'avertissement PHP ; les tests ont tourné avec le PHP de WinGet appelé directement. Sans `gd` dans le processus enfant, 3 tests d'isolation du ré-encodage échouent (`Lot12SecurityTest` P-13, `SecurityHardeningRound8Test` N-14 x2) : limite du poste, ils passent avec un `php.ini` complet.

- [x] **401 JSON sans en-tête `Accept`** : toute route `auth:sanctum` appelée sans jeton et sans `Accept: application/json` répondait 500 (`RouteNotFoundException: Route [login] not defined`, levée par `redirectGuestsTo(fn () => route('login'))` du framework dans le middleware). `bootstrap/app.php` : `redirectGuestsTo(fn () => null)`. Vérifié en mode production avec routes en cache : 401 `{error:{code:unauthenticated}}` sur `GET /api/v1/me`, `GET /api/v1/conversations`, `POST /api/v1/me/export`.
- [x] **Client S3 (`S3MediaStorage`)** : délai de connexion 3 s et délai total 20 s (`MEDIA_CONNECT_TIMEOUT`, `MEDIA_HTTP_TIMEOUT`), une nouvelle tentative au lieu de 3 par défaut (`MEDIA_RETRIES`) : au plus 2 x 20 s, sous les 60 s de PHP-FPM. `head()` ne renvoie `null` que pour un 404 ; un 403 ou un 5xx remontent au lieu de passer pour « objet absent ». Testé avec le simulateur du SDK (`MockHandler`) et un `http_handler` qui relève les options envoyées. **Toujours jamais exécuté contre un vrai bucket.**
- [x] **`deploy:preflight`** (`App\Support\DeployPreflight`, commande `deploy:preflight`) : refuse (code 1) `APP_ENV` hors production, `APP_DEBUG`, `APP_KEY` vide, `APP_URL` non https, `ADMIN_DOMAIN` vide, base non PostgreSQL, file `sync`, `SAFETY_STATE_STORE` vide, `MEDIA_*` vides ou endpoint non https, `MEDIA_AUTO_APPROVE` actif ; avertit pour `MEDIA_SIGN_UPLOAD_HEADERS=false`, RevenueCat, FCM, LiveKit, secret du webhook d'e-mail, identifiants Google et Apple. N'affiche jamais une valeur. Choisi à la place d'une exception au démarrage de l'application : un démarrage interrompu casserait le build de l'image et `config:cache`.
- [x] **Variables de production documentées** : `MEDIA_SIGN_UPLOAD_HEADERS`, `MEDIA_CONNECT_TIMEOUT`, `MEDIA_HTTP_TIMEOUT`, `MEDIA_RETRIES` dans `infra/.env.prod.example`, avec un test qui compare chaque `MEDIA_*` de `config/media.php` au fichier d'exemple. `MEDIA_SIGN_UPLOAD_HEADERS` reste `false` : à passer à `true` seulement après un essai sur le vrai bucket.
- [x] **Disque `s3` supprimé de `config/filesystems.php`** : aucun code ne l'utilisait (le code lit `config/media.php`, `MEDIA_*`) ; les `AWS_*` ne configuraient rien.
- [x] **Script de déploiement** `infra/scripts/deploy.sh` et procédure `docs/runbooks/deploiement.md` : sauvegarde, construction, PostgreSQL et Redis, `deploy:preflight`, recopie de `public/` (nouveau `.public-dist` dans l'image) et `filament:assets` en root, migrations, relance et attente de santé, caches, contrôle de `/api/v1/health` public. Essayé seulement avec un faux `docker` (`infra/scripts/tests/deploy_test.sh`, 20 vérifications dont l'arrêt avant toute migration si `deploy:preflight` échoue ; un mutant « preflight non bloquant » est bien détecté), `bash -n`, et ajouté à `ci.yml`. **Jamais exécuté avec Docker, Compose ni Caddy.** `shellcheck` absent du poste : la CI le lance (informatif).
- [x] **Migrations en mode production** (PostgreSQL 16 jetable) : `migrate:fresh --force` applique les 8 migrations ; `migrate:reset` annule les migrations postérieures puis refuse celle du schéma initial (voulu : `drop schema public cascade`, interdit hors local et testing) ; `migrate` les rejoue. Le retour arrière des données passe donc par la restauration d'une sauvegarde, jamais exécutée.

Reste ouvert après cette passe : tout ce qui dépend de Docker, d'un serveur ou d'un service externe (construction de l'image, Compose, Caddy, certificats, assets du panneau, droits sur le volume `app-public`, R2 réel et `MEDIA_SIGN_UPLOAD_HEADERS=true`, restauration, Redis réel) ; images Docker non épinglées par condensat ; la sonde `/api/v1/health` ne contrôle pas le stockage objet (changer sa forme demanderait de régénérer `docs/openapi.json` et les types mobiles ; le contrôle est fait au déploiement par `deploy:preflight`) ; état de la CI GitHub non lu (`gh` non authentifié).

Prochaine étape du skill : `/replica-test`.
