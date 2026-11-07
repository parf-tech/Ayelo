<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Services\ProfilePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class MatchController extends Controller
{
    public function index(Request $request, ProfilePresenter $presenter): JsonResponse
    {
        $me = $request->user()->id;

        $rows = DB::table('matches')
            ->where('status', 'active')
            ->where(fn ($q) => $q->where('user_a', $me)->orWhere('user_b', $me))
            ->orderByDesc('created_at')->limit(100)->get();

        $otherIds = $rows->map(fn ($m) => $m->user_a === $me ? $m->user_b : $m->user_a);
        // Un compte suspendu ou en cours de suppression disparaît de la liste (revue F-10).
        $profiles = Profile::with('user')->whereIn('user_id', $otherIds)->get()->filter(fn ($p) => $p->user->status === 'active' && $p->is_visible)->keyBy('user_id');
        $presented = $presenter->publicMany($profiles);
        $conversations = DB::table('conversations')->whereIn('match_id', $rows->pluck('id'))->pluck('id', 'match_id');

        /**
         * @body array{data: list<array{id: string, created_at: string, conversation_id: string|null, profile: array{user_id: string, display_name: string, age: int, gender: 'man'|'woman'|'other', origin_country: string, residence_country: string, city: string|null, bio: string|null, intent: 'marriage'|'long_lasting_love'|'flirt'|'friendship'|'lets_find_out', verified: bool, media: list<array{id: string, kind: 'profile_photo'|'profile_video', position: int, status: 'pending_upload'|'processing'|'approved'|null, url: string|null}>, last_seen_at?: string|null}|null}>}
         */
        return response()->json(['data' => $rows->map(function ($m) use ($me, $presented, $conversations) {
            $otherId = $m->user_a === $me ? $m->user_b : $m->user_a;

            return [
                'id' => $m->id,
                'created_at' => $m->created_at,
                'conversation_id' => $conversations[$m->id] ?? null,
                'profile' => $presented[$otherId] ?? null,
            ];
        })->values()]);
    }

    /** Rompre un match : plus de nouveau message ; la conversation est archivée. */
    public function destroy(Request $request, string $id): Response
    {
        $me = $request->user()->id;
        $match = DB::table('matches')->where('id', $id)->where(fn ($q) => $q->where('user_a', $me)->orWhere('user_b', $me))->first();
        abort_if($match === null, 404);

        DB::transaction(function () use ($match) {
            DB::table('matches')->where('id', $match->id)->update(['status' => 'unmatched', 'updated_at' => now()]);
            DB::table('conversations')->where('match_id', $match->id)->update(['status' => 'archived', 'updated_at' => now()]);
        });

        return response()->noContent();
    }
}
