<?php

return [
    /*
     | Stockage objet compatible S3 (Cloudflare R2). Les secrets viennent de l'environnement, jamais du dépôt.
     */
    'disk' => [
        'endpoint' => env('MEDIA_ENDPOINT'),
        'bucket' => env('MEDIA_BUCKET'),
        'key' => env('MEDIA_ACCESS_KEY'),
        'secret' => env('MEDIA_SECRET_KEY'),
        'region' => env('MEDIA_REGION', 'auto'),
    ],

    'upload_ttl_minutes' => 5,
    'read_ttl_minutes' => 10,

    // Tant qu'aucun prestataire de modération n'est branché (ADR 005), tout média passe en file de revue humaine.
    // true uniquement en développement local.
    'auto_approve' => (bool) env('MEDIA_AUTO_APPROVE', false),

    'max_profile_photos' => 6,

    // Types ouverts au lancement : IMAGES uniquement. Chaque image est relue, ré-encodée et débarrassée de ses métadonnées
    // (EXIF, GPS) à la fin de l'envoi. Les vidéos et l'audio restent fermés tant qu'aucun traitement équivalent
    // (ffmpeg -map_metadata -1, transcodage) n'existe : voir specs/012 et docs/reviews/code-security-1.md (F-05).
    // `max_open` : dépôts en attente ou en revue en même temps ; `max_per_day` : dépôts créés sur 24 h glissantes (revue F-22).
    'kinds' => [
        'profile_photo' => ['mimes' => ['image/jpeg', 'image/png', 'image/webp'], 'max_bytes' => 8 * 1024 * 1024, 'max_open' => 6, 'max_per_day' => 12],
        'message_image' => ['mimes' => ['image/jpeg', 'image/png', 'image/webp'], 'max_bytes' => 8 * 1024 * 1024, 'max_open' => 50, 'max_per_day' => 100],
        'verification_selfie' => ['mimes' => ['image/jpeg', 'image/png'], 'max_bytes' => 8 * 1024 * 1024, 'max_open' => 3, 'max_per_day' => 5],
    ],

    // Types prévus plus tard (non ouverts) : profile_video, message_video, message_voice, story, invite_video.
    'deferred_kinds' => ['profile_video', 'message_video', 'message_voice', 'story', 'invite_video'],

    // Balayage des objets sans ligne en base (revue N-14) : délai de grâce (heures, bien supérieur au délai de dépôt et
    // à la fenêtre entre l'écriture de l'objet et celle de la ligne) et plafond de suppressions par passage.
    'orphan_grace_hours' => 48,
    'orphan_sweep_max' => 5000,

    // Dépôts jamais finalisés : supprimés après ce délai (heures).
    'pending_ttl_hours' => 24,
];
