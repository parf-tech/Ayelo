<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Format d'erreur unique de l'API (docs/10-API-SPECIFICATIONS.md) :
        // { "error": { "code", "message", "fields"? } }
        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['error' => [
                    'code' => 'validation_failed',
                    'message' => 'Données invalides.',
                    'fields' => $e->errors(),
                ]], 422);
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['error' => ['code' => 'unauthenticated', 'message' => 'Authentification requise.']], 401);
            }
        });

        $exceptions->render(function (TooManyRequestsHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(
                    ['error' => ['code' => 'rate_limited', 'message' => 'Trop de tentatives. Réessayez plus tard.']],
                    429,
                    array_filter(['Retry-After' => $e->getHeaders()['Retry-After'] ?? null])
                );
            }
        });
    })->create();
