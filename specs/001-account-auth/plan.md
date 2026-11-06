# Plan 001 : Comptes et authentification

**Contexte technique** : Laravel 12, PHP 8.4, PostgreSQL 16, Sanctum (clés uuid), Argon2id, Pest. Conformité : constitution V (âge avant compte, 404 uniformes, secrets en environnement).

## Fichiers
- Routes : `backend/routes/api/auth.php`
- Contrôleurs : `app/Http/Controllers/Auth/{AgeCheck,Register,Login,Logout,OAuth,EmailVerification,Password,Session}Controller.php`
- Services : `AgeGate` (jeton chiffré, refus mémorisé par HMAC de l'appareil), `Registrar`, `DeviceSessions`, `OneTimeCodes` (hash SHA-256, 5 essais), `AccountMail`, `OAuth/JwtOAuthVerifier` (firebase/php-jwt)
- Support : `Support/DeviceId` (en-tête `X-Device-Id`)
- Limites : `AppServiceProvider` (age-check, register, login, oauth, email-verify, email-resend, password-*)
- Schéma : `users`, `user_consents`, `auth_identities`, `devices`, `verification_codes`, `banned_identifiers`, `notification_prefs`

## Décisions
- ADR 006 (sessions). L'âge est stocké dans `users.birthdate`, verrouillé par déclencheur SQL.
- Le client ne calcule jamais l'âge : il envoie toujours la date au serveur (sinon un mineur pourrait essayer plusieurs dates sans refus mémorisé).

## Risques
`X-Device-Id` est fourni par le client : forgeable. Mitigation : limites par IP aussi, attestation d'appareil (Play Integrity / App Attest) **non faite**, à traiter en 011.
