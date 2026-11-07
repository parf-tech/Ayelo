<?php

/*
 | Non-régression du lot 7 (messagerie, appels, médias, appareils) : F-14, F-24 (curseur), F-25, F-26, F-27, F-28
 | de docs/reviews/code-security-1.md. Un test par point, noms de fonctions préfixés r7 pour éviter les collisions.
 */

use App\Events\CallEvent;
use App\Jobs\CloseCallRoom;
use App\Events\ConversationSignal;
use App\Events\MessageCreated;
use App\Jobs\SendPush;
use App\Models\User;
use App\Services\Calls;
use App\Services\CallsRoomService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Support\FakeCallsRoomService;

function r7User(array $user = []): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1993-05-06'], $user));
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'R'.substr($u->id, 0, 5), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

/** Deux personnes avec une conversation (issue d'un match actif par défaut). @return array{0: User, 1: string, 2: User, 3: string, 4: string} */
function r7Pair(bool $match = true): array
{
    [$a, $ab] = r7User();
    [$b, $bb] = r7User();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $matchId = null;
    if ($match) {
        $matchId = (string) Str::uuid();
        DB::table('matches')->insert(['id' => $matchId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    }
    $conv = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $matchId, 'initiated_by' => $a->id,
        'unlocked_by' => $match ? 'match' : 'credit', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    return [$a, $ab, $b, $bb, $conv];
}

function r7As(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

function r7Rooms(): FakeCallsRoomService
{
    $fake = new FakeCallsRoomService;
    app()->instance(CallsRoomService::class, $fake);

    return $fake;
}

beforeEach(function () {
    Event::fake([CallEvent::class, ConversationSignal::class, MessageCreated::class]);
    // La fermeture de salle LiveKit passe par la file : elle s'exécute ici (file sync), les autres tâches restent simulées.
    Queue::fake()->except(CloseCallRoom::class);
});

// ---------- F-14 : appels ----------

it('F-14 : la création d’un appel prend un verrou sur l’appelant et l’appelé, un seul appel sonne par appelant et par appelé', function () {
    r7Rooms();
    [, $ab, , , $conv] = r7Pair();

    r7As($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertCreated()->assertJsonPath('status', 'ringing');
    // Verrous consultatifs de transaction conservés par la transaction englobante du test : les deux utilisateurs ont été verrouillés.
    $locks = DB::selectOne("select count(*) as n from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()");
    expect((int) $locks->n)->toBeGreaterThanOrEqual(2);

    // Même appelant : refusé ; une seule sonnerie en base.
    r7As($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertStatus(409)->assertJsonPath('error.code', 'already_in_call');
    expect(DB::table('call_sessions')->where('status', 'ringing')->count())->toBe(1);
});

it('F-14 : au plus 3 appels sans suite par heure vers la même personne', function () {
    $rooms = r7Rooms();
    [$a, $ab, , $bb, $conv] = r7Pair();

    foreach (range(1, Calls::MAX_UNANSWERED_PER_HOUR) as $i) {
        $id = r7As($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertCreated()->json('id');
        r7As($bb)->postJson("/api/v1/calls/$id/decline")->assertNoContent();
    }

    r7As($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertStatus(429)->assertJsonPath('error.code', 'call_limit');
    expect(DB::table('call_sessions')->where('caller_id', $a->id)->count())->toBe(3)->and(count($rooms->closed))->toBe(3);

    // L'autre sens (l'appelé devient appelant) n'est pas touché.
    $reverse = r7As($bb)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertCreated()->json('id');
    DB::table('call_sessions')->where('id', $reverse)->update(['status' => 'ended']);

    // Une heure plus tard, le plafond est levé.
    $this->travel(61)->minutes();
    r7As($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->assertCreated();
});

it('F-14 : la salle LiveKit est fermée au refus, à l’annulation, à la fin, à l’expiration d’une sonnerie et d’un appel trop long', function () {
    $rooms = r7Rooms();
    [, $ab, , $bb, $conv] = r7Pair();

    $declined = r7As($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->json('id');
    r7As($bb)->postJson("/api/v1/calls/$declined/decline")->assertNoContent();
    expect($rooms->closed)->toBe(['call-'.$declined]);

    $cancelled = r7As($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->json('id');
    r7As($ab)->postJson("/api/v1/calls/$cancelled/end")->assertNoContent();
    expect($rooms->closed)->toContain('call-'.$cancelled);

    $talk = r7As($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->json('id');
    r7As($bb)->postJson("/api/v1/calls/$talk/accept")->assertOk();
    r7As($bb)->postJson("/api/v1/calls/$talk/end")->assertNoContent();
    expect($rooms->closed)->toContain('call-'.$talk);

    // Expiration : sonnerie de plus de 30 s (manqué) puis appel accepté de plus de 20 minutes.
    [, $ab2, , $bb2, $conv2] = r7Pair();
    $missed = r7As($ab2)->postJson('/api/v1/calls', ['conversation_id' => $conv2, 'kind' => 'audio'])->json('id');
    $this->travel(31)->seconds();
    app(Calls::class)->expire();
    expect($rooms->closed)->toContain('call-'.$missed);

    $long = r7As($ab2)->postJson('/api/v1/calls', ['conversation_id' => $conv2, 'kind' => 'audio'])->json('id');
    r7As($bb2)->postJson("/api/v1/calls/$long/accept")->assertOk();
    $this->travel(21)->minutes();
    app(Calls::class)->expire();
    expect($rooms->closed)->toContain('call-'.$long)->and(DB::table('call_sessions')->where('id', $long)->value('status'))->toBe('ended');
});

it('F-14 : décrocher est refusé après un blocage ou après 30 s, et ferme la salle', function () {
    $rooms = r7Rooms();
    [$a, $ab, $b, $bb, $conv] = r7Pair();
    $id = r7As($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'audio'])->json('id');

    DB::table('blocks')->insert(['id' => (string) Str::uuid(), 'blocker_id' => $a->id, 'blocked_id' => $b->id, 'created_at' => now(), 'updated_at' => now()]);
    r7As($bb)->postJson("/api/v1/calls/$id/accept")->assertForbidden()->assertJsonPath('error.code', 'conversation_closed');
    expect(DB::table('call_sessions')->where('id', $id)->value('status'))->toBe('failed')->and($rooms->closed)->toBe(['call-'.$id]);

    DB::table('blocks')->delete();
    [, $ab2, , $bb2, $conv2] = r7Pair();
    $late = r7As($ab2)->postJson('/api/v1/calls', ['conversation_id' => $conv2, 'kind' => 'audio'])->json('id');
    $this->travel(35)->seconds();
    r7As($bb2)->postJson("/api/v1/calls/$late/accept")->assertStatus(409)->assertJsonPath('error.code', 'call_not_ringing');
});

// ---------- F-25 : courses, quotas atomiques ----------

it('F-25 : un client_id déjà inséré entre le contrôle et l’insertion renvoie le message existant (200), sans 500 ni diffusion en double', function () {
    [$a, $ab, , , $conv] = r7Pair();
    $clientId = (string) Str::uuid();
    $winner = (string) Str::uuid();
    $armed = true;

    // Course simulée : le concurrent insère le même client_id juste après `canWrite` (requête sur users) et avant notre insertion.
    DB::listen(function ($q) use (&$armed, $conv, $a, $clientId, $winner) {
        if ($armed && str_contains($q->sql, 'count(*)') && str_contains($q->sql, '"users"')) {
            $armed = false;
            DB::table('messages')->insert(['id' => $winner, 'conversation_id' => $conv, 'sender_id' => $a->id, 'client_id' => $clientId, 'type' => 'text',
                'body' => 'gagnant', 'created_at' => now()->toDateTimeString('microsecond'), 'updated_at' => now()]);
        }
    });

    $res = r7As($ab)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => $clientId, 'type' => 'text', 'body' => 'perdant'])->assertOk();
    expect($res->json('id'))->toBe($winner)->and($res->json('body'))->toBe('gagnant')->and(DB::table('messages')->where('client_id', $clientId)->count())->toBe(1);
    Event::assertNotDispatched(MessageCreated::class);
    Queue::assertNotPushed(SendPush::class);
});

it('F-25 : une conversation ouverte en même temps par la même paire renvoie la conversation existante (200) et ne dépense aucun crédit', function () {
    [$a, $ab] = r7User();
    [$b] = r7User();
    DB::table('credit_ledger')->insert(['id' => (string) Str::uuid(), 'user_id' => $a->id, 'credit_type' => 'conversation', 'delta' => 1, 'reason' => 'purchase',
        'idempotency_key' => 'r7-seed-'.$a->id, 'created_at' => now()]);
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $theirs = (string) Str::uuid();
    $armed = true;

    // Course simulée : l'autre personne ouvre la conversation après notre contrôle d'existence (lecture de l'abonnement Premium).
    DB::listen(function ($q) use (&$armed, $pair, $b, $theirs) {
        if ($armed && str_contains($q->sql, '"subscriptions"')) {
            $armed = false;
            DB::table('conversations')->insert(['id' => $theirs, 'user_a' => $pair[0], 'user_b' => $pair[1], 'initiated_by' => $b->id, 'unlocked_by' => 'premium',
                'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
        }
    });

    r7As($ab)->postJson('/api/v1/conversations', ['target_id' => $b->id])->assertOk()->assertJsonPath('id', $theirs);
    expect(DB::table('conversations')->where('user_a', $pair[0])->where('user_b', $pair[1])->count())->toBe(1)
        ->and((int) DB::table('credit_ledger')->where('user_id', $a->id)->sum('delta'))->toBe(1);
});

it('F-25 : le quota de likes gratuits est réservé de façon atomique, un rejeu n’en consomme pas', function () {
    config(['discovery.daily_likes_free' => 2]);
    [$me, $mb] = r7User();
    [$t1] = r7User();
    [$t2] = r7User();
    [$t3] = r7User();
    $count = fn () => (int) DB::table('daily_counters')->where(['user_id' => $me->id, 'day' => now()->toDateString(), 'kind' => 'likes'])->value('count');

    r7As($mb)->postJson('/api/v1/swipes', ['target_id' => $t1->id, 'action' => 'like'])->assertCreated();
    r7As($mb)->postJson('/api/v1/swipes', ['target_id' => $t1->id, 'action' => 'like'])->assertOk()->assertJsonPath('status', 'already_swiped');
    expect($count())->toBe(1);

    r7As($mb)->postJson('/api/v1/swipes', ['target_id' => $t2->id, 'action' => 'like'])->assertCreated();
    r7As($mb)->postJson('/api/v1/swipes', ['target_id' => $t3->id, 'action' => 'like'])->assertStatus(429)->assertJsonPath('error.code', 'quota_reached');
    expect($count())->toBe(2)->and(DB::table('swipes')->where('swiper_id', $me->id)->count())->toBe(2);

    // Réservation conditionnelle : un compteur déjà au plafond ne monte jamais au-dessus, même si le contrôle de lecture est contourné.
    $reserve = fn () => DB::select('insert into daily_counters (user_id, day, kind, count) values (?, ?, ?, 1) on conflict (user_id, day, kind) do update set count = daily_counters.count + 1 where daily_counters.count < ? returning count',
        [$me->id, now()->toDateString(), 'likes', 2]);
    expect($reserve())->toBe([])->and($count())->toBe(2);
});

it('F-25 : le quota de nouvelles conversations est contrôlé sous le verrou de l’utilisateur', function () {
    [$me, $mb] = r7User();
    DB::table('daily_counters')->insert(['user_id' => $me->id, 'day' => now()->toDateString(), 'kind' => 'new_conversations', 'count' => 10]);
    [$t] = r7User();

    r7As($mb)->postJson('/api/v1/conversations', ['target_id' => $t->id])->assertStatus(429)->assertJsonPath('error.code', 'quota_reached');
    expect(DB::table('conversations')->count())->toBe(0);
});

// ---------- F-26 : médias, même 404 ----------

it('F-26 : média inexistant et média d’autrui donnent exactement la même réponse 404', function () {
    [$owner] = r7User();
    [, $other] = r7User();
    $foreign = (string) Str::uuid();
    DB::table('media')->insert(['id' => $foreign, 'user_id' => $owner->id, 'kind' => 'profile_photo', 'status' => 'pending_upload', 'storage_key' => "u/{$owner->id}/p.jpg",
        'mime_type' => 'image/jpeg', 'position' => 0, 'created_at' => now(), 'updated_at' => now()]);
    $missing = (string) Str::uuid();

    foreach (['complete' => 'postJson', 'destroy' => 'deleteJson'] as $action => $verb) {
        $url = fn (string $id) => $action === 'complete' ? "/api/v1/media/$id/complete" : "/api/v1/media/$id";
        $a = r7As($other)->{$verb}($url($foreign));
        $b = r7As($other)->{$verb}($url($missing));
        $a->assertNotFound();
        $b->assertNotFound();
        expect($a->status())->toBe($b->status())->and($a->json('message'))->toBe($b->json('message'));
    }
    expect(DB::table('media')->where('id', $foreign)->exists())->toBeTrue();
});

// ---------- F-27 : accusés et canaux ----------

it('F-27 : accusés de lecture et de réception ignorés (aucun signal) si la conversation est bloquée ou un compte suspendu', function () {
    [$a, , $b, $bb, $conv] = r7Pair();
    $msg = (string) Str::uuid();
    DB::table('messages')->insert(['id' => $msg, 'conversation_id' => $conv, 'sender_id' => $a->id, 'client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => 'salut',
        'created_at' => now()->toDateTimeString('microsecond'), 'updated_at' => now()]);

    // Compte actif : l'accusé est enregistré et diffusé.
    r7As($bb)->postJson("/api/v1/conversations/$conv/delivered", ['up_to_message_id' => $msg])->assertNoContent();
    expect(DB::table('messages')->where('id', $msg)->value('delivered_at'))->not->toBeNull();
    Event::assertDispatched(ConversationSignal::class, fn ($e) => $e->name === 'message.delivered');

    // Blocage : rien n'est enregistré ni diffusé.
    Event::fake([ConversationSignal::class]);
    DB::table('blocks')->insert(['id' => (string) Str::uuid(), 'blocker_id' => $a->id, 'blocked_id' => $b->id, 'created_at' => now(), 'updated_at' => now()]);
    r7As($bb)->postJson("/api/v1/conversations/$conv/read", ['up_to_message_id' => $msg])->assertNoContent();
    expect(DB::table('messages')->where('id', $msg)->value('read_at'))->toBeNull();

    // Expéditeur suspendu (sans blocage) : idem.
    DB::table('blocks')->delete();
    DB::table('users')->where('id', $a->id)->update(['status' => 'suspended']);
    r7As($bb)->postJson("/api/v1/conversations/$conv/read", ['up_to_message_id' => $msg])->assertNoContent();
    expect(DB::table('messages')->where('id', $msg)->value('read_at'))->toBeNull();
    Event::assertNotDispatched(ConversationSignal::class);
});

it('F-27 : le canal d’une conversation est refusé si l’autre compte est suspendu ; un identifiant non uuid ne donne pas de 500', function () {
    [, $ab, $b, , $conv] = r7Pair();
    $auth = fn (string $channel) => r7As($ab)->postJson('/api/v1/broadcasting/auth', ['channel_name' => $channel, 'socket_id' => '1.2']);

    $auth("private-conversation.$conv")->assertOk();
    $auth('private-conversation.pas-un-uuid')->assertForbidden();
    DB::table('users')->where('id', $b->id)->update(['status' => 'suspended']);
    $auth("private-conversation.$conv")->assertForbidden();
});

// ---------- F-24 (part. messagerie) : curseur mal formé ----------

it('F-24 : un curseur de messages avec un texte accepté par strtotime est refusé en 422', function () {
    [, $ab, , , $conv] = r7Pair();
    $uuid = (string) Str::uuid();

    foreach (['tomorrow', 'next monday', '+1 week', '2026-02-31 10:00:00', '2026-11-07'] as $bad) {
        r7As($ab)->getJson("/api/v1/conversations/$conv/messages?cursor=".urlencode(base64_encode("$bad|$uuid")))->assertStatus(422);
    }
    r7As($ab)->getJson("/api/v1/conversations/$conv/messages?cursor=".urlencode(base64_encode('2026-11-07 10:00:00.123456+00|'.$uuid)))->assertOk();
});

// ---------- F-28 : aperçu push, jeton push, pose de vérification ----------

it('F-28 : la notification d’un message ne contient pas le texte par défaut, l’aperçu de 80 caractères revient avec PUSH_MESSAGE_PREVIEW', function () {
    [, $ab, $b, , $conv] = r7Pair();
    expect(config('push.message_preview'))->toBeFalse();
    $secret = str_repeat('secret ', 20);

    r7As($ab)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => $secret])->assertCreated();
    Queue::assertPushed(SendPush::class, fn ($j) => $j->userId === $b->id && $j->kind === 'messages' && ! str_contains($j->body, 'secret') && $j->body === 'Vous avez reçu un nouveau message.');

    config(['push.message_preview' => true]);
    r7As($ab)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => $secret])->assertCreated();
    Queue::assertPushed(SendPush::class, fn ($j) => str_starts_with($j->body, 'secret secret') && mb_strlen($j->body) <= 83 && ! str_contains($j->body, str_repeat('secret ', 12)));
});

it('F-28 : un jeton push connu n’est pas transférable à un autre compte sur un autre appareil ; même téléphone ou même compte : réaffecté', function () {
    [$a] = r7User();
    [$b] = r7User();
    $bearer = [];
    $devices = [];
    foreach ([['a', $a, 'fp-a'], ['b', $b, 'fp-b'], ['b2', $b, 'fp-a']] as [$name, $u, $fp]) {
        $token = $u->createToken($name);
        $devices[$name] = (string) Str::uuid();
        DB::table('devices')->insert(['id' => $devices[$name], 'user_id' => $u->id, 'token_id' => $token->accessToken->getKey(), 'platform' => 'android',
            'device_fingerprint_hash' => $fp, 'created_at' => now(), 'updated_at' => now()]);
        $bearer[$name] = 'Bearer '.$token->plainTextToken;
    }

    r7As($bearer['a'])->putJson('/api/v1/me/device', ['push_token' => 'victim-token'])->assertNoContent();

    // Autre compte, autre appareil : refus, le propriétaire garde son jeton.
    r7As($bearer['b'])->putJson('/api/v1/me/device', ['push_token' => 'victim-token'])->assertStatus(409)->assertJsonPath('error.code', 'push_token_in_use');
    expect(DB::table('devices')->where('id', $devices['a'])->value('push_token'))->toBe('victim-token')
        ->and(DB::table('devices')->where('id', $devices['b'])->value('push_token'))->toBeNull();

    // Même téléphone (même empreinte) sous un autre compte : réaffectation.
    r7As($bearer['b2'])->putJson('/api/v1/me/device', ['push_token' => 'victim-token'])->assertNoContent();
    expect(DB::table('devices')->where('id', $devices['b2'])->value('push_token'))->toBe('victim-token')
        ->and(DB::table('devices')->where('id', $devices['a'])->value('push_token'))->toBeNull();

    // Même compte, autre appareil : réaffectation.
    r7As($bearer['b'])->putJson('/api/v1/me/device', ['push_token' => 'victim-token'])->assertNoContent();
    expect(DB::table('devices')->where('id', $devices['b'])->value('push_token'))->toBe('victim-token')
        ->and(DB::table('devices')->where('id', $devices['b2'])->value('push_token'))->toBeNull();
});

it('F-28 : la pose de vérification est aléatoire, liée à la demande qui la consomme, et le selfie doit être postérieur à la consigne', function () {
    [$u, $b] = r7User();
    DB::table('user_consents')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'kind' => 'verification_biometric', 'version' => 'v1', 'granted' => true, 'created_at' => now(), 'updated_at' => now()]);
    $selfie = fn () => tap((string) Str::uuid(), fn ($id) => DB::table('media')->insert(['id' => $id, 'user_id' => $u->id, 'kind' => 'verification_selfie', 'status' => 'processing',
        'storage_key' => "k/$id", 'mime_type' => 'image/jpeg', 'position' => 0, 'created_at' => now()->addSeconds(5), 'updated_at' => now()]));

    // Sans consigne émise : refus.
    r7As($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $selfie()])->assertStatus(422)->assertJsonPath('error.code', 'pose_expired');

    $pose = r7As($b)->getJson('/api/v1/me/verification/pose')->assertOk()->json('pose');
    expect(Cache::get('verification-pose:'.$u->id)['pose'])->toBe($pose);

    // Selfie antérieur à la consigne : refus, la consigne n'est pas consommée.
    $old = (string) Str::uuid();
    DB::table('media')->insert(['id' => $old, 'user_id' => $u->id, 'kind' => 'verification_selfie', 'status' => 'processing', 'storage_key' => "k/$old",
        'mime_type' => 'image/jpeg', 'position' => 0, 'created_at' => now()->subHour(), 'updated_at' => now()]);
    r7As($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $old])->assertStatus(422)->assertJsonPath('error.code', 'selfie_before_pose');
    expect(Cache::has('verification-pose:'.$u->id))->toBeTrue();

    // Demande valide : la pose émise est enregistrée sur la demande et consommée.
    $id = r7As($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $selfie()])->assertCreated()->json('id');
    expect(DB::table('verification_requests')->where('id', $id)->value('pose_code'))->toBe($pose)->and(Cache::has('verification-pose:'.$u->id))->toBeFalse();
});
