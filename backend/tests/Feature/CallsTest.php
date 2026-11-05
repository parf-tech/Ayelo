<?php

use App\Events\CallEvent;
use App\Jobs\SendPush;
use App\Models\User;
use App\Services\Calls;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function caller(): array
{
    $u = User::factory()->create(['birthdate' => '1992-03-04']);
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'N'.substr($u->id, 0, 4), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

/** @return array{0: User, 1: string, 2: User, 3: string, 4: string} */
function matchedPair(bool $withMatch = true): array
{
    [$a, $ab] = caller();
    [$b, $bb] = caller();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $matchId = null;
    if ($withMatch) {
        $matchId = (string) Str::uuid();
        DB::table('matches')->insert(['id' => $matchId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    }
    $conv = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $matchId, 'initiated_by' => $a->id,
        'unlocked_by' => $withMatch ? 'match' : 'credit', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    return [$a, $ab, $b, $bb, $conv];
}

function call_as(string $b)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $b);
}

beforeEach(function () {
    Event::fake([CallEvent::class]);
    Queue::fake();
});

it('démarre un appel vidéo entre matchs : sonnerie, jeton LiveKit court limité à la salle, notification', function () {
    [$a, $ab, $b, , $conv] = matchedPair();

    $res = call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'video'])->assertCreated()->assertJsonPath('status', 'ringing');

    $jwt = (array) JWT::decode($res->json('livekit.token'), new Key(config('services.livekit.api_secret'), 'HS256'));
    expect($jwt['sub'])->toBe($a->id)->and($jwt['iss'])->toBe('testkey')->and($jwt['exp'] - $jwt['iat'])->toBe(600);
    $grants = (array) $jwt['video'];
    expect($grants['room'])->toBe($res->json('livekit.room'))->and($grants['roomJoin'])->toBeTrue()->and((array) $grants['canPublishSources'])->toContain('camera');

    Event::assertDispatched(CallEvent::class, fn ($e) => $e->name === 'call.incoming' && $e->channel === 'user.'.$b->id);
    Queue::assertPushed(SendPush::class, fn ($j) => $j->userId === $b->id && $j->kind === 'calls' && $j->data['type'] === 'call');
});

it('n’autorise la publication vidéo qu’aux appels vidéo', function () {
    [, $ab, , , $conv] = matchedPair();

    $token = call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertCreated()->json('livekit.token');
    $grants = (array) ((array) JWT::decode($token, new Key(config('services.livekit.api_secret'), 'HS256')))['video'];

    expect((array) $grants['canPublishSources'])->toBe(['microphone']);
});

it('réserve les appels aux matchs', function () {
    [, $ab, , , $conv] = matchedPair(withMatch: false);

    call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertForbidden()->assertJsonPath('error.code', 'match_required');
});

it('refuse un appel à un utilisateur bloqué et aux non-participants', function () {
    [$a, $ab, $b, $bb, $conv] = matchedPair();
    [, $intruder] = caller();

    call_as($intruder)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertNotFound();

    call_as($bb)->postJson('/api/v1/blocks', ['blocked_id' => $a->id])->assertNoContent();
    call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertForbidden();
});

it('signale « occupé » quand l’appelé est déjà en appel, et laisse une trace dans la conversation', function () {
    [, $ab, $b, , $conv] = matchedPair();
    [$c, $cb] = caller();
    // L'appelé est déjà en communication avec quelqu'un d'autre.
    DB::table('call_sessions')->insert(['id' => (string) Str::uuid(), 'conversation_id' => $conv, 'caller_id' => $c->id, 'callee_id' => $b->id, 'kind' => 'audio',
        'status' => 'accepted', 'livekit_room' => 'room-x', 'started_at' => now(), 'created_at' => now(), 'updated_at' => now()]);

    call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertOk()->assertJsonPath('status', 'busy');
    expect(DB::table('messages')->where('type', 'call_missed')->count())->toBe(1);
});

it('interdit deux appels simultanés pour le même appelant', function () {
    [, $ab, , , $conv] = matchedPair();
    call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertCreated();
    call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertStatus(409)->assertJsonPath('error.code', 'already_in_call');
});

it('permet à l’appelé d’accepter (jeton à son nom) ou de refuser, jamais à un tiers ni à l’appelant', function () {
    [$a, $ab, $b, $bb, $conv] = matchedPair();
    [, $intruder] = caller();
    $id = call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'video'])->json('id');

    call_as($ab)->postJson("/api/v1/calls/$id/accept")->assertForbidden();
    call_as($intruder)->postJson("/api/v1/calls/$id/accept")->assertNotFound();

    $res = call_as($bb)->postJson("/api/v1/calls/$id/accept")->assertOk()->assertJsonPath('status', 'accepted');
    expect(((array) JWT::decode($res->json('livekit.token'), new Key(config('services.livekit.api_secret'), 'HS256')))['sub'])->toBe($b->id);
    expect(DB::table('call_sessions')->where('id', $id)->value('started_at'))->not->toBeNull();
    call_as($bb)->postJson("/api/v1/calls/$id/accept")->assertStatus(409);
});

it('refuse un appel : l’appelant est prévenu et l’appel se termine', function () {
    [, $ab, , $bb, $conv] = matchedPair();
    $id = call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->json('id');

    call_as($bb)->postJson("/api/v1/calls/$id/decline")->assertNoContent();

    expect(DB::table('call_sessions')->where('id', $id)->value('status'))->toBe('declined');
    Event::assertDispatched(CallEvent::class, fn ($e) => $e->name === 'call.state' && $e->payload['state'] === 'declined');
});

it('l’appelant peut annuler pendant la sonnerie (appel manqué) et chacun peut raccrocher ensuite', function () {
    [, $ab, , $bb, $conv] = matchedPair();
    $id = call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->json('id');
    call_as($ab)->postJson("/api/v1/calls/$id/end")->assertNoContent();
    expect(DB::table('call_sessions')->where('id', $id)->value('status'))->toBe('missed')->and(DB::table('messages')->where('type', 'call_missed')->count())->toBe(1);

    $id2 = call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->json('id');
    call_as($bb)->postJson("/api/v1/calls/$id2/accept")->assertOk();
    call_as($bb)->postJson("/api/v1/calls/$id2/end")->assertNoContent();
    expect(DB::table('call_sessions')->where('id', $id2)->value('status'))->toBe('ended');
});

it('renouvelle le jeton pendant un appel, pas après', function () {
    [, $ab, , $bb, $conv] = matchedPair();
    $id = call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->json('id');
    call_as($bb)->postJson("/api/v1/calls/$id/accept")->assertOk();

    call_as($ab)->postJson("/api/v1/calls/$id/token")->assertOk()->assertJsonStructure(['livekit' => ['url', 'room', 'token']]);
    call_as($ab)->postJson("/api/v1/calls/$id/end")->assertNoContent();
    call_as($ab)->postJson("/api/v1/calls/$id/token")->assertStatus(409);
});

it('marque manqué un appel sans réponse après 30 s et termine un appel de plus de 20 minutes', function () {
    [, $ab, , $bb, $conv] = matchedPair();
    $ringing = call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->json('id');

    expect(app(Calls::class)->expire())->toBe(['missed' => 0, 'ended' => 0]);

    $this->travel(31)->seconds();
    expect(app(Calls::class)->expire())->toBe(['missed' => 1, 'ended' => 0]);
    expect(DB::table('call_sessions')->where('id', $ringing)->value('status'))->toBe('missed')->and(DB::table('messages')->where('type', 'call_missed')->count())->toBe(1);
    Event::assertDispatched(CallEvent::class, fn ($e) => $e->name === 'call.cancelled' && $e->payload['reason'] === 'missed');

    $live = call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->json('id');
    call_as($bb)->postJson("/api/v1/calls/$live/accept")->assertOk();
    $this->travel(21)->minutes();
    expect(app(Calls::class)->expire())->toBe(['missed' => 0, 'ended' => 1]);
    expect(DB::table('call_sessions')->where('id', $live)->value('status'))->toBe('ended');
    $this->artisan('calls:expire')->assertSuccessful();
});

it('valide les paramètres de l’appel', function () {
    [, $ab, , , $conv] = matchedPair();
    call_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'hologramme'])->assertStatus(422);
    call_as($ab)->postJson('/api/v1/calls', ['kind' => 'audio'])->assertStatus(422);
    app('auth')->forgetGuards();
    test()->withHeader('Authorization', '')->postJson('/api/v1/calls', [])->assertUnauthorized();
});
