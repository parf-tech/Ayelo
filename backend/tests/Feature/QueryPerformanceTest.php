<?php

// Revue CTO 1, risque 9 (docs/reviews/cto-1-suivi-perf.md) : nombre de requêtes constant sur les chemins chauds,
// et index de support présents. Un N+1 réintroduit fait échouer ces tests (1 élément contre 20 : même nombre de requêtes).

use App\Events\ConversationSignal;
use App\Events\MatchCreated;
use App\Events\MessageCreated;
use App\Models\Profile;
use App\Models\User;
use App\Services\ProfilePresenter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

function qp_member(array $user = [], array $profile = [], int $photos = 2): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1995-06-15'], $user));
    DB::table('profiles')->insert(array_merge([
        'id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'Q'.substr($u->id, 0, 5), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now(),
    ], $profile));
    for ($i = 0; $i < $photos; $i++) {
        DB::table('media')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'kind' => 'profile_photo', 'status' => 'approved',
            'storage_key' => "k/{$u->id}/$i", 'mime_type' => 'image/jpeg', 'position' => $i, 'created_at' => now(), 'updated_at' => now()]);
    }

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

/** Conversation (et match actif) entre $me et une nouvelle personne ; $messages messages de l'autre. */
function qp_conversation(User $me, int $messages = 3): string
{
    [$other] = qp_member();
    $pair = [$me->id, $other->id];
    sort($pair, SORT_STRING);
    $matchId = (string) Str::uuid();
    $convId = (string) Str::uuid();
    DB::table('matches')->insert(['id' => $matchId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('conversations')->insert(['id' => $convId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $matchId, 'initiated_by' => $me->id,
        'unlocked_by' => 'match', 'status' => 'active', 'last_message_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
    for ($i = 1; $i <= $messages; $i++) {
        DB::table('messages')->insert(['id' => (string) Str::uuid(), 'conversation_id' => $convId, 'sender_id' => $other->id, 'client_id' => (string) Str::uuid(),
            'type' => 'text', 'body' => "m$i", 'created_at' => now()->addSeconds($i), 'updated_at' => now()]);
    }

    return $convId;
}

function qp_other(string $conversationId, User $me): string
{
    $c = DB::table('conversations')->where('id', $conversationId)->first();

    return $c->user_a === $me->id ? $c->user_b : $c->user_a;
}

/**
 * Appelle $call en comptant les requêtes SQL émises, avec le chargement paresseux interdit.
 * Un premier appel à blanc réchauffe les caches ; $call doit donc être idempotent (lectures).
 */
function qp_count(Closure $call): int
{
    $call();
    Model::preventLazyLoading();
    DB::flushQueryLog();
    DB::enableQueryLog();
    try {
        $call();

        // Le rafraîchissement de `last_used_at` du jeton Sanctum dépend de l'horloge : hors du périmètre mesuré.
        return count(array_filter(DB::getQueryLog(), fn ($q) => ! str_starts_with($q['query'], 'update "personal_access_tokens"')));
    } finally {
        DB::disableQueryLog();
        Model::preventLazyLoading(false);
    }
}

function qp_get(string $bearer, string $url)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer)->getJson($url);
}

beforeEach(fn () => Event::fake([MessageCreated::class, ConversationSignal::class, MatchCreated::class]));

it('liste les conversations en un nombre constant de requêtes (1 contre 20)', function () {
    [$small, $sb] = qp_member();
    qp_conversation($small);
    [$big, $bb] = qp_member();
    for ($i = 0; $i < 20; $i++) {
        qp_conversation($big);
    }

    $one = qp_count(fn () => qp_get($sb, '/api/v1/conversations')->assertOk()->assertJsonCount(1, 'data'));
    $many = qp_count(fn () => qp_get($bb, '/api/v1/conversations')->assertOk()->assertJsonCount(20, 'data'));

    expect($many)->toBe($one);
});

it('renvoie le dernier message, le compteur de non lus et le profil de chaque conversation', function () {
    [$me, $mb] = qp_member();
    $c1 = qp_conversation($me, 3);
    $c2 = qp_conversation($me, 1);
    $otherId = qp_other($c1, $me);
    // Message supprimé plus récent : ignoré pour le dernier message et pour les non lus.
    DB::table('messages')->insert(['id' => (string) Str::uuid(), 'conversation_id' => $c1, 'sender_id' => $otherId, 'client_id' => (string) Str::uuid(),
        'type' => 'text', 'body' => 'efface', 'deleted_at' => now(), 'created_at' => now()->addSeconds(60), 'updated_at' => now()]);
    // Un message déjà lu et un message de moi ne comptent pas comme non lus.
    DB::table('messages')->where('conversation_id', $c1)->where('body', 'm1')->update(['read_at' => now()]);
    DB::table('messages')->insert(['id' => (string) Str::uuid(), 'conversation_id' => $c2, 'sender_id' => $me->id, 'client_id' => (string) Str::uuid(),
        'type' => 'text', 'body' => 'moi', 'created_at' => now()->addSeconds(30), 'updated_at' => now()]);

    $data = collect(qp_get($mb, '/api/v1/conversations')->assertOk()->json('data'))->keyBy('id');

    expect($data[$c1]['unread'])->toBe(2)
        ->and($data[$c1]['last_message']['body'])->toBe('m3')
        ->and($data[$c1]['last_message']['mine'])->toBeFalse()
        ->and($data[$c2]['unread'])->toBe(1)
        ->and($data[$c2]['last_message']['body'])->toBe('moi')
        ->and($data[$c2]['last_message']['mine'])->toBeTrue()
        ->and($data[$c1]['profile']['media'])->toHaveCount(2)
        ->and($data[$c1]['profile']['media'][0]['url'])->toStartWith('https://storage.test/get/');
});

it('liste les matchs en un nombre constant de requêtes (1 contre 20)', function () {
    [$small, $sb] = qp_member();
    qp_conversation($small);
    [$big, $bb] = qp_member();
    for ($i = 0; $i < 20; $i++) {
        qp_conversation($big);
    }

    $one = qp_count(fn () => qp_get($sb, '/api/v1/matches')->assertOk()->assertJsonCount(1, 'data'));
    $many = qp_count(fn () => qp_get($bb, '/api/v1/matches')->assertOk()->assertJsonCount(20, 'data'));

    expect($many)->toBe($one);
});

it('pagine la découverte en un nombre constant de requêtes (1 contre 20 profils)', function () {
    [, $mb] = qp_member();
    qp_member();

    $one = qp_count(fn () => qp_get($mb, '/api/v1/discover')->assertOk()->assertJsonCount(1, 'data'));
    for ($i = 0; $i < 19; $i++) {
        qp_member();
    }
    $many = qp_count(fn () => qp_get($mb, '/api/v1/discover')->assertOk()->assertJsonCount(20, 'data'));

    expect($many)->toBe($one);
});

it('présente un lot de profils comme un profil seul, avec un nombre constant de requêtes', function () {
    $members = collect(range(1, 20))->map(fn () => qp_member()[0]);
    // Un média en traitement : l'affichage public ne montre que les médias approuvés.
    DB::table('media')->insert(['id' => (string) Str::uuid(), 'user_id' => $members[0]->id, 'kind' => 'profile_photo', 'status' => 'processing',
        'storage_key' => 'k/pending', 'mime_type' => 'image/jpeg', 'position' => 5, 'created_at' => now(), 'updated_at' => now()]);
    $presenter = app(ProfilePresenter::class);

    $few = Profile::with('user')->whereIn('user_id', $members->take(1)->pluck('id'))->get();
    $all = Profile::with('user')->whereIn('user_id', $members->pluck('id'))->get();

    $queriesFew = qp_count(fn () => $presenter->publicMany($few));
    $queriesAll = qp_count(fn () => $presenter->publicMany($all));
    $batch = $presenter->publicMany($all);

    expect($queriesAll)->toBe($queriesFew)->toBe(1)->and($batch)->toHaveCount(20);
    foreach ($all as $p) {
        expect($batch[$p->user_id])->toBe($presenter->public($p));
    }
    expect($batch[$members[0]->id]['media'])->toHaveCount(2);
});

it('filtre la découverte par fraîcheur (active_within_days) sans écarter les nouveaux inscrits', function () {
    [, $mb] = qp_member();
    [$fresh] = qp_member(['last_seen_at' => now()->subDays(2)]);
    [$stale] = qp_member(['last_seen_at' => now()->subDays(90)]);
    [$neverSeenNew] = qp_member(['last_seen_at' => null]);
    [$neverSeenOld] = qp_member(['last_seen_at' => null, 'created_at' => now()->subDays(200)]);

    $ids = fn (string $url) => collect(qp_get($mb, $url)->assertOk()->json('data'))->pluck('user_id')->all();

    expect($ids('/api/v1/discover'))->toContain($stale->id, $neverSeenOld->id)
        ->and($ids('/api/v1/discover?active_within_days=30'))->toEqualCanonicalizing([$fresh->id, $neverSeenNew->id]);
    qp_get($mb, '/api/v1/discover?active_within_days=0')->assertStatus(422);
});

it('pagine les messages par curseur sans doublon ni trou, même à horodatage identique', function () {
    [$me, $mb] = qp_member();
    $conv = qp_conversation($me, 0);
    $otherId = qp_other($conv, $me);
    $at = now()->toDateTimeString('microsecond');
    $expected = [];
    for ($i = 0; $i < 7; $i++) {
        $id = (string) Str::uuid();
        $expected[] = $id;
        DB::table('messages')->insert(['id' => $id, 'conversation_id' => $conv, 'sender_id' => $otherId, 'client_id' => (string) Str::uuid(),
            'type' => 'text', 'body' => "x$i", 'created_at' => $at, 'updated_at' => $at]);
    }
    sort($expected, SORT_STRING);
    $expected = array_reverse($expected); // (created_at desc, id desc)

    $seen = [];
    $queries = [];
    $url = "/api/v1/conversations/$conv/messages?limit=3";
    do {
        $page = null;
        $queries[] = qp_count(function () use ($mb, $url, &$page) {
            $page = qp_get($mb, $url)->assertOk()->json();
        });
        $seen = array_merge($seen, array_column($page['data'], 'id'));
        $url = $page['next_cursor'] ? "/api/v1/conversations/$conv/messages?limit=3&cursor=".urlencode($page['next_cursor']) : null;
    } while ($url !== null);

    expect($seen)->toBe($expected)->and(count(array_unique($queries)))->toBe(1);
});

it('crée les index des chemins chauds et retire l\'ancien index de messages', function () {
    $names = DB::table('pg_indexes')->where('schemaname', 'public')->pluck('indexname')->all();

    expect($names)->toContain('messages_unread_idx', 'messages_conversation_created_idx', 'profiles_visible_created_idx',
        'users_active_birthdate_idx', 'users_active_last_seen_idx', 'media_approved_photo_idx')
        ->and($names)->not->toContain('messages_conversation_id_created_at_idx');

    $unread = DB::table('pg_indexes')->where('indexname', 'messages_unread_idx')->value('indexdef');
    expect($unread)->toContain('read_at IS NULL')->toContain('deleted_at IS NULL');
});

it('le planificateur utilise l\'index de curseur des messages et l\'index partiel des non lus', function () {
    $lo = User::factory()->create(['birthdate' => '1990-01-01']);
    $hi = User::factory()->create(['birthdate' => '1990-01-01']);
    [$lo, $hi] = $lo->id < $hi->id ? [$lo->id, $hi->id] : [$hi->id, $lo->id];
    $conv = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $lo, 'user_b' => $hi, 'initiated_by' => $lo, 'unlocked_by' => 'free', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    DB::statement("insert into messages (conversation_id, sender_id, client_id, type, body, created_at, read_at) select ?, ?, gen_random_uuid(), 'text', 'x', now() - (g || ' seconds')::interval, case when g % 50 = 0 then null else now() end from generate_series(1, 20000) g", [$conv, $lo]);
    DB::statement('analyze messages');

    $plan = fn (string $sql) => collect(DB::select('explain '.$sql, [$conv]))->map(fn ($r) => ((array) $r)['QUERY PLAN'])->implode("\n");

    expect($plan('select * from messages where conversation_id = ? order by created_at desc, id desc limit 30'))->toContain('messages_conversation_created_idx')
        ->and($plan('select count(*) from messages where conversation_id = ? and read_at is null and deleted_at is null'))->toContain('messages_unread_idx');
});
