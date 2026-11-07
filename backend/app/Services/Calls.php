<?php

namespace App\Services;

use App\Events\CallEvent;
use App\Jobs\CloseCallRoom;
use App\Jobs\SendPush;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use stdClass;
use Throwable;

/** Cycle de vie d'un appel : sonnerie, réponse, fin, manqué, durée maximale (FR-E-*). */
class Calls
{
    public const RING_SECONDS = 30;

    public const MAX_MINUTES = 20;

    /** Appels sans suite (manqué, refusé, occupé) qu'un appelant peut adresser à la même personne par heure (revue F-14). */
    public const MAX_UNANSWERED_PER_HOUR = 3;

    /**
     * Sérialise les créations d'appel touchant ces utilisateurs (verrou consultatif de transaction, pris dans l'ordre
     * trié pour éviter les interblocages) : sans lui, deux requêtes simultanées créent deux sonneries (revue F-14).
     * À appeler dans une transaction.
     */
    public function lockUsers(string ...$userIds): void
    {
        $userIds = array_values(array_unique($userIds));
        sort($userIds, SORT_STRING);
        foreach ($userIds as $id) {
            DB::select('select pg_advisory_xact_lock(hashtextextended(?, 0))', ['call-user|'.$id]);
        }
    }

    /** Appels adressés par l'appelant à cette personne sur la dernière heure et restés sans suite. */
    public function unansweredRecently(string $callerId, string $calleeId): int
    {
        return DB::table('call_sessions')->where('caller_id', $callerId)->where('callee_id', $calleeId)
            ->whereIn('status', ['missed', 'declined', 'busy', 'failed'])->where('created_at', '>', now()->subHour())->count();
    }

    /**
     * Ferme la salle LiveKit d'un appel terminé (fin, refus, annulation, expiration) : tâche en file « realtime », la requête
     * et le planificateur n'attendent pas LiveKit. Sans effet si LiveKit est injoignable (journalisé par la tâche).
     */
    public function closeRoom(stdClass $call): void
    {
        if (empty($call->livekit_room)) {
            return;
        }
        try {
            CloseCallRoom::dispatch($call->livekit_room);
        } catch (Throwable $e) {
            // La file elle-même peut être indisponible : la fin d'appel n'est jamais bloquée pour autant.
            Log::warning('livekit: fermeture de salle non planifiée', ['room' => $call->livekit_room, 'error' => $e::class]);
        }
    }

    /** Appel en cours (sonnerie ou communication) impliquant l'un des deux utilisateurs. */
    public function activeFor(string ...$userIds): ?stdClass
    {
        return DB::table('call_sessions')->whereIn('status', ['ringing', 'accepted'])
            ->where(fn ($q) => $q->whereIn('caller_id', $userIds)->orWhereIn('callee_id', $userIds))->first();
    }

    /**
     * Termine les appels en cours (sonnerie ou communication) entre deux comptes et ferme leur salle LiveKit : blocage de l'un par
     * l'autre (revue pentest P-05). Le jeton de 10 minutes déjà émis ne suffit plus, la salle est détruite.
     *
     * @return int nombre d'appels terminés
     */
    public function endBetween(string $a, string $b): int
    {
        return $this->endAll(DB::table('call_sessions')->whereIn('status', ['ringing', 'accepted'])
            ->where(fn ($q) => $q->where(fn ($w) => $w->where('caller_id', $a)->where('callee_id', $b))
                ->orWhere(fn ($w) => $w->where('caller_id', $b)->where('callee_id', $a)))->get());
    }

    /** Termine tous les appels en cours d'un compte (suspension ou bannissement, revue pentest P-05). @return int */
    public function endAllFor(string $userId): int
    {
        return $this->endAll(DB::table('call_sessions')->whereIn('status', ['ringing', 'accepted'])
            ->where(fn ($q) => $q->where('caller_id', $userId)->orWhere('callee_id', $userId))->get());
    }

    /** @param  iterable<stdClass>  $calls */
    private function endAll(iterable $calls): int
    {
        $count = 0;
        foreach ($calls as $call) {
            // Le statut est revérifié dans la mise à jour : un appel terminé entre la lecture et ici n'est pas touché deux fois.
            $status = $call->status === 'accepted' ? 'ended' : 'failed';
            if (DB::table('call_sessions')->where('id', $call->id)->where('status', $call->status)->update(['status' => $status, 'ended_at' => now(), 'updated_at' => now()]) === 0) {
                continue;
            }
            $count++;
            if ($call->status === 'ringing') {
                CallEvent::dispatch('user.'.$call->callee_id, 'call.cancelled', ['call_id' => $call->id, 'reason' => 'unavailable']);
            }
            $this->notifyState($call, $status === 'ended' ? 'ended' : 'failed');
            $this->closeRoom($call);
        }

        return $count;
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
        $candidates = DB::table('call_sessions')->where('status', 'ringing')->where('created_at', '<=', now()->subSeconds(self::RING_SECONDS))->get();
        $missed = 0;
        foreach ($candidates as $call) {
            // Le statut est revérifié dans la mise à jour : un appel accepté entre la lecture et ici n'est pas touché.
            $done = DB::transaction(function () use ($call) {
                if (DB::table('call_sessions')->where('id', $call->id)->where('status', 'ringing')->update(['status' => 'missed', 'ended_at' => now(), 'updated_at' => now()]) === 0) {
                    return false;
                }
                $this->missedMessage($call);

                return true;
            });
            if (! $done) {
                continue;
            }
            $missed++;
            CallEvent::dispatch('user.'.$call->callee_id, 'call.cancelled', ['call_id' => $call->id, 'reason' => 'missed']);
            $this->notifyState($call, 'missed');
            $this->closeRoom($call);
        }

        $long = DB::table('call_sessions')->where('status', 'accepted')->where('started_at', '<=', now()->subMinutes(self::MAX_MINUTES))->get();
        $ended = 0;
        foreach ($long as $call) {
            if (DB::table('call_sessions')->where('id', $call->id)->where('status', 'accepted')->update(['status' => 'ended', 'ended_at' => now(), 'updated_at' => now()]) === 0) {
                continue;
            }
            $ended++;
            $this->notifyState($call, 'ended');
            // Les participants déjà connectés ne sont pas expulsés par l'expiration du jeton : on ferme la salle (revue F-14).
            $this->closeRoom($call);
        }

        return ['missed' => $missed, 'ended' => $ended];
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
