# Dimensionnement : PHP-FPM, workers, Reverb, PostgreSQL

Contexte : revue CTO n°1, sections 2.2 et 2.3. Aucune valeur ci-dessous n'a été mesurée : ce sont des points de départ calculés, à confirmer par un test de charge (k6) en préproduction.

## PHP-FPM (infra/php/php-fpm-pool.conf)

Avant : aucun fichier de pool, valeurs par défaut de l'image officielle (environ 5 processus). `POST /media/{id}/complete` télécharge, ré-encode (sous-processus, 10 s max) et réécrit l'image dans la requête : cinq inscriptions simultanées avec photos saturaient toute l'API.

Règle : `FPM_MAX_CHILDREN = (APP_MEMORY_LIMIT - 256 Mo) / 60 Mo`.

| conteneur `app` | FPM_MAX_CHILDREN | FPM_START / MIN / MAX spare |
| --- | --- | --- |
| 1 Go (VPS 4 Go) | 12 | 4 / 3 / 6 |
| 2 Go (défaut) | 24 | 6 / 4 / 10 |
| 4 Go | 48 | 12 / 8 / 20 |

Le sous-processus de ré-encodage (limite `MEDIA_PROCESS_MEMORY_LIMIT=256M`) s'ajoute à un processus FPM pendant l'envoi d'une image : la marge de 256 Mo couvre quelques envois simultanés, pas des dizaines. Si le trafic d'envoi de photos devient dominant, déplacer le ré-encodage vers une file (travail backend) ou ajouter un second pool FPM dédié aux routes média.

Autres réglages : `pm = dynamic`, `pm.max_requests=500` (recyclage), `request_terminate_timeout=60s`, `request_slowlog_timeout=5s` (les requêtes de plus de 5 s sont tracées sur la sortie d'erreur du conteneur : `docker compose logs app | grep -A8 "slow"`), `ping.path=/fpm-ping` (sonde du healthcheck, non exposée par Caddy).

À changer ensemble : `APP_MEMORY_LIMIT` et `FPM_MAX_CHILDREN` dans `infra/.env.prod`. Surveiller `docker stats` : un conteneur `app` qui approche de sa limite ou un événement OOM (`docker inspect --format '{{.State.OOMKilled}}'`) signifie qu'il faut baisser `FPM_MAX_CHILDREN` ou monter la mémoire.

Vérifier le pool : `docker compose ... exec app php-fpm -tt 2>&1 | grep -E "pm\.|request_"`.

## Workers de file

| service | files | réplicas | rôle |
| --- | --- | --- | --- |
| `worker` | `realtime,default` (dans cet ordre de priorité) | `WORKER_REPLICAS` (2) | diffusions, e-mails, exports |
| `worker-push` | `push` | 1 | FCM (délai de 5 s par requête, jamais bloquant pour le reste) |
| `scheduler` | (planificateur) | 1, ne jamais répliquer | nettoyage RGPD, appels expirés |

`--max-jobs=1000` et `--max-time=3600` recyclent les workers (fuites mémoire). `stop_grace_period` laisse finir la tâche en cours lors d'un déploiement. `retry_after` (90 s, `REDIS_QUEUE_RETRY_AFTER`) doit rester supérieur au `--timeout` du worker le plus long (60 s).

## Reverb

Un seul processus, descripteurs de fichiers relevés à 65536 (`ulimits.nofile` du compose), `REVERB_APP_MAX_CONNECTIONS=5000`. Estimation (non mesurée) : 300 à 1 000 connexions simultanées en pointe à 10 000 actifs par mois, dans les capacités d'un processus. À partir d'environ 1 000 connexions simultanées ou avant d'ajouter une seconde instance : mettre `REVERB_SCALING_ENABLED=true` (pub/sub sur l'instance `redis`), puis ajouter l'instance. Test de charge WebSocket à faire avant d'annoncer une capacité.

## PostgreSQL

`max_connections` reste à 100 (défaut). Consommation estimée avec la configuration ci-dessus : FPM 24 + workers (2 + 1) + planificateur 1 + Reverb 1 + sauvegarde 1, soit environ 30 connexions simultanées au maximum. Si `FPM_MAX_CHILDREN` dépasse 60 ou si un second nœud applicatif est ajouté, installer PgBouncer (mode transaction : attention aux verrous consultatifs de `SwipeService`, qui exigent le mode session ou une connexion dédiée) avant de relever `max_connections`.

## Sonde de santé

- `GET /up` : bon marché, ne touche à aucun service. Pour le répartiteur de charge ou la sonde « le processus répond ».
- `GET /api/v1/health` : base, Redis et lecture de la file ; 200 si tout répond, 503 sinon, sans détail (`{"status","db","redis","queue"}` avec `ok` / `error` / `skipped`). Pour la supervision externe (Uptime Kuma). Elle ne prouve pas qu'un worker consomme la file : voir `observabilite.md`.
