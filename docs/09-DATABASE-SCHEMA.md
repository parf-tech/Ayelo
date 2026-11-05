# 09 : Schéma de base de données (PostgreSQL)

**Source de vérité : [`schema/001_initial.sql`](schema/001_initial.sql).** Ce document décrit les choix ; en cas d'écart, le fichier SQL fait foi. Les documents 08 et 10 s'alignent sur lui.

## Statut de vérification (preuve)

| élément | résultat |
| --- | --- |
| Exécution du SQL sur une base vierge | **réussie** : 36 tables créées (2026-11-05, après corrections de la seconde relecture) |
| Moteur utilisé | **PostgreSQL 16.15 natif** (binaires Windows du paquet npm `embedded-postgres`), via `tests/schema/run-local-pg16.mjs`. Vérification précédente sur PGlite (PostgreSQL 18.6, WebAssembly) |
| Tests de contraintes | **33 tests, 0 échec** sur PostgreSQL 16.15 (36 tables ; inclut un test de concurrence : deux insertions simultanées du même match donnent une seule ligne) |
| Migration Laravel | **testée** (2026-11-05) : Laravel 12 + Sanctum 4 avec `uuidMorphs`, migration qui applique `001_initial.sql`, `migrate:fresh` rejouable (fonctions en `create or replace`). Pest sur PostgreSQL 16.15 : 6 tests, 19 assertions, 0 échec (`backend/tests/Feature`) |
| Reste à faire | exécuter les workflows GitHub (`schema.yml`, `backend.yml`), écrits mais **jamais exécutés** faute de dépôt distant |

Ajoutés après la seconde relecture : suppression d'un média lié à un message, réordonnancement des photos en deux mises à jour (l'échange direct est refusé), `truncate` du journal d'audit refusé, appel `busy`, message image.

Tests exécutés : refus d'un mineur à la création du compte ; date de naissance non modifiable ; match en ordre canonique, ordre inverse refusé, doublon refusé ; message renvoyé refusé, même `client_id` accepté pour l'autre participant, texte vide refusé ; clé d'idempotence unique par utilisateur ; webhook rejoué refusé ; journal d'audit non modifiable (update et delete) ; suppression d'un utilisateur signalé refusée ; Premium offert sans transaction accepté, abonnement de store sans transaction refusé ; unicité de la position des photos.

## Conventions

- Clés `uuid` (générées par l'application, ordonnées : `HasUuids` de Laravel). `gen_random_uuid()` est natif depuis PostgreSQL 13 : pas besoin de `pgcrypto`.
- `created_at` et `updated_at` en `timestamptz` (UTC).
- États par `text` + `check` (pas d'`enum` natif : migrations plus simples).
- Argent en cents + devise. Crédits : registre en ajout seulement.
- Mot de passe nommé `password` (convention Laravel). Pour Sanctum avec des clés `uuid`, publier la migration et utiliser `uuidMorphs` pour `tokenable` (test de migration obligatoire en CI).
- Accès : politiques Laravel (pas de RLS).
- PostGIS et la proximité sont **hors** de cette migration (migration séparée en phase E).

## Tables par module (36)

| module | tables |
| --- | --- |
| Personnel | `staff_users` (2FA, rôle ; garde Filament séparée de `users`) |
| Auth | `users`, `user_consents`, `auth_identities`, `devices`, `verification_codes`, `banned_identifiers`, `notification_prefs` |
| Profils | `profiles`, `preferences`, `media`, `verification_requests` |
| Découverte | `swipes`, `matches`, `daily_counters` |
| Messagerie | `conversations`, `messages` |
| Appels | `call_sessions` |
| Contenus | `stories`, `story_audience`, `story_views`, `video_invites` |
| Monétisation | `subscriptions`, `credit_ledger`, `purchases`, `gifts`, `gift_sends`, `webhook_events` |
| Sécurité et conformité | `blocks`, `reports`, `risk_events`, `sanctions`, `appeals`, `support_tickets`, `data_exports`, `audit_logs` |

Tables techniques ajoutées par Laravel : `personal_access_tokens`, `jobs`, `failed_jobs`, `cache`, `migrations`.

Les pièces jointes de messages passent par `messages.media_id` ; les réactions de story par `story_views.reaction` ; le jeton push par `devices.push_token`. Il n'y a donc ni `message_attachments`, ni `story_reactions`, ni `push_tokens`.

## Décisions de conception

| sujet | décision |
| --- | --- |
| Comptes d'administration | table `staff_users` distincte de `users` ; 2FA obligatoire avant toute session ; interdits sur l'app mobile |
| Consentements | `user_consents(kind, version, granted, ip)` pour CGU, confidentialité, données sensibles, localisation, marketing, biométrie de vérification |
| Suppression de compte | on **anonymise** : `users.status='deleted'`, purge des données personnelles et des médias. `reports.reported_id` et `sanctions.user_id` sont en `on delete restrict` : une ligne `users` minimale est conservée tant qu'un signalement ou une sanction existe. `banned_identifiers` garde des hash (e-mail, téléphone, appareil, refus d'âge) pour empêcher le retour d'un utilisateur banni |
| Conversations | `status` + `hidden_by_a_at` / `hidden_by_b_at` : « supprimer » une conversation la masque pour soi, elle reste visible pour la modération 90 jours |
| Âge | contrôle avant création du compte (refus mémorisé dans `banned_identifiers.kind='age_refusal'`) ; `birthdate` est stockée dans **`users`** (plus dans `profiles`), avec `check` ; déclencheur qui interdit sa modification |
| Selfie de vérification | `media.purge_after` : supprimé après la décision ; seul le résultat reste. Consentement `verification_biometric` requis |
| Idempotence | clés uniques **par utilisateur** : `(user_id, idempotency_key)` et `(sender_id, idempotency_key)` ; un utilisateur ne peut pas bloquer la clé d'un autre |
| Abonnement | `store` accepte `promotional` (Premium offert, `original_transaction_id` nul, `granted_by` renseigné). `app_user_id` RevenueCat = `users.id` |
| Crédits | `credit_ledger` ajoute `spend_proposal`. Solde = somme des deltas, vérifié en transaction avec verrou de ligne |
| Quotas | `daily_counters` (likes, nouvelles conversations, SMS, signalements) |
| Journal d'audit | table append-only par déclencheur (update et delete interdits, vérifié par test). En production, utiliser en plus un rôle applicatif sans droit de modification (le rôle de migration est distinct) |
| Contestation | `appeals` liée à une `sanction` ; un seul appel par sanction |
| Support | `support_tickets` |
| Export RGPD | `data_exports` (fichier généré par un job, URL signée, expiration) |

## Règle de concurrence des matchs

Deux likes simultanés peuvent ne voir aucun le like de l'autre (isolation READ COMMITTED) et ne créer aucun match. Règle retenue : dans la transaction du swipe, prendre `pg_advisory_xact_lock(hashtextextended(min(a,b)||max(a,b), 0))`, insérer le swipe, puis chercher le swipe réciproque ; créer le match avec `insert … on conflict do nothing`. Test obligatoire : **exactement un** match après deux likes simultanés.

## Intégrité critique

| risque | protection |
| --- | --- |
| Deux matchs pour la même paire | `check (user_a < user_b)` + `unique (user_a, user_b)` ; test OK |
| Match manqué par concurrence | verrou consultatif décrit ci-dessus (à tester en intégration) |
| Message dupliqué après coupure réseau | `unique (conversation_id, sender_id, client_id)` ; test OK |
| Crédit dépensé deux fois | clé d'idempotence + verrou de ligne + solde vérifié dans la transaction |
| Webhook reçu deux fois | `webhook_events.id` unique ; test OK |
| Mineur inscrit | contrôle avant compte + `check` ; test OK |
| Journal d'audit modifié | déclencheur ; test OK |
| Évasion d'un bannissement par suppression de compte | `restrict` + `banned_identifiers` ; test OK pour `restrict` |

## À faire plus tard

1. Migration de proximité (PostGIS) en phase E, avec image `postgis/postgis`.
2. Partitionnement de `messages` si le volume le justifie.
3. Test de migration Laravel (Sanctum avec `uuidMorphs`) en CI.
4. Politique de conservation chiffrée par type de donnée (avec un juriste).

## Corrections issues de la seconde relecture

| sujet | correction |
| --- | --- |
| Suppression d'un média lié à un message | la contrainte `check` qui interdisait `media_id` nul est supprimée : un média purgé laisse `media_id` à `null` et le message reste affiché comme « média supprimé » |
| Réordonner les photos | `position` accepte 0 à 11. L'application limite à 6 photos et réordonne en deux mises à jour dans une transaction (décalage de +6, puis position finale). L'échange direct est refusé par l'index unique : c'est testé |
| `truncate` du journal d'audit | déclencheur `before truncate` ajouté (testé) |
| Index manquants | 11 index ajoutés sur des clés étrangères (`messages.media_id`, `conversations.match_id`, `stories.media_id`, etc.) |
| Appel occupé | `call_sessions.status` accepte `busy` |
| Super-like | `daily_counters.kind` accepte `super_likes` |
| Date de naissance | déplacée dans `users` ; le contrôle d'âge se fait avant la création du compte (`POST /auth/age-check`, jeton signé exigé par `register` et `oauth`) |
| Purge du selfie de vérification | on ne supprime pas la ligne `media` : `status='purged'` et suppression de l'objet R2, pour garder le résultat dans `verification_requests` |
| Réinitialisation du mot de passe | un seul mécanisme : `verification_codes` (canal `password_reset`) ; la table `password_reset_tokens` de Laravel n'est pas utilisée |
