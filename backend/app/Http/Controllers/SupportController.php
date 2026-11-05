<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SupportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => DB::table('support_tickets')->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')->limit(50)->get(['id', 'subject', 'status', 'created_at'])]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['subject' => ['required', 'string', 'min:3', 'max:120'], 'body' => ['required', 'string', 'min:5', 'max:4000']]);
        $me = $request->user()->id;

        if (DB::table('support_tickets')->where('user_id', $me)->where('created_at', '>=', now()->subDay())->count() >= 5) {
            return response()->json(['error' => ['code' => 'quota_reached', 'message' => 'Trop de demandes aujourd\'hui.']], 429);
        }

        $id = (string) Str::uuid();
        DB::table('support_tickets')->insert([
            'id' => $id, 'user_id' => $me, 'subject' => $data['subject'], 'body' => $data['body'], 'status' => 'open', 'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['id' => $id, 'status' => 'open'], 201);
    }
}
