<?php

namespace App\Services;

use Illuminate\Container\Attributes\Bind;

/**
 * Gestion des salles LiveKit côté serveur (revue F-14). Le jeton de 10 minutes ne limite que l'entrée : à la fin,
 * au refus, à l'annulation ou à l'expiration d'un appel, la salle doit être fermée pour expulser les participants.
 */
#[Bind(LiveKitRoomService::class)]
interface CallsRoomService
{
    /** Ferme la salle (expulse les participants). Renvoie false si la fermeture n'a pas pu être demandée. */
    public function closeRoom(string $room): bool;
}
