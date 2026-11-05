<?php

use App\Mail\PasswordResetMail;
use App\Mail\VerifyEmailMail;
use App\Models\User;
use App\Services\OAuth\InvalidOAuthToken;
use App\Services\OAuth\JwtOAuthVerifier;
use App\Services\OAuth\OAuthIdentity;
use App\Services\OAuth\OAuthVerifier;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

const DEV = '11111111-2222-4333-8444-555555555555';
const DEV2 = '22222222-2222-4333-8444-555555555555';

function dev(string $id = DEV)
{
    return test()->withHeader('X-Device-Id', $id);
}

function signUp(string $email = 'alice@example.com', string $device = DEV): array
{
    $age = dev($device)->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])->json('age_token');

    $res = dev($device)->postJson('/api/v1/auth/register', [
        'email' => $email, 'password' => 'Motdepasse2026', 'age_token' => $age, 'platform' => 'android',
        'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true],
    ])->assertCreated();

    return [$res->json('token'), $res->json('user.id')];
}

/** Extrait le jeton du lien envoyé dans l'e-mail. */
function tokenFromMail(string $mailable, ?string &$captured = null): string
{
    $sent = Mail::sent($mailable)->last();
    parse_str((string) parse_url($sent->link, PHP_URL_QUERY), $q);

    return $q['token'];
}

// ---------- vérification de l'e-mail ----------

it('envoie un e-mail de vérification à l’inscription et le valide une seule fois', function () {
    Mail::fake();
    signUp();

    Mail::assertSent(VerifyEmailMail::class, fn ($m) => $m->hasTo('alice@example.com'));
    $token = tokenFromMail(VerifyEmailMail::class);

    dev()->postJson('/api/v1/auth/email/verify', ['token' => $token])->assertNoContent();
    expect(User::where('email', 'alice@example.com')->first()->email_verified_at)->not->toBeNull();

    dev()->postJson('/api/v1/auth/email/verify', ['token' => $token])->assertStatus(422);
});

it('refuse un jeton de vérification falsifié ou expiré et bloque après 5 essais', function () {
    Mail::fake();
    signUp();
    $token = tokenFromMail(VerifyEmailMail::class);
    [$id] = explode('.', $token);

    dev()->postJson('/api/v1/auth/email/verify', ['token' => $id.'.mauvaissecret'])->assertStatus(422);
    dev()->postJson('/api/v1/auth/email/verify', ['token' => 'nimportequoi'])->assertStatus(422);

    foreach (range(1, 4) as $i) {
        dev()->postJson('/api/v1/auth/email/verify', ['token' => $id.'.faux'.$i])->assertStatus(422);
    }
    // 5 échecs : même le bon jeton est refusé.
    dev()->postJson('/api/v1/auth/email/verify', ['token' => $token])->assertStatus(422);
});

it('expire le lien de vérification après 24 heures', function () {
    Mail::fake();
    signUp();
    $token = tokenFromMail(VerifyEmailMail::class);

    $this->travel(25)->hours();
    dev()->postJson('/api/v1/auth/email/verify', ['token' => $token])->assertStatus(422);
});

it('renvoie le lien de vérification (limité à 3 par heure)', function () {
    Mail::fake();
    [$bearer] = signUp();
    Mail::assertSentCount(1);

    foreach (range(1, 3) as $i) {
        dev()->withHeader('Authorization', 'Bearer '.$bearer)->postJson('/api/v1/auth/email/resend')->assertNoContent();
    }
    dev()->withHeader('Authorization', 'Bearer '.$bearer)->postJson('/api/v1/auth/email/resend')->assertStatus(429);
});

it('un nouveau lien invalide le précédent', function () {
    Mail::fake();
    [$bearer] = signUp();
    $first = tokenFromMail(VerifyEmailMail::class);

    dev()->withHeader('Authorization', 'Bearer '.$bearer)->postJson('/api/v1/auth/email/resend')->assertNoContent();
    $second = tokenFromMail(VerifyEmailMail::class);

    expect($second)->not->toBe($first);
    dev()->postJson('/api/v1/auth/email/verify', ['token' => $first])->assertStatus(422);
    dev()->postJson('/api/v1/auth/email/verify', ['token' => $second])->assertNoContent();
});

// ---------- mot de passe oublié ----------

it('répond de la même façon que l’e-mail existe ou non', function () {
    Mail::fake();
    signUp();
    Mail::fake(); // on ne compte que les e-mails de réinitialisation

    dev()->postJson('/api/v1/auth/password/forgot', ['email' => 'alice@example.com'])->assertNoContent();
    dev()->postJson('/api/v1/auth/password/forgot', ['email' => 'inconnu@example.com'])->assertNoContent();

    Mail::assertSent(PasswordResetMail::class, 1);
});

it('réinitialise le mot de passe, ferme toutes les sessions et consomme le jeton', function () {
    Mail::fake();
    [$bearer] = signUp();
    dev()->postJson('/api/v1/auth/password/forgot', ['email' => 'alice@example.com'])->assertNoContent();
    $token = tokenFromMail(PasswordResetMail::class);

    dev()->postJson('/api/v1/auth/password/reset', ['token' => $token, 'password' => 'faible'])->assertStatus(422);
    dev()->postJson('/api/v1/auth/password/reset', ['token' => $token, 'password' => 'NouveauMotdepasse9'])->assertNoContent();
    dev()->postJson('/api/v1/auth/password/reset', ['token' => $token, 'password' => 'EncoreAutre2026x'])->assertStatus(422);

    app('auth')->forgetGuards();
    dev()->withHeader('Authorization', 'Bearer '.$bearer)->getJson('/api/v1/me')->assertUnauthorized();

    dev()->postJson('/api/v1/auth/login', ['email' => 'alice@example.com', 'password' => 'Motdepasse2026', 'platform' => 'ios'])->assertUnauthorized();
    dev()->postJson('/api/v1/auth/login', ['email' => 'alice@example.com', 'password' => 'NouveauMotdepasse9', 'platform' => 'ios'])->assertOk();
});

it('n’envoie pas de réinitialisation à un compte suspendu', function () {
    Mail::fake();
    signUp();
    User::where('email', 'alice@example.com')->update(['status' => 'suspended']);
    Mail::fake();

    dev()->postJson('/api/v1/auth/password/forgot', ['email' => 'alice@example.com'])->assertNoContent();
    Mail::assertNothingSent();
});

// ---------- sessions ----------

it('liste les sessions, ferme une session ou toutes', function () {
    Mail::fake();
    [$bearer, $userId] = signUp();

    $second = dev(DEV2)->postJson('/api/v1/auth/login', ['email' => 'alice@example.com', 'password' => 'Motdepasse2026', 'platform' => 'ios'])->json('token');

    $list = dev()->withHeader('Authorization', 'Bearer '.$bearer)->getJson('/api/v1/auth/sessions')->assertOk();
    expect($list->json('data'))->toHaveCount(2);
    expect(collect($list->json('data'))->where('current', true))->toHaveCount(1);

    $other = collect($list->json('data'))->firstWhere('current', false);
    dev()->withHeader('Authorization', 'Bearer '.$bearer)->deleteJson('/api/v1/auth/sessions/'.$other['id'])->assertNoContent();

    app('auth')->forgetGuards();
    dev()->withHeader('Authorization', 'Bearer '.$second)->getJson('/api/v1/me')->assertUnauthorized();
    app('auth')->forgetGuards();
    dev()->withHeader('Authorization', 'Bearer '.$bearer)->getJson('/api/v1/me')->assertOk();

    dev()->withHeader('Authorization', 'Bearer '.$bearer)->deleteJson('/api/v1/auth/sessions')->assertNoContent();
    app('auth')->forgetGuards();
    dev()->withHeader('Authorization', 'Bearer '.$bearer)->getJson('/api/v1/me')->assertUnauthorized();
    expect(DB::table('devices')->where('user_id', $userId)->count())->toBe(0);
});

it('ne permet pas de fermer la session d’un autre utilisateur', function () {
    Mail::fake();
    [$bearerA] = signUp('a@example.com');
    signUp('b@example.com', DEV2);
    $deviceOfB = DB::table('devices')->join('users', 'users.id', '=', 'devices.user_id')->where('users.email', 'b@example.com')->value('devices.id');

    dev()->withHeader('Authorization', 'Bearer '.$bearerA)->deleteJson('/api/v1/auth/sessions/'.$deviceOfB)->assertNotFound();
    expect(DB::table('devices')->where('id', $deviceOfB)->exists())->toBeTrue();
});

// ---------- OAuth (vérificateur simulé) ----------

function fakeIdentity(string $sub = 'google-sub-1', ?string $email = 'oauth@example.com', bool $verified = true): void
{
    app()->bind(OAuthVerifier::class, fn () => new class($sub, $email, $verified) implements OAuthVerifier
    {
        public function __construct(private string $sub, private ?string $email, private bool $verified) {}

        public function verify(string $provider, string $idToken): OAuthIdentity
        {
            if ($idToken === 'invalide') {
                throw new InvalidOAuthToken('invalide');
            }

            return new OAuthIdentity($provider, $this->sub, $this->email, $this->verified);
        }
    });
}

it('demande de finaliser l’inscription pour un nouveau compte sans contrôle d’âge', function () {
    fakeIdentity();

    dev()->postJson('/api/v1/auth/oauth/google', ['id_token' => 'ok', 'platform' => 'ios'])
        ->assertStatus(409)->assertJsonPath('error.code', 'registration_required');
    expect(User::where('email', 'oauth@example.com')->exists())->toBeFalse();
});

it('crée un compte via Google avec contrôle d’âge et consentements, puis se connecte sans eux', function () {
    fakeIdentity();
    $age = dev()->postJson('/api/v1/auth/age-check', ['birthdate' => '1991-02-03'])->json('age_token');

    $first = dev()->postJson('/api/v1/auth/oauth/google', [
        'id_token' => 'ok', 'platform' => 'ios', 'age_token' => $age,
        'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true],
    ])->assertCreated();

    $user = User::where('email', 'oauth@example.com')->firstOrFail();
    expect($user->birthdate->toDateString())->toBe('1991-02-03')->and($user->password)->toBeNull()->and($user->email_verified_at)->not->toBeNull();
    expect(DB::table('auth_identities')->where('provider', 'google')->where('provider_user_id', 'google-sub-1')->exists())->toBeTrue();

    // Connexion suivante : ni jeton d'âge ni consentements.
    dev(DEV2)->postJson('/api/v1/auth/oauth/google', ['id_token' => 'ok', 'platform' => 'android'])
        ->assertOk()->assertJsonPath('user.id', $user->id);
});

it('refuse un jeton OAuth invalide', function () {
    fakeIdentity();
    dev()->postJson('/api/v1/auth/oauth/apple', ['id_token' => 'invalide', 'platform' => 'ios'])
        ->assertUnauthorized()->assertJsonPath('error.code', 'invalid_oauth_token');
});

it('ne rattache pas automatiquement un compte existant à un fournisseur', function () {
    Mail::fake();
    signUp('oauth@example.com');
    fakeIdentity(email: 'oauth@example.com');

    dev(DEV2)->postJson('/api/v1/auth/oauth/google', ['id_token' => 'ok', 'platform' => 'ios'])
        ->assertStatus(409)->assertJsonPath('error.code', 'account_exists');
});

it('refuse une adresse non vérifiée par le fournisseur', function () {
    fakeIdentity(verified: false);
    $age = dev()->postJson('/api/v1/auth/age-check', ['birthdate' => '1991-02-03'])->json('age_token');

    dev()->postJson('/api/v1/auth/oauth/google', [
        'id_token' => 'ok', 'platform' => 'ios', 'age_token' => $age,
        'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true],
    ])->assertStatus(422)->assertJsonPath('error.code', 'email_not_verified');
});

it('refuse un nouveau compte OAuth sur un appareil au refus d’âge mémorisé', function () {
    fakeIdentity();
    dev()->postJson('/api/v1/auth/age-check', ['birthdate' => now()->subYears(15)->format('Y-m-d')])->assertForbidden();

    dev()->postJson('/api/v1/auth/oauth/google', ['id_token' => 'ok', 'platform' => 'ios'])
        ->assertForbidden()->assertJsonPath('error.code', 'age_not_eligible');
});

// ---------- vérificateur JWT réel (clés JWKS simulées) ----------

function rsaFixture(string $kid = 'k1'): array
{
    $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    openssl_pkey_export($key, $private);
    $d = openssl_pkey_get_details($key);
    $b64 = fn ($v) => rtrim(strtr(base64_encode($v), '+/', '-_'), '=');

    return [$private, ['keys' => [['kty' => 'RSA', 'kid' => $kid, 'alg' => 'RS256', 'use' => 'sig', 'n' => $b64($d['rsa']['n']), 'e' => $b64($d['rsa']['e'])]]]];
}

function jwtConfig(): void
{
    config(['services.oauth.google' => [
        'client_ids' => ['app-client-id'],
        'issuers' => ['https://accounts.google.com'],
        'jwks_url' => 'https://jwks.test/google',
    ]]);
    Cache::flush();
}

it('accepte un id_token correctement signé, émis par le bon fournisseur pour la bonne application', function () {
    [$private, $jwks] = rsaFixture();
    jwtConfig();
    Http::fake(['jwks.test/*' => Http::response($jwks)]);

    $jwt = JWT::encode([
        'iss' => 'https://accounts.google.com', 'aud' => 'app-client-id', 'sub' => 'abc', 'email' => 'Bob@Example.com',
        'email_verified' => true, 'exp' => time() + 600, 'iat' => time(),
    ], $private, 'RS256', 'k1');

    $identity = (new JwtOAuthVerifier)->verify('google', $jwt);
    expect($identity->subject)->toBe('abc')->and($identity->email)->toBe('bob@example.com')->and($identity->emailVerified)->toBeTrue();
});

it('rejette un id_token expiré, mal signé, de mauvaise audience ou de mauvais émetteur', function (array $claims, bool $wrongKey) {
    [$private, $jwks] = rsaFixture();
    [$other] = rsaFixture();
    jwtConfig();
    Http::fake(['jwks.test/*' => Http::response($jwks)]);

    $payload = array_merge(['iss' => 'https://accounts.google.com', 'aud' => 'app-client-id', 'sub' => 'abc', 'exp' => time() + 600], $claims);
    $jwt = JWT::encode($payload, $wrongKey ? $other : $private, 'RS256', 'k1');

    expect(fn () => (new JwtOAuthVerifier)->verify('google', $jwt))->toThrow(InvalidOAuthToken::class);
})->with([
    'expiré' => [['exp' => time() - 3600], false],
    'mauvaise audience' => [['aud' => 'autre-app'], false],
    'mauvais émetteur' => [['iss' => 'https://evil.example'], false],
    'mauvaise clé de signature' => [[], true],
]);

it('rejette un fournisseur non configuré', function () {
    config(['services.oauth.google.client_ids' => []]);
    expect(fn () => (new JwtOAuthVerifier)->verify('google', 'x.y.z'))->toThrow(InvalidOAuthToken::class);
});
