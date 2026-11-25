<?php

// Annulation de la suppression de compte pendant le délai de grâce : étape explicite (`cancel_deletion`), jamais par surprise.
// Une connexion aux bons identifiants d'un compte « deleting » répond 403 `deletion_pending` (date de suppression), sans jeton ;
// la même connexion avec `cancel_deletion: true` réactive le compte. Le profil reste masqué (choix de confidentialité).

use App\Models\User;
use App\Services\AccountDeletion;
use App\Services\OAuth\InvalidOAuthToken;
use App\Services\OAuth\OAuthIdentity;
use App\Services\OAuth\OAuthVerifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

const DC_DEVICE = '33333333-2222-4333-8444-555555555555';

/** Compte avec mot de passe dont la suppression a été demandée il y a $daysAgo jours. */
function dcDeleting(int $daysAgo = 2, array $overrides = []): User
{
    $u = User::factory()->create(array_merge(['birthdate' => '1990-01-01', 'password' => 'Motdepasse2026', 'email' => 'dc@example.com'], $overrides));
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'Dc', 'gender' => 'woman', 'origin_country' => 'CM',
        'residence_country' => 'FR', 'intent' => 'flirt', 'is_visible' => false, 'created_at' => now(), 'updated_at' => now()]);
    $u->forceFill(['status' => 'deleting', 'deletion_requested_at' => now()->subDays($daysAgo)])->save();

    return $u;
}

function dcLogin(array $extra = [], string $password = 'Motdepasse2026')
{
    app('auth')->forgetGuards();

    return test()->withHeader('X-Device-Id', DC_DEVICE)->postJson('/api/v1/auth/login', array_merge(
        ['email' => 'dc@example.com', 'password' => $password, 'platform' => 'ios'],
        $extra,
    ));
}

beforeEach(fn () => RateLimiter::clear('login-fail:dc@example.com|127.0.0.1'));

it('répond 403 deletion_pending avec la date de suppression, sans jeton, aux bons identifiants d’un compte en suppression', function () {
    $u = dcDeleting(2);

    $res = dcLogin()->assertForbidden()->assertJsonPath('error.code', 'deletion_pending');

    expect($res->json('token'))->toBeNull();
    $requested = strtotime((string) DB::table('users')->where('id', $u->id)->value('deletion_requested_at'));
    expect(strtotime($res->json('error.purge_at')))->toBe($requested + AccountDeletion::GRACE_DAYS * 86400);
    expect($u->fresh()->status)->toBe('deleting');
});

it('ne révèle rien sans le bon mot de passe : 401 invalid_credentials, même avec cancel_deletion', function () {
    $u = dcDeleting(2);

    dcLogin(['cancel_deletion' => true], 'MauvaisMotDePasse1')->assertUnauthorized()->assertJsonPath('error.code', 'invalid_credentials');

    expect($u->fresh()->status)->toBe('deleting');
});

it('réactive le compte avec cancel_deletion : session ouverte, suppression effacée, profil toujours masqué', function () {
    $u = dcDeleting(2);

    $res = dcLogin(['cancel_deletion' => true])->assertOk();

    expect($res->json('token'))->not->toBeNull()->and($res->json('user.id'))->toBe($u->id);
    $fresh = $u->fresh();
    expect($fresh->status)->toBe('active')->and($fresh->deletion_requested_at)->toBeNull();
    expect(DB::table('profiles')->where('user_id', $u->id)->value('is_visible'))->toBeFalse();

    // Le compte est de nouveau utilisable avec le jeton reçu.
    app('auth')->forgetGuards();
    test()->withHeader('Authorization', 'Bearer '.$res->json('token'))->getJson('/api/v1/me')->assertOk();
});

it('rend le statut d’origine : un bannissement ou une suspension en vigueur survit à l’annulation, une suspension expirée non', function () {
    $sanction = fn (string $userId, string $kind, ?string $endsAt) => DB::table('sanctions')->insert([
        'id' => (string) Str::uuid(), 'user_id' => $userId, 'kind' => $kind, 'reason' => 'test', 'starts_at' => now()->subDays(10),
        'ends_at' => $endsAt, 'created_at' => now()->subDays(10),
    ]);

    $banned = dcDeleting(2);
    $sanction($banned->id, 'ban', null);
    dcLogin(['cancel_deletion' => true])->assertOk();
    expect($banned->fresh()->status)->toBe('banned');

    DB::table('users')->where('id', $banned->id)->update(['status' => 'deleting', 'deletion_requested_at' => now()->subDay()]);
    DB::table('sanctions')->where('user_id', $banned->id)->update(['ends_at' => now()->subDay(), 'kind' => 'suspension']);
    dcLogin(['cancel_deletion' => true])->assertOk();
    expect($banned->fresh()->status)->toBe('active');

    DB::table('users')->where('id', $banned->id)->update(['status' => 'deleting', 'deletion_requested_at' => now()->subDay()]);
    $sanction($banned->id, 'suspension', now()->addDays(3)->toDateTimeString());
    dcLogin(['cancel_deletion' => true])->assertOk();
    expect($banned->fresh()->status)->toBe('suspended');
});

it('refuse l’annulation une fois le délai de grâce écoulé (le compte attend sa purge)', function () {
    $u = dcDeleting(AccountDeletion::GRACE_DAYS + 1);

    dcLogin(['cancel_deletion' => true])->assertForbidden()->assertJsonPath('error.code', 'account_restricted');

    expect($u->fresh()->status)->toBe('deleting');
});

it('laisse un compte déjà supprimé hors d’atteinte : account_restricted, cancel_deletion sans effet', function () {
    $u = dcDeleting(2);
    DB::table('users')->where('id', $u->id)->update(['status' => 'deleted']);

    dcLogin(['cancel_deletion' => true])->assertForbidden()->assertJsonPath('error.code', 'account_restricted');
});

it('ignore cancel_deletion sur un compte actif', function () {
    $u = dcDeleting(2);
    DB::table('users')->where('id', $u->id)->update(['status' => 'active', 'deletion_requested_at' => null]);

    dcLogin(['cancel_deletion' => true])->assertOk()->assertJsonPath('user.id', $u->id);
});

it('compte les essais ratés avec cancel_deletion comme une connexion ordinaire (429 au-delà de 5)', function () {
    dcDeleting(2);

    foreach (range(1, 5) as $i) {
        dcLogin(['cancel_deletion' => true], 'MauvaisMotDePasse1')->assertUnauthorized();
    }
    dcLogin(['cancel_deletion' => true], 'MauvaisMotDePasse1')->assertStatus(429)->assertJsonPath('error.code', 'rate_limited');
});

// ---------- connexion Google / Apple ----------

function dcOAuth(User $u, string $provider = 'google', string $subject = 'sub-dc'): void
{
    DB::table('auth_identities')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'provider' => $provider, 'provider_user_id' => $subject,
        'created_at' => now(), 'updated_at' => now()]);

    app()->bind(OAuthVerifier::class, fn () => new class($subject) implements OAuthVerifier
    {
        public function __construct(private string $sub) {}

        public function verify(string $provider, string $idToken): OAuthIdentity
        {
            return new OAuthIdentity($provider, $this->sub, 'dc@example.com', true);
        }
    });
}

function dcOAuthLogin(array $extra = [], string $provider = 'google')
{
    app('auth')->forgetGuards();

    return test()->withHeader('X-Device-Id', DC_DEVICE)->postJson('/api/v1/auth/oauth/'.$provider, array_merge(
        ['id_token' => 'x', 'platform' => 'android'],
        $extra,
    ));
}

it('connexion sociale : 403 deletion_pending sans cancel_deletion, réactivation avec', function () {
    $u = dcDeleting(3, ['password' => null]);
    dcOAuth($u);

    dcOAuthLogin()->assertForbidden()->assertJsonPath('error.code', 'deletion_pending')->assertJsonStructure(['error' => ['purge_at']]);
    expect($u->fresh()->status)->toBe('deleting');

    $res = dcOAuthLogin(['cancel_deletion' => true])->assertOk();
    expect($res->json('token'))->not->toBeNull()->and($u->fresh()->status)->toBe('active');
});

it('connexion sociale : un jeton invalide ne révèle pas la suppression en cours', function () {
    $u = dcDeleting(3, ['password' => null]);
    dcOAuth($u);
    app()->bind(OAuthVerifier::class, fn () => new class implements OAuthVerifier
    {
        public function verify(string $provider, string $idToken): OAuthIdentity
        {
            throw new InvalidOAuthToken;
        }
    });

    dcOAuthLogin(['cancel_deletion' => true])->assertUnauthorized()->assertJsonPath('error.code', 'invalid_oauth_token');
    expect($u->fresh()->status)->toBe('deleting');
});
