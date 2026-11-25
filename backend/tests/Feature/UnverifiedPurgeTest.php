<?php

// Purge périodique des comptes jamais vérifiés (accounts:purge-unverified) : un compte créé par e-mail et mot de passe, dont l'adresse
// n'a jamais été vérifiée, sans aucune activité depuis `retention.unverified_account_days` jours (30 par défaut, valeur à confirmer
// avec la matrice juridique), est anonymisé. Ne touche jamais un compte vérifié, social, actif, payant ou visé par un signalement.

use App\Models\User;
use App\Services\AccountDeletion;
use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\FakeMediaStorage;

function up_user(array $user = [], int $ageDays = 40): User
{
    $u = User::factory()->create(array_merge(['birthdate' => '1990-01-01', 'password' => 'Motdepasse2026', 'email_verified_at' => null], $user));
    DB::table('users')->where('id', $u->id)->update(['created_at' => now()->subDays($ageDays), 'last_seen_at' => null]);
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'U'.substr($u->id, 0, 4), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);

    return $u->fresh();
}

function up_status(User $u): string
{
    return (string) DB::table('users')->where('id', $u->id)->value('status');
}

it('anonymise un compte jamais vérifié et inactif depuis plus de 30 jours', function () {
    $stale = up_user();

    expect(app(AccountDeletion::class)->purgeUnverified())->toBe(1);

    $row = DB::table('users')->where('id', $stale->id)->first();
    expect($row->status)->toBe('deleted')->and($row->email)->toBeNull()->and($row->password)->toBeNull();
    expect(DB::table('profiles')->where('user_id', $stale->id)->exists())->toBeFalse();
});

it('épargne les comptes récents, vérifiés ou actifs', function () {
    $recent = up_user(ageDays: 10);
    $verified = up_user(['email_verified_at' => now()->subDays(35)]);
    $seen = up_user();
    DB::table('users')->where('id', $seen->id)->update(['last_seen_at' => now()->subDays(5)]);
    $tokenUsed = up_user();
    DB::table('personal_access_tokens')->insert(['tokenable_type' => User::class, 'tokenable_id' => $tokenUsed->id, 'name' => 't', 'token' => hash('sha256', Str::random(40)),
        'abilities' => '["*"]', 'last_used_at' => now()->subDays(3), 'created_at' => now()->subDays(39), 'updated_at' => now()]);
    $phone = up_user(['phone' => '+33600000001', 'phone_verified_at' => now()->subDays(35)]);

    expect(app(AccountDeletion::class)->purgeUnverified())->toBe(0);

    foreach ([$recent, $verified, $seen, $tokenUsed, $phone] as $u) {
        expect(up_status($u))->toBe('active');
    }
});

it('épargne les comptes sociaux, payants ou visés par un signalement ou une sanction', function () {
    $social = up_user(['password' => null]);
    $identity = up_user();
    DB::table('auth_identities')->insert(['id' => (string) Str::uuid(), 'user_id' => $identity->id, 'provider' => 'google', 'provider_user_id' => 'g-1', 'created_at' => now(), 'updated_at' => now()]);
    $buyer = up_user();
    DB::table('credit_ledger')->insert(['id' => (string) Str::uuid(), 'user_id' => $buyer->id, 'credit_type' => 'conversation', 'delta' => 5, 'reason' => 'purchase',
        'idempotency_key' => 'k-up', 'created_at' => now()->subDays(35)]);
    $reported = up_user();
    $reporter = up_user(['email_verified_at' => now()]);
    DB::table('reports')->insert(['id' => (string) Str::uuid(), 'reporter_id' => $reporter->id, 'reported_id' => $reported->id, 'reason' => 'harassment', 'priority' => 0,
        'status' => 'open', 'created_at' => now()->subDays(35), 'updated_at' => now()]);
    $sanctioned = up_user();
    DB::table('sanctions')->insert(['id' => (string) Str::uuid(), 'user_id' => $sanctioned->id, 'kind' => 'warning', 'reason' => 'abus', 'starts_at' => now()->subDays(35), 'created_at' => now()->subDays(35)]);

    expect(app(AccountDeletion::class)->purgeUnverified())->toBe(0);

    foreach ([$social, $identity, $buyer, $reported, $sanctioned] as $u) {
        expect(up_status($u))->toBe('active');
    }
});

it('ne touche pas les comptes déjà en suppression ni supprimés', function () {
    $deleting = up_user();
    DB::table('users')->where('id', $deleting->id)->update(['status' => 'deleting', 'deletion_requested_at' => now()->subDay()]);

    expect(app(AccountDeletion::class)->purgeUnverified())->toBe(0);
    expect(up_status($deleting))->toBe('deleting');
});

it('le délai se règle (retention.unverified_account_days)', function () {
    $u = up_user(ageDays: 10);
    expect(app(AccountDeletion::class)->purgeUnverified())->toBe(0);

    config(['retention.unverified_account_days' => 7]);
    expect(app(AccountDeletion::class)->purgeUnverified())->toBe(1);
    expect(up_status($u))->toBe('deleted');
});

it('la panne sur un compte ne bloque pas les suivants', function () {
    $bad = up_user();
    $good = up_user();
    // Un jeton Apple illisible n'est pas bloquant ; une panne de stockage l'est : le compte reste actif et sera repris.
    app()->instance(MediaStorage::class, new class extends FakeMediaStorage
    {
        public function delete(string $key): void
        {
            throw new RuntimeException('stockage en panne');
        }
    });
    DB::table('media')->insert(['id' => (string) Str::uuid(), 'user_id' => $bad->id, 'kind' => 'profile_photo', 'status' => 'approved', 'storage_key' => 'k/bad',
        'mime_type' => 'image/jpeg', 'position' => 0, 'created_at' => now(), 'updated_at' => now()]);

    expect(app(AccountDeletion::class)->purgeUnverified())->toBe(1);

    expect(up_status($bad))->toBe('active')->and(up_status($good))->toBe('deleted');
});

it('la commande planifiée accounts:purge-unverified affiche le nombre de comptes anonymisés', function () {
    up_user();
    up_user();

    $this->artisan('accounts:purge-unverified')->expectsOutputToContain('Comptes jamais vérifiés anonymisés : 2')->assertExitCode(0);
});
