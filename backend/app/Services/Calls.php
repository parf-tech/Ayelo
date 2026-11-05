<?php

namespace App\Services;

use App\Events\CallEvent;
use App\Jobs\SendPush;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

/** Cycle de vie d'un appel : sonnerie, réponse, fin, manqué, durée maximale (FR-E-*). */
class Calls
{
    public const RING_SECONDS = 30;

    public const MAX_MINUTES = 20;

    /** Appel en cours (sonnerie ou communication) impliquant l'un des deux utilisateurs. */
    public function activeFor(string ...$userIds): ?stdClass
    {
        return DB::table('call_sessions')->whereIn('status', ['ringing', 'accepted'])
            ->where(fn ($q) => $q->whereIn('caller_id', $userIds)->orWhereIn('callee_id', $userIds))->first();
    }

    public function notifyState(stdClass $call, string $state): void
    {
        $payload = ['call_id' => $call->id, 'conversation_id' => $call->conversation_id, 'state' => $state, 'kind' => $call->kind];
        CallEvent::dispatch('conversation.'.$call->conversation_id, 'call.state', $payload);
    }

    public function incoming(stdClass $call, string $callerName): void
    {
        $payload = ['call_id' => $call->id, 'conversation_id' => $call->conversation_id, 'kind' => $call->kind, 'caller_id' => $call->caller_id, 'caller_name' => $callerName];
        CallEvent::dispatch('user.'.$call->callee_id, 'call.incoming', $payload);
        // Appel entrant app fermée : push haute priorité (iOS : push VoIP + CallKit, voir docs/08).
        SendPush::dispatch($call->callee_id, 'calls', $callerName, $call->kind === 'video' ? 'Appel vidéo entrant' : 'Appel audio entrant', ['type' => 'call', 'call_id' => $call->id]);
    }

    /** Marque comme manqués les appels qui sonnent depuis plus de 30 s, et termine ceux de plus de 20 minutes. @return array{missed: int, ended: int} */
    public function expire(): array
    {
        $missed = DB::table('call_sessions')->where('status', 'ringing')->where('created_at', '<=', now()->subSeconds(self::RING_SECONDS))->get();
        foreach ($missed as $call) {
            DB::transaction(function () use ($call) {
                DB::table('call_sessions')->where('id', $call->id)->where('status', 'ringing')->update(['status' => 'missed', 'ended_at' => now(), 'updated_at' => now()]);
                $this->missedMessage($call);
            });
            CallEvent::dispatch('user.'.$call->callee_id, 'call.cancelled', ['call_id' => $call->id, 'reason' => 'missed']);
            $this->notifyState($call, 'missed');
        }

        $long = DB::table('call_sessions')->where('status', 'accepted')->where('started_at', '<=', now()->subMinutes(self::MAX_MINUTES))->get();
        foreach ($long as $call) {
            DB::table('call_sessions')->where('id', $call->id)->update(['status' => 'ended', 'ended_at' => now(), 'updated_at' => now()]);
            $this->notifyState($call, 'ended');
        }

        return ['missed' => $missed->count(), 'ended' => $long->count()];
    }

    /** Message « appel manqué » dans la conversation (FR-E-6). */
    public function missedMessage(stdClass $call): void
    {
        DB::table('messages')->insert([
            'id' => (string) Str::uuid(), 'conversation_id' => $call->conversation_id, 'sender_id' => $call->caller_id, 'client_id' => (string) Str::uuid(),
            'type' => 'call_missed', 'body' => $call->kind, 'created_at' => now()->toDateTimeString('microsecond'), 'updated_at' => now(),
        ]);
        DB::table('conversations')->where('id', $call->conversation_id)->update(['last_message_at' => now()->toDateTimeString('microsecond'), 'updated_at' => now()]);
    }
}
