<?php

use Illuminate\Support\Facades\Broadcast;

// POST /api/v1/broadcasting/auth : autorise l'abonnement aux canaux privés (jeton Sanctum).
Broadcast::routes(['middleware' => ['auth:sanctum']]);
