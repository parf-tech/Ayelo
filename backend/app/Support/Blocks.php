<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

final class Blocks
{
    /** Vrai si l'un des deux a bloqué l'autre (dans les deux sens). */
    public static function between(string $a, string $b): bool
    {
        return DB::table('blocks')
            ->where(fn ($q) => $q->where('blocker_id', $a)->where('blocked_id', $b))
            ->orWhere(fn ($q) => $q->where('blocker_id', $b)->where('blocked_id', $a))
            ->exists();
    }
}
