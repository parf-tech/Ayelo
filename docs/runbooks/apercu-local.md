# Aperçu local des écrans connectés (Expo web + backend réel)

Dernière mise à jour : 2026-11-12.

Objectif : voir dans le navigateur, pour une vérification visuelle uniquement, les écrans connectés de l'application mobile (découverte, messages, profil, réglages) servis par le vrai backend Laravel et des données de démonstration. Tout reste sur la machine, sur `127.0.0.1` ; aucun hôte externe n'est contacté et aucun secret réel n'est utilisé.

## Démarrage

Depuis la racine du dépôt :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-preview.ps1
```

Le script, dans l'ordre :

1. choisit un PHP 8.4.1 ou plus qui charge `pdo_pgsql` (variable `PHP_PGSQL_BIN`, puis `tools\php84`, puis les PHP installés par WinGet, puis le `php` du PATH) ;
2. démarre un PostgreSQL 16 embarqué **séparé** des tests : port 54350, base `app_preview` (`scripts/pg16-preview.mjs`, paramétrable `--port`, `--db`, `--dir`) ; les tests Pest gardent le port 54330 et la base `app_test` ;
3. exécute `artisan migrate --force` puis `db:seed --class=Database\Seeders\PreviewSeeder --force` ;
4. démarre le serveur PHP intégré du backend sur le port 8000 et un serveur statique sur le port 8001 (illustrations des photos fictives) ;
5. attend `GET /api/v1/health`, puis affiche la commande Expo.

Ensuite, dans un autre terminal (l'URL est la racine du serveur, **sans** `/api/v1` : le client ajoute le préfixe, voir `mobile/src/api/client.ts`) :

```powershell
cd mobile
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:8000'; $env:CI='1'; npx expo start --web --port 8089
```

Ouvrir `http://localhost:8089` et se connecter avec `apercu@example.test`. Le mot de passe est généré au premier lancement et stocké dans `%TEMP%\ayelo-preview\preview-password.txt` (hors dépôt, jamais affiché). Pour en imposer un (12 caractères au moins), définir `PREVIEW_PASSWORD` avant de lancer le script.

Arrêt (n'arrête que ce que le script a démarré, et supprime la base jetable) :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-preview.ps1 -Stop
```

Paramètres : `-ApiPort 8000 -MediaPort 8001 -PgPort 54350 -WebPort 8089 -Database app_preview`. Passer les mêmes ports à `-Stop` n'est pas nécessaire (les PID sont dans `%TEMP%\ayelo-preview\state.json`). Les journaux sont dans `%TEMP%\ayelo-preview\logs`. La base est recréée à chaque démarrage (PostgreSQL non persistant).

## Ce qui est configuré

Variables fixées pour les processus enfants seulement (la session PowerShell et `backend/.env` ne sont pas modifiés ; les valeurs vides écrasent aussi celles d'un `.env` local) : `APP_ENV=local`, `APP_DEBUG=true`, `QUEUE_CONNECTION=sync`, `CACHE_STORE=database`, `SESSION_DRIVER=array`, `BROADCAST_CONNECTION=null`, `MAIL_MAILER=log`, `APP_KEY` aléatoire local, `CORS_DEV_ORIGINS` (origines `http://localhost:8089` et `http://127.0.0.1:8089`), `MEDIA_ENDPOINT` vers le serveur statique local avec des clés factices, et `FCM_*`, `LIVEKIT_*`, `REVENUECAT_*`, `REVERB_*`, `AWS_*`, `GOOGLE_*`, `APPLE_*`, `SENTRY_*` vides. Les limites de débit de l'API restent actives (la connexion : 15 essais par 15 minutes et par appareil).

Le serveur d'API est lancé par `php -S` avec le routeur de Laravel plutôt que par `php artisan serve` : `artisan serve` retire les variables d'environnement hors liste blanche et relirait `backend/.env`, donc d'éventuelles valeurs réelles.

### CORS

L'aperçu web est une autre origine que l'API. `backend/config/cors.php` ajoute une branche de développement, active uniquement si `APP_ENV=local` ET `CORS_DEV_ORIGINS` est non vide (vide dans `.env.example`) : toutes les routes `api/*`, méthodes GET/POST/PUT/PATCH/DELETE, en-têtes `Authorization`, `X-Device-Id`, `Accept-Language`, `Idempotency-Key`, origines exactes (jamais de joker, jamais d'identifiants). Dans tout autre environnement la configuration reste celle de la production (suppression de compte depuis le site public uniquement) ; `backend/tests/Feature/CorsTest.php` le vérifie (production, staging, test, et local avec liste vide).

## Données (PreviewSeeder)

Refuse de s'exécuter hors `APP_ENV=local`. Il charge d'abord `DemoDataSeeder` (40 membres `demoNN@example.test`, personnel fictif), puis crée :

- le membre actif `apercu@example.test` : e-mail vérifié, profil complet vérifié (Aperçu, Paris), préférences larges, consentements, 3 crédits de conversation ;
- 3 photos approuvées pour lui, 3 pour demo01 à demo06 et 1 pour les autres membres fictifs (la découverte exige une photo approuvée) ;
- 2 affinités (demo01 Aminata, demo02 Karim) et 3 conversations (demo01 et demo02 par affinité, demo03 Léa ouverte avec un crédit), dont des messages non lus ;
- la découverte propose environ 20 profils (taille de page par défaut), les autres suivent par curseur.

Il est idempotent.

## Limites

- **Photos** : aucune vraie photo. Chaque ligne `media` pointe vers une illustration SVG générée (initiale sur fond coloré, écrite dans `%TEMP%\ayelo-preview\media`) servie par le serveur statique local via une URL présignée S3 factice. Le dépôt de photo depuis l'application ne fonctionne pas (pas de stockage objet).
- **Pas de push** : FCM vide, aucun appareil de notification.
- **Pas de temps réel** : pas de serveur Reverb (`BROADCAST_CONNECTION=null`). Ne pas définir `EXPO_PUBLIC_REVERB_*` : l'application se rafraîchit alors périodiquement. Messages entrants, indicateur de saisie et présence ne s'actualisent pas en direct.
- **Pas d'achats** : pas de RevenueCat (les clés SDK publiques restent vides côté Expo), pas de webhook ; l'abonnement Premium et les achats de crédits ne sont pas testables. Le membre d'aperçu n'est pas Premium (écrans de paywall visibles).
- **Pas d'appels** : LiveKit vide.
- Pas de connexion Google ou Apple. E-mails écrits dans le journal (`MAIL_MAILER=log`, `backend/storage/logs/laravel.log`).
- Un seul membre connectable ; les autres ont un mot de passe aléatoire jeté.
- Le serveur PHP intégré traite une requête à la fois : les écrans lents (la première requête après démarrage prend quelques secondes) sont normaux.

## Dépannage

- **Politique d'exécution PowerShell** : lancer avec `-ExecutionPolicy Bypass` comme ci-dessus (réglage du processus seulement). `backend/scripts/php-pgsql.ps1` est soumis à la même politique.
- **PHP bloqué par Smart App Control** : sur ce poste, au 2026-11-12, `tools\php84` ne peut plus charger `pdo_pgsql` ni `pgsql` (événement 3077, « une stratégie de contrôle d'application a bloqué ce fichier ») et `php-pgsql.ps1` échoue ; le PHP 8.5 installé par WinGet les charge et satisfait `composer` (PHP 8.4.1 minimum, ce qui exclut le PHP 8.3 de Laragon). `dev-preview.ps1` le trouve seul. Pour lancer Pest avec lui, définir `PHP_PGSQL_BIN` avec le chemin de ce `php.exe` avant `php-pgsql.ps1`, ou l'appeler directement depuis `backend/` : `php.exe -d memory_limit=1G vendor/bin/pest --filter=Cors` (PostgreSQL 54330 démarré ; seul l'appel direct a été essayé). Ne pas contourner la protection.
- **Port déjà utilisé** : le script réutilise PostgreSQL, l'API ou le serveur de photos déjà présents sur le port et ne les arrête pas.
- **Page blanche ou erreur réseau dans le navigateur** : vérifier que `EXPO_PUBLIC_API_URL` a été défini avant `expo start`, et que l'origine du navigateur est bien `http://localhost:8089` (sinon relancer le script avec `-WebPort`).
