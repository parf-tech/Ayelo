<?php

/*
 | Non-régression des résiduels de la seconde revue (docs/reviews/code-security-2.md) et de la revue S9.
 */

use App\Jobs\SendPush;
use App\Models\StaffUser;
use App\Models\User;
use App\Providers\AdminPanelProvider;
use App\Services\AccountDeletion;
use App\Services\Admin\SanctionLedger;
use App\Services\BannedIdentifiers;
use App\Services\Push\PushNotifier;
use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\Console\Output\BufferedOutput;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\FakeMediaStorage;

function r3_member(array $user = []): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1993-04-05', 'password' => 'Motdepasse2026'], $user));
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'R'.substr($u->id, 0, 6), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

function r3_as(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

// ---------- N-14 : balayage des clés orphelines ----------

it('N-14 : media:sweep-orphans supprime les objets sans ligne, au-delà du délai de grâce, et rien d’autre', function () {
    /** @var FakeMediaStorage $storage */
    $storage = app(MediaStorage::class);
    [$u] = r3_member();

    $storage->put('u/x/orphan-old.jpg', 'a', 'image/jpeg');
    $storage->modifiedAt['u/x/orphan-old.jpg'] = now()->subHours(72)->timestamp;
    $storage->put('u/x/orphan-recent.jpg', 'a', 'image/jpeg'); // peut être en cours d'écriture : épargné
    $storage->put('u/x/known.jpg', 'a', 'image/jpeg');
    $storage->modifiedAt['u/x/known.jpg'] = now()->subHours(72)->timestamp;
    Seed::media($u->id, 'profile_photo', 'processing', 'u/x/known.jpg');
    $storage->put('exports/x/old.json', '{}', 'application/json'); // hors préfixe u/ : autre purge
    $storage->modifiedAt['exports/x/old.json'] = now()->subHours(72)->timestamp;

    $this->artisan('media:sweep-orphans', ['--dry-run' => true])->expectsOutputToContain('Orphelins repérés : 1')->assertSuccessful();
    expect($storage->deleted)->toBe([]);

    $this->artisan('media:sweep-orphans')->expectsOutputToContain('Orphelins supprimés : 1')->assertSuccessful();
    expect($storage->deleted)->toBe(['u/x/orphan-old.jpg'])
        ->and(array_keys($storage->objects))->toEqualCanonicalizing(['u/x/orphan-recent.jpg', 'u/x/known.jpg', 'exports/x/old.json']);
});

it('N-14 : le balayage est planifié chaque jour', function () {
    $events = collect(app(Illuminate\Console\Scheduling\Schedule::class)->events())->filter(fn ($e) => str_contains($e->command, 'media:sweep-orphans'));
    expect($events)->toHaveCount(1);
});

// ---------- F-16 : alias d'e-mail ----------

it('F-16 : un alias Gmail (points, +tag, googlemail) d’une adresse bannie est refusé', function () {
    BannedIdentifiers::remember('email', 'John.Doe+promo@Gmail.com', 'sanctioned_account_deleted');

    foreach (['johndoe@gmail.com', 'j.o.h.n.d.o.e@gmail.com', 'johndoe+autre@gmail.com', 'JohnDoe@googlemail.com'] as $alias) {
        expect(BannedIdentifiers::has('email', $alias))->toBeTrue($alias);
    }
    expect(BannedIdentifiers::has('email', 'johndoe2@gmail.com'))->toBeFalse();
});

it('F-16 : hors Gmail, seul le +tag est ignoré (les points comptent) ; les empreintes anciennes restent reconnues', function () {
    BannedIdentifiers::remember('email', 'a.b+x@example.com', 'sanctioned_account_deleted');
    expect(BannedIdentifiers::has('email', 'a.b@example.com'))->toBeTrue()->and(BannedIdentifiers::has('email', 'ab@example.com'))->toBeFalse();

    // Empreinte écrite avant la normalisation (adresse exacte).
    DB::table('banned_identifiers')->insert(['id' => (string) Str::uuid(), 'kind' => 'email', 'value_hash' => BannedIdentifiers::hash('vieux.compte@gmail.com'),
        'reason' => 'sanctioned_account_deleted', 'created_at' => now()]);
    expect(BannedIdentifiers::has('email', 'vieux.compte@gmail.com'))->toBeTrue();
});

it('F-16 : la normalisation ne touche pas les autres types d’identifiants', function () {
    BannedIdentifiers::remember('phone', '+33612345678', 'sanctioned_account_deleted');
    expect(BannedIdentifiers::has('phone', '+33612345678'))->toBeTrue()->and(BannedIdentifiers::has('phone', '33612345678'))->toBeFalse();
    expect(BannedIdentifiers::normalize('age_refusal', 'device:Abc+1'))->toBe('device:abc+1');
});

it('F-16 : l’inscription par un alias d’une adresse bannie est refusée', function () {
    BannedIdentifiers::remember('email', 'cible.bannie@gmail.com', 'sanctioned_account_deleted');
    $device = (string) Str::uuid();
    app('auth')->forgetGuards();
    $age = test()->withHeader('Authorization', '')->withHeader('X-Device-Id', $device)->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-01-01', 'country' => 'FR'])->assertOk()->json('age_token');
    app('auth')->forgetGuards();
    $res = test()->withHeader('Authorization', '')->withHeader('X-Device-Id', $device)->postJson('/api/v1/auth/register', [
        'email' => 'ciblebannie+2@googlemail.com', 'password' => 'Motdepasse2026', 'age_token' => $age, 'platform' => 'ios',
    ]);
    expect($res->status())->toBeIn([403, 422]);
    expect(User::where('email', 'ciblebannie+2@googlemail.com')->exists())->toBeFalse();
});

// ---------- F-22 : quotas par type ----------

it('F-22 : le nombre de dépôts en attente est plafonné par type', function () {
    [, $b] = r3_member();
    $post = fn () => r3_as($b)->postJson('/api/v1/media/upload-url', ['kind' => 'verification_selfie', 'mime_type' => 'image/jpeg', 'size_bytes' => 1000]);

    foreach (range(1, 3) as $i) {
        $post()->assertCreated();
    }
    $post()->assertStatus(422)->assertJsonPath('error.code', 'validation_failed')->assertJsonStructure(['error' => ['fields' => ['kind']]]);
    expect(DB::table('media')->where('kind', 'verification_selfie')->count())->toBe(3);
});

it('F-22 : le quota quotidien par type se libère au bout de 24 heures', function () {
    config(['media.kinds.message_image.max_open' => 100, 'media.kinds.message_image.max_per_day' => 2]);
    [, $b] = r3_member();
    $post = fn () => r3_as($b)->postJson('/api/v1/media/upload-url', ['kind' => 'message_image', 'mime_type' => 'image/jpeg', 'size_bytes' => 1000]);

    $post()->assertCreated();
    $post()->assertCreated();
    $post()->assertStatus(422);
    // Un autre type n'est pas touché.
    r3_as($b)->postJson('/api/v1/media/upload-url', ['kind' => 'profile_photo', 'mime_type' => 'image/jpeg', 'size_bytes' => 1000])->assertCreated();

    $this->travel(25)->hours();
    $post()->assertCreated();
});

// ---------- F-06 : date de naissance et robustesse de la purge ----------

it('F-06 : la date de naissance est ramenée à l’année à l’anonymisation, et reste immuable ailleurs', function () {
    [$u] = r3_member(['birthdate' => '1990-06-15']);

    // Hors suppression, le déclencheur refuse toujours tout changement.
    expect(fn () => DB::transaction(fn () => DB::table('users')->where('id', $u->id)->update(['birthdate' => '1990-01-01'])))->toThrow(Illuminate\Database\QueryException::class);

    DB::table('users')->where('id', $u->id)->update(['status' => 'deleting', 'deletion_requested_at' => now()->subDays(31)]);
    expect(app(AccountDeletion::class)->purgeDue())->toBe(1);

    $row = DB::table('users')->where('id', $u->id)->first();
    expect($row->status)->toBe('deleted')->and($row->birthdate)->toBe('1990-01-01');
});

it('F-06 : une panne du stockage sur un compte n’interrompt pas la purge des suivants', function () {
    $failing = new class extends FakeMediaStorage
    {
        public function delete(string $key): void
        {
            if (str_contains($key, 'boom')) {
                throw new RuntimeException('stockage indisponible');
            }
            parent::delete($key);
        }
    };
    app()->instance(MediaStorage::class, $failing);
    Log::spy();

    [$bad] = r3_member();
    [$good] = r3_member();
    Seed::media($bad->id, 'profile_photo', 'approved', 'u/boom.jpg');
    Seed::media($good->id, 'profile_photo', 'approved', 'u/fine.jpg');
    DB::table('users')->whereIn('id', [$bad->id, $good->id])->update(['status' => 'deleting', 'deletion_requested_at' => now()->subDays(31)]);

    expect(app(AccountDeletion::class)->purgeDue())->toBe(1);

    expect(DB::table('users')->where('id', $good->id)->value('status'))->toBe('deleted');
    // Le compte en panne reste à reprendre, ses lignes de média aussi (les clés ne sont pas perdues).
    expect(DB::table('users')->where('id', $bad->id)->value('status'))->toBe('deleting')->and(DB::table('media')->where('user_id', $bad->id)->exists())->toBeTrue();
    Log::shouldHaveReceived('error')->once();
});

// ---------- N-13 : opérateur de la console ----------

it('N-13 : staff:create et staff:reset-2fa enregistrent l’opérateur de la console (STAFF_OPERATOR)', function () {
    config(['app.staff_operator' => 'alice@ops']);

    $this->artisan('staff:create', ['email' => 'op@ayelo.test', 'role' => 'support'])->assertSuccessful();
    expect(json_decode(Seed::audit('staff.created')->after, true))->toEqual(['email' => 'op@ayelo.test', 'role' => 'support', 'operator' => 'alice@ops', 'host' => gethostname()]);

    $this->artisan('staff:reset-2fa', ['email' => 'op@ayelo.test'])->assertSuccessful();
    expect(json_decode(Seed::audit('staff.2fa_reset')->after, true))->toEqual(['operator' => 'alice@ops', 'host' => gethostname()]);
});

it('N-13 : sans STAFF_OPERATOR, aucune clé opérateur n’est inventée', function () {
    config(['app.staff_operator' => null]);
    $this->artisan('staff:create', ['email' => 'sans@ayelo.test', 'role' => 'support'])->assertSuccessful();

    expect(json_decode(Seed::audit('staff.created')->after, true))->not->toHaveKey('operator');
});

// ---------- S9 : 2FA du personnel ----------

it('S9 : staff:reset-2fa émet un nouveau secret au lieu de laisser le compte sans 2FA', function () {
    $staff = Seed::staff('moderator');
    $old = $staff->totp_secret_encrypted;

    $out = new BufferedOutput;
    Artisan::call('staff:reset-2fa', ['email' => $staff->email], $out);
    $text = $out->fetch();

    $fresh = StaffUser::find($staff->id);
    expect($fresh->hasTwoFactor())->toBeTrue()->and($fresh->totp_secret_encrypted)->not->toBe($old)->and($text)->toContain($fresh->totp_secret_encrypted);
    expect(Seed::audit('staff.2fa_reset'))->not->toBeNull();
});

it('S9 : staff:create n’affiche pas mot de passe et secret 2FA dans la même sortie, sauf avec --show-secret', function () {
    $out = new BufferedOutput;
    Artisan::call('staff:create', ['email' => 'un@ayelo.test', 'role' => 'support'], $out);
    $secret = StaffUser::where('email', 'un@ayelo.test')->first()->totp_secret_encrypted;
    expect($secret)->not->toBeNull()->and($out->fetch())->not->toContain($secret);

    $out = new BufferedOutput;
    Artisan::call('staff:create', ['email' => 'deux@ayelo.test', 'role' => 'support', '--show-secret' => true], $out);
    expect($out->fetch())->toContain(StaffUser::where('email', 'deux@ayelo.test')->first()->totp_secret_encrypted);
});

// ---------- S9 : notifications push d'un compte sanctionné ----------

it('S9 : SendPush ignore les comptes qui ne sont pas actifs', function () {
    $sent = [];
    app()->instance(PushNotifier::class, new class($sent) implements PushNotifier
    {
        public function __construct(public array &$sent) {}

        public function send(string $platform, string $token, string $title, string $body, array $data = []): bool
        {
            $this->sent[] = $token;

            return true;
        }
    });

    foreach (['suspended', 'banned', 'deleting', 'active'] as $status) {
        [$u] = r3_member(['status' => $status]);
        DB::table('devices')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'platform' => 'android', 'push_token' => 'tok-'.$status, 'created_at' => now(), 'updated_at' => now()]);
        (new SendPush($u->id, 'messages', 't', 'b'))->handle(app(PushNotifier::class));
    }

    expect($sent)->toBe(['tok-active']);
});

// ---------- S9 : sanction sur un compte en suppression ----------

it('S9 : une sanction ne fait jamais passer un compte en suppression à « banned »', function () {
    [$u] = r3_member();
    DB::table('users')->where('id', $u->id)->update(['status' => 'deleting', 'deletion_requested_at' => now()]);

    expect(fn () => app(SanctionLedger::class)->issue($u->id, 'ban', 'spam', null, null, null))->toThrow(DomainException::class);
    expect(DB::table('users')->where('id', $u->id)->value('status'))->toBe('deleting');
});

// ---------- S9 : canaux temps réel ----------

it('S9 : /broadcasting/auth refuse le canal personnel d’un autre et la conversation d’un non-participant', function () {
    [$a, $ab] = r3_member();
    [$b] = r3_member();
    [, $intruder] = r3_member();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $conv = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $pair[0], 'user_b' => $pair[1], 'initiated_by' => $a->id, 'unlocked_by' => 'match', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    $auth = fn (string $bearer, string $channel) => r3_as($bearer)->postJson('/api/v1/broadcasting/auth', ['channel_name' => $channel, 'socket_id' => '123.456']);

    $auth($ab, 'private-user.'.$a->id)->assertOk();
    $auth($ab, 'private-user.'.$b->id)->assertForbidden();
    $auth($intruder, 'private-user.'.$a->id)->assertForbidden();
    $auth($ab, "private-conversation.$conv")->assertOk();
    $auth($intruder, "private-conversation.$conv")->assertForbidden();
});

// ---------- N-01 : garde de démarrage ----------

it('N-01 : en production sans ADMIN_DOMAIN, un avertissement critique est journalisé', function () {
    Log::spy();
    config(['app.admin_domain' => null]);

    AdminPanelProvider::warnIfUnbound(); // environnement de test : silence
    Log::shouldNotHaveReceived('critical');

    $original = app()['env'];
    app()->detectEnvironment(fn () => 'production');
    try {
        AdminPanelProvider::warnIfUnbound();
        Log::shouldHaveReceived('critical')->once();

        config(['app.admin_domain' => 'admin.example.test']);
        AdminPanelProvider::warnIfUnbound();
        Log::shouldHaveReceived('critical')->once(); // pas de second appel
    } finally {
        app()->detectEnvironment(fn () => $original);
    }
});
