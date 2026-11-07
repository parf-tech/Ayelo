# Suivi de la revue CTO n°1 : risques d'infrastructure et d'exploitation

Source : `docs/reviews/cto-1.md`. Légende : `[x]` corrigé dans le code ou la configuration et vérifié comme indiqué ; `[~]` partiel, ou écrit mais jamais exécuté sur un serveur ; `[ ]` non traité ici (hors périmètre infra/CI, ou nécessite un serveur / une décision).

Périmètre de ce lot : `infra/**`, `.github/workflows/**`, `backend/config/{logging,database}.php`, la sonde de santé, `backend/.env.example`, `docs/runbooks/`. Contrôleurs, services, jobs, modèles, Filament et mobile non touchés (sauf `HealthController`, qui EST la sonde de santé).

Vérifié sur ce poste : `HealthCheckTest` + `HealthTest` (6 tests verts, PostgreSQL 16 embarqué sur le port 54337) ; syntaxe YAML de `docker-compose.prod.yml` et de `ci.yml` (js-yaml) ; `bash -n` sur `backup.sh`. NON vérifié (Docker, shellcheck, caddy absents) : construction de l'image, `docker compose config`, `php-fpm -t` avec le nouveau pool, healthchecks `pgrep` / `cgi-fcgi`, deux instances Redis, exécution de `ci.yml`.

## Risques du classement (section 8)

| rang | risque | état | preuve |
| --- | --- | --- | --- |
| 4 | Infrastructure jamais exécutée, FPM 5 processus, ré-encodage synchrone | [~] | pool dimensionné (`infra/php/php-fpm-pool.conf`, ENV du `Dockerfile`), mémoire plafonnée, CI construit l'image et valide compose + Caddy (`ci.yml` job `infra`, jamais exécuté) ; ré-encodage toujours dans la requête (code) ; premier démarrage réel et test de charge k6 à faire |
| 5 | Aveugle en production | [~] | rotation des journaux et niveau info [x] ; `/api/v1/health` base + Redis + file [x] ; healthchecks de tous les conteneurs [~] ; Sentry documenté, non installé ; alertes et sonde externe à poser (`docs/runbooks/observabilite.md`) |
| 6 | Redis `allkeys-lru` sans persistance comme file | [x] | deux instances : `redis` AOF `everysec` + `noeviction`, `redis-cache` LRU (compose) ; `database.php` connexion `cache` sur `REDIS_CACHE_HOST` ; `docs/runbooks/redis.md` (à vérifier sur le serveur) |
| 2 | Sauvegardes en clair, locales, sans restauration prouvée | [~] | chiffrement imposé [x] ; restauration, WAL, copie hors site, versionnage : [ ] |

## Détail par constat

### 2.2 Travail synchrone dans les requêtes web
- [x] Fichier de pool PHP-FPM : `pm=dynamic`, `pm.max_children` (24 pour 2 Go), `pm.max_requests`, `request_terminate_timeout=60s`, `request_slowlog_timeout=5s`, `slowlog`, `clear_env=no`, `ping.path`. Preuve : `infra/php/php-fpm-pool.conf`, `infra/php/Dockerfile` (ENV `FPM_*`, `fcgi`), `.env.prod.example`. Dimensionnement : `docs/runbooks/dimensionnement.md`.
- [x] CI vérifie que le pool est chargé (`php-fpm -tt | grep pm.max_children = 24`), à l'exécution de `ci.yml`.
- [ ] Ré-encodage d'images hors du chemin de requête (file dédiée ou second pool) : changement de code (MediaController / job). Le runbook décrit l'option.

### 2.3 File d'attente, Redis, temps réel
- [x] Redis file : persistance AOF + `noeviction`, instance séparée du cache (voir rang 6).
- [~] Files séparées : workers `realtime,default` (2 réplicas), `worker-push` (file `push`, `--backoff=10`, `--timeout=30`) dans le compose. Aucun job n'envoie encore sur `realtime` / `push` : les `onQueue(...)` et `ShouldBroadcastNow` sont du code backend (à faire).
- [ ] `SendPush` : backoff, doublons, réessai sur 5xx / 429, jeton supprimé sur `INVALID_ARGUMENT` : code.
- [~] Scheduler : un seul conteneur, healthcheck de processus ajouté ; pas de test de panne, pas de séparation de `accounts:purge` (code).
- [~] Reverb : `ulimits.nofile=65536`, `REVERB_APP_MAX_CONNECTIONS`, `REVERB_SCALING_ENABLED` dans le gabarit, healthcheck de port ; test de charge WebSocket et seconde instance non faits.
- [~] Cache de CI différent de la production : job `backend-prodlike` avec Redis et `CACHE_STORE=redis` (`continue-on-error`, jamais exécuté ; des tests peuvent dépendre d'un cache vide entre deux tests).
- [~] PostgreSQL : calcul des connexions et critère d'introduction de PgBouncer écrits (`dimensionnement.md`) ; pas de réglage `max_connections` posé ; PgBouncer non ajouté.
- [ ] URL présignées de 10 minutes qui contournent tout cache : domaine R2 personnalisé, code `ProfilePresenter` / décision propriétaire.

### 3.1 Dépendances externes
- [ ] Délais d'attente et reprises du client R2, `head()` qui avale les erreurs, FCM, RevenueCat : code, hors périmètre.

### 3.2 Migrations, sauvegardes, observabilité
- [ ] Stratégie de migration sans interruption, script / workflow de déploiement, test de gel de `001_initial.sql` : non traité.
- [x] Chiffrement des sauvegardes obligatoire : compose `BACKUP_GPG_RECIPIENT:?` (échec de toute commande compose si vide), `backup.sh` échoue à `preflight` si vide, vérification que le script chiffre (`gpg --encrypt`, suppression du clair, SHA-256 du `.gpg`, envoi du `.gpg` seulement). CI : le job `infra` vérifie que compose refuse un destinataire vide. Doc : `docs/runbooks/sauvegardes-chiffrement.md`.
- [x] Clé publique câblée dans le compose (`BACKUP_GPG_PUBLIC_KEY_PATH` monté en lecture seule sur `/keys/backup-public.asc`, `BACKUP_GPG_PUBLIC_KEY_FILE`) ; clé privée jamais sur le serveur (documenté).
- [x] Dossier `infra/backup/` obsolète : supprimé dans l'arbre de travail (`git status` : `D infra/backup/backup.sh`, `restore.sh`), à committer.
- [ ] Sauvegarde logique 24 h seulement (pas de WAL), copie locale sur le même serveur, bucket et médias R2 non versionnés, restauration jamais exécutée (procès-verbal), alerte : le webhook d'échec existe déjà dans `backup.sh`.
- [x] Journaux : canal `daily` en production (`LOG_STACK`), `LOG_DAILY_DAYS` défaut 14, niveau `info` défaut en production, processeur `RedactLogs` conservé sur tous les canaux. Preuve : `backend/config/logging.php`, gabarits `.env`.
- [x] Santé : `/api/v1/health` vérifie base, Redis (si utilisé) et lecture de la file ; 503 sans détail ; `/up` inchangé et bon marché. Preuve : `backend/app/Http/Controllers/HealthController.php`, `backend/tests/Feature/HealthCheckTest.php` (5 tests, dont fuite d'information et `/up` sans accès base).
- [~] Healthchecks de conteneurs : `app` (ping FastCGI, remplace `php-fpm -t`), `worker`, `worker-push`, `scheduler` (`pgrep`), `reverb` (port), `redis*` (`redis-cli ping`) ; jamais exécutés ; `pgrep` suppose l'applet BusyBox d'Alpine.
- [~] Suivi d'erreurs : crochet Sentry piloté par `SENTRY_LARAVEL_DSN` (vide) et procédure d'activation, signaux à surveiller et seuils d'alerte écrits (`docs/runbooks/observabilite.md`). Aucun paquet installé, aucune alerte posée : décision et compte à créer.
- [x] Dérive des gabarits `.env` : ajoutés `LOG_*`, `RETENTION_*`, `REVERB_SCALING_ENABLED`, `REVERB_APP_MAX_CONNECTIONS`, `MEDIA_PROCESS_*`, `MEDIA_REGION`, `MEDIA_ISOLATE_PROCESSING`, `DISCOVERY_*`, `MAX_SESSIONS_PER_USER`, `OAUTH_*`, `UNVERIFIED_RECLAIM_HOURS`, `TYPED_EMAIL_REFUSAL_DAYS`, `ADMIN_DAILY_*`, `PUSH_MESSAGE_PREVIEW`, variables Redis / FPM / sauvegarde. Restent volontairement absents (valeurs d'outillage Reverb, `*_API_KEY` de paquets non utilisés, `STAFF_OPERATOR`). Les valeurs `RETENTION_*` restent des choix juridiques à valider.
- [ ] `APP_DEBUG=true` dans `.env.example` sans garde-fou de recopie en production (test de démarrage en `production` avec `APP_DEBUG=true`) : code.
- [ ] Version PHP 8.5 locale contre 8.4 en CI : non testée (matrice de versions non ajoutée).

### 4.1 CI
- [~] Couverture : job `backend-prodlike` mesure avec pcov et publie `coverage.xml` + résumé ; aucun seuil bloquant (valeur mesurée inconnue). À ajouter après la première exécution : `--min=NN`.
- [~] PHPStan / Larastan niveau 5 : `composer.json` n'a pas Larastan et `composer.lock` ne peut pas être régénéré ici (pas de Composer) : le paquet est installé dans le runner seulement (`composer require --dev`), configuration `.github/workflows/phpstan.neon`, job informatif. Pour le rendre permanent : `composer require --dev larastan/larastan` sur un poste avec Composer.
- [x] Image Docker construite en CI avec `--pull` (application et sauvegarde), `docker compose config`, `caddy validate`, `php-fpm -t`, test de rétention ; [~] `shellcheck` et `hadolint` informatifs.
- [x] Déclencheurs sur `infra/**` (et planification hebdomadaire) dans `ci.yml`.
- [x] Mobile : typecheck, lint et Jest déjà dans `mobile.yml` ; non dupliqué.
- [ ] Audit npm étiqueté « informatif » mais bloquant sur « high », Dependabot / Renovate, workflow de déploiement et build EAS, Maestro nocturne : non traités (Dependabot est hors périmètre `workflows/`).
- [ ] Statut vert sur le commit publié : à constater après poussée, rien n'a été poussé.

## À faire ensuite, par ordre d'effet

1. Premier démarrage sur un serveur de préproduction : `docker compose config`, `up`, `php-fpm -tt`, `redis-cli config get`, healthchecks, `GET /api/v1/health`.
2. Exécuter `ci.yml` une fois, lire les résultats (couverture, PHPStan, shellcheck, hadolint, Redis), puis rendre les jobs bloquants.
3. Backend : `onQueue('realtime')` / `onQueue('push')`, `ShouldBroadcastNow` pour les messages, correctifs `SendPush`, ré-encodage hors requête.
4. Restauration chronométrée avec procès-verbal ; archivage WAL ou instantanés du VPS.
5. Sonde externe + alertes (`observabilite.md`), puis Sentry si décidé.
