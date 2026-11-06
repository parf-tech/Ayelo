<?php

namespace App\Services;

use App\Support\DeviceId;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

/**
 * Contrôle d'âge exécuté AVANT la création du compte (docs FR-I-12).
 * - majeur : émet un jeton chiffré de 10 minutes qui contient la date de naissance et l'appareil ;
 * - mineur : refus mémorisé par appareil (90 jours) ET par adresse IP (30 minutes).
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

    public function isRefused(string $deviceId, ?string $ip = null): bool
    {
        if (BannedIdentifiers::has('age_refusal', 'device:'.$deviceId)) {
            return true;
        }

        return $ip !== null && BannedIdentifiers::has('age_refusal', 'ip:'.$ip);
    }

    public function isAdult(string $birthdate): bool
    {
        return CarbonImmutable::parse($birthdate)->startOfDay()->lte(CarbonImmutable::today()->subYears(self::MIN_AGE));
    }

    public function remember(string $deviceId, ?string $ip = null): void
    {
        BannedIdentifiers::remember('age_refusal', 'device:'.$deviceId, 'age_under_18', now()->addDays(self::REFUSAL_DAYS));

        if ($ip !== null) {
            BannedIdentifiers::remember('age_refusal', 'ip:'.$ip, 'age_under_18', now()->addMinutes(self::IP_REFUSAL_MINUTES));
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
