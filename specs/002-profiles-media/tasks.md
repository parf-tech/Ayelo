# Tâches 002 : Profils et médias

- [x] T001 [US1] `PUT /me/profile`, `GET /me`, validations, limite de changement de pays — `ProfileMediaTest`
- [x] T002 [US3] `PATCH /me/privacy` — `ProfileMediaTest`
- [x] T003 [US4] `GET/PUT /me/preferences` (tableaux PostgreSQL, âge ≥ 18, min ≤ max) — `ProfileMediaTest`
- [x] T004 [US5] `GET /profiles/{id}` + politique de visibilité (masqué, bloqué, suspendu, sans profil) — `ProfileMediaTest`
- [x] T005 [US2] URL présignée, limites par type, 6 photos, relecture de l'objet, file de modération — `ProfileMediaTest`
- [x] T006 [US2] Réordonner, supprimer, isolation entre utilisateurs — `ProfileMediaTest`
- [ ] T007 [US2] Essai réel contre Cloudflare R2 (présignature PUT, en-têtes, `HEAD`) — dépend de la clé R2 du propriétaire
- [ ] T008 Choix du prestataire de modération d'images et de sa procédure légale (ADR 005) — dépend du propriétaire / juriste
