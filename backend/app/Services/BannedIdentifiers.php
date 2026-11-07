<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Empreintes d'identifiants bannis (e-mail, téléphone, appareil, IP de refus d'âge) : seule l'empreinte HMAC est stockée. */
class BannedIdentifiers
{
    public static function hash(string $value): string
    {
        return hash_hmac('sha256', strtolower(trim($value)), (string) config('app.key'));
    }

    /**
     * Forme canonique d'une adresse e-mail (revue F-16) : minuscules, sans balise « +tag », et pour Gmail sans points
     * dans la partie locale (googlemail.com = gmail.com). Les autres types d'identifiants ne changent pas.
     * Les relais d'adresses masquées (Apple, etc.) ne peuvent pas être rapprochés de l'adresse réelle.
     */
    public static function normalize(string $kind, string $value): string
    {
        $value = strtolower(trim($value));
        if ($kind !== 'email' || ! str_contains($value, '@')) {
            return $value;
        }

        [$local, $domain] = explode('@', $value, 2);
        $local = explode('+', $local, 2)[0];
        if (in_array($domain, ['gmail.com', 'googlemail.com'], true)) {
            $local = str_replace('.', '', $local);
            $domain = 'gmail.com';
        }

        return ($local === '' ? explode('@', $value, 2)[0] : $local).'@'.$domain;
    }

    public static function has(string $kind, string $value): bool
    {
        // Forme canonique, et forme exacte pour les empreintes écrites avant la normalisation.
        $hashes = array_unique([self::hash(self::normalize($kind, $value)), self::hash($value)]);

        return DB::table('banned_identifiers')
            ->where('kind', $kind)->whereIn('value_hash', $hashes)
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->exists();
    }

    public static function remember(string $kind, string $value, string $reason, ?\DateTimeInterface $expiresAt = null): void
    {
        DB::table('banned_identifiers')->updateOrInsert(
            ['kind' => $kind, 'value_hash' => self::hash(self::normalize($kind, $value))],
            ['id' => (string) Str::uuid(), 'reason' => $reason, 'expires_at' => $expiresAt, 'created_at' => now()]
        );
    }
}
