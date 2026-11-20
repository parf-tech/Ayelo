<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Présence en ligne (FR-D-4) : un compte est « en ligne » tant que sa clé de cache existe. La clé est posée à l'activité
 * authentifiée (middleware `TouchLastSeen` et battement `POST /me/presence`) et expire seule après `presence.ttl_seconds`.
 * La valeur est l'horodatage du dernier renouvellement : une requête ne réécrit la clé qu'après `presence.touch_interval_seconds`
 * (au plus une écriture de cache par compte et par intervalle). Aucun accès à la base.
 */
class Presence
{
    private const PREFIX = 'presence.';

    public function touch(string $userId): void
    {
        $now = now()->getTimestamp();
        $last = Cache::get(self::PREFIX.$userId);

        if ($last === null || $now - (int) $last >= (int) config('presence.touch_interval_seconds')) {
            Cache::put(self::PREFIX.$userId, $now, (int) config('presence.ttl_seconds'));
        }
    }

    public function isOnline(string $userId): bool
    {
        return Cache::has(self::PREFIX.$userId);
    }

    /**
     * Présence de plusieurs comptes en une seule lecture groupée (listes : découverte, conversations, matchs).
     *
     * @param  list<string>  $userIds
     * @return array<string, true> identifiants des comptes en ligne
     */
    public function onlineAmong(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $keys = [];
        foreach ($userIds as $id) {
            $keys[self::PREFIX.$id] = $id;
        }

        $online = [];
        foreach (Cache::many(array_keys($keys)) as $key => $value) {
            if ($value !== null) {
                $online[$keys[$key]] = true;
            }
        }

        return $online;
    }
}
