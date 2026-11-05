<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AgeGate;
use App\Support\DeviceId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class RegisterController extends Controller
{
    /** Versions des textes acceptés (à synchroniser avec les pages légales). */
    private const CONSENT_VERSION = '2026-11-05';

    public function __invoke(Request $request, AgeGate $gate): JsonResponse
    {
        $device = DeviceId::from($request);

        if ($gate->isRefused($device)) {
            return response()->json(['error' => ['code' => 'age_not_eligible', 'message' => 'Inscription impossible.']], 403);
        }

        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254', Rule::unique('users', 'email')],
            'password' => ['required', 'string', Password::min(10)->letters()->numbers(), 'different:email'],
            'age_token' => ['required', 'string'],
            'platform' => ['required', Rule::in(['ios', 'android'])],
            'app_version' => ['nullable', 'string', 'max:32'],
            'locale' => ['nullable', Rule::in(['fr', 'en'])],
            'consents' => ['required', 'array'],
            'consents.terms' => ['required', 'accepted'],
            'consents.privacy' => ['required', 'accepted'],
            'consents.sensitive_data' => ['required', 'accepted'],
            'consents.marketing' => ['nullable', 'boolean'],
        ]);

        $birthdate = $gate->readToken($data['age_token'], $device);
        if ($birthdate === null) {
            throw ValidationException::withMessages(['age_token' => ['Contrôle d\'âge manquant, expiré ou invalide.']]);
        }

        $result = DB::transaction(function () use ($data, $birthdate, $request, $device) {
            $user = User::create([
                'email' => strtolower($data['email']),
                'password' => $data['password'],
                'birthdate' => $birthdate,
                'locale' => $data['locale'] ?? 'fr',
            ]);

            $rows = [];
            foreach (['terms', 'privacy', 'sensitive_data'] as $kind) {
                $rows[] = $this->consentRow($user->id, $kind, true, $request);
            }
            $rows[] = $this->consentRow($user->id, 'marketing', (bool) ($data['consents']['marketing'] ?? false), $request);
            DB::table('user_consents')->insert($rows);

            DB::table('notification_prefs')->insert([
                'user_id' => $user->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $token = $user->createToken('mobile:'.$data['platform']);

            DB::table('devices')->insert([
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'user_id' => $user->id,
                'token_id' => $token->accessToken->getKey(),
                'platform' => $data['platform'],
                'device_fingerprint_hash' => DeviceId::hash($device),
                'app_version' => $data['app_version'] ?? null,
                'last_active_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [$user, $token->plainTextToken];
        });

        [$user, $plain] = $result;

        return response()->json([
            'token' => $plain,
            'user' => ['id' => $user->id, 'email' => $user->email, 'locale' => $user->locale],
        ], 201);
    }

    /** @return array<string, mixed> */
    private function consentRow(string $userId, string $kind, bool $granted, Request $request): array
    {
        return [
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'user_id' => $userId,
            'kind' => $kind,
            'version' => self::CONSENT_VERSION,
            'granted' => $granted,
            'ip' => $request->ip(),
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }
}
