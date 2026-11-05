<?php

use App\Http\Controllers\BlockController;
use App\Http\Controllers\DiscoveryController;
use App\Http\Controllers\MatchController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SanctionController;
use App\Http\Controllers\SwipeController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/discover', DiscoveryController::class)->middleware('throttle:discover');
    Route::post('/swipes', [SwipeController::class, 'store'])->middleware('throttle:swipes');
    Route::post('/swipes/undo', [SwipeController::class, 'undo']);

    Route::get('/matches', [MatchController::class, 'index']);
    Route::delete('/matches/{id}', [MatchController::class, 'destroy'])->whereUuid('id');

    Route::get('/blocks', [BlockController::class, 'index']);
    Route::post('/blocks', [BlockController::class, 'store']);
    Route::delete('/blocks/{userId}', [BlockController::class, 'destroy'])->whereUuid('userId');

    Route::post('/reports', [ReportController::class, 'store']);
    Route::get('/me/sanctions', [SanctionController::class, 'index']);
    Route::post('/appeals', [SanctionController::class, 'appeal']);
});
