<?php

namespace App\Services;

use App\Models\User;
use App\Support\DeviceId;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Une session = un jeton Sanctum + une ligne `devices` (liste des appareils, FR-A-6).
 *
 * Rotation (revue F-18) : un seul jeton actif par couple (compte, X-Device-Id). Une nouvelle connexion depuis le même
 * appareil révoque le jeton précédent (et reprend ses jetons de notification, pour ne pas couper les notifications) ;
 * au plus `safety.max_sessions_per_user` sessions par compte, les plus anciennes sont fermées au-delà.
 */
class DeviceSessions
{
    /** @return string jeton en clair, à renvoyer une seule fois au client */
    public function start(User $user, string $platform, string $deviceId, ?string $appVersion = null): string
    {
        $fingerprint = DeviceId::hash($deviceId);

        return DB::transaction(function () use ($user, $platform, $fingerprint, $appVersion) {
            $previous = DB::table('devices')->where('user_id', $user->id)->where('device_fingerprint_hash', $fingerprint)->get();
            $carry = $previous->first(fn ($d) => $d->push_token !== null || $d->voip_push_token !== null);
            $this->revokeRows($user, $previous->all());

            $token = $user->createToken('mobile:'.$platform);

            DB::table('devices')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $user->id,
                'token_id' => $token->accessToken->getKey(),
                'platform' => $platform,
                'push_token' => $carry?->push_token,
                'voip_push_token' => $carry?->voip_push_token,
                'device_fingerprint_hash' => $fingerprint,
                'app_version' => $appVersion,
                'last_active_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->enforceCap($user);

            return $token->plainTextToken;
        });
    }

    /** Révoque tous les jetons de l'utilisateur et efface les jetons de notification des appareils. */
    public function revokeAll(User $user): void
    {
        DB::table('devices')->where('user_id', $user->id)->update(['push_token' => null, 'voip_push_token' => null, 'updated_at' => now()]);
        DB::table('devices')->where('user_id', $user->id)->delete();
        $user->tokens()->delete();
    }

    /** Ferme les sessions les plus anciennes au-delà du plafond par compte. */
    private function enforceCap(User $user): void
    {
        $max = max(1, (int) config('safety.max_sessions_per_user', 10));
        $rows = DB::table('devices')->where('user_id', $user->id)->orderByDesc('created_at')->orderByDesc('id')->get();
        if ($rows->count() > $max) {
            $this->revokeRows($user, $rows->slice($max)->all());
        }
    }

    /** @param  array<int, object>  $rows  lignes `devices` à retirer avec leur jeton */
    private function revokeRows(User $user, array $rows): void
    {
        if ($rows === []) {
            return;
        }

        // Le jeton push est unique : la ligne est supprimée avant que la nouvelle ne le reprenne.
        DB::table('devices')->whereIn('id', array_map(fn ($d) => $d->id, $rows))->delete();
        $tokenIds = array_filter(array_map(fn ($d) => $d->token_id, $rows));
        if ($tokenIds !== []) {
            $user->tokens()->whereKey($tokenIds)->delete();
        }
    }
}
