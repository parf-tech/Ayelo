<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/** Événements légers d'une conversation : message.delivered, message.read, typing. */
class ConversationSignal implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    /** @param array<string, mixed> $payload */
    public function __construct(public string $conversationId, public string $name, public array $payload) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('conversation.'.$this->conversationId)];
    }

    public function broadcastAs(): string
    {
        return $this->name;
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
