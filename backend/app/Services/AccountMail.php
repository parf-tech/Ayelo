<?php

namespace App\Services;

use App\Mail\PasswordResetMail;
use App\Mail\VerifyEmailMail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

/** Envoi des e-mails de compte, dans la langue de l'utilisateur (FR-Z-2). */
class AccountMail
{
    public const VERIFY_TTL_MINUTES = 24 * 60;

    public const RESET_TTL_MINUTES = 60;

    public function __construct(private OneTimeCodes $codes) {}

    public function sendVerification(User $user): void
    {
        $token = $this->codes->issue($user->id, 'email', self::VERIFY_TTL_MINUTES);

        Mail::to($user->email)->locale($user->locale)->send(new VerifyEmailMail($this->link('verify-email', $token)));
    }

    public function sendPasswordReset(User $user): void
    {
        $token = $this->codes->issue($user->id, 'password_reset', self::RESET_TTL_MINUTES);

        Mail::to($user->email)->locale($user->locale)->send(new PasswordResetMail($this->link('reset-password', $token)));
    }

    private function link(string $path, string $token): string
    {
        return rtrim((string) config('app.web_url'), '/').'/'.$path.'?token='.urlencode($token);
    }
}
