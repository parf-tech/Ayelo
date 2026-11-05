<?php

namespace App\Services\Push;

interface PushNotifier
{
    /**
     * Envoie une notification à un appareil. Renvoie false si le jeton est invalide (à effacer).
     *
     * @param  array<string, string>  $data
     */
    public function send(string $platform, string $token, string $title, string $body, array $data = []): bool;
}
