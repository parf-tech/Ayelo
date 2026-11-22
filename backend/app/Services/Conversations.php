<?php

namespace App\Services;

use App\Support\Blocks;
use Illuminate\Support\Facades\DB;
use stdClass;

class Conversations
{
    /** Conversation dont l'utilisateur est participant, sinon null. */
    public function forParticipant(string $conversationId, string $userId): ?stdClass
    {
        return DB::table('conversations')->where('id', $conversationId)
            ->where(fn ($q) => $q->where('user_a', $userId)->orWhere('user_b', $userId))->first();
    }

    public function other(stdClass $conversation, string $userId): string
    {
        return $conversation->user_a === $userId ? $conversation->user_b : $conversation->user_a;
    }

    /** On peut écrire seulement dans une conversation active, sans blocage, entre comptes actifs. */
    public function canWrite(stdClass $conversation, string $userId): bool
    {
        if ($conversation->status !== 'active') {
            return false;
        }

        $other = $this->other($conversation, $userId);
        if (Blocks::between($userId, $other)) {
            return false;
        }

        return DB::table('users')->whereIn('id', [$userId, $other])->where('status', 'active')->count() === 2;
    }

    public function creditBalance(string $userId, string $type = 'conversation'): int
    {
        // Table de soldes tenue à jour par un déclencheur sur `credit_ledger` (migration create_credit_balances) ; 0 sans ligne.
        return (int) DB::table('credit_balances')->where('user_id', $userId)->where('credit_type', $type)->value('balance');
    }
}
