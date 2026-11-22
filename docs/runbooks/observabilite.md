# Observabilité : journaux, santé, alertes, suivi d'erreurs

Contexte : revue CTO n°1, section 3.2. Avant : ni suivi d'erreurs, ni métriques, ni alertes ; journal unique `laravel.log` en niveau debug, sans rotation, dans le volume `app-storage`.

## Journaux (en place)

- Production : `LOG_CHANNEL=stack`, `LOG_STACK=daily`, `LOG_LEVEL=info`, `LOG_DAILY_DAYS=14` (fichiers `storage/logs/laravel-AAAA-MM-JJ.log`, rotation et suppression automatiques). Même sans ces variables, `config/logging.php` choisit `daily` et `info` quand `APP_ENV=production`.
- Le processeur de masquage `RedactLogs` / `RedactSensitiveData` reste appliqué à tous les canaux (mots de passe, jetons, e-mails).
- PHP-FPM écrit les requêtes lentes (> 5 s) sur la sortie d'erreur du conteneur : `docker compose logs app`.
- Taille : surveiller le volume `app-storage` (alerte disque ci-dessous).

## Sondes de santé

| sonde | URL / commande | rôle |
| --- | --- | --- |
| `/up` | `https://<API_DOMAIN>/up` | le processus répond ; ne touche à aucun service ; pour le répartiteur ou une sonde externe fréquente |
| `/api/v1/health` | `https://<API_DOMAIN>/api/v1/health` | base + Redis + lecture de la file ; 503 si l'un échoue ; corps `{"status","db","redis","queue"}` sans détail ; toutes les 1 à 5 minutes |
| healthchecks Docker | `docker compose ps` | `app` (ping FastCGI), `worker`, `worker-push`, `scheduler` (processus vivant), `reverb` (port 8080), `redis*`, `postgres`, `backup` (réussite < 36 h) |

Mettre une sonde EXTERNE (Uptime Kuma sur une autre machine, ou un service gratuit) sur `/api/v1/health` : une sonde interne tombe avec le serveur.

## Sonde externe : un site qui répond 200 n'est pas un site en bonne santé

Le site de présentation (`https://<WEB_DOMAIN>`) a un repli statique : application arrêtée, Caddy répond quand même **HTTP 200** avec les fichiers de `web/` (`docs/runbooks/site-public.md`). Une alerte « le site répond 200 » reste donc verte pendant une vraie panne de l'application. Deux contrôles indépendants, un script (`infra/scripts/probe-externe.sh`, `curl` seulement, aucun secret, GET uniquement) :

| commande | ce qu'elle lit | alerte (`ALERTE <contrôle> <cause>`, sortie 1) |
| --- | --- | --- |
| `bash infra/scripts/probe-externe.sh api https://<API_DOMAIN>` | `/api/v1/health` : 200 **et** corps `"status":"ok"` | `api_injoignable` (réseau, délai 15 s), `api_degrade` (503, composants `db` / `redis` / `queue` nommés), `api_reponse_inattendue` (autre code, ou 200 sans `"status":"ok"`) |
| `bash infra/scripts/probe-externe.sh site https://<WEB_DOMAIN>` | `/legal/terms` : 200 **et** en-tête `X-Site-Source: app` | `site_injoignable`, `site_hors_service` (code autre que 200), **`site_repli_statique`** (200 sans `X-Site-Source: app` : l'application est arrêtée ou en échec, le site tient grâce au repli) |

- Sortie 0 : tout va bien ; 1 : panne (la cause est sur la ligne affichée) ; 2 : mauvais usage (adresse sans `https://`, contrôle inconnu ; aucune requête envoyée).
- Les deux contrôles sont **deux alertes distinctes** : `api` mesure l'application directement ; `site` repère le cas que le code HTTP cache. Les brancher sur deux moniteurs, pas sur un seul. Chaque requête porte un paramètre `?sonde=<heure>` et `Cache-Control: no-cache` : on lit l'état réel, pas une copie en cache (la page de l'application est servie avec `max-age=300`).
- **Où l'exécuter : sur une autre machine que le serveur**, toutes les 5 minutes : par exemple un `cron` ou un moniteur « push » d'Uptime Kuma (la commande puis `curl` de l'adresse de push si la sortie est 0), ou une tâche planifiée d'un service d'intégration continue. **État au 2026-11-22 : le script est écrit, testé (`infra/scripts/tests/probe_externe_test.sh`, 19 vérifications, rejoué en CI) et essayé une fois à la main sur la production (deux `OK`). L'exécution planifiée est le workflow `.github/workflows/sonde-externe.yml` (deux tâches, `api` et `site`, toutes les 5 minutes, depuis les serveurs de GitHub ; dépôt public donc sans coût).** Il n'est **actif qu'une fois fusionné dans la branche par défaut (`main`)** : un planning GitHub ne tourne pas ailleurs. Chaque tâche tente 3 fois à 30 s d'intervalle avant d'échouer (un rechargement de Caddy ne déclenche rien) ; un échec envoie un e-mail GitHub à la personne qui a modifié le planning en dernier (notifications « Actions », option « failed workflows only » de son compte). Deux limites de GitHub : le planning est désactivé après 60 jours sans activité dans le dépôt (un e-mail d'avertissement arrive : le relancer dans l'onglet Actions), et un lancement peut avoir quelques minutes de retard aux heures de pointe. Premier contrôle après la fusion : onglet Actions, « sonde-externe », « Run workflow », les deux tâches doivent être vertes ; essai de l'alerte : arrêter `app` quelques minutes (`docker compose ... stop app`, puis `start app`) et voir `site` rouge avec la cause `site_repli_statique` et `api` rouge avec `api_injoignable` ou `api_reponse_inattendue`.
- Piège à éviter : un moniteur HTTP « le site répond 200 » sur `https://<WEB_DOMAIN>/` est insuffisant ; s'il existe déjà, le laisser (il voit Caddy tomber) mais ne pas le compter comme surveillance de l'application.

## Que surveiller et quand alerter

| signal | comment le lire | seuil d'alerte proposé |
| --- | --- | --- |
| profondeur de la file | `docker compose exec redis redis-cli llen queues:default` (puis `queues:push`, `queues:realtime`) | > 500 pendant 5 min ; > 0 et inchangé depuis 10 min (worker bloqué) |
| tâches en échec | `docker compose exec app php artisan queue:failed` ; ou `select count(*) from failed_jobs` | toute nouvelle ligne ; `QueueDeadLetterServiceProvider` journalise déjà une ligne `critical` |
| taux d'erreurs 5xx | journaux Caddy (`docker compose logs caddy`) ou, avec Sentry, le taux d'erreurs | > 1 % des requêtes sur 5 min ; toute rafale de 5xx |
| dernière sauvegarde réussie | healthcheck du service `backup` (`find /backups/.last_success -mmin -2160`) ; `BACKUP_ALERT_WEBHOOK_URL` appelé à l'échec | `unhealthy` ou aucune réussite depuis 26 h ; test de restauration tous les mois |
| mémoire Redis (file) | `redis-cli info memory` : `used_memory` / `maxmemory` | > 70 % (au-delà de 100 % la file refuse les écritures : `noeviction`) |
| disque | `df -h` de l'hôte, taille des volumes `pgdata`, `app-storage`, `backups` | > 80 % |
| mémoire des conteneurs | `docker stats --no-stream` ; `State.OOMKilled` | conteneur `app` > 85 % de sa limite ; tout OOM |
| scheduler vivant | healthcheck `scheduler` ; sinon dernière ligne de `schedule:work` | `unhealthy` (tout le nettoyage RGPD en dépend) |
| certificats | expiration TLS de `<API_DOMAIN>`, `<WS_DOMAIN>`, `<ADMIN_DOMAIN>` | < 14 jours (Caddy renouvelle seul : une alerte signale un échec ACME) |

Il n'existe aucun exporteur de métriques dans le dépôt : ces lectures sont manuelles ou à brancher sur l'outil de supervision choisi (Uptime Kuma « push monitors » avec un cron qui exécute les commandes ci-dessus, par exemple). Le seul signal automatique aujourd'hui : healthchecks Docker, webhook d'échec de sauvegarde, ligne `critical` dans les journaux.

## Suivi d'erreurs Sentry (facultatif, désactivé par défaut)

Rien n'est installé : aucun paquet Composer n'a été ajouté. Le crochet est entièrement piloté par l'environnement : `SENTRY_LARAVEL_DSN` (vide dans `infra/.env.prod.example` et `backend/.env.example`) et `SENTRY_TRACES_SAMPLE_RATE=0`. Vide = aucun envoi.

Pour l'activer, quand la décision est prise (coût indicatif : 29 $/mois, `docs/14b-COSTS.md`) :

1. Sur un poste avec Composer : `composer require sentry/sentry-laravel` dans `backend/`, puis committer `composer.json` et `composer.lock`.
2. Le paquet lit `SENTRY_LARAVEL_DSN` seul (pas de commande de configuration obligatoire). Brancher la remontée des exceptions dans `bootstrap/app.php` : `->withExceptions(function (Exceptions $exceptions) { \Sentry\Laravel\Integration::handles($exceptions); })`.
3. Renseigner `SENTRY_LARAVEL_DSN` dans `infra/.env.prod`, redémarrer `app`, `worker`, `worker-push`, `scheduler`, `reverb`.
4. Données personnelles : laisser `send_default_pii` à `false` (valeur par défaut de `config/sentry.php`), ne pas activer les traces de requêtes SQL avec valeurs, et inscrire Sentry comme sous-traitant dans la matrice RGPD (`docs/legal/`). Choisir la région UE.
5. Règles d'alerte à créer dans Sentry : nouvelle erreur en production, pic de fréquence (> 20 événements en 5 min), échec d'un job (`failed_jobs`).

Le mobile n'a pas non plus de client de suivi d'erreurs (travail séparé).
