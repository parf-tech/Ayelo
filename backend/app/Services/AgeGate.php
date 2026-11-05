<?php

namespace App\Services;

use App\Support\DeviceId;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Encryption\DecryptException;

/**
 * Contrôle d'âge exécuté AVANT la création du compte (docs FR-I-12).
 * - majeur : émet un jeton chiffré de 10 minutes qui contient la date de naissance et l'appareil ;
 * - mineur : refus mémorisé par empreinte d'appareil (banned_identifiers, kind = age_refusal).
 */
class AgeGate
{
    public const MIN_AGE = 18;

    public const TOKEN_TTL_MINUTES = 10;

    public const REFUSAL_DAYS = 90;

    public function isRefused(string $deviceId): bool
    {
        return DB::table('banned_identifiers')
            ->where('kind', 'age_refusal')
            ->where('value_hash', DeviceId::hash($deviceId))
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->exists();
    }

    public function isAdult(string $birthdate): bool
    {
        return CarbonImmutable::parse($birthdate)->startOfDay()->lte(CarbonImmutable::today()->subYears(self::MIN_AGE));
    }

    public function remember(string $deviceId): void
    {
        DB::table('banned_identifiers')->updateOrInsert(
            ['kind' => 'age_refusal', 'value_hash' => DeviceId::hash($deviceId)],
            ['id' => (string) \Illuminate\Support\Str::uuid(), 'reason' => 'age_under_18', 'expires_at' => now()->addDays(self::REFUSAL_DAYS), 'created_at' => now()]
        );
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
