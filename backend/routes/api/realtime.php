<?php

use Illuminate\Support\Facades\Broadcast;

// POST /api/v1/broadcasting/auth : autorise l'abonnement aux canaux privés (jeton Sanctum).
Broadcast::routes(['middleware' => ['auth:sanctum']]);

// Les canaux sont déclarés ici et non par `channels:` de bootstrap/app.php, qui enregistrerait aussi une route web
// /broadcasting/auth sans jeton ni limites (revue N-11).
require base_path('routes/channels.php');
