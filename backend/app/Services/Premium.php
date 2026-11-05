<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class Premium
{
    public static function active(string $userId): bool
    {
        return DB::table('subscriptions')
            ->where('user_id', $userId)
            ->whereIn('status', ['active', 'grace'])
            ->where('period_end', '>', now())
            ->exists();
    }
}
