# Test de charge (k6) sur une copie jetable

**Quoi** : `infra/perf/run.sh` construit l'image de l'application depuis le dépôt présent, démarre une pile **isolée** (PostgreSQL, deux Redis, PHP-FPM, Caddy, worker, Reverb, faux stockage S3), la remplit de **données fictives**, lance k6, puis détruit tout (conteneurs, volumes, image). Objectifs de `docs/13-TEST-STRATEGY.md` : p95 de l'API sous 300 ms hors médias, envoi de message sous 1 s.

**Isolation** : projet compose `ayelo-perf`, réseau interne sans accès extérieur, aucun port publié, volumes propres, secrets tirés au hasard. Aucune commande ne vise un autre projet ; aucune commande `prune`. Le banc partage la machine : processeur et mémoire bornés par conteneur, mais la construction de l'image et la charge la sollicitent.

## Lancer

Sur une machine avec Docker et compose, depuis un clone du dépôt :

```bash
bash infra/perf/run.sh /chemin/resultats                                  # 200 000 profils, 500 acteurs, échelle 1
PERF_SCALES="0.1 0.25 0.5" bash infra/perf/run.sh /chemin/resultats 200000 500 1 45s   # trois paliers, mêmes données
PERF_APP_CPUS=4 PERF_DB_CPUS=2 bash infra/perf/run.sh /chemin/resultats   # processeur proche de la production
UPLOAD_PEAK=0 bash infra/perf/run.sh /chemin/resultats                    # sans dépôt d'image
MEDIA_ASYNC_IMAGES=true bash infra/perf/run.sh /chemin/resultats-async
```

Échelle 1 : découverte 30 req/s, liste des conversations 30, lecture d'un fil 30, envoi 10, dépôt d'image 2 (`UPLOAD_PEAK`).

## Résultats

| fichier | contenu |
| --- | --- |
| `k6.txt`, `summary.json` | latences par route, taux d'échec, objectifs atteints ou non |
| `explain.txt` | plan réel de la requête de découverte (`EXPLAIN ANALYZE`) |
| `slow-queries.txt` | requêtes de plus de 200 ms |
| `stats.txt` | processeur et mémoire des conteneurs, toutes les 15 s |
| `errors.txt`, `failed-jobs.txt` | erreurs de l'application, tâches échouées |
| `volume.txt` | taille du jeu de données |

## Limites

La mesure vaut pour la machine, le volume et les débits essayés. Pas de TLS, pas de réseau mobile, pas de stockage distant réel (R2), pas de FCM, pas de connexions WebSocket simultanées.
