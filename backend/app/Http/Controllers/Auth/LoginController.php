<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DeviceSessions;
use App\Support\DeviceId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
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

        $email = strtolower(trim($data['email']));
        // Échecs comptés par (e-mail, IP) : 5 par 15 min ; et par e-mail seul : 30 par 15 min (bourrage d'identifiants distribué).
        $keyPair = 'login-fail:'.$email.'|'.$request->ip();
        $keyEmail = 'login-fail-email:'.$email;
        if (RateLimiter::tooManyAttempts($keyPair, 5) || RateLimiter::tooManyAttempts($keyEmail, 30)) {
            return response()->json(['error' => ['code' => 'rate_limited', 'message' => 'Trop de tentatives. Réessayez plus tard.']], 429)
                ->header('Retry-After', (string) max(RateLimiter::availableIn($keyPair), RateLimiter::availableIn($keyEmail)));
        }

        $user = User::where('email', $email)->first();

        // Même réponse pour « e-mail inconnu » et « mot de passe faux » ; on hache dans les deux cas
        // pour ne pas révéler l'existence du compte par le temps de réponse.
        if ($user !== null && $user->password !== null) {
            $valid = Hash::check($data['password'], $user->password);
        } else {
            Hash::make($data['password']);
            $valid = false;
        }

        if (! $valid) {
            RateLimiter::hit($keyPair, 900);
            RateLimiter::hit($keyEmail, 900);

            return response()->json(['error' => ['code' => 'invalid_credentials', 'message' => 'Identifiants invalides.']], 401);
        }

        // Un compte suspendu ou banni peut se connecter : le jeton est restreint par EnsureAccountActive (sanctions, contestation,
        // export, suppression). Un compte en cours de suppression ou supprimé ne le peut pas.
        if (! in_array($user->status, ['active', 'suspended', 'banned'], true)) {
            return response()->json(['error' => ['code' => 'account_restricted', 'message' => 'Compte indisponible.']], 403);
        }

        RateLimiter::clear($keyPair);

        $token = $sessions->start($user, $data['platform'], $device, $data['app_version'] ?? null);
        $user->forceFill(['last_seen_at' => now()])->save();

        return response()->json([
            'token' => $token,
            'user' => ['id' => $user->id, 'email' => $user->email, 'locale' => $user->locale],
        ]);
    }
}
