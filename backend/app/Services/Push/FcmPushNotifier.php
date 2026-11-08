<?php

namespace App\Services\Push;

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Notifications via FCM HTTP v1 (gratuit). Le compte de service est lu depuis l'environnement
 * (FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY) : aucun secret dans le dépôt.
 */
class FcmPushNotifier implements PushNotifier
{
    public function send(string $platform, string $token, string $title, string $body, array $data = []): bool
    {
        $project = config('services.fcm.project_id');
        if (! $project || ! config('services.fcm.client_email') || ! config('services.fcm.private_key')) {
            Log::info('push ignoré : FCM non configuré', ['platform' => $platform]);

            return true;
        }

        // Sur iOS, le jeton natif est un jeton APNs (64 caractères hexadécimaux ou plus), que FCM refuse
        // (INVALID_ARGUMENT). On ne le supprime pas : il deviendra valide quand l'app enverra un jeton FCM
        // (voir docs/runbooks/fcm.md, section iOS).
        if ($platform === 'ios' && preg_match('/\A[0-9a-f]{64,}\z/i', $token) === 1) {
            Log::warning('push iOS ignoré : jeton APNs, pas un jeton FCM');

            return true;
        }

        try {
            $response = Http::withToken($this->accessToken())->timeout(5)->post("https://fcm.googleapis.com/v1/projects/$project/messages:send", [
                'message' => [
                    'token' => $token,
                    'notification' => ['title' => $title, 'body' => $body],
                    'data' => array_map('strval', $data),
                    'android' => ['priority' => 'high'],
                    'apns' => ['headers' => ['apns-priority' => '10']],
                ],
            ]);
        } catch (\Throwable $e) {
            // Compte de service refusé, clé mal formée, réseau : jamais de secret dans le journal.
            Cache::forget('fcm.access_token');
            Log::critical('push FCM impossible', ['platform' => $platform, 'exception' => $e::class]);

            return true;
        }

        if ($response->status() === 401 || $response->status() === 403) {
            Cache::forget('fcm.access_token');
            Log::critical('push FCM refusé : vérifier le compte de service et l\'API Firebase Cloud Messaging', ['status' => $response->status()]);

            return true;
        }

        if ($response->status() === 404 || ($response->status() === 400 && str_contains((string) $response->body(), 'INVALID_ARGUMENT'))) {
            return false;
        }

        return true;
    }

    private function accessToken(): string
    {
        return Cache::remember('fcm.access_token', 3000, function () {
            $now = time();
            $assertion = JWT::encode([
                'iss' => config('services.fcm.client_email'),
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud' => 'https://oauth2.googleapis.com/token',
                'iat' => $now,
                'exp' => $now + 3600,
            ], str_replace('\n', "\n", (string) config('services.fcm.private_key')), 'RS256');

            $res = Http::asForm()->timeout(5)->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $assertion,
            ]);
            $res->throw();

            return (string) $res->json('access_token');
        });
    }
}
