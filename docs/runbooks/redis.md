# Redis : deux instances, persistance et éviction

Contexte : revue CTO n°1, section 2.3. Avant ce changement, une seule instance `allkeys-lru` sans persistance servait de file d'attente, de cache, de limiteur de débit et de session. Sous pression mémoire, Redis pouvait effacer des tâches en file (pushes, diffusions, exports RGPD) sans aucune trace, et un redémarrage perdait toute la file.

## Disposition (infra/docker-compose.prod.yml)

| service | usage (connexion Laravel) | persistance | politique mémoire | limite par défaut |
| --- | --- | --- | --- | --- |
| `redis` | file d'attente, sessions, pub/sub Reverb (`default`) | AOF `everysec` (volume `redis-data`) | `noeviction` | 512 Mo (`REDIS_QUEUE_MAXMEMORY`) |
| `redis-cache` | cache applicatif et limiteurs de débit (`cache`) | aucune | `allkeys-lru` | 256 Mo (`REDIS_CACHE_MAXMEMORY`) |

Variables (`infra/.env.prod`) : `REDIS_HOST=redis`, `REDIS_CACHE_HOST=redis-cache`, `REDIS_PASSWORD` (commun aux deux), `REDIS_QUEUE_MAXMEMORY`, `REDIS_CACHE_MAXMEMORY`, `REDIS_CONNECT_TIMEOUT`, `REDIS_READ_WRITE_TIMEOUT`. Dans `backend/config/database.php`, la connexion `cache` lit `REDIS_CACHE_HOST` (repli sur `REDIS_HOST` : en développement et en CI il n'y a qu'une instance).

## Ce que cela garantit, et ce que cela ne garantit pas

- `noeviction` : si l'instance `redis` atteint sa limite, elle REFUSE les écritures (erreur `OOM command not allowed`) au lieu d'effacer des tâches. Une panne visible vaut mieux qu'une perte silencieuse. Alerte à poser avant (voir `observabilite.md`) : mémoire utilisée au-delà de 70 % de `REDIS_QUEUE_MAXMEMORY`.
- AOF `everysec` : en cas d'arrêt brutal, on perd au plus environ une seconde d'écritures. Ce n'est pas une sauvegarde : le volume `redis-data` n'est ni copié ni chiffré par le script de sauvegarde. Une tâche perdue irrémédiablement reste rejouable à la main (RGPD : `BuildDataExport` se relance depuis la demande en base).
- Les sessions sont sur l'instance persistante : un redémarrage de `redis` ne déconnecte pas les utilisateurs (les jetons d'API Sanctum sont de toute façon en base).
- Le cache est volontairement perdu au redémarrage. Les jetons à usage unique (`Cache::add` dans `AgeGate`) et les compteurs de limitation de débit se reconstruisent ; la fenêtre de rejeu qui en résulte est courte (durée de vie du jeton).

## Vérifier sur le serveur (jamais fait)

```
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec redis \
  sh -c 'redis-cli config get appendonly; redis-cli config get appendfsync; redis-cli config get maxmemory-policy'
# attendu : yes / everysec / noeviction
docker compose ... exec redis-cache sh -c 'redis-cli config get maxmemory-policy'   # attendu : allkeys-lru
docker compose ... exec redis sh -c 'redis-cli info memory | grep -E "used_memory_human|maxmemory_human"'
docker compose ... exec redis sh -c 'redis-cli llen queues:default'                  # profondeur de la file
```

Test de reprise après arrêt : mettre une tâche en file avec le worker arrêté (`docker compose stop worker`), faire `docker compose restart redis`, vérifier que `llen queues:default` n'a pas changé, redémarrer le worker.

## Alternative au lancement

Si l'exploitation de deux instances est jugée trop lourde pour la bêta : `QUEUE_CONNECTION=database` (déjà supporté) garde la file dans PostgreSQL, donc sauvegardée avec la base. Le coût est de la charge sur la base. Dans ce cas, `redis` ne sert plus que de sessions et de Reverb.

## Files séparées

Les workers écoutent `realtime,default` (2 réplicas) et `push` (1 worker). Le code n'envoie encore rien sur `realtime` ni `push` : tant que les jobs n'appellent pas `->onQueue(...)`, tout passe par `default` et les workers dédiés restent au repos. Suite à faire côté backend : `onQueue('realtime')` sur les diffusions, `onQueue('push')` sur `SendPush`.
