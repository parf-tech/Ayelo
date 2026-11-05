<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Limites par appareil d'abord, par IP en dernier recours (réseaux mobiles en CGNAT).
        // Valeurs initiales de docs/10-API-SPECIFICATIONS.md, à calibrer.
        RateLimiter::for('age-check', fn (Request $r) => Limit::perHour(10)->by('age:'.$this->device($r)));

        RateLimiter::for('register', fn (Request $r) => [
            Limit::perHour(5)->by('reg-device:'.$this->device($r)),
            Limit::perHour(20)->by('reg-ip:'.$r->ip()),
        ]);

        RateLimiter::for('login', fn (Request $r) => Limit::perMinutes(15, 5)
            ->by('login:'.strtolower((string) $r->input('email')).'|'.$this->device($r)));
    }

    private function device(Request $r): string
    {
        return (string) ($r->header('X-Device-Id') ?: $r->ip());
    }
}
