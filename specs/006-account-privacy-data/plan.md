# Plan 006 : Compte, vie privée et données

- Routes : `routes/api/account.php` ; contrôleurs `AccountController`, `SupportController`
- Services : `AccountDeletion` (demande, anonymisation, purge planifiée `accounts:purge` à 03:15), `DataExport` + job `BuildDataExport`, `OneTimeCodes` (canal `account_deletion`)
- Planification : `routes/console.php`
- Schéma : `data_exports`, `user_consents`, `support_tickets`, `banned_identifiers`
- Décisions : anonymisation (pas de suppression des lignes référencées par `reports`/`sanctions`) ; export sans mot de passe ni secrets.
- Risques : les sauvegardes conservent les données supprimées jusqu'à rotation (14 jours + 3 mensuelles) : écart avec « effacement sous 30 jours » à documenter dans la politique de confidentialité.
