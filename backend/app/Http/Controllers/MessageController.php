<?php

namespace App\Http\Controllers;

use App\Events\ConversationSignal;
use App\Events\MessageCreated;
use App\Jobs\SendPush;
use App\Services\Conversations;
use App\Services\MessageSafety;
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
    // Texte et images seulement au lancement (vidéos et notes vocales : spec 012).
    private const MEDIA_KIND = ['image' => 'message_image'];

    public function index(Request $request, string $id, Conversations $conversations): JsonResponse
    {
        $me = $request->user()->id;
        abort_if($conversations->forParticipant($id, $me) === null, 404);

        $data = $request->validate(['limit' => ['nullable', 'integer', 'min:1', 'max:100'], 'cursor' => ['nullable', 'string', 'max:200']]);
        $limit = (int) ($data['limit'] ?? 30);

        $q = DB::table('messages')->where('conversation_id', $id)->orderByDesc('created_at')->orderByDesc('id');
        if (! empty($data['cursor'])) {
            $parts = explode('|', (string) base64_decode($data['cursor'], true), 2);
            if (count($parts) !== 2 || ! preg_match('/^[0-9a-f-]{36}$/', $parts[1]) || strtotime($parts[0]) === false) {
                throw ValidationException::withMessages(['cursor' => ['Curseur invalide.']]);
            }
            $q->whereRaw('(created_at, id) < (?::timestamptz, ?::uuid)', $parts);
        }

        $rows = $q->limit($limit + 1)->get();
        $page = $rows->take($limit);
        $last = $page->last();

        return response()->json([
            'data' => $page->map(fn ($m) => $this->present($m))->values(),
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
            'type' => ['required', Rule::in(['text', 'image'])],
            'body' => ['nullable', 'string', 'max:2000'],
            'media_id' => ['nullable', 'uuid'],
        ]);

        // Renvoi après coupure réseau : même client_id => on renvoie le message déjà enregistré (idempotence).
        $existing = DB::table('messages')->where(['conversation_id' => $id, 'sender_id' => $me->id, 'client_id' => $data['client_id']])->first();
        if ($existing !== null) {
            return response()->json($this->present($existing), 200);
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
        DB::transaction(function () use ($messageId, $id, $me, $data, $at) {
            DB::table('messages')->insert([
                'id' => $messageId, 'conversation_id' => $id, 'sender_id' => $me->id, 'client_id' => $data['client_id'], 'type' => $data['type'],
                'body' => $data['body'] ?? null, 'media_id' => $data['media_id'] ?? null, 'created_at' => $at, 'updated_at' => $at,
            ]);
            DB::table('conversations')->where('id', $id)->update(['last_message_at' => $at, 'updated_at' => $at]);
        });

        $message = DB::table('messages')->where('id', $messageId)->first();
        $hint = $data['type'] === 'text' ? $safety->inspect($me->id, (string) $data['body']) : null;

        $payload = $this->present($message) + ($hint ? ['safety_hint' => $hint] : []);
        MessageCreated::dispatch($id, $payload);

        $recipient = $conversations->other($conversation, $me->id);
        SendPush::dispatch($recipient, 'messages', 'Nouveau message', $data['type'] === 'text' ? Str::limit((string) $data['body'], 80) : 'Média reçu', ['conversation_id' => $id, 'type' => 'message']);

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
        abort_if($conversations->forParticipant($id, $me) === null, 404);

        $data = $request->validate(['up_to_message_id' => ['required', 'uuid']]);
        $upTo = DB::table('messages')->where('id', $data['up_to_message_id'])->where('conversation_id', $id)->first();
        abort_if($upTo === null, 404);

        $count = DB::table('messages')->where('conversation_id', $id)->where('sender_id', '<>', $me)->whereNull($column)
            ->where('created_at', '<=', $upTo->created_at)->update([$column => now(), 'updated_at' => now()]);

        if ($count > 0) {
            ConversationSignal::dispatch($id, $event, ['up_to_message_id' => $upTo->id, 'by' => $me]);
        }

        return response()->noContent();
    }

    /** Un média attaché doit appartenir à l'expéditeur, être du bon type et avoir été approuvé. */
    private function assertMedia(array $data, string $userId): void
    {
        $media = DB::table('media')->where('id', $data['media_id'] ?? null)->first();

        if ($media === null || $media->user_id !== $userId || $media->kind !== self::MEDIA_KIND[$data['type']] || $media->status !== 'approved') {
            throw ValidationException::withMessages(['media_id' => ['Média invalide ou pas encore approuvé.']]);
        }
    }

    /** @return array<string, mixed> */
    private function present(stdClass $m): array
    {
        $deleted = $m->deleted_at !== null;

        return [
            'id' => $m->id,
            'conversation_id' => $m->conversation_id,
            'sender_id' => $m->sender_id,
            'client_id' => $m->client_id,
            'type' => $deleted ? 'deleted' : $m->type,
            'body' => $deleted ? null : $m->body,
            'media_id' => $deleted ? null : $m->media_id,
            'delivered_at' => $m->delivered_at,
            'read_at' => $m->read_at,
            'created_at' => $m->created_at,
        ];
    }
}
