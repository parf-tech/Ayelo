# Suivi des constats de la relecture indépendante (phase 0)

> **Corrigé par `phase0-bis-suivi.md`** : la seconde relecture a montré que plusieurs lignes « traité » ci-dessous étaient inexactes (MAJ-02, 03, 12, 14, 15, 19, 25, 30 ; MIN-01, 02, 04). Se référer au second suivi.

Rapport source : `phase0.md` (55 points : 4 bloquants, 31 majeurs, 20 mineurs). Date du suivi : 2026-11-05.
Statuts : **traité** (corrigé dans les documents), **partiel**, **ouvert** (responsable et jalon indiqués), **accepté** (décision explicite de ne pas traiter).
« Traité » veut dire corrigé dans les documents. Le SQL a été exécuté (PGlite, 24 tests). Rien d'autre n'a été exécuté : aucun code d'application n'existe.

## Bloquants

| id | statut | où | preuve |
| --- | --- | --- | --- |
| BLQ-01 | traité | 00, 15, ADR, 14, 03, DEC | phases réordonnées (A, B, D puis lancement ; C et E après), G6 = stores + appels, D0 en parallèle |
| BLQ-02 | traité | `schema/001_initial.sql`, 09, 14 | PostGIS retiré de la migration initiale ; SQL exécuté : 36 tables créées |
| BLQ-03 | traité | 08, 09, 10 | 08 dérivé du schéma ; `notification_prefs` ajoutée ; noms alignés |
| BLQ-04 | traité | 11, 09, 10 | affirmation corrigée (article 9 RGPD), `user_consents` ajoutée, `POST /me/consents`. Validation juridique : ouverte |

## Majeurs

| id | statut | note |
| --- | --- | --- |
| MAJ-01 | traité | 00 réécrit (niveaux C / T / non établi) ; 03 complété |
| MAJ-02 | traité | certification : 01 et features.csv corrigés ; la section « points faibles » de 02 reste **issue d'une seule fiche App Store FR** (3 avis cités) : à renforcer avec une étude d'avis datée |
| MAJ-03 | traité | statuts mis à jour (00, 08, 15, ADR, features.csv) ; 06 : langues décidées |
| MAJ-04 | traité | FR-Z-1..3, `users.locale`, épopée A0 |
| MAJ-05 | ouvert | matrice juridique par marché : tâche P0-9, **juriste requis** avant G3 ; ordre de lancement proposé (vagues 1 à 3) |
| MAJ-06 | partiel | tableau de coûts sourcé et daté produit (`14b-COSTS.md`, 2026-11-05) : scénario bas ≈ 34 $/mois, haut ≈ 417 $/mois ; reste à chiffrer le domaine, la modération, Google Play et les SMS en Afrique ; validation du propriétaire en attente |
| MAJ-07 | traité | 08 réécrit (PushKit + CallKit, ConnectionService), critères go/no-go de D0 dans 15 |
| MAJ-08 | traité | FR-B-9, FR-E-9, 08 (qualités 240 à 480p, mode économie de données) ; cible de test Android d'entrée de gamme à ajouter à 13 |
| MAJ-09 | traité | proximité (FR-C-8) déplacée en phase E |
| MAJ-10 | traité | verrou consultatif décrit dans 09 ; **test d'intégration à écrire** (exactement un match) |
| MAJ-11 | traité | `restrict`, `banned_identifiers`, état de conversation, `hidden_by_*` ; durées de conservation légales : **ouvert** (juriste) ; sauvegardes : 14 |
| MAJ-12 | traité | ré-authentification par fournisseur, révocation Apple / TikTok, page web de suppression (11, 10, 03) |
| MAJ-13 | traité | FR-I-10, FR-I-11, `appeals`, routes ; accès au signalement depuis S21 (04) |
| MAJ-14 | traité | `POST /auth/age-check` avant compte, refus mémorisé par hash |
| MAJ-15 | partiel | délais alignés (11) ; budget et astreinte de modération humaine : **ouvert** (B10) |
| MAJ-16 | traité | purge du selfie (`purge_after`), consentement biométrique, pas de comparaison automatisée sans AIPD |
| MAJ-17 | traité | tableau de limites de débit par zone et par compte / appareil dans 10 ; attestation d'appareil |
| MAJ-18 | traité | présence calculée côté serveur, `POST /broadcasting/auth` |
| MAJ-19 | traité | Sanctum à expiration glissante, `devices.token_id`, `DELETE /auth/sessions` ; ADR 006 reste à écrire |
| MAJ-20 | traité | `uuidMorphs`, test de migration en CI (09) |
| MAJ-21 | traité | `staff_users` séparée, 2FA, matrice des droits (11) |
| MAJ-22 | traité | `store='promotional'`, `original_transaction_id` nullable, `app_user_id = users.id` ; transferts RevenueCat : à lire dans leur documentation |
| MAJ-23 | partiel | « Propositions » et avantages Premium : retirés du lancement tant que non spécifiés (12) ; clés d'idempotence par utilisateur : traité |
| MAJ-24 | partiel | 12 corrigé (en-tête secret, événements « à lire dans la documentation officielle ») ; événements `billing.updated` et `message.delivered` ajoutés à 10 ; **vérification RevenueCat : ouverte** |
| MAJ-25 | traité | PUT présignés, cycle de vie R2, quotas, ffmpeg isolé (08) ; comportement de R2 à vérifier |
| MAJ-26 | ouvert | capacité de Reverb à mesurer avec k6 avant de promettre un chiffre ; ffmpeg et staging séparés du VPS de production (14) |
| MAJ-27 | traité | Docker contourne `ufw` : réseau interne, `DOCKER-USER`, scan externe (11) |
| MAJ-28 | partiel | prérequis stores ajoutés à 14 (test fermé Google, texte d'abonnement Apple, DSA) ; **à vérifier sur les règles officielles** ; entité juridique : ouverte |
| MAJ-29 | partiel | dépendances de 15 corrigées pour D et G6 ; matrice FR → épopée → test : **à produire** (13) |
| MAJ-30 | traité | écrans S61 à S67, parcours F15 à F20, routes d'export |
| MAJ-31 | traité | tables ajoutées (consentements, notification_prefs, banned_identifiers, support_tickets, data_exports, appeals, daily_counters) |

## Mineurs

| id | statut | note |
| --- | --- | --- |
| MIN-01 | traité | 12 : Premium 1 / 3 / 12 mois, source FR citée |
| MIN-02 | ouvert | « Inde, Caraïbes » dans 00 : à retirer ou sourcer (non fait) |
| MIN-03 | ouvert | `recon.md` : « entités 12 » à corriger |
| MIN-04 | traité | cible unique : 3 taps |
| MIN-05 | traité | `pgcrypto` retiré, `text` + `check`, colonne `password` ; UUID ordonnés côté application |
| MIN-06 | traité | `unique (conversation_id, sender_id, client_id)` et `check` de cohérence ; testé |
| MIN-07 | traité | index unique partiel des positions de photos (testé) ; upsert du jeton push documenté |
| MIN-08 | traité | déclencheur append-only (testé) ; rôle de migration distinct à configurer ; journalisation de la lecture de conversations ajoutée à 11 |
| MIN-09 | traité | déclencheur qui interdit la modification de `birthdate` (testé) |
| MIN-10 | traité | règle d'écriture entre modules précisée (08) |
| MIN-11 | ouvert | propriétaires des fichiers `docs/00`, `01`, `03`, `12` à compléter dans 15 |
| MIN-12 | partiel | `DELETE /blocks/{id}` : préciser l'id ; réponses identiques à l'inscription : à décider ; OpenAPI : outillage à choisir |
| MIN-13 | traité | distance par tranches, plafond de requêtes, chiffrement (11) |
| MIN-14 | ouvert | tests E2E iOS en local sur le Mac ; build EAS sur étiquette : à écrire dans 13 |
| MIN-15 | partiel | RPO et supervision externe notés dans 14 ; décision finale : ouverte |
| MIN-16 | ouvert | calendrier par scénario : à produire quand le périmètre de lancement est figé |
| MIN-17 | ouvert | couleur `like` : contraste à mesurer avec l'outil (07) |
| MIN-18 | ouvert | marquer toutes les cibles de 12 comme hypothèses |
| MIN-19 | ouvert | revenu par marché dans le modèle de coût (B10) |
| MIN-20 | ouvert | bannière de conseils de rencontre dans S14 et S25 |

## Décompte

| statut | nombre |
| --- | --- |
| Bloquants traités | 4 sur 4 |
| Majeurs traités | 23 |
| Majeurs partiels | 5 (MAJ-15, 23, 24, 28, 29) |
| Majeurs ouverts | 3 (MAJ-05, 06, 26) |
| Mineurs traités | 9 |
| Mineurs partiels | 2 (MIN-12, 15) |
| Mineurs ouverts | 9 |

Ce décompte est fait à la main à partir des tableaux ci-dessus ; la seconde relecture le vérifie.

## Pour franchir G1

1. Seconde relecture indépendante sans point bloquant (`phase0-bis.md`).
2. SQL exécuté sur PostgreSQL 16 natif en CI (fait seulement sur PGlite).
3. Acceptation écrite des majeurs ouverts ou partiels qui touchent la conception, avec responsable et échéance (MAJ-05, 06, 15, 26).
