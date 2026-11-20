# Tâches 010 : Application mobile

## US1 – livré (141 tests à l'origine ; état actuel rejoué par le CTO : 300 tests, voir T003)
- [~] T001 [US1] Design system, thème clair / sombre, i18n fr/en avec test de parité, client API, stockage sécurisé, garde d'auth
- [~] T002 [US1] Écrans S01, S63, S68, S64, S02, S04, S05 ; connexion sans S63 ni S68 ; refus d'âge terminal
- [x] T003 Rejouer `npm run typecheck`, `npm run lint`, `npm test` par le CTO — preuve : rejoué le 2026-11-06 : typecheck et lint sans erreur, 15 suites / 300 tests verts, `npx expo export --platform android` compile (dossier temporaire supprimé)
## Reprise après interruption (limite d'usage de l'agent)
- [x] T004 Relire et trier les fichiers modifiés non commités de `mobile/` ; supprimer `src/api/types.head.tmp` — preuve : fichier supprimé (absent du `ls`), `sendGift` et les routes absentes du backend retirées de `endpoints.ts`, test `n'expose aucune route absente du backend` dans `__tests__/api.test.ts`
## US2 à US8 – écrits, testés par Jest, non vérifiés sur appareil
Preuve (rejouée par l'agent mobile le 2026-11-06, sorties dans son rapport) : `npm run typecheck` propre, `npm run lint` propre, `npm test` 15 suites / 300 tests verts, `npx expo export --platform android` compile (1388 modules, dossier `dist` supprimé). `[~]` = écrit et testé avec un faux serveur / faux transport ; rendu sur appareil, vrai backend, Reverb, RevenueCat, caméra et geste de swipe **non vérifiés** (voir `mobile/README.md`, « Écarts connus avec l'API et limites »). Détails : T050 `revenueCatProvider.ts` jamais exécuté ; T070 interface et signalisation seulement, le média (LiveKit), CallKit et ConnectionService ne sont pas implémentés (prototype D0 requis) ; T030 `PUT /me/device` (jeton push) non fait.
- [~] T010 [US2] Envoi du profil (`PUT /me/profile`, pays d'origine et de résidence), photos S06 (upload présigné), préférences S07, e-mail S03, mot de passe oublié S61
- [~] T020 [US3] Découvrir : cartes, filtres, match, détail, blocage / signalement
- [~] T030 [US4] Messages : liste, conversation, optimiste, temps réel (pusher-js), avis de sécurité
- [~] T040 [US5] Paramètres : confidentialité, notifications, sessions, bloqués, suppression, export, support, consentements, sanctions
- [~] T050 [US6] Premium : `PurchaseProvider` + RevenueCat (build de développement)
- [~] T060 [US7] Vérification de profil
- [~] T070 [US8] Interface d'appel + `MediaEngine` abstrait
- [~] T051 [US6] S34 Historique des achats (`GET /billing/transactions`, écran `settings/purchases`, entrée dans Réglages) : écrit et testé par Jest (faux serveur), non vérifié sur appareil
- [ ] T080 Tests de bout en bout (Maestro) sur émulateur contre un backend local — gate G4
- [~] T090 Remplacer les types d'API manuscrits par les types générés : `openapi.d.ts` généré et compilé, **migration des écrans non faite**
