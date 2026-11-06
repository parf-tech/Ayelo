# Tâches 010 : Application mobile

## US1 – livré (rapport de l'agent, 141 tests Jest, typecheck et lint propres, bundle Android compilé ; **non rejoué par le CTO**)
- [~] T001 [US1] Design system, thème clair / sombre, i18n fr/en avec test de parité, client API, stockage sécurisé, garde d'auth
- [~] T002 [US1] Écrans S01, S63, S68, S64, S02, S04, S05 ; connexion sans S63 ni S68 ; refus d'âge terminal
- [ ] T003 Rejouer `npm run typecheck`, `npm run lint`, `npm test` par le CTO sur l'état actuel du dépôt (y compris les modifications non commitées)
## Reprise après interruption (limite d'usage de l'agent)
- [ ] T004 Relire et trier les fichiers modifiés non commités de `mobile/` ; supprimer `src/api/types.head.tmp`
## US2 à US8 – à faire
- [ ] T010 [US2] Envoi du profil (`PUT /me/profile`, pays d'origine et de résidence), photos S06 (upload présigné), préférences S07, e-mail S03, mot de passe oublié S61
- [ ] T020 [US3] Découvrir : cartes, filtres, match, détail, blocage / signalement
- [ ] T030 [US4] Messages : liste, conversation, optimiste, temps réel (pusher-js), avis de sécurité
- [ ] T040 [US5] Paramètres : confidentialité, notifications, sessions, bloqués, suppression, export, support, consentements, sanctions
- [ ] T050 [US6] Premium : `PurchaseProvider` + RevenueCat (build de développement)
- [ ] T060 [US7] Vérification de profil
- [ ] T070 [US8] Interface d'appel + `MediaEngine` abstrait
- [ ] T080 Tests de bout en bout (Maestro) sur émulateur contre un backend local — gate G4
- [ ] T090 Remplacer les types d'API provisoires par un client généré (OpenAPI)
