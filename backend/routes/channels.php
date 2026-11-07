<?php

use App\Support\Blocks;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/*
 | Canaux privés (docs/10). Pas de canal de présence global : il permettrait d'énumérer les membres.
 */

// Canal personnel : matchs, appels entrants, facturation, sanctions.
Broadcast::channel('user.{id}', fn ($user, string $id) => $user->id === $id);

// Canal d'une conversation : seulement les deux participants, jamais si l'un a bloqué l'autre, ni si l'un des deux
// comptes n'est plus actif (revue F-27). Un identifiant qui n'est pas un uuid est refusé avant toute requête
// (erreur PostgreSQL 22P02 sinon, revue F-24). L'autorisation n'est contrôlée qu'à l'abonnement : les diffusions
// (signaux de lecture, de frappe) sont donc aussi conditionnées côté API par `Conversations::canWrite`.
Broadcast::channel('conversation.{id}', function ($user, string $id) {
    if (! Str::isUuid($id)) {
        return false;
    }

    $conversation = DB::table('conversations')->where('id', $id)
        ->where(fn ($q) => $q->where('user_a', $user->id)->orWhere('user_b', $user->id))->first();

    if ($conversation === null || $conversation->status === 'blocked') {
        return false;
    }

    $other = $conversation->user_a === $user->id ? $conversation->user_b : $conversation->user_a;

    if (DB::table('users')->whereIn('id', [$user->id, $other])->where('status', 'active')->count() !== 2) {
        return false;
    }

    return ! Blocks::between($user->id, $other);
});
