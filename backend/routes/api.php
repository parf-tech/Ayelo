<?php

use App\Http\Controllers\Auth\AgeCheckController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\HealthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/health', HealthController::class);

    Route::prefix('auth')->group(function () {
        Route::post('/age-check', AgeCheckController::class)->middleware('throttle:age-check');
        Route::post('/register', RegisterController::class)->middleware('throttle:register');
        Route::post('/login', LoginController::class)->middleware('throttle:login');
        Route::post('/logout', LogoutController::class)->middleware('auth:sanctum');
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', fn (Request $request) => [
            'id' => $request->user()->id,
            'email' => $request->user()->email,
            'locale' => $request->user()->locale,
        ]);
    });
});
