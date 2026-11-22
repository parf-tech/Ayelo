<?php

namespace App\Http\Controllers;

use App\Events\ConversationSignal;
use App\Events\MessageCreated;
use App\Jobs\SendPush;
use App\Services\Conversations;
use App\Services\MessageSafety;
use App\Services\Storage\MediaStorage;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use stdClass;
use Symfony\Component\HttpFoundation\Response;

class MessageController extends Controller
{
    // Type de message => type de média. Les notes vocales et les vidéos ne sont ouvertes que si leur type de média l'est
    // (`media.kinds.<type>.enabled`, MEDIA_CHAT_AV_ENABLED) : le conteneur de traitement doit exister.
    private const MEDIA_KIND = ['image' => 'message_image', 'voice' => 'message_voice', 'video' => 'message_video'];

    public function index(Request $request, string $id, Conversations $conversations): JsonResponse
    {
        $me = $request->user()->id;
        abort_if($conversations->forParticipant($id, $me) === null, 404);

        $data = $request->validate(['limit' => ['nullable', 'integer', 'min:1', 'max:100'], 'cursor' => ['nullable', 'string', 'max:200']]);
        $limit = (int) ($data['limit'] ?? 30);

        $q = DB::table('messages')->where('conversation_id', $id)->orderByDesc('created_at')->orderByDesc('id');
        if (! empty($data['cursor'])) {
            $parts = explode('|', (string) base64_decode($data['cursor'], true), 2);
            // Format strict : strtotime() accepte des textes (« tomorrow », « 1 week ago ») que PostgreSQL refuse en 500 (revue F-24).
            if (count($parts) !== 2 || ! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $parts[1]) || ! $this->validTimestamp($parts[0])) {
                throw ValidationException::withMessages(['cursor' => ['Curseur invalide.']]);
            }
            $q->whereRaw('(created_at, id) < (?::timestamptz, ?::uuid)', $parts);
        }

        $rows = $q->limit($limit + 1)->get();
        $page = $rows->take($limit);
        $last = $page->last();

        return response()->json([
            'data' => $this->presentMany($page),
            'next_cursor' => $rows->count() > $limit && $last ? base64_encode($last->created_at.'|'.$last->id) : null,
        ]);
    }

    public function store(Request $request, string $id, Conversations $conversations, MessageSafety $safety): JsonResponse
    {
        $me = $request->user();
        $conversation = $conversations->forParticipant($id, $me->id);
        abort_if($conversation === null, 404);

        $data = $request->validate([
            'client_id' => ['required', 'uuid'],
            'type' => ['required', Rule::in(['text', 'image', 'voice', 'video'])],
            'body' => ['nullable', 'string', 'max:2000'],
            'media_id' => ['nullable', 'uuid', 'prohibited_if:type,text', 'required_if:type,image,voice,video'],
        ]);
        if ($data['type'] !== 'text' && ! config('media.kinds.'.self::MEDIA_KIND[$data['type']].'.enabled', true)) {
            throw ValidationException::withMessages(['type' => ['Ce type de message n\'est pas disponible.']]);
        }

        // Renvoi après coupure réseau : même client_id => on renvoie le message déjà enregistré (idempotence).
        $existing = DB::table('messages')->where(['conversation_id' => $id, 'sender_id' => $me->id, 'client_id' => $data['client_id']])->first();
        if ($existing !== null) {
            return response()->json($this->presentOne($existing), 200);
        }

        if (! $conversations->canWrite($conversation, $me->id)) {
            return response()->json(['error' => ['code' => 'conversation_closed', 'message' => 'Cette conversation n\'est plus disponible.']], 403);
        }

        if ($data['type'] === 'text') {
            if (trim((string) ($data['body'] ?? '')) === '') {
                throw ValidationException::withMessages(['body' => ['Message vide.']]);
            }
        } else {
            $this->assertMedia($data, $me->id);
        }

        $messageId = (string) Str::uuid();
        // Microsecondes : sans elles, deux messages d'une même seconde seraient ordonnés au hasard (uuid).
        $at = now()->toDateTimeString('microsecond');
        try {
            DB::transaction(function () use ($messageId, $id, $me, $data, $at) {
                DB::table('messages')->insert([
                    'id' => $messageId, 'conversation_id' => $id, 'sender_id' => $me->id, 'client_id' => $data['client_id'], 'type' => $data['type'],
                    'body' => $data['body'] ?? null, 'media_id' => $data['media_id'] ?? null, 'created_at' => $at, 'updated_at' => $at,
                ]);
                DB::table('conversations')->where('id', $id)->update(['last_message_at' => $at, 'updated_at' => $at]);
            });
        } catch (UniqueConstraintViolationException $e) {
            // Deux envois simultanés avec le même client_id (renvoi après coupure) : le perdant renvoie le message du gagnant
            // au lieu d'une erreur 500 (revue F-25). Aucune diffusion ni push en double.
            $winner = DB::table('messages')->where(['conversation_id' => $id, 'sender_id' => $me->id, 'client_id' => $data['client_id']])->first();
            if ($winner === null) {
                throw $e;
            }

            return response()->json($this->presentOne($winner), 200);
        }

        $message = DB::table('messages')->where('id', $messageId)->first();
        $hint = $data['type'] === 'text' ? $safety->inspect($me->id, (string) $data['body']) : null;

        $payload = $this->presentOne($message) + ($hint ? ['safety_hint' => $hint] : []);
        MessageCreated::dispatch($id, $payload);

        $recipient = $conversations->other($conversation, $me->id);
        // Confidentialité (revues F-28 et P-14) : la file ne transporte que l'identifiant du message ; le job construit le corps
        // à l'envoi (texte générique par défaut, aperçu de 80 caractères avec PUSH_MESSAGE_PREVIEW=true).
        SendPush::dispatch($recipient, 'messages', 'Nouveau message', 'Vous avez reçu un nouveau message.', ['conversation_id' => $id, 'type' => 'message'], $messageId);

        /**
         * Message créé ; `safety_hint` apparaît quand un texte ressemble à une demande d'argent.
         *
         * @status 201
         *
         * @body array{id: string, conversation_id: string, sender_id: string, client_id: string, type: 'text'|'image'|'voice'|'video', body: string|null, media_id: string|null, media_status: 'processing'|'approved'|'rejected'|null, media_duration_seconds: int|null, delivered_at: string|null, read_at: string|null, created_at: string, safety_hint?: 'money_request'}
         */
        return response()->json($payload, 201);
    }

    public function read(Request $request, string $id, Conversations $conversations): Response
    {
        return $this->mark($request, $id, $conversations, 'read_at', 'message.read');
    }

    public function delivered(Request $request, string $id, Conversations $conversations): Response
    {
        return $this->mark($request, $id, $conversations, 'delivered_at', 'message.delivered');
    }

    public function typing(Request $request, string $id, Conversations $conversations): Response
    {
        $me = $request->user()->id;
        $conversation = $conversations->forParticipant($id, $me);
        abort_if($conversation === null, 404);

        if ($conversations->canWrite($conversation, $me)) {
            ConversationSignal::dispatch($id, 'typing', ['user_id' => $me]);
        }

        return response()->noContent();
    }

    public function destroy(Request $request, string $id): Response
    {
        $message = DB::table('messages')->where('id', $id)->where('sender_id', $request->user()->id)->first();
        abort_if($message === null, 404);

        // Le contenu est masqué par l'API mais conservé jusqu'à l'anonymisation : un expéditeur ne peut pas détruire
        // une preuve avant la revue d'un signalement (revue F-15).
        DB::table('messages')->where('id', $id)->update(['deleted_at' => now(), 'updated_at' => now()]);

        return response()->noContent();
    }

    private function mark(Request $request, string $id, Conversations $conversations, string $column, string $event): Response
    {
        $me = $request->user()->id;
        $conversation = $conversations->forParticipant($id, $me);
        abort_if($conversation === null, 404);

        $data = $request->validate(['up_to_message_id' => ['required', 'uuid']]);
        $upTo = DB::table('messages')->where('id', $data['up_to_message_id'])->where('conversation_id', $id)->first();
        abort_if($upTo === null, 404);

        // Mêmes conditions que l'envoi (revue F-27) : conversation bloquée, archivée ou compte suspendu => aucun accusé
        // enregistré ni diffusé. Réponse 204 comme pour « typing », sans révéler la raison.
        if (! $conversations->canWrite($conversation, $me)) {
            return response()->noContent();
        }

        $count = DB::table('messages')->where('conversation_id', $id)->where('sender_id', '<>', $me)->whereNull($column)
            ->where('created_at', '<=', $upTo->created_at)->update([$column => now(), 'updated_at' => now()]);

        if ($count > 0) {
            ConversationSignal::dispatch($id, $event, ['up_to_message_id' => $upTo->id, 'by' => $me]);
        }

        return response()->noContent();
    }

    /** Horodatage tel que renvoyé par PostgreSQL (« 2026-11-07 10:00:00.123456+00 ») ; rien d'autre n'est accepté dans un curseur. */
    private function validTimestamp(string $value): bool
    {
        if (! preg_match('/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/', $value, $m)) {
            return false;
        }

        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]) && (int) $m[4] < 24 && (int) $m[5] < 60 && (int) $m[6] < 60;
    }

    /**
     * Un média attaché doit appartenir à l'expéditeur, être du bon type et avoir passé le dépôt. Un média encore en traitement
     * (`transcoding`, notes vocales et vidéos) ou en revue (`processing`) est accepté : le message part tout de suite, et le destinataire ne reçoit l'adresse de lecture qu'une fois le
     * média approuvé (`media()`). Un média refusé ou non finalisé ne peut pas être envoyé.
     */
    private function assertMedia(array $data, string $userId): void
    {
        $media = DB::table('media')->where('id', $data['media_id'] ?? null)->first();

        if ($media === null || $media->user_id !== $userId || $media->kind !== self::MEDIA_KIND[$data['type']] || ! in_array($media->status, ['transcoding', 'processing', 'approved'], true)) {
            throw ValidationException::withMessages(['media_id' => ['Média invalide ou refusé.']]);
        }
    }

    /**
     * Adresse de lecture d'une image, d'une note vocale ou d'une vidéo de conversation.
     *
     * Réservée aux deux membres, uniquement quand la modération a approuvé le média (409 `media_pending` en revue, 410
     * `media_rejected` après un rejet). L'adresse est signée et expire (`media.read_ttl_minutes`) ; elle ne figure ni dans la
     * liste des messages ni dans les diffusions : le client la demande image par image.
     */
    public function media(Request $request, string $id, string $messageId, Conversations $conversations, MediaStorage $storage): JsonResponse
    {
        abort_if($conversations->forParticipant($id, $request->user()->id) === null, 404);

        $message = DB::table('messages')->where('id', $messageId)->where('conversation_id', $id)->first();
        abort_if($message === null || $message->deleted_at !== null || ! isset(self::MEDIA_KIND[$message->type]) || $message->media_id === null, 404);

        $media = DB::table('media')->where('id', $message->media_id)->where('kind', self::MEDIA_KIND[$message->type])->first();
        abort_if($media === null, 404);

        if ($media->status === 'rejected') {
            return response()->json(['error' => ['code' => 'media_rejected', 'message' => 'Cette image a été refusée par la modération.']], 410);
        }
        if ($media->status !== 'approved') {
            return response()->json(['error' => ['code' => 'media_pending', 'message' => 'Cette image est en cours de vérification.']], 409);
        }

        $ttl = (int) config('media.read_ttl_minutes', 10);

        /**
         * Adresse signée de l'image, valable jusqu'à `expires_at`.
         *
         * @body array{url: string, expires_at: string}
         */
        return response()->json(['url' => $storage->temporaryUrl($media->storage_key, $ttl), 'expires_at' => now()->addMinutes($ttl)->toIso8601String()])
            ->header('Cache-Control', 'no-store, private');
    }

    /**
     * Statut et durée du média des messages image, vocaux et vidéo donnés : `media_id => ['status' => ..., 'seconds' => ...]`.
     * « transcoding » (traitement interne) se lit « processing » : le client n'a pas à connaître l'étape.
     *
     * @param  iterable<stdClass>  $messages
     * @return array<string, array{status: string, seconds: int|null}>
     */
    private function mediaStatuses(iterable $messages): array
    {
        $ids = [];
        foreach ($messages as $m) {
            if (isset(self::MEDIA_KIND[$m->type]) && $m->deleted_at === null && $m->media_id !== null) {
                $ids[] = $m->media_id;
            }
        }
        if ($ids === []) {
            return [];
        }

        $out = [];
        foreach (DB::table('media')->whereIn('id', array_unique($ids))->get(['id', 'status', 'duration_seconds']) as $row) {
            $out[$row->id] = ['status' => $row->status === 'transcoding' ? 'processing' : $row->status, 'seconds' => $row->duration_seconds === null ? null : (int) $row->duration_seconds];
        }

        return $out;
    }

    private function presentOne(stdClass $m): array
    {
        return $this->present($m, $this->mediaStatuses([$m]));
    }

    /**
     * @param  iterable<stdClass>  $messages
     * @return list<array<string, mixed>>
     */
    private function presentMany(iterable $messages): array
    {
        $statuses = $this->mediaStatuses($messages);
        $out = [];
        foreach ($messages as $m) {
            $out[] = $this->present($m, $statuses);
        }

        return $out;
    }

    /**
     * `type` vaut « deleted » quand le message a été supprimé par son expéditeur (contenu masqué).
     * `media_status` : statut de modération du média (`processing` en traitement ou en revue, `approved`, `rejected`) ; null pour un
     * message sans média. `media_duration_seconds` : durée d'une note vocale ou d'une vidéo, null sinon.
     *
     * @param  array<string, array{status: string, seconds: int|null}>  $mediaStatuses  `media_id => statut et durée`
     * @return array<string, mixed>
     *
     * @scramble-return array{id: string, conversation_id: string, sender_id: string, client_id: string, type: 'text'|'image'|'video'|'voice'|'gift'|'call_missed'|'system'|'deleted', body: string|null, media_id: string|null, media_status: 'processing'|'approved'|'rejected'|null, media_duration_seconds: int|null, delivered_at: string|null, read_at: string|null, created_at: string}
     */
    private function present(stdClass $m, array $mediaStatuses = []): array
    {
        $deleted = $m->deleted_at !== null;
        $media = ! $deleted && isset(self::MEDIA_KIND[$m->type]) && $m->media_id !== null ? ($mediaStatuses[$m->media_id] ?? null) : null;
        $status = $media['status'] ?? null;

        return [
            'id' => $m->id,
            'conversation_id' => $m->conversation_id,
            'sender_id' => $m->sender_id,
            'client_id' => $m->client_id,
            'type' => $deleted ? 'deleted' : $m->type,
            'body' => $deleted ? null : $m->body,
            'media_id' => $deleted ? null : $m->media_id,
            'media_status' => in_array($status, ['processing', 'approved', 'rejected'], true) ? $status : null,
            'media_duration_seconds' => in_array($m->type, ['voice', 'video'], true) ? ($media['seconds'] ?? null) : null,
            'delivered_at' => $m->delivered_at,
            'read_at' => $m->read_at,
            'created_at' => $m->created_at,
        ];
    }
}
