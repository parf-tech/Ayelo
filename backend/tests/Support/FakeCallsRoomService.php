<?php

namespace Tests\Support;

use App\Services\CallsRoomService;

/** Salles LiveKit simulées pour les tests : enregistre les fermetures, aucun appel réseau. */
class FakeCallsRoomService implements CallsRoomService
{
    /** @var list<string> */
    public array $closed = [];

    public function closeRoom(string $room): bool
    {
        $this->closed[] = $room;

        return true;
    }
}
