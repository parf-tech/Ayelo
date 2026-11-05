<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Jetons à usage unique (vérification d'e-mail, réinitialisation de mot de passe) stockés dans
 * `verification_codes` : seule l'empreinte SHA-256 du secret est conservée.
 * Format du jeton envoyé : "<uuid de la ligne>.<secret aléatoire>".
 */
class OneTimeCodes
{
    public const MAX_ATTEMPTS = 5;

    public function issue(string $userId, string $channel, int $ttlMinutes): string
    {
        // Un seul jeton actif par canal : les précédents sont invalidés.
        DB::table('verification_codes')
            ->where('user_id', $userId)->where('channel', $channel)->whereNull('used_at')
            ->update(['used_at' => now(), 'updated_at' => now()]);

        $id = (string) Str::uuid();
        $secret = Str::random(40);

        DB::table('verification_codes')->insert([
            'id' => $id,
            'user_id' => $userId,
            'channel' => $channel,
            'code_hash' => hash('sha256', $secret),
            'attempts' => 0,
            'expires_at' => now()->addMinutes($ttlMinutes),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id.'.'.$secret;
    }

    /**
     * @return string|null identifiant de l'utilisateur si le jeton est valide (et alors consommé)
     */
    public function consume(string $channel, string $token): ?string
    {
        $parts = explode('.', $token, 2);
        if (count($parts) !== 2 || ! Str::isUuid($parts[0])) {
            return null;
        }

        [$id, $secret] = $parts;

        return DB::transaction(function () use ($id, $secret, $channel) {
            $row = DB::table('verification_codes')
                ->where('id', $id)->where('channel', $channel)
                ->whereNull('used_at')->where('expires_at', '>', now())
                ->lockForUpdate()->first();

            if (! $row || $row->attempts >= self::MAX_ATTEMPTS) {
                return null;
            }

            if (! hash_equals($row->code_hash, hash('sha256', $secret))) {
                DB::table('verification_codes')->where('id', $id)->update(['attempts' => $row->attempts + 1, 'updated_at' => now()]);

                return null;
            }

            DB::table('verification_codes')->where('id', $id)->update(['used_at' => now(), 'updated_at' => now()]);

            return $row->user_id;
        });
    }
}
