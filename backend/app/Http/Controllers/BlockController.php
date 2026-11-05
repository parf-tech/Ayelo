<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class BlockController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = DB::table('blocks')
            ->join('profiles', 'profiles.user_id', '=', 'blocks.blocked_id')
            ->where('blocks.blocker_id', $request->user()->id)
            ->orderByDesc('blocks.created_at')
            ->get(['blocks.blocked_id as user_id', 'profiles.display_name', 'blocks.created_at']);

        return response()->json(['data' => $rows]);
    }

    /** Idempotent : bloquer deux fois renvoie 204 sans erreur. */
    public function store(Request $request): Response
    {
        $data = $request->validate(['blocked_id' => ['required', 'uuid', 'exists:users,id']]);
        $me = $request->user()->id;
        abort_if($data['blocked_id'] === $me, 422, 'Action impossible.');

        DB::transaction(function () use ($me, $data) {
            DB::table('blocks')->insertOrIgnore([
                'id' => (string) Str::uuid(), 'blocker_id' => $me, 'blocked_id' => $data['blocked_id'],
                'created_at' => now(), 'updated_at' => now(),
            ]);

            $pair = [$me, $data['blocked_id']];
            sort($pair, SORT_STRING);
            DB::table('matches')->where('user_a', $pair[0])->where('user_b', $pair[1])->update(['status' => 'blocked', 'updated_at' => now()]);
            DB::table('conversations')->where('user_a', $pair[0])->where('user_b', $pair[1])->update(['status' => 'blocked', 'updated_at' => now()]);
        });

        return response()->noContent();
    }

    public function destroy(Request $request, string $userId): Response
    {
        $me = $request->user()->id;
        DB::table('blocks')->where('blocker_id', $me)->where('blocked_id', $userId)->delete();

        // Le match et la conversation restent bloqués s'ils l'ont été : on ne rouvre pas automatiquement (sécurité).
        return response()->noContent();
    }
}
