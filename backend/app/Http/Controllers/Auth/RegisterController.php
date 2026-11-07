<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AccountMail;
use App\Services\AgeGate;
use App\Services\DeviceSessions;
use App\Services\Registrar;
use App\Support\DeviceId;
use Illuminate\Database\UniqueConstraintViolationException;
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

        if ($gate->isRefused($device, $request->ip())) {
            // Refus d'âge en vigueur pour l'appareil ou l'IP. L'e-mail SAISI n'est volontairement PAS mémorisé (revue pentest P-03) :
            // une adresse non prouvée permettrait de bloquer l'inscription d'un tiers. Seules les identités prouvées (fournisseur OAuth)
            // étendent le refus, voir OAuthController.
            return response()->json(['error' => ['code' => 'age_not_eligible', 'message' => 'Inscription impossible.']], 403);
        }

        // Le message « adresse déjà utilisée » est conservé (ergonomie) : risque d'énumération accepté, borné par les limites
        // `register` (5 / h par appareil, 60 / h par IP) ; voir docs/reviews/code-security-2-suivi.md (lot 6).
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254'],
            'password' => ['required', 'string', Password::default(), 'different:email'],
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

        // Un e-mail associé à un compte sanctionné puis supprimé ne peut pas se réinscrire (revue F-16).
        if (\App\Services\BannedIdentifiers::has('email', $data['email']) || $gate->isEmailRefused($data['email'])) {
            return response()->json(['error' => ['code' => 'age_not_eligible', 'message' => 'Inscription impossible.']], 403);
        }

        $birthdate = $gate->readToken($data['age_token'], $device);
        if ($birthdate === null) {
            throw ValidationException::withMessages(['age_token' => ['Contrôle d\'âge manquant, expiré ou invalide.']]);
        }

        // Jeton d'âge à usage unique (revue F-29) : consommé ici, rendu si la création échoue.
        if (! $gate->claimToken($data['age_token'])) {
            throw ValidationException::withMessages(['age_token' => ['Contrôle d\'âge manquant, expiré ou invalide.']]);
        }

        try {
            // Aucune « libération » d'un compte non vérifié ici (revue pentest P-01) : un formulaire ne prouve pas la possession de
            // l'adresse, et une requête non authentifiée ne doit jamais détruire le compte d'autrui. Le vrai propriétaire d'une adresse
            // squattée reprend la main par « mot de passe oublié » (le code part à l'adresse, preuve de possession) ou par OAuth.
            if (User::where('email', strtolower($data['email']))->exists()) {
                throw $this->emailTaken();
            }

            try {
                $user = $registrar->create([
                    'email' => $data['email'],
                    'password' => $data['password'],
                    'birthdate' => $birthdate,
                    'locale' => $data['locale'] ?? 'fr',
                ], $data['consents'], $request);
            } catch (UniqueConstraintViolationException) {
                // Course : deux inscriptions simultanées avec la même adresse (revue F-25) -> 422 propre, pas 500.
                throw $this->emailTaken();
            }
        } catch (\Throwable $e) {
            $gate->releaseToken($data['age_token']);

            throw $e;
        }

        $token = $sessions->start($user, $data['platform'], $device, $data['app_version'] ?? null);
        $mail->sendVerification($user);

        return response()->json([
            'token' => $token,
            'user' => ['id' => $user->id, 'email' => $user->email, 'locale' => $user->locale],
        ], 201);
    }

    private function emailTaken(): ValidationException
    {
        return ValidationException::withMessages(['email' => [trans('validation.unique', ['attribute' => 'email'])]]);
    }
}
