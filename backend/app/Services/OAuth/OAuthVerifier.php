<?php

namespace App\Services\OAuth;

interface OAuthVerifier
{
    /**
     * Vérifie un jeton d'identité (id_token) Google ou Apple et renvoie l'identité.
     *
     * @throws InvalidOAuthToken
     */
    public function verify(string $provider, string $idToken): OAuthIdentity;
}
