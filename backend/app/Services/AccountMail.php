<?php

namespace App\Services;

use App\Mail\AccountDeletionMail;
use App\Mail\PasswordResetMail;
use App\Mail\VerifyEmailMail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

/** Envoi des e-mails de compte, dans la langue de l'utilisateur (FR-Z-2). */
class AccountMail
{
    public const VERIFY_TTL_MINUTES = 24 * 60;

    public const RESET_TTL_MINUTES = 60;

    public function __construct(private OneTimeCodes $codes, private MailSuppression $suppression) {}

    /**
     * Les trois envois (vérification, réinitialisation, suppression de compte) ignorent en silence une adresse en rebond définitif
     * ou en plainte (MailSuppression) : aucun jeton créé, aucune erreur, réponse HTTP identique (pas d'énumération).
     */
    public function sendVerification(User $user): void
    {
        if ($this->suppression->isSuppressed($user->email)) {
            return;
        }

        $token = $this->codes->issue($user->id, 'email', self::VERIFY_TTL_MINUTES);

        Mail::to($user->email)->locale($user->locale)->send(new VerifyEmailMail($this->link('verify-email', $token)));
    }

    public function sendPasswordReset(User $user): void
    {
        if ($this->suppression->isSuppressed($user->email)) {
            return;
        }

        $token = $this->codes->issue($user->id, 'password_reset', self::RESET_TTL_MINUTES);

        Mail::to($user->email)->locale($user->locale)->send(new PasswordResetMail($this->link('reset-password', $token)));
    }

    /** Lien de confirmation de suppression de compte (le jeton `account_deletion` est émis par l'appelant). */
    public function sendAccountDeletion(User $user, string $link): void
    {
        if ($this->suppression->isSuppressed($user->email)) {
            return;
        }

        Mail::to($user->email)->locale($user->locale)->send(new AccountDeletionMail($link));
    }

    /**
     * Envoi APRÈS l'envoi de la réponse (revue F-11) : le jeton est créé et l'e-mail part une fois la réponse partie, donc la durée
     * de la requête est la même que le compte existe ou non (pas d'énumération par le temps de réponse).
     */
    public function sendVerificationAfterResponse(User $user): void
    {
        $this->afterResponse(fn () => $this->sendVerification($user));
    }

    public function sendPasswordResetAfterResponse(User $user): void
    {
        $this->afterResponse(fn () => $this->sendPasswordReset($user));
    }

    /** Exécute après la réponse (callback de fin de requête du noyau) ; une panne d'envoi est journalisée, jamais renvoyée au client. */
    private function afterResponse(\Closure $send): void
    {
        $done = false;
        app()->terminating(function () use ($send, &$done) {
            // Une seule exécution : l'application garde ses callbacks entre deux requêtes (tests, Octane).
            if ($done) {
                return;
            }
            $done = true;

            try {
                $send();
            } catch (\Throwable $e) {
                report($e);
            }
        });
    }

    private function link(string $path, string $token): string
    {
        return rtrim((string) config('app.web_url'), '/').'/'.$path.'?token='.urlencode($token);
    }
}
