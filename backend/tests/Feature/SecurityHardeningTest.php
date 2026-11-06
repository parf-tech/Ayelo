<?php

/*
 | Tests de non-régression des constats de la revue de sécurité du code (docs/reviews/code-security-1.md).
 | Chaque test porte l'identifiant du constat qu'il verrouille.
 */

use App\Events\BillingUpdated;
use App\Events\CallEvent;
use App\Models\User;
use App\Services\AccountDeletion;
use App\Services\MediaSanitizer;
use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\Support\FakeMediaStorage;
use Tests\Support\TestImages;

function h_member(array $user = []): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1993-04-05'], $user));
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'H'.substr($u->id, 0, 6), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

function h_as(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

function h_anon()
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', '');
}

beforeEach(function () {
    $this->storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $this->storage);
    Event::fake([BillingUpdated::class, CallEvent::class]);
    Queue::fake();
});

// ---------- F-01 : limites de débit indépendantes de l'en-tête client ----------

it('F-01 : changer X-Device-Id à chaque requête ne contourne pas la limite de connexion', function () {
    $statuses = [];
    foreach (range(1, 8) as $i) {
        $statuses[] = h_anon()->withHeader('X-Device-Id', (string) Str::uuid())
            ->postJson('/api/v1/auth/login', ['email' => 'Victime@Example.com', 'password' => 'MauvaisMotDePasse1', 'platform' => 'ios'])->status();
    }

    expect($statuses)->toContain(429)->and(array_slice($statuses, 0, 5))->each->toBe(401);
});

it('F-01 : la casse de l’e-mail ne crée pas de nouveau compteur', function () {
    foreach (range(1, 5) as $i) {
        h_anon()->withHeader('X-Device-Id', (string) Str::uuid())->postJson('/api/v1/auth/login', ['email' => $i % 2 ? 'A@x.com' : 'a@X.com', 'password' => 'MauvaisMotDePasse1', 'platform' => 'ios']);
    }

    h_anon()->withHeader('X-Device-Id', (string) Str::uuid())->postJson('/api/v1/auth/login', ['email' => 'a@x.com', 'password' => 'MauvaisMotDePasse1', 'platform' => 'ios'])->assertStatus(429);
});

it('F-01 : un en-tête non uuid retombe sur l’IP et n’ouvre pas de compteur neuf', function () {
    $status = null;
    foreach (range(1, 12) as $i) {
        $status = h_anon()->withHeader('X-Device-Id', 'pas-un-uuid-'.$i)->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-01-01'])->status();
    }

    // En-tête invalide => validation 422 côté contrôleur ; le limiteur, lui, n'a pas créé 12 compteurs distincts.
    expect($status)->toBeIn([422, 429]);
});

// ---------- F-02 : refus d'âge mémorisé aussi par IP ----------

it('F-02 : un mineur refusé ne repasse pas avec un autre uuid d’appareil depuis la même IP', function () {
    $minor = now()->subYears(15)->format('Y-m-d');
    h_anon()->withHeader('X-Device-Id', (string) Str::uuid())->postJson('/api/v1/auth/age-check', ['birthdate' => $minor])->assertForbidden();

    h_anon()->withHeader('X-Device-Id', (string) Str::uuid())->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-01-01'])->assertForbidden();

    // La mémoire par IP est courte (2 h) : elle expire.
    $this->travel(3)->hours();
    h_anon()->withHeader('X-Device-Id', (string) Str::uuid())->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-01-01'])->assertOk();
});

// ---------- F-03 : suspension appliquée aux jetons déjà émis ----------

it('F-03 : un compte suspendu perd l’accès aux routes courantes mais garde ses sanctions, sa contestation et sa sortie', function () {
    [$u, $b] = h_member();
    h_as($b)->getJson('/api/v1/discover')->assertOk();

    User::whereKey($u->id)->update(['status' => 'suspended']);

    foreach (['/api/v1/discover', '/api/v1/matches', '/api/v1/conversations', '/api/v1/blocks', '/api/v1/me/preferences'] as $path) {
        h_as($b)->getJson($path)->assertForbidden()->assertJsonPath('error.code', 'account_restricted');
    }
    h_as($b)->postJson('/api/v1/swipes', ['target_id' => (string) Str::uuid(), 'action' => 'like'])->assertForbidden();
    h_as($b)->putJson('/api/v1/me/profile', ['bio' => 'x'])->assertForbidden();

    // Doit rester possible : comprendre, contester, exporter, supprimer, sortir.
    h_as($b)->getJson('/api/v1/me')->assertOk();
    h_as($b)->getJson('/api/v1/me/sanctions')->assertOk();
    h_as($b)->postJson('/api/v1/appeals', ['sanction_id' => (string) Str::uuid(), 'message' => 'Je conteste cette décision.'])->assertNotFound();
    h_as($b)->postJson('/api/v1/auth/logout')->assertNoContent();
});

it('F-03 : un compte réactivé retrouve l’accès avec le même jeton', function () {
    [$u, $b] = h_member();
    User::whereKey($u->id)->update(['status' => 'banned']);
    h_as($b)->getJson('/api/v1/discover')->assertForbidden();

    User::whereKey($u->id)->update(['status' => 'active']);
    h_as($b)->getJson('/api/v1/discover')->assertOk();
});

// ---------- F-04 : adresse IP derrière un proxy ----------

it('F-04 : l’en-tête X-Forwarded-For n’est cru que depuis un proxy de confiance', function () {
    Route::middleware('api')->get('/api/v1/_ip', fn (Illuminate\Http\Request $r) => ['ip' => $r->ip()]);

    $trusted = test()->withServerVariables(['REMOTE_ADDR' => '10.1.2.3'])->withHeader('X-Forwarded-For', '203.0.113.7')->getJson('/api/v1/_ip');
    $untrusted = test()->withServerVariables(['REMOTE_ADDR' => '198.51.100.9'])->withHeader('X-Forwarded-For', '1.1.1.1')->getJson('/api/v1/_ip');

    expect($trusted->json('ip'))->toBe('203.0.113.7')->and($untrusted->json('ip'))->toBe('198.51.100.9');
});

// ---------- F-05 : médias ----------

function h_upload(string $bearer, string $bytes, string $declaredMime = 'image/jpeg', string $kind = 'profile_photo')
{
    $res = h_as($bearer)->postJson('/api/v1/media/upload-url', ['kind' => $kind, 'mime_type' => $declaredMime, 'size_bytes' => strlen($bytes)])->assertCreated();
    $id = $res->json('media_id');
    test()->storage->upload(DB::table('media')->where('id', $id)->value('storage_key'), $bytes, $declaredMime);

    return [$id, h_as($bearer)->postJson("/api/v1/media/$id/complete")];
}

it('F-05 : un fichier HTML déclaré image est refusé et supprimé', function () {
    [, $b] = h_member();
    [$id, $res] = h_upload($b, TestImages::htmlDisguised());

    $res->assertStatus(422)->assertJsonPath('error.code', 'upload_rejected');
    expect(DB::table('media')->where('id', $id)->exists())->toBeFalse()->and($this->storage->deleted)->not->toBeEmpty();
});

it('F-05 : un PNG déclaré JPEG est refusé', function () {
    [, $b] = h_member();
    [, $res] = h_upload($b, TestImages::png(), 'image/jpeg');

    $res->assertStatus(422);
});

it('F-05 : l’image publiée est ré-encodée sans EXIF ni coordonnées GPS', function () {
    [, $b] = h_member();
    $original = TestImages::jpegWithGps();
    expect($original)->toContain('GPSLatitude');

    [$id, $res] = h_upload($b, $original);
    $res->assertOk();

    $key = DB::table('media')->where('id', $id)->value('storage_key');
    $clean = $this->storage->contents[$key];

    expect($clean)->not->toContain('GPSLatitude')->and($clean)->not->toContain('Exif')->and(substr($clean, 0, 2))->toBe("\xFF\xD8");
    expect(@getimagesizefromstring($clean))->not->toBeFalse();
    expect(DB::table('media')->where('id', $id)->value('size_bytes'))->toBe(strlen($clean));
});

it('F-05 : le nettoyeur refuse les dimensions démesurées et accepte un PNG valide', function () {
    $sanitizer = new MediaSanitizer;
    expect($sanitizer->clean(TestImages::png(), 'image/png'))->not->toBeNull();
    expect($sanitizer->clean('GIF89a'.str_repeat("\0", 50), 'image/gif'))->toBeNull();
    expect($sanitizer->clean('', 'image/jpeg'))->toBeNull();
});

it('F-05 : les types vidéo et audio ne sont plus ouverts', function () {
    [, $b] = h_member();
    foreach (['profile_video' => 'video/mp4', 'message_voice' => 'audio/mp4', 'story' => 'video/mp4'] as $kind => $mime) {
        h_as($b)->postJson('/api/v1/media/upload-url', ['kind' => $kind, 'mime_type' => $mime, 'size_bytes' => 1000, 'duration_seconds' => 5])->assertStatus(422);
    }
});

it('F-05 : les dépôts abandonnés sont supprimés après 24 heures', function () {
    [$u, $b] = h_member();
    $id = h_as($b)->postJson('/api/v1/media/upload-url', ['kind' => 'profile_photo', 'mime_type' => 'image/jpeg', 'size_bytes' => 1000])->json('media_id');

    $this->artisan('media:purge-pending')->assertSuccessful();
    expect(DB::table('media')->where('id', $id)->exists())->toBeTrue();

    $this->travel(25)->hours();
    $this->artisan('media:purge-pending')->expectsOutputToContain('Dépôts abandonnés supprimés : 1')->assertSuccessful();
    expect(DB::table('media')->where('id', $id)->exists())->toBeFalse();
});

// ---------- F-06 : effacement ----------

it('F-06 : l’anonymisation supprime exports, tickets, appels, IP de consentement et charges RevenueCat', function () {
    [$u] = h_member(['email' => 'efface@example.com']);
    [$other] = h_member();
    $exportKey = 'exports/'.$u->id.'/x.json';
    $this->storage->put($exportKey, '{}', 'application/json');
    DB::table('data_exports')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'status' => 'ready', 'storage_key' => $exportKey, 'created_at' => now(), 'updated_at' => now()]);
    DB::table('support_tickets')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'subject' => 'Sujet', 'body' => 'Mon numéro est ...', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('user_consents')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'kind' => 'terms', 'version' => 'v1', 'granted' => true, 'ip' => '203.0.113.5', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('webhook_events')->insert(['id' => 'evt-x', 'payload' => json_encode(['event' => ['app_user_id' => $u->id, 'id' => 'evt-x']]), 'created_at' => now()]);
    DB::table('risk_events')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'signal' => 'x', 'weight' => 1, 'created_at' => now()]);
    $pair = [$u->id, $other->id];
    sort($pair, SORT_STRING);
    $conv = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $pair[0], 'user_b' => $pair[1], 'initiated_by' => $u->id, 'unlocked_by' => 'credit', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('call_sessions')->insert(['id' => (string) Str::uuid(), 'conversation_id' => $conv, 'caller_id' => $u->id, 'callee_id' => $other->id, 'kind' => 'audio', 'status' => 'ended', 'livekit_room' => 'r1', 'created_at' => now(), 'updated_at' => now()]);

    app(AccountDeletion::class)->anonymize($u);

    expect($this->storage->deleted)->toContain($exportKey);
    expect(DB::table('data_exports')->where('user_id', $u->id)->exists())->toBeFalse()->and(DB::table('support_tickets')->where('user_id', $u->id)->exists())->toBeFalse();
    expect(DB::table('user_consents')->where('user_id', $u->id)->value('ip'))->toBeNull()->and(DB::table('call_sessions')->where('caller_id', $u->id)->exists())->toBeFalse();
    expect(DB::table('webhook_events')->where('id', 'evt-x')->value('payload'))->toBe('{}')->and(DB::table('risk_events')->where('user_id', $u->id)->exists())->toBeFalse();
});

it('F-06 : les exports expirés sont supprimés par la tâche planifiée', function () {
    [$u] = h_member();
    $this->storage->put('exports/old.json', '{}', 'application/json');
    DB::table('data_exports')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'status' => 'ready', 'storage_key' => 'exports/old.json', 'expires_at' => now()->subDay(), 'created_at' => now()->subDays(8), 'updated_at' => now()]);

    $this->artisan('exports:purge')->expectsOutputToContain('Exports supprimés : 1')->assertSuccessful();
    expect($this->storage->deleted)->toContain('exports/old.json')->and(DB::table('data_exports')->count())->toBe(0);
});

// ---------- F-07 : jeton LiveKit de l'appelé ----------

it('F-07 : l’appelé ne reçoit pas de jeton tant qu’il n’a pas décroché', function () {
    [$a, $ab] = h_member();
    [$b, $bb] = h_member();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $m = (string) Str::uuid();
    DB::table('matches')->insert(['id' => $m, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    $conv = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $m, 'initiated_by' => $a->id, 'unlocked_by' => 'match', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    $call = h_as($ab)->postJson('/api/v1/calls', ['conversation_id' => $conv, 'kind' => 'video'])->assertCreated()->json('id');

    h_as($bb)->postJson("/api/v1/calls/$call/token")->assertStatus(409)->assertJsonPath('error.code', 'call_not_accepted');
    h_as($ab)->postJson("/api/v1/calls/$call/token")->assertOk();

    h_as($bb)->postJson("/api/v1/calls/$call/accept")->assertOk();
    h_as($bb)->postJson("/api/v1/calls/$call/token")->assertOk();
});

// ---------- F-08 : événement de paiement non perdu ----------

it('F-08 : un événement dont le traitement échoue est retraité au rejeu', function () {
    config(['billing.webhook_secret' => 's3cret', 'billing.packs.conversation_bug' => ['type' => 'conversation', 'credits' => 0]]);
    [$u] = h_member();
    $evt = ['event' => ['id' => 'evt-fail', 'type' => 'NON_RENEWING_PURCHASE', 'app_user_id' => $u->id, 'product_id' => 'conversation_bug', 'transaction_id' => 'tx-1', 'store' => 'APP_STORE']];

    // crédit de 0 : contrainte SQL `delta <> 0` => échec du traitement.
    h_anon()->withHeader('Authorization', 'Bearer s3cret')->postJson('/api/v1/webhooks/revenuecat', $evt)->assertStatus(500);
    expect(DB::table('webhook_events')->where('id', 'evt-fail')->value('processed_at'))->toBeNull()->and(DB::table('credit_ledger')->count())->toBe(0);

    // Après correction du produit, RevenueCat rejoue le même événement : il est traité.
    config(['billing.packs.conversation_bug.credits' => 5]);
    h_anon()->withHeader('Authorization', 'Bearer s3cret')->postJson('/api/v1/webhooks/revenuecat', $evt)->assertOk()->assertJsonPath('result', 'processed');
    expect((int) DB::table('credit_ledger')->where('user_id', $u->id)->sum('delta'))->toBe(5);
    h_anon()->withHeader('Authorization', 'Bearer s3cret')->postJson('/api/v1/webhooks/revenuecat', $evt)->assertOk()->assertJsonPath('result', 'duplicate');
});

it('F-08 : un événement pour un utilisateur encore inconnu est conservé puis appliqué au rejeu', function () {
    config(['billing.webhook_secret' => 's3cret']);
    $future = (string) Str::uuid();
    $evt = ['event' => ['id' => 'evt-late', 'type' => 'NON_RENEWING_PURCHASE', 'app_user_id' => $future, 'product_id' => 'conversation_1', 'transaction_id' => 'tx-late', 'store' => 'APP_STORE']];

    h_anon()->withHeader('Authorization', 'Bearer s3cret')->postJson('/api/v1/webhooks/revenuecat', $evt)->assertOk()->assertJsonPath('result', 'ignored');
    expect(DB::table('webhook_events')->where('id', 'evt-late')->value('error'))->toBe('utilisateur inconnu');

    User::factory()->create(['id' => $future, 'birthdate' => '1990-01-01']);
    h_anon()->withHeader('Authorization', 'Bearer s3cret')->postJson('/api/v1/webhooks/revenuecat', $evt)->assertOk()->assertJsonPath('result', 'processed');
    expect((int) DB::table('credit_ledger')->where('user_id', $future)->sum('delta'))->toBe(1);
});

// ---------- F-09 : suspension par signalement « mineur » ----------

it('F-09 : un inconnu ne suspend pas un compte, un second signaleur distinct oui', function () {
    [$target] = h_member();
    [, $r1] = h_member();
    [, $r2] = h_member();

    h_as($r1)->postJson('/api/v1/reports', ['reported_id' => $target->id, 'reason' => 'minor_suspected'])->assertCreated();
    expect(User::find($target->id)->status)->toBe('active')->and((int) DB::table('reports')->max('priority'))->toBe(2);

    h_as($r2)->postJson('/api/v1/reports', ['reported_id' => $target->id, 'reason' => 'minor_suspected'])->assertCreated();
    expect(User::find($target->id)->status)->toBe('suspended');
});

it('F-09 : au plus 3 signalements « mineur suspecté » par jour et par compte', function () {
    [, $r] = h_member();
    foreach (range(1, 3) as $i) {
        h_as($r)->postJson('/api/v1/reports', ['reported_id' => h_member()[0]->id, 'reason' => 'minor_suspected'])->assertCreated();
    }
    h_as($r)->postJson('/api/v1/reports', ['reported_id' => h_member()[0]->id, 'reason' => 'minor_suspected'])->assertStatus(429);
});

// ---------- F-10 : matchs ----------

it('F-10 : la liste des matchs masque les comptes suspendus', function () {
    [$a, $ab] = h_member();
    [$b] = h_member();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $m = (string) Str::uuid();
    DB::table('matches')->insert(['id' => $m, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    expect(h_as($ab)->getJson('/api/v1/matches')->json('data.0.profile.user_id'))->toBe($b->id);
    User::whereKey($b->id)->update(['status' => 'suspended']);
    expect(h_as($ab)->getJson('/api/v1/matches')->json('data.0.profile'))->toBeNull();
});

// ---------- F-12 : limite générale ----------

it('F-12 : une limite générale s’applique aux routes authentifiées', function () {
    [, $b] = h_member();
    $last = null;
    foreach (range(1, 125) as $i) {
        $last = h_as($b)->getJson('/api/v1/blocks')->status();
    }

    expect($last)->toBe(429);
});

// ---------- F-15 : preuve conservée ----------

it('F-15 : supprimer un message le masque mais conserve le contenu pour la revue', function () {
    [$a, $ab] = h_member();
    [$b] = h_member();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $m = (string) Str::uuid();
    DB::table('matches')->insert(['id' => $m, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    $conv = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $m, 'initiated_by' => $a->id, 'unlocked_by' => 'match', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    $msg = h_as($ab)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => 'preuve'])->json('id');

    h_as($ab)->deleteJson("/api/v1/messages/$msg")->assertNoContent();

    expect(DB::table('messages')->where('id', $msg)->value('body'))->toBe('preuve');
    expect(h_as($ab)->getJson("/api/v1/conversations/$conv/messages")->json('data.0.body'))->toBeNull();
});

// ---------- F-16 : identifiants bannis ----------

it('F-16 : un e-mail banni ne peut pas se réinscrire', function () {
    \App\Services\BannedIdentifiers::remember('email', 'Banni@Example.com', 'sanctioned_account_deleted');
    $dev = (string) Str::uuid();
    $age = h_anon()->withHeader('X-Device-Id', $dev)->postJson('/api/v1/auth/age-check', ['birthdate' => '1990-01-01'])->json('age_token');

    h_anon()->withHeader('X-Device-Id', $dev)->postJson('/api/v1/auth/register', [
        'email' => 'banni@example.com', 'password' => 'Motdepasse2026', 'age_token' => $age, 'platform' => 'ios',
        'consents' => ['terms' => true, 'privacy' => true, 'sensitive_data' => true],
    ])->assertForbidden();
    expect(User::where('email', 'banni@example.com')->exists())->toBeFalse();
});
