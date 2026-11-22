<?php

use App\Events\ConversationSignal;
use App\Events\MessageCreated;
use App\Jobs\SendPush;
use App\Models\User;
use App\Services\Admin\MediaModeration;
use Filament\Facades\Filament;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Feature\Admin\Support\Seed;

/**
 * Images dans les conversations, parcours « le message part tout de suite » (décision du propriétaire, 2026-11-22) :
 * le message peut référencer un média en revue (`processing`) ; le destinataire n'en reçoit l'adresse de lecture qu'une fois
 * le média approuvé, et les deux membres sont prévenus en direct de la décision (signal `message.media`).
 */

/** @return array{0: User, 1: string, 2: User, 3: string, 4: string} deux membres et leur conversation */
function mi_pair(): array
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

function mi_as(string $bearer)
{
    app('auth')->forgetGuards();

    return test()->withHeader('Authorization', $bearer);
}

function mi_send_image(string $bearer, string $conv, string $mediaId)
{
    return mi_as($bearer)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => 'image', 'media_id' => $mediaId]);
}

/** Message image inséré directement, avec son média au statut voulu. @return array{0: string, 1: string} [message, média] */
function mi_image_message(string $conv, string $senderId, string $status, ?string $deletedAt = null): array
{
    $key = "u/$senderId/message_image/".Str::uuid().'.jpg';
    $mediaId = Seed::media($senderId, 'message_image', $status, $key);
    $messageId = (string) Str::uuid();
    DB::table('messages')->insert([
        'id' => $messageId, 'conversation_id' => $conv, 'sender_id' => $senderId, 'client_id' => (string) Str::uuid(), 'type' => 'image',
        'media_id' => $mediaId, 'deleted_at' => $deletedAt, 'created_at' => now(), 'updated_at' => now(),
    ]);

    return [$messageId, $mediaId, $key];
}

beforeEach(function () {
    Event::fake([MessageCreated::class, ConversationSignal::class]);
    Queue::fake();
});

// ---------- envoi : un média en revue est accepté, rien d'autre ----------

it('accepte un média en revue ou approuvé, refuse un média non finalisé, refusé, d’un autre type ou d’autrui', function () {
    [$a, $ab, $b, , $conv] = mi_pair();

    expect(mi_send_image($ab, $conv, Seed::media($a->id, 'message_image', 'processing'))->assertCreated()->json('media_status'))->toBe('processing');
    expect(mi_send_image($ab, $conv, Seed::media($a->id, 'message_image', 'approved'))->assertCreated()->json('media_status'))->toBe('approved');

    mi_send_image($ab, $conv, Seed::media($a->id, 'message_image', 'pending_upload'))->assertStatus(422);
    mi_send_image($ab, $conv, Seed::media($a->id, 'message_image', 'rejected'))->assertStatus(422);
    mi_send_image($ab, $conv, Seed::media($a->id, 'profile_photo', 'processing'))->assertStatus(422);
    mi_send_image($ab, $conv, Seed::media($b->id, 'message_image', 'processing'))->assertStatus(422);
    mi_send_image($ab, $conv, (string) Str::uuid())->assertStatus(422);
});

it('un message texte ne porte aucun statut de média', function () {
    [, $ab, , , $conv] = mi_pair();

    $text = mi_as($ab)->postJson("/api/v1/conversations/$conv/messages", ['client_id' => (string) Str::uuid(), 'type' => 'text', 'body' => 'Salut'])->assertCreated();

    expect($text->json())->toHaveKey('media_status')->and($text->json('media_status'))->toBeNull();
});

it('diffuse le statut du média dans le message créé, sans adresse de lecture', function () {
    [$a, $ab, , , $conv] = mi_pair();

    mi_send_image($ab, $conv, Seed::media($a->id, 'message_image', 'processing'))->assertCreated();

    Event::assertDispatched(MessageCreated::class, fn ($e) => ($e->message['media_status'] ?? null) === 'processing' && ! array_key_exists('url', $e->message) && ! array_key_exists('media_url', $e->message));
});

// ---------- lecture de l'historique : statut de chaque image ----------

it('l’historique donne le statut de chaque image aux deux membres, et rien pour un message supprimé', function () {
    [$a, $ab, , $bb, $conv] = mi_pair();
    [$processing] = mi_image_message($conv, $a->id, 'processing');
    [$approved] = mi_image_message($conv, $a->id, 'approved');
    [$rejected] = mi_image_message($conv, $a->id, 'rejected');
    [$deleted] = mi_image_message($conv, $a->id, 'approved', now()->toDateTimeString());

    foreach ([$ab, $bb] as $bearer) {
        $status = collect(mi_as($bearer)->getJson("/api/v1/conversations/$conv/messages")->assertOk()->json('data'))->pluck('media_status', 'id');
        expect($status[$processing])->toBe('processing')->and($status[$approved])->toBe('approved')->and($status[$rejected])->toBe('rejected')->and($status[$deleted])->toBeNull();
    }
});

// ---------- adresse de lecture ----------

it('remet l’adresse signée d’une image approuvée à l’expéditeur et au destinataire, sans la mettre en cache', function () {
    [$a, $ab, , $bb, $conv] = mi_pair();
    [$message, , $key] = mi_image_message($conv, $a->id, 'approved');

    foreach ([$ab, $bb] as $bearer) {
        $response = mi_as($bearer)->getJson("/api/v1/conversations/$conv/messages/$message/media")->assertOk();
        expect($response->json('url'))->toBe("https://storage.test/get/$key?ttl=10")
            ->and(strtotime((string) $response->json('expires_at')))->toBeGreaterThan(time() + 8 * 60)->toBeLessThanOrEqual(time() + 10 * 60 + 5);
        expect($response->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');
    }
});

it('refuse l’adresse tant que l’image est en revue (409) et après un rejet (410)', function () {
    [$a, $ab, , $bb, $conv] = mi_pair();
    [$processing] = mi_image_message($conv, $a->id, 'processing');
    [$rejected] = mi_image_message($conv, $a->id, 'rejected');

    foreach ([$ab, $bb] as $bearer) {
        expect(mi_as($bearer)->getJson("/api/v1/conversations/$conv/messages/$processing/media")->assertStatus(409)->json('error.code'))->toBe('media_pending');
        expect(mi_as($bearer)->getJson("/api/v1/conversations/$conv/messages/$rejected/media")->assertStatus(410)->json('error.code'))->toBe('media_rejected');
    }
});

it('répond 404 hors des cas valides : étranger à la conversation, message d’une autre conversation, texte, supprimé, inconnu', function () {
    [$a, $ab, , , $conv] = mi_pair();
    [, , , $outsiderBearer] = mi_pair();
    [$image] = mi_image_message($conv, $a->id, 'approved');
    [$deleted] = mi_image_message($conv, $a->id, 'approved', now()->toDateTimeString());
    $text = (string) Str::uuid();
    DB::table('messages')->insert(['id' => $text, 'conversation_id' => $conv, 'sender_id' => $a->id, 'client_id' => (string) Str::uuid(), 'type' => 'text',
        'body' => 'Salut', 'created_at' => now(), 'updated_at' => now()]);
    [$otherA, , , , $otherConv] = mi_pair();
    [$foreign] = mi_image_message($otherConv, $otherA->id, 'approved');

    mi_as($outsiderBearer)->getJson("/api/v1/conversations/$conv/messages/$image/media")->assertNotFound();
    mi_as($ab)->getJson("/api/v1/conversations/$conv/messages/$foreign/media")->assertNotFound();
    mi_as($ab)->getJson("/api/v1/conversations/$conv/messages/$text/media")->assertNotFound();
    mi_as($ab)->getJson("/api/v1/conversations/$conv/messages/$deleted/media")->assertNotFound();
    mi_as($ab)->getJson("/api/v1/conversations/$conv/messages/".Str::uuid().'/media')->assertNotFound();
    mi_as($ab)->getJson("/api/v1/conversations/$conv/messages/$image/media")->assertOk();
});

it('exige un compte connecté pour lire une image', function () {
    [$a, , , , $conv] = mi_pair();
    [$image] = mi_image_message($conv, $a->id, 'approved');
    app('auth')->forgetGuards();

    test()->getJson("/api/v1/conversations/$conv/messages/$image/media")->assertUnauthorized();
});

it('limite le nombre d’adresses demandées par minute', function () {
    [$a, $ab, , , $conv] = mi_pair();
    [$image] = mi_image_message($conv, $a->id, 'approved');

    foreach (range(1, 90) as $i) {
        mi_as($ab)->getJson("/api/v1/conversations/$conv/messages/$image/media")->assertOk();
    }
    mi_as($ab)->getJson("/api/v1/conversations/$conv/messages/$image/media")->assertStatus(429);
});

// ---------- décision de modération : signal en direct aux deux membres ----------

it('l’approbation prévient la conversation, une seule fois par message, et ignore les messages supprimés', function () {
    Filament::setCurrentPanel('admin');
    [$a, , , , $conv] = mi_pair();
    [$message, $media] = mi_image_message($conv, $a->id, 'processing');
    // Même média référencé par un message supprimé : pas de signal pour lui.
    DB::table('messages')->insert([
        'id' => (string) Str::uuid(), 'conversation_id' => $conv, 'sender_id' => $a->id, 'client_id' => (string) Str::uuid(), 'type' => 'image',
        'media_id' => $media, 'deleted_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);

    app(MediaModeration::class)->approve(Seed::staff('moderator'), $media);

    expect(DB::table('media')->where('id', $media)->value('status'))->toBe('approved');
    Event::assertDispatchedTimes(ConversationSignal::class, 1);
    Event::assertDispatched(ConversationSignal::class, fn ($e) => $e->conversationId === $conv && $e->name === 'message.media'
        && $e->payload === ['message_id' => $message, 'media_status' => 'approved']);
});

it('le rejet prévient la conversation sans révéler le motif', function () {
    Filament::setCurrentPanel('admin');
    [$a, , , , $conv] = mi_pair();
    [$message, $media] = mi_image_message($conv, $a->id, 'processing');

    app(MediaModeration::class)->reject(Seed::staff('moderator'), $media, 'nudity');

    expect(DB::table('media')->where('id', $media)->value('status'))->toBe('rejected');
    Event::assertDispatched(ConversationSignal::class, fn ($e) => $e->conversationId === $conv && $e->name === 'message.media'
        && $e->payload === ['message_id' => $message, 'media_status' => 'rejected']);
});

it('la modération d’un média qui n’est dans aucun message (photo de profil, dépôt non envoyé) n’émet aucun signal', function () {
    Filament::setCurrentPanel('admin');
    $u = Seed::user();

    app(MediaModeration::class)->approve(Seed::staff('moderator'), Seed::media($u->id, 'profile_photo', 'processing'));
    app(MediaModeration::class)->reject(Seed::staff('moderator'), Seed::media($u->id, 'message_image', 'processing'), 'spam');

    Event::assertNotDispatched(ConversationSignal::class);
});

// ---------- notification push de la décision de modération ----------

/** Notifications `SendPush` mises en file pour un utilisateur : [titre, corps, données]. */
function mi_pushes(string $userId): array
{
    $found = [];
    foreach (Queue::pushedJobs()[SendPush::class] ?? [] as $entry) {
        $job = $entry['job'];
        if ($job->userId === $userId) {
            $found[] = ['title' => $job->title, 'body' => $job->body, 'data' => $job->data, 'kind' => $job->kind, 'messageId' => $job->messageId];
        }
    }

    return $found;
}

it('l’approbation prévient l’expéditeur et le destinataire, sans texte de message ni motif', function () {
    Filament::setCurrentPanel('admin');
    [$a, , $b, , $conv] = mi_pair();
    [, $media] = mi_image_message($conv, $a->id, 'processing');

    app(MediaModeration::class)->approve(Seed::staff('moderator'), $media);

    $expected = ['type' => 'message', 'conversation_id' => $conv];
    expect(mi_pushes($a->id))->toHaveCount(1)->and(mi_pushes($a->id)[0])->toMatchArray(['title' => 'Photo approuvée', 'kind' => 'messages', 'data' => $expected, 'messageId' => null]);
    expect(mi_pushes($b->id))->toHaveCount(1)->and(mi_pushes($b->id)[0])->toMatchArray(['title' => 'Nouvelle photo', 'kind' => 'messages', 'data' => $expected, 'messageId' => null]);
});

it('le rejet ne prévient que l’expéditeur, sans le motif', function () {
    Filament::setCurrentPanel('admin');
    [$a, , $b, , $conv] = mi_pair();
    [, $media] = mi_image_message($conv, $a->id, 'processing');

    app(MediaModeration::class)->reject(Seed::staff('moderator'), $media, 'nudity');

    $mine = mi_pushes($a->id);
    expect($mine)->toHaveCount(1)->and($mine[0]['title'])->toBe('Photo refusée')->and($mine[0]['data'])->toBe(['type' => 'message', 'conversation_id' => $conv]);
    expect(json_encode($mine))->not->toContain('nudity');
    expect(mi_pushes($b->id))->toBe([]);
});

it('conversation non écrivable (archivée) : le destinataire n’est pas prévenu, l’expéditeur l’est', function () {
    Filament::setCurrentPanel('admin');
    [$a, , $b, , $conv] = mi_pair();
    DB::table('conversations')->where('id', $conv)->update(['status' => 'archived']);
    [, $media] = mi_image_message($conv, $a->id, 'processing');

    app(MediaModeration::class)->approve(Seed::staff('moderator'), $media);

    expect(mi_pushes($b->id))->toBe([])->and(mi_pushes($a->id))->toHaveCount(1);
});

it('un message supprimé, ou une modération sans message, ne notifie personne', function () {
    Filament::setCurrentPanel('admin');
    [$a, , , , $conv] = mi_pair();
    [, $deleted] = mi_image_message($conv, $a->id, 'processing', now()->toDateTimeString());
    $orphan = Seed::media($a->id, 'message_image', 'processing');

    app(MediaModeration::class)->approve(Seed::staff('moderator'), $deleted);
    app(MediaModeration::class)->reject(Seed::staff('moderator'), $orphan, 'spam');

    expect(Queue::pushedJobs()[SendPush::class] ?? [])->toBe([]);
});
