# Suivi des constats de `code-security-2.md`

Date : 2026-11-06. Preuve : `backend/tests/Feature/SecurityHardeningRound2Test.php` (un test par constat corrigé) et la suite complète Pest sur PostgreSQL 16 (port 54330). Le résultat de la suite complète est reporté en bas de page.
Statuts : [x] corrigé (test cité) | [~] atténué ou décision requise | [ ] ouvert.

## Constats hauts

- [x] **N-01** panneau lié à `ADMIN_DOMAIN` (`AdminPanelProvider::adminDomain`), et `/admin`, `/livewire`, `/filament` répondent 404 sur le domaine de l'API dans le Caddyfile. Test : `N-01`. Reste à faire au déploiement : renseigner `ADMIN_DOMAIN` et la liste d'IP.
- [x] **N-02** un compte suspendu ou banni se reconnecte avec un jeton restreint, lit sa sanction et la conteste ; un compte supprimé ne le peut pas. Tests : `N-02` (2).

## Constats moyens

- [x] **N-03** limites par IP relevées (connexion 120 / 15 min, OAuth 120, inscription 60 / h, contrôle d'âge 100 / h) ; le compteur d'appareil reste strict.
- [x] **N-04** le refus d'âge lié à l'IP expire après 30 minutes ; le refus lié à l'appareil reste de 90 jours. Test : `N-04`.
- [x] **N-05** le secret 2FA est créé et affiché à la création du compte du personnel (`StaffCreateCommand`), donc plus d'enrôlement par le seul mot de passe.
- [x] **N-06** les échecs par e-mail sont comptés dans `LoginController`, pas dans le limiteur ; une connexion réussie remet le compteur à zéro. Tests : `N-06` (3).
- [~] **F-02 résiduel** changement d'IP et IPv6 : non traité. Demande une attestation d'appareil (spec 001 T012) ; risque accepté pour la bêta fermée, à confirmer par le propriétaire.
- [x] **F-08 résiduel** commande `billing:replay-unknown`, planifiée toutes les 15 minutes. Test : `F-08`.
- [~] **F-09 résiduel** suspension par deux comptes jetables : décision produit requise (voir `DECISIONS-PROPRIETAIRE.md`). Atténuation actuelle conservée (conversation commune ou second signaleur distinct, 3 signalements par jour).
- [x] **F-10 résiduel** `is_visible` pris en compte dans la liste des matchs. Test : `F-10`.

## Constats bas

- [x] **N-07** exemple de production : `SESSION_DRIVER=redis`, `SESSION_SECURE_COOKIE=true`, `SESSION_SAME_SITE=strict` (`infra/.env.prod.example`).
- [x] **N-08** l'e-mail saisi lors d'un échec de connexion du personnel est borné à 190 caractères et ignoré s'il n'est pas une chaîne (`StaffAuthAudit`).
- [~] **N-09** fait : e-mail du média masqué sans le droit `users.view`, `canViewForRecord` aligné sur `users.view` dans les trois relations. Reste : téléphone et score de risque pour le support, journalisation des aperçus d'images de message, séparation du droit selfie (non vérifié dans un vrai navigateur).
- [x] **N-10** mot de passe du personnel : 12 caractères minimum aussi via le profil (`EditStaffProfile`). Le mot de passe initial saisi à la création reste affiché en clair dans la console : non traité.
- [x] **N-11** `channels:` retiré de `bootstrap/app.php` (les canaux sont chargés par `routes/api/realtime.php`), `GET /` supprimé. Test : `N-11`.
- [ ] **N-12** double contrôle des actions administrateur : décision produit.
- [~] **N-13** fait : l'expiration automatique écrit `sanction.expired` (test dans `StaffCommandTest`) ; l'opérateur de la console (variable optionnelle `STAFF_OPERATOR`, clé `operator` dans `after`) est enregistré par `staff:create` (`staff.created`) et `staff:reset-2fa` (`staff.2fa_reset`). Tests : `N-13` (2, `SecurityHardeningRound3Test`). Reste : l'acteur reste nul et l'opérateur est déclaratif (non authentifié, vide si la variable n'est pas définie), ordre de suppression du selfie avant commit (probabilité faible), obligation d'ouvrir le selfie avant d'approuver.
- [~] **N-14** fait : lecture bornée à `max_bytes + 1` octets (`Range` côté S3), plafond ramené à 20 Mpx. Tests : `N-14` (2). Balayage des clés orphelines : commande `media:sweep-orphans` (préfixe `u/`, délai de grâce 48 h, plafond 5 000 suppressions par passage, option `--dry-run`, planifiée à 04:00 ; méthode `MediaStorage::listObjects`, non exercée contre un vrai bucket S3/R2, seulement contre `FakeMediaStorage`). Tests : `N-14` (2, `SecurityHardeningRound3Test`). Reste : mise à jour des bibliothèques d'images, traitement hors processus web.
- [x] **F-23** un message texte avec `media_id` est refusé. Test : `F-23`.
- [x] E-mail envoyé en tableau : plus de 500 (`login`, `password-forgot`). Test dédié.
- [x] **F-16 résiduel** les alias d'e-mail d'une adresse bannie sont refusés (`BannedIdentifiers::normalize` : minuscules, `+tag` retiré, points et `googlemail.com` ramenés à `gmail.com` pour Gmail ; les empreintes exactes déjà écrites restent reconnues). Tests : `F-16` (4, dont l'inscription). Non couvert : relais d'adresses masquées (Apple), appareil non banni.
- [x] **F-22 résiduel** quotas par type dans `config/media.php` : `max_open` (dépôts en attente ou en revue) et `max_per_day` (24 h glissantes) ; réponse 422. Tests : `F-22` (2). Les valeurs (selfie 3 / 5, photo de profil 6 / 12, image de message 50 / 100) sont des choix à confirmer.
- [~] **F-06 résiduel** fait : la date de naissance est ramenée au 1er janvier de l'année à l'anonymisation (migration `2026_11_07_000000_generalise_birthdate_on_deletion`, qui assouplit uniquement ce passage dans le déclencheur `lock_birthdate`) ; une panne du stockage sur un compte n'interrompt plus la purge des suivants (le compte reste « deleting » et ses lignes de média sont conservées pour la reprise). Tests : `F-06` (2). Attention : `docs/schema/001_initial.sql` n'est pas modifié (hors périmètre de ce lot) ; le déclencheur du schéma de référence reste l'ancien tant que la migration n'y est pas reportée, et la CI `schema` qui n'applique que ce fichier ne couvre pas ce passage. Reste : durées de conservation écrites pour `reports.details` et `sanctions.reason` (décision).

## Constats de la revue S9 indépendante (traités)

- [x] `SendPush` ignore les comptes dont le statut n'est pas `active` (les jetons ne sont plus révoqués à la sanction, N-02). Test : `S9` (SendPush).
- [x] `staff:reset-2fa` crée un nouveau secret TOTP au lieu de vider la 2FA (qui rouvrait N-05) ; `staff:create` n'affiche plus mot de passe et secret 2FA dans la même sortie sauf avec `--show-secret` (sinon : `staff:reset-2fa` dans une session distincte). Tests : `S9` (2), `StaffCommandTest` mis à jour. Un compte créé sans `--show-secret` n'a donc pas de secret connu de l'opérateur tant qu'il n'a pas lancé `staff:reset-2fa`.
- [x] Constat « une sanction sur un compte `deleting` le passe à `banned` » : inexact pour `SanctionLedger::issue`, qui refuse déjà les statuts hors `active`, `suspended`, `banned` (`SANCTIONABLE`). Une garde `whereIn('status', ...)` a tout de même été ajoutée sur la mise à jour. Test : `S9` (sanction).
- [x] `POST /api/v1/broadcasting/auth` refuse le canal `user.{id}` d'un autre et `conversation.{id}` d'un non-participant. Test : `S9` (broadcasting) ; le contrôle existait déjà dans `MessagingTest`.
- [x] Garde de démarrage : en production sans `ADMIN_DOMAIN`, `AdminPanelProvider::warnIfUnbound` journalise en `critical` (pas d'exception : elle casserait les builds d'image et `config:cache`). Test : `N-01` (garde).

## Exigences S2 (limites de débit)

- [x] 429 testé pour `age-check`, `register`, `password-forgot` et `media-upload` (`S2`).

## Preuves d'exécution (condition G3)

- [x] Pest rejoué (voir résultat ci-dessous).
- [x] `composer audit` rejoué le 2026-11-06 : « No security vulnerability advisories found ».
- [x] `npm audit --omit=dev` mobile rejoué le 2026-11-06 : 22 vulnérabilités (1 basse, 21 modérées), aucune haute ni critique (outils de build transitifs ; le correctif proposé est un retour à Expo 52, refusé).
- [ ] `gitleaks` sur l'historique du commit final : non rejoué en local (binaire absent du poste, téléchargement non autorisé) ; le workflow CI `schema` le fait sur l'historique complet.
- [ ] Procès-verbal de restauration réel (S8).
- [ ] Troisième relecture ciblée N-01 / N-02 (S9).

## Hors code (propriétaire)

- [ ] Procédure aux autorités (T008), organisation et budget de la modération (T009), matrice juridique par marché, attestation d'appareil.

## Résultat de la suite complète

**278 tests, 1723 assertions, 0 échec** (Pest, PostgreSQL 16, PHP 8.5.12 avec `pdo_pgsql`, exécution du 2026-11-07). Sous Windows, les tests de signature RSA demandent `OPENSSL_CONF` vers un `openssl.cnf` existant.
