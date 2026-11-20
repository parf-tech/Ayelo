<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

class PresenceController extends Controller
{
    /**
     * Battement de présence : l'application ouverte mais sans autre appel (lecture d'une conversation, par exemple) le
     * renvoie environ une fois par minute pour rester « en ligne ». Le middleware `TouchLastSeen` pose la présence ; ce
     * contrôleur ne fait que répondre.
     */
    public function heartbeat(): Response
    {
        return response()->noContent();
    }
}
