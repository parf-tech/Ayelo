<?php

namespace App\Support;

use Illuminate\Cache\RateLimiter;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;

/**
 * Magasin de l'état de sécurité qui ne doit pas être évincé (config `safety.state_store`) : jeton d'âge à usage unique,
 * compteur d'échecs de ré-authentification, consigne de pose. Repli sur le magasin par défaut quand rien n'est configuré.
 */
class SafetyState
{
    public static function store(): Repository
    {
        return Cache::store(config('safety.state_store'));
    }

    public static function limiter(): RateLimiter
    {
        return new RateLimiter(self::store());
    }
}
