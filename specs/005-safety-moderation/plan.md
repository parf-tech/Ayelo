# Plan 005 : Sécurité et modération

- Routes : `routes/api/discovery.php` (blocks, reports, sanctions, appeals) ; contrôleurs `BlockController`, `ReportController`, `SanctionController`
- Schéma : `reports` (priorité, preuve conservée un an), `sanctions`, `appeals`, `risk_events`, `blocks` ; clés `restrict` pour garder les preuves après suppression de compte
- Interface d'administration : voir 009
- Décisions : 404 identiques ; signalement sans doublon par (auteur, cible, motif) tant qu'il est ouvert.
- Risques : abus du signalement « mineur suspecté » ; modération humaine non budgétée ; procédure de signalement aux autorités à définir avec un juriste.
