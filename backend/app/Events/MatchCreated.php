<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/** Diffusé aux deux utilisateurs d'un nouveau match sur leur canal privé (docs/10, canaux). */
class MatchCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public string $matchId,
        public string $conversationId,
        public string $userA,
        public string $userB,
    ) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userA), new PrivateChannel('user.'.$this->userB)];
    }

    public function broadcastAs(): string
    {
        return 'match.created';
    }

    /** @return array<string, string> */
    public function broadcastWith(): array
    {
        return ['match_id' => $this->matchId, 'conversation_id' => $this->conversationId];
    }
}
