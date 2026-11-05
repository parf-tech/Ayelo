<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class MessageCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    /** @param array<string, mixed> $message */
    public function __construct(public string $conversationId, public array $message) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('conversation.'.$this->conversationId)];
    }

    public function broadcastAs(): string
    {
        return 'message.created';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['message' => $this->message];
    }
}
