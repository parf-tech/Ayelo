<?php

namespace App\Logging;

use Illuminate\Log\Logger;

/** Option `tap` des canaux de journalisation : ajoute le processeur de masquage des données sensibles. */
class RedactLogs
{
    public function __invoke(Logger $logger): void
    {
        $logger->getLogger()->pushProcessor(new RedactSensitiveData);
    }
}
