<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class Premium
{
    public static function active(string $userId): bool
    {
        return DB::table('subscriptions')
            ->where('user_id', $userId)
            // « cancelled » = renouvellement annulé : l'accès dure jusqu'à la fin de la période payée.
            ->whereIn('status', ['active', 'grace', 'cancelled'])
            ->where('period_end', '>', now())
            ->exists();
    }
}
