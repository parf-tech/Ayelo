<?php

use App\Http\Controllers\Auth\AgeCheckController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\OAuthController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\SessionController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('/age-check', AgeCheckController::class)->middleware('throttle:age-check');
    Route::post('/register', RegisterController::class)->middleware('throttle:register');
    Route::post('/login', LoginController::class)->middleware('throttle:login');
    Route::post('/oauth/{provider}', OAuthController::class)->middleware('throttle:oauth')->where('provider', 'google|apple');

    Route::post('/email/verify', [EmailVerificationController::class, 'verify'])->middleware('throttle:email-verify');
    Route::post('/password/forgot', [PasswordController::class, 'forgot'])->middleware('throttle:password-forgot');
    Route::post('/password/reset', [PasswordController::class, 'reset'])->middleware('throttle:password-reset');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', LogoutController::class);
        Route::post('/email/resend', [EmailVerificationController::class, 'resend'])->middleware('throttle:email-resend');
        Route::get('/sessions', [SessionController::class, 'index']);
        Route::delete('/sessions', [SessionController::class, 'destroyAll']);
        Route::delete('/sessions/{device}', [SessionController::class, 'destroy'])->whereUuid('device');
    });
});
