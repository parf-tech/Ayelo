# Déploiement de production (VPS, Docker Compose)

Dernière mise à jour : 2026-11-18. Script : `infra/scripts/deploy.sh`. Contrôle de configuration : `php artisan deploy:preflight`.

**Statut : écrit, jamais exécuté.** Il n'y a ni serveur, ni Docker, ni Caddy sur le poste de développement. Ce qui a été essayé : l'ordre des étapes du script avec un faux `docker` (`infra/scripts/tests/deploy_test.sh`, 20 vérifications, rejoué en CI), la commande `deploy:preflight` (tests Pest `DeployReadinessTest`), les migrations et les caches de configuration, de routes et d'événements en mode production sur PostgreSQL 16. Tout le reste (construction de l'image, Compose, Caddy, certificats, assets du panneau, santé des conteneurs) est à valider en préproduction avant la première mise en production.

## Prérequis

- Un VPS (8 Go, 4 vCPU à confirmer, `docs/14-DEPLOYMENT.md`) avec Docker Engine et Docker Compose v2 (`docker compose`), accès SSH par clé, `ufw` (22 restreint, 80, 443).
- Les enregistrements DNS `API_DOMAIN`, `WS_DOMAIN`, `ADMIN_DOMAIN` et `WEB_DOMAIN` pointent vers le serveur (Caddy obtient les certificats au premier démarrage ; sans DNS valide il échoue et réessaie).
- `infra/.env.prod` créé depuis `infra/.env.prod.example`, droits `600`, hors dépôt. Le script refuse un autre mode.
- Les clés et secrets fournis par le propriétaire (aucun n'est créé par l'équipe) : stockage objet `MEDIA_*`, `REDIS_PASSWORD`, `DB_PASSWORD`, `APP_KEY` (`php artisan key:generate --show`), Reverb, et si les fonctions sont ouvertes RevenueCat, FCM, LiveKit, Google et Apple, e-mail.
- Pour les sauvegardes : `BACKUP_GPG_RECIPIENT` et le fichier de clé publique `BACKUP_GPG_PUBLIC_KEY_PATH` (`docs/runbooks/sauvegardes-chiffrement.md`). Le compose refuse de démarrer sans eux.
- Une copie du dépôt sur le serveur, à l'étiquette à déployer (`git checkout vX.Y.Z`).

## Premier déploiement

```bash
cd /srv/ayelo                      # copie du dépôt, à l'étiquette voulue
bash infra/scripts/deploy.sh --first
```

`--first` saute la sauvegarde préalable (base vide, service `backup` pas encore lancé). Ensuite :

1. Créer le premier administrateur : `docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec app php artisan staff:create <e-mail> admin` (mot de passe affiché une seule fois ; 2FA à configurer à la première connexion sur `https://<ADMIN_DOMAIN>/admin`). Ne jamais lancer `db:seed` en production : les jeux de démonstration refusent de s'exécuter.
2. Renseigner `ADMIN_ALLOWED_IPS` (la valeur d'exemple est une plage de documentation : personne n'entre).
3. Dérouler « Après le premier déploiement » ci-dessous.

## Déploiements suivants

```bash
git fetch --tags && git checkout vX.Y.Z
bash infra/scripts/deploy.sh
```

## Ce que fait le script, dans l'ordre

| étape | pourquoi |
| --- | --- |
| Préconditions : Docker présent, `infra/.env.prod` en `600` | un fichier de secrets lisible par d'autres est refusé |
| Sauvegarde fraîche (`backup.sh` dans le conteneur `backup`) | c'est le retour arrière des données : la migration initiale refuse son `down()` hors local et testing (`drop schema public cascade`) |
| `docker compose build --pull` | images à jour |
| PostgreSQL et Redis seuls, attente de leur santé | la migration a besoin de la base |
| `php artisan deploy:preflight` | une configuration incomplète arrête le déploiement AVANT toute migration (voir ci-dessous) |
| Recopie de `.public-dist` dans `public/`, puis `filament:assets`, en root | le volume `app-public` (partagé avec Caddy) n'est rempli qu'à sa création ; sans cette étape, `index.php` reste celui de la première image et le panneau n'a pas ses scripts et styles. En root car `public/` n'appartient pas à `www-data` (une faille applicative ne doit pas pouvoir y déposer un script servi par Caddy). `LOG_CHANNEL=stderr` évite de créer en root un journal que `www-data` ne pourrait plus écrire |
| `php artisan migrate --force` | exécuté pendant que l'ancien code sert encore : toute migration doit rester compatible avec lui (ajouter d'abord, retirer dans un déploiement ultérieur) |
| `docker compose up -d --remove-orphans`, puis attente de la santé de `app`, `reverb`, `scheduler`, `worker`, `worker-push` | `--wait` n'est pas utilisé : le service `backup` reste « starting » jusqu'à sa première sauvegarde (36 h) |
| `config:cache`, `route:cache`, `event:cache` dans `app` | gain de démarrage par requête ; refaits à chaque déploiement car ils vivent dans le conteneur |
| `GET https://<API_DOMAIN>/api/v1/health` jusqu'à `"status":"ok"` (12 essais) | le certificat peut mettre quelques secondes au premier déploiement |

`deploy:preflight` s'arrête (code 1) sur : `APP_ENV` différent de `production`, `APP_DEBUG` actif, `APP_KEY` vide, `APP_URL` non https, `ADMIN_DOMAIN` vide, base autre que PostgreSQL, file `sync`, `SAFETY_STATE_STORE` vide, `MEDIA_ENDPOINT` / `MEDIA_BUCKET` / `MEDIA_ACCESS_KEY` / `MEDIA_SECRET_KEY` vides ou endpoint non https, `MEDIA_AUTO_APPROVE` actif. Il avertit (sans bloquer) pour `MEDIA_SIGN_UPLOAD_HEADERS=false`, `REVENUECAT_WEBHOOK_SECRET`, FCM, LiveKit, `MAIL_WEBHOOK_SECRET`, `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS`. Il n'affiche jamais une valeur.

L'application démarre volontairement même si ces valeurs manquent (un démarrage interrompu casserait le build de l'image et `config:cache`) : sans ce contrôle, une clé de stockage vide ne se verrait qu'au premier dépôt de photo.

## Après le premier déploiement : stockage objet (R2)

Rien de ceci n'a été fait : le code S3 n'a jamais parlé à un vrai bucket.

1. **Buckets privés** `media-prod` (et `media-staging`), sans accès public ni domaine personnalisé. Un bucket séparé `backups` pour les sauvegardes, avec ses propres clés (`BACKUP_*`).
2. **Jeton d'API R2 limité** à « Object Read & Write » sur le seul bucket `media-prod` (pas de jeton de compte). C'est la valeur de `MEDIA_ACCESS_KEY` / `MEDIA_SECRET_KEY`. `MEDIA_ENDPOINT` = `https://<identifiant de compte>.r2.cloudflarestorage.com` (sans le nom du bucket ; le client utilise l'adressage par chemin). `MEDIA_REGION=auto`.
3. **Pas de CORS** : les clients mobiles natifs déposent par PUT sans navigateur. Il ne serait nécessaire que pour un client web qui téléverserait directement.
4. **Essai réel, en préproduction** : dépôt d'une photo (`POST /media/upload-url`, PUT sur l'URL présignée, `POST /media/{id}/complete`), lecture par URL présignée, suppression ; export de données (`POST /me/export`) ; balayage `php artisan media:sweep-orphans --dry-run`. Aucun de ces appels n'a jamais été exécuté contre R2.
5. **Lier taille et type à l'URL présignée** (P-07) : après l'essai, passer `MEDIA_SIGN_UPLOAD_HEADERS=true` et refaire un dépôt depuis l'application mobile. Le client doit envoyer exactement le `Content-Type` annoncé et un corps de la taille déclarée. Tant que la valeur est `false`, `media:purge-oversized` (toutes les 5 minutes) supprime les dépôts hors norme.
6. **Règles de cycle de vie.** Ne PAS en poser sur `u/` : les dépôts en attente et les médias approuvés y partagent le même préfixe (`u/<utilisateur>/<type>/<id>.<ext>`), une règle de durée effacerait les photos des membres. Sur `exports/` seulement : suppression après 8 jours (les exports vivent 7 jours, `DataExport::TTL_DAYS`, et `exports:purge` les supprime déjà chaque nuit ; la règle n'est qu'une seconde sécurité). R2 ne borne pas la taille d'un objet par bucket : seule la présignature liée (point 5) le fait.
7. **Erreurs** : depuis cette passe, `head()` ne prend plus un refus d'accès (403) ou une panne (5xx) pour « objet absent ». Une mauvaise clé donne une erreur 500 journalisée sur `POST /media/{id}/complete`, plus un 422 « fichier introuvable ». Les clients S3 ont un délai de connexion de 3 s, un délai total de 20 s et une nouvelle tentative (`MEDIA_CONNECT_TIMEOUT`, `MEDIA_HTTP_TIMEOUT`, `MEDIA_RETRIES`) : au plus 2 x 20 s, sous la limite de 60 s de PHP-FPM.

## En cas d'échec

Le script ne défait rien. Il nomme l'étape en échec.

| étape | état | reprise |
| --- | --- | --- |
| sauvegarde, construction, préconditions, `deploy:preflight` | rien n'a changé en service | corriger puis relancer le script |
| synchronisation de `public/` | `public/` peut être à moitié copié, l'ancien code sert encore | relancer le script |
| migrations | sous PostgreSQL chaque migration s'exécute dans une transaction : une migration en échec est annulée en entier. Exception : `2026_11_08_000000_add_hot_path_indexes` (index créés `CONCURRENTLY`, hors transaction) ; interrompue, elle peut laisser un index INVALIDE à supprimer avant de relancer (voir le commentaire de la migration) | lire l'erreur ; corriger ; relancer avec `--skip-build`. Si la base est dans un état douteux : restauration (ci-dessous) |
| relance, santé, caches | le nouveau code sert, la migration est passée | `docker compose ... logs <service>` ; relancer avec `--skip-build` |
| santé publique | les conteneurs tournent mais `/api/v1/health` ne répond pas « ok » | `curl -i https://<API_DOMAIN>/api/v1/health` ; le corps nomme le composant en défaut (`db`, `redis`, `queue`) ; Caddy : `docker compose ... logs caddy` |

**Retour arrière du code** : se replacer sur l'étiquette précédente (`git checkout vX.Y.(Z-1)`) et relancer `deploy.sh`. C'est sûr seulement si la migration du déploiement annulé est compatible avec l'ancien code (règle « ajouter d'abord, retirer ensuite »). Les migrations postérieures à la migration initiale ont un `down()`, pas la migration initiale (`2026_11_05_000000`, `drop schema public cascade`, refusée hors local et testing).

**Retour arrière des données** : restauration de la sauvegarde prise au début du déploiement, `docs/runbooks/restauration.md`. La restauration n'a jamais été exécutée ; l'exercice chronométré est un bloquant de la revue CTO n°1.

## Ce que le script ne fait pas

- Il ne crée ni serveur, ni DNS, ni compte, ni bucket, ni clé.
- Il ne lance pas `db:seed` et ne crée pas d'administrateur.
- Il n'active pas le mode maintenance : pendant la migration, l'ancien code sert avec le nouveau schéma.
- Il n'épingle pas les images (`caddy`, `postgres`, `redis`, `php`) par condensat : voir `docs/reviews/pentest-1-suivi-infra.md`.
- Il ne remplace pas la préproduction : `docker compose config`, `caddy validate`, `php-fpm -tt` et la construction de l'image sont dans `ci.yml`, mais le premier déploiement réel reste à faire.
