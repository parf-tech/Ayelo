<?php

use App\Http\Controllers\HealthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/health', HealthController::class);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', fn (Request $request) => [
            'id' => $request->user()->id,
            'email' => $request->user()->email,
            'locale' => $request->user()->locale,
        ]);
    });
});
