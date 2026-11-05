<?php

namespace App\Providers;

use App\Services\OAuth\JwtOAuthVerifier;
use App\Services\Push\FcmPushNotifier;
use App\Services\Push\PushNotifier;
use App\Services\OAuth\OAuthVerifier;
use App\Services\Storage\MediaStorage;
use App\Services\Storage\S3MediaStorage;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(OAuthVerifier::class, JwtOAuthVerifier::class);
        $this->app->singleton(MediaStorage::class, S3MediaStorage::class);
        $this->app->bind(PushNotifier::class, FcmPushNotifier::class);
    }

    public function boot(): void
    {
        // Limites par appareil ou par compte d'abord, par IP en dernier recours (réseaux mobiles en CGNAT).
        // Valeurs initiales de docs/10-API-SPECIFICATIONS.md, à calibrer.
        RateLimiter::for('age-check', fn (Request $r) => Limit::perHour(10)->by('age:'.$this->device($r)));

        RateLimiter::for('register', fn (Request $r) => [
            Limit::perHour(5)->by('reg-device:'.$this->device($r)),
            Limit::perHour(20)->by('reg-ip:'.$r->ip()),
        ]);

        RateLimiter::for('login', fn (Request $r) => Limit::perMinutes(15, 5)
            ->by('login:'.strtolower((string) $r->input('email')).'|'.$this->device($r)));

        RateLimiter::for('oauth', fn (Request $r) => Limit::perMinutes(15, 10)->by('oauth:'.$this->device($r)));
        RateLimiter::for('email-verify', fn (Request $r) => Limit::perHour(10)->by('email-verify:'.$r->ip()));
        RateLimiter::for('email-resend', fn (Request $r) => Limit::perHour(3)->by('email-resend:'.$r->user()?->id));
        RateLimiter::for('password-forgot', fn (Request $r) => [
            Limit::perHour(3)->by('pw-forgot:'.strtolower((string) $r->input('email'))),
            Limit::perHour(20)->by('pw-forgot-ip:'.$r->ip()),
        ]);
        RateLimiter::for('discover', fn (Request $r) => Limit::perMinute(60)->by('discover:'.$r->user()?->id));
        RateLimiter::for('swipes', fn (Request $r) => Limit::perMinute(120)->by('swipes:'.$r->user()?->id));
        RateLimiter::for('conversations', fn (Request $r) => Limit::perMinute(10)->by('conv:'.$r->user()?->id));
        RateLimiter::for('messages', fn (Request $r) => Limit::perMinute(30)->by('msg:'.$r->user()?->id));
        RateLimiter::for('typing', fn (Request $r) => Limit::perMinute(60)->by('typing:'.$r->user()?->id));
        RateLimiter::for('deletion-request', fn (Request $r) => Limit::perHour(3)->by('del-req:'.$r->ip()));
        RateLimiter::for('account-delete', fn (Request $r) => Limit::perDay(5)->by('acc-del:'.$r->user()?->id));
        RateLimiter::for('media-upload', fn (Request $r) => Limit::perHour(20)->by('media:'.$r->user()?->id));
        RateLimiter::for('password-reset', fn (Request $r) => Limit::perHour(5)->by('pw-reset:'.$r->ip()));
    }

    private function device(Request $r): string
    {
        return (string) ($r->header('X-Device-Id') ?: $r->ip());
    }
}
