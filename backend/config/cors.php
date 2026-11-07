<?php

/*
 | CORS (revue pentest P-08/P-15, lot infra). Seul le site public statique (web/) appelle l'API depuis un navigateur, et
 | uniquement pour les deux formulaires de suppression de compte. L'application mobile n'est pas un navigateur : elle
 | n'a pas besoin de CORS. Tout le reste de l'API reste donc SANS en-tête CORS (un navigateur tiers ne peut pas lire
 | les réponses).
 |
 | Origine autorisée : CORS_ALLOWED_ORIGINS (origines complètes séparées par des virgules), à défaut l'origine de
 | APP_WEB_URL. Jamais de joker, jamais de cookies ni d'identifiants (supports_credentials = false).
 | `api/account-deletion-requests*` est listé aussi sans `v1` : le préfixe réel des routes est api/v1 (routes/api.php).
 */

$origins = array_values(array_unique(array_filter(array_map(function (string $value): string {
    $parts = parse_url(trim($value));
    if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
        return '';
    }

    // Une origine = schéma + hôte (+ port) ; le chemin éventuel de l'URL est ignoré.
    return strtolower($parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : ''));
}, explode(',', (string) (env('CORS_ALLOWED_ORIGINS') ?: env('APP_WEB_URL', '')))))));

return [

    'paths' => [
        'api/v1/account-deletion-requests',
        'api/v1/account-deletion-requests/*',
        'api/account-deletion-requests',
        'api/account-deletion-requests/*',
    ],

    'allowed_methods' => ['POST', 'OPTIONS'],

    'allowed_origins' => $origins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type'],

    'exposed_headers' => [],

    'max_age' => 600,

    'supports_credentials' => false,

];
