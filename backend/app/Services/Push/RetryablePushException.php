<?php

namespace App\Services\Push;

/**
 * Échec temporaire d'un envoi push (FCM 5xx, 429, délai dépassé, coupure réseau) : le jeton reste valide, la tâche
 * `SendPush` doit être rejouée plus tard avec un délai croissant. Le message ne contient aucun jeton ni texte de notification.
 */
class RetryablePushException extends \RuntimeException {}
