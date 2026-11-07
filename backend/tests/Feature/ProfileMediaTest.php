<?php

use App\Models\User;
use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\DB;
use Tests\Support\FakeMediaStorage;
use Tests\Support\TestImages;

beforeEach(function () {
    $this->storage = new FakeMediaStorage;
    app()->instance(MediaStorage::class, $this->storage);
});

function actingToken(?User $user = null): array
{
    $user ??= User::factory()->create();

    return [$user, 'Bearer '.$user->createToken('t')->plainTextToken];
}

function profileData(array $o = []): array
{
    return array_merge([
        'display_name' => 'Alice', 'gender' => 'woman', 'origin_country' => 'cm', 'residence_country' => 'fr',
        'city' => 'Lyon', 'bio' => 'Bonjour', 'intent' => 'long_lasting_love',
    ], $o);
}

function makeProfile(User $user, array $o = []): void
{
    DB::table('profiles')->insert(array_merge([
        'id' => (string) Illuminate\Support\Str::uuid(), 'user_id' => $user->id, 'display_name' => 'Nom'.substr($user->id, 0, 4),
        'gender' => 'woman', 'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt',
        'created_at' => now(), 'updated_at' => now(),
    ], $o));
}

// ---------- profil ----------

it('crée puis met à jour son profil et renvoie /me complet', function () {
    [$user, $bearer] = actingToken();

    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', profileData())
        ->assertCreated()
        ->assertJsonPath('profile.origin_country', 'CM')
        ->assertJsonPath('profile.residence_country', 'FR')
        ->assertJsonPath('credits.conversation', 0);

    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', ['bio' => 'Nouvelle bio'])
        ->assertOk()->assertJsonPath('profile.bio', 'Nouvelle bio');

    $this->withHeader('Authorization', $bearer)->getJson('/api/v1/me')
        ->assertOk()->assertJsonPath('profile.display_name', 'Alice')->assertJsonPath('premium', false);
});

it('valide les champs du profil', function () {
    [, $bearer] = actingToken();

    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', profileData(['intent' => 'nimporte']))->assertStatus(422);
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', profileData(['gender' => 'x']))->assertStatus(422);
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', profileData(['residence_country' => 'FRA']))->assertStatus(422);
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', profileData(['bio' => str_repeat('a', 501)]))->assertStatus(422);
});

it('limite le changement de pays de résidence à un par semaine', function () {
    [, $bearer] = actingToken();
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', profileData())->assertCreated();

    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', ['residence_country' => 'BE'])->assertOk();
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', ['residence_country' => 'CA'])->assertStatus(422);

    $this->travel(8)->days();
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', ['residence_country' => 'CA'])->assertOk();
});

it('gère la confidentialité et les préférences', function () {
    [, $bearer] = actingToken();
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/profile', profileData())->assertCreated();

    $this->withHeader('Authorization', $bearer)->patchJson('/api/v1/me/privacy', ['is_visible' => false, 'hide_last_seen' => true])
        ->assertOk()->assertJsonPath('profile.is_visible', false);

    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/preferences', [
        'seeking_genders' => ['man'], 'age_min' => 25, 'age_max' => 40, 'countries' => ['FR', 'BE'], 'origins' => ['CM'], 'intents' => ['marriage'],
    ])->assertOk()->assertJsonPath('age_min', 25)->assertJsonPath('countries', ['FR', 'BE']);

    $this->withHeader('Authorization', $bearer)->getJson('/api/v1/me/preferences')->assertOk()->assertJsonPath('origins', ['CM']);
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/preferences', ['age_min' => 50, 'age_max' => 30])->assertStatus(422);
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/preferences', ['age_min' => 17])->assertStatus(422);
});

// ---------- profil public ----------

it('affiche le profil d’un autre utilisateur seulement s’il est visible et non bloqué', function () {
    [$viewer, $vb] = actingToken();
    [$target] = actingToken();
    makeProfile($viewer);
    makeProfile($target, ['display_name' => 'Cible']);

    $this->withHeader('Authorization', $vb)->getJson('/api/v1/profiles/'.$target->id)
        ->assertOk()->assertJsonPath('display_name', 'Cible')->assertJsonMissingPath('email')->assertJsonMissingPath('is_visible');

    DB::table('profiles')->where('user_id', $target->id)->update(['is_visible' => false]);
    $this->withHeader('Authorization', $vb)->getJson('/api/v1/profiles/'.$target->id)->assertNotFound();

    DB::table('profiles')->where('user_id', $target->id)->update(['is_visible' => true]);
    DB::table('blocks')->insert(['id' => (string) Illuminate\Support\Str::uuid(), 'blocker_id' => $target->id, 'blocked_id' => $viewer->id, 'created_at' => now(), 'updated_at' => now()]);
    $this->withHeader('Authorization', $vb)->getJson('/api/v1/profiles/'.$target->id)->assertNotFound();
});

it('refuse l’accès aux profils sans avoir son propre profil, ou à un compte suspendu', function () {
    [$viewer, $vb] = actingToken();
    [$target] = actingToken();
    makeProfile($target);

    $this->withHeader('Authorization', $vb)->getJson('/api/v1/profiles/'.$target->id)->assertNotFound();

    makeProfile($viewer);
    User::whereKey($target->id)->update(['status' => 'suspended']);
    $this->withHeader('Authorization', $vb)->getJson('/api/v1/profiles/'.$target->id)->assertNotFound();
});

it('ne montre que les médias approuvés aux autres, et masque la dernière connexion si demandé', function () {
    [$viewer, $vb] = actingToken();
    [$target] = actingToken();
    makeProfile($viewer);
    makeProfile($target, ['hide_last_seen' => true]);
    foreach (['approved' => 0, 'processing' => 1, 'rejected' => 2] as $status => $pos) {
        DB::table('media')->insert(['id' => (string) Illuminate\Support\Str::uuid(), 'user_id' => $target->id, 'kind' => 'profile_photo', 'status' => $status,
            'storage_key' => "k/$status", 'mime_type' => 'image/jpeg', 'position' => $pos, 'created_at' => now(), 'updated_at' => now()]);
    }

    $res = $this->withHeader('Authorization', $vb)->getJson('/api/v1/profiles/'.$target->id)->assertOk();
    expect($res->json('media'))->toHaveCount(1)->and($res->json('media.0.url'))->toContain('k/approved');
    $res->assertJsonMissingPath('last_seen_at');
});

// ---------- médias ----------

function requestUpload($test, string $bearer, array $o = [])
{
    return $test->withHeader('Authorization', $bearer)->postJson('/api/v1/media/upload-url', array_merge([
        'kind' => 'profile_photo', 'mime_type' => 'image/jpeg', 'size_bytes' => strlen(TestImages::jpeg()),
    ], $o));
}

it('émet une URL de dépôt présignée et enregistre le média en attente', function () {
    [$user, $bearer] = actingToken();

    $res = requestUpload($this, $bearer)->assertCreated();
    $res->assertJsonStructure(['media_id', 'upload' => ['url', 'headers']]);

    $row = DB::table('media')->where('id', $res->json('media_id'))->first();
    expect($row->status)->toBe('pending_upload')->and($row->storage_key)->toStartWith('u/'.$user->id.'/profile_photo/')->and($row->position)->toBe(0);
});

it('refuse les types, tailles et durées hors limites', function () {
    [, $bearer] = actingToken();

    requestUpload($this, $bearer, ['mime_type' => 'application/pdf'])->assertStatus(422);
    requestUpload($this, $bearer, ['size_bytes' => 9 * 1024 * 1024])->assertStatus(422);
    requestUpload($this, $bearer, ['kind' => 'profile_video', 'mime_type' => 'video/mp4', 'size_bytes' => 1000, 'duration_seconds' => 61])->assertStatus(422);
    requestUpload($this, $bearer, ['kind' => 'inconnu'])->assertStatus(422);
});

it('limite à 6 photos de profil', function () {
    [, $bearer] = actingToken();
    foreach (range(1, 6) as $i) {
        requestUpload($this, $bearer)->assertCreated();
    }
    requestUpload($this, $bearer)->assertStatus(422);
});

it('valide l’objet réellement déposé avant de le passer en revue', function () {
    [, $bearer] = actingToken();
    $id = requestUpload($this, $bearer)->json('media_id');
    $key = DB::table('media')->where('id', $id)->value('storage_key');

    // Rien n'a été déposé.
    $this->withHeader('Authorization', $bearer)->postJson("/api/v1/media/$id/complete")->assertStatus(422)->assertJsonPath('error.code', 'upload_missing');

    // Le client a menti sur la taille : fichier supprimé et refusé.
    DB::table('media')->where('id', $id)->update(['size_bytes' => 5000]);
    $this->storage->upload($key, TestImages::jpeg(), 'image/jpeg');
    $this->withHeader('Authorization', $bearer)->postJson("/api/v1/media/$id/complete")->assertStatus(422)->assertJsonPath('error.code', 'upload_rejected');
    expect($this->storage->deleted)->toContain($key)->and(DB::table('media')->where('id', $id)->exists())->toBeFalse();
});

it('passe un média valide en file de modération, jamais directement public', function () {
    [, $bearer] = actingToken();
    $id = requestUpload($this, $bearer)->json('media_id');
    $key = DB::table('media')->where('id', $id)->value('storage_key');
    $this->storage->upload($key, TestImages::jpeg(), 'image/jpeg');

    $this->withHeader('Authorization', $bearer)->postJson("/api/v1/media/$id/complete")->assertOk()->assertJsonPath('status', 'processing');
    // L'objet d'origine est remplacé par une copie nettoyée sous une nouvelle clé.
    expect(DB::table('media')->where('id', $id)->value('storage_key'))->not->toBe($key)->and($this->storage->deleted)->toContain($key);
    $this->withHeader('Authorization', $bearer)->postJson("/api/v1/media/$id/complete")->assertStatus(409);
});

it('approuve automatiquement seulement si le réglage de développement est activé', function () {
    config(['media.auto_approve' => true]);
    [, $bearer] = actingToken();
    $id = requestUpload($this, $bearer)->json('media_id');
    $this->storage->upload(DB::table('media')->where('id', $id)->value('storage_key'), TestImages::jpeg(), 'image/jpeg');

    $this->withHeader('Authorization', $bearer)->postJson("/api/v1/media/$id/complete")->assertOk()->assertJsonPath('status', 'approved');
});

it('empêche d’agir sur le média d’un autre utilisateur', function () {
    [, $a] = actingToken();
    [, $b] = actingToken();
    $id = requestUpload($this, $a)->json('media_id');

    // Le garde garde l'utilisateur en cache entre deux requêtes d'un même test : on le réinitialise.
    app('auth')->forgetGuards();
    $this->withHeader('Authorization', $b)->postJson("/api/v1/media/$id/complete")->assertNotFound();
    $this->withHeader('Authorization', $b)->deleteJson("/api/v1/media/$id")->assertNotFound();
    expect(DB::table('media')->where('id', $id)->exists())->toBeTrue();
});

it('supprime un média et son objet', function () {
    [, $bearer] = actingToken();
    $id = requestUpload($this, $bearer)->json('media_id');
    $key = DB::table('media')->where('id', $id)->value('storage_key');

    $this->withHeader('Authorization', $bearer)->deleteJson("/api/v1/media/$id")->assertNoContent();
    expect($this->storage->deleted)->toContain($key)->and(DB::table('media')->where('id', $id)->exists())->toBeFalse();
});

it('réordonne les photos, y compris un échange complet', function () {
    [, $bearer] = actingToken();
    $ids = [];
    foreach (range(1, 3) as $i) {
        $ids[] = requestUpload($this, $bearer)->json('media_id');
    }

    $new = [$ids[2], $ids[0], $ids[1]];
    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/media/order', ['ids' => $new])->assertOk();

    foreach ($new as $position => $id) {
        expect(DB::table('media')->where('id', $id)->value('position'))->toBe($position);
    }

    $this->withHeader('Authorization', $bearer)->putJson('/api/v1/me/media/order', ['ids' => [$ids[0]]])->assertStatus(422);
});

it('exige l’authentification pour toutes les routes de profil et de média', function () {
    $this->getJson('/api/v1/me')->assertUnauthorized();
    $this->putJson('/api/v1/me/profile', profileData())->assertUnauthorized();
    $this->postJson('/api/v1/media/upload-url', [])->assertUnauthorized();
    $this->getJson('/api/v1/profiles/'.Illuminate\Support\Str::uuid())->assertUnauthorized();
});
