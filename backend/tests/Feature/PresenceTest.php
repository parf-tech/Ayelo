<?php

/*
 | Présence en ligne (FR-D-4, spec 004 T009 et 011 T007) : « en ligne » est calculé côté serveur à partir d'une clé de cache à durée de
 | vie courte (Redis en production), posée à l'activité authentifiée. Le réglage `hide_last_seen` (FR-B-7) masque aussi la présence.
 */

use App\Models\User;
use App\Services\Presence;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function prUser(array $user = [], array $profile = []): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1993-05-06', 'password' => 'Motdepasse2026'], $user));
    DB::table('profiles')->insert(array_merge(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'P'.substr($u->id, 0, 5), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()], $profile));
    DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

function prAs(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

function prOnline(User $u): bool
{
    return app(Presence::class)->isOnline($u->id);
}

it('marque en ligne un compte actif dès sa première requête authentifiée', function () {
    [$a, $bearer] = prUser();
    expect(prOnline($a))->toBeFalse();

    prAs($bearer)->getJson('/api/v1/me')->assertOk();

    expect(prOnline($a))->toBeTrue();
});

it('repasse hors ligne après la durée de vie sans aucune activité', function () {
    [$a, $bearer] = prUser();
    prAs($bearer)->getJson('/api/v1/me')->assertOk();

    $this->travel(config('presence.ttl_seconds') - 5)->seconds();
    expect(prOnline($a))->toBeTrue();

    $this->travel(10)->seconds();
    expect(prOnline($a))->toBeFalse();
});

it('reste en ligne tant que le compte est actif : la présence est renouvelée sans écrire à chaque requête', function () {
    [$a, $bearer] = prUser();
    prAs($bearer)->getJson('/api/v1/me')->assertOk();

    // Deux requêtes rapprochées : la seconde ne renouvelle pas (intervalle de renouvellement), la présence expire à l'heure prévue.
    $this->travel(5)->seconds();
    prAs($bearer)->getJson('/api/v1/me')->assertOk();

    // Après l'intervalle de renouvellement, une requête prolonge la présence au-delà de la première échéance.
    $this->travel(config('presence.touch_interval_seconds'))->seconds();
    prAs($bearer)->getJson('/api/v1/me')->assertOk();
    $this->travel(config('presence.ttl_seconds') - 10)->seconds();

    expect(prOnline($a))->toBeTrue();
});

it('ne marque jamais en ligne une requête anonyme ni un compte restreint', function () {
    [$a, $bearer] = prUser();
    $this->getJson('/api/v1/me')->assertStatus(401);
    expect(prOnline($a))->toBeFalse();

    DB::table('users')->where('id', $a->id)->update(['status' => 'suspended']);
    prAs($bearer)->getJson('/api/v1/discover')->assertStatus(403);
    expect(prOnline($a))->toBeFalse();
});

it('le battement POST /me/presence répond 204 et marque le compte en ligne', function () {
    [$a, $bearer] = prUser();

    prAs($bearer)->postJson('/api/v1/me/presence')->assertNoContent();
    expect(prOnline($a))->toBeTrue();

    app('auth')->forgetGuards();
    $this->withoutHeader('Authorization')->postJson('/api/v1/me/presence')->assertStatus(401);
});

it('le profil public d\'une autre personne indique si elle est en ligne', function () {
    [$viewer, $viewerBearer] = prUser();
    [$target, $targetBearer] = prUser();

    prAs($viewerBearer)->getJson('/api/v1/profiles/'.$target->id)->assertOk()->assertJsonPath('online', false);

    prAs($targetBearer)->getJson('/api/v1/me')->assertOk();
    prAs($viewerBearer)->getJson('/api/v1/profiles/'.$target->id)->assertOk()->assertJsonPath('online', true);

    $this->travel(config('presence.ttl_seconds') + 1)->seconds();
    prAs($viewerBearer)->getJson('/api/v1/profiles/'.$target->id)->assertOk()->assertJsonPath('online', false);
});

it('masque la présence et la dernière connexion quand la personne les cache (hide_last_seen)', function () {
    [$viewer, $viewerBearer] = prUser();
    [$target, $targetBearer] = prUser([], ['hide_last_seen' => true]);
    prAs($targetBearer)->getJson('/api/v1/me')->assertOk();

    $json = prAs($viewerBearer)->getJson('/api/v1/profiles/'.$target->id)->assertOk()->json();

    expect($json)->not->toHaveKey('online')->and($json)->not->toHaveKey('last_seen_at');
});

it('ne montre pas « en ligne » à la personne elle-même sur son propre profil', function () {
    [, $bearer] = prUser();
    prAs($bearer)->getJson('/api/v1/me')->assertOk();

    $me = prAs($bearer)->getJson('/api/v1/me')->json();

    expect($me)->not->toHaveKey('online')->and($me['profile'])->not->toHaveKey('online');
});

it('la liste des conversations indique la présence de chaque interlocuteur, et la masque s\'il le demande', function () {
    [$me, $bearer] = prUser();
    [$visible, $visibleBearer] = prUser();
    [$hidden, $hiddenBearer] = prUser([], ['hide_last_seen' => true]);
    [$offline] = prUser();
    foreach ([$visible, $hidden, $offline] as $other) {
        $pair = [$me->id, $other->id];
        sort($pair, SORT_STRING);
        DB::table('conversations')->insert(['id' => (string) Str::uuid(), 'user_a' => $pair[0], 'user_b' => $pair[1], 'initiated_by' => $me->id,
            'unlocked_by' => 'credit', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    }
    prAs($visibleBearer)->getJson('/api/v1/me')->assertOk();
    prAs($hiddenBearer)->getJson('/api/v1/me')->assertOk();

    $profiles = collect(prAs($bearer)->getJson('/api/v1/conversations')->assertOk()->json('data'))->pluck('profile')->keyBy('user_id');

    expect($profiles[$visible->id]['online'])->toBeTrue()
        ->and($profiles[$offline->id]['online'])->toBeFalse()
        ->and($profiles[$hidden->id])->not->toHaveKey('online');
});
