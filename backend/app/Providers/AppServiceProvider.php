<?php

namespace App\Providers;

use App\Models\PersonalAccessToken;
use App\OpenApi\ReauthenticationRequestBody;
use App\Services\Media\SpoolTranscoder;
use App\Services\Media\Transcoder;
use App\Services\OAuth\JwtOAuthVerifier;
use App\Services\OAuth\OAuthVerifier;
use App\Services\Push\FcmPushNotifier;
use App\Services\Push\PushNotifier;
use App\Services\Storage\MediaStorage;
use App\Services\Storage\S3MediaStorage;
use Dedoc\Scramble\Scramble;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(OAuthVerifier::class, JwtOAuthVerifier::class);
        $this->app->singleton(MediaStorage::class, S3MediaStorage::class);
        $this->app->bind(Transcoder::class, fn () => new SpoolTranscoder((string) config('media.transcode.spool')));
        $this->app->bind(PushNotifier::class, FcmPushNotifier::class);
    }

    public function boot(): void
    {
        // `last_used_at` écrit au plus toutes les cinq minutes par jeton, au lieu d'une fois par requête.
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // Garde de production (revue CTO n°1) : le mode debug expose traces, variables d'environnement et secrets dans les erreurs.
        if ($this->app->isProduction() && config('app.debug')) {
            throw new \RuntimeException('APP_DEBUG doit être false en production (APP_ENV=production).');
        }

        // Contrat OpenAPI : corps de la ré-authentification, que Scramble ne peut pas déduire (validation hors du contrôleur).
        // Scramble est une dépendance de développement : absente de l'image de production (composer --no-dev).
        if (class_exists(Scramble::class)) {
            Scramble::configure()->withOperationTransformers(ReauthenticationRequestBody::class);
        }

        // Mot de passe (docs/11 Authentification 2, revue F-18) : 10 caractères minimum (FR-A-1 et validation du client mobile),
        // lettres et chiffres ; en production seulement, refus des mots de passe présents dans les fuites publiques (Have I Been
        // Pwned, k-anonymat : seuls 5 caractères de l'empreinte sont envoyés). Hors production : aucun appel réseau (tests).
        // Si le service est injoignable, Laravel laisse passer (pas de blocage des inscriptions).
        Password::defaults(function () {
            $rule = Password::min(10)->letters()->numbers();

            return $this->app->isProduction() ? $rule->uncompromised(3) : $rule;
        });

        // Limites : jamais sur un en-tête client seul (revue de sécurité F-01). Pour les routes sensibles on combine
        // l'identifiant visé (e-mail), l'adresse IP et l'appareil (uuid valide) : la limite la plus stricte l'emporte.
        // Valeurs initiales de docs/10-API-SPECIFICATIONS.md, à calibrer.
        RateLimiter::for('api', fn (Request $r) => Limit::perMinute(120)->by($r->user()?->id ? 'u:'.$r->user()->id : 'ip:'.$r->ip()));

        RateLimiter::for('age-check', fn (Request $r) => [
            Limit::perHour(10)->by('age-dev:'.$this->device($r)),
            Limit::perHour(100)->by('age-ip:'.$r->ip()),
        ]);

        RateLimiter::for('register', fn (Request $r) => [
            Limit::perHour(5)->by('reg-device:'.$this->device($r)),
            Limit::perHour(60)->by('reg-ip:'.$r->ip()),
        ]);

        // Les échecs par e-mail (et par e-mail + IP) sont comptés dans LoginController, pas ici : un tiers ne peut ainsi pas
        // verrouiller le compte d'une victime avec de simples requêtes réussies ou venues d'ailleurs (revue N-06).
        RateLimiter::for('login', fn (Request $r) => [
            Limit::perMinutes(15, 15)->by('login-device:'.$this->device($r)),
            Limit::perMinutes(15, 120)->by('login-ip:'.$r->ip()),
        ]);

        RateLimiter::for('oauth', fn (Request $r) => [
            Limit::perMinutes(15, 10)->by('oauth-dev:'.$this->device($r)),
            Limit::perMinutes(15, 120)->by('oauth-ip:'.$r->ip()),
        ]);
        RateLimiter::for('email-verify', fn (Request $r) => Limit::perHour(10)->by('email-verify:'.$r->ip()));
        RateLimiter::for('email-resend', fn (Request $r) => Limit::perHour(3)->by('email-resend:'.$r->user()?->id));
        RateLimiter::for('password-forgot', fn (Request $r) => [
            Limit::perHour(3)->by('pw-forgot:'.strtolower(is_string($r->input('email')) ? $r->input('email') : '')),
            Limit::perHour(20)->by('pw-forgot-ip:'.$r->ip()),
        ]);
        RateLimiter::for('discover', fn (Request $r) => Limit::perMinute(60)->by('discover:'.$r->user()?->id));
        RateLimiter::for('swipes', fn (Request $r) => Limit::perMinute(120)->by('swipes:'.$r->user()?->id));
        RateLimiter::for('conversations', fn (Request $r) => Limit::perMinute(10)->by('conv:'.$r->user()?->id));
        RateLimiter::for('messages', fn (Request $r) => Limit::perMinute(30)->by('msg:'.$r->user()?->id));
        // Adresses de lecture des images de conversation : une par image affichée, mises en cache côté client jusqu'à leur expiration.
        RateLimiter::for('message-media', fn (Request $r) => Limit::perMinute(90)->by('msg-media:'.$r->user()?->id));
        RateLimiter::for('typing', fn (Request $r) => Limit::perMinute(60)->by('typing:'.$r->user()?->id));
        RateLimiter::for('deletion-request', fn (Request $r) => Limit::perHour(3)->by('del-req:'.$r->ip()));
        RateLimiter::for('account-delete', fn (Request $r) => Limit::perDay(5)->by('acc-del:'.$r->user()?->id));
        RateLimiter::for('webhooks', fn (Request $r) => Limit::perMinute(300)->by('webhook:'.$r->ip()));
        // Battement de présence : environ un par minute côté application ; marge pour plusieurs appareils.
        RateLimiter::for('presence', fn (Request $r) => Limit::perMinute(10)->by('presence:'.$r->user()?->id));
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
