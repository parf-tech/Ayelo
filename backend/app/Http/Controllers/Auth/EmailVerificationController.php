<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AccountMail;
use App\Services\OneTimeCodes;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EmailVerificationController extends Controller
{
    public function verify(Request $request, OneTimeCodes $codes): Response
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:200']]);

        $userId = $codes->consume('email', $data['token']);
        if ($userId === null) {
            return response()->json(['error' => ['code' => 'invalid_token', 'message' => 'Lien invalide ou expiré.']], 422);
        }

        User::whereKey($userId)->whereNull('email_verified_at')->update(['email_verified_at' => now()]);

        return response()->noContent();
    }

    public function resend(Request $request, AccountMail $mail): Response
    {
        $user = $request->user();

        if ($user->email_verified_at === null) {
            $mail->sendVerification($user);
        }

        return response()->noContent();
    }
}
