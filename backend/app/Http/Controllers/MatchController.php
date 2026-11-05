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
        $profiles = Profile::with('user')->whereIn('user_id', $otherIds)->get()->keyBy('user_id');
        $conversations = DB::table('conversations')->whereIn('match_id', $rows->pluck('id'))->pluck('id', 'match_id');

        return response()->json(['data' => $rows->map(function ($m) use ($me, $profiles, $conversations, $presenter) {
            $otherId = $m->user_a === $me ? $m->user_b : $m->user_a;

            return [
                'id' => $m->id,
                'created_at' => $m->created_at,
                'conversation_id' => $conversations[$m->id] ?? null,
                'profile' => isset($profiles[$otherId]) ? $presenter->public($profiles[$otherId]) : null,
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
