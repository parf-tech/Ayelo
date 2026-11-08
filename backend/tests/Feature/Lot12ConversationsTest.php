<?php

// Lot 12 : pagination de GET /conversations (limit + cursor, rétrocompatible) et libellé du motif de sanction (pentest P-09).

use App\Events\ConversationSignal;
use App\Events\MatchCreated;
use App\Events\MessageCreated;
use App\Filament\Resources\MemberResource\Pages\ViewMember;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\Feature\Admin\Support\Seed;

beforeEach(fn () => Event::fake([MessageCreated::class, ConversationSignal::class, MatchCreated::class]));

function l12_member(): array
{
    $u = User::factory()->create(['birthdate' => '1995-06-15']);
    DB::table('profiles')->insert([
        'id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'L'.substr($u->id, 0, 5), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now(),
    ]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

/** Conversation de $me avec une nouvelle personne ; $lastAt fixe l'activité (null : aucun message, tri sur created_at). */
function l12_conversation(User $me, ?string $lastAt): string
{
    [$other] = l12_member();
    $pair = [$me->id, $other->id];
    sort($pair, SORT_STRING);
    $id = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $id, 'user_a' => $pair[0], 'user_b' => $pair[1], 'initiated_by' => $me->id,
        'unlocked_by' => 'free', 'status' => 'active', 'last_message_at' => $lastAt, 'created_at' => $lastAt ?? '2026-01-01 00:00:00+00', 'updated_at' => now()]);
    if ($lastAt !== null) {
        DB::table('messages')->insert(['id' => (string) Str::uuid(), 'conversation_id' => $id, 'sender_id' => $other->id, 'client_id' => (string) Str::uuid(),
            'type' => 'text', 'body' => 'salut', 'created_at' => $lastAt, 'updated_at' => now()]);
    }

    return $id;
}

function l12_get(string $bearer, string $url)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer)->getJson($url);
}

/** Parcourt toutes les pages ; renvoie [identifiants dans l'ordre, nombre de pages]. */
function l12_walk(string $bearer, int $limit): array
{
    $ids = [];
    $pages = 0;
    $cursor = null;
    do {
        $url = '/api/v1/conversations?limit='.$limit.($cursor ? '&cursor='.urlencode($cursor) : '');
        $res = l12_get($bearer, $url)->assertOk();
        $pages++;
        foreach ($res->json('data') as $row) {
            $ids[] = $row['id'];
        }
        $cursor = $res->json('meta.next_cursor');
    } while ($cursor !== null && $pages < 20);

    return [$ids, $pages];
}

it('sans paramètre : toutes les conversations (comme avant) et meta.next_cursor nul', function () {
    [$me, $b] = l12_member();
    for ($i = 1; $i <= 3; $i++) {
        l12_conversation($me, "2026-03-0$i 10:00:00+00");
    }

    $res = l12_get($b, '/api/v1/conversations')->assertOk()->assertJsonCount(3, 'data');
    expect($res->json('meta'))->toBe(['next_cursor' => null]);
});

it('une page contre plusieurs : ordre par dernière activité décroissante, sans doublon ni trou', function () {
    [$me, $b] = l12_member();
    $expected = [];
    for ($i = 1; $i <= 5; $i++) {
        array_unshift($expected, l12_conversation($me, "2026-03-0$i 10:00:00.123456+00"));
    }
    // Sans message : trié sur created_at (le plus ancien, en dernier).
    $expected[] = l12_conversation($me, null);

    $one = l12_get($b, '/api/v1/conversations?limit=100')->assertOk();
    expect(collect($one->json('data'))->pluck('id')->all())->toBe($expected)->and($one->json('meta.next_cursor'))->toBeNull();

    [$ids, $pages] = l12_walk($b, 2);
    expect($pages)->toBe(3)->and($ids)->toBe($expected);

    // Page exactement pleine : pas de page vide superflue.
    [$ids, $pages] = l12_walk($b, 6);
    expect($pages)->toBe(1)->and($ids)->toBe($expected);
});

it('horodatages identiques : égalités départagées par l’identifiant, sans doublon ni trou', function () {
    [$me, $b] = l12_member();
    $all = [];
    for ($i = 0; $i < 7; $i++) {
        $all[] = l12_conversation($me, '2026-03-01 10:00:00.5+00');
    }
    $newest = l12_conversation($me, '2026-03-02 10:00:00+00');
    // Plus récente en tête, puis égalités par identifiant décroissant.
    rsort($all, SORT_STRING);
    $expected = array_merge([$newest], $all);

    foreach ([1, 2, 3] as $limit) {
        [$ids] = l12_walk($b, $limit);
        expect($ids)->toBe($expected)->and(array_unique($ids))->toHaveCount(8);
    }
});

it('respecte masquage et blocage dans la pagination', function () {
    [$me, $b] = l12_member();
    $keep = l12_conversation($me, '2026-03-03 10:00:00+00');
    $hidden = l12_conversation($me, '2026-03-02 10:00:00+00');
    $blocked = l12_conversation($me, '2026-03-01 10:00:00+00');
    DB::table('conversations')->where('id', $blocked)->update(['status' => 'blocked']);
    app('auth')->forgetGuards();
    test()->withHeader('Authorization', $b)->postJson("/api/v1/conversations/$hidden/hide")->assertNoContent();

    [$ids] = l12_walk($b, 1);
    expect($ids)->toBe([$keep]);
});

it('rejette limit et cursor invalides en 422', function () {
    [$me, $b] = l12_member();
    l12_conversation($me, '2026-03-01 10:00:00+00');

    foreach (['limit=0', 'limit=101', 'limit=abc'] as $q) {
        l12_get($b, "/api/v1/conversations?$q")->assertStatus(422)->assertJsonPath('error.fields.limit', fn ($v) => $v !== null);
    }

    $uuid = (string) Str::uuid();
    $bad = [
        '!!pas-du-base64!!', base64_encode('tomorrow|'.$uuid), base64_encode('2026-03-01 10:00:00+00|pas-un-uuid'),
        base64_encode('2026-13-45 10:00:00+00|'.$uuid), base64_encode('2026-03-01 10:00:00+00'), base64_encode("2026-03-01 10:00:00+00|$uuid;drop"),
        str_repeat('A', 201),
    ];
    foreach ($bad as $cursor) {
        l12_get($b, '/api/v1/conversations?cursor='.urlencode($cursor))->assertStatus(422)->assertJsonPath('error.fields.cursor', fn ($v) => $v !== null);
    }
});

it('le nombre de requêtes ne dépend ni de la page ni du nombre de conversations', function () {
    [$small, $sb] = l12_member();
    l12_conversation($small, '2026-03-01 10:00:00+00');
    [$big, $bb] = l12_member();
    for ($i = 1; $i <= 12; $i++) {
        l12_conversation($big, sprintf('2026-03-%02d 10:00:00+00', $i));
    }

    $count = function (string $bearer, string $url): int {
        l12_get($bearer, $url)->assertOk();
        Model::preventLazyLoading();
        DB::flushQueryLog();
        DB::enableQueryLog();
        try {
            l12_get($bearer, $url)->assertOk();

            return count(array_filter(DB::getQueryLog(), fn ($q) => ! str_starts_with($q['query'], 'update "personal_access_tokens"')));
        } finally {
            DB::disableQueryLog();
            Model::preventLazyLoading(false);
        }
    };

    $cursor = l12_get($bb, '/api/v1/conversations?limit=5')->json('meta.next_cursor');
    $baseline = $count($sb, '/api/v1/conversations');

    expect($count($bb, '/api/v1/conversations?limit=5'))->toBe($baseline)
        ->and($count($bb, '/api/v1/conversations?limit=5&cursor='.urlencode($cursor)))->toBe($baseline)
        ->and($count($bb, '/api/v1/conversations'))->toBe($baseline);
});

// ---------- P-09 ----------

it('P-09 : suspension et bannissement indiquent que le motif est communiqué à l’utilisateur, pas la réactivation', function () {
    Filament::setCurrentPanel('admin');
    $this->actingAs(Seed::staff('admin'), 'staff');
    $u = Seed::user('Awa Diallo');
    $locked = Seed::user('Bob Martin', 'suspended');

    config(['app.admin_locale' => 'fr']);
    Livewire::test(ViewMember::class, ['record' => $u->id])->mountAction('suspend')->assertMountedActionModalSee('Ce motif est communiqué à l\'utilisateur');
    Livewire::test(ViewMember::class, ['record' => $u->id])->mountAction('ban')->assertMountedActionModalSee('Ce motif est communiqué à l\'utilisateur');
    Livewire::test(ViewMember::class, ['record' => $locked->id])->mountAction('reactivate')->assertMountedActionModalDontSee('communiqué à l\'utilisateur');

    config(['app.admin_locale' => 'en']);
    Livewire::test(ViewMember::class, ['record' => $u->id])->mountAction('suspend')->assertMountedActionModalSee('This reason is shown to the user');
});
