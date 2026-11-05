<?php

namespace App\Services\OAuth;

final class OAuthIdentity
{
    public function __construct(
        public readonly string $provider,
        public readonly string $subject,
        public readonly ?string $email,
        public readonly bool $emailVerified,
    ) {}
}
