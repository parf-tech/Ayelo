<?php

namespace App\Http\Controllers;

use App\Events\CallEvent;
use App\Services\Calls;
use App\Services\Conversations;
use App\Services\LiveKitTokens;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use stdClass;
use Symfony\Component\HttpFoundation\Response;

class CallController extends Controller
{
    /**
     * Démarre un appel. Réservé aux matchs (décision propriétaire E2) : la conversation doit venir d'un match actif,
     * sans blocage, entre deux comptes actifs. Un appelé déjà en ligne reçoit l'état « busy ».
     */
    public function store(Request $request, Conversations $conversations, Calls $calls, LiveKitTokens $tokens): JsonResponse
    {
        $me = $request->user();
        $data = $request->validate(['conversation_id' => ['required', 'uuid'], 'kind' => ['required', Rule::in(['audio', 'video'])]]);

        $conversation = $conversations->forParticipant($data['conversation_id'], $me->id);
        abort_if($conversation === null, 404);

        if ($conversation->match_id === null) {
            return response()->json(['error' => ['code' => 'match_required', 'message' => 'Les appels sont réservés aux matchs.']], 403);
        }
        if (! $conversations->canWrite($conversation, $me->id)) {
            return response()->json(['error' => ['code' => 'conversation_closed', 'message' => 'Cette conversation n\'est plus disponible.']], 403);
        }
        if (DB::table('matches')->where('id', $conversation->match_id)->value('status') !== 'active') {
            return response()->json(['error' => ['code' => 'match_required', 'message' => 'Les appels sont réservés aux matchs.']], 403);
        }

        $callee = $conversations->other($conversation, $me->id);

        // Verrou sur l'appelant et l'appelé, puis contrôles et insertion dans la même transaction : deux requêtes
        // simultanées ne peuvent plus créer deux sonneries pour le même appelant ni faire sonner deux fois l'appelé (revue F-14).
        $id = (string) Str::uuid();
        $room = 'call-'.$id;
        $outcome = DB::transaction(function () use ($calls, $me, $callee, $conversation, $data, $id, $room) {
            $calls->lockUsers($me->id, $callee);

            if ($calls->activeFor($me->id) !== null) {
                return 'already_in_call';
            }
            // Plafond par paire : 10 sonneries par minute (limiteur) restaient possibles, avec autant de push et de messages « manqué ».
            if ($calls->unansweredRecently($me->id, $callee) >= Calls::MAX_UNANSWERED_PER_HOUR) {
                return 'rate_limited';
            }

            $busy = $calls->activeFor($callee) !== null;
            DB::table('call_sessions')->insert([
                'id' => $id, 'conversation_id' => $conversation->id, 'caller_id' => $me->id, 'callee_id' => $callee, 'kind' => $data['kind'],
                'status' => $busy ? 'busy' : 'ringing', 'livekit_room' => $room, 'ended_at' => $busy ? now() : null, 'created_at' => now(), 'updated_at' => now(),
            ]);

            return $busy ? 'busy' : 'ringing';
        });

        if ($outcome === 'already_in_call') {
            return response()->json(['error' => ['code' => 'already_in_call', 'message' => 'Vous avez déjà un appel en cours.']], 409);
        }
        if ($outcome === 'rate_limited') {
            return response()->json(['error' => ['code' => 'call_limit', 'message' => "Trop d'appels restés sans réponse. Réessayez plus tard."]], 429);
        }

        $call = DB::table('call_sessions')->where('id', $id)->first();

        if ($outcome === 'busy') {
            $calls->missedMessage($call);

            return response()->json(['id' => $id, 'status' => 'busy'], 200);
        }

        $name = (string) DB::table('profiles')->where('user_id', $me->id)->value('display_name');
        $calls->incoming($call, $name);

        return response()->json([
            'id' => $id, 'status' => 'ringing', 'ring_seconds' => Calls::RING_SECONDS,
            'livekit' => ['url' => $tokens->url(), 'room' => $room, 'token' => $tokens->mint($room, $me->id, $name, $data['kind'] === 'video')],
        ], 201);
    }

    public function accept(Request $request, string $id, Calls $calls, Conversations $conversations, LiveKitTokens $tokens): JsonResponse
    {
        $call = $this->participantCall($request, $id);
        abort_if($call->callee_id !== $request->user()->id, 403);

        // Blocage, suspension ou conversation fermée depuis la sonnerie : l'appel n'est pas décroché (revue F-14).
        $conversation = $conversations->forParticipant($call->conversation_id, $request->user()->id);
        if ($call->status === 'ringing' && ($conversation === null || ! $conversations->canWrite($conversation, $request->user()->id))) {
            if (DB::table('call_sessions')->where('id', $id)->where('status', 'ringing')->update(['status' => 'failed', 'ended_at' => now(), 'updated_at' => now()]) > 0) {
                CallEvent::dispatch('user.'.$call->caller_id, 'call.cancelled', ['call_id' => $id, 'reason' => 'unavailable']);
                $calls->closeRoom($call);
            }

            return response()->json(['error' => ['code' => 'conversation_closed', 'message' => 'Cette conversation n\'est plus disponible.']], 403);
        }

        // Un appel qui sonne depuis plus de 30 s n'est plus décrochable, même si la tâche d'expiration n'est pas encore passée.
        $updated = DB::table('call_sessions')->where('id', $id)->where('status', 'ringing')
            ->where('created_at', '>', now()->subSeconds(Calls::RING_SECONDS))->update(['status' => 'accepted', 'started_at' => now(), 'updated_at' => now()]);
        if ($updated === 0) {
            return response()->json(['error' => ['code' => 'call_not_ringing', 'message' => 'Cet appel n\'est plus disponible.']], 409);
        }

        $calls->notifyState($call, 'accepted');
        $name = (string) DB::table('profiles')->where('user_id', $request->user()->id)->value('display_name');

        return response()->json(['id' => $id, 'status' => 'accepted', 'livekit' => [
            'url' => $tokens->url(), 'room' => $call->livekit_room, 'token' => $tokens->mint($call->livekit_room, $request->user()->id, $name, $call->kind === 'video'),
        ]]);
    }

    public function decline(Request $request, string $id, Calls $calls): Response
    {
        $call = $this->participantCall($request, $id);
        abort_if($call->callee_id !== $request->user()->id, 403);

        if (DB::table('call_sessions')->where('id', $id)->where('status', 'ringing')->update(['status' => 'declined', 'ended_at' => now(), 'updated_at' => now()]) > 0) {
            CallEvent::dispatch('user.'.$call->callee_id, 'call.cancelled', ['call_id' => $id, 'reason' => 'declined']);
            $calls->notifyState($call, 'declined');
            $calls->closeRoom($call);
        }

        return response()->noContent();
    }

    /** Raccrocher : l'appelant peut annuler pendant la sonnerie, chacun peut terminer un appel accepté. */
    public function end(Request $request, string $id, Calls $calls): Response
    {
        $call = $this->participantCall($request, $id);
        $me = $request->user()->id;

        if ($call->status === 'ringing' && $call->caller_id === $me) {
            DB::table('call_sessions')->where('id', $id)->update(['status' => 'missed', 'ended_at' => now(), 'updated_at' => now()]);
            $calls->missedMessage($call);
            CallEvent::dispatch('user.'.$call->callee_id, 'call.cancelled', ['call_id' => $id, 'reason' => 'cancelled']);
            $calls->notifyState($call, 'missed');
            $calls->closeRoom($call);
        } elseif ($call->status === 'accepted') {
            if (DB::table('call_sessions')->where('id', $id)->where('status', 'accepted')->update(['status' => 'ended', 'ended_at' => now(), 'updated_at' => now()]) > 0) {
                $calls->notifyState($call, 'ended');
                $calls->closeRoom($call);
            }
        }

        return response()->noContent();
    }

    /** Renouvellement du jeton (10 minutes) pendant un appel en cours. */
    public function token(Request $request, string $id, LiveKitTokens $tokens, Conversations $conversations): JsonResponse
    {
        $call = $this->participantCall($request, $id);

        if (! in_array($call->status, ['ringing', 'accepted'], true)) {
            return response()->json(['error' => ['code' => 'call_ended', 'message' => 'Cet appel est terminé.']], 409);
        }

        // Blocage, suspension, bannissement ou conversation fermée depuis le début de l'appel : pas de nouveau jeton (revue pentest P-05).
        $conversation = $conversations->forParticipant($call->conversation_id, $request->user()->id);
        if ($conversation === null || ! $conversations->canWrite($conversation, $request->user()->id)) {
            return response()->json(['error' => ['code' => 'conversation_closed', 'message' => 'Cette conversation n\'est plus disponible.']], 403);
        }

        // L'appelé ne reçoit aucun jeton tant qu'il n'a pas décroché : sinon il pourrait écouter l'appelant (revue F-07).
        if ($call->status === 'ringing' && $call->callee_id === $request->user()->id) {
            return response()->json(['error' => ['code' => 'call_not_accepted', 'message' => 'Décrochez d\'abord.']], 409);
        }

        $name = (string) DB::table('profiles')->where('user_id', $request->user()->id)->value('display_name');

        return response()->json(['livekit' => [
            'url' => $tokens->url(), 'room' => $call->livekit_room, 'token' => $tokens->mint($call->livekit_room, $request->user()->id, $name, $call->kind === 'video'),
        ]]);
    }

    private function participantCall(Request $request, string $id): stdClass
    {
        $me = $request->user()->id;
        $call = DB::table('call_sessions')->where('id', $id)->where(fn ($q) => $q->where('caller_id', $me)->orWhere('callee_id', $me))->first();
        abort_if($call === null, 404);

        return $call;
    }
}
