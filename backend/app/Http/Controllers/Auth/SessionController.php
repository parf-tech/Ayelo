<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\DeviceSessions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\DB;

class SessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $currentTokenId = $request->user()->currentAccessToken()->getKey();

        $rows = DB::table('devices')
            ->where('user_id', $request->user()->id)
            ->whereNotNull('token_id')
            ->orderByDesc('last_active_at')
            ->get(['id', 'platform', 'app_version', 'last_active_at', 'created_at', 'token_id']);

        return response()->json(['data' => $rows->map(fn ($d) => [
            'id' => $d->id,
            'platform' => $d->platform,
            'app_version' => $d->app_version,
            'last_active_at' => $d->last_active_at,
            'created_at' => $d->created_at,
            'current' => (int) $d->token_id === (int) $currentTokenId,
        ])->values()]);
    }

    public function destroy(Request $request, string $device): Response
    {
        $row = DB::table('devices')->where('id', $device)->where('user_id', $request->user()->id)->first();
        abort_if($row === null, 404);

        $request->user()->tokens()->whereKey($row->token_id)->delete();
        DB::table('devices')->where('id', $row->id)->delete();

        return response()->noContent();
    }

    public function destroyAll(Request $request, DeviceSessions $sessions): Response
    {
        $sessions->revokeAll($request->user());

        return response()->noContent();
    }
}
