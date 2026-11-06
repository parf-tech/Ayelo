# Tâches 001 : Comptes et authentification

Légende : `[x]` fait et vérifié (preuve citée) | `[~]` écrit, non vérifié | `[ ]` non fait

## US1 – Âge et inscription
- [x] T001 [US1] `POST /auth/age-check`, jeton chiffré 10 min lié à l'appareil, refus mémorisé 90 j — `AuthFlowTest` (mineur, 18 ans jour J, jeton falsifié/expiré/autre appareil)
- [x] T002 [US1] `POST /auth/register` avec consentements, appareil, Argon2id — `AuthFlowTest`
- [x] T003 [US1] Date de naissance verrouillée en base (déclencheur) — `schema.test.mjs`, `SanctumUuidTest`
## US2 – Connexion
- [x] T004 [US2] Login, réponse identique inconnu/mauvais mot de passe, compte suspendu refusé, limite 5/15 min — `AuthFlowTest`
- [x] T005 [US2] Logout révoque le jeton — `AuthFlowTest`
## US3 – E-mail et mot de passe
- [x] T006 [US3] Vérification d'e-mail : usage unique, 24 h, 5 essais, renvoi limité à 3/h — `AccountFlowTest`
- [x] T007 [US3] Mot de passe oublié sans énumération, réinitialisation ferme toutes les sessions — `AccountFlowTest`
## US4 – Sessions
- [x] T008 [US4] Liste, fermeture d'une session ou de toutes, isolation entre utilisateurs — `AccountFlowTest`
## US5 – OAuth
- [x] T009 [US5] Vérificateur JWT RS256 (signature, émetteur, audience, expiration) avec clés générées — `AccountFlowTest`
- [x] T010 [US5] Flux OAuth : inscription exigeant âge + consentements, connexion directe, pas de rattachement automatique — `AccountFlowTest`
- [ ] T011 [US5] Validation avec les **vrais** JWKS Google et Apple et des identifiants d'application réels — dépend du propriétaire (comptes et clients OAuth)
## Reste (voir 011)
- [ ] T012 Attestation d'appareil (Play Integrity, App Attest) contre la forge de `X-Device-Id`
- [ ] T013 Décider de l'expiration glissante (ADR 006)
