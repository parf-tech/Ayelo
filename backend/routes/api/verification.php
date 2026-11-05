<?php

use App\Http\Controllers\VerificationController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->prefix('me/verification')->group(function () {
    Route::get('/', [VerificationController::class, 'show']);
    Route::get('/pose', [VerificationController::class, 'pose']);
    Route::post('/', [VerificationController::class, 'store']);
});
