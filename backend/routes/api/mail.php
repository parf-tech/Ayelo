<?php

use App\Http\Controllers\MailWebhookController;
use Illuminate\Support\Facades\Route;

// Webhook de rebonds et plaintes e-mail : pas de Sanctum, authentifié par secret partagé (services.mail_webhook.secret).
Route::post('/webhooks/mail', MailWebhookController::class)->middleware('throttle:webhooks');
