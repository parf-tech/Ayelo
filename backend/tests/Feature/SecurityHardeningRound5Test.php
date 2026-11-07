<?php

/*
 | Décisions du propriétaire sur la deuxième revue de sécurité (docs/DECISIONS-PROPRIETAIRE.md) :
 | Q1-B (F-02, refus d'âge), Q2-B (F-09, signaleurs crédibles), Q3-B (N-12, plafonds d'administration).
 */

use App\Models\User;
use App\Services\Admin\UserAdmin;
use App\Services\AgeGate;
use App\Services\BannedIdentifiers;
use App\Services\OAuth\InvalidOAuthToken;
use App\Services\OAuth\OAuthIdentity;
use App\Services\OAuth\OAuthVerifier;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\Feature\Admin\Support\Seed;

const R5_D1 = 'aaaaaaaa-1111-4333-8444-555555555551';
const R5_D2 = 'aaaaaaaa-1111-4333-8444-555555555552';
const R5_D3 = 'aaaaaaaa-1111-4333-8444-555555555553';

function r5_from(string $device, string $ip)
{
    app('auth')->forgetGuards();

    return test()->withHeader('X-Device-Id', $device)->withServerVariables(['REMOTE_ADDR' => $ip]);
}

function r5_minor(string $device, string $ip): void
{
    r5_from($device, $ip)->postJson('/api/v1/auth/age-check', ['birthdate' => now()->subYears(16)->format('Y-m-d')])->assertForbidden();
}

function r5_token(string $device, string $ip): string
{
    return r5_from($device, $ip)->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])->assertOk()->json('age_token');
}

function r5_register(string $device, string $ip, string $email, ?string $token = null)
{
    return r5_from($device, $ip)->postJson('/api/v1/auth/register', [
        'email' => $email, 'password' => 'Motdepasse2026', 'age_token' => $token ?? 'invalide', 'platform' => 'android',
        'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true],
    ]);
}

function r5_fake_identity(string $sub, ?string $email, bool $verified = true): void
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

function r5_oauth(string $device, string $ip, ?string $token = null)
{
    return r5_from($device, $ip)->postJson('/api/v1/auth/oauth/google', [
        'id_token' => 'ok', 'platform' => 'ios', 'age_token' => $token,
        'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true],
    ]);
}

// ---------- Q1-B : refus d'âge ----------

it('Q1-B : la clé d’IP regroupe une IPv6 sur son /64 et laisse l’IPv4 telle quelle', function () {
    expect(AgeGate::ipKey('2001:db8:1:2::1'))->toBe(AgeGate::ipKey('2001:db8:1:2:abcd:ef01:2345:6789'))
        ->and(AgeGate::ipKey('2001:db8:1:2::1'))->not->toBe(AgeGate::ipKey('2001:db8:1:3::1'))
        ->and(AgeGate::ipKey('203.0.113.5'))->toBe('ip:203.0.113.5')
        ->and(AgeGate::ipKey('::ffff:203.0.113.5'))->toBe('ip:203.0.113.5');
});

it('Q1-B : un refus d’âge vaut pour tout le /64 IPv6, pas pour un autre /64', function () {
    r5_minor(R5_D1, '2001:db8:aaaa:1::10');

    r5_from(R5_D2, '2001:db8:aaaa:1:ffff::1')->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])->assertForbidden();
    r5_from(R5_D3, '2001:db8:aaaa:2::10')->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])->assertOk();
});

it('Q1-B : l’expiration de 30 minutes par IP et de 90 jours par appareil est conservée', function () {
    r5_minor(R5_D1, '203.0.113.5');
    r5_from(R5_D2, '203.0.113.5')->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])->assertForbidden();

    $this->travel(31)->minutes();
    r5_from(R5_D2, '203.0.113.5')->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])->assertOk();
    r5_from(R5_D1, '203.0.113.99')->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])->assertForbidden();

    $this->travel(91)->days();
    r5_from(R5_D1, '203.0.113.99')->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-05-10'])->assertOk();
});

it('Q1-B : l’e-mail présenté depuis un appareil refusé est mémorisé (HMAC) et refusé ailleurs, alias compris', function () {
    r5_minor(R5_D1, '203.0.113.5');
    r5_register(R5_D1, '203.0.113.5', 'Jean.Dupont@gmail.com')->assertForbidden()->assertJsonPath('error.code', 'age_not_eligible');

    // Autre appareil, autre IP, jeton d’âge valide : même identité (alias Gmail) refusée.
    $token = r5_token(R5_D2, '198.51.100.7');
    r5_register(R5_D2, '198.51.100.7', 'jeandupont+bis@gmail.com', $token)->assertForbidden()->assertJsonPath('error.code', 'age_not_eligible');
    expect(User::where('email', 'jeandupont+bis@gmail.com')->exists())->toBeFalse();

    // Une autre adresse n’est pas touchée.
    r5_register(R5_D2, '198.51.100.7', 'autre@example.com', $token)->assertCreated();

    // Seule l’empreinte est stockée, jamais l’adresse.
    $hash = BannedIdentifiers::hash('email:jeandupont@gmail.com');
    $row = DB::table('banned_identifiers')->where('kind', 'age_refusal')->where('value_hash', $hash)->first();
    expect($row)->not->toBeNull()->and($row->reason)->toBe('age_under_18');
    expect(DB::table('banned_identifiers')->where('value_hash', 'like', '%jean%')->exists())->toBeFalse();
    expect(Carbon\Carbon::parse($row->expires_at)->isAfter(now()->addDays(89)))->toBeTrue();
});

it('Q1-B : le refus est étendu à l’identité sociale et à l’e-mail vérifié, depuis n’importe quel appareil', function () {
    r5_minor(R5_D1, '203.0.113.5');
    r5_fake_identity('sub-minor', 'minor@example.com');
    r5_oauth(R5_D1, '203.0.113.5')->assertForbidden()->assertJsonPath('error.code', 'age_not_eligible');

    $token = r5_token(R5_D2, '198.51.100.7');
    // Même identifiant social, e-mail différent.
    r5_fake_identity('sub-minor', 'nouveau@example.com');
    r5_oauth(R5_D2, '198.51.100.7', $token)->assertForbidden();
    // Autre identifiant social, même e-mail.
    r5_fake_identity('sub-other', 'minor@example.com');
    r5_oauth(R5_D2, '198.51.100.7', $token)->assertForbidden();
    // Identité sans lien : inscription possible.
    r5_fake_identity('sub-free', 'libre@example.com');
    r5_oauth(R5_D2, '198.51.100.7', $token)->assertCreated();

    expect(DB::table('banned_identifiers')->where('value_hash', BannedIdentifiers::hash('social:google:sub-minor'))->exists())->toBeTrue();
});

it('Q1-B : un e-mail non vérifié par le fournisseur n’est pas mémorisé, l’identifiant social si', function () {
    r5_minor(R5_D1, '203.0.113.5');
    r5_fake_identity('sub-x', 'victime@example.com', false);
    r5_oauth(R5_D1, '203.0.113.5')->assertForbidden();

    expect((new AgeGate)->isEmailRefused('victime@example.com'))->toBeFalse()
        ->and((new AgeGate)->isSocialRefused('google', 'sub-x'))->toBeTrue();
});

// ---------- Q2-B : signaleurs crédibles ----------

function r5_member(array $user = []): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1993-04-05'], $user));
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'R'.substr($u->id, 0, 6), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

function r5_old(array $user = []): array
{
    return r5_member(array_merge(['created_at' => now()->subDays(10)], $user));
}

function r5_pair(string $a, string $b): array
{
    $p = [$a, $b];
    sort($p, SORT_STRING);

    return $p;
}

function r5_converse(string $a, string $b): void
{
    $p = r5_pair($a, $b);
    DB::table('conversations')->insert(['id' => (string) Str::uuid(), 'user_a' => $p[0], 'user_b' => $p[1], 'initiated_by' => $a,
        'unlocked_by' => 'credit', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
}

function r5_match(string $a, string $b): void
{
    $p = r5_pair($a, $b);
    DB::table('matches')->insert(['id' => (string) Str::uuid(), 'user_a' => $p[0], 'user_b' => $p[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
}

function r5_report(string $bearer, string $targetId, string $reason = 'minor_suspected')
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer)->postJson('/api/v1/reports', ['reported_id' => $targetId, 'reason' => $reason])->assertCreated();
}

function r5_status(string $id): string
{
    return (string) DB::table('users')->where('id', $id)->value('status');
}

it('Q2-B : la configuration fixe l’âge minimal du signaleur à 7 jours', function () {
    expect(config('safety.reporter_min_age_days'))->toBe(7);
});

it('Q2-B : un compte de moins de 7 jours ne suspend pas, même avec une conversation', function () {
    [$target] = r5_member();
    [$young, $bearer] = r5_member();
    r5_converse($young->id, $target->id);

    r5_report($bearer, $target->id);

    expect(r5_status($target->id))->toBe('active')->and((int) DB::table('reports')->value('priority'))->toBe(2);
});

it('Q2-B : un e-mail non vérifié ne suspend pas', function () {
    [$target] = r5_member();
    [$u, $bearer] = r5_old(['email_verified_at' => null]);
    r5_converse($u->id, $target->id);

    r5_report($bearer, $target->id);

    expect(r5_status($target->id))->toBe('active');
});

it('Q2-B : sans interaction avec la cible, pas de suspension', function () {
    [$target] = r5_member();
    [, $bearer] = r5_old();

    r5_report($bearer, $target->id);

    expect(r5_status($target->id))->toBe('active');
});

it('Q2-B : un compte établi avec un match (sans conversation) suspend', function () {
    [$target] = r5_member();
    [$u, $bearer] = r5_old();
    r5_match($u->id, $target->id);

    r5_report($bearer, $target->id);

    expect(r5_status($target->id))->toBe('suspended')
        ->and(DB::table('sanctions')->where('user_id', $target->id)->value('reason'))->toBe('preventive_minor_suspected');
});

it('Q2-B : un second signaleur distinct compte seulement s’il est lui-même crédible', function () {
    // Premier signaleur sans ancienneté (conversation) : non crédible. Le second, établi mais sans interaction, ne suspend pas.
    [$target] = r5_member();
    [$young, $b1] = r5_member();
    r5_converse($young->id, $target->id);
    r5_report($b1, $target->id);
    [, $b2] = r5_old();
    r5_report($b2, $target->id);
    expect(r5_status($target->id))->toBe('active');

    // Premier signaleur crédible : la cible est suspendue puis réactivée ; un second signaleur établi suffit alors.
    [$target2] = r5_member();
    [$c1, $bc1] = r5_old();
    r5_match($c1->id, $target2->id);
    r5_report($bc1, $target2->id);
    expect(r5_status($target2->id))->toBe('suspended');
    DB::table('users')->where('id', $target2->id)->update(['status' => 'active']);
    [, $bc2] = r5_old();
    r5_report($bc2, $target2->id);
    expect(r5_status($target2->id))->toBe('suspended');
});

it('Q2-B : l’âge minimal est lu dans la configuration', function () {
    config(['safety.reporter_min_age_days' => 30]);
    [$target] = r5_member();
    [$u, $bearer] = r5_old();
    r5_converse($u->id, $target->id);

    r5_report($bearer, $target->id);

    expect(r5_status($target->id))->toBe('active');
});

function r5_decided_reports(string $reporterId, int $dismissed, int $actioned = 0): void
{
    foreach (range(1, $dismissed + $actioned) as $i) {
        $target = r5_member()[0];
        DB::table('reports')->insert([
            'id' => (string) Str::uuid(), 'reporter_id' => $reporterId, 'reported_id' => $target->id, 'reason' => 'harassment',
            'status' => $i <= $dismissed ? 'dismissed' : 'actioned', 'created_at' => now()->subDays(3), 'updated_at' => now()->subDays(2),
        ]);
    }
}

it('Q2-B : 5 signalements rejetés et aucun confirmé déclenchent une alerte et une ligne d’audit, une fois par jour', function () {
    Log::spy();
    [$u, $bearer] = r5_old();
    r5_decided_reports($u->id, 5);

    r5_report($bearer, r5_member()[0]->id, 'other');
    r5_report($bearer, r5_member()[0]->id, 'other');

    $rows = DB::table('audit_logs')->where('action', 'reporter.abnormal_ratio')->where('subject_id', $u->id)->get();
    expect($rows)->toHaveCount(1)->and($rows[0]->actor_staff_id)->toBeNull();
    Log::shouldHaveReceived('warning')->once();
});

it('Q2-B : pas d’alerte avec un signalement confirmé, ni avec moins de 5 signalements tranchés', function () {
    [$u, $bearer] = r5_old();
    r5_decided_reports($u->id, 5, 1);
    r5_report($bearer, r5_member()[0]->id, 'other');

    [$v, $bearerV] = r5_old();
    r5_decided_reports($v->id, 4);
    r5_report($bearerV, r5_member()[0]->id, 'other');

    expect(DB::table('audit_logs')->where('action', 'reporter.abnormal_ratio')->count())->toBe(0);
});

// ---------- Q3-B : plafonds d'administration ----------

it('Q3-B : les plafonds par défaut sont 2000 crédits et 366 jours de Premium par jour', function () {
    expect(config('admin.daily_credit_cap'))->toBe(2000)->and(config('admin.daily_premium_days_cap'))->toBe(366);
});

it('Q3-B : le plafond quotidien de crédits refuse l’excès, écrit admin.cap_exceeded et se libère après 24 h', function () {
    config(['admin.daily_credit_cap' => 50]);
    $admin = Seed::staff('admin');
    $other = Seed::staff('admin');
    $u = Seed::user();
    $svc = app(UserAdmin::class);

    $svc->adjustCredits($admin, $u->id, 'coin', 30, 'Geste commercial');
    expect(fn () => $svc->adjustCredits($admin, $u->id, 'coin', 30, 'Geste commercial'))->toThrow(DomainException::class, 'Plafond quotidien');

    expect((int) DB::table('credit_ledger')->where('user_id', $u->id)->sum('delta'))->toBe(30)
        ->and(Seed::auditCount('credits.adjusted'))->toBe(1);
    $row = Seed::audit('admin.cap_exceeded');
    expect($row->actor_staff_id)->toBe($admin->id)->and($row->subject_id)->toBe($u->id)
        ->and(json_decode($row->after, true))->toMatchArray(['requested' => 30, 'attempted_action' => 'credits.adjusted'])
        ->and(json_decode($row->before, true))->toMatchArray(['used_24h' => 30, 'cap' => 50]);

    // Un retrait n’est pas plafonné ; un autre administrateur a son propre plafond ; le reste du plafond reste utilisable.
    $svc->adjustCredits($admin, $u->id, 'coin', -10, 'Correction d’erreur');
    $svc->adjustCredits($other, $u->id, 'coin', 50, 'Geste commercial');
    $svc->adjustCredits($admin, $u->id, 'coin', 20, 'Geste commercial');
    expect(fn () => $svc->adjustCredits($admin, $u->id, 'coin', 1, 'Geste commercial'))->toThrow(DomainException::class);

    $this->travel(25)->hours();
    $svc->adjustCredits($admin, $u->id, 'coin', 50, 'Geste commercial');
    expect(Seed::auditCount('admin.cap_exceeded'))->toBe(2);
});

it('Q3-B : le plafond quotidien de jours de Premium refuse l’excès et une révocation ne le libère pas', function () {
    config(['admin.daily_premium_days_cap' => 40]);
    $admin = Seed::staff('admin');
    $u = Seed::user();
    $svc = app(UserAdmin::class);

    $svc->grantPremium($admin, $u->id, now()->addDays(30), 'Offert pour compensation');
    expect(fn () => $svc->grantPremium($admin, $u->id, now()->addDays(20), 'Offert pour compensation'))->toThrow(DomainException::class, 'Plafond quotidien');
    expect(DB::table('subscriptions')->where('user_id', $u->id)->count())->toBe(1);
    $row = Seed::audit('admin.cap_exceeded');
    expect($row->actor_staff_id)->toBe($admin->id)->and(json_decode($row->after, true))->toMatchArray(['requested' => 20, 'attempted_action' => 'premium.granted']);

    $svc->revokePremium($admin, (string) DB::table('subscriptions')->where('user_id', $u->id)->value('id'), 'Retrait suite à erreur');
    expect(fn () => $svc->grantPremium($admin, $u->id, now()->addDays(20), 'Offert pour compensation'))->toThrow(DomainException::class);

    $svc->grantPremium($admin, $u->id, now()->addDays(10), 'Offert pour compensation');
    expect(Seed::auditCount('admin.cap_exceeded'))->toBe(2);
});

it('Q3-B : un acteur sans droit reçoit un refus d’autorisation et aucune ligne cap_exceeded', function () {
    config(['admin.daily_credit_cap' => 10]);
    $support = Seed::staff('support');
    $u = Seed::user();

    expect(fn () => app(UserAdmin::class)->adjustCredits($support, $u->id, 'coin', 50, 'Geste commercial'))->toThrow(AuthorizationException::class);
    expect(Seed::auditCount('admin.cap_exceeded'))->toBe(0);
});
