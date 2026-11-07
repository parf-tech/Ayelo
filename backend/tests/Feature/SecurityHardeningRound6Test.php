<?php

/*
 * Lot 6 (auth et compte) : F-11, F-18 a F-21, F-24, F-25, F-29, F-30 et Q1 de docs/reviews/code-security-1.md et -2.md.
 * Un test de non-regression par constat. Aucun appel reseau : le verificateur OAuth est simule et le service de mots de passe
 * compromis est remplace par Http::fake.
 */

use App\Http\Controllers\Auth\PasswordController;
use App\Jobs\BuildDataExport;
use App\Mail\PasswordResetMail;
use App\Mail\VerifyEmailMail;
use App\Models\User;
use App\Services\AccountMail;
use App\Services\AgeGate;
use App\Services\OAuth\InvalidOAuthToken;
use App\Services\OAuth\JwtOAuthVerifier;
use App\Services\OAuth\OAuthIdentity;
use App\Services\OAuth\OAuthVerifier;
use App\Services\OneTimeCodes;
use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

const R6_D1 = 'bbbbbbbb-1111-4333-8444-555555555551';
const R6_D2 = 'bbbbbbbb-1111-4333-8444-555555555552';
const R6_D3 = 'bbbbbbbb-1111-4333-8444-555555555553';
const R6_PWD = 'Motdepasse2026';

function r6_from(string $device, ?string $ip = null)
{
    app('auth')->forgetGuards();
    $t = test()->withHeader('X-Device-Id', $device);

    return $ip === null ? $t : $t->withServerVariables(['REMOTE_ADDR' => $ip]);
}

function r6_age(string $device, ?string $ip = null, string $birthdate = '1990-05-10'): string
{
    return r6_from($device, $ip)->postJson('/api/v1/auth/age-check', ['birthdate' => $birthdate])->assertOk()->json('age_token');
}

function r6_register(string $device, string $email, string $token, ?string $ip = null, array $over = [])
{
    return r6_from($device, $ip)->postJson('/api/v1/auth/register', array_replace_recursive([
        'email' => $email, 'password' => R6_PWD, 'age_token' => $token, 'platform' => 'android',
        'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true],
    ], $over));
}

function r6_login(string $device, string $email)
{
    return r6_from($device, null)->postJson('/api/v1/auth/login', ['email' => $email, 'password' => R6_PWD, 'platform' => 'ios']);
}

function r6_me(string $device, string $token): int
{
    return r6_from($device)->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/v1/me')->getStatusCode();
}

/** Identite simulee : sujet, e-mail verifie, date d'emission et nonce du jeton. */
function r6_fake_identity(string $sub, ?string $email, ?int $iat = null, ?string $nonce = null): void
{
    app()->bind(OAuthVerifier::class, fn () => new class($sub, $email, $iat, $nonce) implements OAuthVerifier
    {
        public function __construct(private string $sub, private ?string $email, private ?int $iat, private ?string $nonce) {}

        public function verify(string $provider, string $idToken): OAuthIdentity
        {
            if ($idToken === 'invalide') {
                throw new InvalidOAuthToken('invalide');
            }

            return new OAuthIdentity($provider, $this->sub, $this->email, $this->email !== null, $this->iat, $this->nonce);
        }
    });
}

function r6_oauth(string $device, array $extra = [])
{
    return r6_from($device)->postJson('/api/v1/auth/oauth/google', array_merge(['id_token' => 'ok', 'platform' => 'ios'], $extra));
}

/** Compte social deja rattache (sans mot de passe). */
function r6_social_user(string $sub = 'sub-r6'): User
{
    $u = User::factory()->create(['password' => null, 'email' => 'social-'.Str::random(6).'@example.com']);
    DB::table('auth_identities')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'provider' => 'google', 'provider_user_id' => $sub, 'created_at' => now(), 'updated_at' => now()]);

    return $u;
}

// ---------------------------------------------------------------------------------------------------------------------
// F-18 : mots de passe et sessions
// ---------------------------------------------------------------------------------------------------------------------

it('F-18 : en production le mot de passe est aussi refusé s’il figure dans une fuite publique, sans appel réseau ailleurs', function () {
    $hash = strtoupper(sha1(R6_PWD));
    $down = false;
    Http::fake(['api.pwnedpasswords.com/*' => function () use (&$down, $hash) {
        return $down ? Http::response('', 500) : Http::response(substr($hash, 5).":42\r\n0000000000000000000000000000000000A:1");
    }]);
    $passes = fn (string $p) => Validator::make(['p' => $p], ['p' => ['required', Password::default()]])->passes();

    // Hors production : règle locale seulement, aucun appel.
    expect($passes(R6_PWD))->toBeTrue();
    Http::assertNothingSent();

    $env = app()['env'];
    app()['env'] = 'production';
    try {
        expect($passes(R6_PWD))->toBeFalse();
        // Un mot de passe absent de la liste passe ; un service injoignable ne bloque pas les inscriptions.
        expect($passes('Autrechose2026x'))->toBeTrue();
        $down = true;
        expect($passes(R6_PWD))->toBeTrue();
        // Les règles locales restent en vigueur.
        expect($passes('court1'))->toBeFalse()->and($passes('uniquementdeslettres'))->toBeFalse();
    } finally {
        app()['env'] = $env;
    }
});

it('F-18 : une nouvelle connexion depuis le même appareil révoque le jeton précédent et conserve le jeton push', function () {
    $u = User::factory()->create(['password' => R6_PWD]);

    $t1 = r6_login(R6_D1, $u->email)->assertOk()->json('token');
    DB::table('devices')->where('user_id', $u->id)->update(['push_token' => 'push-r6', 'voip_push_token' => 'voip-r6']);
    $t2 = r6_login(R6_D1, $u->email)->assertOk()->json('token');

    expect(DB::table('devices')->where('user_id', $u->id)->count())->toBe(1)
        ->and(DB::table('devices')->where('user_id', $u->id)->value('push_token'))->toBe('push-r6')
        ->and(DB::table('devices')->where('user_id', $u->id)->value('voip_push_token'))->toBe('voip-r6')
        ->and($u->tokens()->count())->toBe(1);
    expect(r6_me(R6_D1, $t1))->toBe(401)->and(r6_me(R6_D1, $t2))->toBe(200);

    // Un autre appareil garde sa propre session.
    $t3 = r6_login(R6_D2, $u->email)->assertOk()->json('token');
    expect(DB::table('devices')->where('user_id', $u->id)->count())->toBe(2)
        ->and(r6_me(R6_D1, $t2))->toBe(200)->and(r6_me(R6_D2, $t3))->toBe(200);
});

it('F-18 : le nombre de sessions par compte est plafonné, les plus anciennes sont fermées', function () {
    config(['safety.max_sessions_per_user' => 2]);
    $u = User::factory()->create(['password' => R6_PWD]);

    $tokens = [];
    foreach ([R6_D1, R6_D2, R6_D3] as $device) {
        $tokens[$device] = r6_login($device, $u->email)->assertOk()->json('token');
        $this->travel(5)->seconds();
    }

    expect(DB::table('devices')->where('user_id', $u->id)->count())->toBe(2)->and($u->tokens()->count())->toBe(2);
    expect(r6_me(R6_D1, $tokens[R6_D1]))->toBe(401)
        ->and(r6_me(R6_D2, $tokens[R6_D2]))->toBe(200)
        ->and(r6_me(R6_D3, $tokens[R6_D3]))->toBe(200);
});

it('F-18 : la réinitialisation refuse un mot de passe identique à l’e-mail sans consommer le jeton', function () {
    $u = User::factory()->create(['email' => 'abcdefgh12@example.com', 'password' => R6_PWD]);
    $token = app(OneTimeCodes::class)->issue($u->id, 'password_reset', 60);

    test()->postJson('/api/v1/auth/password/reset', ['token' => $token, 'password' => 'abcdefgh12@example.com'])
        ->assertStatus(422)->assertJsonPath('error.fields.password.0', fn ($v) => is_string($v));

    test()->postJson('/api/v1/auth/password/reset', ['token' => $token, 'password' => 'NouveauMotDePasse77'])->assertNoContent();
});

// ---------------------------------------------------------------------------------------------------------------------
// F-19 : consentements OAuth stricts
// ---------------------------------------------------------------------------------------------------------------------

it('F-19 : OAuth refuse "false", 0 ou un tableau comme consentement, accepte vrai ou absent (409)', function () {
    r6_fake_identity('sub-new', 'nouveau@example.com');
    $token = r6_age(R6_D1);
    $ok = ['terms' => true, 'privacy' => true, 'sensitive_data' => true];

    foreach (['false', false, 0, [1]] as $bad) {
        r6_oauth(R6_D1, ['age_token' => $token, 'consents' => array_merge($ok, ['terms' => $bad])])
            ->assertStatus(422)->assertJsonStructure(['error' => ['fields' => ['consents.terms']]]);
    }
    r6_oauth(R6_D1, ['age_token' => $token, 'consents' => array_merge($ok, ['privacy' => 'false'])])->assertStatus(422);
    r6_oauth(R6_D1, ['age_token' => $token, 'consents' => array_merge($ok, ['sensitive_data' => 'false'])])->assertStatus(422);
    expect(User::where('email', 'nouveau@example.com')->exists())->toBeFalse();

    // Consentement absent : l'application doit finaliser l'inscription (409, comportement inchangé).
    r6_oauth(R6_D1, ['age_token' => $token, 'consents' => ['terms' => true]])->assertStatus(409)->assertJsonPath('error.code', 'registration_required');
    r6_oauth(R6_D1, ['age_token' => $token, 'consents' => $ok])->assertCreated();
});

// ---------------------------------------------------------------------------------------------------------------------
// F-20 : export avec ré-authentification
// ---------------------------------------------------------------------------------------------------------------------

it('F-20 : l’export exige le mot de passe (ou un id_token frais pour un compte social)', function () {
    Queue::fake();
    $u = User::factory()->create(['password' => R6_PWD]);
    $bearer = 'Bearer '.$u->createToken('t')->plainTextToken;
    $call = function (array $body) use ($bearer) {
        app('auth')->forgetGuards();

        return test()->withHeader('Authorization', $bearer)->postJson('/api/v1/me/export', $body);
    };

    $call([])->assertStatus(422);
    $call(['password' => 'mauvais'])->assertForbidden()->assertJsonPath('error.code', 'invalid_credentials');
    Queue::assertNothingPushed();
    expect(DB::table('data_exports')->where('user_id', $u->id)->count())->toBe(0);

    $call(['password' => R6_PWD])->assertStatus(202);
    Queue::assertPushed(BuildDataExport::class);

    // Compte social : id_token frais du bon compte.
    $s = r6_social_user('sub-export');
    $sb = 'Bearer '.$s->createToken('t')->plainTextToken;
    $callS = function (array $body) use ($sb) {
        app('auth')->forgetGuards();

        return test()->withHeader('Authorization', $sb)->postJson('/api/v1/me/export', $body);
    };
    r6_fake_identity('sub-export', null, time() - 30);
    $callS([])->assertStatus(422);
    $callS(['provider' => 'google', 'id_token' => 'invalide'])->assertForbidden();
    r6_fake_identity('autre-sujet', null, time() - 30);
    $callS(['provider' => 'google', 'id_token' => 'ok'])->assertForbidden();
    r6_fake_identity('sub-export', null, time() - 30);
    $callS(['provider' => 'google', 'id_token' => 'ok'])->assertStatus(202);
});

it('F-20 : les échecs de ré-authentification sont comptés (5 par 15 minutes)', function () {
    $u = User::factory()->create(['password' => R6_PWD]);
    $bearer = 'Bearer '.$u->createToken('t')->plainTextToken;

    for ($i = 0; $i < 5; $i++) {
        app('auth')->forgetGuards();
        test()->withHeader('Authorization', $bearer)->postJson('/api/v1/me/export', ['password' => 'mauvais'])->assertForbidden();
    }
    app('auth')->forgetGuards();
    test()->withHeader('Authorization', $bearer)->postJson('/api/v1/me/export', ['password' => R6_PWD])->assertStatus(429);
});

// ---------------------------------------------------------------------------------------------------------------------
// F-21 : nonce et fraîcheur OAuth
// ---------------------------------------------------------------------------------------------------------------------

it('F-21 : le nonce envoyé doit correspondre à celui du jeton (valeur brute ou SHA-256), sinon 401', function () {
    r6_social_user('sub-nonce');

    r6_fake_identity('sub-nonce', 'x@example.com', time(), 'nonce-123');
    r6_oauth(R6_D1, ['nonce' => 'nonce-123'])->assertOk();
    r6_oauth(R6_D1, ['nonce' => 'autre'])->assertUnauthorized()->assertJsonPath('error.code', 'invalid_oauth_token');
    r6_fake_identity('sub-nonce', 'x@example.com', time(), hash('sha256', 'nonce-123'));
    r6_oauth(R6_D1, ['nonce' => 'nonce-123'])->assertOk();

    // Jeton sans nonce alors que le client en a envoyé un : refusé.
    r6_fake_identity('sub-nonce', 'x@example.com', time(), null);
    r6_oauth(R6_D1, ['nonce' => 'nonce-123'])->assertUnauthorized();
    // Sans nonce côté client : accepté tant que le nonce n'est pas exigé (compatibilité avec l'application actuelle).
    r6_oauth(R6_D1)->assertOk();
});

it('F-21 : safety.oauth.require_nonce rend le nonce obligatoire', function () {
    r6_social_user('sub-nonce2');
    config(['safety.oauth.require_nonce' => true]);

    r6_fake_identity('sub-nonce2', 'x@example.com', time(), 'n1');
    r6_oauth(R6_D1)->assertUnauthorized();
    r6_oauth(R6_D1, ['nonce' => 'n1'])->assertOk();
});

it('F-21 : la ré-authentification par id_token refuse un jeton émis depuis trop longtemps', function () {
    $s = r6_social_user('sub-fresh');
    $bearer = 'Bearer '.$s->createToken('t')->plainTextToken;
    $del = function (array $extra = []) use ($bearer) {
        app('auth')->forgetGuards();

        return test()->withHeader('Authorization', $bearer)->deleteJson('/api/v1/me', array_merge(['provider' => 'google', 'id_token' => 'ok'], $extra));
    };

    r6_fake_identity('sub-fresh', null, time() - 3600);
    $del()->assertForbidden()->assertJsonPath('error.code', 'invalid_oauth_token');
    expect($s->fresh()->status)->toBe('active');

    // Le nonce, s'il est envoyé, est aussi contrôlé.
    r6_fake_identity('sub-fresh', null, time() - 60, 'n-del');
    $del(['nonce' => 'faux'])->assertForbidden();
    expect($s->fresh()->status)->toBe('active');

    config(['safety.oauth.reauth_max_age_seconds' => 120]);
    $del(['nonce' => 'n-del'])->assertStatus(202);
    expect($s->fresh()->status)->toBe('deleting');
});

function r6_rsa(): array
{
    $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    openssl_pkey_export($key, $private);
    $d = openssl_pkey_get_details($key);
    $b64 = fn ($v) => rtrim(strtr(base64_encode($v), '+/', '-_'), '=');

    return [$private, ['keys' => [['kty' => 'RSA', 'kid' => 'k6', 'alg' => 'RS256', 'use' => 'sig', 'n' => $b64($d['rsa']['n']), 'e' => $b64($d['rsa']['e'])]]]];
}

it('F-21 : le vérificateur JWT expose iat et nonce, et refuse un jeton sans iat', function () {
    [$private, $jwks] = r6_rsa();
    config(['services.oauth.google' => ['client_ids' => ['app-client-id'], 'issuers' => ['https://accounts.google.com'], 'jwks_url' => 'https://jwks.test/google']]);
    Cache::flush();
    Http::fake(['jwks.test/*' => Http::response($jwks)]);

    $base = ['iss' => 'https://accounts.google.com', 'aud' => 'app-client-id', 'sub' => 'abc', 'exp' => time() + 600];
    $iat = time() - 100;
    $identity = (new JwtOAuthVerifier)->verify('google', JWT::encode($base + ['iat' => $iat, 'nonce' => 'n-abc'], $private, 'RS256', 'k6'));
    expect($identity->issuedAt)->toBe($iat)->and($identity->nonce)->toBe('n-abc')
        ->and($identity->isFresh(600))->toBeTrue()->and($identity->isFresh(50))->toBeFalse()
        ->and($identity->matchesNonce('n-abc'))->toBeTrue()->and($identity->matchesNonce('autre'))->toBeFalse();

    expect(fn () => (new JwtOAuthVerifier)->verify('google', JWT::encode($base, $private, 'RS256', 'k6')))->toThrow(InvalidOAuthToken::class);
});

// ---------------------------------------------------------------------------------------------------------------------
// F-24 : entrées mal formées (422 / 404, jamais 500)
// ---------------------------------------------------------------------------------------------------------------------

it('F-24 : /sessions/{device} non uuid donne 404, pays tableau ou avec saut de ligne donne 422', function () {
    $u = User::factory()->create(['password' => R6_PWD]);
    $h = ['Authorization' => 'Bearer '.$u->createToken('t')->plainTextToken];

    test()->withHeaders($h)->deleteJson('/api/v1/auth/sessions/pas-un-uuid')->assertNotFound();
    app('auth')->forgetGuards();
    test()->withHeaders($h)->deleteJson('/api/v1/auth/sessions/'.Str::uuid())->assertNotFound();

    $profile = ['display_name' => 'Alice', 'gender' => 'woman', 'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt'];
    foreach (['origin_country', 'residence_country'] as $field) {
        app('auth')->forgetGuards();
        test()->withHeaders($h)->putJson('/api/v1/me/profile', array_merge($profile, [$field => ['FR']]))->assertStatus(422);
    }

    // L'expression régulière se termine par \z : "FR\n" n'est plus accepté (le $ final l'acceptait).
    $source = file_get_contents(app_path('Http/Controllers/ProfileController.php'));
    expect($source)->not->toContain('{2}$/')->and(substr_count($source, '{2}\z/'))->toBe(4);
    expect(preg_match('/^[A-Z]{2}\z/', "FR\n"))->toBe(0)->and(preg_match('/^[A-Z]{2}$/', "FR\n"))->toBe(1);

    // Octet nul ou séquence invalide dans l'e-mail : refus propre, pas d'erreur SQL.
    app('auth')->forgetGuards();
    expect(test()->postJson('/api/v1/auth/password/forgot', ['email' => "a\0b@example.com"])->getStatusCode())->toBeLessThan(500);
    expect(r6_from(R6_D1)->postJson('/api/v1/auth/login', ['email' => "a\0b@example.com", 'password' => 'x', 'platform' => 'ios'])->getStatusCode())->toBeLessThan(500);
    app('auth')->forgetGuards();
    test()->withHeaders($h)->getJson('/api/v1/me/export/pas-un-uuid')->assertNotFound();
});

// ---------------------------------------------------------------------------------------------------------------------
// F-25 : course à l'inscription
// ---------------------------------------------------------------------------------------------------------------------

it('F-25 : deux inscriptions simultanées avec la même adresse donnent 422 (ou 409 OAuth), pas 500, et le jeton d’âge est rendu', function () {
    $armed = true;
    $racing = function (User $user) use (&$armed) {
        if (! $armed) {
            return;
        }
        $armed = false;
        // L'autre requête a gagné la course entre le contrôle et l'insertion.
        DB::table('users')->insert(['id' => (string) Str::uuid(), 'email' => $user->email, 'birthdate' => '1990-01-01', 'locale' => 'fr', 'created_at' => now(), 'updated_at' => now()]);
    };
    Event::listen('eloquent.creating: '.User::class, $racing);

    try {
        $token = r6_age(R6_D1);
        r6_register(R6_D1, 'course@example.com', $token)->assertStatus(422)->assertJsonStructure(['error' => ['fields' => ['email']]]);
        // Le jeton d'âge n'a pas été consommé par l'échec.
        r6_register(R6_D1, 'course-bis@example.com', $token)->assertCreated();

        // OAuth : la même course donne 409 account_exists.
        $armed = true;
        r6_fake_identity('sub-race', 'course-oauth@example.com');
        $t2 = r6_age(R6_D2);
        r6_oauth(R6_D2, ['age_token' => $t2, 'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true]])
            ->assertStatus(409)->assertJsonPath('error.code', 'account_exists');
    } finally {
        $armed = false;
    }
});

// ---------------------------------------------------------------------------------------------------------------------
// F-29 : jeton d'âge à usage unique
// ---------------------------------------------------------------------------------------------------------------------

it('F-29 : le jeton d’âge ne sert qu’une fois (e-mail et OAuth), reste valable 10 minutes sinon', function () {
    $token = r6_age(R6_D1);
    r6_register(R6_D1, 'un@example.com', $token)->assertCreated();
    r6_register(R6_D1, 'deux@example.com', $token)->assertStatus(422)->assertJsonStructure(['error' => ['fields' => ['age_token']]]);
    expect(User::where('email', 'deux@example.com')->exists())->toBeFalse();

    // Un échec de validation avant consommation ne brûle pas le jeton.
    $t2 = r6_age(R6_D2);
    r6_register(R6_D2, 'trois@example.com', $t2, null, ['password' => 'court1'])->assertStatus(422);
    $this->travel(9)->minutes();
    r6_register(R6_D2, 'trois@example.com', $t2)->assertCreated();

    // OAuth : même règle.
    $t3 = r6_age(R6_D3);
    $consents = ['terms' => true, 'privacy' => true, 'sensitive_data' => true];
    r6_fake_identity('sub-un', 'oauth-un@example.com');
    r6_oauth(R6_D3, ['age_token' => $t3, 'consents' => $consents])->assertCreated();
    r6_fake_identity('sub-deux', 'oauth-deux@example.com');
    r6_oauth(R6_D3, ['age_token' => $t3, 'consents' => $consents])->assertStatus(409)->assertJsonPath('error.code', 'registration_required');
    expect(User::where('email', 'oauth-deux@example.com')->exists())->toBeFalse();
});

it('F-29 : les anciens jetons sans identifiant restent acceptés une fois', function () {
    // Jeton émis avant l'ajout de `jti` : l'empreinte du jeton chiffré tient lieu d'identifiant.
    $legacy = Illuminate\Support\Facades\Crypt::encryptString(json_encode([
        'birthdate' => '1990-05-10', 'device' => App\Support\DeviceId::hash(R6_D1), 'exp' => now()->addMinutes(5)->getTimestamp(),
    ]));
    $gate = app(AgeGate::class);
    expect($gate->readToken($legacy, R6_D1))->toBe('1990-05-10')->and($gate->claimToken($legacy))->toBeTrue()->and($gate->claimToken($legacy))->toBeFalse();
    $gate->releaseToken($legacy);
    expect($gate->claimToken($legacy))->toBeTrue();
});

// ---------------------------------------------------------------------------------------------------------------------
// F-30 : squat d'e-mail non vérifié
// ---------------------------------------------------------------------------------------------------------------------

function r6_squatter(string $email, array $over = []): User
{
    return User::factory()->create(array_merge(['email' => $email, 'password' => R6_PWD, 'email_verified_at' => null, 'created_at' => now()->subHours(30), 'updated_at' => now()->subHours(30)], $over));
}

it('P-01 : PoC du rapport, l’inscription par formulaire avec l’e-mail d’une victime non vérifiée ne détruit RIEN (422)', function () {
    $victim = r6_squatter('victime@example.com');
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $victim->id, 'display_name' => 'Victime', 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);
    $tok = $victim->createToken('t');
    DB::table('personal_access_tokens')->where('id', $tok->accessToken->getKey())->update(['last_used_at' => now()->subHours(30)]);

    // Attaquant anonyme : date adulte, puis inscription avec l'adresse de la victime et son propre mot de passe.
    $attackerToken = r6_age(R6_D1);
    r6_register(R6_D1, 'Victime@Example.com', $attackerToken, null, ['password' => 'MotdepasseAttaquant9'])
        ->assertStatus(422)->assertJsonStructure(['error' => ['fields' => ['email']]]);

    $fresh = $victim->fresh();
    expect($fresh->status)->toBe('active')->and($fresh->email)->toBe('victime@example.com')
        ->and(DB::table('profiles')->where('user_id', $victim->id)->count())->toBe(1)
        ->and(DB::table('personal_access_tokens')->where('tokenable_id', $victim->id)->count())->toBe(1)
        ->and(User::where('email', 'victime@example.com')->count())->toBe(1);
    // Le jeton d'âge est rendu : l'attaquant (ou la vraie propriétaire) peut réessayer avec une autre adresse.
    r6_register(R6_D1, 'autre-adresse@example.com', $attackerToken)->assertCreated();
});

it('P-01 : le vrai propriétaire reprend l’adresse squattée par « mot de passe oublié » (le code prouve la possession)', function () {
    Mail::fake();
    $squatter = r6_squatter('reprise@example.com', ['password' => 'MotdepasseAttaquant9']);
    $old = $squatter->createToken('t');

    test()->postJson('/api/v1/auth/password/forgot', ['email' => 'reprise@example.com'])->assertNoContent();
    $codes = app(OneTimeCodes::class);
    $token = $codes->issue($squatter->id, 'password_reset', 60);
    test()->postJson('/api/v1/auth/password/reset', ['token' => $token, 'password' => 'NouveauMotdepasse2026'])->assertNoContent();

    $fresh = $squatter->fresh();
    expect($fresh->email_verified_at)->not->toBeNull()
        ->and(Illuminate\Support\Facades\Hash::check('NouveauMotdepasse2026', $fresh->password))->toBeTrue()
        ->and(DB::table('personal_access_tokens')->where('id', $old->accessToken->getKey())->exists())->toBeFalse();
});

it('F-30 : un compte vérifié, récent, actif ou social n’est jamais repris (422 / 409)', function () {
    $dev = fn () => (string) Str::uuid();
    r6_squatter('verifie@example.com', ['email_verified_at' => now()->subDays(2)]);
    r6_register($d = $dev(), 'verifie@example.com', r6_age($d))->assertStatus(422)->assertJsonStructure(['error' => ['fields' => ['email']]]);

    r6_squatter('recent@example.com', ['created_at' => now()->subHours(2)]);
    r6_register($d = $dev(), 'recent@example.com', r6_age($d))->assertStatus(422);

    $active = r6_squatter('actif@example.com', ['last_seen_at' => now()->subHours(3)]);
    r6_register($d = $dev(), 'actif@example.com', r6_age($d))->assertStatus(422);

    $used = r6_squatter('token@example.com');
    $t = $used->createToken('t');
    DB::table('personal_access_tokens')->where('id', $t->accessToken->getKey())->update(['last_used_at' => now()->subHour()]);
    r6_register($d = $dev(), 'token@example.com', r6_age($d))->assertStatus(422);

    r6_squatter('social@example.com', ['password' => null]);
    r6_register($d = $dev(), 'social@example.com', r6_age($d))->assertStatus(422);

    expect(User::whereIn('email', ['verifie@example.com', 'recent@example.com', 'actif@example.com', 'token@example.com', 'social@example.com'])->where('status', 'active')->count())->toBe(5);
    expect($active->fresh()->status)->toBe('active');
});

it('F-30 : un propriétaire prouvé par le fournisseur OAuth reprend aussi l’adresse squattée', function () {
    $squatter = r6_squatter('prouve@example.com');
    r6_fake_identity('sub-prouve', 'prouve@example.com');

    r6_oauth(R6_D1, ['age_token' => r6_age(R6_D1), 'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true]])->assertCreated();
    expect($squatter->fresh()->status)->toBe('deleted')->and(User::where('email', 'prouve@example.com')->whereNotNull('email_verified_at')->count())->toBe(1);

    // Squatteur récent : 409 comme avant.
    r6_squatter('recent2@example.com', ['created_at' => now()->subHour()]);
    r6_fake_identity('sub-recent', 'recent2@example.com');
    r6_oauth(R6_D2, ['age_token' => r6_age(R6_D2), 'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true]])->assertStatus(409)->assertJsonPath('error.code', 'account_exists');
});

// ---------------------------------------------------------------------------------------------------------------------
// Q1 / P-03 : l'e-mail saisi depuis un appareil refusé ne bloque personne ; seule une identité prouvée est étendue
// ---------------------------------------------------------------------------------------------------------------------

it('P-03 : PoC du rapport, saisir l’e-mail d’une victime depuis un appareil mineur ne la bloque pas', function () {
    $minor = now()->subYears(16)->format('Y-m-d');
    r6_from(R6_D1, '203.0.113.5')->postJson('/api/v1/auth/age-check', ['birthdate' => $minor])->assertForbidden();

    // Même appareil, même IP, dans la foulée : l'adresse de la victime est tapée.
    r6_register(R6_D1, 'victime-age@example.com', 'invalide', '203.0.113.5')->assertForbidden();
    r6_register(R6_D1, 'victime-age@example.com', 'invalide', '203.0.113.5', ['email' => 'Victime-Age@Example.com'])->assertForbidden();
    expect(app(AgeGate::class)->isEmailRefused('victime-age@example.com'))->toBeFalse()
        ->and(DB::table('banned_identifiers')->where('kind', 'age_refusal')->where('value_hash', App\Services\BannedIdentifiers::hash('email:victime-age@example.com'))->exists())->toBeFalse();

    // La vraie propriétaire, autre appareil et autre IP : inscription possible.
    $token = r6_age(R6_D2, '198.51.100.20');
    r6_register(R6_D2, 'victime-age@example.com', $token, '198.51.100.20')->assertCreated();
});

it('P-03 : une identité prouvée par OAuth reste étendue (90 jours)', function () {
    $minor = now()->subYears(16)->format('Y-m-d');
    r6_from(R6_D1, '203.0.113.5')->postJson('/api/v1/auth/age-check', ['birthdate' => $minor])->assertForbidden();
    r6_fake_identity('sub-prouve-age', 'prouve-age@example.com');
    r6_oauth(R6_D1, ['age_token' => 'x'])->assertForbidden();
    expect(app(AgeGate::class)->isEmailRefused('prouve-age@example.com'))->toBeTrue();
});

// ---------------------------------------------------------------------------------------------------------------------
// F-11 : énumération de comptes par le temps de réponse
// ---------------------------------------------------------------------------------------------------------------------

it('F-11 : mot de passe oublié répond pareil, et le jeton comme l’e-mail partent après la réponse', function () {
    Mail::fake();
    $u = User::factory()->create(['password' => R6_PWD]);

    $known = test()->postJson('/api/v1/auth/password/forgot', ['email' => $u->email]);
    $unknown = test()->postJson('/api/v1/auth/password/forgot', ['email' => 'inconnu@example.com']);
    expect($known->getStatusCode())->toBe($unknown->getStatusCode())->toBe(204)->and($known->getContent())->toBe($unknown->getContent());
    Mail::assertSent(PasswordResetMail::class, 1);

    // Appel direct du contrôleur, sans fin de requête : rien n'est encore créé ni envoyé.
    Mail::fake();
    DB::table('verification_codes')->delete();
    $response = app(PasswordController::class)->forgot(Request::create('/x', 'POST', ['email' => $u->email]), app(AccountMail::class));
    expect($response->getStatusCode())->toBe(204)->and(DB::table('verification_codes')->count())->toBe(0);
    Mail::assertNothingSent();

    app()->terminate();
    expect(DB::table('verification_codes')->where('channel', 'password_reset')->count())->toBe(1);
    Mail::assertSent(PasswordResetMail::class, 1);
});

it('F-11 : le renvoi de vérification et la demande web de suppression partent aussi après la réponse', function () {
    Mail::fake();
    $u = User::factory()->create(['password' => R6_PWD, 'email_verified_at' => null]);

    $web = app(App\Http\Controllers\AccountController::class)->requestWebDeletion(Request::create('/x', 'POST', ['email' => $u->email]), app(OneTimeCodes::class));
    expect($web->getStatusCode())->toBe(202);
    Mail::assertNothingSent();
    app()->terminate();
    Mail::assertSent(App\Mail\AccountDeletionMail::class, 1);

    Mail::fake();
    $resend = app(App\Http\Controllers\Auth\EmailVerificationController::class)->resend(Request::create('/x', 'POST')->setUserResolver(fn () => $u), app(AccountMail::class));
    expect($resend->getStatusCode())->toBe(204);
    Mail::assertNothingSent();
    app()->terminate();
    Mail::assertSent(VerifyEmailMail::class, 1);
});
