<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AccountMail;
use App\Services\AgeGate;
use App\Services\DeviceSessions;
use App\Services\Registrar;
use App\Support\DeviceId;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class RegisterController extends Controller
{
    public function __invoke(Request $request, AgeGate $gate, Registrar $registrar, DeviceSessions $sessions, AccountMail $mail): JsonResponse
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

        $user = $registrar->create([
            'email' => $data['email'],
            'password' => $data['password'],
            'birthdate' => $birthdate,
            'locale' => $data['locale'] ?? 'fr',
        ], $data['consents'], $request);

        $token = $sessions->start($user, $data['platform'], $device, $data['app_version'] ?? null);
        $mail->sendVerification($user);

        return response()->json([
            'token' => $token,
            'user' => ['id' => $user->id, 'email' => $user->email, 'locale' => $user->locale],
        ], 201);
    }
}
