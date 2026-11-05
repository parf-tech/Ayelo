<?php

namespace App\Services\OAuth;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Vérifie la signature RS256 (clés publiques JWKS du fournisseur), l'émetteur, l'audience et
 * l'expiration d'un id_token. Aucun secret : seuls les identifiants d'application publics sont configurés.
 */
class JwtOAuthVerifier implements OAuthVerifier
{
    public function verify(string $provider, string $idToken): OAuthIdentity
    {
        $config = config("services.oauth.$provider");
        if (! is_array($config) || empty($config['client_ids'])) {
            throw new InvalidOAuthToken("Fournisseur $provider non configuré.");
        }

        try {
            $claims = (array) JWT::decode($idToken, JWK::parseKeySet($this->jwks($config['jwks_url'])));
        } catch (Throwable $e) {
            throw new InvalidOAuthToken('Jeton invalide.', 0, $e);
        }

        if (! in_array($claims['iss'] ?? '', $config['issuers'], true)) {
            throw new InvalidOAuthToken('Émetteur inattendu.');
        }

        $aud = (array) ($claims['aud'] ?? []);
        if (array_intersect($aud, $config['client_ids']) === []) {
            throw new InvalidOAuthToken('Audience inattendue.');
        }

        $sub = (string) ($claims['sub'] ?? '');
        if ($sub === '') {
            throw new InvalidOAuthToken('Sujet manquant.');
        }

        $verified = $claims['email_verified'] ?? false;

        return new OAuthIdentity(
            provider: $provider,
            subject: $sub,
            email: isset($claims['email']) ? strtolower((string) $claims['email']) : null,
            emailVerified: $verified === true || $verified === 'true',
        );
    }

    /** @return array<string, mixed> */
    private function jwks(string $url): array
    {
        return Cache::remember('oauth.jwks.'.md5($url), 3600, function () use ($url) {
            $response = Http::timeout(5)->get($url);
            $response->throw();

            return $response->json();
        });
    }
}
