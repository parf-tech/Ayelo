<?php

use App\Http\Controllers\ConversationController;
use App\Http\Controllers\DeviceController;
use App\Http\Controllers\MessageController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::post('/conversations', [ConversationController::class, 'store'])->middleware('throttle:conversations');
    Route::post('/conversations/{id}/hide', [ConversationController::class, 'hide'])->whereUuid('id');

    Route::get('/conversations/{id}/messages', [MessageController::class, 'index'])->whereUuid('id');
    Route::post('/conversations/{id}/messages', [MessageController::class, 'store'])->whereUuid('id')->middleware('throttle:messages');
    Route::post('/conversations/{id}/read', [MessageController::class, 'read'])->whereUuid('id');
    Route::post('/conversations/{id}/delivered', [MessageController::class, 'delivered'])->whereUuid('id');
    Route::post('/conversations/{id}/typing', [MessageController::class, 'typing'])->whereUuid('id')->middleware('throttle:typing');
    Route::delete('/messages/{id}', [MessageController::class, 'destroy'])->whereUuid('id');

    Route::put('/me/device', [DeviceController::class, 'update']);
    Route::match(['get', 'put'], '/me/notifications', [DeviceController::class, 'notifications']);
});
