# Revue indépendante, troisième passe (limitée) : phase 0, gate G1

Relecteur : Independent Reviewer (troisième passe, limitée). Je n'ai écrit aucun des documents relus. Date : 2026-11-05.
Entrées : `reviews/phase0-bis.md`, `reviews/phase0-bis-suivi.md`, `docs/00` à `15b`, `14b-COSTS.md`, `DECISIONS-PROPRIETAIRE.md` (DEC), `adr/001`, `schema/001_initial.sql`, `replica/features.csv`, `replica/recon.md`, `backend/`, `tests/schema/`, `.github/workflows/`, `infra/`.
Aucun fichier existant n'a été modifié. Deux processus ont été lancés puis arrêtés : `npm run test:local` (PostgreSQL 16.15 embarqué temporaire) et un script de contrôle des clés étrangères dans le dossier scratchpad de la session (hors dépôt). `git status` : propre avant et après.
Abréviations : numéros 00 à 15 = `docs/NN-*.md`.

**Fait nouveau par rapport au suivi** : un dépôt distant existe maintenant (`origin` = dépôt GitHub privé `kodafelice22/ayelo-dating-app`, 4 commits) et la CI a tourné. Le suivi et plusieurs documents disent encore le contraire (voir R3-M01).

## Synthèse

| gravité | nombre |
| --- | --- |
| Bloquant | 0 |
| Majeur | 3 |
| Mineur | 11 |
| Total | 14 |

Résumé : les corrections annoncées « corrigé » du suivi sont réellement présentes dans les fichiers (15 lignes sur 25 sans écart, 6 avec un écart secondaire, 4 partielles dont 2 déjà déclarées « partiel » par le suivi). BIS-B01 est fermé pour de bon : SQL exécuté sur PostgreSQL 16.15 en local (reproduit : 33 tests, 0 échec) et en CI GitHub (run vert). Restent des preuves périmées dans les documents, une lacune de spécification introduite par la correction de l'âge (pas de parcours de connexion), un conflit entre Docker Compose et la migration Laravel, et des écarts mineurs.

## 1. Vérification des lignes de `phase0-bis-suivi.md`

Légende : **OK** = présent et cohérent ; **OK avec écart** = présent, écart secondaire (renvoi vers un constat) ; **PARTIEL** = incomplet ; **FAUX** = annoncé mais absent.

| id | verdict | preuve (fichier + passage) |
| --- | --- | --- |
| BIS-B01 | OK (mieux que dit) | Reproduit : `npm run test:local` affiche 36 tables, `tests: 33, échecs: 0` sur PostgreSQL 16.15. CI : runs GitHub `42116448827` (schema : job `postgres16` vert, `moteur: PostgreSQL 16.15 (Debian…)`, `tests: 33, échecs: 0`; job `secrets` : « 3 commits scanned, no leaks found ») et `42116448835` (backend : `composer audit` « No security vulnerability advisories found », Pest « 6 warnings (19 assertions) », voir R3-m04). Le suivi dit « n'a pas encore été exécuté » : périmé (R3-M01). |
| BIS-M01 | OK avec écart | 03 FR-I-12 (« `register` **et** `oauth` exigent ce jeton… `users.birthdate`, non modifiable ») ; 04 F01 (`S01 -> S63 -> S68 -> S02 …`) et F17 ; 05 S02 « accès S68 », S04 sans naissance, S64, S68 ; 10 `POST /auth/age-check` (« `age_token` signé (10 min, contient la date) ou 403 »), `register` et `oauth` avec `age_token` ; SQL `users.birthdate not null check (…18 years)` + déclencheur `users_lock_birthdate` (testé). Écarts : aucun parcours de connexion pour un compte existant (R3-M02) ; test d'API non écrit (reconnu) ; détails de l'`age_refusal` (R3-m05). |
| BIS-M02 | OK | SQL : `messages.media_id … on delete set null`, le `check` bloquant est supprimé ; test `suppression d'un média lié à un message (set null)` vert (local et CI). Effet de bord : R3-m06. |
| BIS-M03 | OK | SQL l.167 `position between 0 and 11`, l.176 index unique ; 09 l.95 « réordonne en deux mises à jour… échange direct refusé » ; tests `échange direct… refusé` et `réordonnancement en deux mises à jour` verts. Effet de bord : R3-m06. |
| BIS-M04 | OK avec écart | 03 l.95 FR-G-1 « 1, 3 et 12 mois », l.96 FR-G-2 « crédits Conversation… Propositions hors lancement » ; 05 S30 « plans 1/3/12 mois ». Reste `features.csv` « Premium (1 / 6 / 12 mois) » (R3-m02). |
| BIS-M05 | OK avec écart | 03 l.20 FR-A-6 « jeton Sanctum à expiration glissante (30 jours…), un jeton par appareil… » ; 08 l.111 « décision en attente d'ADR 006 », l.124 ADR 006 « à écrire » (reconnu). `backend/config/sanctum.php` : `'expiration' => null` (non implémenté, normal à ce stade). |
| BIS-M06 | OK | 11 l.47 « revue sous 2 h », l.56 et l.87 « 24 h standard, 2 h mineur suspecté » ; plus de « 24 h » pour le mineur. |
| BIS-M07 | PARTIEL (honnête) | `15b-TRACEABILITY.md` : 90 lignes, 90 identifiants uniques, identiques à 03 (`diff` vide). Mais voir R3-m03 : deux exigences rattachées à une épopée de l'autre phase, une épopée « B » inexistante, doublon FR-C-8, script générateur absent du dépôt. |
| BIS-M08 | OK avec écart | 08 l.3 « statut : accepté » ; ADR l.3 « accepté », l.55 « Points ouverts (mis à jour…) » ; 06 l.74 « ~~Langues~~ : décidé » ; 14 l.10 « staging… pas sur le VPS de production », l.34-36 « modèle de coût… pas d'un test sur trafic réel ». Écarts : ADR « Encore ouverts n°2 : tableau de coûts à produire (P0-8) » alors que `14b-COSTS.md` existe ; ADR et 14 « 4 vCPU » (R3-m08). |
| BIS-M09 | PARTIEL | OK : `features.csv` l.36 « le principe est documenté (photos ou vidéo + revue humaine) », 02 l.84, l.113, l.114. **Absent** : `recon.md` l.164 « Le programme de "profils certifiés" : le processus de certification n'est pas documenté publiquement » (suivi : « `features.csv` et `recon.md` (certification) » corrigés). Voir R3-m01. |
| BIS-m01 | OK | `recon.md` l.159 « must 20, should 13, could 11 dont 4 skip » ; recompté (section 2) ; un seul « Appels voix et vidéo depuis le chat » dans `features.csv`. |
| BIS-m02 | OK avec écart | MIN-02 « traité » (suivi) ; 00 l.9 « 4,0 sur l'App Store FR (≈3 000 avis) ». Ce chiffre n'existe que dans 00 : 02 ne contient aucune note ni nombre d'avis App Store FR (02 l.19 ne donne que l'iOS 4,2 / 1,1 k). Source non traçable (R3-m01). |
| BIS-m03 | OK | 03 l.8 « signalé en trois taps », l.179 « 3 ». |
| BIS-m04 | OK | 02 l.114 « prix en euros… fiche App Store FR ; dollars… fiche US ». |
| BIS-m05 | OK | 13 l.85 « G6 : Stores + appels… parcours E2E 9 (appel…) vert, prototype D0 en go ». |
| BIS-m06 | OK | DEC « Conséquences » : « phases A, B et D… D0 dès la fin de A14… C après le lancement ». |
| BIS-m07 | PARTIEL (honnête) | 10 l.49 `POST /me/consents` (colonnes justes), l.21 « 5/h par appareil, 20/h par IP », l.35 idem, l.62 « méthode PUT… en-têtes requis », l.22 « (email, appareil) » repris par 03 FR-A-9 et 11 n°4. OpenAPI : outil non choisi (reconnu). |
| BIS-m08 | OK | 14 l.24 service `transcode` « sans accès réseau », l.111. |
| BIS-m09 | OK avec écart | 10 l.106 `POST /calls` « 403 si la conversation n'est pas issue d'un match » ; SQL l.279 `busy` (test vert) ; 03 l.48 « FR-C-7 (fusionné dans FR-C-9) » ; 03 l.136 `hidden_by_*`. Écart : FR-C-8 figure toujours deux fois (03 l.49 et l.174, R3-m03). |
| BIS-m10 | OK | Tous les S01 à S68 de 05 apparaissent dans 04 (boucle par commande, aucun manquant) ; 05 l.48 S58 accès « S11 / S14 / S17 / S21 » ; 05 l.45 S55 réécrit. |
| BIS-m11 | OK | 08 l.71 « webhooks (authentifiés par secret) », l.85 « Pas de canal de présence global » ; 12 l.17 « message avant match sans crédit (FR-D-11 : sans Premium, il consomme un crédit… » |
| BIS-m12 | OK | SQL l.162 `status … 'purged'`, l.545 `audit_logs_no_truncate` (test `audit : truncate refusé` vert) ; 09 l.101-102 un seul mécanisme de réinitialisation (`verification_codes.password_reset`). |
| BIS-m13 | OK | Contrôle par requête sur `pg_constraint` / `pg_index` (PostgreSQL 16.15) : il reste 8 clés étrangères sans index, toutes vers `staff_users` (`media.moderated_by`, `verification_requests.reviewed_by`, `subscriptions.granted_by`, `credit_ledger.created_by`, `reports.reviewed_by`, `sanctions.created_by`, `appeals.reviewed_by`, `support_tickets.assigned_to`), contre 19 avant : 11 index ajoutés, comme annoncé. SQL l.225 `super_likes`. |
| BIS-m14 | PARTIEL | 14 l.94 « page web de demande de suppression » ; 15 A16 l.96 « page web de suppression ». Aucune FR dans 03, aucun écran dans 05, aucune route dans 10 (R3-m10). |
| BIS-m15 | OK | 14 l.95 « test interne puis test fermé… ». |

Bilan : 25 lignes vérifiées (1 bloquant, 9 majeurs, 15 mineurs) ; aucune correction annoncée « corrigé » n'est complètement absente ; 2 sont fausses en partie (BIS-M09 `recon.md`, BIS-m14) ; BIS-M07 et BIS-m07 sont déjà « partiel » dans le suivi, honnêtement.

## 2. Recomptes par commande

| objet | commande | résultat | annoncé | verdict |
| --- | --- | --- | --- | --- |
| Écrans 05 | `grep -c '^| S[0-9]' 05` ; décompte par dernière colonne | **50** ; A 30, B 9, C 6, D 4, E 1 ; aucun doublon d'identifiant | 05 « Totaux » : 50 (A 30, B 9, C 6, D 4, E 1) ; suivi : 50 | exact |
| Routes 10 | `grep -cE '^\| (GET\|POST\|PUT\|PATCH\|DELETE)'` | 73 lignes ; `GET/PUT /me/notifications` vaut 2 → 74 ; + `POST /webhooks/revenuecat` + `POST /broadcasting/auth` = **76** ; aucun doublon méthode + chemin | 10 l.165 : 76 (74 listées) ; suivi : 76 | exact |
| Tables SQL | `grep -c '^create table'` | **36** ; 36 noms présents dans 09 ; 36 présents dans 08 (mot entier) ; 33 couples `table.colonne` cités en backticks dans 03 à 15 existent tous dans le SQL | 00, 08, 09, suivi : 36 | exact |
| Tests SQL | exécution locale PostgreSQL 16.15 et log CI | **33**, 0 échec (local et CI) | 00 l.33, 00 l.60, 09 l.11, suivi BIS-B01 : 33 ; **suivi tableau « Chiffres recomptés » : 31** | 31 est périmé (R3-M01) |
| Tests Pest | log CI | 6 tests, 19 assertions, tous en « warning » (R3-m04) | 09 l.12 : « 6 tests, 19 assertions, 0 échec » ; suivi : « 6 tests Pest, 0 échec » | chiffres exacts ; non reproductible sur ce poste (PHP sans `pdo_pgsql`) ; la CI fait foi |
| Exigences 03 | `grep -oE '^\| FR-[A-Z]+-[0-9]+' \| sort -u \| wc -l` | **90** identifiants uniques, 91 lignes (FR-C-8 deux fois) | 15 l.123, 15b, suivi : 90 | exact, doublon à retirer (R3-m03) |
| 15b | idem | 90 lignes, mêmes 90 identifiants que 03 (`diff` vide) | 90 | exact |
| `features.csv` | parseur CSV (Python) | 44 fonctions : must **20**, should **13**, could **11** dont 4 `skip` | recon l.159 et suivi : 20 / 13 / 11 dont 4 | exact |
| Suivi bis | `grep` des statuts | majeurs 8 corrigé + 1 partiel ; mineurs 14 corrigé + 1 partiel ; total 1 + 9 + 15 | « 1 bloquant, 9 majeurs, 15 mineurs » | exact |
| Passe 1 | lecture de 00 l.60 | 4 + 31 + 20 = 55 | 00 : « 4 bloquants, 31 majeurs, 20 mineurs » | exact |
| `14b-COSTS.md` | recalcul | bas 8,79 + 0,60 + 15,96 + 8,25 = 33,60 $ ; haut 12,99 + 14,85 + 74 + 29 + 20 + 239,40 + 19 + 8,25 = 417,49 $ ; sans SMS 17,64 et 178,09 | 14b | exact (tarifs non revérifiés ; change 0,9 non confirmé) |

## 3. Cohérence SQL, backend, tests, CI

| contrôle | résultat |
| --- | --- |
| Pest `SchemaTest.php` attend 36 tables | Oui : `expect($tables->reject(fn ($t) => in_array($t, $laravelTables)))->toHaveCount(36)` avec les 7 tables Laravel exclues (`migrations`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `personal_access_tokens`) ; cohérent avec les migrations présentes (cache, jobs, Sanctum). Test faible : il ne vérifie les noms que de 8 tables (R3-m07). Vert en CI. |
| `User.php` vs table `users` | Colonnes SQL : `id, email, email_verified_at, phone, phone_verified_at, password, birthdate, locale, status, risk_score, last_seen_at, deletion_requested_at, created_at, updated_at`. Modèle : `HasUuids` ; `$fillable` = email, phone, password, birthdate, locale (existent) ; `status` et `risk_score` non assignables en masse (voulu) ; casts sur 4 colonnes datées + `password` ; aucune colonne fantôme (`name`, `remember_token` absents du modèle comme du SQL). Seul écart : pas de cast `deletion_requested_at` (R3-m07). `UserFactory` ne génère que des colonnes existantes. |
| Migration `2026_11_05_000000_create_initial_schema.php` | Exécute `docs/schema/001_initial.sql` via `DB::unprepared` (chemin `../docs/schema/` puis `database/sql/`) ; `down()` interdit hors `local`/`testing`. Ordre : cache, jobs, schéma, Sanctum (la migration Sanctum vient après le schéma, ce qui est sans conséquence car elle n'a pas de clé étrangère). Passe en CI. Conflit avec Docker Compose : R3-M03. |
| Migration Sanctum | `2026_11_05_213442_create_personal_access_tokens_table.php` : `$table->uuidMorphs('tokenable')` ; test `SanctumUuidTest` (jeton émis pour un utilisateur à clé uuid, accès `/api/v1/me`, refus sans jeton, date de naissance non modifiable). OK. |
| CI | `schema.yml` : job `postgres16` (service `postgres:16`) + job `secrets` (gitleaks 8.21.2 épinglé, historique complet) ; `backend.yml` : PHP 8.4, `composer audit`, `vendor/bin/pest`. Les deux ont tourné vert sur `ac22f5c` (21:51 UTC). Les deux premiers runs (`3ace6ef`) avaient échoué (action gitleaks, dossier `tests/Unit` manquant), corrigés ensuite. Les commits suivants (docs seulement) ne déclenchent pas les workflows (filtre `paths`). Pas de reproduction possible de Pest en local ici : le PHP de ce poste n'a que `pdo_mysql` et `pdo_sqlite`. |

## 4. Secrets et fichiers sensibles (`git ls-files`, 102 fichiers)

| contrôle | résultat |
| --- | --- |
| `.env` suivi | Non. Seul `backend/.env.example` (`APP_KEY=` vide). `backend/.env` existe sur le poste mais est ignoré (`git check-ignore` : `backend/.gitignore:3`). |
| `vendor/`, `node_modules`, clés, certificats, `.sqlite`, `auth.json` | Aucun fichier suivi (`git ls-files` filtré). `git log --all --name-only` : seul `.env.example` a un nom proche de `.env` dans tout l'historique. |
| Motifs `APP_KEY=base64`, `BEGIN … PRIVATE`, `AKIA…`, `ghp_`, `sk_live`, `xox`, `AIza` | Aucune occurrence (`git grep`, hors `composer.lock` et `package-lock.json`). |
| `password=` / `secret` / `token` | Uniquement des valeurs de développement : `app_dev_only` (`infra/docker-compose.dev.yml`, ports liés à `127.0.0.1`, et `backend/.env.example`), `postgres/postgres` (workflows CI, `phpunit.xml`, scripts `tests/schema/*.mjs`). Cohérent avec le commentaire de `docker-compose.dev.yml`. |
| Historique | gitleaks en CI : « 3 commits scanned, no leaks found » (le 4e commit est docs seulement). Auteur git : `Projet Ayelo <dev@localhost>`, pas d'identité personnelle. Dépôt distant privé. |

Résultat : rien de sensible dans le dépôt. Nuance mineure : `backend/README.md` est le README Laravel d'origine (adresse `taylor@laravel.com`), voir R3-m07.

## 5. Constats, triés par gravité

### Bloquant

Aucun.

### Majeurs

| id | gravité | fichier | problème | preuve | correction |
| --- | --- | --- | --- | --- | --- |
| R3-M01 | majeur | 00, 09, 15, ADR, suivi | Les preuves de G1 sont périmées et se contredisent, alors que la CI a tourné et que la migration Laravel est testée. Un lecteur ne peut pas savoir si G1 est franchi. | 00 l.33 « exécuté sur PGlite (PostgreSQL 18 émulé) … 33 tests passés sur PostgreSQL 16.15 natif » (mélange des deux moteurs) ; 00 l.60 « il reste la CI GitHub, le test de la migration Laravel » (la migration est testée selon 09 l.12 et le suivi (2)) ; 00 l.61 « Reste à produire : tableau de coûts sourcé (MAJ-06) » (14b existe) ; 00 l.62 « Aucun code d'application écrit » (backend Laravel présent) ; 09 l.13 « workflows… écrits mais **jamais exécutés** faute de dépôt distant » ; suivi BIS-B01 « n'a pas encore été exécuté… il n'existe pas de dépôt distant » ; suivi tableau « Chiffres » « Tests SQL 31 » (33 partout ailleurs) ; 15 l.33-34 « P0-5b … à faire », « P0-6 … G1 en attente de P0-5b » ; ADR « Encore ouverts n°2 : tableau de coûts … à produire (P0-8) ». `gh run list` : runs `42116448827` et `42116448835` verts. | Une passe de statuts : mettre à jour 00, 09, 15, ADR et le suivi avec les liens des runs verts, le chiffre 33, l'état de la migration, P0-5b « fait », et écrire dans le suivi la clôture de la condition (1). |
| R3-M02 | majeur | 05, 04, 10 | La correction de l'âge supprime le parcours de connexion d'un compte existant. S02 « Inscription / connexion » n'est accessible que depuis S68 (donc après consentements et saisie de la date). Aucun flux de 04 ne décrit une connexion : un utilisateur existant (réinstallation, nouvel appareil) devrait refaire S63 et S68. S01 affiche pourtant des « boutons de connexion ». Le contrôle d'âge est aussi spécifié sans règle pour une connexion OAuth vers un compte existant. | 05 l.10 S02 accès « S68 (après contrôle d'âge) » ; 05 l.9 S01 « boutons de connexion » ; 04 : F01 et F17 ne couvrent que l'inscription (grep « connexion » : aucun flux utilisateur) ; 10 `POST /auth/login` sans `age_token` (correct) mais sans écran d'entrée. | Ajouter un flux « Connexion » : S01 → S02 (mode connexion) sans S63 ni S68 ; S63 → S68 → S02 (mode inscription) seulement pour « Créer un compte » ; préciser pour `oauth` : `age_token` exigé seulement si le compte n'existe pas. Mettre à jour 05 (accès de S02) et F01. |
| R3-M03 | majeur | infra, backend | Le flux de développement documenté est incompatible avec la migration : `docker-compose.dev.yml` monte `001_initial.sql` dans `docker-entrypoint-initdb.d` (la base `app` est créée avec le schéma) et `.env.example` pointe vers cette base ; `php artisan migrate` rejoue le même SQL via la migration `create_initial_schema` et échoue sur `create table staff_users` (relation existante, SQL sans `if not exists`). L'épopée A1 a pour preuve « `docker compose up` OK ». | `infra/docker-compose.dev.yml` : volume `../docs/schema/001_initial.sql:/docker-entrypoint-initdb.d/001_initial.sql:ro` ; `backend/.env.example` : `DB_HOST=127.0.0.1`, `DB_DATABASE=app`, `DB_USERNAME=app` ; migration : `DB::unprepared(file_get_contents(…001_initial.sql))`. Constaté par lecture, non exécuté (pas de Docker sur ce poste) ; l'échec est certain car le fichier n'est pas idempotent. | Retirer le volume `initdb` (la migration fait foi), ou rendre la migration conditionnelle ; ajouter un test ou une étape CI `migrate` sur base vierge puis `migrate:fresh`. |

### Mineurs

| id | gravité | fichier | problème | preuve | correction |
| --- | --- | --- | --- | --- | --- |
| R3-m01 | mineur | `recon.md`, 00, 02 | Corrections de contenu REA annoncées mais incomplètes ou non traçables. (a) `recon.md` garde la phrase fausse sur la certification, alors que le suivi la dit corrigée. (b) Les chiffres « 4,0 App Store FR (≈3 000 avis) » de 00 ne figurent dans aucune source de 02. (c) `recon.md` « Taille » : « M possible si on exclut appels vidéo » alors que les appels sont inclus. | `recon.md` l.164 ; 00 l.9 ; 02 l.19 (iOS 4,2 / 1,1 k seulement) ; `recon.md` l.171. | Aligner `recon.md` l.164 sur `features.csv` l.36 ; ajouter la note FR et sa date dans 02 ou retirer le chiffre de 00 ; réécrire l.171. |
| R3-m02 | mineur | `features.csv` | Deux lignes contredisent DEC E4, 03 et 12 : « Abonnement Premium (1 / 6 / 12 mois) » et « Achats ponctuels (Conversation / Propositions) » (priorité `should`, sans mention du retrait de « Propositions »). | `features.csv` lignes « Abonnement Premium (1 / 6 / 12 mois) » et « Achats ponctuels… » ; DEC E4 ; 03 l.95-96. | Mettre 1 / 3 / 12 mois et préciser « Propositions : hors lancement ». |
| R3-m03 | mineur | 15, 15b, 03 | Traçabilité encore approximative (BIS-M07 « partiel »). (a) FR-I-5 est phase A dans 03, rattachée à B4 (phase B) dans 15b. (b) FR-D-5 est phase B dans 03, rattachée à A9 (phase A) ; A9 dans 15 liste « FR-D-1..4, 9 » : FR-D-5 et FR-D-10 absents. (c) FR-A-2 pour TikTok est rattaché à « B », qui n'est pas un identifiant d'épopée : TikTok n'a aucune épopée dans 15. (d) FR-C-8 est dupliqué dans 03 (l.49 et l.174). (e) Les « types de test » de 15b sont des textes répétés par domaine (FR-C-8 « Pest (concurrence, autorisation) + Maestro (parcours 2, 4) ») ; le script générateur n'est pas dans le dépôt. (f) Le chemin critique omet A12 et A13 (dépendances de A14) ; les épopées B2 à B8 n'ont toujours ni dépendances ni preuve de fin. | `awk` sur 15b (phase vs lettre d'épopée) : FR-D-5, FR-I-5 ; 15 l.46, l.58 ; 15b l.8 ; 03 l.49, l.174. | Corriger les rattachements, créer une épopée TikTok (ou la sortir du lancement), retirer le doublon, versionner le script, ajouter les dépendances de phase B. Nuancer « 0 sans épopée ». |
| R3-m04 | mineur | CI backend | Dans la CI, les 6 tests Pest se terminent en « WARN », pas en « PASS » : `! it … → file_get_contents(/home/runner/work/…`. Le message est tronqué par Pest, la cause n'est pas diagnostiquée (fichier manquant lu pendant le démarrage de l'application, probablement `.env` absent en CI). Les assertions passent (19), mais le job reste vert avec un avertissement PHP caché, et 09 écrit « 0 échec » sans le mentionner. | `gh run view 42116448835 --log` : « Tests: 6 warnings (19 assertions) ». | Reproduire dans un conteneur, corriger la cause (par exemple `cp .env.example .env` et `php artisan key:generate` dans le workflow), puis passer `failOnWarning="true"` dans `phpunit.xml`. |
| R3-m05 | mineur | 10, 11, 09 | Le contrôle d'âge garde des angles morts. (a) Le « hash » du refus mémorisé n'est pas défini : avant tout compte il ne peut venir que de l'appareil (réinstallation ou autre appareil le contourne) ; 11 n°6 cite « identifiant social » alors que `age-check` précède l'OAuth. (b) `age_token` dure 10 min : une redirection OAuth ou un blocage de saisie peut dépasser. (c) Le test d'API (refus puis nouvelle tentative, chemin OAuth) reste à écrire (reconnu). | 10 l.48 ; 11 l.92 ; 04 F17 « refus mémorisé par hash ». | Préciser l'entrée du hash (appareil + attestation) et le comportement si le jeton expire ; écrire le test avant A3. |
| R3-m06 | mineur | SQL | Les corrections BIS-M02 et BIS-M03 ont affaibli deux garanties, sans test : (a) `position` autorise 0 à 11 : la base accepte 12 photos de profil, la limite de 6 n'est plus qu'applicative ; (b) le `check` retiré permet un message `image`, `video` ou `voice` sans média. Huit clés étrangères vers `staff_users` restent sans index. | SQL l.167 ; l.259-266 ; requête `pg_constraint` (section 1, BIS-m13). | Ajouter un déclencheur ou un `check` de plafond (6 photos hors positions temporaires) et un test ; décider si un message média sans média est admis (`media_id null` seulement avec `deleted_at`). |
| R3-m07 | mineur | backend | Petits écarts. `SchemaTest` ne vérifie que 8 noms de table (les 36 ne sont pas listés) ; `User` sans cast pour `deletion_requested_at` ; `config/sanctum.php` `expiration => null` (FR-A-6 « glissante 30 jours » non encore codée) ; `backend/README.md` est le README Laravel d'origine ; `README.md` racine dit encore « `backend/` : à créer, phase A2 » et « Aucun code d'application encore ». | `SchemaTest.php` ; `User.php` ; `README.md` tableau « Dossiers ». | Lister les 36 noms dans le test (ou comparer à `pg_dump`), ajouter le cast, remplacer les README. |
| R3-m08 | mineur | ADR, 14, 14b | Dimensionnement incohérent après `14b-COSTS.md`. ADR et 14 : « VPS 8 Go / 4 vCPU » ; 14b : l'offre à 8 Go (KVM 2) a **2 vCPU**, 4 vCPU = KVM 4 (16 Go). ADR : « Google Play 25 $ une fois » ; 14b : non vérifié. ADR : builds iOS par EAS « sans Mac » ; 14b recommande de compiler sur le Mac. DEC C1 : « VPS 8 Go ≈ 20 à 40 € » ; 14b : 8,79 $/mois sur 24 mois, 210,96 $ d'avance. | ADR l.42 ; 14 l.11 ; 14b conclusions n°4 et n°5 ; DEC C1. | Reprendre les chiffres de 14b dans ADR, 14 et DEC, ou marquer 14b comme prioritaire. |
| R3-m09 | mineur | DEC, 15, suivi | L'acceptation du « G1 conditionnel » par le propriétaire (« oui, continue ») n'est consignée que dans le suivi et dans 00 ; elle n'est pas dans `DECISIONS-PROPRIETAIRE.md`, qui est le registre des décisions, et 15 l.34 dit encore « G1 en attente de P0-5b ». Je ne peux pas vérifier la citation. | suivi l.63 ; 00 l.60 ; DEC (aucune ligne G1). | Ajouter une ligne datée dans DEC (ou le message source) et corriger 15. |
| R3-m10 | mineur | 03, 05, 10, 14 | La « page web de suppression de compte » (exigence de la fiche Google Play, à vérifier) est dans 14 et dans le titre de A16, mais n'a ni FR, ni écran, ni route : ce n'est pas testable. Le suivi la donne « corrigé ». | 14 l.94 ; 15 A16 ; grep « page web » : 11, 14, 15 seulement. | Ajouter une FR (phase A) et la route ou la page publique, avec ré-authentification par e-mail. |
| R3-m11 | mineur | workflows | Hygiène CI : `runs-on: ubuntu-latest` (annotation GitHub : migration vers Ubuntu 26 le 19 octobre 2026, soit déjà passée) et `actions/checkout@v4`, `setup-node@v4` signalés Node 20 déprécié ; aucune protection de branche ni obligation de CI verte ; les workflows ne se déclenchent pas sur les commits qui ne touchent que `docs/`. | Annotations des runs `42116448827` et `42116448835`. | Épingler `ubuntu-24.04`, monter les actions, exiger la CI verte avant fusion. |

## 6. Nouvelles incohérences introduites par les corrections récentes (point 5)

| thème | verdict | détail |
| --- | --- | --- |
| DEC vs 00 / 15 | cohérent | D1 à D7 et E1 à E5 sont appliqués dans 00 (l.27-31, périmètre A + B + D, C et E après lancement), 15 (B9 déplacé, D0 en parallèle) et `features.csv` (stories phase C, cadeaux phase E, appels `must`). Seules exceptions : R3-m02 (`features.csv` 1/6/12) et R3-m08 (VPS). |
| G6 | cohérent | 00 l.42 « gate G6 (stores) et G7, après A, B et D » ; 13 l.85 « G6 : Stores + appels » ; 15 l.81 « G6 (stores) = stores + appels » ; DEC l.65 « G6 (stores) est après D ». Le libellé court « G6 (stores) » de 00, DEC et 15 est ambigu mais ne se contredit plus. |
| Phases | écarts mineurs | R3-m03 (FR-D-5, FR-I-5, TikTok) ; 05 phase E = S33 seul, cohérent avec E1 de 15 ; A17 « S62 suit B5 » cohérent avec S62 phase B dans 05. |
| Âge avant compte | un vrai défaut | La séquence S01 → S63 → S68 → age-check → S02 est cohérente entre 03, 04, 05, 09, 10, SQL. Défaut : plus de parcours de connexion (R3-M02) ; angles morts du refus (R3-m05). |
| Docs 14 / 14b / 15 | cohérent avec écarts | 14 (section « Tableau de coûts mensuels ») renvoie à 14b ; 15 P0-8 « produit… à valider par le propriétaire » ; B10 dépend de P0-8 (produit) ; calculs de 14b exacts. Écarts : R3-M01 (ADR et 00 disent encore « à produire »), R3-m08. |
| Preuves de gate | contradictoires | R3-M01. |

## 7. Verdict

**Gate G1 définitif : OUI, franchi sur le fond.** Il n'y a aucun bloquant, et les trois conditions du suivi sont remplies :
1. **CI GitHub : remplie.** Elle n'a pas « jamais tourné » : le dépôt distant existe et deux workflows ont tourné au vert le 2026-11-05 à 21:51 UTC sur le commit `ac22f5c` (`schema` : 33 tests sur PostgreSQL 16.15 Debian, gitleaks sans fuite ; `backend` : `composer audit` propre, Pest 6 tests / 19 assertions). Si la CI n'avait pas tourné, je l'aurais jugée **bloquante** pour un « G1 définitif », parce que BIS-B01 exigeait une exécution reproductible hors du poste du développeur ; ce n'est plus le cas. Réserve : les 6 tests sortent en « WARN » (R3-m04), à diagnostiquer, pas à bloquer.
2. **Migration Laravel avec clés `uuid` et Sanctum `uuidMorphs` : remplie** (`SanctumUuidTest`, `SchemaTest`, vert en CI ; relue dans les fichiers).
3. **Troisième passe : faite** (ce document).

Je n'ai trouvé aucune correction « corrigé » entièrement absente ; deux le sont en partie (BIS-M09 `recon.md`, BIS-m14).

Ce qui manque encore (à traiter ou à accepter par écrit avec responsable et échéance, comme la première passe l'exigeait pour les majeurs) :
1. **R3-M01** : mettre à jour 00, 09, 15, ADR et le suivi (CI faite, 33 tests, migration testée, P0-5b fait). Sans cela, G1 est vrai mais illisible ; c'est une heure de travail.
2. **R3-M02** : écrire le parcours de connexion (S02 hors S63/S68) avant A5 ; c'est une lacune de spécification créée par la correction de l'âge.
3. **R3-M03** : retirer le montage `initdb` de Docker Compose ou rendre la migration compatible avant de déclarer A1 terminé.
4. Les 11 mineurs peuvent suivre après G1 avec échéance dans 15 ; R3-m04 (avertissements Pest) et R3-m10 (page web de suppression, exigence stores donc G6) sont à traiter en premier.

Limites de cette passe : Pest n'a pas pu être exécuté sur ce poste (PHP sans `pdo_pgsql`) ; je m'appuie sur le log de la CI. Docker n'est pas disponible : R3-M03 est établi par lecture. Les chiffres des tarifs de 14b, le taux de change et la note « 4,0 App Store FR » n'ont pas été revérifiés auprès des sources. La validation juridique (RGPD, données sensibles, mineurs) reste ouverte, comme dans les passes précédentes.
