<?php

use App\Http\Controllers\CallController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('calls')->group(function () {
    Route::post('/', [CallController::class, 'store'])->middleware('throttle:calls');
    Route::post('/{id}/accept', [CallController::class, 'accept'])->whereUuid('id');
    Route::post('/{id}/decline', [CallController::class, 'decline'])->whereUuid('id');
    Route::post('/{id}/end', [CallController::class, 'end'])->whereUuid('id');
    Route::post('/{id}/token', [CallController::class, 'token'])->whereUuid('id');
});
