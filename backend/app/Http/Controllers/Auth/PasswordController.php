<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AccountMail;
use App\Services\DeviceSessions;
use App\Services\OneTimeCodes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class PasswordController extends Controller
{
    /**
     * Réponse identique que l'e-mail existe ou non (pas d'énumération de comptes) : même code, et l'envoi (création du jeton
     * puis e-mail) part après la réponse, donc le temps de réponse ne dépend pas de l'existence du compte (revue F-11).
     */
    public function forgot(Request $request, AccountMail $mail): Response
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:254']]);

        // Un compte sanctionné y a droit : sans mot de passe, il ne pourrait ni contester ni effacer son compte (revue N-02).
        $user = User::where('email', strtolower($data['email']))->whereIn('status', User::KEEPS_ACCESS)->first();
        if ($user !== null) {
            $mail->sendPasswordResetAfterResponse($user);
        }

        return response()->noContent();
    }

    public function reset(Request $request, OneTimeCodes $codes, DeviceSessions $sessions): Response
    {
        // Règle par défaut du projet (AppServiceProvider : 10 caractères, lettres et chiffres, + liste de mots de passe compromis en production).
        $data = $request->validate([
            'token' => ['required', 'string', 'max:200'],
            'password' => ['required', 'string', Password::default()],
        ]);

        // Mot de passe identique à l'e-mail : refusé sans consommer le jeton (revue F-18).
        $codeId = explode('.', $data['token'], 2)[0];
        if (Str::isUuid($codeId)) {
            $email = DB::table('verification_codes')->join('users', 'users.id', '=', 'verification_codes.user_id')
                ->where('verification_codes.id', $codeId)->value('users.email');
            if (is_string($email) && strcasecmp($email, $data['password']) === 0) {
                throw ValidationException::withMessages(['password' => ['Le mot de passe ne doit pas être votre adresse e-mail.']]);
            }
        }

        $userId = $codes->consume('password_reset', $data['token']);
        if ($userId === null) {
            return response()->json(['error' => ['code' => 'invalid_token', 'message' => 'Lien invalide ou expiré.']], 422);
        }

        $user = User::findOrFail($userId);
        // Le code est parti à l'adresse du compte : l'utiliser prouve la possession de l'adresse (reprise d'une adresse squattée, P-01).
        $user->forceFill(['password' => $data['password'], 'email_verified_at' => $user->email_verified_at ?? now()])->save();

        // Le mot de passe a changé : toutes les sessions existantes sont fermées.
        $sessions->revokeAll($user);

        return response()->noContent();
    }
}
