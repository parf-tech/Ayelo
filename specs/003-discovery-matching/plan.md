# Plan 003 : Découverte, swipes et matchs

- Routes : `backend/routes/api/discovery.php` ; contrôleurs `DiscoveryController`, `SwipeController`, `MatchController`, `BlockController`
- Services : `DiscoveryQuery` (requête de candidats), `SwipeService` (verrou consultatif `pg_advisory_xact_lock` sur la paire, `insertOrIgnore` pour match et conversation), `Premium`
- Événement : `MatchCreated` diffusé sur `private-user.{id}` après validation de la transaction
- Schéma : `swipes`, `matches` (ordre canonique `user_a < user_b`), `daily_counters`, `blocks`
- Décisions : tri par date de création du profil (pas de classement de compatibilité en V1) ; curseur `created_at|id`.
- Risques : la concurrence réelle (deux transactions simultanées) n'est pas testée, seulement la séquence ; à couvrir par un test de charge (011).
