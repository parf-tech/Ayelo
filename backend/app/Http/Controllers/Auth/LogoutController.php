<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class LogoutController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $token = $request->user()->currentAccessToken();

        DB::table('devices')->where('token_id', $token->getKey())->update(['push_token' => null, 'voip_push_token' => null, 'updated_at' => now()]);
        $token->delete();

        return response()->noContent();
    }
}
