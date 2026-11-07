<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Appel de l'API serveur LiveKit (RoomService/DeleteRoom, protocole Twirp) avec un jeton d'administration de 60 secondes
 * signé par la clé d'API. Une panne de LiveKit ne doit jamais faire échouer la fin d'un appel : l'erreur est journalisée.
 */
class LiveKitRoomService implements CallsRoomService
{
    public function closeRoom(string $room): bool
    {
        $key = config('services.livekit.api_key');
        $secret = config('services.livekit.api_secret');
        $url = (string) config('services.livekit.url');
        if (! $key || ! $secret || $url === '') {
            return false;
        }

        // L'URL du client est en wss:// ou ws:// ; l'API serveur est en https:// ou http://.
        $base = preg_replace('#^ws(s?)://#i', 'http$1://', rtrim($url, '/'));

        try {
            // La signature est dans le try : une clé invalide est journalisée, jamais propagée.
            $now = time();
            $jwt = JWT::encode(['iss' => $key, 'nbf' => $now, 'iat' => $now, 'exp' => $now + 60, 'video' => ['roomCreate' => true]], $secret, 'HS256');

            $response = Http::withToken($jwt)->acceptJson()->connectTimeout(2)->timeout(3)
                ->post($base.'/twirp/livekit.RoomService/DeleteRoom', ['room' => $room]);

            // 404 : salle déjà vide ou jamais ouverte, c'est le résultat voulu.
            return $response->successful() || $response->status() === 404;
        } catch (Throwable $e) {
            Log::warning('livekit: fermeture de salle impossible', ['room' => $room, 'error' => $e::class]);

            return false;
        }
    }
}
