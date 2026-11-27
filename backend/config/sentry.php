<?php

use App\Logging\SentryScrubber;

/*
 * Suivi d'erreurs Sentry côté serveur (docs/runbooks/observabilite.md). FERMÉ tant que SENTRY_LARAVEL_DSN est vide : aucun
 * envoi. Seules la clé, l'environnement, la version et l'échantillonnage des erreurs se règlent par variable ; tout ce qui
 * touche aux données personnelles est écrit ici en dur, pour qu'aucune variable d'environnement ne puisse l'ouvrir.
 * Le fichier du paquet complète les clés de premier niveau absentes : ne pas retirer une clé « fermée » d'ici.
 */
return [

    'dsn' => env('SENTRY_LARAVEL_DSN') ?: null,

    'release' => env('SENTRY_RELEASE'),

    // Vide = APP_ENV.
    'environment' => env('SENTRY_ENVIRONMENT'),

    // Part des erreurs envoyées (1.0 = toutes).
    'sample_rate' => env('SENTRY_SAMPLE_RATE') === null ? 1.0 : (float) env('SENTRY_SAMPLE_RATE'),

    // Dernier filtre avant l'envoi. Tableau (et non fermeture) pour rester compatible avec config:cache.
    'before_send' => [SentryScrubber::class, 'beforeSend'],

    'send_default_pii' => false,
    'data_collection' => null,
    'max_request_body_size' => 'none',

    // Ni traces de performance, ni profils, ni journaux, ni métriques : erreurs seulement.
    'traces_sample_rate' => null,
    'profiles_sample_rate' => null,
    'enable_logs' => false,
    'enable_metrics' => false,

    // Aucune « miette » : requêtes, cache, e-mails et appels sortants porteraient des données de membres.
    'max_breadcrumbs' => 0,
    'breadcrumbs' => [
        'logs' => false,
        'cache' => false,
        'livewire' => false,
        'sql_queries' => false,
        'sql_bindings' => false,
        'queue_info' => false,
        'command_info' => false,
        'http_client_requests' => false,
        'notifications' => false,
    ],

    // L'envoi suit la réponse au client ; un Sentry lent ne doit pas retenir longtemps un processus PHP-FPM ou un worker.
    'http_connect_timeout' => 1.0,
    'http_timeout' => 2.0,

    'ignore_transactions' => ['/up'],

];
