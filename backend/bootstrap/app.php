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
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Adresse IP réelle derrière le reverse proxy (Caddy) : seuls les proxys listés sont crus (revue F-04).
        // TRUSTED_PROXIES = liste séparée par des virgules (CIDR). Vide = aucun proxy de confiance (valeur sûre).
        $proxies = array_values(array_filter(array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', '')))));
        if ($proxies !== []) {
            $middleware->trustProxies(at: $proxies, headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO);
        }

        // Limite générale par compte ou par IP, et refus des comptes suspendus/bannis sur les jetons déjà émis (F-03, F-12).
        $middleware->throttleApi('api');
        $middleware->appendToGroup('api', \App\Http\Middleware\EnsureAccountActive::class);
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
