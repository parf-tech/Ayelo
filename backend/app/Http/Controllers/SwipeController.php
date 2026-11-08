<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Services\Premium;
use App\Services\SwipeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class SwipeController extends Controller
{
    public function store(Request $request, SwipeService $swipes): JsonResponse
    {
        $user = $request->user();
        abort_unless(Profile::where('user_id', $user->id)->exists(), 403, 'Profil à compléter.');

        $data = $request->validate([
            'target_id' => ['required', 'uuid'],
            'action' => ['required', Rule::in(['like', 'dislike', 'super_like'])],
        ]);
        abort_if($data['target_id'] === $user->id, 422, 'Action impossible.');

        // Même règle de visibilité que la fiche profil : masqué, bloqué, suspendu ou inconnu => 404.
        $target = Profile::where('user_id', $data['target_id'])->first();
        abort_if($target === null || Gate::forUser($user)->denies('view', $target), 404);

        $premium = Premium::active($user->id);
        $today = now()->toDateString();

        if ($data['action'] === 'super_like' && ! $premium) {
            return response()->json(['error' => ['code' => 'premium_required', 'message' => 'Réservé aux abonnés Premium.']], 402);
        }

        // Quota réservé de façon atomique AVANT d'enregistrer le swipe (revue F-25) : un seul UPDATE conditionnel, donc
        // deux requêtes parallèles ne peuvent plus dépasser le plafond comme avec « lire puis écrire ». Si le swipe n'est
        // finalement pas enregistré (rejeu) ou échoue, la réservation est rendue.
        $kind = match ($data['action']) {
            'super_like' => 'super_likes',
            'like' => $premium ? null : 'likes',
            default => null,
        };
        $reserved = false;
        if ($kind !== null) {
            $limit = (int) ($kind === 'super_likes' ? config('discovery.daily_super_likes_premium') : config('discovery.daily_likes_free'));
            if (! $this->reserve($user->id, $today, $kind, $limit)) {
                return response()->json(['error' => ['code' => 'quota_reached', 'message' => $kind === 'super_likes' ? 'Quota de super-likes atteint.' : 'Quota de likes atteint pour aujourd\'hui.']], 429);
            }
            $reserved = true;
        }

        try {
            $result = $swipes->swipe($user->id, $data['target_id'], $data['action']);
        } catch (\Throwable $e) {
            if ($reserved) {
                $this->release($user->id, $today, $kind);
            }
            throw $e;
        }

        if ($reserved && $result['status'] !== 'recorded') {
            $this->release($user->id, $today, $kind);
        }

        // Premium : les likes illimités restent comptés (statistiques), sans plafond.
        if ($result['status'] === 'recorded' && $data['action'] === 'like' && $premium) {
            $this->increment($user->id, $today, 'likes');
        }

        if ($result['status'] === 'recorded') {
            /**
             * Swipe enregistré ; `matched` vaut true quand l'autre personne avait déjà aimé.
             *
             * @status 201
             *
             * @body array{status: 'recorded', matched: bool, match_id?: string, conversation_id?: string}
             */
            return response()->json($result, 201);
        }

        /**
         * Swipe déjà enregistré (rejeu) ; `match_id` et `conversation_id` sont présents si un match actif existe.
         *
         * @body array{status: 'already_swiped', matched: false, match_id?: string, conversation_id?: string}
         */
        return response()->json($result, 200);
    }

    /** Annule le dernier « dislike » (Premium, FR-C-6). */
    public function undo(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        if (! Premium::active($userId)) {
            return response()->json(['error' => ['code' => 'premium_required', 'message' => 'Réservé aux abonnés Premium.']], 402);
        }

        $last = DB::table('swipes')->where('swiper_id', $userId)->orderByDesc('created_at')->first();
        if ($last === null || $last->action !== 'dislike' || Carbon::parse($last->created_at)->lt(now()->subHour())) {
            return response()->json(['error' => ['code' => 'nothing_to_undo', 'message' => 'Rien à annuler.']], 409);
        }

        DB::table('swipes')->where('id', $last->id)->delete();

        return response()->json(['target_id' => $last->target_id]);
    }

    /** Réserve une unité de quota si le plafond n'est pas atteint (INSERT … ON CONFLICT … WHERE count < limite, atomique). */
    private function reserve(string $userId, string $day, string $kind, int $limit): bool
    {
        if ($limit < 1) {
            return false;
        }

        return DB::select(
            'insert into daily_counters (user_id, day, kind, count) values (?, ?, ?, 1) on conflict (user_id, day, kind) do update set count = daily_counters.count + 1 where daily_counters.count < ? returning count',
            [$userId, $day, $kind, $limit]
        ) !== [];
    }

    private function release(string $userId, string $day, string $kind): void
    {
        DB::table('daily_counters')->where(['user_id' => $userId, 'day' => $day, 'kind' => $kind])->where('count', '>', 0)->decrement('count');
    }

    private function increment(string $userId, string $day, string $kind): void
    {
        DB::statement(
            'insert into daily_counters (user_id, day, kind, count) values (?, ?, ?, 1) on conflict (user_id, day, kind) do update set count = daily_counters.count + 1',
            [$userId, $day, $kind]
        );
    }
}
