<?php

namespace App\Support;

/**
 * Contrôle de la configuration avant une mise en production (`php artisan deploy:preflight`, appelé par infra/scripts/deploy.sh).
 *
 * L'application démarre même si ces valeurs manquent (un démarrage interrompu casserait le build de l'image et `config:cache`),
 * et l'erreur n'apparaîtrait qu'au premier dépôt de photo ou au premier export. Ce contrôle les révèle AVANT le trafic.
 *
 * - `errors` : le déploiement s'arrête.
 * - `warnings` : le déploiement continue ; une fonction facultative est absente ou une protection est désactivée.
 *
 * Chaque message nomme la variable d'environnement à corriger. Jamais de valeur : les secrets ne sont ni affichés ni journalisés.
 */
final class DeployPreflight
{
    /** @return array{errors: list<string>, warnings: list<string>} */
    public static function inspect(): array
    {
        $errors = [];
        $warnings = [];

        if (config('app.env') !== 'production') {
            $errors[] = 'APP_ENV doit valoir production.';
        }
        if (config('app.debug')) {
            $errors[] = 'APP_DEBUG doit valoir false (le mode debug expose traces et variables).';
        }
        if (self::blank(config('app.key'))) {
            $errors[] = 'APP_KEY est vide (php artisan key:generate --show, à conserver hors du dépôt).';
        }
        if (! str_starts_with((string) config('app.url'), 'https://')) {
            $errors[] = 'APP_URL doit commencer par https://.';
        }
        if (self::blank(config('app.admin_domain'))) {
            $errors[] = 'ADMIN_DOMAIN est vide : le panneau d\'administration serait servi sur tous les domaines.';
        }
        if (config('database.default') !== 'pgsql') {
            $errors[] = 'DB_CONNECTION doit valoir pgsql.';
        }
        if (config('queue.default') === 'sync') {
            $errors[] = 'QUEUE_CONNECTION=sync : les e-mails, notifications et exports s\'exécuteraient dans la requête (utiliser redis).';
        }
        if (self::blank(config('safety.state_store'))) {
            $errors[] = 'SAFETY_STATE_STORE est vide : jeton d\'âge, compteurs de ré-authentification et consigne de pose resteraient dans un cache évincable (valeur : state).';
        }

        $endpoint = (string) config('media.disk.endpoint');
        if ($endpoint === '') {
            $errors[] = 'MEDIA_ENDPOINT est vide (stockage objet : https://<compte>.r2.cloudflarestorage.com).';
        } elseif (! str_starts_with($endpoint, 'https://')) {
            $errors[] = 'MEDIA_ENDPOINT doit commencer par https://.';
        }
        foreach (['bucket' => 'MEDIA_BUCKET', 'key' => 'MEDIA_ACCESS_KEY', 'secret' => 'MEDIA_SECRET_KEY'] as $key => $variable) {
            if (self::blank(config('media.disk.'.$key))) {
                $errors[] = $variable.' est vide (stockage objet).';
            }
        }
        if (config('media.auto_approve')) {
            $errors[] = 'MEDIA_AUTO_APPROVE doit valoir false : aucun prestataire de modération n\'est branché, tout média passe en revue humaine.';
        }

        if (! config('media.sign_upload_headers')) {
            $warnings[] = 'MEDIA_SIGN_UPLOAD_HEADERS=false : la taille et le type d\'un dépôt ne sont pas liés à l\'URL présignée (media:purge-oversized supprime les dépôts hors norme toutes les 5 minutes). Signature vérifiée contre R2 le 2026-11-19 ; à passer à true après un dépôt d\'essai depuis l\'application mobile.';
        }
        if (self::blank(config('billing.webhook_secret'))) {
            $warnings[] = 'REVENUECAT_WEBHOOK_SECRET est vide : le webhook de facturation répond 401, aucun abonnement n\'est appliqué.';
        }
        foreach (['project_id' => 'FCM_PROJECT_ID', 'client_email' => 'FCM_CLIENT_EMAIL', 'private_key' => 'FCM_PRIVATE_KEY'] as $key => $variable) {
            if (self::blank(config('services.fcm.'.$key))) {
                $warnings[] = $variable.' est vide : les notifications push sont désactivées.';
            }
        }
        foreach (['url' => 'LIVEKIT_URL', 'api_key' => 'LIVEKIT_API_KEY', 'api_secret' => 'LIVEKIT_API_SECRET'] as $key => $variable) {
            if (self::blank(config('services.livekit.'.$key))) {
                $warnings[] = $variable.' est vide : les appels ne peuvent pas être établis.';
            }
        }
        if (self::blank(config('services.mail_webhook.secret'))) {
            $warnings[] = 'MAIL_WEBHOOK_SECRET est vide : les rebonds et plaintes d\'e-mail ne sont pas reçus (route fermée).';
        }
        foreach (['google' => 'GOOGLE_CLIENT_IDS', 'apple' => 'APPLE_CLIENT_IDS'] as $provider => $variable) {
            if (self::blank(config('services.oauth.'.$provider.'.client_ids'))) {
                $warnings[] = $variable.' est vide : la connexion '.ucfirst($provider).' est refusée.';
            }
        }

        return ['errors' => $errors, 'warnings' => $warnings];
    }

    private static function blank(mixed $value): bool
    {
        return $value === null || $value === '' || $value === [];
    }
}
