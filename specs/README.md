# Spécifications (Spec Kit)

Cycle imposé par `.specify/memory/constitution.md` : **spec → plan → tâches → implémentation → preuve**. Une spécification par fonctionnalité, dans `specs/NNN-nom/` : `spec.md` (quoi et pourquoi, scénarios d'acceptation), `plan.md` (comment, fichiers, décisions), `tasks.md` (tâches cochées avec preuve).

Les exigences détaillées d'origine restent dans `docs/03-FUNCTIONAL-SPECIFICATIONS.md` (identifiants `FR-*`) ; la traçabilité FR → épopée → test est dans `docs/15b-TRACEABILITY.md`. Les spécifications ci-dessous les regroupent par fonctionnalité livrable.

## Ordre d'exécution et état (2026-11-06)

| # | spécification | phase | état | preuve principale |
| --- | --- | --- | --- | --- |
| 001 | Comptes et authentification | A | **livré (backend)** | `AuthFlowTest`, `AccountFlowTest`, `SanctumUuidTest` |
| 002 | Profils et médias | A | **livré (backend)** | `ProfileMediaTest` |
| 003 | Découverte, swipes, matchs | A | **livré (backend)** | `DiscoverySafetyTest` |
| 004 | Messagerie et temps réel | A | **livré (backend)** | `MessagingTest` |
| 005 | Sécurité et modération | A | **partiel** : API livrée, interface d'administration à faire | `DiscoverySafetyTest` |
| 006 | Compte, vie privée, données | A | **livré (backend)** | `AccountLifecycleTest` |
| 007 | Premium et crédits | B | **livré (serveur)** ; achat mobile à faire | `BillingTest` |
| 008 | Appels audio et vidéo | D | **partiel** : signalisation livrée ; média réel et sonnerie app fermée à prouver (D0) | `CallsTest` |
| 009 | Administration (back-office) | A/B | **à faire** (agent interrompu) | — |
| 010 | Application mobile | A→D | **partiel** : fondations et inscription ; écrans fonctionnels à faire | Jest 141 tests (rapport d'agent) |
| 011 | Préparation du lancement | G3→G7 | **à faire** (dépend du propriétaire en partie) | — |
| 012 | Fonctions reportées (après lancement) | C/E | **reporté** | — |

## Règles de travail

1. On ne code pas une tâche qui n'est pas dans un `tasks.md`.
2. Une tâche est cochée `[x]` seulement avec une **preuve** (nom du test ou de la commande, journal de CI). `[~]` = écrit mais non vérifié. `[ ]` = non fait.
3. Une exigence incertaine reste `[NEEDS CLARIFICATION]` : elle bloque la tâche et remonte au propriétaire.
4. Après chaque lot : suite de tests complète sur PostgreSQL 16, CI verte, mise à jour de `docs/16-STATUS.md`.
5. Les lots touchant sécurité, argent ou données personnelles passent par une relecture indépendante avant d'être déclarés livrés.
6. Un seul agent écrit dans un périmètre à la fois (backend/, mobile/). Voir la constitution, principe VII.

## Dépendances

`001 → 002 → 003 → 004 → 008` ; `005` dépend de `003`, `004` ; `009` dépend de `005`, `002` (médias), `007` ; `010` dépend de toutes les API ; `011` dépend de `009`, `010`, `008` (D0).
