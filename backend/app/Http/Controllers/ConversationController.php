<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Services\Conversations;
use App\Services\Premium;
use App\Services\ProfilePresenter;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class ConversationController extends Controller
{
    public function index(Request $request, ProfilePresenter $presenter, Conversations $conversations): JsonResponse
    {
        $me = $request->user()->id;

        // Pagination optionnelle et rétrocompatible : sans paramètre, jusqu'à 100 conversations comme avant.
        $params = $request->validate(['limit' => ['nullable', 'integer', 'min:1', 'max:100'], 'cursor' => ['nullable', 'string', 'max:200']]);
        $limit = (int) ($params['limit'] ?? 100);

        $query = DB::table('conversations')
            ->select('conversations.*')->selectRaw('coalesce(last_message_at, created_at) as sort_at')
            ->where(fn ($q) => $q->where('user_a', $me)->orWhere('user_b', $me))
            ->whereNotIn('status', ['blocked'])
            // « Supprimée » côté soi : réapparaît seulement si un message arrive après.
            ->where(function ($q) use ($me) {
                $q->whereRaw('(user_a = ? and (hidden_by_a_at is null or last_message_at > hidden_by_a_at))', [$me])
                    ->orWhereRaw('(user_b = ? and (hidden_by_b_at is null or last_message_at > hidden_by_b_at))', [$me]);
            });

        if (! empty($params['cursor'])) {
            $parts = explode('|', (string) base64_decode($params['cursor'], true), 2);
            // Format strict (horodatage + uuid) : PostgreSQL refuserait autrement le texte en 500.
            if (count($parts) !== 2 || ! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $parts[1]) || ! $this->validTimestamp($parts[0])) {
                throw ValidationException::withMessages(['cursor' => ['Curseur invalide.']]);
            }
            $query->whereRaw('(coalesce(last_message_at, created_at), id) < (?::timestamptz, ?::uuid)', $parts);
        }

        // Dernière activité décroissante, égalités départagées par l'identifiant : pas de doublon ni de trou entre pages.
        $fetched = $query->orderByRaw('coalesce(last_message_at, created_at) desc')->orderByDesc('id')->limit($limit + 1)->get();
        $rows = $fetched->take($limit);
        $lastRow = $rows->last();
        $nextCursor = $fetched->count() > $limit && $lastRow ? base64_encode($lastRow->sort_at.'|'.$lastRow->id) : null;

        $others = $rows->map(fn ($c) => $conversations->other($c, $me));
        $ids = $rows->pluck('id')->all();

        // Requêtes en nombre constant, quel que soit le nombre de conversations (revue CTO, risque 9) :
        // profils + utilisateurs + médias (présentateur), non lus, derniers messages.
        $profiles = Profile::with('user')->whereIn('user_id', $others)->get()->keyBy('user_id');
        $presented = $presenter->publicMany($profiles->filter(fn ($p) => $p->user->status === 'active'));

        // Non lus : index partiel messages_unread_idx (read_at et deleted_at nuls).
        $unread = DB::table('messages')->whereIn('conversation_id', $ids)->where('sender_id', '<>', $me)->whereNull('read_at')->whereNull('deleted_at')
            ->selectRaw('conversation_id, count(*) as n')->groupBy('conversation_id')->pluck('n', 'conversation_id');

        // Dernier message de chaque conversation en une requête (jointure latérale, index messages_conversation_created_idx).
        $lastByConversation = $ids === [] ? collect() : collect(DB::select(
            'select m.* from conversations c cross join lateral ('
            .'select id, conversation_id, sender_id, type, body, created_at from messages '
            .'where messages.conversation_id = c.id and messages.deleted_at is null order by created_at desc, id desc limit 1'
            .') m where c.id in ('.implode(',', array_fill(0, count($ids), '?')).')',
            $ids
        ))->keyBy('conversation_id');

        /**
         * @body array{data: list<array{id: string, match_id: string|null, status: string, unlocked_by: string, unread: int, last_message: array{id: string, mine: bool, type: string, body: string|null, created_at: string}|null, profile: array{user_id: string, display_name: string, age: int, gender: 'man'|'woman'|'other', origin_country: string, residence_country: string, city: string|null, bio: string|null, intent: 'marriage'|'long_lasting_love'|'flirt'|'friendship'|'lets_find_out', verified: bool, media: list<array{id: string, kind: 'profile_photo'|'profile_video', position: int, status: 'pending_upload'|'processing'|'approved'|null, url: string|null}>, last_seen_at?: string|null, online?: bool}|null}>, meta: array{next_cursor: string|null}}
         */
        return response()->json(['data' => $rows->map(function ($c) use ($me, $conversations, $presented, $unread, $lastByConversation) {
            $other = $conversations->other($c, $me);
            $last = $lastByConversation->get($c->id);

            return [
                'id' => $c->id,
                // Identifiant du match à rompre (DELETE /matches/{id}) ; nul hors match. Évite de chercher le match dans
                // GET /matches, plafonné aux 100 derniers sans curseur.
                'match_id' => $c->match_id,
                'status' => $c->status,
                'unlocked_by' => $c->unlocked_by,
                'unread' => (int) ($unread[$c->id] ?? 0),
                'last_message' => $last ? ['id' => $last->id, 'mine' => $last->sender_id === $me, 'type' => $last->type, 'body' => $last->type === 'text' ? $last->body : null, 'created_at' => $last->created_at] : null,
                'profile' => $presented[$other] ?? null,
            ];
        })->values(), 'meta' => ['next_cursor' => $nextCursor]]);
    }

    private function validTimestamp(string $value): bool
    {
        if (! preg_match('/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/', $value, $m)) {
            return false;
        }

        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]) && (int) $m[4] < 24 && (int) $m[5] < 60 && (int) $m[6] < 60;
    }

    /**
     * Ouvre une conversation hors match : réservé aux abonnés Premium ou à un crédit « Conversation ».
     */
    public function store(Request $request, Conversations $conversations): JsonResponse
    {
        $me = $request->user();
        $data = $request->validate(['target_id' => ['required', 'uuid']]);
        abort_if($data['target_id'] === $me->id, 422, 'Action impossible.');

        $target = Profile::where('user_id', $data['target_id'])->first();
        abort_if($target === null || Gate::forUser($me)->denies('view', $target), 404);

        $pair = [$me->id, $data['target_id']];
        sort($pair, SORT_STRING);

        $existing = DB::table('conversations')->where('user_a', $pair[0])->where('user_b', $pair[1])->first();
        if ($existing !== null) {
            $this->ensureWritable($existing, $me->id, $conversations);

            /**
             * Conversation déjà ouverte avec cette personne (aucun crédit dépensé).
             *
             * @body array{id: string, status: 'active'|'blocked'|'archived'}
             */
            return response()->json(['id' => $existing->id, 'status' => $existing->status], 200);
        }

        $today = now()->toDateString();
        $premium = Premium::active($me->id);

        try {
            $result = DB::transaction(function () use ($me, $pair, $premium, $conversations, $today) {
                // Verrou sur la ligne utilisateur : deux ouvertures simultanées ne dépensent pas le même crédit et le quota
                // ci-dessous est lu sous verrou (revue F-25 : pas de dépassement par requêtes parallèles).
                DB::table('users')->where('id', $me->id)->lockForUpdate()->first();

                // Anti-spam : 10 nouvelles conversations par jour pour un compte gratuit (docs/10).
                if (! $premium && (int) DB::table('daily_counters')->where(['user_id' => $me->id, 'day' => $today, 'kind' => 'new_conversations'])->value('count') >= 10) {
                    return 'quota';
                }

                if (! $premium && $conversations->creditBalance($me->id) < 1) {
                    return null;
                }

                $id = (string) Str::uuid();
                $unlocked = $premium ? 'premium' : 'credit';

                DB::table('conversations')->insert([
                    'id' => $id, 'user_a' => $pair[0], 'user_b' => $pair[1], 'initiated_by' => $me->id, 'unlocked_by' => $unlocked,
                    'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
                ]);

                if (! $premium) {
                    DB::table('credit_ledger')->insert([
                        'id' => (string) Str::uuid(), 'user_id' => $me->id, 'credit_type' => 'conversation', 'delta' => -1,
                        'reason' => 'spend_conversation', 'ref_type' => 'conversation', 'ref_id' => $id,
                        'idempotency_key' => 'open:'.$pair[0].':'.$pair[1], 'created_at' => now(),
                    ]);
                }

                DB::statement(
                    'insert into daily_counters (user_id, day, kind, count) values (?, ?, ?, 1) on conflict (user_id, day, kind) do update set count = daily_counters.count + 1',
                    [$me->id, $today, 'new_conversations']
                );

                return $id;
            });
        } catch (UniqueConstraintViolationException $e) {
            // Ouverture simultanée de la même paire (l'autre personne, ou un renvoi) : la transaction est annulée, donc aucun
            // crédit n'est dépensé ; on renvoie la conversation du gagnant au lieu d'une erreur 500 (revue F-25).
            $existing = DB::table('conversations')->where('user_a', $pair[0])->where('user_b', $pair[1])->first();
            if ($existing === null) {
                // Collision sans conversation : la clé d'idempotence du crédit (credit_ledger) existe déjà alors que la ligne
                // `conversations` n'existe pas (transaction du gagnant pas encore visible, ou reste d'une ouverture antérieure).
                // Rien n'a été dépensé (transaction annulée) : réponse propre et rejouable, pas de 500.
                Log::warning("conversation: collision d'idempotence sans conversation", ['user' => $me->id]);

                return response()->json(['error' => ['code' => 'conversation_conflict', 'message' => 'Ouverture déjà en cours. Réessayez dans un instant.']], 409)
                    ->header('Retry-After', '1');
            }

            $this->ensureWritable($existing, $me->id, $conversations);

            /**
             * Conversation déjà ouverte avec cette personne (aucun crédit dépensé).
             *
             * @body array{id: string, status: 'active'|'blocked'|'archived'}
             */
            return response()->json(['id' => $existing->id, 'status' => $existing->status], 200);
        }

        if ($result === 'quota') {
            return response()->json(['error' => ['code' => 'quota_reached', 'message' => 'Trop de nouvelles conversations aujourd\'hui.']], 429);
        }

        if ($result === null) {
            return response()->json(['error' => ['code' => 'credit_required', 'message' => 'Un crédit « Conversation » ou un abonnement Premium est nécessaire.']], 402);
        }

        /**
         * Conversation créée.
         *
         * @status 201
         *
         * @body array{id: string, status: 'active'}
         */
        return response()->json(['id' => $result, 'status' => 'active'], 201);
    }

    /**
     * Une conversation existante n'est rendue que si l'on peut y écrire : blocage, suspension ou conversation fermée depuis
     * l'ouverture, on ne renvoie plus un identifiant exploitable (403 conversation_closed).
     */
    private function ensureWritable(object $existing, string $me, Conversations $conversations): void
    {
        if (! $conversations->canWrite($existing, $me)) {
            throw new HttpResponseException(response()->json(['error' => ['code' => 'conversation_closed', 'message' => "Cette conversation n'est plus disponible."]], 403));
        }
    }

    /** « Supprimer » une conversation = la masquer pour soi ; elle reste disponible à la modération. */
    public function hide(Request $request, string $id, Conversations $conversations): Response
    {
        $me = $request->user()->id;
        $conversation = $conversations->forParticipant($id, $me);
        abort_if($conversation === null, 404);

        DB::table('conversations')->where('id', $id)->update([
            $conversation->user_a === $me ? 'hidden_by_a_at' : 'hidden_by_b_at' => now()->toDateTimeString('microsecond'),
            'updated_at' => now(),
        ]);

        return response()->noContent();
    }
}
