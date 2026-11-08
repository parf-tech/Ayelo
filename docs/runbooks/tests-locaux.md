# Lancer les tests du backend sous Windows

Dernière mise à jour : 2026-11-08.

## Le problème

Le `php` du PATH est celui de Herd (`C:\Users\pc\.config\herd-lite\bin\php.exe`). C'est un build statique sans les pilotes PostgreSQL : `pdo_pgsql` et `pgsql` manquent. Pest, `artisan migrate` et `scramble:export` échouent alors avec « could not find driver ». Les 128 Mo de mémoire par défaut ne suffisent pas non plus à la suite complète (arrêt fatal dans `aws-sdk-php`).

## La solution

Le script `backend/scripts/php-pgsql.ps1` choisit un PHP qui charge `pdo_pgsql`, dans cet ordre : la variable `PHP_PGSQL_BIN`, puis `C:\Users\<vous>\tools\php84\php.exe`, puis le `php` du PATH s'il a le pilote. Il fixe `memory_limit=1G` et `OPENSSL_CONF` vers la configuration de Git for Windows (nécessaire aux tests RSA). Il ne modifie ni le PATH ni un `php.ini`.

Depuis `backend/`, avec PostgreSQL 16 lancé sur le port 54330 (`node tests/schema/pg16-dev.mjs` à la racine du dépôt, ou `npm run test:local` dans `tests/schema`) :

```powershell
.\scripts\php-pgsql.ps1 vendor/bin/pest                        # suite complète (environ 5 minutes)
.\scripts\php-pgsql.ps1 vendor/bin/pest --filter=HealthCheck   # un test
.\scripts\php-pgsql.ps1 artisan migrate --force
.\scripts\php-pgsql.ps1 -m                                     # modules : vérifier pdo_pgsql
```

Autre port de base de test : définir `DB_PORT` avant la commande (`$env:DB_PORT='54331'`). `phpunit.xml` fixe 54330 par défaut.

## Dans VS Code

Un réglage local, non commité (`.vscode/settings.json`, exclu par `.git/info/exclude`), met `C:\Users\pc\tools\php84` en tête du PATH des terminaux de VS Code. Après l'avoir ajouté, ouvrir un nouveau terminal : `php -m` doit lister `pdo_pgsql`. Il n'a aucun effet en dehors de ce dossier de travail.

## Si le PHP téléchargé est bloqué par Windows

Smart App Control peut refuser les DLL non signées d'un PHP téléchargé (événement 3077 dans `Microsoft-Windows-CodeIntegrity/Operational`, code de sortie `0xC0E90002`). Ne pas contourner la protection : utiliser un PHP déjà accepté sur la machine (c'est le cas de `tools\php84`) ou lancer les tests en CI (`.github/workflows/backend.yml`).

## Option : changer le PATH de l'utilisateur

Mettre `C:\Users\<vous>\tools\php84` avant Herd dans le PATH utilisateur résout le problème partout, mais change aussi le `php` utilisé par les sites servis par Herd. À décider par le propriétaire du poste ; rien ici ne le fait.
