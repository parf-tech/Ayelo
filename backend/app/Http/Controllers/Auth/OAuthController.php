<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AgeGate;
use App\Services\DeviceSessions;
use App\Services\OAuth\InvalidOAuthToken;
use App\Services\OAuth\OAuthVerifier;
use App\Services\Registrar;
use App\Support\DeviceId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OAuthController extends Controller
{
    public function __invoke(
        Request $request,
        string $provider,
        OAuthVerifier $verifier,
        AgeGate $gate,
        Registrar $registrar,
        DeviceSessions $sessions,
    ): JsonResponse {
        $device = DeviceId::from($request);

        $data = $request->validate([
            'id_token' => ['required', 'string', 'max:5000'],
            'platform' => ['required', Rule::in(['ios', 'android'])],
            'app_version' => ['nullable', 'string', 'max:32'],
            'age_token' => ['nullable', 'string'],
            'locale' => ['nullable', Rule::in(['fr', 'en'])],
            'consents' => ['nullable', 'array'],
        ]);

        try {
            $identity = $verifier->verify($provider, $data['id_token']);
        } catch (InvalidOAuthToken) {
            return response()->json(['error' => ['code' => 'invalid_oauth_token', 'message' => 'Connexion impossible.']], 401);
        }

        $linked = DB::table('auth_identities')->where('provider', $provider)->where('provider_user_id', $identity->subject)->first();

        if ($linked !== null) {
            $user = User::findOrFail($linked->user_id);
            if ($user->status !== 'active') {
                return response()->json(['error' => ['code' => 'account_restricted', 'message' => 'Compte indisponible.']], 403);
            }
        } else {
            // Nouveau compte : contrôle d'âge et consentements obligatoires (FR-I-12, FR-I-14).
            if ($gate->isRefused($device, $request->ip())) {
                return response()->json(['error' => ['code' => 'age_not_eligible', 'message' => 'Inscription impossible.']], 403);
            }

            if ($identity->email === null || ! $identity->emailVerified) {
                return response()->json(['error' => ['code' => 'email_not_verified', 'message' => 'Adresse e-mail non vérifiée par le fournisseur.']], 422);
            }

            if (\App\Services\BannedIdentifiers::has('email', $identity->email)) {
                return response()->json(['error' => ['code' => 'age_not_eligible', 'message' => 'Inscription impossible.']], 403);
            }

            // Pas de rattachement automatique à un compte existant (risque de prise de contrôle).
            if (User::where('email', $identity->email)->exists()) {
                return response()->json(['error' => ['code' => 'account_exists', 'message' => 'Un compte existe déjà avec cette adresse. Connectez-vous avec votre e-mail.']], 409);
            }

            $birthdate = $gate->readToken($data['age_token'] ?? null, $device);
            $consents = $data['consents'] ?? [];
            $complete = $birthdate !== null
                && ! empty($consents['terms']) && ! empty($consents['privacy']) && ! empty($consents['sensitive_data']);

            if (! $complete) {
                // L'application doit passer par les consentements et le contrôle d'âge, puis réessayer.
                return response()->json(['error' => ['code' => 'registration_required', 'message' => 'Inscription à finaliser.']], 409);
            }

            $user = $registrar->create([
                'email' => $identity->email,
                'password' => null,
                'birthdate' => $birthdate,
                'locale' => $data['locale'] ?? 'fr',
                'email_verified' => true,
            ], $consents, $request);

            DB::table('auth_identities')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $user->id,
                'provider' => $provider,
                'provider_user_id' => $identity->subject,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $token = $sessions->start($user, $data['platform'], $device, $data['app_version'] ?? null);
        $user->forceFill(['last_seen_at' => now()])->save();

        return response()->json([
            'token' => $token,
            'user' => ['id' => $user->id, 'email' => $user->email, 'locale' => $user->locale],
        ], $linked !== null ? 200 : 201);
    }
}
