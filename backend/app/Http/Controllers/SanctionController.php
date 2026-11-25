<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SanctionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = DB::table('sanctions')->leftJoin('appeals', 'appeals.sanction_id', '=', 'sanctions.id')
            ->where('sanctions.user_id', $request->user()->id)
            ->orderByDesc('sanctions.created_at')
            ->get(['sanctions.id', 'sanctions.kind', 'sanctions.reason', 'sanctions.starts_at', 'sanctions.ends_at', 'appeals.status as appeal_status']);

        return response()->json(['data' => $rows]);
    }

    /** Une seule contestation par sanction (docs/11). */
    public function appeal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sanction_id' => ['required', 'uuid'],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
        ]);
        $me = $request->user()->id;

        $sanction = DB::table('sanctions')->where('id', $data['sanction_id'])->where('user_id', $me)->first();
        abort_if($sanction === null, 404);

        // L'unicité (appeals.sanction_id) tranche, y compris entre deux requêtes simultanées : aucune ligne insérée = déjà
        // contestée (409), jamais une violation de contrainte (500).
        $id = (string) Str::uuid();
        $inserted = DB::table('appeals')->insertOrIgnore([
            'id' => $id, 'sanction_id' => $sanction->id, 'user_id' => $me, 'message' => $data['message'],
            'status' => 'open', 'created_at' => now(), 'updated_at' => now(),
        ]);
        if ($inserted === 0) {
            return response()->json(['error' => ['code' => 'already_appealed', 'message' => 'Cette sanction a déjà été contestée.']], 409);
        }

        return response()->json(['id' => $id, 'status' => 'open'], 201);
    }
}
