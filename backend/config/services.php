<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Connexion avec Google / Apple : les identifiants d'application sont PUBLICS. Seule exception, la clé privée Apple (.p8), un
    // secret, lue dans l'environnement uniquement : elle signe le secret client qui permet de révoquer le jeton Apple d'un compte
    // supprimé (App\Services\OAuth\AppleTokens). Sans APPLE_TEAM_ID, APPLE_KEY_ID et APPLE_PRIVATE_KEY, aucune révocation n'a lieu.
    'oauth' => [
        'google' => [
            'client_ids' => array_filter(explode(',', (string) env('GOOGLE_CLIENT_IDS', ''))),
            'issuers' => ['https://accounts.google.com', 'accounts.google.com'],
            'jwks_url' => 'https://www.googleapis.com/oauth2/v3/certs',
        ],
        'apple' => [
            'client_ids' => array_filter(explode(',', (string) env('APPLE_CLIENT_IDS', ''))),
            'issuers' => ['https://appleid.apple.com'],
            'jwks_url' => 'https://appleid.apple.com/auth/keys',
            'team_id' => env('APPLE_TEAM_ID'),
            'key_id' => env('APPLE_KEY_ID'),
            // Contenu de la clé .p8 ; les retours à la ligne s'écrivent \n dans le fichier d'environnement.
            'private_key' => str_replace('\n', "\n", (string) env('APPLE_PRIVATE_KEY', '')),
        ],
    ],

    // Notifications FCM (compte de service) : valeurs lues dans l'environnement uniquement.
    'fcm' => [
        'project_id' => env('FCM_PROJECT_ID'),
        'client_email' => env('FCM_CLIENT_EMAIL'),
        'private_key' => env('FCM_PRIVATE_KEY'),
    ],

    // Webhooks de rebond / plainte du prestataire d'e-mail. Deux authentifications, jamais mélangées :
    //  - Resend signe ses envois avec Svix (en-têtes svix-id, svix-timestamp, svix-signature) et ne permet pas d'ajouter un
    //    en-tête : `svix_secret` est le « signing secret » du webhook (whsec_...) ;
    //  - Postmark : secret partagé envoyé dans X-Mail-Webhook-Secret (ou Authorization: Bearer), `secret`.
    // Un secret vide ferme la voie correspondante (401). Voir docs/runbooks/email-dns.md.
    'mail_webhook' => [
        'secret' => env('MAIL_WEBHOOK_SECRET'),
        'svix_secret' => env('MAIL_WEBHOOK_SVIX_SECRET'),
    ],

    // LiveKit : la clé et le secret d'API ne quittent jamais le serveur ; le client reçoit un jeton de 10 minutes.
    'livekit' => [
        'url' => env('LIVEKIT_URL'),
        'api_key' => env('LIVEKIT_API_KEY'),
        'api_secret' => env('LIVEKIT_API_SECRET'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
