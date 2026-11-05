<?php

namespace App\Services;

use Firebase\JWT\JWT;
use RuntimeException;

/**
 * Jetons d'accès LiveKit : JWT HS256 signé par notre serveur avec la clé d'API (secret jamais envoyé au client).
 * Durée de vie courte, droits limités à une salle (docs/08).
 */
class LiveKitTokens
{
    public const TTL_SECONDS = 600;

    public function mint(string $room, string $identity, string $name, bool $video): string
    {
        $key = config('services.livekit.api_key');
        $secret = config('services.livekit.api_secret');
        if (! $key || ! $secret) {
            throw new RuntimeException('LiveKit non configuré.');
        }

        $now = time();

        return JWT::encode([
            'iss' => $key,
            'sub' => $identity,
            'name' => $name,
            'nbf' => $now,
            'iat' => $now,
            'exp' => $now + self::TTL_SECONDS,
            'video' => [
                'room' => $room,
                'roomJoin' => true,
                'canPublish' => true,
                'canSubscribe' => true,
                'canPublishData' => true,
                // Audio seul : la publication vidéo n'est pas autorisée.
                'canPublishSources' => $video ? ['microphone', 'camera'] : ['microphone'],
            ],
        ], $secret, 'HS256');
    }

    public function url(): string
    {
        return (string) config('services.livekit.url');
    }
}
