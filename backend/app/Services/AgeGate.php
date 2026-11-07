<?php

namespace App\Services;

use App\Support\DeviceId;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

/**
 * Contrôle d'âge exécuté AVANT la création du compte (docs FR-I-12).
 * - majeur : émet un jeton chiffré de 10 minutes qui contient la date de naissance et l'appareil ;
 * - mineur : refus mémorisé par appareil (90 jours) ET par adresse IP (30 minutes ; IPv6 ramenée à son /64).
 * Quand une identité (e-mail, compte social) se présente depuis un appareil ou une IP déjà refusés, le refus lui est étendu
 * (90 jours, empreinte HMAC seulement, décision Q1-B) : changer d'appareil ou d'IP ne suffit plus avec la même identité.
 *
 * L'identifiant d'appareil étant choisi par le client, il ne suffit pas seul (revue de sécurité F-02) : l'IP ajoute
 * un frein à un simple changement d'en-tête. Limite connue : derrière un partage d'IP (réseau mobile), le refus
 * touche brièvement d'autres personnes ; c'est pourquoi la fenêtre IP est courte (30 minutes, revue N-04). Le contrôle reste déclaratif.
 */
class AgeGate
{
    public const MIN_AGE = 18;

    public const TOKEN_TTL_MINUTES = 10;

    public const REFUSAL_DAYS = 90;

    public const IP_REFUSAL_MINUTES = 30;

    /**
     * Clé d'IP du refus d'âge (revue F-02, décision Q1-B). IPv4 : l'adresse. IPv6 : le préfixe /64, car un abonné
     * reçoit tout un /64 et change d'adresse à volonté à l'intérieur. Une IPv6 « mappée IPv4 » est ramenée à l'IPv4.
     */
    public static function ipKey(string $ip): string
    {
        $packed = @inet_pton(trim($ip));
        if ($packed === false) {
            return 'ip:'.strtolower(trim($ip));
        }

        if (strlen($packed) === 16) {
            if (str_starts_with($packed, str_repeat("\0", 10)."\xff\xff")) {
                return 'ip:'.inet_ntop(substr($packed, 12));
            }

            return 'ip6:'.bin2hex(substr($packed, 0, 8)).'/64';
        }

        return 'ip:'.inet_ntop($packed);
    }

    /** Clé d'e-mail du refus : forme canonique (alias « +tag », points Gmail) ; seule l'empreinte HMAC est stockée. */
    public static function emailKey(string $email): string
    {
        return 'email:'.BannedIdentifiers::normalize('email', $email);
    }

    /** Clé d'identité sociale du refus : fournisseur + identifiant stable (« sub »). */
    public static function socialKey(string $provider, string $subject): string
    {
        return 'social:'.strtolower($provider).':'.$subject;
    }

    /** Refus mémorisé pour l'appareil ou l'IP (/64 en IPv6). */
    public function isRefused(string $deviceId, ?string $ip = null): bool
    {
        if (BannedIdentifiers::has('age_refusal', 'device:'.$deviceId)) {
            return true;
        }

        return $ip !== null && BannedIdentifiers::has('age_refusal', self::ipKey($ip));
    }

    public function isEmailRefused(string $email): bool
    {
        return BannedIdentifiers::has('age_refusal', self::emailKey($email));
    }

    public function isSocialRefused(string $provider, string $subject): bool
    {
        return BannedIdentifiers::has('age_refusal', self::socialKey($provider, $subject));
    }

    /**
     * Étend un refus déjà en vigueur (appareil ou IP) à l'identité qui vient de se présenter : e-mail et/ou compte social,
     * mémorisés 90 jours sous forme d'empreinte HMAC (revue F-02, décision Q1-B). Sans effet si l'identité est inconnue.
     */
    public function rememberIdentity(?string $email = null, ?string $provider = null, ?string $subject = null): void
    {
        if ($email !== null && $email !== '') {
            BannedIdentifiers::remember('age_refusal', self::emailKey($email), 'age_under_18', now()->addDays(self::REFUSAL_DAYS));
        }

        if ($provider !== null && $provider !== '' && $subject !== null && $subject !== '') {
            BannedIdentifiers::remember('age_refusal', self::socialKey($provider, $subject), 'age_under_18', now()->addDays(self::REFUSAL_DAYS));
        }
    }

    public function isAdult(string $birthdate): bool
    {
        return CarbonImmutable::parse($birthdate)->startOfDay()->lte(CarbonImmutable::today()->subYears(self::MIN_AGE));
    }

    public function remember(string $deviceId, ?string $ip = null): void
    {
        BannedIdentifiers::remember('age_refusal', 'device:'.$deviceId, 'age_under_18', now()->addDays(self::REFUSAL_DAYS));

        if ($ip !== null) {
            BannedIdentifiers::remember('age_refusal', self::ipKey($ip), 'age_under_18', now()->addMinutes(self::IP_REFUSAL_MINUTES));
        }
    }

    public function issueToken(string $birthdate, string $deviceId): string
    {
        return Crypt::encryptString(json_encode([
            'birthdate' => CarbonImmutable::parse($birthdate)->toDateString(),
            'device' => DeviceId::hash($deviceId),
            'exp' => now()->addMinutes(self::TOKEN_TTL_MINUTES)->getTimestamp(),
        ], JSON_THROW_ON_ERROR));
    }

    /**
     * @return string|null date de naissance (Y-m-d) si le jeton est valide, non expiré et lié à cet appareil
     */
    public function readToken(?string $token, string $deviceId): ?string
    {
        if (! $token) {
            return null;
        }

        try {
            $data = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
        } catch (DecryptException|\JsonException) {
            return null;
        }

        if (($data['exp'] ?? 0) < now()->getTimestamp()) {
            return null;
        }

        if (! hash_equals((string) ($data['device'] ?? ''), DeviceId::hash($deviceId))) {
            return null;
        }

        $birthdate = (string) ($data['birthdate'] ?? '');

        return $this->isAdult($birthdate) ? $birthdate : null;
    }
}
