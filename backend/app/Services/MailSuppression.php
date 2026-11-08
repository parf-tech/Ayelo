<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Adresses à ne plus écrire : rebond définitif ou plainte pour courrier indésirable, signalés par le prestataire d'e-mail.
 * Continuer à envoyer à ces adresses abîme la réputation du domaine d'envoi (SPF / DKIM / DMARC) et le taux de remise de tous.
 */
class MailSuppression
{
    public const HARD_BOUNCE = 'hard_bounce';

    public const COMPLAINT = 'complaint';

    public function isSuppressed(string $email): bool
    {
        $email = $this->normalize($email);

        return $email !== '' && DB::table('email_suppressions')->where('email', $email)->exists();
    }

    /** Idempotent : une adresse déjà supprimée garde son premier motif. Renvoie true si la ligne vient d'être créée. */
    public function suppress(string $email, string $reason, string $provider): bool
    {
        $email = $this->normalize($email);
        if ($email === '' || ! in_array($reason, [self::HARD_BOUNCE, self::COMPLAINT], true)) {
            return false;
        }

        return DB::table('email_suppressions')->insertOrIgnore([
            'email' => $email, 'reason' => $reason, 'provider' => mb_substr($provider, 0, 40), 'created_at' => now(),
        ]) > 0;
    }

    /** Adresse valide pour un envoi, sinon chaîne vide. La casse est ignorée par la colonne citext. */
    public function normalize(string $email): string
    {
        $email = trim($email);

        return mb_strlen($email) <= 254 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false ? $email : '';
    }
}
