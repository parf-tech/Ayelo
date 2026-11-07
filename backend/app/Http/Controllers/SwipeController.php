<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Services\Premium;
use App\Services\SwipeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

        if ($data['action'] === 'super_like') {
            if (! $premium) {
                return response()->json(['error' => ['code' => 'premium_required', 'message' => 'Réservé aux abonnés Premium.']], 402);
            }
            if ($this->count($user->id, $today, 'super_likes') >= config('discovery.daily_super_likes_premium')) {
                return response()->json(['error' => ['code' => 'quota_reached', 'message' => 'Quota de super-likes atteint.']], 429);
            }
        }

        if ($data['action'] === 'like' && ! $premium && $this->count($user->id, $today, 'likes') >= config('discovery.daily_likes_free')) {
            return response()->json(['error' => ['code' => 'quota_reached', 'message' => 'Quota de likes atteint pour aujourd\'hui.']], 429);
        }

        $result = $swipes->swipe($user->id, $data['target_id'], $data['action']);

        if ($result['status'] === 'recorded') {
            if ($data['action'] === 'like') {
                $this->increment($user->id, $today, 'likes');
            } elseif ($data['action'] === 'super_like') {
                $this->increment($user->id, $today, 'super_likes');
            }
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
        if ($last === null || $last->action !== 'dislike' || \Illuminate\Support\Carbon::parse($last->created_at)->lt(now()->subHour())) {
            return response()->json(['error' => ['code' => 'nothing_to_undo', 'message' => 'Rien à annuler.']], 409);
        }

        DB::table('swipes')->where('id', $last->id)->delete();

        return response()->json(['target_id' => $last->target_id]);
    }

    private function count(string $userId, string $day, string $kind): int
    {
        return (int) DB::table('daily_counters')->where(['user_id' => $userId, 'day' => $day, 'kind' => $kind])->value('count');
    }

    private function increment(string $userId, string $day, string $kind): void
    {
        DB::statement(
            'insert into daily_counters (user_id, day, kind, count) values (?, ?, ?, 1) on conflict (user_id, day, kind) do update set count = daily_counters.count + 1',
            [$userId, $day, $kind]
        );
    }
}
