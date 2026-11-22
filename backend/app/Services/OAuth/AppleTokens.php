<?php

namespace App\Services\OAuth;

use Firebase\JWT\JWT;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Jetons « Se connecter avec Apple » : échange du code d'autorisation à la connexion, révocation à la suppression du compte
 * (exigence d'Apple). Le secret client est un JWT ES256 signé avec la clé .p8 du compte développeur (APPLE_TEAM_ID, APPLE_KEY_ID,
 * APPLE_PRIVATE_KEY) ; sans cette configuration, rien n'est échangé ni révoqué.
 *
 * Jamais essayé contre le vrai service : les tests (AppleRevocationTest) simulent les réponses d'Apple.
 */
class AppleTokens
{
    private const TOKEN_URL = 'https://appleid.apple.com/auth/token';

    private const REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

    private const AUDIENCE = 'https://appleid.apple.com';

    public function configured(): bool
    {
        $config = (array) config('services.oauth.apple');

        return $this->clientId() !== null && filled($config['team_id'] ?? null) && filled($config['key_id'] ?? null) && filled($config['private_key'] ?? null);
    }

    /**
     * Échange le code d'autorisation de la connexion et garde le jeton de rafraîchissement chiffré. Ne bloque jamais la connexion :
     * configuration absente, Apple en panne ou code refusé se terminent en silence (journalisés, sans le code ni le jeton).
     */
    public function remember(string $userId, string $subject, string $authorizationCode): void
    {
        if (! $this->configured()) {
            return;
        }

        try {
            $response = Http::asForm()->timeout(5)->post(self::TOKEN_URL, [
                'client_id' => $this->clientId(),
                'client_secret' => $this->clientSecret(),
                'code' => $authorizationCode,
                'grant_type' => 'authorization_code',
            ]);
        } catch (ConnectionException $e) {
            Log::warning('Apple : échange du code impossible', ['error' => $e::class]);

            return;
        }

        $token = $response->successful() ? $response->json('refresh_token') : null;
        if (! is_string($token) || $token === '') {
            Log::warning('Apple : code d\'autorisation refusé ou sans jeton', ['status' => $response->status()]);

            return;
        }

        DB::table('auth_identities')->where('user_id', $userId)->where('provider', 'apple')->where('provider_user_id', $subject)
            ->update(['provider_refresh_token' => Crypt::encryptString($token), 'updated_at' => now()]);
    }

    /**
     * Révoque un jeton de rafraîchissement. Un jeton déjà révoqué (invalid_grant, par exemple depuis les réglages Apple de la
     * personne) compte comme révoqué.
     *
     * @throws AppleRevocationFailed
     */
    public function revoke(string $refreshToken): void
    {
        try {
            $response = Http::asForm()->timeout(10)->post(self::REVOKE_URL, [
                'client_id' => $this->clientId(),
                'client_secret' => $this->clientSecret(),
                'token' => $refreshToken,
                'token_type_hint' => 'refresh_token',
            ]);
        } catch (ConnectionException $e) {
            throw new AppleRevocationFailed('connexion impossible', 0, $e);
        }

        if ($response->successful() || ($response->status() === 400 && $response->json('error') === 'invalid_grant')) {
            return;
        }

        throw new AppleRevocationFailed('statut '.$response->status());
    }

    /** Identifiant d'application utilisé par Apple pour le jeton : le premier de APPLE_CLIENT_IDS (l'identifiant de l'application iOS). */
    private function clientId(): ?string
    {
        $ids = array_values((array) config('services.oauth.apple.client_ids', []));

        return $ids[0] ?? null;
    }

    private function clientSecret(): string
    {
        $now = time();

        return JWT::encode([
            'iss' => config('services.oauth.apple.team_id'),
            'iat' => $now,
            'exp' => $now + 300,
            'aud' => self::AUDIENCE,
            'sub' => $this->clientId(),
        ], (string) config('services.oauth.apple.private_key'), 'ES256', (string) config('services.oauth.apple.key_id'));
    }
}
