<?php

use App\Events\ConversationSignal;
use App\Events\MessageCreated;
use App\Jobs\SendPush;
use App\Jobs\TranscodeChatMedia;
use App\Models\User;
use App\Services\Admin\MediaModeration;
use App\Services\Media\Transcoder;
use App\Services\Storage\MediaStorage;
use App\Support\DeployPreflight;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Feature\Admin\Support\Seed;
use Tests\Support\FakeTranscoder;

/**
 * Notes vocales et vidéos en conversation (décision du propriétaire, 2026-11-22). Fermées par défaut (`MEDIA_CHAT_AV_ENABLED`),
 * car ffmpeg ne tourne que dans le conteneur `transcode` sans réseau (docs/14-DEPLOYMENT.md) : un fichier déposé n'est JAMAIS
 * servi tel quel. Il passe `transcoding` (réencodé sans métadonnées, durée et taille vérifiées), puis `processing` (revue humaine),
 * puis `approved` ou `rejected`. Le message peut partir pendant ces étapes ; la lecture n'est ouverte qu'à l'approbation.
 */
function av_enable(): void
{
    config(['media.kinds.message_voice.enabled' => true, 'media.kinds.message_video.enabled' => true]);
}

/** @return array{0: User, 1: string, 2: User, 3: string, 4: string} */
function av_pair(): array
{
    $make = function () {
        $u = User::factory()->create(['birthdate' => '1995-06-15']);
        DB::table('profiles')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $u->id, 'display_name' => 'P'.substr($u->id, 0, 5), 'gender' => 'woman',
            'origin_country' => 'CM', 'residence_country' => 'FR', 'intent' => 'flirt', 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('notification_prefs')->insert(['user_id' => $u->id, 'created_at' => now(), 'updated_at' => now()]);

        return [$u, 'Bearer '.$u->createToken('t')->plainTextToken];
    };
    [$a, $ab] = $make();
    [$b, $bb] = $make();
    $pair = [$a->id, $b->id];
    sort($pair, SORT_STRING);
    $matchId = (string) Str::uuid();
    $convId = (string) Str::uuid();
    DB::table('matches')->insert(['id' => $matchId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('conversations')->insert(['id' => $convId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $matchId, 'initiated_by' => $a->id,
        'unlocked_by' => 'match', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()]);

    return [$a, $ab, $b, $bb, $convId];
}

function av_as(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

/** Média inséré directement : [identifiant, clé de stockage]. @return array{0: string, 1: string} */
function av_media(string $userId, string $kind, string $status, string $mime = 'audio/mp4', ?int $seconds = 20): array
{
    $id = (string) Str::uuid();
    $key = "u/$userId/$kind/$id.m4a";
    DB::table('media')->insert([
        'id' => $id, 'user_id' => $userId, 'kind' => $kind, 'status' => $status, 'storage_key' => $key, 'mime_type' => $mime,
        'size_bytes' => 1000, 'duration_seconds' => $seconds, 'position' => 0, 'created_at' => now(), 'updated_at' => now(),
    ]);

    return [$id, $key];
}

function av_send(string $bearer, string $conv, string $type, string $mediaId)
{
    return av_as($bearer)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => $type, 'media_id' => $mediaId]);
}

function av_message(string $conv, string $senderId, string $type, string $mediaId): string
{
    $id = (string) Str::uuid();
    DB::table('messages')->insert([
        'id' => $id, 'conversation_id' => $conv, 'sender_id' => $senderId, 'client_id' => (string) Str::uuid(), 'type' => $type,
        'media_id' => $mediaId, 'created_at' => now(), 'updated_at' => now(),
    ]);

    return $id;
}

function av_upload_url(string $bearer, string $kind, string $mime, int $size, ?int $seconds = 10)
{
    return av_as($bearer)->postJson('/api/v1/media/upload-url', array_filter(['kind' => $kind, 'mime_type' => $mime, 'size_bytes' => $size, 'duration_seconds' => $seconds]));
}

beforeEach(function () {
    Event::fake([MessageCreated::class, ConversationSignal::class]);
    Queue::fake();
    $this->transcoder = new FakeTranscoder;
    app()->instance(Transcoder::class, $this->transcoder);
});

// ---------- fermé par défaut ----------

it('est fermé par défaut : ni dépôt vocal ou vidéo, ni message vocal ou vidéo', function () {
    [$a, $ab, , , $conv] = av_pair();

    av_upload_url($ab, 'message_voice', 'audio/mp4', 1000)->assertStatus(422);
    av_upload_url($ab, 'message_video', 'video/mp4', 1000)->assertStatus(422);
    [$voice] = av_media($a->id, 'message_voice', 'processing');
    av_send($ab, $conv, 'voice', $voice)->assertStatus(422);
    expect(config('media.kinds.message_voice.enabled'))->toBeFalse()->and(config('media.kinds.message_video.enabled'))->toBeFalse();
});

// ---------- dépôt ----------

it('ouvert : le dépôt vérifie type, taille et durée selon le type de média', function (string $kind, string $mime, int $size, ?int $seconds, int $status) {
    av_enable();
    [, $ab] = av_pair();

    av_upload_url($ab, $kind, $mime, $size, $seconds)->assertStatus($status);
})->with([
    'voix correcte' => ['message_voice', 'audio/mp4', 1_000_000, 120, 201],
    'voix m4a' => ['message_voice', 'audio/x-m4a', 1_000_000, 30, 201],
    'voix trop longue' => ['message_voice', 'audio/mp4', 1_000_000, 121, 422],
    'voix trop lourde' => ['message_voice', 'audio/mp4', 5 * 1024 * 1024 + 1, 30, 422],
    'voix : mauvais type' => ['message_voice', 'image/jpeg', 1000, 30, 422],
    'voix : vidéo refusée' => ['message_voice', 'video/mp4', 1000, 30, 422],
    'vidéo correcte' => ['message_video', 'video/mp4', 40 * 1024 * 1024, 30, 201],
    'vidéo iPhone' => ['message_video', 'video/quicktime', 10_000_000, 12, 201],
    'vidéo trop longue' => ['message_video', 'video/mp4', 1000, 31, 422],
    'vidéo trop lourde' => ['message_video', 'video/mp4', 50 * 1024 * 1024 + 1, 10, 422],
    'vidéo : audio refusé' => ['message_video', 'audio/mp4', 1000, 10, 422],
    'vidéo : format exotique' => ['message_video', 'video/x-matroska', 1000, 10, 422],
]);

it('les autres types de vidéo restent fermés même ouvert (profil, story, invitation)', function () {
    av_enable();
    [, $ab] = av_pair();

    foreach (['profile_video', 'story', 'invite_video'] as $kind) {
        av_upload_url($ab, $kind, 'video/mp4', 1000)->assertStatus(422);
    }
});

it('les quotas comptent les médias en cours de traitement', function () {
    av_enable();
    config(['media.kinds.message_voice.max_open' => 2]);
    [$a, $ab] = av_pair();
    av_media($a->id, 'message_voice', 'transcoding');
    av_media($a->id, 'message_voice', 'processing');

    av_upload_url($ab, 'message_voice', 'audio/mp4', 1000)->assertStatus(422);
});

// ---------- fin de dépôt : jamais lu, jamais servi, mis en file de traitement ----------

it('la fin de dépôt met le média en traitement et lance la tâche, sans le lire ni le servir', function () {
    av_enable();
    [$a, $ab] = av_pair();
    $upload = av_upload_url($ab, 'message_voice', 'audio/mp4', 1000, 15)->assertCreated();
    $id = $upload->json('media_id');
    $key = DB::table('media')->where('id', $id)->value('storage_key');
    app(MediaStorage::class)->simulateUpload($key, 1000, 'audio/mp4');

    $response = av_as($ab)->postJson("/api/v1/media/$id/complete")->assertOk();

    expect($response->json())->toBe(['media_id' => $id, 'status' => 'processing']);
    expect(DB::table('media')->where('id', $id)->value('status'))->toBe('transcoding');
    Queue::assertPushed(TranscodeChatMedia::class, fn ($job) => $job->mediaId === $id);
    expect($a->id)->not->toBeNull();
});

it('la fin de dépôt refuse un fichier dont la taille ou le type ne correspond pas à la déclaration', function () {
    av_enable();
    [, $ab] = av_pair();
    $id = av_upload_url($ab, 'message_video', 'video/mp4', 1000, 10)->assertCreated()->json('media_id');
    $key = DB::table('media')->where('id', $id)->value('storage_key');
    app(MediaStorage::class)->simulateUpload($key, 999_999, 'video/mp4');

    av_as($ab)->postJson("/api/v1/media/$id/complete")->assertStatus(422);

    expect(DB::table('media')->where('id', $id)->exists())->toBeFalse();
    Queue::assertNothingPushed();
});

// ---------- message ----------

it('le message vocal ou vidéo part pendant le traitement, avec statut et durée', function () {
    av_enable();
    [$a, $ab, , , $conv] = av_pair();
    [$voice] = av_media($a->id, 'message_voice', 'transcoding', 'audio/mp4', 42);
    [$video] = av_media($a->id, 'message_video', 'processing', 'video/mp4', 9);

    $v = av_send($ab, $conv, 'voice', $voice)->assertCreated();
    $m = av_send($ab, $conv, 'video', $video)->assertCreated();

    expect($v->json())->toMatchArray(['type' => 'voice', 'media_id' => $voice, 'media_status' => 'processing', 'media_duration_seconds' => 42]);
    expect($m->json())->toMatchArray(['type' => 'video', 'media_id' => $video, 'media_status' => 'processing', 'media_duration_seconds' => 9]);
});

it('le message refuse un média refusé, non finalisé, d’un autre type ou d’autrui', function () {
    av_enable();
    [$a, $ab, $b, , $conv] = av_pair();

    av_send($ab, $conv, 'voice', av_media($a->id, 'message_voice', 'rejected')[0])->assertStatus(422);
    av_send($ab, $conv, 'voice', av_media($a->id, 'message_voice', 'pending_upload')[0])->assertStatus(422);
    av_send($ab, $conv, 'voice', av_media($a->id, 'message_video', 'processing', 'video/mp4')[0])->assertStatus(422);
    av_send($ab, $conv, 'video', av_media($a->id, 'message_voice', 'processing')[0])->assertStatus(422);
    av_send($ab, $conv, 'voice', av_media($b->id, 'message_voice', 'processing')[0])->assertStatus(422);
    av_send($ab, $conv, 'image', av_media($a->id, 'message_voice', 'processing')[0])->assertStatus(422);
});

it('l’historique donne le statut et la durée, ‹ transcoding › se lisant « processing »', function () {
    av_enable();
    [$a, $ab, , $bb, $conv] = av_pair();
    $t = av_message($conv, $a->id, 'voice', av_media($a->id, 'message_voice', 'transcoding', 'audio/mp4', 30)[0]);
    $p = av_message($conv, $a->id, 'video', av_media($a->id, 'message_video', 'processing', 'video/mp4', 12)[0]);
    $ok = av_message($conv, $a->id, 'voice', av_media($a->id, 'message_voice', 'approved', 'audio/mp4', 5)[0]);

    foreach ([$ab, $bb] as $bearer) {
        $rows = collect(av_as($bearer)->getJson("/api/v1/conversations/$conv/messages")->assertOk()->json('data'))->keyBy('id');
        expect($rows[$t]['media_status'])->toBe('processing')->and($rows[$t]['media_duration_seconds'])->toBe(30);
        expect($rows[$p]['media_status'])->toBe('processing')->and($rows[$p]['media_duration_seconds'])->toBe(12);
        expect($rows[$ok]['media_status'])->toBe('approved')->and($rows[$ok]['media_duration_seconds'])->toBe(5);
    }
});

it('l’adresse de lecture sert la voix et la vidéo approuvées aux deux membres, et refuse le reste', function () {
    av_enable();
    [$a, $ab, , $bb, $conv] = av_pair();
    [$voiceMedia, $voiceKey] = av_media($a->id, 'message_voice', 'approved');
    $voice = av_message($conv, $a->id, 'voice', $voiceMedia);
    $video = av_message($conv, $a->id, 'video', av_media($a->id, 'message_video', 'processing', 'video/mp4')[0]);
    $transcoding = av_message($conv, $a->id, 'voice', av_media($a->id, 'message_voice', 'transcoding')[0]);
    $rejected = av_message($conv, $a->id, 'video', av_media($a->id, 'message_video', 'rejected', 'video/mp4')[0]);

    foreach ([$ab, $bb] as $bearer) {
        expect(av_as($bearer)->getJson("/api/v1/conversations/$conv/messages/$voice/media")->assertOk()->json('url'))->toBe("https://storage.test/get/$voiceKey?ttl=10");
        av_as($bearer)->getJson("/api/v1/conversations/$conv/messages/$video/media")->assertStatus(409);
        av_as($bearer)->getJson("/api/v1/conversations/$conv/messages/$transcoding/media")->assertStatus(409);
        av_as($bearer)->getJson("/api/v1/conversations/$conv/messages/$rejected/media")->assertStatus(410);
    }
});

// ---------- tâche de traitement ----------

function av_run_job(string $mediaId): void
{
    app()->call([new TranscodeChatMedia($mediaId), 'handle']);
}

/** Média vocal ou vidéo en cours de traitement, avec son fichier source dans le stockage. @return array{0: string, 1: string, 2: string, 3: string, 4: string} */
function av_processing(string $kind = 'message_voice', string $mime = 'audio/mp4'): array
{
    [$a, , , , $conv] = av_pair();
    [$id, $key] = av_media($a->id, $kind, 'transcoding', $mime, 30);
    app(MediaStorage::class)->contents[$key] = 'SOURCE-BYTES';
    app(MediaStorage::class)->simulateUpload($key, 12, $mime);
    $type = $kind === 'message_voice' ? 'voice' : 'video';
    $message = av_message($conv, $a->id, $type, $id);

    return [$id, $key, $a->id, $conv, $message];
}

it('la tâche envoie le fichier au conteneur de traitement, puis attend', function () {
    av_enable();
    [$id] = av_processing();

    av_run_job($id);

    expect($this->transcoder->submitted[$id])->toBe(['kind' => 'audio', 'bytes' => 'SOURCE-BYTES']);
    expect(DB::table('media')->where('id', $id)->value('status'))->toBe('transcoding');
    av_run_job($id);
    expect($this->transcoder->submitted)->toHaveCount(1);
});

it('la tâche remplace le fichier par le résultat réencodé et passe le média en revue humaine, sans rien annoncer', function () {
    av_enable();
    [$id, $oldKey] = av_processing();
    av_run_job($id);
    $this->transcoder->results[$id] = ['bytes' => 'CLEAN-M4A', 'mime' => 'audio/mp4', 'duration_ms' => 29_400];

    av_run_job($id);

    $media = DB::table('media')->where('id', $id)->first();
    expect($media->status)->toBe('processing')->and($media->mime_type)->toBe('audio/mp4')->and((int) $media->size_bytes)->toBe(9)->and((int) $media->duration_seconds)->toBe(30);
    expect($media->storage_key)->not->toBe($oldKey)->and(str_ends_with($media->storage_key, '.m4a'))->toBeTrue();
    expect(app(MediaStorage::class)->contents[$media->storage_key])->toBe('CLEAN-M4A')->and(app(MediaStorage::class)->deleted)->toContain($oldKey);
    expect($this->transcoder->discarded)->toContain($id);
    Event::assertNotDispatched(ConversationSignal::class);
    Queue::assertNotPushed(SendPush::class);
});

it('la vidéo réencodée est une vidéo MP4', function () {
    av_enable();
    [$id] = av_processing('message_video', 'video/quicktime');
    av_run_job($id);
    expect($this->transcoder->submitted[$id]['kind'])->toBe('video');
    $this->transcoder->results[$id] = ['bytes' => 'CLEAN-MP4', 'mime' => 'video/mp4', 'duration_ms' => 12_000];

    av_run_job($id);

    $media = DB::table('media')->where('id', $id)->first();
    expect($media->status)->toBe('processing')->and($media->mime_type)->toBe('video/mp4')->and(str_ends_with($media->storage_key, '.mp4'))->toBeTrue();
});

it('un traitement en échec refuse le média, supprime les fichiers et prévient l’expéditeur sans motif', function () {
    av_enable();
    [$id, $key, $sender, $conv, $message] = av_processing();
    av_run_job($id);
    $this->transcoder->failures[] = $id;

    av_run_job($id);

    $media = DB::table('media')->where('id', $id)->first();
    expect($media->status)->toBe('rejected')->and($media->moderation_label)->toBe('unreadable');
    expect(app(MediaStorage::class)->deleted)->toContain($key)->and($this->transcoder->discarded)->toContain($id);
    Event::assertDispatched(ConversationSignal::class, fn ($e) => $e->conversationId === $conv && $e->name === 'message.media'
        && $e->payload === ['message_id' => $message, 'media_status' => 'rejected']);
    $pushes = collect(Queue::pushedJobs()[SendPush::class] ?? [])->map(fn ($p) => $p['job'])->where('userId', $sender)->values();
    expect($pushes)->toHaveCount(1)->and($pushes[0]->title)->toBe('Message vocal refusé');
});

it('un traitement trop long est abandonné et le média refusé', function () {
    av_enable();
    [$id] = av_processing();
    av_run_job($id);
    $this->transcoder->ages[$id] = (int) config('media.transcode.timeout_seconds') + 1;

    av_run_job($id);

    expect(DB::table('media')->where('id', $id)->value('status'))->toBe('rejected');
    expect($this->transcoder->discarded)->toContain($id);
});

it('un résultat hors limites (durée, taille, type) est refusé', function (array $result) {
    av_enable();
    [$id] = av_processing();
    av_run_job($id);
    $this->transcoder->results[$id] = $result;

    av_run_job($id);

    expect(DB::table('media')->where('id', $id)->value('status'))->toBe('rejected');
})->with([
    'trop long' => [['bytes' => 'X', 'mime' => 'audio/mp4', 'duration_ms' => 125_000]],
    'trop lourd' => [['bytes' => str_repeat('X', 5 * 1024 * 1024 + 1), 'mime' => 'audio/mp4', 'duration_ms' => 10_000]],
    'mauvais type' => [['bytes' => 'X', 'mime' => 'video/mp4', 'duration_ms' => 10_000]],
    'vide' => [['bytes' => '', 'mime' => 'audio/mp4', 'duration_ms' => 10_000]],
    'durée nulle' => [['bytes' => 'X', 'mime' => 'audio/mp4', 'duration_ms' => 0]],
]);

it('la tâche ne fait rien pour un média déjà traité, supprimé ou d’un autre type', function () {
    av_enable();
    [$a] = av_pair();
    [$done] = av_media($a->id, 'message_voice', 'processing');
    [$photo] = av_media($a->id, 'message_image', 'transcoding', 'image/jpeg');

    av_run_job($done);
    av_run_job($photo);
    av_run_job((string) Str::uuid());

    expect($this->transcoder->submitted)->toBe([])->and(DB::table('media')->where('id', $done)->value('status'))->toBe('processing');
});

// ---------- modération et notification, par type ----------

it('l’approbation et le rejet notifient avec le bon vocabulaire pour la voix et la vidéo', function (string $kind, string $type, string $mime, string $approved, string $incoming, string $rejected) {
    av_enable();
    Filament\Facades\Filament::setCurrentPanel('admin');
    [$a, , $b, , $conv] = av_pair();
    [$ok] = av_media($a->id, $kind, 'processing', $mime);
    [$ko] = av_media($a->id, $kind, 'processing', $mime);
    av_message($conv, $a->id, $type, $ok);
    av_message($conv, $a->id, $type, $ko);
    $mod = Seed::staff('moderator');

    app(MediaModeration::class)->approve($mod, $ok);
    app(MediaModeration::class)->reject($mod, $ko, 'spam');

    $titles = fn (string $userId) => collect(Queue::pushedJobs()[SendPush::class] ?? [])->map(fn ($p) => $p['job'])->where('userId', $userId)->pluck('title')->all();
    expect($titles($a->id))->toBe([$approved, $rejected])->and($titles($b->id))->toBe([$incoming]);
})->with([
    'voix' => ['message_voice', 'voice', 'audio/mp4', 'Message vocal approuvé', 'Nouveau message vocal', 'Message vocal refusé'],
    'vidéo' => ['message_video', 'video', 'video/mp4', 'Vidéo approuvée', 'Nouvelle vidéo', 'Vidéo refusée'],
]);

it('la file de modération ne reçoit un média qu’une fois réencodé : un média « transcoding » ne se modère pas', function () {
    av_enable();
    Filament\Facades\Filament::setCurrentPanel('admin');
    [$a] = av_pair();
    [$id] = av_media($a->id, 'message_voice', 'transcoding');
    $mod = Seed::staff('moderator');

    expect(fn () => app(MediaModeration::class)->approve($mod, $id))->toThrow(DomainException::class);
    expect(fn () => app(MediaModeration::class)->preview($mod, $id))->toThrow(DomainException::class);
    expect(DB::table('media')->where('id', $id)->value('status'))->toBe('transcoding');
});

// ---------- contrôle de déploiement ----------

it('le contrôle de déploiement exige le dossier partagé quand les notes vocales ou vidéos sont ouvertes', function () {
    config(['media.transcode.spool' => sys_get_temp_dir().'/inexistant-'.Str::uuid()]);

    config(['media.kinds.message_voice.enabled' => false, 'media.kinds.message_video.enabled' => false]);
    expect(implode(' ', DeployPreflight::inspect()['errors']))->not->toContain('MEDIA_TRANSCODE_SPOOL');

    av_enable();
    expect(implode(' ', DeployPreflight::inspect()['errors']))->toContain('MEDIA_TRANSCODE_SPOOL');

    $dir = sys_get_temp_dir().'/spool-'.Str::uuid();
    mkdir($dir.'/in', 0777, true);
    mkdir($dir.'/out', 0777, true);
    config(['media.transcode.spool' => $dir]);
    expect(implode(' ', DeployPreflight::inspect()['errors']))->not->toContain('MEDIA_TRANSCODE_SPOOL');
});
