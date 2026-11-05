<?php

use App\Http\Controllers\HealthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::middleware('auth:sanctum')->get('/me', fn (Request $request) => [
    'id' => $request->user()->id,
    'email' => $request->user()->email,
    'locale' => $request->user()->locale,
    'email_verified' => $request->user()->email_verified_at !== null,
]);
