<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** Trop d'échecs de ré-authentification (5 par 15 minutes et par couple compte + IP, 20 par compte) : 429 avec `Retry-After`. */
class ReauthenticationThrottled extends RuntimeException
{
    public const CODE = 'rate_limited';

    public function __construct(public readonly int $retryAfter)
    {
        parent::__construct('Trop de tentatives. Réessayez plus tard.');
    }

    public function render(): JsonResponse
    {
        return response()->json(['error' => ['code' => self::CODE, 'message' => $this->getMessage()]], 429)
            ->header('Retry-After', (string) $this->retryAfter);
    }
}
