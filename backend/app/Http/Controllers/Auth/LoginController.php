<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DeviceSessions;
use App\Support\DeviceId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class LoginController extends Controller
{
    public function __invoke(Request $request, DeviceSessions $sessions): JsonResponse
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
        if ($user !== null && $user->password !== null) {
            $valid = Hash::check($data['password'], $user->password);
        } else {
            Hash::make($data['password']);
            $valid = false;
        }

        if (! $valid) {
            return response()->json(['error' => ['code' => 'invalid_credentials', 'message' => 'Identifiants invalides.']], 401);
        }

        if ($user->status !== 'active') {
            return response()->json(['error' => ['code' => 'account_restricted', 'message' => 'Compte indisponible.']], 403);
        }

        $token = $sessions->start($user, $data['platform'], $device, $data['app_version'] ?? null);
        $user->forceFill(['last_seen_at' => now()])->save();

        return response()->json([
            'token' => $token,
            'user' => ['id' => $user->id, 'email' => $user->email, 'locale' => $user->locale],
        ]);
    }
}
