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

    public static function has(string $kind, string $value): bool
    {
        return DB::table('banned_identifiers')
            ->where('kind', $kind)->where('value_hash', self::hash($value))
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->exists();
    }

    public static function remember(string $kind, string $value, string $reason, ?\DateTimeInterface $expiresAt = null): void
    {
        DB::table('banned_identifiers')->updateOrInsert(
            ['kind' => $kind, 'value_hash' => self::hash($value)],
            ['id' => (string) Str::uuid(), 'reason' => $reason, 'expires_at' => $expiresAt, 'created_at' => now()]
        );
    }
}
