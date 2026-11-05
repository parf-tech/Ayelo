<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Services\Conversations;
use App\Services\Premium;
use App\Services\ProfilePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ConversationController extends Controller
{
    public function index(Request $request, ProfilePresenter $presenter, Conversations $conversations): JsonResponse
    {
        $me = $request->user()->id;

        $rows = DB::table('conversations')
            ->where(fn ($q) => $q->where('user_a', $me)->orWhere('user_b', $me))
            ->whereNotIn('status', ['blocked'])
            // « Supprimée » côté soi : réapparaît seulement si un message arrive après.
            ->where(function ($q) use ($me) {
                $q->whereRaw('(user_a = ? and (hidden_by_a_at is null or last_message_at > hidden_by_a_at))', [$me])
                    ->orWhereRaw('(user_b = ? and (hidden_by_b_at is null or last_message_at > hidden_by_b_at))', [$me]);
            })
            ->orderByRaw('coalesce(last_message_at, created_at) desc')->limit(100)->get();

        $others = $rows->map(fn ($c) => $conversations->other($c, $me));
        $profiles = Profile::with('user')->whereIn('user_id', $others)->get()->keyBy('user_id');

        $unread = DB::table('messages')->whereIn('conversation_id', $rows->pluck('id'))->where('sender_id', '<>', $me)->whereNull('read_at')->whereNull('deleted_at')
            ->selectRaw('conversation_id, count(*) as n')->groupBy('conversation_id')->pluck('n', 'conversation_id');

        return response()->json(['data' => $rows->map(function ($c) use ($me, $conversations, $profiles, $unread, $presenter) {
            $other = $conversations->other($c, $me);
            $last = DB::table('messages')->where('conversation_id', $c->id)->whereNull('deleted_at')->orderByDesc('created_at')->first(['id', 'sender_id', 'type', 'body', 'created_at']);

            return [
                'id' => $c->id,
                'status' => $c->status,
                'unlocked_by' => $c->unlocked_by,
                'unread' => (int) ($unread[$c->id] ?? 0),
                'last_message' => $last ? ['id' => $last->id, 'mine' => $last->sender_id === $me, 'type' => $last->type, 'body' => $last->type === 'text' ? $last->body : null, 'created_at' => $last->created_at] : null,
                'profile' => isset($profiles[$other]) && $profiles[$other]->user->status === 'active' ? $presenter->public($profiles[$other]) : null,
            ];
        })->values()]);
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
            return response()->json(['id' => $existing->id, 'status' => $existing->status], 200);
        }

        $today = now()->toDateString();
        $premium = Premium::active($me->id);

        // Anti-spam : 10 nouvelles conversations par jour pour un compte gratuit (docs/10).
        if (! $premium && (int) DB::table('daily_counters')->where(['user_id' => $me->id, 'day' => $today, 'kind' => 'new_conversations'])->value('count') >= 10) {
            return response()->json(['error' => ['code' => 'quota_reached', 'message' => 'Trop de nouvelles conversations aujourd\'hui.']], 429);
        }

        $result = DB::transaction(function () use ($me, $pair, $premium, $conversations, $today) {
            // Verrou sur la ligne utilisateur : deux ouvertures simultanées ne dépensent pas le même crédit.
            DB::table('users')->where('id', $me->id)->lockForUpdate()->first();

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

        if ($result === null) {
            return response()->json(['error' => ['code' => 'credit_required', 'message' => 'Un crédit « Conversation » ou un abonnement Premium est nécessaire.']], 402);
        }

        return response()->json(['id' => $result, 'status' => 'active'], 201);
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
