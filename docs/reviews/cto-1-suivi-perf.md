# Suivi CTO 1, risque 9 : performance des chemins chauds

Source : `docs/reviews/cto-1.md`, section 2.1 et risque 9. Tests : `backend/tests/Feature/QueryPerformanceTest.php`.

## Corrigé

| constat | correctif | preuve |
| --- | --- | --- |
| Liste des conversations : une requête « dernier message » par conversation (jusqu'à 100) | une seule requête par jointure latérale (`cross join lateral ... limit 1`), départage `created_at desc, id desc` ; messages supprimés toujours ignorés | `ConversationController::index` ; test « 1 contre 20 » |
| Compteur de non lus : agrégat sans index adapté | requête groupée inchangée (une seule) + index partiel `messages_unread_idx (conversation_id) where read_at is null and deleted_at is null` | test de plan `explain` |
| Présentateur : une requête `media` par profil | `ProfilePresenter::publicMany()` : un `whereIn user_id` pour tous les profils ; `public()` reste pour un profil isolé et produit le même JSON (test d'égalité) | découverte, conversations et matchs |
| `GET /me` : trois `sum(delta)` | un seul agrégat groupé sur `credit_ledger` (3 requêtes devenues 1) ; la table de soldes reste à faire | `ProfilePresenter::self` |
| Matchs : même N+1 via le présentateur | `MatchController::index` utilise `publicMany()` | test « 1 contre 20 » |
| Découverte : tri sans index | `profiles_visible_created_idx (created_at desc, id desc) where is_visible` | |
| Découverte : filtres âge, fraîcheur, photo | `users_active_birthdate_idx`, `users_active_last_seen_idx` (comptes actifs), `media_approved_photo_idx` (photo approuvée) | |
| Découverte : aucun filtre d'activité | paramètre `active_within_days` (1 à 365) et défaut `discovery.active_within_days` (variable `DISCOVERY_ACTIVE_WITHIN_DAYS`, vide = désactivé). Un compte jamais vu (`last_seen_at` nul) reste éligible s'il est créé dans la fenêtre. | test « fraîcheur » |
| Messages : curseur `(created_at, id) < (?, ?)` | le contrôleur était déjà correct ; l'index `messages_conversation_created_idx (conversation_id, created_at desc, id desc)` couvre maintenant l'ordre complet et remplace l'ancien index à deux colonnes (redondant, supprimé) | test de pagination à horodatage identique (aucun doublon, aucun trou) |

Nombre de requêtes constant (1 contre 20, `Model::preventLazyLoading()` actif) : conversations, matchs, découverte, lot de présentateur.

## Index et migrations

- `backend/database/migrations/2026_11_08_000000_add_hot_path_indexes.php` : `create index concurrently if not exists` (ne bloque pas les écritures), `$withinTransaction = false`. Un index resté INVALIDE après une construction interrompue se supprime (`drop index concurrently`) avant de relancer.
- `docs/schema/001_initial.sql` : mêmes noms d'index, en `create index` simple (base neuve, sans écritures concurrentes). Sur une base neuve la migration ne fait donc rien ; sur une base existante elle crée les index et retire `messages_conversation_id_created_at_idx`.
- Vérifié : `migrate:fresh` sur PostgreSQL 16 ; mise à niveau d'une base créée avec l'ancien schéma (index créés, ancien supprimé, deuxième passage sans effet) ; `tests/schema/schema.test.mjs` (33 contrôles) ; suite Pest ciblée.

## Reste à faire (hors périmètre de ce lot)

- Mesure `EXPLAIN ANALYZE` sur 200 000 profils et test k6 (demandés par cto-1 ; le test de plan ici ne porte que sur un jeu de 20 000 messages).
- `last_seen_at` n'est mis à jour qu'à la connexion : le filtre de fraîcheur n'est utile qu'une fois la mise à jour limitée à une écriture par heure en place (middleware, hors de ce lot). C'est pourquoi le défaut est désactivé.
- Table de soldes `credit_balances` et `Premium::active` (lectures de `GET /me`).
- Liste des conversations non paginée (plafond dur à 100) ; `last_message_preview` et compteur stockés sur `conversations`.
- Contrat OpenAPI : documenter le paramètre `active_within_days` de `GET /discover`.
- Signature d'URL de média par photo : calcul local, pas de requête SQL, mais coût CPU par profil à surveiller.
