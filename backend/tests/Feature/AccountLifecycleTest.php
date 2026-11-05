<?php

use App\Jobs\BuildDataExport;
use App\Mail\AccountDeletionMail;
use App\Models\User;
use App\Services\AccountDeletion;
use App\Services\OAuth\InvalidOAuthToken;
use App\Services\OAuth\OAuthIdentity;
use App\Services\OAuth\OAuthVerifier;
use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Support\FakeMediaStorage;

function lifeUser(array $o = []): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1990-01-01', 'password' => 'Motdepasse2026'], $o));
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'Cible', 'gender' => 'woman', 'origin_country' => 'CM',
        'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

function life(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

// ---------- suppression dans l'application ----------

it('exige le mot de passe, masque le profil, ferme les sessions et programme l’effacement', function () {
    [$u, $b] = lifeUser();
    DB::table('devices')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'platform' => 'ios', 'push_token' => 'tok', 'created_at' => now(), 'updated_at' => now()]);

    life($b)->deleteJson('/api/v1/me', ['password' => 'mauvais'])->assertForbidden();
    expect($u->fresh()->status)->toBe('active');

    life($b)->deleteJson('/api/v1/me', ['password' => 'Motdepasse2026'])->assertStatus(202)->assertJsonPath('purge_after_days', 30);

    expect($u->fresh()->status)->toBe('deleting')->and(DB::table('profiles')->where('user_id', $u->id)->value('is_visible'))->toBeFalse();
    expect(DB::table('devices')->where('user_id', $u->id)->count())->toBe(0);
    app('auth')->forgetGuards();
    life($b)->getJson('/api/v1/me')->assertUnauthorized();
});

it('ré-authentifie un compte social par un jeton frais du fournisseur', function () {
    [$u, $b] = lifeUser(['password' => null]);
    DB::table('auth_identities')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'provider' => 'google', 'provider_user_id' => 'sub-1', 'created_at' => now(), 'updated_at' => now()]);

    $bind = fn (string $sub) => app()->bind(OAuthVerifier::class, fn () => new class($sub) implements OAuthVerifier
    {
        public function __construct(private string $sub) {}

        public function verify(string $provider, string $idToken): OAuthIdentity
        {
            if ($idToken === 'invalide') {
                throw new InvalidOAuthToken('x');
            }

            return new OAuthIdentity($provider, $this->sub, null, false);
        }
    });

    $bind('sub-1');
    life($b)->deleteJson('/api/v1/me', [])->assertStatus(422);
    life($b)->deleteJson('/api/v1/me', ['provider' => 'google', 'id_token' => 'invalide'])->assertForbidden();

    $bind('autre-sujet');
    life($b)->deleteJson('/api/v1/me', ['provider' => 'google', 'id_token' => 'ok'])->assertForbidden();

    $bind('sub-1');
    life($b)->deleteJson('/api/v1/me', ['provider' => 'google', 'id_token' => 'ok'])->assertStatus(202);
    expect($u->fresh()->status)->toBe('deleting');
});

it('anonymise après 30 jours, efface médias et données, garde les signalements', function () {
    $storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $storage);
    [$u, $b] = lifeUser(['email' => 'cible@example.com']);
    [$reporter] = lifeUser(['email' => 'rapporteur@example.com']);

    DB::table('media')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'kind' => 'profile_photo', 'status' => 'approved', 'storage_key' => 'u/photo.jpg',
        'mime_type' => 'image/jpeg', 'position' => 0, 'created_at' => now(), 'updated_at' => now()]);
    DB::table('reports')->insert(['id' => (string) Str::uuid(), 'reporter_id' => $reporter->id, 'reported_id' => $u->id, 'reason' => 'fake_or_spam', 'status' => 'open', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('sanctions')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'kind' => 'ban', 'reason' => 'spam', 'starts_at' => now(), 'created_at' => now()]);

    life($b)->deleteJson('/api/v1/me', ['password' => 'Motdepasse2026'])->assertStatus(202);

    expect(app(AccountDeletion::class)->purgeDue())->toBe(0); // délai de grâce non écoulé
    $this->travel(31)->days();
    expect(app(AccountDeletion::class)->purgeDue())->toBe(1);

    $row = DB::table('users')->where('id', $u->id)->first();
    expect($row->status)->toBe('deleted')->and($row->email)->toBeNull()->and($row->password)->toBeNull();
    expect(DB::table('profiles')->where('user_id', $u->id)->exists())->toBeFalse()->and(DB::table('media')->where('user_id', $u->id)->exists())->toBeFalse();
    expect($storage->deleted)->toContain('u/photo.jpg');
    // Preuves conservées et contournement de bannissement empêché.
    expect(DB::table('reports')->where('reported_id', $u->id)->exists())->toBeTrue()->and(DB::table('sanctions')->where('user_id', $u->id)->exists())->toBeTrue();
    expect(DB::table('banned_identifiers')->where('kind', 'email')->where('reason', 'sanctioned_account_deleted')->exists())->toBeTrue();
});

it('exécute la commande planifiée accounts:purge', function () {
    $this->artisan('accounts:purge')->expectsOutputToContain('Comptes anonymisés : 0')->assertSuccessful();
});

// ---------- suppression depuis le web ----------

it('traite la demande web sans révéler l’existence du compte, puis supprime sur confirmation', function () {
    Mail::fake();
    [$u] = lifeUser(['email' => 'web@example.com']);

    test()->postJson('/api/v1/account-deletion-requests', ['email' => 'inconnu@example.com'])->assertStatus(202);
    test()->postJson('/api/v1/account-deletion-requests', ['email' => 'web@example.com'])->assertStatus(202);
    Mail::assertSent(AccountDeletionMail::class, 1);

    $sent = Mail::sent(AccountDeletionMail::class)->first();
    parse_str((string) parse_url($sent->link, PHP_URL_QUERY), $q);

    test()->postJson('/api/v1/account-deletion-requests/confirm', ['token' => 'faux.faux'])->assertStatus(422);
    test()->postJson('/api/v1/account-deletion-requests/confirm', ['token' => $q['token']])->assertStatus(202);
    expect($u->fresh()->status)->toBe('deleting');
    test()->postJson('/api/v1/account-deletion-requests/confirm', ['token' => $q['token']])->assertStatus(422);
});

// ---------- export ----------

it('génère un export JSON des données, une demande par jour, accessible à son seul propriétaire', function () {
    $storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $storage);
    Queue::fake();
    [$u, $b] = lifeUser(['email' => 'export@example.com']);
    [, $other] = lifeUser();

    $id = life($b)->postJson('/api/v1/me/export')->assertStatus(202)->json('id');
    Queue::assertPushed(BuildDataExport::class);
    life($b)->postJson('/api/v1/me/export')->assertStatus(429);

    life($b)->getJson("/api/v1/me/export/$id")->assertOk()->assertJsonPath('status', 'pending')->assertJsonPath('url', null);

    app(BuildDataExport::class, ['exportId' => $id])->handle(app(App\Services\DataExport::class));
    $res = life($b)->getJson("/api/v1/me/export/$id")->assertOk()->assertJsonPath('status', 'ready');
    expect($res->json('url'))->toContain('exports/'.$u->id);

    $json = json_decode(array_values($storage->contents)[0], true);
    expect($json['account']['email'])->toBe('export@example.com')->and($json['profile']['display_name'])->toBe('Cible')->and($json)->not->toHaveKey('password');

    life($other)->getJson("/api/v1/me/export/$id")->assertNotFound();
    $this->travel(8)->days();
    life($b)->getJson("/api/v1/me/export/$id")->assertJsonPath('status', 'expired');
});

// ---------- consentements ----------

it('historise les consentements et masque le profil au retrait des données sensibles', function () {
    [$u, $b] = lifeUser();

    life($b)->postJson('/api/v1/me/consents', ['kind' => 'marketing', 'granted' => true])->assertNoContent();
    life($b)->postJson('/api/v1/me/consents', ['kind' => 'marketing', 'granted' => false])->assertNoContent();
    life($b)->getJson('/api/v1/me/consents')->assertOk()->assertJsonPath('data.marketing.granted', false);
    expect(DB::table('user_consents')->where('user_id', $u->id)->where('kind', 'marketing')->count())->toBe(2);

    life($b)->postJson('/api/v1/me/consents', ['kind' => 'sensitive_data', 'granted' => false])->assertNoContent();
    expect(DB::table('profiles')->where('user_id', $u->id)->value('is_visible'))->toBeFalse();
    life($b)->postJson('/api/v1/me/consents', ['kind' => 'nimporte', 'granted' => true])->assertStatus(422);
});

// ---------- support ----------

it('crée et liste les demandes de support, avec un quota', function () {
    [, $b] = lifeUser();
    [, $other] = lifeUser();

    life($b)->postJson('/api/v1/support/tickets', ['subject' => 'Problème', 'body' => 'Mon message ne part pas.'])->assertCreated();
    life($b)->postJson('/api/v1/support/tickets', ['subject' => 'x', 'body' => 'court'])->assertStatus(422);
    expect(life($b)->getJson('/api/v1/support/tickets')->json('data'))->toHaveCount(1)->and(life($other)->getJson('/api/v1/support/tickets')->json('data'))->toHaveCount(0);

    foreach (range(1, 4) as $i) {
        life($b)->postJson('/api/v1/support/tickets', ['subject' => "Sujet $i", 'body' => 'Un autre message.'])->assertCreated();
    }
    life($b)->postJson('/api/v1/support/tickets', ['subject' => 'Trop', 'body' => 'Un sixième message.'])->assertStatus(429);
});
