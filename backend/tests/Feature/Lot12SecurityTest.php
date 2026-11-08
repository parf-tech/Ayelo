<?php

/*
 | Lot 12 : contexte des signalements (P-10), rotation des clés JWKS (P-11), environnement minimal du processus de
 | nettoyage d'images (P-13), curseur de découverte strict, dernière activité limitée à une écriture par heure.
 */

use App\Models\User;
use App\Services\MediaSanitizerProcess;
use App\Services\OAuth\InvalidOAuthToken;
use App\Services\OAuth\JwtOAuthVerifier;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\TestImages;

function l12User(array $user = []): array
{
    $u = User::factory()->create(array_merge(['birthdate' => '1993-05-06', 'password' => 'Motdepasse2026'], $user));
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'L'.substr($u->id, 0, 5), 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
}

function l12As(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

function l12Conversation(User $a, User $b): string
{
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $id = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $id, 'user_a' => $pair[0], 'user_b' => $pair[1], 'initiated_by' => $a->id, 'unlocked_by' => 'credit',
        'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    return $id;
}

function l12Message(string $conversation, User $sender): string
{
    $id = (string) Str::uuid();
    DB::table('messages')->insert(['id' => $id, 'conversation_id' => $conversation, 'sender_id' => $sender->id, 'client_id' => (string) Str::uuid(),
        'type' => 'text', 'body' => 'salut', 'created_at' => now(), 'updated_at' => now()]);

    return $id;
}

function l12Call(string $conversation, User $caller, User $callee): string
{
    $id = (string) Str::uuid();
    DB::table('call_sessions')->insert(['id' => $id, 'conversation_id' => $conversation, 'caller_id' => $caller->id, 'callee_id' => $callee->id, 'kind' => 'audio',
        'status' => 'ended', 'livekit_room' => 'call-'.$id, 'created_at' => now(), 'updated_at' => now()]);

    return $id;
}

function l12Story(User $owner): string
{
    $media = (string) Str::uuid();
    DB::table('media')->insert(['id' => $media, 'user_id' => $owner->id, 'kind' => 'story', 'status' => 'approved', 'storage_key' => 'k/'.$media,
        'mime_type' => 'image/jpeg', 'size_bytes' => 10, 'created_at' => now(), 'updated_at' => now()]);
    $id = (string) Str::uuid();
    DB::table('stories')->insert(['id' => $id, 'user_id' => $owner->id, 'media_id' => $media, 'visibility' => 'everyone', 'expires_at' => now()->addDay(),
        'created_at' => now(), 'updated_at' => now()]);

    return $id;
}

// ---------- P-10 : contexte des signalements ----------

it('P-10 : un contexte du couple signaleur / signalé est accepté pour chaque type', function () {
    [$me, $bearer] = l12User();
    [$them] = l12User();
    $conv = l12Conversation($me, $them);

    $cases = [
        ['profile', $them->id],
        ['conversation', $conv],
        ['message', l12Message($conv, $them)],
        ['call', l12Call($conv, $them, $me)],
        ['story', l12Story($them)],
    ];
    foreach ($cases as $i => [$type, $id]) {
        // Motifs différents : le doublon « mêmes personnes, même motif » ne masque pas le test.
        $reason = ['harassment', 'fake_or_spam', 'other', 'money_request', 'meeting_behavior'][$i];
        l12As($bearer)->postJson('/api/v1/reports', ['reported_id' => $them->id, 'reason' => $reason, 'context_type' => $type, 'context_id' => $id])
            ->assertCreated();
    }
    expect(DB::table('reports')->count())->toBe(5);
});

it('P-10 : un identifiant de contexte étranger au couple est refusé en 422 et rien n\'est enregistré', function () {
    [$me, $bearer] = l12User();
    [$them] = l12User();
    [$x] = l12User();
    [$y] = l12User();
    $foreign = l12Conversation($x, $y);
    $withThird = l12Conversation($me, $x);

    $cases = [
        ['conversation', $foreign],                       // conversation de deux tiers
        ['conversation', $withThird],                     // ma conversation, mais pas avec le signalé
        ['message', l12Message($foreign, $x)],            // message d'une conversation de tiers
        ['message', l12Message($withThird, $x)],
        ['call', l12Call($foreign, $x, $y)],
        ['call', l12Call($withThird, $x, $me)],
        ['story', l12Story($x)],                          // story d'un autre que le signalé
        ['profile', $x->id],                              // autre profil que le signalé
        ['story', (string) Str::uuid()],                  // inexistant
    ];
    foreach ($cases as [$type, $id]) {
        l12As($bearer)->postJson('/api/v1/reports', ['reported_id' => $them->id, 'reason' => 'harassment', 'context_type' => $type, 'context_id' => $id])
            ->assertStatus(422)->assertJsonPath('error.code', 'validation_failed');
    }

    // Identifiant sans type : refusé aussi.
    l12As($bearer)->postJson('/api/v1/reports', ['reported_id' => $them->id, 'reason' => 'harassment', 'context_id' => $foreign])->assertStatus(422);

    expect(DB::table('reports')->count())->toBe(0);
    // Sans identifiant de contexte, le signalement reste possible.
    l12As($bearer)->postJson('/api/v1/reports', ['reported_id' => $them->id, 'reason' => 'harassment', 'context_type' => 'profile'])->assertCreated();
});

// ---------- P-11 : rotation JWKS ----------

function l12Rsa(string $kid): array
{
    $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    openssl_pkey_export($key, $private);
    $d = openssl_pkey_get_details($key);
    $b64 = fn ($v) => rtrim(strtr(base64_encode($v), '+/', '-_'), '=');

    return [$private, ['kty' => 'RSA', 'kid' => $kid, 'alg' => 'RS256', 'use' => 'sig', 'n' => $b64($d['rsa']['n']), 'e' => $b64($d['rsa']['e'])]];
}

function l12Jwt(string $private, string $kid): string
{
    return JWT::encode(['iss' => 'https://accounts.google.com', 'aud' => 'app-client-id', 'sub' => 'abc', 'exp' => time() + 600, 'iat' => time()], $private, 'RS256', $kid);
}

function l12Oauth(): void
{
    config(['services.oauth.google' => [
        'client_ids' => ['app-client-id'], 'issuers' => ['https://accounts.google.com'], 'jwks_url' => 'https://jwks.test/google',
    ]]);
    Cache::flush();
}

it('P-11 : un kid inconnu du cache relit le JWKS une fois, puis le jeton signé par la nouvelle clé passe', function () {
    [$oldPrivate, $oldJwk] = l12Rsa('old');
    [$newPrivate, $newJwk] = l12Rsa('new');
    l12Oauth();
    Http::fake(['jwks.test/*' => Http::sequence()->push(['keys' => [$oldJwk]])->push(['keys' => [$oldJwk, $newJwk]])]);

    $verifier = new JwtOAuthVerifier;
    // Cache chargé avec l'ancienne clé seule ; le kid « new » est inconnu : relecture, puis acceptation.
    expect($verifier->verify('google', l12Jwt($oldPrivate, 'old'))->subject)->toBe('abc');
    Http::assertSentCount(1);
    expect($verifier->verify('google', l12Jwt($newPrivate, 'new'))->subject)->toBe('abc');
    Http::assertSentCount(2);

    // Désormais en cache : aucune requête de plus.
    expect($verifier->verify('google', l12Jwt($newPrivate, 'new'))->subject)->toBe('abc');
    Http::assertSentCount(2);
});

it('P-11 : des jetons à kid inconnus ne relisent le JWKS qu\'une fois par minute, puis sont refusés', function () {
    [$private, $jwk] = l12Rsa('known');
    l12Oauth();
    Http::fake(['jwks.test/*' => Http::response(['keys' => [$jwk]])]);
    $verifier = new JwtOAuthVerifier;

    foreach (['evil1', 'evil2', 'evil3', 'evil4'] as $kid) {
        expect(fn () => $verifier->verify('google', l12Jwt($private, $kid)))->toThrow(InvalidOAuthToken::class);
    }
    // 1 chargement initial + 1 seule relecture, malgré 4 jetons inconnus.
    Http::assertSentCount(2);

    // Un kid connu reste accepté sans requête supplémentaire.
    expect($verifier->verify('google', l12Jwt($private, 'known'))->subject)->toBe('abc');
    Http::assertSentCount(2);
});

it('P-11 : fournisseur injoignable pendant la relecture : jeton refusé, clés en cache conservées', function () {
    [$private, $jwk] = l12Rsa('known');
    l12Oauth();
    Http::fake(['jwks.test/*' => Http::sequence()->push(['keys' => [$jwk]])->push('boom', 500)]);
    $verifier = new JwtOAuthVerifier;

    expect(fn () => $verifier->verify('google', l12Jwt($private, 'inconnu')))->toThrow(InvalidOAuthToken::class);
    expect($verifier->verify('google', l12Jwt($private, 'known'))->subject)->toBe('abc');
});

// ---------- P-13 : environnement minimal de l'enfant ----------

it('P-13 : l\'environnement de l\'enfant ne contient ni secret, ni base, ni stockage, et une clé d\'application jetable', function () {
    putenv('FCM_PRIVATE_KEY=secret-fcm');
    putenv('DB_PASSWORD=secret-db');
    $_SERVER['AWS_SECRET_ACCESS_KEY'] = 'secret-s3';

    $env = (new ReflectionMethod(MediaSanitizerProcess::class, 'childEnvironment'))->invoke(new MediaSanitizerProcess);

    putenv('FCM_PRIVATE_KEY');
    putenv('DB_PASSWORD');
    unset($_SERVER['AWS_SECRET_ACCESS_KEY']);

    // Absent, ou vidé quand le nom est déclaré dans le .env local (l'enfant le met à vide pour que Laravel ne le relise pas).
    expect(in_array($env['FCM_PRIVATE_KEY'], [false, ''], true))->toBeTrue()
        ->and(in_array($env['AWS_SECRET_ACCESS_KEY'], [false, ''], true))->toBeTrue()
        ->and(in_array($env['DB_PASSWORD'], [false, ''], true))->toBeTrue()
        ->and($env['APP_KEY'])->toStartWith('base64:')->and($env['APP_KEY'])->not->toBe(config('app.key'));

    // Seules les variables autorisées traversent avec une valeur, plus la clé jetable et les pilotes neutres.
    $allowed = ['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR', 'APP_ENV', 'PHPRC', 'PHP_INI_SCAN_DIR', 'LANG', 'LC_ALL', 'APP_KEY',
        'CACHE_STORE', 'SESSION_DRIVER', 'QUEUE_CONNECTION', 'BROADCAST_CONNECTION', 'MAIL_MAILER', 'LOG_CHANNEL'];
    foreach (array_keys(array_filter($env, fn ($v) => $v !== false && $v !== '')) as $name) {
        expect(in_array(strtoupper($name), $allowed, true))->toBeTrue("variable inattendue : $name");
    }
});

it('P-13 : l\'enfant, privé de secrets, nettoie encore une image', function () {
    config(['media.process_timeout_seconds' => 90]);
    putenv('FCM_PRIVATE_KEY=secret-fcm');

    $clean = (new MediaSanitizerProcess)->run(TestImages::png(), 'image/png');
    putenv('FCM_PRIVATE_KEY');

    expect($clean)->not->toBeNull()->and($clean['mime'])->toBe('image/png');
});

// ---------- curseur de découverte ----------

it('découverte : un curseur au format non strict est refusé en 422, un curseur valide est accepté', function () {
    [, $bearer] = l12User();
    $uuid = (string) Str::uuid();

    foreach (['tomorrow|'.$uuid, '1 week ago|'.$uuid, '2026-02-30 10:00:00|'.$uuid, '2026-11-08 10:00:00|not-a-uuid', '2026-11-08 10:00:00|'.strtoupper($uuid), 'sansbarre'] as $raw) {
        l12As($bearer)->getJson('/api/v1/discover?cursor='.urlencode(base64_encode($raw)))->assertStatus(422)->assertJsonPath('error.code', 'validation_failed');
    }
    l12As($bearer)->getJson('/api/v1/discover?cursor='.urlencode('%%%pas-du-base64'))->assertStatus(422);

    l12As($bearer)->getJson('/api/v1/discover?cursor='.urlencode(base64_encode('2026-11-08 10:00:00.123456+00|'.$uuid)))->assertOk();
});

// ---------- last_seen_at ----------

it('last_seen_at : écrit au premier appel authentifié, puis une seule fois par heure', function () {
    [$u, $bearer] = l12User();
    expect(DB::table('users')->where('id', $u->id)->value('last_seen_at'))->toBeNull();

    l12As($bearer)->getJson('/api/v1/me')->assertOk();
    $first = DB::table('users')->where('id', $u->id)->value('last_seen_at');
    expect($first)->not->toBeNull();

    // Deuxième appel dans l'heure : la clé de cache couvre la période, aucune écriture sur users.
    $this->travel(30)->minutes();
    DB::flushQueryLog();
    DB::enableQueryLog();
    l12As($bearer)->getJson('/api/v1/me')->assertOk();
    $writes = array_filter(array_column(DB::getQueryLog(), 'query'), fn ($q) => str_contains($q, 'last_seen_at'));
    DB::disableQueryLog();
    expect($writes)->toBe([])
        ->and(DB::table('users')->where('id', $u->id)->value('last_seen_at'))->toBe($first);

    // Après une heure, la clé de cache a expiré et l'horodatage avance.
    $this->travel(40)->minutes();
    l12As($bearer)->getJson('/api/v1/me')->assertOk();
    expect(DB::table('users')->where('id', $u->id)->value('last_seen_at'))->not->toBe($first);
});

it('last_seen_at : jamais écrit pour une requête anonyme ou d\'un compte restreint', function () {
    [$u, $bearer] = l12User();
    $this->getJson('/api/v1/me')->assertStatus(401);
    expect(DB::table('users')->whereNotNull('last_seen_at')->count())->toBe(0);

    DB::table('users')->where('id', $u->id)->update(['status' => 'suspended']);
    l12As($bearer)->getJson('/api/v1/discover')->assertStatus(403);
    expect(DB::table('users')->where('id', $u->id)->value('last_seen_at'))->toBeNull();
});

it('last_seen_at : une valeur récente existante n\'est pas réécrite', function () {
    [$u, $bearer] = l12User(['last_seen_at' => now()->subMinutes(5)]);
    $before = DB::table('users')->where('id', $u->id)->value('last_seen_at');

    l12As($bearer)->getJson('/api/v1/me')->assertOk();

    expect(DB::table('users')->where('id', $u->id)->value('last_seen_at'))->toBe($before);
});
