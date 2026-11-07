<?php

use App\Events\ConversationSignal;
use App\Events\MatchCreated;
use App\Events\MessageCreated;
use App\Jobs\SendPush;
use App\Models\User;
use App\Services\Push\PushNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function person(array $profile = [], array $user = []): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1995-06-15'], $user));
    DB::table('profiles')->insert(array_merge([
        'id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'P'.substr($u->id, 0, 5), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now(),
    ], $profile));
    DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

function acting(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

/** @return array{0: User, 1: string, 2: User, 3: string, 4: string} deux membres avec une conversation issue d'un match */
function matched(): array
{
    [$a, $ab] = person();
    [$b, $bb] = person();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $matchId = (string) Str::uuid();
    $convId = (string) Str::uuid();
    DB::table('matches')->insert(['id' => $matchId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('conversations')->insert(['id' => $convId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $matchId, 'initiated_by' => $a->id,
        'unlocked_by' => 'match', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    return [$a, $ab, $b, $bb, $convId];
}

function say(string $bearer, string $conv, string $text = 'Salut', ?string $clientId = null)
{
    return acting($bearer)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => $clientId ?? (string) Str::uuid(), 'type' => 'text', 'body' => $text]);
}

beforeEach(function () {
    Event::fake([MessageCreated::class, ConversationSignal::class, MatchCreated::class]);
    Queue::fake();
});

// ---------- messages ----------

it('envoie un message, le diffuse et notifie le destinataire', function () {
    [$a, $ab, $b, , $conv] = matched();

    $res = say($ab, $conv, 'Bonjour !')->assertCreated()->assertJsonPath('body', 'Bonjour !')->assertJsonPath('sender_id', $a->id);

    Event::assertDispatched(MessageCreated::class, fn ($e) => $e->conversationId === $conv && $e->message['id'] === $res->json('id'));
    Queue::assertPushed(SendPush::class, fn ($j) => $j->userId === $b->id && $j->kind === 'messages');
    expect(DB::table('conversations')->where('id', $conv)->value('last_message_at'))->not->toBeNull();
});

it('est idempotent : un renvoi avec le même client_id ne crée pas de doublon', function () {
    [, $ab, , , $conv] = matched();
    $cid = (string) Str::uuid();

    $first = say($ab, $conv, 'Une fois', $cid)->assertCreated();
    $again = say($ab, $conv, 'Une fois', $cid)->assertOk();

    expect($again->json('id'))->toBe($first->json('id'))->and(DB::table('messages')->count())->toBe(1);
    Event::assertDispatchedTimes(MessageCreated::class, 1);
});

it('refuse l’accès aux messages d’une conversation dont on n’est pas membre', function () {
    [, , , , $conv] = matched();
    [, $intruder] = person();

    acting($intruder)->getJson("/api/v1/conversations/$conv/messages")->assertNotFound();
    say($intruder, $conv)->assertNotFound();
    acting($intruder)->postJson("/api/v1/conversations/$conv/read", ['up_to_message_id' => (string) Str::uuid()])->assertNotFound();
    acting($intruder)->postJson("/api/v1/conversations/$conv/typing")->assertNotFound();
});

it('valide le contenu : message vide, trop long, type inconnu', function () {
    [, $ab, , , $conv] = matched();

    say($ab, $conv, '   ')->assertStatus(422);
    say($ab, $conv, str_repeat('a', 2001))->assertStatus(422);
    acting($ab)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => 'gif', 'body' => 'x'])->assertStatus(422);
});

it('interdit d’écrire après un blocage ou une rupture, des deux côtés', function () {
    [$a, $ab, $b, $bb, $conv] = matched();
    say($ab, $conv)->assertCreated();

    acting($bb)->postJson('/api/v1/blocks', ['blocked_id' => $a->id])->assertNoContent();

    say($ab, $conv)->assertForbidden()->assertJsonPath('error.code', 'conversation_closed');
    say($bb, $conv)->assertForbidden();
});

it('interdit d’écrire à un compte suspendu', function () {
    [$a, $ab, $b, , $conv] = matched();
    User::whereKey($b->id)->update(['status' => 'suspended']);

    say($ab, $conv)->assertForbidden();
});

it('pagine l’historique par curseur', function () {
    [, $ab, , , $conv] = matched();
    foreach (range(1, 5) as $i) {
        say($ab, $conv, "m$i")->assertCreated();
    }

    $p1 = acting($ab)->getJson("/api/v1/conversations/$conv/messages?limit=2")->assertOk();
    $p2 = acting($ab)->getJson("/api/v1/conversations/$conv/messages?limit=2&cursor=".urlencode($p1->json('next_cursor')))->assertOk();
    $p3 = acting($ab)->getJson("/api/v1/conversations/$conv/messages?limit=2&cursor=".urlencode($p2->json('next_cursor')))->assertOk();

    $ids = collect([$p1, $p2, $p3])->flatMap(fn ($p) => collect($p->json('data'))->pluck('id'));
    expect($ids)->toHaveCount(5)->and($ids->unique())->toHaveCount(5)->and($p3->json('next_cursor'))->toBeNull();
});

it('accepte un média approuvé du bon type et refuse les autres', function () {
    [$a, $ab, , , $conv] = matched();
    $media = fn (string $kind, string $status, ?string $owner = null) => tap((string) Str::uuid(), fn ($id) => DB::table('media')->insert([
        'id' => $id, 'user_id' => $owner ?? $a->id, 'kind' => $kind, 'status' => $status, 'storage_key' => "k/$id", 'mime_type' => 'image/jpeg',
        'position' => 0, 'created_at' => now(), 'updated_at' => now()]));
    $send = fn (string $type, string $mediaId) => acting($ab)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => $type, 'media_id' => $mediaId]);

    $send('image', $media('message_image', 'approved'))->assertCreated();
    $send('image', $media('message_image', 'processing'))->assertStatus(422);
    $send('image', $media('profile_photo', 'approved'))->assertStatus(422);
    $send('image', $media('message_image', 'approved', person()[0]->id))->assertStatus(422);
    $send('voice', $media('message_image', 'approved'))->assertStatus(422);
});

it('suit lu / remis et diffuse les signaux', function () {
    [, $ab, , $bb, $conv] = matched();
    $m1 = say($ab, $conv, 'un')->json('id');
    $m2 = say($ab, $conv, 'deux')->json('id');

    acting($bb)->postJson("/api/v1/conversations/$conv/delivered", ['up_to_message_id' => $m2])->assertNoContent();
    acting($bb)->postJson("/api/v1/conversations/$conv/read", ['up_to_message_id' => $m1])->assertNoContent();

    expect(DB::table('messages')->whereNotNull('read_at')->count())->toBe(1)->and(DB::table('messages')->whereNotNull('delivered_at')->count())->toBe(2);
    Event::assertDispatched(ConversationSignal::class, fn ($e) => $e->name === 'message.read');

    acting($bb)->postJson("/api/v1/conversations/$conv/typing")->assertNoContent();
    Event::assertDispatched(ConversationSignal::class, fn ($e) => $e->name === 'typing' && $e->payload['user_id'] !== null);
});

it('supprime son propre message et masque son contenu', function () {
    [, $ab, , $bb, $conv] = matched();
    $id = say($ab, $conv, 'secret')->json('id');

    acting($bb)->deleteJson("/api/v1/messages/$id")->assertNotFound();
    acting($ab)->deleteJson("/api/v1/messages/$id")->assertNoContent();

    $list = acting($bb)->getJson("/api/v1/conversations/$conv/messages")->json('data');
    expect($list[0]['type'])->toBe('deleted')->and($list[0]['body'])->toBeNull();
});

it('signale un conseil de sécurité sur une demande d’argent et ajoute un signal de risque', function () {
    [$a, $ab, , , $conv] = matched();

    say($ab, $conv, 'Bonjour, tu peux m\'envoyer de l\'argent par Western Union ?')->assertCreated()->assertJsonPath('safety_hint', 'money_request');
    say($ab, $conv, 'Bonjour, tu peux m\'envoyer de l\'argent par Western Union ?')->assertCreated();

    expect(DB::table('risk_events')->where('user_id', $a->id)->where('signal', 'money_keywords')->count())->toBe(1);
    say($ab, $conv, 'On se voit samedi ?')->assertCreated()->assertJsonMissingPath('safety_hint');
});

// ---------- liste des conversations ----------

it('liste les conversations avec non-lus, et masque une conversation supprimée jusqu’au prochain message', function () {
    [$a, $ab, $b, $bb, $conv] = matched();
    say($bb, $conv, 'hello')->assertCreated();

    $list = acting($ab)->getJson('/api/v1/conversations')->assertOk();
    expect($list->json('data'))->toHaveCount(1)->and($list->json('data.0.unread'))->toBe(1)->and($list->json('data.0.profile.user_id'))->toBe($b->id);

    acting($ab)->postJson("/api/v1/conversations/$conv/hide")->assertNoContent();
    expect(acting($ab)->getJson('/api/v1/conversations')->json('data'))->toHaveCount(0);

    $this->travel(1)->minutes();
    say($bb, $conv, 'encore là ?')->assertCreated();
    expect(acting($ab)->getJson('/api/v1/conversations')->json('data'))->toHaveCount(1);
});

// ---------- ouverture hors match ----------

it('exige un crédit ou un Premium pour ouvrir une conversation sans match', function () {
    [$a, $ab] = person();
    [$b] = person();

    acting($ab)->postJson('/api/v1/conversations', ['target_id' => $b->id])->assertStatus(402)->assertJsonPath('error.code', 'credit_required');

    DB::table('credit_ledger')->insert(['id' => (string) Str::uuid(), 'user_id' => $a->id, 'credit_type' => 'conversation', 'delta' => 1, 'reason' => 'purchase', 'idempotency_key' => 'p1', 'created_at' => now()]);
    $res = acting($ab)->postJson('/api/v1/conversations', ['target_id' => $b->id])->assertCreated();

    expect(DB::table('credit_ledger')->where('user_id', $a->id)->sum('delta'))->toEqual(0);
    // Rouvrir la même conversation ne dépense rien de plus.
    acting($ab)->postJson('/api/v1/conversations', ['target_id' => $b->id])->assertOk()->assertJsonPath('id', $res->json('id'));
    expect(DB::table('credit_ledger')->where('user_id', $a->id)->count())->toBe(2);
});

it('laisse un Premium ouvrir une conversation sans crédit', function () {
    [$a, $ab] = person();
    [$b] = person();
    DB::table('subscriptions')->insert(['id' => (string) Str::uuid(), 'user_id' => $a->id, 'store' => 'promotional', 'product_id' => 'premium', 'status' => 'active',
        'period_start' => now()->subDay(), 'period_end' => now()->addMonth(), 'created_at' => now(), 'updated_at' => now()]);

    acting($ab)->postJson('/api/v1/conversations', ['target_id' => $b->id])->assertCreated();
    expect(DB::table('conversations')->first()->unlocked_by)->toBe('premium');
});

it('refuse d’ouvrir une conversation avec un profil masqué ou bloqué', function () {
    [$a, $ab] = person();
    [$hidden] = person(['is_visible' => false]);
    [$blocker] = person();
    DB::table('blocks')->insert(['id' => (string) Str::uuid(), 'blocker_id' => $blocker->id, 'blocked_id' => $a->id, 'created_at' => now(), 'updated_at' => now()]);

    acting($ab)->postJson('/api/v1/conversations', ['target_id' => $hidden->id])->assertNotFound();
    acting($ab)->postJson('/api/v1/conversations', ['target_id' => $blocker->id])->assertNotFound();
});

// ---------- appareil et notifications ----------

it('enregistre le jeton push de l’appareil courant et le réaffecte s’il change de compte sur le même téléphone', function () {
    [$a] = person();
    [$b] = person();
    foreach ([$a, $b] as $u) {
        $token = $u->createToken('t');
        DB::table('devices')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'token_id' => $token->accessToken->getKey(), 'platform' => 'android', 'device_fingerprint_hash' => 'same-phone', 'created_at' => now(), 'updated_at' => now()]);
        $bearers[$u->id] = 'Bearer '.$token->plainTextToken;
    }

    acting($bearers[$a->id])->putJson('/api/v1/me/device', ['push_token' => 'tok-1'])->assertNoContent();
    acting($bearers[$b->id])->putJson('/api/v1/me/device', ['push_token' => 'tok-1'])->assertNoContent();

    expect(DB::table('devices')->where('push_token', 'tok-1')->value('user_id'))->toBe($b->id);
    expect(DB::table('devices')->where('user_id', $a->id)->value('push_token'))->toBeNull();
});

it('gère les préférences de notification', function () {
    [, $ab] = person();
    acting($ab)->putJson('/api/v1/me/notifications', ['push_messages' => false])->assertOk()->assertJsonPath('push_messages', false);
    acting($ab)->getJson('/api/v1/me/notifications')->assertOk()->assertJsonPath('push_messages', false)->assertJsonPath('push_matches', true);
});

it('n’envoie pas de push si la préférence est désactivée, et efface un jeton invalide', function () {
    Queue::fake([]); // on exécute le job directement
    [$u] = person();
    $dev = (string) Str::uuid();
    DB::table('devices')->insert(['id' => $dev, 'user_id' => $u->id, 'platform' => 'android', 'push_token' => 'tok-x', 'created_at' => now(), 'updated_at' => now()]);

    $sent = [];
    app()->instance(PushNotifier::class, new class($sent) implements PushNotifier
    {
        public function __construct(public array &$sent) {}

        public function send(string $platform, string $token, string $title, string $body, array $data = []): bool
        {
            $this->sent[] = $token;

            return $token !== 'tok-x'; // jeton invalide
        }
    });

    DB::table('notification_prefs')->where('user_id', $u->id)->update(['push_messages' => false]);
    (new SendPush($u->id, 'messages', 't', 'b'))->handle(app(PushNotifier::class));
    expect($sent)->toBe([]);

    DB::table('notification_prefs')->where('user_id', $u->id)->update(['push_messages' => true]);
    (new SendPush($u->id, 'messages', 't', 'b'))->handle(app(PushNotifier::class));
    expect($sent)->toBe(['tok-x'])->and(DB::table('devices')->where('id', $dev)->value('push_token'))->toBeNull();
});

it('ignore l’envoi FCM quand il n’est pas configuré', function () {
    config(['services.fcm.project_id' => null]);
    Http::fake();

    expect(app(App\Services\Push\FcmPushNotifier::class)->send('android', 'tok', 't', 'b'))->toBeTrue();
    Http::assertNothingSent();
});

// ---------- canaux temps réel ----------

it('autorise les canaux privés aux seuls participants', function () {
    [$a, $ab, $b, , $conv] = matched();
    [, $intruder] = person();
    $auth = fn (string $bearer, string $channel) => acting($bearer)->postJson('/api/v1/broadcasting/auth', ['channel_name' => $channel, 'socket_id' => '123.456']);

    $auth($ab, "private-conversation.$conv")->assertOk()->assertJsonStructure(['auth']);
    $auth($intruder, "private-conversation.$conv")->assertForbidden();
    $auth($ab, 'private-user.'.$a->id)->assertOk();
    $auth($ab, 'private-user.'.$b->id)->assertForbidden();
    $auth('Bearer invalide', "private-conversation.$conv")->assertUnauthorized();
});

it('ferme le canal d’une conversation après un blocage', function () {
    [$a, $ab, $b, $bb, $conv] = matched();
    acting($bb)->postJson('/api/v1/blocks', ['blocked_id' => $a->id])->assertNoContent();

    acting($ab)->postJson('/api/v1/broadcasting/auth', ['channel_name' => "private-conversation.$conv", 'socket_id' => '1.2'])->assertForbidden();
});
