# Plan 009 : Administration

- Technologie : Filament (ADR 001), panneau `/admin` sous un sous-domaine séparé en production, garde `staff` sur `staff_users`.
- Périmètre de fichiers : `backend/app/Filament/**`, `app/Models/StaffUser.php`, `app/Services/Admin/**` (dont `Audit`), `config/auth.php` (garde staff), `backend/tests/Feature/Admin/**`.
- Réutilise les services existants : `ProfileVerification`, `Storage\MediaStorage`, `Premium`, règles de `ReportController`.
- Aucun changement de `docs/schema/001_initial.sql` sans passage par les tests du schéma.
- **État du dépôt** : l'agent a laissé `app/Models/StaffUser.php`, `app/Services/Admin/`, `config/auth.php` et `composer.json/lock` modifiés, **non commités et non vérifiés**. À relire avant reprise (voir tâches).
- Risques : rendu non vérifiable sans navigateur ; MFA intégré de Filament à relier aux colonnes `totp_secret_encrypted` et `recovery_codes_encrypted`.
