<?php

/*
 | Origines autorisées à ouvrir une connexion WebSocket (F-17, revue de sécurité). Valeur : REVERB_ALLOWED_ORIGINS, hôtes séparés par des
 | virgules (jokers acceptés, ex. *.example.com ; « * » rétablit l'ancien comportement ouvert). Par défaut : l'hôte du site web
 | (APP_WEB_URL, à défaut APP_URL) et REVERB_HOST (l'application mobile envoie comme Origin l'hôte de l'URL WebSocket).
 |
 | Comportement de Reverb (Protocols/Pusher/Server::verifyOrigin) : seul l'HÔTE de l'en-tête Origin est comparé (port et schéma ignorés,
 | Str::is avec jokers) ; un Origin ABSENT est traité comme une chaîne vide, donc REFUSÉ (erreur Pusher 4009) dès que « * » n'est pas listé.
 | Il n'existe pas de réglage pour accepter l'absence d'Origin : ne jamais compenser avec « * ».
 | Application mobile (React Native 0.88, pusher-js 8.6) : Android ajoute lui-même Origin = http(s)://REVERB_HOST[:port] (WebSocketModule.kt),
 | iOS (SocketRocket) le fait aussi ; donc REVERB_HOST DOIT figurer dans la liste. Si REVERB_ALLOWED_ORIGINS est renseignée, y inclure
 | REVERB_HOST, sinon le temps réel mobile est refusé (repli sur le rafraîchissement périodique). Un export Expo Web ajoute l'hôte de la page.
 | L'Origin protège les navigateurs (détournement de WebSocket entre sites) ; un client natif peut l'usurper, l'autorisation des canaux
 | privés (/broadcasting/auth) reste la vraie barrière.
 */
$reverbOrigins = array_values(array_filter(array_map('trim', explode(',', (string) env('REVERB_ALLOWED_ORIGINS', '')))));
if ($reverbOrigins === []) {
    $reverbOrigins = array_values(array_unique(array_filter([
        parse_url((string) env('APP_WEB_URL', env('APP_URL', 'http://localhost')), PHP_URL_HOST) ?: null,
        env('REVERB_HOST') ?: null,
    ])));
}

return [

    /*
    |--------------------------------------------------------------------------
    | Default Reverb Server
    |--------------------------------------------------------------------------
    |
    | This option controls the default server used by Reverb to handle
    | incoming messages as well as broadcasting message to all your
    | connected clients. At this time only "reverb" is supported.
    |
    */

    'default' => env('REVERB_SERVER', 'reverb'),

    /*
    |--------------------------------------------------------------------------
    | Reverb Servers
    |--------------------------------------------------------------------------
    |
    | Here you may define details for each of the supported Reverb servers.
    | Each server has its own configuration options that are defined in
    | the array below. You should ensure all the options are present.
    |
    */

    'servers' => [

        'reverb' => [
            'host' => env('REVERB_SERVER_HOST', '0.0.0.0'),
            'port' => env('REVERB_SERVER_PORT', 8080),
            'path' => env('REVERB_SERVER_PATH', ''),
            'hostname' => env('REVERB_HOST'),
            'options' => [
                'tls' => [],
            ],
            'max_request_size' => env('REVERB_MAX_REQUEST_SIZE', 10_000),
            'scaling' => [
                'enabled' => env('REVERB_SCALING_ENABLED', false),
                'channel' => env('REVERB_SCALING_CHANNEL', 'reverb'),
                'server' => [
                    'url' => env('REDIS_URL'),
                    'host' => env('REDIS_HOST', '127.0.0.1'),
                    'port' => env('REDIS_PORT', '6379'),
                    'username' => env('REDIS_USERNAME'),
                    'password' => env('REDIS_PASSWORD'),
                    'database' => env('REDIS_DB', '0'),
                    'timeout' => env('REDIS_TIMEOUT', 60),
                ],
            ],
            'pulse_ingest_interval' => env('REVERB_PULSE_INGEST_INTERVAL', 15),
            'telescope_ingest_interval' => env('REVERB_TELESCOPE_INGEST_INTERVAL', 15),
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Reverb Applications
    |--------------------------------------------------------------------------
    |
    | Here you may define how Reverb applications are managed. If you choose
    | to use the "config" provider, you may define an array of apps which
    | your server will support, including their connection credentials.
    |
    */

    'apps' => [

        'provider' => 'config',

        'apps' => [
            [
                'key' => env('REVERB_APP_KEY'),
                'secret' => env('REVERB_APP_SECRET'),
                'app_id' => env('REVERB_APP_ID'),
                'options' => [
                    'host' => env('REVERB_HOST'),
                    'port' => env('REVERB_PORT', 443),
                    'scheme' => env('REVERB_SCHEME', 'https'),
                    'useTLS' => env('REVERB_SCHEME', 'https') === 'https',
                ],
                'allowed_origins' => $reverbOrigins,
                'ping_interval' => env('REVERB_APP_PING_INTERVAL', 60),
                'activity_timeout' => env('REVERB_APP_ACTIVITY_TIMEOUT', 30),
                'max_connections' => env('REVERB_APP_MAX_CONNECTIONS'),
                'max_message_size' => env('REVERB_APP_MAX_MESSAGE_SIZE', 10_000),
                'accept_client_events_from' => env('REVERB_APP_ACCEPT_CLIENT_EVENTS_FROM', 'members'),
                'rate_limiting' => [
                    'enabled' => env('REVERB_APP_RATE_LIMITING_ENABLED', false),
                    'max_attempts' => env('REVERB_APP_RATE_LIMIT_MAX_ATTEMPTS', 60),
                    'decay_seconds' => env('REVERB_APP_RATE_LIMIT_DECAY_SECONDS', 60),
                    'terminate_on_limit' => env('REVERB_APP_RATE_LIMIT_TERMINATE', false),
                ],
            ],
        ],

    ],

];
