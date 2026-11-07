<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;

class BroadcastAuthController extends Controller
{
    /**
     * Autorise l'abonnement WebSocket à un canal privé
     *
     * Canaux `private-user.{id}` et `private-conversation.{id}`, selon `routes/channels.php`. Protocole Pusher : le client envoie l'identifiant de socket et le nom du canal, le serveur répond avec la signature.
     * Refus (403) si le compte n'est pas autorisé sur ce canal.
     *
     * @response array{auth: string, channel_data?: string}
     */
    public function __invoke(Request $request): mixed
    {
        $request->validate([
            'socket_id' => ['required', 'string', 'max:100'],
            'channel_name' => ['required', 'string', 'max:200'],
        ]);

        return Broadcast::auth($request);
    }
}
