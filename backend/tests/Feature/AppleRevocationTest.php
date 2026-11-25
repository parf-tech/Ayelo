<?php

// Révocation du jeton Apple à la suppression du compte (exigence d'Apple pour « Se connecter avec Apple »).
// À la connexion, le serveur échange le code d'autorisation contre un jeton de rafraîchissement et le garde chiffré ; à l'anonymisation
// il le révoque. Aucun appel réel à Apple ici : Http::fake. Sans configuration APPLE_*, rien n'est échangé ni révoqué.

use App\Models\User;
use App\Services\AccountDeletion;
use App\Services\OAuth\OAuthIdentity;
use App\Services\OAuth\OAuthVerifier;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

const AP_DEVICE = '44444444-2222-4333-8444-555555555555';

/** Paire de clés ES256 jetable : privée pour le serveur (config), publique pour vérifier le secret client envoyé à Apple. */
function apKeys(): array
{
    $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    openssl_pkey_export($key, $private);

    return [$private, openssl_pkey_get_details($key)['key']];
}

function apConfigure(?string $private = null): string
{
    [$generated, $public] = apKeys();
    config(['services.oauth.apple.client_ids' => ['com.hco.ayelo'], 'services.oauth.apple.team_id' => 'TEAM123456', 'services.oauth.apple.key_id' => 'KEY1234567',
        'services.oauth.apple.private_key' => $private ?? $generated]);

    return $public;
}

function apVerifier(string $subject = 'apple-sub-1'): void
{
    app()->bind(OAuthVerifier::class, fn () => new class($subject) implements OAuthVerifier
    {
        public function __construct(private string $sub) {}

        public function verify(string $provider, string $idToken): OAuthIdentity
        {
            return new OAuthIdentity($provider, $this->sub, 'ap@example.com', true);
        }
    });
}

/** Compte social Apple existant. */
function apUser(?string $refreshToken = null): User
{
    $u = User::factory()->create(['birthdate' => '1990-01-01', 'password' => null, 'email' => 'ap@example.com']);
    DB::table('auth_identities')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'provider' => 'apple', 'provider_user_id' => 'apple-sub-1',
        'provider_refresh_token' => $refreshToken === null ? null : Crypt::encryptString($refreshToken), 'created_at' => now(), 'updated_at' => now()]);

    return $u;
}

function apLogin(array $extra = [])
{
    app('auth')->forgetGuards();

    return test()->withHeader('X-Device-Id', AP_DEVICE)->postJson('/api/v1/auth/oauth/apple', array_merge(['id_token' => 'x', 'platform' => 'ios'], $extra));
}

// ---------- connexion : échange du code d'autorisation ----------

it('échange le code d’autorisation à la connexion et garde le jeton chiffré', function () {
    $public = apConfigure();
    apVerifier();
    $u = apUser();
    Http::fake(['https://appleid.apple.com/auth/token' => Http::response(['refresh_token' => 'r-secret-1', 'access_token' => 'a', 'id_token' => 'i'])]);

    apLogin(['authorization_code' => 'code-abc'])->assertOk();

    Http::assertSent(function (Request $request) use ($public) {
        $secret = JWT::decode($request['client_secret'], new Key($public, 'ES256'));

        return $request->url() === 'https://appleid.apple.com/auth/token'
            && $request['grant_type'] === 'authorization_code' && $request['code'] === 'code-abc' && $request['client_id'] === 'com.hco.ayelo'
            && $secret->iss === 'TEAM123456' && $secret->sub === 'com.hco.ayelo' && $secret->aud === 'https://appleid.apple.com';
    });
    $stored = DB::table('auth_identities')->where('user_id', $u->id)->value('provider_refresh_token');
    expect($stored)->not->toBeNull()->and($stored)->not->toContain('r-secret-1')->and(Crypt::decryptString($stored))->toBe('r-secret-1');
});

it('ne bloque jamais la connexion : Apple en panne ou configuration absente', function () {
    apVerifier();
    $u = apUser();
    Http::fake(['*' => Http::response('erreur', 500)]);

    // Configuration absente : aucun appel.
    apLogin(['authorization_code' => 'code-abc'])->assertOk();
    Http::assertNothingSent();

    // Configurée, mais Apple répond 500 : la connexion réussit, aucun jeton n'est gardé.
    apConfigure();
    apLogin(['authorization_code' => 'code-abc'])->assertOk();
    expect(DB::table('auth_identities')->where('user_id', $u->id)->value('provider_refresh_token'))->toBeNull();
});

it('n’échange rien sans code d’autorisation ni pour un autre fournisseur', function () {
    apConfigure();
    apVerifier();
    apUser();
    Http::fake();

    apLogin()->assertOk();
    Http::assertNothingSent();
});

// ---------- suppression : révocation ----------

it('révoque le jeton Apple avant d’effacer l’identité', function () {
    $public = apConfigure();
    $u = apUser('r-secret-2');
    Http::fake(['https://appleid.apple.com/auth/revoke' => Http::response('', 200)]);

    app(AccountDeletion::class)->anonymize($u);

    Http::assertSent(function (Request $request) use ($public) {
        JWT::decode($request['client_secret'], new Key($public, 'ES256'));

        return $request->url() === 'https://appleid.apple.com/auth/revoke'
            && $request['token'] === 'r-secret-2' && $request['token_type_hint'] === 'refresh_token' && $request['client_id'] === 'com.hco.ayelo';
    });
    expect(DB::table('auth_identities')->where('user_id', $u->id)->count())->toBe(0)->and($u->fresh()->status)->toBe('deleted');
});

it('considère un jeton déjà révoqué (invalid_grant) comme révoqué', function () {
    apConfigure();
    $u = apUser('r-secret-3');
    Http::fake(['https://appleid.apple.com/auth/revoke' => Http::response(['error' => 'invalid_grant'], 400)]);

    app(AccountDeletion::class)->anonymize($u);

    expect($u->fresh()->status)->toBe('deleted');
});

it('laisse le compte en suppression quand Apple ne répond pas, puis abandonne après une semaine de plus', function () {
    apConfigure();
    $u = apUser('r-secret-4');
    DB::table('users')->where('id', $u->id)->update(['status' => 'deleting', 'deletion_requested_at' => now()->subDays(AccountDeletion::GRACE_DAYS + 1)]);
    Http::fake(['https://appleid.apple.com/auth/revoke' => Http::response('erreur', 503)]);

    expect(app(AccountDeletion::class)->purgeDue())->toBe(0);
    expect($u->fresh()->status)->toBe('deleting')->and(DB::table('auth_identities')->where('user_id', $u->id)->count())->toBe(1);

    // Au-delà du délai de grâce + 7 jours : l'effacement des données personnelles prime, l'échec est journalisé.
    DB::table('users')->where('id', $u->id)->update(['deletion_requested_at' => now()->subDays(AccountDeletion::GRACE_DAYS + 8)]);
    expect(app(AccountDeletion::class)->purgeDue())->toBe(1);
    expect($u->fresh()->status)->toBe('deleted');
});

it('ne bloque pas la purge quand la configuration Apple a disparu', function () {
    $u = apUser('r-secret-5');
    Http::fake();

    app(AccountDeletion::class)->anonymize($u);

    Http::assertNothingSent();
    expect($u->fresh()->status)->toBe('deleted');
});

it('ne révoque rien pour un compte sans jeton Apple', function () {
    apConfigure();
    $u = apUser();
    Http::fake();

    app(AccountDeletion::class)->anonymize($u);

    Http::assertNothingSent();
});
