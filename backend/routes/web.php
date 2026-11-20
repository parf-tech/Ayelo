<?php

use App\Http\Controllers\SiteController;
use Illuminate\Support\Facades\Route;

// L'API est sous /api/v1, le panneau d'administration est enregistré par Filament.

// Pages du site de présentation remplies par l'application (mentions légales). Atteinte seulement par la réécriture de Caddy ;
// sans le groupe `web` : aucune session, aucun cookie, aucune protection CSRF (lecture seule), donc réponse cachable.
Route::get('/_site/{page?}', [SiteController::class, 'show'])
    ->where('page', '.*')
    ->withoutMiddleware('web')
    ->name('site.page');
