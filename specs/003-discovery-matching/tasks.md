# Tâches 003 : Découverte, swipes et matchs

- [x] T001 [US1] `GET /discover` filtres, exclusions, pagination — `DiscoverySafetyTest`
- [x] T002 [US2] `POST /swipes` + match et conversation uniques, rejeu idempotent — `DiscoverySafetyTest`
- [x] T003 [US3] Quota de likes, super-like et annulation Premium — `DiscoverySafetyTest`
- [x] T004 [US4] `GET /matches`, `DELETE /matches/{id}` — `DiscoverySafetyTest`
- [x] T005 [US5] Blocage idempotent (effets sur match et conversation) — `DiscoverySafetyTest`
- [x] T006 Correction d'un défaut trouvé par les tests : le rejeu d'un swipe réciproque renvoyait `matched:false` — `DiscoverySafetyTest`
- [ ] T007 Test de concurrence réelle (deux connexions simultanées sur la même paire) — à faire en 011
- [ ] T008 Classement par compatibilité (B7) — reporté, besoin produit à confirmer
