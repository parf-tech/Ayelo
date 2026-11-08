# Ayelo : application de rencontres

Application mobile de rencontres (Android et iOS), conception indépendante inspirée des fonctionnalités publiques de Chat&Yamo. Aucun code, ressource ou marque de l'original n'est repris. Le nom « Ayelo » est conservé par le propriétaire (décision du 2026-11-08) ; la recherche d'antériorité reste à faire (voir `docs/DECISIONS-PROPRIETAIRE.md`).

**Statut** : bêta fermée envisageable après les bloquants listés dans `docs/reviews/cto-1.md` (§9) ; pas de lancement public. Mesures et état réel : [`docs/16-STATUS.md`](docs/16-STATUS.md). Ce qu'il reste à faire : [`docs/reviews/restant.md`](docs/reviews/restant.md).

## Dossiers

| dossier | contenu |
| --- | --- |
| `backend/` | API Laravel 12 (PostgreSQL, Sanctum, Reverb, Filament 4 pour le back-office), tests Pest |
| `mobile/` | application Expo / React Native (TypeScript), tests Jest |
| `web/` | site public statique (conditions, confidentialité, suppression de compte) |
| `infra/` | Docker Compose de production, Caddy, sauvegardes, PHP-FPM |
| `tests/schema/` | tests du schéma SQL sur PostgreSQL 16 |
| `docs/` | spécifications, architecture, décisions, revues de sécurité, procédures (`runbooks/`) |
| `replica/`, `specs/` | recon de l'application étudiée, spécifications de fonctionnalités |

## Documentation à lire en premier

- Vue d'ensemble : [`docs/00-EXECUTIVE-SUMMARY.md`](docs/00-EXECUTIVE-SUMMARY.md)
- Architecture : [`docs/08-SOFTWARE-ARCHITECTURE.md`](docs/08-SOFTWARE-ARCHITECTURE.md)
- Décisions du propriétaire : [`docs/DECISIONS-PROPRIETAIRE.md`](docs/DECISIONS-PROPRIETAIRE.md)
- Contrat d'API : [`docs/openapi.json`](docs/openapi.json) (généré, ne pas modifier à la main)
- Revues indépendantes (sécurité, CTO, design) : [`docs/reviews/`](docs/reviews/)
- Procédures d'exploitation : [`docs/runbooks/`](docs/runbooks/)

## Lancer les vérifications

Schéma SQL (télécharge PostgreSQL 16 via npm, aucun Docker requis) :

```
cd tests/schema
npm install
npm run test:local
```

Backend (PostgreSQL 16 sur le port 54330, base `app_test`, lancé par `node tests/schema/pg16-dev.mjs`). Sous Windows, le `php` du PATH n'a pas toujours le pilote PostgreSQL : utiliser le script, voir [`docs/runbooks/tests-locaux.md`](docs/runbooks/tests-locaux.md) :

```
cd backend
composer install
.\scripts\php-pgsql.ps1 vendor/bin/pest      # Windows
vendor/bin/pest                              # Linux, macOS, CI
```

Mobile :

```
cd mobile
npm install
npm run typecheck
npm run lint
npx jest
```

Contrat d'API : après tout changement de contrat côté backend, `php artisan scramble:export --path=../docs/openapi.json` (avec une base PostgreSQL migrée), puis `npm run api:types` dans `mobile/`.

## Secrets

Aucun secret n'est versionné. Les valeurs réelles vivent dans `backend/.env` (local) et `infra/.env.prod` (serveur), tous deux ignorés par Git ; les modèles sont `backend/.env.example` et `infra/.env.prod.example`. Les clés de comptes de service (FCM) restent hors du dépôt. `gitleaks` tourne en CI sur tout l'historique.

La CI (`.github/workflows/`) exécute le schéma SQL, le backend (Pest, audit Composer, contrat OpenAPI), le mobile et des contrôles d'infrastructure.
