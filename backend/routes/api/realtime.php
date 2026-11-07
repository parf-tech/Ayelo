<?php

use App\Http\Controllers\BroadcastAuthController;
use Illuminate\Support\Facades\Route;

// POST /api/v1/broadcasting/auth : autorise l'abonnement aux canaux privés (jeton Sanctum). Route déclarée ici plutôt que par
// Broadcast::routes(), dont le contrôleur du framework n'est pas décrit dans le contrat OpenAPI (GET et POST, sans corps).
Route::post('/broadcasting/auth', BroadcastAuthController::class)->middleware('auth:sanctum');

// Les canaux sont déclarés ici et non par `channels:` de bootstrap/app.php, qui enregistrerait aussi une route web
// /broadcasting/auth sans jeton ni limites (revue N-11).
require base_path('routes/channels.php');
