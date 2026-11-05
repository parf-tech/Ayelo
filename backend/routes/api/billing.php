<?php

use App\Http\Controllers\BillingController;
use Illuminate\Support\Facades\Route;

// Webhook : pas de Sanctum, authentifié par secret (voir config/billing.php).
Route::post('/webhooks/revenuecat', [BillingController::class, 'webhook'])->middleware('throttle:webhooks');

Route::middleware('auth:sanctum')->prefix('billing')->group(function () {
    Route::get('/offers', [BillingController::class, 'offers']);
    Route::get('/status', [BillingController::class, 'status']);
    Route::post('/sync', [BillingController::class, 'sync']);
    Route::get('/transactions', [BillingController::class, 'transactions']);
});
