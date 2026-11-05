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

    // Limites par type : mimes autorisés, poids maximal (octets), durée maximale (secondes).
    'kinds' => [
        'profile_photo' => ['mimes' => ['image/jpeg', 'image/png', 'image/webp'], 'max_bytes' => 8 * 1024 * 1024],
        'profile_video' => ['mimes' => ['video/mp4'], 'max_bytes' => 50 * 1024 * 1024, 'max_seconds' => 60],
        'message_image' => ['mimes' => ['image/jpeg', 'image/png', 'image/webp'], 'max_bytes' => 8 * 1024 * 1024],
        'message_video' => ['mimes' => ['video/mp4'], 'max_bytes' => 30 * 1024 * 1024, 'max_seconds' => 30],
        'message_voice' => ['mimes' => ['audio/mp4', 'audio/aac', 'audio/mpeg'], 'max_bytes' => 5 * 1024 * 1024, 'max_seconds' => 120],
        'story' => ['mimes' => ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'], 'max_bytes' => 30 * 1024 * 1024, 'max_seconds' => 15],
        'invite_video' => ['mimes' => ['video/mp4'], 'max_bytes' => 50 * 1024 * 1024, 'max_seconds' => 60],
        'verification_selfie' => ['mimes' => ['image/jpeg', 'image/png'], 'max_bytes' => 8 * 1024 * 1024],
    ],
];
