<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

const DEVICE = '11111111-2222-4333-8444-555555555555';

function ageToken(string $birthdate = '1990-05-10', string $device = DEVICE): string
{
    return test()->withHeader('X-Device-Id', $device)
        ->postJson('/api/v1/auth/age-check', ['birthdate' => $birthdate])
        ->assertOk()
        ->json('age_token');
}

function registerPayload(array $override = []): array
{
    // Le jeton n'est demandé que s'il n'est pas fourni : ageToken() modifie l'en-tête X-Device-Id du test.
    $ageToken = $override['age_token'] ?? ageToken();

    return array_replace_recursive([
        'email' => 'alice@example.com',
        'password' => 'Motdepasse2026',
        'age_token' => $ageToken,
        'platform' => 'android',
        'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true, 'marketing' => false],
    ], $override);
}

function asDevice(string $device = DEVICE)
{
    return test()->withHeader('X-Device-Id', $device);
}

// ---------- contrôle d'âge ----------

it('émet un jeton d’âge pour un majeur', function () {
    asDevice()->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])
        ->assertOk()
        ->assertJsonStructure(['age_token', 'expires_in']);
});

it('refuse un mineur avec un message neutre et mémorise le refus', function () {
    $minor = now()->subYears(16)->format('Y-m-d');

    asDevice()->postJson('/api/v1/auth/age-check', ['birthdate' => $minor])
        ->assertForbidden()
        ->assertJsonPath('error.code', 'age_not_eligible');

    // Une autre date sur le même appareil ne contourne pas le refus.
    asDevice()->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])
        ->assertForbidden();

    // Le refus est mémorisé pour l'appareil ET pour l'adresse IP (revue F-02).
    expect(DB::table('banned_identifiers')->where('kind', 'age_refusal')->count())->toBe(2);
});

it('accepte exactement 18 ans aujourd’hui et refuse 18 ans demain', function () {
    asDevice()->postJson('/api/v1/auth/age-check', ['birthdate' => now()->subYears(18)->format('Y-m-d')])->assertOk();

    asDevice('99999999-2222-4333-8444-555555555555')
        ->postJson('/api/v1/auth/age-check', ['birthdate' => now()->subYears(18)->addDay()->format('Y-m-d')])
        ->assertForbidden();
});

it('exige l’en-tête X-Device-Id', function () {
    $this->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

// ---------- inscription ----------

it('crée un compte avec la date de naissance du jeton, les consentements et un appareil', function () {
    $response = asDevice()->postJson('/api/v1/auth/register', registerPayload())
        ->assertCreated()
        ->assertJsonStructure(['token', 'user' => ['id', 'email', 'locale']]);

    $user = User::where('email', 'alice@example.com')->firstOrFail();
    expect($user->birthdate->toDateString())->toBe('1990-05-10');
    expect($user->password)->not->toBe('Motdepasse2026')->and(str_starts_with($user->password, '$argon2id$'))->toBeTrue();

    expect(DB::table('user_consents')->where('user_id', $user->id)->pluck('kind')->all())
        ->toContain('terms', 'privacy', 'sensitive_data', 'marketing');
    expect(DB::table('notification_prefs')->where('user_id', $user->id)->exists())->toBeTrue();
    expect(DB::table('devices')->where('user_id', $user->id)->where('platform', 'android')->exists())->toBeTrue();

    asDevice()->withHeader('Authorization', 'Bearer '.$response->json('token'))
        ->getJson('/api/v1/me')->assertOk()->assertJson(['email' => 'alice@example.com']);
});

it('refuse l’inscription sans jeton d’âge ou avec un jeton falsifié', function () {
    asDevice()->postJson('/api/v1/auth/register', registerPayload(['age_token' => 'faux']))
        ->assertStatus(422)->assertJsonPath('error.fields.age_token.0', fn ($v) => is_string($v));

    $payload = registerPayload();
    unset($payload['age_token']);
    asDevice()->postJson('/api/v1/auth/register', $payload)->assertStatus(422);
});

it('refuse un jeton d’âge émis pour un autre appareil', function () {
    $token = ageToken('1990-05-10', DEVICE);

    $payload = registerPayload(['age_token' => $token]);

    asDevice('aaaaaaaa-2222-4333-8444-555555555555')
        ->postJson('/api/v1/auth/register', $payload)
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['fields' => ['age_token']]]);
});

it('refuse un jeton d’âge expiré', function () {
    $token = ageToken();
    $this->travel(11)->minutes();

    asDevice()->postJson('/api/v1/auth/register', registerPayload(['age_token' => $token]))
        ->assertStatus(422);
});

it('refuse l’inscription sur un appareil au refus d’âge mémorisé', function () {
    $token = ageToken();
    asDevice()->postJson('/api/v1/auth/age-check', ['birthdate' => now()->subYears(15)->format('Y-m-d')]);

    $payload = registerPayload(['age_token' => $token]);

    asDevice()->postJson('/api/v1/auth/register', $payload)->assertForbidden();
});

it('exige les consentements obligatoires et un mot de passe solide', function () {
    asDevice()->postJson('/api/v1/auth/register', registerPayload(['consents' => ['terms' => false]]))
        ->assertStatus(422);

    asDevice()->postJson('/api/v1/auth/register', registerPayload(['password' => 'court1']))
        ->assertStatus(422);

    asDevice()->postJson('/api/v1/auth/register', registerPayload(['password' => 'uniquementdeslettres']))
        ->assertStatus(422);
});

it('refuse un e-mail déjà utilisé', function () {
    asDevice()->postJson('/api/v1/auth/register', registerPayload())->assertCreated();

    asDevice()->postJson('/api/v1/auth/register', registerPayload(['age_token' => ageToken()]))
        ->assertStatus(422);
});

// ---------- connexion ----------

it('connecte un compte existant et enregistre l’appareil', function () {
    asDevice()->postJson('/api/v1/auth/register', registerPayload())->assertCreated();

    $login = asDevice('bbbbbbbb-2222-4333-8444-555555555555')->postJson('/api/v1/auth/login', [
        'email' => 'ALICE@example.com', 'password' => 'Motdepasse2026', 'platform' => 'ios',
    ])->assertOk();

    expect(DB::table('devices')->where('platform', 'ios')->count())->toBe(1);
    asDevice()->withHeader('Authorization', 'Bearer '.$login->json('token'))->getJson('/api/v1/me')->assertOk();
});

it('renvoie la même erreur pour un e-mail inconnu et un mauvais mot de passe', function () {
    asDevice()->postJson('/api/v1/auth/register', registerPayload())->assertCreated();

    $wrong = asDevice()->postJson('/api/v1/auth/login', ['email' => 'alice@example.com', 'password' => 'mauvaisMotDePasse1', 'platform' => 'ios']);
    $unknown = asDevice()->postJson('/api/v1/auth/login', ['email' => 'personne@example.com', 'password' => 'mauvaisMotDePasse1', 'platform' => 'ios']);

    $wrong->assertUnauthorized();
    expect($unknown->status())->toBe(401)->and($unknown->json())->toBe($wrong->json());
});

it('refuse la connexion d’un compte suspendu', function () {
    asDevice()->postJson('/api/v1/auth/register', registerPayload())->assertCreated();
    User::where('email', 'alice@example.com')->update(['status' => 'suspended']);

    asDevice()->postJson('/api/v1/auth/login', ['email' => 'alice@example.com', 'password' => 'Motdepasse2026', 'platform' => 'ios'])
        ->assertForbidden()->assertJsonPath('error.code', 'account_restricted');
});

it('limite les tentatives de connexion à 5 par 15 minutes (429)', function () {
    foreach (range(1, 5) as $i) {
        asDevice()->postJson('/api/v1/auth/login', ['email' => 'x@example.com', 'password' => 'mauvaisMotDePasse1', 'platform' => 'ios'])
            ->assertUnauthorized();
    }

    asDevice()->postJson('/api/v1/auth/login', ['email' => 'x@example.com', 'password' => 'mauvaisMotDePasse1', 'platform' => 'ios'])
        ->assertStatus(429)->assertJsonPath('error.code', 'rate_limited');
});

// ---------- déconnexion ----------

it('révoque le jeton à la déconnexion', function () {
    $token = asDevice()->postJson('/api/v1/auth/register', registerPayload())->assertCreated()->json('token');

    asDevice()->withHeader('Authorization', 'Bearer '.$token)->postJson('/api/v1/auth/logout')->assertNoContent();

    // Le garde Sanctum met l'utilisateur en cache dans le test : on réinitialise avant de revérifier.
    app('auth')->forgetGuards();
    asDevice()->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/v1/me')->assertUnauthorized();
});
