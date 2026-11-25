<?php

/*
 | Ré-encodage des images hors de la requête (MEDIA_ASYNC_IMAGES, revue CTO n°1, 2.2) : la fin du dépôt met le média en
 | `transcoding` et la tâche `SanitizeImageMedia` (file `media`) le ré-encode avant la revue humaine. Fermé par défaut.
 */

use App\Jobs\SanitizeImageMedia;
use App\Jobs\SendPush;
use App\Models\User;
use App\Services\Storage\MediaStorage;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Support\FakeMediaStorage;
use Tests\Support\TestImages;

beforeEach(function () {
    $this->storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $this->storage);
    config(['media.async_images' => true]);
});

function ai_member(): array
{
    $user = User::factory()->create();
    DB::table('profiles')->insert([
        'id' => (string) Str::uuid(), 'user_id' => $user->id, 'display_name' => 'Nom', 'gender' => 'woman',
        'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now(),
    ]);

    return [$user, 'Bearer '.$user->createToken('t')->plainTextToken];
}

/** Demande une URL de dépôt, dépose les octets, et rend [identifiant, clé de stockage]. */
function ai_upload(string $bearer, string $bytes, string $kind = 'profile_photo'): array
{
    $id = test()->withHeader('Authorization', $bearer)
        ->postJson('/api/v1/media/upload-url', ['kind' => $kind, 'mime_type' => 'image/jpeg', 'size_bytes' => strlen($bytes)])
        ->assertCreated()->json('media_id');
    $key = DB::table('media')->where('id', $id)->value('storage_key');
    test()->storage->upload($key, $bytes, 'image/jpeg');

    return [$id, $key];
}

function ai_complete(string $bearer, string $id)
{
    return test()->withHeader('Authorization', $bearer)->postJson("/api/v1/media/$id/complete");
}

function ai_run(string $id): void
{
    app()->call([new SanitizeImageMedia($id), 'handle']);
}

function ai_row(string $id): object
{
    return DB::table('media')->where('id', $id)->first();
}

it('met le média en attente sans lire ni réécrire le fichier, et pousse la tâche sur la file « media »', function () {
    Queue::fake();
    [, $bearer] = ai_member();
    [$id, $key] = ai_upload($bearer, TestImages::jpegWithGps());

    ai_complete($bearer, $id)->assertOk()->assertExactJson(['media_id' => $id, 'status' => 'processing']);

    expect(ai_row($id)->status)->toBe('transcoding')->and(ai_row($id)->storage_key)->toBe($key)
        ->and($this->storage->deleted)->toBe([]);
    Queue::assertPushedOn('media', SanitizeImageMedia::class, fn ($job) => $job->mediaId === $id);
    ai_complete($bearer, $id)->assertStatus(409);
});

it('montre au propriétaire une photo « processing » sans adresse tant qu’elle n’est pas ré-encodée', function () {
    Queue::fake();
    [, $bearer] = ai_member();
    [$id] = ai_upload($bearer, TestImages::jpegWithGps());
    ai_complete($bearer, $id)->assertOk();

    $this->withHeader('Authorization', $bearer)->getJson('/api/v1/me')->assertOk()
        ->assertJsonPath('profile.media.0.id', $id)
        ->assertJsonPath('profile.media.0.status', 'processing')
        ->assertJsonPath('profile.media.0.url', null);
});

it('ré-encode sans métadonnées sous une nouvelle clé, puis passe en revue humaine', function () {
    Queue::fake();
    [, $bearer] = ai_member();
    [$id, $key] = ai_upload($bearer, TestImages::jpegWithGps());
    ai_complete($bearer, $id)->assertOk();

    ai_run($id);

    $row = ai_row($id);
    expect($row->status)->toBe('processing')->and($row->storage_key)->not->toBe($key)
        ->and($this->storage->deleted)->toContain($key)
        ->and($this->storage->contents[$row->storage_key])->not->toContain('GPSLatitude')
        ->and((int) $row->size_bytes)->toBe(strlen($this->storage->contents[$row->storage_key]));
});

it('une seconde exécution de la tâche ne change plus rien', function () {
    Queue::fake();
    [, $bearer] = ai_member();
    [$id] = ai_upload($bearer, TestImages::jpeg());
    ai_complete($bearer, $id)->assertOk();
    ai_run($id);
    $first = ai_row($id);

    ai_run($id);

    expect(ai_row($id)->storage_key)->toBe($first->storage_key);
});

it('refuse un fichier illisible : média rejeté, fichier supprimé, expéditeur prévenu', function () {
    Queue::fake();
    [$a, $bearer] = ai_member();
    [$b] = ai_member();
    [$id, $key] = ai_upload($bearer, TestImages::htmlDisguised(), 'message_image');
    ai_complete($bearer, $id)->assertOk();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $conv = (string) Str::uuid();
    DB::table('conversations')->insert(['id' => $conv, 'user_a' => $pair[0], 'user_b' => $pair[1], 'initiated_by' => $a->id, 'unlocked_by' => 'premium', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('messages')->insert(['id' => (string) Str::uuid(), 'conversation_id' => $conv, 'sender_id' => $a->id, 'client_id' => (string) Str::uuid(), 'type' => 'image', 'media_id' => $id, 'created_at' => now()]);

    ai_run($id);

    $row = ai_row($id);
    expect($row->status)->toBe('rejected')->and($row->moderation_label)->toBe('unreadable')
        ->and($this->storage->deleted)->toContain($key);
    Queue::assertPushed(SendPush::class, 1);
});

it('refuse le média quand la tâche a épuisé ses essais', function () {
    Queue::fake();
    [, $bearer] = ai_member();
    [$id, $key] = ai_upload($bearer, TestImages::jpeg());
    ai_complete($bearer, $id)->assertOk();

    (new SanitizeImageMedia($id))->failed(new RuntimeException('stockage injoignable'));

    expect(ai_row($id)->status)->toBe('rejected')->and($this->storage->deleted)->toContain($key);
});

it('une photo en attente garde sa position : nouvelle position pour la suivante, présente au réordonnancement', function () {
    Queue::fake();
    [$user, $bearer] = ai_member();
    [$first] = ai_upload($bearer, TestImages::jpeg());
    ai_complete($bearer, $first)->assertOk();
    [$second] = ai_upload($bearer, TestImages::jpeg());

    expect(ai_row($second)->position)->not->toBe(ai_row($first)->position);
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/media/order', ['ids' => [$second, $first]])->assertOk();
    expect((int) ai_row($second)->position)->toBe(0)->and((int) ai_row($first)->position)->toBe(1);

    // La base interdit aussi deux photos à la même position tant que l'une est en attente.
    expect(fn () => DB::table('media')->insert([
        'id' => (string) Str::uuid(), 'user_id' => $user->id, 'kind' => 'profile_photo', 'status' => 'pending_upload',
        'storage_key' => 'u/x/dup.jpg', 'mime_type' => 'image/jpeg', 'size_bytes' => 10, 'position' => 1,
        'created_at' => now(), 'updated_at' => now(),
    ]))->toThrow(UniqueConstraintViolationException::class);
});

it('garde le selfie de vérification dans la requête : la demande de vérification le lit aussitôt', function () {
    Queue::fake();
    [, $bearer] = ai_member();
    [$id, $key] = ai_upload($bearer, TestImages::jpeg(), 'verification_selfie');

    ai_complete($bearer, $id)->assertOk();

    expect(ai_row($id)->status)->toBe('processing')->and(ai_row($id)->storage_key)->not->toBe($key);
    Queue::assertNotPushed(SanitizeImageMedia::class);
});

it('fermé par défaut : sans MEDIA_ASYNC_IMAGES, le ré-encodage reste dans la requête', function () {
    expect((require config_path('media.php'))['async_images'])->toBeFalse();

    Queue::fake();
    config(['media.async_images' => false]);
    [, $bearer] = ai_member();
    [$id, $key] = ai_upload($bearer, TestImages::jpeg());

    ai_complete($bearer, $id)->assertOk()->assertJsonPath('status', 'processing');

    expect(ai_row($id)->status)->toBe('processing')->and(ai_row($id)->storage_key)->not->toBe($key);
    Queue::assertNotPushed(SanitizeImageMedia::class);
});
