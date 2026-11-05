# Suivi de la seconde relecture (phase 0, passe 2)

Rapport source : `phase0-bis.md` (1 bloquant, 9 majeurs, 15 mineurs). Date : 2026-11-05.
Statuts : **corrigé** (modifié dans les documents, vérifié par recomptage ou par exécution quand c'est dit), **ouvert** (responsable et échéance indiqués).

## Rectification du premier suivi

La seconde relecture a montré que `phase0-suivi.md` déclarait « traité » des points encore contredits dans les documents. Le premier suivi est **corrigé par celui-ci** : les lignes MAJ-02, 03, 12, 14, 15, 19, 25, 30 et MIN-01, 02, 04 sont à lire avec les statuts ci-dessous. MIN-02 était sous-déclaré (il était déjà corrigé).

## Bloquant

| id | statut | détail |
| --- | --- | --- |
| BIS-B01 | **fermé** | SQL exécuté sur **PostgreSQL 16.15 natif** en local (33 tests, 0 échec) **et** en CI GitHub (verte sur `ac22f5c` : schéma + gitleaks + Pest + `composer audit`). Migration Laravel (clés `uuid`, Sanctum `uuidMorphs`) testée : 6 tests Pest, 19 assertions |

## Majeurs

| id | statut | détail |
| --- | --- | --- |
| BIS-M01 | corrigé | séquence unique : S01 → S63 consentements → S68 date de naissance → `POST /auth/age-check` (jeton signé) → S02, qui exige le jeton pour `register` **et** `oauth`. La date est stockée dans `users.birthdate`, non modifiable (déclencheur testé). Mis à jour : 03 FR-I-12, 04 F01 et F17, 05 (S02, S04, S64, S68), 10, 09, SQL. **Test d'API à écrire** (refus puis nouvelle tentative, chemin OAuth) |
| BIS-M02 | corrigé | check supprimé ; suppression d'un média lié à un message testée (OK) |
| BIS-M03 | corrigé | positions 0 à 11, réordonnancement en deux mises à jour, testé ; échange direct refusé, testé |
| BIS-M04 | corrigé | 03 FR-G-1 et FR-G-2, 05 S30 alignés sur 1 / 3 / 12 mois et crédit « Conversation » ; « Propositions » hors lancement |
| BIS-M05 | corrigé | 03 FR-A-6 réécrit selon 08 (Sanctum à expiration glissante, un jeton par appareil). **ADR 006 à écrire** : responsable Architecte, avant A2 |
| BIS-M06 | corrigé | 11 : mineur suspecté = 2 h partout (vérifié par recherche de « 24 h ») |
| BIS-M07 | partiel | `15b-TRACEABILITY.md` générée : 92 exigences (90 à l'origine, +FR-A-12 et FR-I-15), 0 sans épopée. Plages corrigées (A3, A5, A11, A13), dépendances / tailles / preuves ajoutées à A0, A16, A17, B10, chemin critique complété (A15). **Reste** : dépendances fines des autres épopées, à affiner à l'entrée en phase A |
| BIS-M08 | corrigé | statuts mis à jour : 08, ADR (points ouverts réécrits), 06, 14 (staging, test de coût remplacé par un modèle de coût) |
| BIS-M09 | corrigé | `features.csv` et `recon.md` (certification), 02 (limites n°3 et n°4, section « points faibles » renommée, source Google Play) |

## Mineurs

| id | statut | détail |
| --- | --- | --- |
| BIS-m01 | corrigé | `recon.md` : must 20, should 13, could 11 dont 4 skip (comptage par commande) ; doublon d'appel retiré de `features.csv` |
| BIS-m02 | corrigé | MIN-02 passé en traité ; 00 cite 3 000 avis pour l'App Store FR (source : fiche lue) |
| BIS-m03 | corrigé | 03 : trois taps |
| BIS-m04 | corrigé | 02 : prix FR et US distingués |
| BIS-m05 | corrigé | 13 : G6 = stores + appels |
| BIS-m06 | corrigé | DEC « Conséquences » réécrit |
| BIS-m07 | partiel | ligne `POST /me/consents` corrigée, limite d'inscription unifiée, `upload-url` en PUT, critère de limite de connexion unique ; l'outillage OpenAPI reste à choisir (ADR) |
| BIS-m08 | corrigé | 14 : service `transcode` séparé et sans réseau |
| BIS-m09 | corrigé | `POST /calls` : 403 si la conversation n'est pas issue d'un match ; `busy` ajouté ; FR-C-7 fusionné dans FR-C-9 ; FR-C-8 en phase E ; `hidden_by_*` ; origine C pour FR-F-1 et FR-G-3 |
| BIS-m10 | corrigé | 04 : S18, S34, S55, S57 ajoutés aux parcours ; S58 accessible depuis S21 ; S55 réécrit |
| BIS-m11 | corrigé | 08 : « authentifiés par secret » et présence calculée côté serveur ; 12 : message avant match précisé |
| BIS-m12 | corrigé | `truncate` bloqué (testé) ; selfie purgé par `status='purged'` ; un seul mécanisme de réinitialisation du mot de passe |
| BIS-m13 | corrigé | 11 index de clés étrangères ajoutés ; `super_likes` ajouté. Un `check` « au moins un identifiant de connexion » n'est pas ajouté : l'identité sociale est dans une autre table, contrôle applicatif |
| BIS-m14 | corrigé | page web de suppression ajoutée à 14 (liste G6) et à l'épopée A16. À vérifier sur les règles Google en vigueur |
| BIS-m15 | corrigé | 14 : pistes Google Play avec test fermé |

## Chiffres recomptés par commande après corrections

| objet | résultat |
| --- | --- |
| Écrans (05) | 50 : A 30, B 9, C 6, D 4, E 1 |
| Routes (10) | 73 lignes de tableau + GET/PUT compté 2 + webhook + `/broadcasting/auth` = 76 ; **77** après ajout de `POST /account-deletion-requests` |
| Tables (SQL) | 36 |
| Tests SQL | 33, 0 échec (PostgreSQL 16.15) |
| Exigences (03) | 90, toutes rattachées à une épopée |
| `features.csv` | must 20, should 13, could 11 dont 4 skip |

## Clôture de G1

Troisième relecture : `phase0-ter.md` (0 bloquant, 3 majeurs, 11 mineurs). Les trois conditions posées sont remplies :

1. CI GitHub exécutée et verte (commit `ac22f5c`).
2. Migration Laravel avec clés `uuid` et Sanctum `uuidMorphs` testée.
3. Troisième passe de relecture faite.

Les trois majeurs de la troisième passe sont traités le 2026-11-05 :

| id | traitement |
| --- | --- |
| R3-M01 | passe de statuts : 00, 09, 15, ADR et ce suivi |
| R3-M02 | parcours F00 « Connexion » ajouté (04) ; S02 accessible depuis S01 en mode connexion sans S63 ni S68 (05) ; `oauth` n'exige `age_token` que pour un nouveau compte (10) ; FR-A-12 (03) |
| R3-M03 | le fichier Docker Compose ne monte plus le SQL : `php artisan migrate` fait foi (`infra/docker-compose.dev.yml`) |

Mineurs traités avec : R3-m04 (workflow backend : `.env` et clé d'application avant Pest) et R3-m10 (FR-I-15 et route `POST /account-deletion-requests`).

**G1 définitif : franchi** (décision du CTO, 2026-11-05). Réserves : le Docker Compose n'est pas testé (Docker absent du poste) ; les avertissements Pest de la CI sont à confirmer disparus ; matrice juridique, comptes développeur et modération humaine restent ouverts (hors G1).
