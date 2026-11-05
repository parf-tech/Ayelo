<?php

use App\Http\Controllers\MediaController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PublicProfileController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [ProfileController::class, 'me']);
    Route::put('/me/profile', [ProfileController::class, 'upsert']);
    Route::patch('/me/privacy', [ProfileController::class, 'privacy']);
    Route::match(['get', 'put'], '/me/preferences', [ProfileController::class, 'preferences']);

    Route::post('/media/upload-url', [MediaController::class, 'uploadUrl'])->middleware('throttle:media-upload');
    Route::post('/media/{id}/complete', [MediaController::class, 'complete'])->whereUuid('id');
    Route::delete('/media/{id}', [MediaController::class, 'destroy'])->whereUuid('id');
    Route::put('/me/media/order', [MediaController::class, 'reorder']);

    Route::get('/profiles/{userId}', [PublicProfileController::class, 'show'])->whereUuid('userId');
});
