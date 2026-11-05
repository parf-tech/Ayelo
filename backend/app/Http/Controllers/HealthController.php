<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::selectOne('select 1 as ok');
            $db = 'ok';
        } catch (Throwable) {
            $db = 'error';
        }

        return response()->json(
            ['status' => $db === 'ok' ? 'ok' : 'degraded', 'db' => $db],
            $db === 'ok' ? 200 : 503
        );
    }
}
