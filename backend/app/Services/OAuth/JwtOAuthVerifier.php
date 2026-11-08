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
            $keys = $this->jwks($config['jwks_url']);
            // Rotation des clés du fournisseur (revue P-11) : un `kid` inconnu du cache déclenche UNE relecture du JWKS.
            $kid = $this->kid($idToken);
            if ($kid !== null && ! $this->hasKey($keys, $kid)) {
                $keys = $this->refreshJwks($config['jwks_url']) ?? $keys;
            }

            $claims = (array) JWT::decode($idToken, JWK::parseKeySet($keys));
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

        // Un jeton réel porte toujours `iat` (Google, Apple) : sans lui, la fraîcheur ne se vérifie pas, donc refus (revue F-21).
        $iat = $claims['iat'] ?? null;
        if (! is_int($iat) && ! (is_string($iat) && ctype_digit($iat))) {
            throw new InvalidOAuthToken('Date d\'émission manquante.');
        }

        $verified = $claims['email_verified'] ?? false;

        return new OAuthIdentity(
            provider: $provider,
            subject: $sub,
            email: isset($claims['email']) ? strtolower((string) $claims['email']) : null,
            emailVerified: $verified === true || $verified === 'true',
            issuedAt: (int) $iat,
            nonce: isset($claims['nonce']) && is_string($claims['nonce']) ? $claims['nonce'] : null,
        );
    }

    /** @return array<string, mixed> */
    private function jwks(string $url): array
    {
        return Cache::remember('oauth.jwks.'.md5($url), 3600, fn () => $this->fetch($url));
    }

    /** @return array<string, mixed> */
    private function fetch(string $url): array
    {
        $response = Http::timeout(5)->get($url);
        $response->throw();

        return $response->json();
    }

    /**
     * Relecture hors cache, au plus une fois par minute et par fournisseur (verrou atomique) : sans ce plafond, des
     * jetons à `kid` aléatoires feraient de nous un amplificateur de requêtes vers Google / Apple (revue P-11).
     * null = verrou pris ou fournisseur injoignable : on garde les clés en cache, le jeton sera refusé.
     *
     * @return array<string, mixed>|null
     */
    private function refreshJwks(string $url): ?array
    {
        $hash = md5($url);
        if (! Cache::add('oauth.jwks.refetch.'.$hash, 1, 60)) {
            return null;
        }

        try {
            $fresh = $this->fetch($url);
        } catch (Throwable $e) {
            return null;
        }

        if (! isset($fresh['keys']) || ! is_array($fresh['keys'])) {
            return null;
        }

        Cache::put('oauth.jwks.'.$hash, $fresh, 3600);

        return $fresh;
    }

    private function kid(string $idToken): ?string
    {
        $header = json_decode((string) base64_decode(strtr(explode('.', $idToken)[0], '-_', '+/'), false), true);

        return is_array($header) && isset($header['kid']) && is_string($header['kid']) ? $header['kid'] : null;
    }

    /** @param array<string, mixed> $jwks */
    private function hasKey(array $jwks, string $kid): bool
    {
        foreach ((array) ($jwks['keys'] ?? []) as $key) {
            if (is_array($key) && ($key['kid'] ?? null) === $kid) {
                return true;
            }
        }

        return false;
    }
}
