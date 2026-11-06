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
use Illuminate\Support\Str;

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
        // Limites : jamais sur un en-tête client seul (revue de sécurité F-01). Pour les routes sensibles on combine
        // l'identifiant visé (e-mail), l'adresse IP et l'appareil (uuid valide) : la limite la plus stricte l'emporte.
        // Valeurs initiales de docs/10-API-SPECIFICATIONS.md, à calibrer.
        RateLimiter::for('api', fn (Request $r) => Limit::perMinute(120)->by($r->user()?->id ? 'u:'.$r->user()->id : 'ip:'.$r->ip()));

        RateLimiter::for('age-check', fn (Request $r) => [
            Limit::perHour(10)->by('age-dev:'.$this->device($r)),
            Limit::perHour(30)->by('age-ip:'.$r->ip()),
        ]);

        RateLimiter::for('register', fn (Request $r) => [
            Limit::perHour(5)->by('reg-device:'.$this->device($r)),
            Limit::perHour(20)->by('reg-ip:'.$r->ip()),
        ]);

        RateLimiter::for('login', fn (Request $r) => [
            Limit::perMinutes(15, 5)->by('login-email:'.strtolower(trim((string) $r->input('email')))),
            Limit::perMinutes(15, 10)->by('login-device:'.$this->device($r)),
            Limit::perMinutes(15, 30)->by('login-ip:'.$r->ip()),
        ]);

        RateLimiter::for('oauth', fn (Request $r) => [
            Limit::perMinutes(15, 10)->by('oauth-dev:'.$this->device($r)),
            Limit::perMinutes(15, 30)->by('oauth-ip:'.$r->ip()),
        ]);
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
        RateLimiter::for('webhooks', fn (Request $r) => Limit::perMinute(300)->by('webhook:'.$r->ip()));
        RateLimiter::for('calls', fn (Request $r) => Limit::perMinute(10)->by('calls:'.$r->user()?->id));
        RateLimiter::for('media-upload', fn (Request $r) => Limit::perHour(20)->by('media:'.$r->user()?->id));
        RateLimiter::for('password-reset', fn (Request $r) => Limit::perHour(5)->by('pw-reset:'.$r->ip()));
    }

    /** Identifiant d'appareil si l'en-tête est un uuid valide, sinon l'IP : un en-tête libre ne crée pas de compteur neuf. */
    private function device(Request $r): string
    {
        $id = (string) $r->header('X-Device-Id', '');

        return Str::isUuid($id) ? strtolower($id) : 'ip:'.$r->ip();
    }
}
