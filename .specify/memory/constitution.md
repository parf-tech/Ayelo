# Constitution du projet Ayelo

Application de rencontres (nom de travail « Ayelo ») pour Android et iOS, conception indépendante inspirée des fonctionnalités **publiques** de Chat&Yamo. Cette constitution s'impose à toute spécification, tout plan, toute tâche et tout agent.

## Principes

### I. Réplique propre (clean-room), sans emprunt
Seules les fonctionnalités et les parcours observables par des sources publiques sont reprises. Aucun code, ressource protégée, texte, visuel, marque, donnée privée ni API privée de l'original n'est copié, lu, intercepté ou deviné. Toute fonction supposée est marquée **hypothèse** ; seules les fonctions prouvées par une source lue sont marquées **confirmé** (`docs/02-REA-REPORT.md`). Le nom « Chat&Yamo » n'est jamais utilisé.

### II. Aucune affirmation sans preuve (NON NÉGOCIABLE)
Rien n'est « terminé » sans une preuve vérifiable : sortie d'un test exécuté, journal de CI, capture, rapport de relecture. Ce qui est écrit mais jamais exécuté est déclaré comme tel (`docs/16-STATUS.md`). Un résultat d'agent n'est une preuve que si la commande a été rejouée ou si le journal est cité.

### III. Le schéma SQL est la source de vérité
`docs/schema/001_initial.sql` fait foi. Il est testé sur PostgreSQL 16 natif (`tests/schema`) avant toute migration. Un changement de schéma passe par ce fichier, ses tests et une mise à jour de `docs/09-DATABASE-SCHEMA.md`, jamais par une modification isolée d'un module.

### IV. Spécification d'abord
Tout travail nouveau suit le cycle Spec Kit : spécification (`specs/NNN-*/spec.md`) → plan → tâches → implémentation → vérification. Une tâche cite ses fichiers, son exigence (`FR-*`, `docs/03`) et sa preuve. Les exigences non confirmées sont marquées `[NEEDS CLARIFICATION]` ou « hypothèse » et ne sont pas implémentées avant décision du propriétaire.

### V. Sécurité et vie privée dès la conception
Âge minimal 18 ans contrôlé **avant** la création du compte ; données sensibles (orientation, origine, biométrie) traitées avec consentement explicite et distinct ; aucun média public avant approbation ; sécurité jamais payante (blocage, signalement) ; 404 identique pour « inexistant », « masqué », « bloqué » ; secrets uniquement dans l'environnement ; journal d'audit append-only. Voir `docs/11-SECURITY-REQUIREMENTS.md`.

### V bis. Les décisions juridiques ne sont pas prises par les agents
Matrice par marché, durées de conservation, signalement aux autorités, CGU et politique de confidentialité sont validés par un juriste. Les agents rédigent des brouillons étiquetés comme tels.

### VI. Tests avant livraison, sur le vrai moteur
Backend : Pest sur **PostgreSQL 16** (jamais SQLite). Mobile : Jest, vérification de types, lint, bundle. La CI GitHub doit être verte avant de déclarer un lot terminé. Les services externes (R2, FCM, RevenueCat, LiveKit, Google/Apple) sont isolés derrière des interfaces testées avec des doubles ; leur validation réelle est une tâche distincte, explicite.

### VII. Périmètres séparés, un propriétaire par fichier
Un agent = un périmètre (backend/, mobile/, docs/, infra/). Pas de modification concurrente du même fichier. Les routes sont découpées par module (`routes/api/<module>.php`). Les décisions structurantes sont consignées en ADR (`docs/adr/`).

### VIII. Simplicité et coût maîtrisé
Un monolithe modulaire, une base, pas de microservices. Tout poste de coût est sourcé et daté (`docs/14b-COSTS.md`). Budget de référence : 30 à 80 € par mois ; tout dépassement est signalé au propriétaire avant décision.

### IX. Honnêteté sur les limites
Les rapports distinguent « vérifié », « écrit non exécuté » et « non fait ». Les écarts, échecs et fausses alertes sont documentés, pas masqués.

## Contraintes techniques
Mobile : Expo / React Native / TypeScript strict, français et anglais dès la V1. Backend : Laravel 12, PostgreSQL 16, Reverb, Sanctum, Pest. Administration : Filament avec 2FA obligatoire. Paiements : achats intégrés des stores via RevenueCat. Appels : LiveKit, réservés aux matchs.

## Processus et gates
Gates G0 à G7 (`docs/13-TEST-STRATEGY.md`). Un lot passe de « brouillon » à « livré » seulement avec : spécification acceptée, tâches cochées avec preuve, tests verts, CI verte, relecture indépendante pour les lots touchant sécurité, argent ou données personnelles.

## Gouvernance
Cette constitution prime sur les habitudes de travail. Toute dérogation est écrite, motivée et approuvée par le propriétaire. Modifications : version incrémentée, date, motif.

**Version** : 1.0.0 | **Ratifiée** : 2026-11-06 | **Dernière modification** : 2026-11-06
