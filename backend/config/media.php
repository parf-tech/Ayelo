<?php

// Notes vocales et vidéos en conversation : fermées tant que le conteneur `transcode` (ffmpeg, sans réseau) n'est pas déployé.
// Un fichier audio ou vidéo n'est jamais servi tel que déposé : il est réencodé sans métadonnées, durée et taille vérifiées,
// puis relu par un modérateur (docs/14-DEPLOYMENT.md, docs/runbooks/transcode.md).
$chatAv = (bool) env('MEDIA_CHAT_AV_ENABLED', false);

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

    // Délais du client S3 (secondes) : sans eux, un stockage qui ne répond pas garde un processus PHP-FPM jusqu'à
    // `request_terminate_timeout` (60 s, infra/php/php-fpm-pool.conf). 20 s couvrent la lecture d'une image de 8 Mo.
    'http' => [
        'connect_timeout' => (float) env('MEDIA_CONNECT_TIMEOUT', 3),
        'timeout' => (float) env('MEDIA_HTTP_TIMEOUT', 20),
    ],
    // Nouvelles tentatives du SDK après un échec transitoire (5xx, réseau). Défaut du SDK : 3, soit jusqu'à 4 x 20 s = 80 s,
    // au-delà de la limite de 60 s de PHP-FPM. 1 : au plus 2 x 20 s.
    'retries' => (int) env('MEDIA_RETRIES', 1),

    'upload_ttl_minutes' => 5,

    // Revue pentest P-07 : signer `content-length` et `content-type` dans l'URL présignée de dépôt (le SDK ne le fait pas par défaut).
    // Désactivé par défaut tant que le stockage réel (R2) n'a pas été essayé ; la suppression des dépôts hors norme
    // (`media:purge-oversized`) s'applique dans tous les cas.
    'sign_upload_headers' => (bool) env('MEDIA_SIGN_UPLOAD_HEADERS', false),
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
        // `enabled` : ouvert seulement avec MEDIA_CHAT_AV_ENABLED. `transcode` : traitement obligatoire avant la revue humaine.
        // `max_seconds` : durée vérifiée sur le résultat du traitement (ffprobe), pas seulement sur la déclaration du client.
        'message_voice' => [
            'enabled' => $chatAv, 'transcode' => 'audio',
            'mimes' => ['audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg'],
            'max_bytes' => 5 * 1024 * 1024, 'max_seconds' => 120, 'max_open' => 50, 'max_per_day' => 100,
        ],
        'message_video' => [
            'enabled' => $chatAv, 'transcode' => 'video',
            'mimes' => ['video/mp4', 'video/quicktime'],
            'max_bytes' => 50 * 1024 * 1024, 'max_seconds' => 30, 'max_open' => 10, 'max_per_day' => 20,
        ],
    ],

    // Traitement des notes vocales et vidéos par le conteneur `transcode` : dossier partagé (volume), sans réseau.
    // `timeout_seconds` : au-delà, le média est refusé (le conteneur a sa propre limite de durée par fichier, plus courte).
    // `poll_seconds` : intervalle entre deux regards de la tâche, qui n'occupe aucun worker entre-temps.
    'transcode' => [
        'spool' => env('MEDIA_TRANSCODE_SPOOL', '/spool'),
        'timeout_seconds' => (int) env('MEDIA_TRANSCODE_TIMEOUT', 300),
        'poll_seconds' => (int) env('MEDIA_TRANSCODE_POLL', 5),
        // Marge sur la durée maximale d'un type (secondes) : le réencodage arrondit à l'image ou au paquet près.
        'duration_tolerance_seconds' => 2,
    ],

    // Types prévus plus tard (non ouverts) : profile_video, story, invite_video. (Les notes vocales et vidéos de conversation
    // sont dans `kinds`, derrière `enabled`.)
    'deferred_kinds' => ['profile_video', 'story', 'invite_video'],

    // Balayage des objets sans ligne en base (revue N-14) : délai de grâce (heures, bien supérieur au délai de dépôt et
    // à la fenêtre entre l'écriture de l'objet et celle de la ligne) et plafond de suppressions par passage.
    'orphan_grace_hours' => 48,
    'orphan_sweep_max' => 5000,
    // Dépôts en attente contrôlés par passage de media:purge-oversized (les plus récents d'abord, par lots de 500).
    'purge_oversized_max' => 2000,

    // Dépôts jamais finalisés : supprimés après ce délai (heures).
    'pending_ttl_hours' => 24,

    // Décodage et ré-encodage des images hors du processus web (revue N-14) : un processus PHP jetable lance
    // `artisan media:sanitize-stdin` avec un plafond de mémoire et de temps ; tout incident = fichier refusé.
    // Actif par défaut, sauf sous APP_ENV=testing (les tests appellent le nettoyeur dans le processus courant).
    'isolate_processing' => (bool) env('MEDIA_ISOLATE_PROCESSING', env('APP_ENV') !== 'testing'),
    'process_timeout_seconds' => (int) env('MEDIA_PROCESS_TIMEOUT', 10),
    'process_memory_limit' => env('MEDIA_PROCESS_MEMORY_LIMIT', '256M'),
];
