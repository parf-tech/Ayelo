<?php

namespace App\Services\OAuth;

use RuntimeException;

/** Apple n'a pas confirmé la révocation d'un jeton (réseau, 5xx, refus) : à réessayer plus tard. */
class AppleRevocationFailed extends RuntimeException {}
