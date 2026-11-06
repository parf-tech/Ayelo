# Plan 008 : Appels

- Routes : `routes/api/calls.php` ; `CallController` ; services `Calls`, `LiveKitTokens` ; événement `CallEvent` ; commande planifiée `calls:expire` (chaque minute)
- Schéma : `call_sessions` (statuts ringing, accepted, declined, missed, busy, ended, failed), `devices.voip_push_token`
- Décisions : ADR 004 (LiveKit Cloud au départ, 5 000 minutes-participant gratuites par mois d'après la grille lue le 2026-11-05).
- Mobile : interface d'appel et `MediaEngine` abstrait ; le SDK LiveKit et CallKit exigent un **build de développement** et un Mac / iPhone (disponibles selon le propriétaire) plus un Android réel (à fournir).
- Risques : fonctionnalité la plus risquée techniquement ; coût LiveKit (voir `docs/14b-COSTS.md`).
