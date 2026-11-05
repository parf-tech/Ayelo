<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\DeviceId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LoginController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $device = DeviceId::from($request);

        $data = $request->validate([
            'email' => ['required', 'email', 'max:254'],
            'password' => ['required', 'string', 'max:200'],
            'platform' => ['required', Rule::in(['ios', 'android'])],
            'app_version' => ['nullable', 'string', 'max:32'],
        ]);

        $user = User::where('email', strtolower($data['email']))->first();

        // Même réponse pour « e-mail inconnu » et « mot de passe faux » ; on hache dans les deux cas
        // pour ne pas révéler l'existence du compte par le temps de réponse.
        $valid = $user !== null && $user->password !== null
            ? Hash::check($data['password'], $user->password)
            : tap(false, fn () => Hash::make($data['password']));

        if (! $valid) {
            return response()->json(['error' => ['code' => 'invalid_credentials', 'message' => 'Identifiants invalides.']], 401);
        }

        if ($user->status !== 'active') {
            return response()->json(['error' => ['code' => 'account_restricted', 'message' => 'Compte indisponible.']], 403);
        }

        $token = $user->createToken('mobile:'.$data['platform']);

        DB::table('devices')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'token_id' => $token->accessToken->getKey(),
            'platform' => $data['platform'],
            'device_fingerprint_hash' => DeviceId::hash($device),
            'app_version' => $data['app_version'] ?? null,
            'last_active_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user->forceFill(['last_seen_at' => now()])->save();

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => ['id' => $user->id, 'email' => $user->email, 'locale' => $user->locale],
        ]);
    }
}
