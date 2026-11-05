# Projet de rencontres (nom de travail : Ayelo)

Application mobile de rencontres (Android et iOS), conception indépendante inspirée des fonctionnalités publiques de Chat&Yamo. Aucun code, ressource ou marque de l'original n'est repris.

- Documentation : [`docs/`](docs/) (commencer par `00-EXECUTIVE-SUMMARY.md`)
- Décisions du propriétaire : [`docs/DECISIONS-PROPRIETAIRE.md`](docs/DECISIONS-PROPRIETAIRE.md)
- Schéma de base de données : [`docs/schema/001_initial.sql`](docs/schema/001_initial.sql)
- Relectures indépendantes : [`docs/reviews/`](docs/reviews/)

## Tester le schéma sur PostgreSQL 16

Local (télécharge des binaires PostgreSQL 16 via npm, aucun Docker requis) :

```
cd tests/schema
npm install
npm run test:local
```

Contre un PostgreSQL existant :

```
DATABASE_URL=postgres://user:pass@host:5432/postgres node tests/schema/schema.test.mjs
```

La CI (`.github/workflows/schema.yml`) exécute les mêmes tests sur `postgres:16`.

## Dossiers

| dossier | contenu |
| --- | --- |
| `docs/` | spécifications, architecture, décisions |
| `replica/` | recon de l'application étudiée, matrice de fonctions |
| `tests/schema/` | tests du schéma SQL |
| `backend/` | Laravel 12 (à créer, phase A2) |
| `mobile/` | Expo (à créer, phase A5) |
| `infra/` | Docker Compose, déploiement |

Statut : phase A1 (fondations). Aucun code d'application encore.
