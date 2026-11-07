<?php

namespace App\Services\OAuth;

final class OAuthIdentity
{
    /**
     * @param  int|null  $issuedAt  claim `iat` (secondes Unix) ; nul seulement pour un vérificateur simulé (revue F-21)
     * @param  string|null  $nonce  claim `nonce` du jeton, tel que le fournisseur l'a placé
     */
    public function __construct(
        public readonly string $provider,
        public readonly string $subject,
        public readonly ?string $email,
        public readonly bool $emailVerified,
        public readonly ?int $issuedAt = null,
        public readonly ?string $nonce = null,
    ) {}

    /**
     * Jeton émis il y a au plus `$maxAgeSeconds` secondes (ré-authentification, revue F-21). Un `iat` inconnu (vérificateur
     * simulé) n'est pas rejeté ici : `JwtOAuthVerifier` refuse tout jeton réel sans `iat`.
     */
    public function isFresh(int $maxAgeSeconds): bool
    {
        return $this->issuedAt === null || (time() - $this->issuedAt) <= $maxAgeSeconds;
    }

    /**
     * Le `nonce` envoyé par le client correspond à celui du jeton. Google renvoie la valeur brute ; Apple renvoie en général
     * son empreinte SHA-256 en hexadécimal (le client hache avant de la transmettre au fournisseur) : les deux sont acceptées.
     */
    public function matchesNonce(string $expected): bool
    {
        if ($this->nonce === null || $this->nonce === '') {
            return false;
        }

        return hash_equals($this->nonce, $expected) || hash_equals(strtolower($this->nonce), hash('sha256', $expected));
    }
}
