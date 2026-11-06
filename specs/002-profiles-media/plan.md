# Plan 002 : Profils et médias

- Routes : `backend/routes/api/profile.php` ; contrôleurs `ProfileController`, `PublicProfileController`, `MediaController`
- Politiques : `ProfilePolicy` (visibilité), `MediaPolicy` (propriétaire)
- Services : `ProfilePresenter` (représentation soi / public), `Storage/MediaStorage` (interface) + `S3MediaStorage` (Cloudflare R2), `config/media.php` (types, tailles, durées)
- Schéma : `profiles`, `preferences`, `media` (index unique des positions de photos, 0..11 pour réordonner)
- Décisions : ADR 005 (modération par file humaine, `MEDIA_AUTO_APPROVE` faux par défaut). Réordonnancement en deux mises à jour (+6 puis position finale) à cause de l'index unique.
- Risques : R2 jamais appelé pour de vrai ; ses limites de présignature sont à vérifier dans la documentation Cloudflare.
