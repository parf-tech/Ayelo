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

    // Connexion avec Google / Apple : seuls des identifiants d'application PUBLICS sont configurés.
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
        ],
    ],

    // Notifications FCM (compte de service) : valeurs lues dans l'environnement uniquement.
    'fcm' => [
        'project_id' => env('FCM_PROJECT_ID'),
        'client_email' => env('FCM_CLIENT_EMAIL'),
        'private_key' => env('FCM_PRIVATE_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
