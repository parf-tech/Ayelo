<?php

namespace App\Services\Push;

interface PushNotifier
{
    /**
     * Envoie une notification à un appareil. Renvoie false si le jeton est invalide (à effacer), true sinon (envoyé, ou
     * problème de configuration sans rapport avec le jeton).
     *
     * @param  array<string, string>  $data
     *
     * @throws RetryablePushException échec temporaire (5xx, 429, délai dépassé) : le jeton reste valide, l'appelant réessaie plus tard
     */
    public function send(string $platform, string $token, string $title, string $body, array $data = []): bool;
}
