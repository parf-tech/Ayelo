<?php

/*
 | Lot 11 (relectures) : fermeture des salles LiveKit hors transaction et hors requête, tests hermétiques, purge des dépôts
 | hors norme (les plus récents d'abord), état de sécurité non évincable, ré-authentification, verrous d'appareils,
 | ouverture de conversation, pose de vérification consommée après l'écriture. Voir docs/reviews/code-security-2-suivi.md.
 */

use App\Events\CallEvent;
use App\Jobs\CloseCallRoom;
use App\Models\User;
use App\Services\AgeGate;
use App\Services\Admin\SanctionLedger;
use App\Services\Calls;
use App\Services\CallsRoomService;
use App\Services\LiveKitRoomService;
use App\Services\Storage\MediaStorage;
use App\Support\SafetyState;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Support\FakeCallsRoomService;

function l11User(array $user = []): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1993-05-06', 'password' => 'Motdepasse2026'], $user));
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'L'.substr($u->id, 0, 5), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

function l11As(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

function l11Conversation(User $a, User $b, string $status = 'active'): string
{
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $id = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $id, 'user_a' => $pair[0], 'user_b' => $pair[1], 'initiated_by' => $a->id, 'unlocked_by' => 'credit',
        'status' => $status, 'created_at' => now(), 'updated_at' => now()]);

    return $id;
}

/** Appel qui sonne entre deux comptes. @return array{0: string, 1: string} identifiant et salle */
function l11Call(User $caller, User $callee): array
{
    $conv = l11Conversation($caller, $callee);
    $id = (string) Str::uuid();
    $room = 'call-'.$id;
    DB::table('call_sessions')->insert(['id' => $id, 'conversation_id' => $conv, 'caller_id' => $caller->id, 'callee_id' => $callee->id, 'kind' => 'audio',
        'status' => 'ringing', 'livekit_room' => $room, 'created_at' => now(), 'updated_at' => now()]);

    return [$id, $room];
}

// ---------- 1. salles fermées après la validation de la transaction ----------

it('SanctionLedger::issue : appels terminés et salle fermée seulement APRÈS la validation de la transaction', function () {
    Event::fake([CallEvent::class]);
    $rooms = app(CallsRoomService::class);
    expect($rooms)->toBeInstanceOf(FakeCallsRoomService::class);
    [$a] = l11User();
    [$b] = l11User();
    [$callId, $room] = l11Call($a, $b);

    DB::transaction(function () use ($b, $callId, $rooms) {
        app(SanctionLedger::class)->issue($b->id, 'suspension', 'motif', null, now()->addDay(), null);
        expect(DB::table('call_sessions')->where('id', $callId)->value('status'))->toBe('ringing')->and($rooms->closed)->toBe([]);
    });

    expect(DB::table('call_sessions')->where('id', $callId)->value('status'))->toBe('failed')->and($rooms->closed)->toBe([$room]);
});

it('SanctionLedger::issue : une transaction annulée ne termine aucun appel ni ne ferme de salle', function () {
    Event::fake([CallEvent::class]);
    $rooms = app(CallsRoomService::class);
    [$a] = l11User();
    [$b] = l11User();
    [$callId] = l11Call($a, $b);

    try {
        DB::transaction(function () use ($b) {
            app(SanctionLedger::class)->issue($b->id, 'ban', 'motif', null, null, null);
            throw new RuntimeException('annulation');
        });
    } catch (RuntimeException) {
    }

    expect(DB::table('call_sessions')->where('id', $callId)->value('status'))->toBe('ringing')->and($rooms->closed)->toBe([]);
});

// ---------- 2. fermeture de salle hors requête ----------

it('Calls::closeRoom : planifie une tâche sur la file « realtime » au lieu d’appeler LiveKit dans la requête', function () {
    Queue::fake();
    app(Calls::class)->closeRoom((object) ['livekit_room' => 'room-x']);
    Queue::assertPushedOn('realtime', CloseCallRoom::class, fn ($job) => $job->room === 'room-x');

    Queue::fake();
    app(Calls::class)->closeRoom((object) ['livekit_room' => null]);
    Queue::assertNothingPushed();
});

it('CloseCallRoom : une panne LiveKit est journalisée, jamais propagée', function () {
    $rooms = new class implements CallsRoomService
    {
        public function closeRoom(string $room): bool
        {
            throw new RuntimeException('LiveKit hors service');
        }
    };

    (new CloseCallRoom('room-x'))->handle($rooms);

    expect(true)->toBeTrue();
});

it('Calls::expire et la fin d’appel ferment la salle via la file (exécutée en sync dans les tests)', function () {
    Event::fake([CallEvent::class]);
    $rooms = app(CallsRoomService::class);
    [$a, $ab] = l11User();
    [$b, $bb] = l11User();
    [, $room] = l11Call($a, $b);

    $this->travel(31)->seconds();
    expect(app(Calls::class)->expire())->toBe(['missed' => 1, 'ended' => 0])->and($rooms->closed)->toBe([$room]);
});

// ---------- 3. tests hermétiques ----------

it('les tests sont hermétiques : salles LiveKit simulées par défaut, requête HTTP sortante non déclarée refusée', function () {
    expect(app(CallsRoomService::class))->toBeInstanceOf(FakeCallsRoomService::class)
        ->and(app(MediaStorage::class))->toBeInstanceOf(Tests\Support\FakeMediaStorage::class);
    expect(fn () => Http::get('https://exemple-non-declare.test/'))->toThrow(RuntimeException::class);

    Http::fake(['https://declare.test/*' => Http::response('ok')]);
    expect(Http::get('https://declare.test/x')->body())->toBe('ok');
});

// ---------- 7. LiveKit : l'échec de signature ne remonte jamais ----------

it('LiveKitRoomService : une clé trop courte (échec de signature JWT) est journalisée et renvoie false', function () {
    config(['services.livekit.api_secret' => 'court']);

    expect((new LiveKitRoomService)->closeRoom('room-x'))->toBeFalse();
});

// ---------- 4. media:purge-oversized : les plus récents d'abord ----------

it('media:purge-oversized contrôle les dépôts les plus récents d’abord quand le plafond par passage est atteint', function () {
    $storage = app(MediaStorage::class);
    [$u] = l11User();
    config(['media.purge_oversized_max' => 2]);

    $make = function (int $minutesAgo, int $position) use ($u, $storage) {
        $id = (string) Str::uuid();
        $key = "u/{$u->id}/$id";
        DB::table('media')->insert(['id' => $id, 'user_id' => $u->id, 'kind' => 'message_image', 'status' => 'pending_upload', 'storage_key' => $key,
            'mime_type' => 'image/jpeg', 'size_bytes' => 1000, 'position' => $position, 'created_at' => now()->subMinutes($minutesAgo), 'updated_at' => now()]);
        $storage->simulateUpload($key, 5 * 1024 * 1024 * 1024, 'image/jpeg'); // hors norme

        return $id;
    };

    $oldest = $make(60, 0);
    $middle = $make(30, 1);
    $newest = $make(1, 2);

    $this->artisan('media:purge-oversized')->assertSuccessful();

    expect(DB::table('media')->where('id', $newest)->exists())->toBeFalse()
        ->and(DB::table('media')->where('id', $middle)->exists())->toBeFalse()
        ->and(DB::table('media')->where('id', $oldest)->exists())->toBeTrue();

    config(['media.purge_oversized_max' => 2000]);
    $this->artisan('media:purge-oversized')->assertSuccessful();
    expect(DB::table('media')->where('id', $oldest)->exists())->toBeFalse();
});

// ---------- 5. état de sécurité dans un magasin non évincable ----------

it('safety.state_store : jeton d’âge à usage unique et compteur de ré-authentification vivent hors du cache par défaut', function () {
    config(['cache.stores.l11state' => ['driver' => 'array', 'serialize' => false], 'safety.state_store' => 'l11state']);

    $gate = app(AgeGate::class);
    $token = $gate->issueToken('1990-01-01', 'device-l11');
    expect($gate->claimToken($token))->toBeTrue()->and($gate->claimToken($token))->toBeFalse();
    Cache::store()->flush(); // éviction du cache par défaut : le jeton reste consommé
    expect($gate->claimToken($token))->toBeFalse();
    Cache::store('l11state')->flush(); // éviction du magasin d'état : seule elle réarme le jeton
    expect($gate->claimToken($token))->toBeTrue();

    [$u, $b] = l11User();
    l11As($b)->postJson('/api/v1/me/export', ['password' => 'mauvais'])->assertForbidden();
    $key = 'reauth-fail:'.$u->id.'|127.0.0.1';
    expect(SafetyState::limiter()->attempts($key))->toBe(1)
        ->and(app(Illuminate\Cache\RateLimiter::class)->attempts($key))->toBe(0);
});

it('safety.state_store : sans configuration, le magasin de cache par défaut est utilisé', function () {
    config(['safety.state_store' => null]);

    SafetyState::store()->put('l11-k', 1, 60);

    expect(Cache::store()->get('l11-k'))->toBe(1);
});

// ---------- 8. ré-authentification : compteur remis à zéro, clé compte + IP ----------

it('reauthenticate : un succès remet le compteur d’échecs à zéro ; la clé inclut l’IP', function () {
    [$u, $b] = l11User();

    foreach (range(1, 4) as $_) {
        l11As($b)->postJson('/api/v1/me/export', ['password' => 'mauvais'])->assertForbidden();
    }
    expect(SafetyState::limiter()->attempts('reauth-fail:'.$u->id.'|127.0.0.1'))->toBe(4);

    l11As($b)->postJson('/api/v1/me/export', ['password' => 'Motdepasse2026'])->assertStatus(202);
    expect(SafetyState::limiter()->attempts('reauth-fail:'.$u->id.'|127.0.0.1'))->toBe(0);

    // Sans remise à zéro, ces 4 échecs auraient atteint le plafond de 5 : ils restent des 403.
    foreach (range(1, 4) as $_) {
        l11As($b)->postJson('/api/v1/me/export', ['password' => 'mauvais'])->assertForbidden();
    }
});

it('reauthenticate : 5 échecs depuis une même IP bloquent (429), une autre IP du même compte n’est pas bloquée', function () {
    [, $b] = l11User();

    foreach (range(1, 5) as $_) {
        l11As($b)->postJson('/api/v1/me/export', ['password' => 'mauvais'])->assertForbidden();
    }
    l11As($b)->postJson('/api/v1/me/export', ['password' => 'Motdepasse2026'])->assertStatus(429);

    l11As($b)->withServerVariables(['REMOTE_ADDR' => '10.1.2.3'])->postJson('/api/v1/me/export', ['password' => 'Motdepasse2026'])->assertStatus(202);
});

// ---------- 9. sonde de santé limitée ----------

it('GET /health est limité à 60 requêtes par minute', function () {
    foreach (range(1, 60) as $_) {
        $this->getJson('/api/v1/health')->assertOk();
    }

    $this->getJson('/api/v1/health')->assertStatus(429);
});

// ---------- 6. appareils et ouverture de conversation ----------

it('DeviceController : les verrous de lignes sont pris dans l’ordre des identifiants', function () {
    [$u] = l11User();
    $token = $u->createToken('d');
    $deviceId = (string) Str::uuid();
    DB::table('devices')->insert(['id' => $deviceId, 'user_id' => $u->id, 'token_id' => $token->accessToken->getKey(), 'platform' => 'android',
        'device_fingerprint_hash' => 'fp', 'created_at' => now(), 'updated_at' => now()]);

    $locking = [];
    DB::listen(function ($q) use (&$locking) {
        if (str_contains($q->sql, 'for update') && str_contains($q->sql, 'devices')) {
            $locking[] = $q->sql;
        }
    });

    l11As('Bearer '.$token->plainTextToken)->putJson('/api/v1/me/device', ['push_token' => 'tok-l11'])->assertNoContent();

    expect($locking)->toHaveCount(1)->and($locking[0])->toContain('order by "id" asc');
});

it('ConversationController::store : collision d’idempotence du crédit sans conversation = 409 rejouable, pas de 500 ni de crédit perdu', function () {
    [$a, $ab] = l11User();
    [$b] = l11User();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    foreach (range(1, 2) as $i) {
        DB::table('credit_ledger')->insert(['id' => (string) Str::uuid(), 'user_id' => $a->id, 'credit_type' => 'conversation', 'delta' => 1, 'reason' => 'purchase',
            'idempotency_key' => "grant-$i", 'created_at' => now()]);
    }
    DB::table('credit_ledger')->insert(['id' => (string) Str::uuid(), 'user_id' => $a->id, 'credit_type' => 'conversation', 'delta' => -1, 'reason' => 'spend_conversation',
        'ref_type' => 'conversation', 'ref_id' => (string) Str::uuid(), 'idempotency_key' => 'open:'.$pair[0].':'.$pair[1], 'created_at' => now()]);

    $res = l11As($ab)->postJson('/api/v1/conversations', ['target_id' => $b->id])->assertStatus(409);

    expect($res->json('error.code'))->toBe('conversation_conflict')
        ->and(DB::table('conversations')->count())->toBe(0)
        ->and((int) DB::table('credit_ledger')->where('user_id', $a->id)->sum('delta'))->toBe(1);
});

it('ConversationController::store : une conversation existante bloquée n’est plus rendue (403), une conversation active l’est (200)', function () {
    [$a, $ab] = l11User();
    [$b] = l11User();
    $conv = l11Conversation($a, $b);

    l11As($ab)->postJson('/api/v1/conversations', ['target_id' => $b->id])->assertOk()->assertJsonPath('id', $conv);

    DB::table('conversations')->where('id', $conv)->update(['status' => 'archived']);
    l11As($ab)->postJson('/api/v1/conversations', ['target_id' => $b->id])->assertForbidden()->assertJsonPath('error.code', 'conversation_closed');
});

// ---------- 11. pose de vérification consommée après l'écriture ----------

it('VerificationController::store : un échec de l’insertion en base ne brûle pas la consigne de pose', function () {
    [$u, $b] = l11User();
    DB::table('user_consents')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'kind' => 'verification_biometric', 'version' => 'v1', 'granted' => true, 'created_at' => now(), 'updated_at' => now()]);
    $selfie = (string) Str::uuid();
    DB::table('media')->insert(['id' => $selfie, 'user_id' => $u->id, 'kind' => 'verification_selfie', 'status' => 'processing', 'storage_key' => "k/$selfie",
        'mime_type' => 'image/jpeg', 'position' => 0, 'created_at' => now()->addSeconds(5), 'updated_at' => now()]);

    $pose = l11As($b)->getJson('/api/v1/me/verification/pose')->assertOk()->json('pose');

    DB::unprepared(<<<'SQL'
        create function l11_fail() returns trigger language plpgsql as $$ begin raise exception 'echec simule'; end $$;
        create trigger l11_trigger before insert on verification_requests for each row execute function l11_fail();
    SQL);
    l11As($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $selfie])->assertStatus(500);
    expect(Cache::get('verification-pose:'.$u->id)['pose'])->toBe($pose)->and(DB::table('verification_requests')->count())->toBe(0);

    DB::unprepared('drop trigger l11_trigger on verification_requests; drop function l11_fail();');
    $id = l11As($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $selfie])->assertCreated()->json('id');

    expect(DB::table('verification_requests')->where('id', $id)->value('pose_code'))->toBe($pose)
        ->and(Cache::has('verification-pose:'.$u->id))->toBeFalse();
});
