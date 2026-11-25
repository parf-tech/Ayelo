<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Nouveau message d'une conversation. Diffusé dans la requête (ShouldBroadcastNow) et non par la file : la latence d'un message
 * ne dépend pas des pushes ni des exports qui partagent les workers (revue CTO 1). L'appelant protège l'envoi d'un échec de la
 * diffusion (MessageController::store) : le message est déjà enregistré.
 */
class MessageCreated implements ShouldBroadcastNow
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
