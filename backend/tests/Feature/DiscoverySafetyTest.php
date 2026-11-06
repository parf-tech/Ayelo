<?php

use App\Events\MatchCreated;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

function member(array $profile = [], bool $photo = true, array $user = []): array
{
    // Date de naissance fixe par défaut : la fabrique en tire une au hasard, ce qui rendrait les filtres d'âge instables.
    $u = User::factory()->create(array_merge(['birthdate' => '1995-06-15'], $user));
    DB::table('profiles')->insert(array_merge([
        'id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'M'.substr($u->id, 0, 5),
        'gender' => 'woman', 'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt',
        'created_at' => now(), 'updated_at' => now(),
    ], $profile));
    if ($photo) {
        DB::table('media')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'kind' => 'profile_photo', 'status' => 'approved',
            'storage_key' => 'k/'.$u->id, 'mime_type' => 'image/jpeg', 'position' => 0, 'created_at' => now(), 'updated_at' => now()]);
    }

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

function as_(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

function premium(User $u): void
{
    DB::table('subscriptions')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'store' => 'promotional', 'product_id' => 'premium',
        'status' => 'active', 'period_start' => now()->subDay(), 'period_end' => now()->addMonth(), 'created_at' => now(), 'updated_at' => now()]);
}

beforeEach(fn () => Event::fake([MatchCreated::class]));

// ---------- découverte ----------

it('propose uniquement des profils actifs, visibles, avec photo approuvée, jamais soi-même', function () {
    [$me, $mb] = member();
    [$ok] = member();
    member(['is_visible' => false]);
    member(photo: false);
    member(user: ['status' => 'suspended']);

    $res = as_($mb)->getJson('/api/v1/discover')->assertOk();

    expect(collect($res->json('data'))->pluck('user_id')->all())->toBe([$ok->id]);
});

it('filtre par pays, origine, intention, âge et genre recherché', function () {
    [, $mb] = member();
    [$fr] = member(['residence_country' => 'FR', 'origin_country' => 'CM', 'intent' => 'marriage']);
    [$ca] = member(['residence_country' => 'CA', 'origin_country' => 'SN', 'intent' => 'flirt']);
    [$man] = member(['gender' => 'man', 'residence_country' => 'FR']);
    [$old] = member(['residence_country' => 'FR'], user: ['birthdate' => now()->subYears(60)->format('Y-m-d')]);

    $ids = fn (string $qs) => collect(as_($mb)->getJson('/api/v1/discover?'.$qs)->assertOk()->json('data'))->pluck('user_id')->sort()->values()->all();

    expect($ids('countries[]=CA'))->toBe([$ca->id]);
    expect($ids('origins[]=SN'))->toBe([$ca->id]);
    expect($ids('intents[]=marriage'))->toBe([$fr->id]);
    expect($ids('age_max=50'))->not->toContain($old->id)->toContain($fr->id);

    as_($mb)->putJson('/api/v1/me/preferences', ['seeking_genders' => ['man']])->assertOk();
    expect($ids(''))->toBe([$man->id]);
});

it('exclut les profils déjà swipés et les profils bloqués dans les deux sens', function () {
    [$me, $mb] = member();
    [$seen] = member();
    [$blockedByMe] = member();
    [$blocksMe] = member();
    [$free] = member();

    as_($mb)->postJson('/api/v1/swipes', ['target_id' => $seen->id, 'action' => 'dislike'])->assertCreated();
    as_($mb)->postJson('/api/v1/blocks', ['blocked_id' => $blockedByMe->id])->assertNoContent();
    DB::table('blocks')->insert(['id' => (string) Str::uuid(), 'blocker_id' => $blocksMe->id, 'blocked_id' => $me->id, 'created_at' => now(), 'updated_at' => now()]);

    expect(collect(as_($mb)->getJson('/api/v1/discover')->json('data'))->pluck('user_id')->all())->toBe([$free->id]);
});

it('pagine par curseur sans doublon', function () {
    [, $mb] = member();
    foreach (range(1, 5) as $i) {
        member(['created_at' => now()->subMinutes($i)]);
    }

    $page1 = as_($mb)->getJson('/api/v1/discover?limit=2')->assertOk();
    $page2 = as_($mb)->getJson('/api/v1/discover?limit=2&cursor='.urlencode($page1->json('next_cursor')))->assertOk();
    $page3 = as_($mb)->getJson('/api/v1/discover?limit=2&cursor='.urlencode($page2->json('next_cursor')))->assertOk();

    $all = collect([$page1, $page2, $page3])->flatMap(fn ($p) => collect($p->json('data'))->pluck('user_id'));
    expect($all)->toHaveCount(5)->and($all->unique())->toHaveCount(5)->and($page3->json('next_cursor'))->toBeNull();
    as_($mb)->getJson('/api/v1/discover?cursor=n_importe_quoi')->assertStatus(422);
});

it('exige un profil pour découvrir', function () {
    $u = User::factory()->create();
    as_('Bearer '.$u->createToken('t')->plainTextToken)->getJson('/api/v1/discover')->assertForbidden();
});

// ---------- swipes et matchs ----------

it('crée exactement un match et une conversation quand les deux se likent', function () {
    [$a, $ab] = member();
    [$b, $bb] = member();

    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $b->id, 'action' => 'like'])->assertCreated()->assertJsonPath('matched', false);
    $res = as_($bb)->postJson('/api/v1/swipes', ['target_id' => $a->id, 'action' => 'like'])->assertCreated()->assertJsonPath('matched', true);

    expect(DB::table('matches')->count())->toBe(1)->and(DB::table('conversations')->count())->toBe(1);
    expect(DB::table('conversations')->first()->id)->toBe($res->json('conversation_id'));
    Event::assertDispatchedTimes(MatchCreated::class, 1);

    // Rejouer le même swipe est sans effet : toujours un seul match, pas de second événement.
    as_($bb)->postJson('/api/v1/swipes', ['target_id' => $a->id, 'action' => 'like'])->assertOk()->assertJsonPath('status', 'already_swiped')->assertJsonPath('matched', true);
    expect(DB::table('matches')->count())->toBe(1);
    Event::assertDispatchedTimes(MatchCreated::class, 1);
});

it('ne crée pas de match si l’un a refusé', function () {
    [$a, $ab] = member();
    [$b, $bb] = member();

    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $b->id, 'action' => 'like'])->assertCreated();
    as_($bb)->postJson('/api/v1/swipes', ['target_id' => $a->id, 'action' => 'dislike'])->assertCreated()->assertJsonPath('matched', false);
    expect(DB::table('matches')->count())->toBe(0);
});

it('refuse de swiper un profil masqué, bloqué, inconnu ou soi-même', function () {
    [$a, $ab] = member();
    [$hidden] = member(['is_visible' => false]);

    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $hidden->id, 'action' => 'like'])->assertNotFound();
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => (string) Str::uuid(), 'action' => 'like'])->assertNotFound();
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $a->id, 'action' => 'like'])->assertStatus(422);
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $hidden->id, 'action' => 'cuisiner'])->assertStatus(422);
});

it('limite les likes d’un compte gratuit et laisse passer un Premium', function () {
    config(['discovery.daily_likes_free' => 2]);
    [$a, $ab] = member();
    $targets = collect(range(1, 4))->map(fn () => member()[0]);

    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $targets[0]->id, 'action' => 'like'])->assertCreated();
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $targets[1]->id, 'action' => 'like'])->assertCreated();
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $targets[2]->id, 'action' => 'like'])->assertStatus(429)->assertJsonPath('error.code', 'quota_reached');
    // Un dislike ne consomme pas le quota de likes.
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $targets[2]->id, 'action' => 'dislike'])->assertCreated();

    premium($a);
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $targets[3]->id, 'action' => 'like'])->assertCreated();
});

it('réserve le super-like et l’annulation au Premium', function () {
    [$a, $ab] = member();
    [$b] = member();
    [$c] = member();

    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $b->id, 'action' => 'super_like'])->assertStatus(402);
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $b->id, 'action' => 'dislike'])->assertCreated();
    as_($ab)->postJson('/api/v1/swipes/undo')->assertStatus(402);

    premium($a);
    as_($ab)->postJson('/api/v1/swipes/undo')->assertOk()->assertJsonPath('target_id', $b->id);
    as_($ab)->postJson('/api/v1/swipes/undo')->assertStatus(409);
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $c->id, 'action' => 'super_like'])->assertCreated();
});

it('liste et rompt un match', function () {
    [$a, $ab] = member();
    [$b, $bb] = member();
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $b->id, 'action' => 'like']);
    as_($bb)->postJson('/api/v1/swipes', ['target_id' => $a->id, 'action' => 'like']);

    $list = as_($ab)->getJson('/api/v1/matches')->assertOk();
    expect($list->json('data'))->toHaveCount(1)->and($list->json('data.0.profile.user_id'))->toBe($b->id);

    $matchId = $list->json('data.0.id');
    as_($ab)->deleteJson("/api/v1/matches/$matchId")->assertNoContent();
    expect(as_($ab)->getJson('/api/v1/matches')->json('data'))->toHaveCount(0);
    expect(DB::table('conversations')->first()->status)->toBe('archived');

    // Un tiers ne peut pas rompre le match des autres.
    [, $cb] = member();
    as_($cb)->deleteJson("/api/v1/matches/$matchId")->assertNotFound();
});

// ---------- blocage ----------

it('bloque : le profil disparaît, le match et la conversation sont bloqués, opération idempotente', function () {
    [$a, $ab] = member();
    [$b, $bb] = member();
    as_($ab)->postJson('/api/v1/swipes', ['target_id' => $b->id, 'action' => 'like']);
    as_($bb)->postJson('/api/v1/swipes', ['target_id' => $a->id, 'action' => 'like']);

    as_($ab)->postJson('/api/v1/blocks', ['blocked_id' => $b->id])->assertNoContent();
    as_($ab)->postJson('/api/v1/blocks', ['blocked_id' => $b->id])->assertNoContent();

    expect(DB::table('blocks')->count())->toBe(1);
    expect(DB::table('matches')->first()->status)->toBe('blocked')->and(DB::table('conversations')->first()->status)->toBe('blocked');
    as_($bb)->getJson('/api/v1/profiles/'.$a->id)->assertNotFound();
    expect(as_($ab)->getJson('/api/v1/blocks')->json('data'))->toHaveCount(1);

    as_($ab)->deleteJson('/api/v1/blocks/'.$b->id)->assertNoContent();
    expect(DB::table('blocks')->count())->toBe(0);
    as_($ab)->postJson('/api/v1/blocks', ['blocked_id' => $a->id])->assertStatus(422);
});

// ---------- signalement ----------

it('enregistre un signalement, sans doublon, avec priorité et quota', function () {
    [$a, $ab] = member();
    [$b] = member();

    $r = as_($ab)->postJson('/api/v1/reports', ['reported_id' => $b->id, 'reason' => 'money_request', 'details' => 'demande de virement'])->assertCreated();
    as_($ab)->postJson('/api/v1/reports', ['reported_id' => $b->id, 'reason' => 'money_request'])->assertOk()->assertJsonPath('status', 'already_reported');
    expect(DB::table('reports')->count())->toBe(1);

    as_($ab)->postJson('/api/v1/reports', ['reported_id' => $b->id, 'reason' => 'inconnu'])->assertStatus(422);
    as_($ab)->postJson('/api/v1/reports', ['reported_id' => $a->id, 'reason' => 'other'])->assertStatus(422);
});

it('place le compte en revue prioritaire après 3 signalements distincts', function () {
    [$target] = member();
    foreach (range(1, 3) as $i) {
        [, $rb] = member();
        as_($rb)->postJson('/api/v1/reports', ['reported_id' => $target->id, 'reason' => 'fake_or_spam'])->assertCreated();
    }

    expect((int) DB::table('reports')->max('priority'))->toBe(1);
    expect(DB::table('risk_events')->where('user_id', $target->id)->where('signal', 'many_reports')->exists())->toBeTrue();
    expect((int) DB::table('users')->where('id', $target->id)->value('risk_score'))->toBeGreaterThan(0);
});

it('suspend préventivement un compte signalé comme mineur suspecté par une personne qui a échangé avec lui', function () {
    [$reporter, $rb] = member();
    [$target] = member();
    $pair = [$reporter->id, $target->id];
    sort($pair, SORT_STRING);
    DB::table('conversations')->insert(['id' => (string) Str::uuid(), 'user_a' => $pair[0], 'user_b' => $pair[1], 'initiated_by' => $reporter->id,
        'unlocked_by' => 'credit', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    as_($rb)->postJson('/api/v1/reports', ['reported_id' => $target->id, 'reason' => 'minor_suspected'])->assertCreated();

    expect(DB::table('users')->where('id', $target->id)->value('status'))->toBe('suspended');
    expect(DB::table('reports')->first()->priority)->toBe(2);
    expect(DB::table('sanctions')->where('user_id', $target->id)->value('reason'))->toBe('preventive_minor_suspected');
    // Un compte suspendu n'apparaît plus en découverte.
    expect(collect(as_($rb)->getJson('/api/v1/discover')->json('data'))->pluck('user_id')->all())->not->toContain($target->id);
});

it('limite les signalements à 20 par jour', function () {
    [, $rb] = member();
    foreach (range(1, 20) as $i) {
        as_($rb)->postJson('/api/v1/reports', ['reported_id' => member()[0]->id, 'reason' => 'other'])->assertCreated();
    }
    as_($rb)->postJson('/api/v1/reports', ['reported_id' => member()[0]->id, 'reason' => 'other'])->assertStatus(429);
});

// ---------- sanctions et contestation ----------

it('affiche ses sanctions et accepte une seule contestation', function () {
    [$u, $ub] = member();
    $sid = (string) Str::uuid();
    DB::table('sanctions')->insert(['id' => $sid, 'user_id' => $u->id, 'kind' => 'warning', 'reason' => 'spam', 'starts_at' => now(), 'created_at' => now()]);

    expect(as_($ub)->getJson('/api/v1/me/sanctions')->assertOk()->json('data'))->toHaveCount(1);

    as_($ub)->postJson('/api/v1/appeals', ['sanction_id' => $sid, 'message' => 'court'])->assertStatus(422);
    as_($ub)->postJson('/api/v1/appeals', ['sanction_id' => $sid, 'message' => 'Je conteste cette décision, ce message était légitime.'])->assertCreated();
    as_($ub)->postJson('/api/v1/appeals', ['sanction_id' => $sid, 'message' => 'Je conteste encore une fois cette décision.'])->assertStatus(409);

    [, $other] = member();
    as_($other)->postJson('/api/v1/appeals', ['sanction_id' => $sid, 'message' => 'Ce n\'est pas ma sanction à moi.'])->assertNotFound();
});
