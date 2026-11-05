<?php

use Illuminate\Support\Facades\Route;

/*
 | Routes de l'API v1, une unité par module (routes/api/*.php).
 | Chaque fichier est chargé sous le préfixe /api/v1. Un module = un fichier : pas de modification
 | concurrente du même fichier par plusieurs agents.
 */
Route::prefix('v1')->group(function () {
    foreach (glob(__DIR__.'/api/*.php') as $file) {
        require $file;
    }
});
