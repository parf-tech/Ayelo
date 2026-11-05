<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/** Prévient l'application qu'un achat a été validé par le serveur : elle rafraîchit /billing/status. */
class BillingUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public string $userId) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    public function broadcastAs(): string
    {
        return 'billing.updated';
    }

    /** @return array<string, string> */
    public function broadcastWith(): array
    {
        return ['user_id' => $this->userId];
    }
}
