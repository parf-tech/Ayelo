<?php

namespace App\Jobs;

use App\Services\CallsRoomService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Ferme une salle LiveKit hors de la requête (fin, refus, annulation, expiration d'appel) : l'appel HTTP vers LiveKit
 * ne bloque ni la réponse à l'utilisateur ni la boucle du planificateur. File « realtime » (worker dédié).
 * Une panne de LiveKit est journalisée, jamais propagée : le job n'est pas rejoué à l'infini.
 */
class CloseCallRoom implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $timeout = 10;

    public function __construct(public string $room)
    {
        $this->onQueue('realtime');
    }

    public function handle(CallsRoomService $rooms): void
    {
        try {
            $rooms->closeRoom($this->room);
        } catch (Throwable $e) {
            Log::warning('livekit: fermeture de salle impossible', ['room' => $this->room, 'error' => $e::class]);
        }
    }
}
