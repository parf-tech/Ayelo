<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\SupportController;
use Illuminate\Support\Facades\Route;

// Page web publique de suppression (exigée par les stores) : demande puis confirmation par lien e-mail.
Route::post('/account-deletion-requests', [AccountController::class, 'requestWebDeletion'])->middleware('throttle:deletion-request');
Route::post('/account-deletion-requests/confirm', [AccountController::class, 'confirmWebDeletion'])->middleware('throttle:password-reset');

Route::middleware('auth:sanctum')->group(function () {
    Route::delete('/me', [AccountController::class, 'destroy'])->middleware('throttle:account-delete');
    Route::post('/me/export', [AccountController::class, 'requestExport']);
    Route::get('/me/export/{id}', [AccountController::class, 'export'])->whereUuid('id');
    Route::get('/me/consents', [AccountController::class, 'consents']);
    Route::post('/me/consents', [AccountController::class, 'consent']);

    Route::get('/support/tickets', [SupportController::class, 'index']);
    Route::post('/support/tickets', [SupportController::class, 'store']);
});
