<?php

/*
 | Non-régression des constats de la seconde revue (docs/reviews/code-security-2.md).
 */

use App\Models\User;
use App\Providers\AdminPanelProvider;
use App\Services\RevenueCatProcessor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

function r2_member(array $user = []): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1993-04-05', 'password' => 'Motdepasse2026'], $user));
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'R'.substr($u->id, 0, 6), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

function r2_as(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

function r2_login(string $email, string $password, ?string $ip = null)
{
    app('auth')->forgetGuards();
    $t = test()->withHeader('Authorization', '')->withHeader('X-Device-Id', (string) Str::uuid());

    return ($ip ? $t->withServerVariables(['REMOTE_ADDR' => $ip]) : $t)->postJson('/api/v1/auth/login', ['email' => $email, 'password' => $password, 'platform' => 'ios']);
}

// ---------- N-02 : un compte sanctionné peut lire sa sanction et la contester ----------

it('N-02 : un compte suspendu peut se reconnecter avec un jeton restreint, lire sa sanction et la contester', function () {
    [$u] = r2_member();
    $sid = (string) Str::uuid();
    DB::table('sanctions')->insert(['id' => $sid, 'user_id' => $u->id, 'kind' => 'suspension', 'reason' => 'spam', 'starts_at' => now(), 'created_at' => now()]);
    User::whereKey($u->id)->update(['status' => 'suspended']);

    $token = r2_login($u->email, 'Motdepasse2026')->assertOk()->json('token');
    $bearer = 'Bearer '.$token;

    r2_as($bearer)->getJson('/api/v1/me/sanctions')->assertOk()->assertJsonCount(1, 'data');
    r2_as($bearer)->postJson('/api/v1/appeals', ['sanction_id' => $sid, 'message' => 'Je conteste cette décision, ce message était légitime.'])->assertCreated();
    r2_as($bearer)->getJson('/api/v1/discover')->assertForbidden();
    r2_as($bearer)->getJson('/api/v1/conversations')->assertForbidden();
});

it('N-02 : un compte banni peut aussi contester, mais pas un compte supprimé', function () {
    [$banned] = r2_member();
    User::whereKey($banned->id)->update(['status' => 'banned']);
    r2_login($banned->email, 'Motdepasse2026')->assertOk();

    [$deleted] = r2_member();
    User::whereKey($deleted->id)->update(['status' => 'deleting']);
    r2_login($deleted->email, 'Motdepasse2026')->assertForbidden();
});

// ---------- N-06 : pas de verrouillage d'un compte par un tiers ----------

it('N-06 : des échecs venus d’ailleurs ne verrouillent pas le propriétaire légitime', function () {
    [$u] = r2_member();

    foreach (range(1, 6) as $i) {
        r2_login($u->email, 'MauvaisMotDePasse1', '203.0.113.50');
    }
    // L'attaquant est limité (même e-mail, même IP)...
    r2_login($u->email, 'MauvaisMotDePasse1', '203.0.113.50')->assertStatus(429);
    // ... mais le propriétaire, depuis une autre adresse, se connecte.
    r2_login($u->email, 'Motdepasse2026', '198.51.100.20')->assertOk();
});

it('N-06 : un bourrage d’identifiants réparti sur beaucoup d’IP est tout de même arrêté par e-mail', function () {
    [$u] = r2_member();
    $codes = [];
    foreach (range(1, 35) as $i) {
        $codes[] = r2_login($u->email, 'MauvaisMotDePasse1', '10.9.8.'.$i)->status();
    }

    expect($codes)->toContain(429)->and(array_search(429, $codes, true))->toBeGreaterThanOrEqual(30);
});

it('N-06 : une connexion réussie remet le compteur de l’IP à zéro', function () {
    [$u] = r2_member();
    foreach (range(1, 4) as $i) {
        r2_login($u->email, 'MauvaisMotDePasse1', '192.0.2.10')->assertUnauthorized();
    }
    r2_login($u->email, 'Motdepasse2026', '192.0.2.10')->assertOk();
    r2_login($u->email, 'MauvaisMotDePasse1', '192.0.2.10')->assertUnauthorized();
});

// ---------- N-04 : fenêtre de refus d'âge par IP courte ----------

it('N-04 : le refus d’âge lié à l’IP expire au bout de 30 minutes', function () {
    $ip = '203.0.113.99';
    $call = fn (string $birthdate) => test()->withHeader('Authorization', '')->withServerVariables(['REMOTE_ADDR' => $ip])
        ->withHeader('X-Device-Id', (string) Str::uuid())->postJson('/api/v1/auth/age-check', ['birthdate' => $birthdate]);

    $call(now()->subYears(15)->format('Y-m-d'))->assertForbidden();
    $call('1990-01-01')->assertForbidden();

    $this->travel(31)->minutes();
    $call('1990-01-01')->assertOk();
});

// ---------- F-23 : pas de media_id sur un message texte ----------

it('F-23 : un message texte avec media_id est refusé, une image sans media_id aussi', function () {
    [$a, $ab] = r2_member();
    [$b] = r2_member();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $m = (string) Str::uuid();
    DB::table('matches')->insert(['id' => $m, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    $conv = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $m, 'initiated_by' => $a->id, 'unlocked_by' => 'match', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    r2_as($ab)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => 'x', 'media_id' => (string) Str::uuid()])->assertStatus(422);
    r2_as($ab)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => 'image'])->assertStatus(422);
});

// ---------- F-08 : rejeu des événements d'utilisateur inconnu ----------

it('F-08 : la commande de rejeu applique les événements reçus avant que l’utilisateur existe', function () {
    Event::fake();
    $future = (string) Str::uuid();
    $evt = ['event' => ['id' => 'evt-replay', 'type' => 'NON_RENEWING_PURCHASE', 'app_user_id' => $future, 'product_id' => 'conversation_5', 'transaction_id' => 'tx-r', 'store' => 'APP_STORE']];

    expect(app(RevenueCatProcessor::class)->handle($evt))->toBe('ignored');
    $this->artisan('billing:replay-unknown')->expectsOutputToContain('Événements rejoués : 0')->assertSuccessful();

    User::factory()->create(['id' => $future, 'birthdate' => '1990-01-01']);
    $this->artisan('billing:replay-unknown')->expectsOutputToContain('Événements rejoués : 1')->assertSuccessful();
    expect((int) DB::table('credit_ledger')->where('user_id', $future)->sum('delta'))->toBe(5);
});

// ---------- N-01 : le panneau n'est servi que sur son domaine ----------

it('N-01 : le panneau est lié à ADMIN_DOMAIN quand il est configuré', function () {
    config(['app.admin_domain' => null]);
    expect(AdminPanelProvider::adminDomain())->toBeNull();

    config(['app.admin_domain' => 'admin.example.test']);
    expect(AdminPanelProvider::adminDomain())->toBe('admin.example.test');

    // Le fichier du fournisseur utilise bien cette valeur pour lier le panneau à un domaine.
    expect(file_get_contents(app_path('Providers/AdminPanelProvider.php')))->toContain('->domain(self::adminDomain())');
});

// ---------- F-10 résiduel : profil masqué par l'utilisateur ----------

it('F-10 : un profil masqué (is_visible=false) disparaît de la liste des matchs', function () {
    [$a, $ab] = r2_member();
    [$b] = r2_member();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    DB::table('matches')->insert(['id' => (string) Str::uuid(), 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    expect(r2_as($ab)->getJson('/api/v1/matches')->json('data.0.profile.user_id'))->toBe($b->id);
    DB::table('profiles')->where('user_id', $b->id)->update(['is_visible' => false]);
    expect(r2_as($ab)->getJson('/api/v1/matches')->json('data.0.profile'))->toBeNull();
});

// ---------- S2 : limites de débit atteintes (429) ----------

it('S2 : age-check, register et password-forgot finissent en 429', function (string $uri, array $payload, int $max) {
    app('auth')->forgetGuards();
    $last = 0;
    foreach (range(1, $max) as $i) {
        $last = test()->withHeader('Authorization', '')->withHeader('X-Device-Id', '11111111-1111-4111-8111-111111111111')
            ->postJson($uri, $payload)->status();
    }
    expect($last)->toBe(429);
})->with([
    'age-check' => ['/api/v1/auth/age-check', ['birthdate' => '1990-01-01', 'country' => 'FR'], 12],
    'register' => ['/api/v1/auth/register', ['email' => 'x@example.com', 'password' => 'Motdepasse2026'], 7],
    'password-forgot' => ['/api/v1/auth/password/forgot', ['email' => 'x@example.com'], 5],
]);

it('S2 : media-upload finit en 429 pour un compte', function () {
    [, $b] = r2_member();
    $last = 0;
    foreach (range(1, 22) as $i) {
        $last = r2_as($b)->postJson('/api/v1/media/upload-url', ['kind' => 'profile_photo', 'mime_type' => 'image/jpeg', 'size_bytes' => 1000])->status();
    }
    expect($last)->toBe(429);
});

it('un e-mail envoyé en tableau ne provoque pas de 500 (login, password-forgot)', function () {
    foreach (['/api/v1/auth/login', '/api/v1/auth/password/forgot'] as $uri) {
        app('auth')->forgetGuards();
        expect(test()->withHeader('Authorization', '')->postJson($uri, ['email' => ['a', 'b'], 'password' => 'x'])->status())->toBeLessThan(500);
    }
});
