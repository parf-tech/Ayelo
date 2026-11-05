<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AccountMail;
use App\Services\DeviceSessions;
use App\Services\OneTimeCodes;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Validation\Rules\Password;

class PasswordController extends Controller
{
    /** Réponse identique que l'e-mail existe ou non (pas d'énumération de comptes). */
    public function forgot(Request $request, AccountMail $mail): Response
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:254']]);

        $user = User::where('email', strtolower($data['email']))->where('status', 'active')->first();
        if ($user !== null) {
            $mail->sendPasswordReset($user);
        }

        return response()->noContent();
    }

    public function reset(Request $request, OneTimeCodes $codes, DeviceSessions $sessions): Response
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:200'],
            'password' => ['required', 'string', Password::min(10)->letters()->numbers()],
        ]);

        $userId = $codes->consume('password_reset', $data['token']);
        if ($userId === null) {
            return response()->json(['error' => ['code' => 'invalid_token', 'message' => 'Lien invalide ou expiré.']], 422);
        }

        $user = User::findOrFail($userId);
        $user->forceFill(['password' => $data['password']])->save();

        // Le mot de passe a changé : toutes les sessions existantes sont fermées.
        $sessions->revokeAll($user);

        return response()->noContent();
    }
}
