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

$config = [

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

/*
 | Aperçu local (docs/runbooks/apercu-local.md) : l'aperçu web Expo (navigateur) appelle l'API depuis une autre origine.
 | Branche STRICTEMENT réservée à APP_ENV=local ET à une liste CORS_DEV_ORIGINS non vide (vide par défaut). Pendant le
 | chargement de la configuration l'environnement de l'application n'est pas encore détecté : on se rabat alors sur APP_ENV.
 | En production (ou tout autre environnement), cette branche ne s'exécute jamais et la configuration ci-dessus reste intacte.
 */
$isLocal = app()->bound('env') ? app()->environment('local') : env('APP_ENV') === 'local';
$devOrigins = $isLocal
    ? array_values(array_unique(array_filter(array_map(function (string $value): string {
        $parts = parse_url(trim($value));

        return is_array($parts) && ! empty($parts['scheme']) && ! empty($parts['host'])
            ? strtolower($parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : ''))
            : '';
    }, explode(',', (string) env('CORS_DEV_ORIGINS', ''))))))
    : [];

if ($devOrigins !== []) {
    $config['paths'] = ['api/*'];
    $config['allowed_methods'] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
    $config['allowed_origins'] = array_values(array_unique(array_merge($config['allowed_origins'], $devOrigins)));
    $config['allowed_headers'] = ['Content-Type', 'Accept', 'Accept-Language', 'Authorization', 'X-Device-Id', 'Idempotency-Key', 'X-Requested-With'];
}

return $config;
