# Tâches 005 : Sécurité et modération

- [x] T001 [US1] `POST /reports` (validation, quota 20/jour, anti-doublon) — `DiscoverySafetyTest`
- [x] T002 [US2] Mineur suspecté : priorité 2, suspension préventive, sanction enregistrée, compte retiré de la découverte — `DiscoverySafetyTest`
- [x] T003 [US3] 3 signalements distincts : priorité 1 et événement de risque — `DiscoverySafetyTest`
- [x] T004 [US4] `GET /me/sanctions`, `POST /appeals` (une seule, isolation entre utilisateurs) — `DiscoverySafetyTest`
- [ ] T005 [US5] File de signalements et décisions (voir 009)
- [ ] T006 [US6] File de médias à modérer (voir 009)
- [ ] T007 Choix du prestataire de modération d'images et de texte (FR-I-3, I-10)
- [ ] T008 Procédure écrite de signalement aux autorités par pays et circuit des preuves — **juriste requis**
- [ ] T009 Budget et organisation de la modération humaine (fr, en ; plusieurs fuseaux) — **propriétaire**
- [x] T010 Revue de sécurité indépendante du code — `docs/reviews/code-security-1.md` (0 critique, 9 hauts, 9 moyens, 12 bas ; G3 non franchi)
- [x] T011 Corriger les 9 constats hauts — 7 corrigés, 2 atténués ; preuve : `SecurityHardeningTest` + suite complète 158 tests ; suivi dans `docs/reviews/code-security-1-suivi.md`
- [ ] T012 Traiter les constats moyens et bas restants (F-11, F-13, F-14, F-17, F-18, F-19 à F-30)
- [ ] T013 Seconde revue indépendante du code corrigé, `npm audit` du mobile, gitleaks sur le commit final (gate G3)
