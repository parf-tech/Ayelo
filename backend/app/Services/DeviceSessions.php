<?php

namespace App\Services;

use App\Models\User;
use App\Support\DeviceId;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Une session = un jeton Sanctum + une ligne `devices` (liste des appareils, FR-A-6).
 */
class DeviceSessions
{
    /** @return string jeton en clair, à renvoyer une seule fois au client */
    public function start(User $user, string $platform, string $deviceId, ?string $appVersion = null): string
    {
        $token = $user->createToken('mobile:'.$platform);

        DB::table('devices')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'token_id' => $token->accessToken->getKey(),
            'platform' => $platform,
            'device_fingerprint_hash' => DeviceId::hash($deviceId),
            'app_version' => $appVersion,
            'last_active_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $token->plainTextToken;
    }

    /** Révoque tous les jetons de l'utilisateur et efface les jetons de notification des appareils. */
    public function revokeAll(User $user): void
    {
        DB::table('devices')->where('user_id', $user->id)->update(['push_token' => null, 'voip_push_token' => null, 'updated_at' => now()]);
        DB::table('devices')->where('user_id', $user->id)->delete();
        $user->tokens()->delete();
    }
}
