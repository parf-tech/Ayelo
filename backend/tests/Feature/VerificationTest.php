<?php

use App\Models\User;
use App\Services\ProfileVerification;
use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\FakeMediaStorage;

function verifUser(bool $consent = true): array
{
    $u = User::factory()->create(['birthdate' => '1990-01-01']);
    DB::table('profiles')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'Verif', 'gender' => 'woman', 'origin_country' => 'CM',
        'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now()]);
    if ($consent) {
        DB::table('user_consents')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'kind' => 'verification_biometric', 'version' => 'v1', 'granted' => true, 'created_at' => now(), 'updated_at' => now()]);
    }
    $selfie = (string) Str::uuid();
    DB::table('media')->insert(['id' => $selfie, 'user_id' => $u->id, 'kind' => 'verification_selfie', 'status' => 'processing', 'storage_key' => "u/{$u->id}/selfie.jpg",
        'mime_type' => 'image/jpeg', 'position' => 0, 'created_at' => now(), 'updated_at' => now()]);

    return [$u, 'Bearer '.$u->createToken('t')->plainTextToken, $selfie];
}

function ver(string $b)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $b);
}

it('donne une pose stable dans la journée', function () {
    [, $b] = verifUser();
    $a = ver($b)->getJson('/api/v1/me/verification/pose')->assertOk()->json('pose');
    expect(ProfileVerification::POSES)->toContain($a)->and(ver($b)->getJson('/api/v1/me/verification/pose')->json('pose'))->toBe($a);
});

it('exige le consentement biométrique, un selfie valide et une seule demande en cours', function () {
    [$u, $b, $selfie] = verifUser(consent: false);
    ver($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $selfie])->assertForbidden()->assertJsonPath('error.code', 'consent_required');

    DB::table('user_consents')->insert(['id' => (string) Str::uuid(), 'user_id' => $u->id, 'kind' => 'verification_biometric', 'version' => 'v1', 'granted' => true, 'created_at' => now(), 'updated_at' => now()]);
    ver($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => (string) Str::uuid()])->assertStatus(422);

    ver($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $selfie])->assertCreated();
    expect(DB::table('profiles')->where('user_id', $u->id)->value('verification_status'))->toBe('pending');
    ver($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $selfie])->assertStatus(409);
});

it('refuse le selfie d’un autre utilisateur', function () {
    [, $b] = verifUser();
    [, , $foreign] = verifUser();

    ver($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $foreign])->assertStatus(422);
});

it('approuve : badge vérifié, selfie supprimé du stockage, résultat conservé', function () {
    $storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $storage);
    [$u, $b, $selfie] = verifUser();
    $id = ver($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $selfie])->json('id');

    app(ProfileVerification::class)->approve($id);

    expect(DB::table('profiles')->where('user_id', $u->id)->value('verification_status'))->toBe('verified');
    expect(DB::table('media')->where('id', $selfie)->value('status'))->toBe('purged')->and($storage->deleted)->toHaveCount(1);
    ver($b)->getJson('/api/v1/me/verification')->assertOk()->assertJsonPath('verification_status', 'verified')->assertJsonPath('last_request.status', 'approved');
    // Décision déjà prise : rejouer ne change rien.
    app(ProfileVerification::class)->reject($id, 'trop tard');
    expect(DB::table('profiles')->where('user_id', $u->id)->value('verification_status'))->toBe('verified');
});

it('refuse avec un motif, autorise une nouvelle tentative et limite à 3 par jour', function () {
    app()->instance(MediaStorage::class, new FakeMediaStorage);
    [$u, $b] = verifUser();

    foreach (range(1, 3) as $i) {
        $selfie = (string) Str::uuid();
        DB::table('media')->insert(['id' => $selfie, 'user_id' => $u->id, 'kind' => 'verification_selfie', 'status' => 'processing', 'storage_key' => "k/$selfie",
            'mime_type' => 'image/jpeg', 'position' => 0, 'created_at' => now(), 'updated_at' => now()]);
        $id = ver($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $selfie])->assertCreated()->json('id');
        app(ProfileVerification::class)->reject($id, 'photo floue');
        expect(DB::table('profiles')->where('user_id', $u->id)->value('verification_status'))->toBe('rejected');
    }

    $selfie = (string) Str::uuid();
    DB::table('media')->insert(['id' => $selfie, 'user_id' => $u->id, 'kind' => 'verification_selfie', 'status' => 'processing', 'storage_key' => "k/$selfie",
        'mime_type' => 'image/jpeg', 'position' => 0, 'created_at' => now(), 'updated_at' => now()]);
    ver($b)->postJson('/api/v1/me/verification', ['selfie_media_id' => $selfie])->assertStatus(429);
});
