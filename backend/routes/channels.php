<?php

use App\Support\Blocks;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;

/*
 | Canaux privés (docs/10). Pas de canal de présence global : il permettrait d'énumérer les membres.
 */

// Canal personnel : matchs, appels entrants, facturation, sanctions.
Broadcast::channel('user.{id}', fn ($user, string $id) => $user->id === $id);

// Canal d'une conversation : seulement les deux participants, et jamais si l'un a bloqué l'autre.
Broadcast::channel('conversation.{id}', function ($user, string $id) {
    $conversation = DB::table('conversations')->where('id', $id)
        ->where(fn ($q) => $q->where('user_a', $user->id)->orWhere('user_b', $user->id))->first();

    if ($conversation === null || $conversation->status === 'blocked') {
        return false;
    }

    $other = $conversation->user_a === $user->id ? $conversation->user_b : $conversation->user_a;

    return ! Blocks::between($user->id, $other);
});
